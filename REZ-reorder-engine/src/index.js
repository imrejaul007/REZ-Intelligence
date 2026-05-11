'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

const logger = require('../shared/logger');
const { errorHandler, asyncHandler } = require('../shared/errorHandler');

// Environment validation
const REQUIRED_ENV = ['MONGODB_URI', 'REDIS_URL', 'INTERNAL_SERVICE_TOKEN'];
for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    console.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// Commerce categories this service handles
const COMMERCE_CATEGORIES = {
  RESTAURANT: 'restaurant',
  HOTEL: 'hotel',
  RETAIL: 'retail',
  BOOKING: 'booking', // appointments, tables, etc.
  SERVICES: 'services',
  FINTECH: 'fintech'
};

// MongoDB Schemas
const reorderProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  merchantId: { type: String, required: true, index: true },
  category: {
    type: String,
    enum: Object.values(COMMERCE_CATEGORIES),
    default: COMMERCE_CATEGORIES.RESTAURANT
  },

  // Order info
  lastOrderId: { type: String, required: true },
  lastOrderDate: { type: Date, required: true },
  orderFrequencyDays: { type: Number, default: 7 },

  // Predictions
  predictedReorderDate: { type: Date },
  reorderScore: { type: Number, min: 0, max: 1 },
  urgency: { type: String, enum: ['high', 'medium', 'low'], default: 'low' },

  // Nudge tracking
  nudgeSent: { type: Boolean, default: false },
  nudgeSentAt: { type: Date },
  nudgeInteractions: {
    sent: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    converted: { type: Number, default: 0 }
  },

  // What was ordered
  orderSummary: {
    items: [{
      itemId: String,
      name: String,
      quantity: Number,
      price: Number,
      category: String
    }],
    totalValue: Number,
    currency: { type: String, default: 'INR' }
  },

  // Computed metrics
  metrics: {
    totalOrders: { type: Number, default: 1 },
    avgOrderValue: Number,
    avgQuantity: Number,
    lastInteraction: String,
    favoriteItemId: String,
    favoriteItemName: String
  }
}, { timestamps: true });

reorderProfileSchema.index({ userId: 1, merchantId: 1, category: 1 }, { unique: true });
reorderProfileSchema.index({ predictedReorderDate: 1, nudgeSent: 1, reorderScore: 1 });

const ReorderProfile = mongoose.model('ReorderProfile', reorderProfileSchema);

const nudgeQueueSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  merchantId: { type: String, required: true },
  reorderProfileId: { type: String, required: true },
  category: { type: String, default: 'restaurant' },

  nudgeType: {
    type: String,
    enum: ['reorder_reminder', 'deal_alert', 'new_item', 'loyalty_reward', 'price_drop'],
    required: true
  },

  scheduledFor: { type: Date, required: true, index: true },

  content: {
    title: String,
    body: String,
    imageUrl: String,
    actionText: String,
    items: [String]
  },

  channels: [{
    type: String,
    enum: ['push', 'sms', 'email', 'whatsapp']
  }],

  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'clicked', 'converted', 'dismissed', 'failed'],
    default: 'pending'
  },

  sentAt: Date,
  clickAt: Date,
  convertAt: Date,
  error: String
}, { timestamps: true });

nudgeQueueSchema.index({ status: 1, scheduledFor: 1 });

const NudgeQueue = mongoose.model('NudgeQueue', nudgeQueueSchema);

// Reorder prediction logic
function calculateReorderScore(profile) {
  const daysSinceLastOrder = Math.floor(
    (Date.now() - profile.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const orderFrequencyDays = profile.orderFrequencyDays || 7;

  // Days until predicted reorder
  const daysUntilPredicted = profile.predictedReorderDate
    ? Math.floor((profile.predictedReorderDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : orderFrequencyDays;

  // Scoring components
  const timingScore = daysUntilPredicted <= 1 ? 0.9 :
                     daysUntilPredicted <= 3 ? 0.7 :
                     daysUntilPredicted <= 7 ? 0.5 : 0.2;

  const frequencyScore = profile.metrics?.totalOrders > 5 ? 0.9 :
                        profile.metrics?.totalOrders > 3 ? 0.7 :
                        profile.metrics?.totalOrders > 1 ? 0.5 : 0.3;

  const recencyScore = daysSinceLastOrder <= orderFrequencyDays ? 0.8 :
                      daysSinceLastOrder <= orderFrequencyDays * 2 ? 0.6 :
                      daysSinceLastOrder <= orderFrequencyDays * 3 ? 0.3 : 0.1;

  const conversionScore = profile.nudgeInteractions?.converted > 0 ? 0.8 :
                        profile.nudgeInteractions?.clicked > 0 ? 0.5 : 0.2;

  const finalScore = (
    timingScore * 0.35 +
    frequencyScore * 0.25 +
    recencyScore * 0.25 +
    conversionScore * 0.15
  );

  return Math.min(1, Math.max(0, finalScore));
}

function determineUrgency(score) {
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

// Generate personalized nudge content
function generateNudgeContent(profile, merchantName) {
  const daysSince = Math.floor(
    (Date.now() - profile.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const category = profile.category;
  const items = profile.orderSummary?.items || [];
  const topItem = items[0];

  const templates = {
    restaurant: {
      title: `${daysSince} days since ${topItem?.name || 'your last order'}?`,
      body: `Your favorite at ${merchantName} is waiting. Reorder now!`,
      actionText: 'Order Again'
    },
    hotel: {
      title: `Ready for your next stay?`,
      body: `${merchantName} has rooms available. Book your next escape.`,
      actionText: 'Book Now'
    },
    retail: {
      title: `${topItem?.name || 'This item'} running low?`,
      body: `Time to restock from ${merchantName}. Quick reorder!`,
      actionText: 'Reorder'
    },
    booking: {
      title: `Time for your next ${topItem?.name || 'appointment'}?`,
      body: `${merchantName} has availability. Book your spot!`,
      actionText: 'Book Again'
    },
    services: {
      title: `Need another ${topItem?.name || 'service'}?`,
      body: `${merchantName} is ready to help. Schedule again!`,
      actionText: 'Book Service'
    },
    fintech: {
      title: `Your ${topItem?.name || 'service'} subscription`,
      body: `Manage your ${merchantName} account. Quick action needed?`,
      actionText: 'Manage'
    }
  };

  return templates[category] || templates.restaurant;
}

// Express app
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  logger.info(`${req.method} ${req.path}`, { requestId: req.requestId });
  next();
});

app.use((req, res, next) => {
  const publicPaths = ['/health', '/ready'];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();

  const token = req.headers['x-internal-token'];
  if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'reorder-engine',
    categories: Object.values(COMMERCE_CATEGORIES),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready', mongodb: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: err.message });
  }
});

// Create/update reorder profile
app.post('/api/reorder/profile', asyncHandler(async (req, res) => {
  const { userId, merchantId, category, orderId, items, orderValue, currency = 'INR' } = req.body;

  if (!userId || !merchantId || !orderId) {
    return res.status(400).json({ error: 'userId, merchantId, and orderId required' });
  }

  const commerceCategory = category || COMMERCE_CATEGORIES.RESTAURANT;

  let profile = await ReorderProfile.findOne({ userId, merchantId, category: commerceCategory });

  if (profile) {
    // Update existing profile
    const daysSinceLast = Math.floor(
      (Date.now() - profile.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const prevOrders = profile.metrics.totalOrders;

    profile.lastOrderId = orderId;
    profile.lastOrderDate = new Date();
    profile.orderFrequencyDays = Math.min(
      Math.max(1, (profile.orderFrequencyDays * prevOrders + daysSinceLast) / (prevOrders + 1)),
      90
    );
    profile.predictedReorderDate = new Date(Date.now() + profile.orderFrequencyDays * 24 * 60 * 60 * 1000);
    profile.metrics.totalOrders += 1;
    profile.metrics.avgOrderValue = (
      (profile.metrics.avgOrderValue * prevOrders + orderValue) / profile.metrics.totalOrders
    );
    profile.orderSummary = {
      items: items?.map(i => ({
        itemId: i.itemId || i.productId || uuidv4(),
        name: i.name,
        quantity: i.quantity || 1,
        price: i.price || 0,
        category: i.category
      })) || [],
      totalValue: orderValue || 0,
      currency
    };

    // Update favorite item
    if (items?.length > 0) {
      const maxQty = items.reduce((max, i) => i.quantity > max.quantity ? i : max, items[0]);
      profile.metrics.favoriteItemId = maxQty.itemId || maxQty.productId;
      profile.metrics.favoriteItemName = maxQty.name;
    }

    profile.nudgeSent = false;
    profile.reorderScore = calculateReorderScore(profile);
    profile.urgency = determineUrgency(profile.reorderScore);

    await profile.save();
  } else {
    // Create new profile
    profile = await ReorderProfile.create({
      userId,
      merchantId,
      category: commerceCategory,
      lastOrderId: orderId,
      lastOrderDate: new Date(),
      orderFrequencyDays: 7,
      predictedReorderDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      reorderScore: 0.5,
      urgency: 'medium',
      orderSummary: {
        items: items?.map(i => ({
          itemId: i.itemId || i.productId || uuidv4(),
          name: i.name,
          quantity: i.quantity || 1,
          price: i.price || 0,
          category: i.category
        })) || [],
        totalValue: orderValue || 0,
        currency
      },
      metrics: {
        totalOrders: 1,
        avgOrderValue: orderValue || 0,
        avgQuantity: items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0,
        lastInteraction: 'order_placed',
        favoriteItemId: items?.[0]?.itemId,
        favoriteItemName: items?.[0]?.name
      }
    });
  }

  logger.info('Reorder profile updated', {
    requestId: req.requestId,
    userId,
    merchantId,
    category: commerceCategory,
    reorderScore: profile.reorderScore
  });

  res.json({
    success: true,
    profile: {
      userId: profile.userId,
      merchantId: profile.merchantId,
      category: profile.category,
      reorderScore: profile.reorderScore,
      urgency: profile.urgency,
      predictedReorderDate: profile.predictedReorderDate,
      orderFrequencyDays: Math.round(profile.orderFrequencyDays),
      metrics: profile.metrics
    }
  });
}));

// Get reorder recommendations for user (across all categories)
app.get('/api/reorder/user/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { category, threshold = 0.5, limit = 10 } = req.query;

  const query = { userId, reorderScore: { $gte: parseFloat(threshold) }, nudgeSent: false };
  if (category) query.category = category;

  const profiles = await ReorderProfile.find(query)
    .sort({ reorderScore: -1, predictedReorderDate: 1 })
    .limit(parseInt(limit))
    .lean();

  const recommendations = profiles.map(profile => ({
    merchantId: profile.merchantId,
    category: profile.category,
    reorderScore: profile.reorderScore,
    urgency: profile.urgency,
    predictedReorderDate: profile.predictedReorderDate,
    lastOrderDate: profile.lastOrderDate,
    avgOrderValue: profile.metrics?.avgOrderValue,
    favoriteItem: {
      id: profile.metrics?.favoriteItemId,
      name: profile.metrics?.favoriteItemName
    },
    topItems: profile.orderSummary?.items?.slice(0, 3) || []
  }));

  res.json({
    success: true,
    userId,
    recommendations,
    count: recommendations.length
  });
}));

// Get reorder recommendations for homepage
app.get('/api/reorder/homepage/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Get personalized recommendations
  const personalized = await ReorderProfile.find({
    userId,
    reorderScore: { $gte: 0.6 },
    nudgeSent: false,
    'metrics.lastInteraction': { $ne: 'dismissed' }
  })
  .sort({ reorderScore: -1 })
  .limit(5)
  .lean();

  // Get high-intent recommendations (imminent reorder dates)
  const imminent = await ReorderProfile.find({
    userId,
    urgency: 'high',
    predictedReorderDate: { $lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }
  })
  .sort({ predictedReorderDate: 1 })
  .limit(3)
  .lean();

  res.json({
    success: true,
    userId,
    personalized: personalized.map(p => ({
      type: 'reorder',
      category: p.category,
      merchantId: p.merchantId,
      title: getReorderTitle(p),
      subtitle: p.metrics?.favoriteItemName || p.orderSummary?.items?.[0]?.name,
      score: p.reorderScore,
      urgency: p.urgency,
      items: p.orderSummary?.items?.slice(0, 3)
    })),
    imminent: imminent.map(p => ({
      type: 'imminent_reorder',
      category: p.category,
      merchantId: p.merchantId,
      title: 'Reorder soon!',
      subtitle: `Due ${formatDate(p.predictedReorderDate)}`,
      score: p.reorderScore,
      urgency: 'high'
    }))
  });
}));

// Helper functions
function getReorderTitle(profile) {
  const titles = {
    restaurant: 'Order again?',
    hotel: 'Book your next stay?',
    retail: 'Time to restock?',
    booking: 'Book again?',
    services: 'Need service again?',
    fintech: 'Manage your account?'
  };
  return titles[profile.category] || titles.restaurant;
}

function formatDate(date) {
  if (!date) return 'today';
  const days = Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

// Track nudge interaction
app.post('/api/reorder/nudge/:nudgeId/click', asyncHandler(async (req, res) => {
  const { nudgeId } = req.params;

  const nudge = await NudgeQueue.findByIdAndUpdate(
    nudgeId,
    { status: 'clicked', clickAt: new Date() },
    { new: true }
  );

  if (!nudge) {
    return res.status(404).json({ error: 'Nudge not found' });
  }

  // Update profile
  await ReorderProfile.findByIdAndUpdate(nudge.reorderProfileId, {
    'nudgeInteractions.clicked': true
  });

  res.json({ success: true, nudge });
}));

app.post('/api/reorder/nudge/:nudgeId/convert', asyncHandler(async (req, res) => {
  const { nudgeId } = req.params;
  const { orderId } = req.body;

  const nudge = await NudgeQueue.findByIdAndUpdate(
    nudgeId,
    { status: 'converted', convertAt: new Date() },
    { new: true }
  );

  if (!nudge) {
    return res.status(404).json({ error: 'Nudge not found' });
  }

  // Update profile
  await ReorderProfile.findByIdAndUpdate(nudge.reorderProfileId, {
    'nudgeInteractions.converted': true,
    lastOrderDate: new Date(),
    nudgeSent: false
  });

  logger.info('Reorder converted', { requestId: req.requestId, nudgeId, orderId });

  res.json({ success: true, nudge });
}));

// Get analytics
app.get('/api/reorder/analytics', asyncHandler(async (req, res) => {
  const { merchantId, category, startDate, endDate } = req.query;

  const match = {};
  if (merchantId) match.merchantId = merchantId;
  if (category) match.category = category;
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  const [profiles, nudges, conversions] = await Promise.all([
    ReorderProfile.countDocuments(match),
    NudgeQueue.countDocuments({ ...match, nudgeType: 'reorder_reminder' }),
    NudgeQueue.countDocuments({ ...match, status: 'converted' })
  ]);

  const conversionRate = nudges > 0 ? (conversions / nudges * 100).toFixed(2) : 0;

  // Category breakdown
  const categoryBreakdown = await ReorderProfile.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 }, avgScore: { $avg: '$reorderScore' } } }
  ]);

  res.json({
    success: true,
    analytics: {
      totalProfiles: profiles,
      nudgesSent: nudges,
      conversions,
      conversionRate: parseFloat(conversionRate),
      byCategory: categoryBreakdown
    }
  });
}));

// Cron job: Process nudge queue
async function processNudgeQueue() {
  try {
    const now = new Date();

    const pendingNudges = await NudgeQueue.find({
      status: 'pending',
      scheduledFor: { $lte: now }
    }).limit(100).lean();

    for (const nudge of pendingNudges) {
      // In production, this would call push/notification service
      await NudgeQueue.findByIdAndUpdate(nudge._id, {
        status: 'sent',
        sentAt: now
      });

      await ReorderProfile.findByIdAndUpdate(nudge.reorderProfileId, {
        nudgeSent: true,
        nudgeSentAt: now,
        'nudgeInteractions.sent': true
      });

      logger.info('Nudge sent', {
        nudgeId: nudge._id,
        userId: nudge.userId,
        nudgeType: nudge.nudgeType
      });
    }

    logger.info(`Processed ${pendingNudges.length} nudges`);
  } catch (err) {
    logger.error('Nudge queue processing failed', { error: err.message });
  }
}

app.use(errorHandler);

const PORT = process.env.PORT || 4040;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    app.listen(PORT, () => {
      logger.info(`Reorder Engine started on port ${PORT}`);
      logger.info(`Categories: ${Object.values(COMMERCE_CATEGORIES).join(', ')}`);

      // Start nudge processor (every minute)
      setInterval(processNudgeQueue, 60 * 1000);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();
