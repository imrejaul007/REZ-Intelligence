'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { createClient } = require('redis');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

const logger = {
  info: (msg, data) => console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', msg, ...data })),
  error: (msg, data) => console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', msg, ...data }))
};

const REQUIRED_ENV = ['MONGODB_URI', 'REDIS_URL', 'INTERNAL_SERVICE_TOKEN'];
for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    console.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// Recommendation types
const REC_TYPES = {
  REORDER: 'reorder',
  CROSS_SELL: 'cross_sell',
  UPSELL: 'upsell',
  PERSONALIZED: 'personalized',
  SIMILAR: 'similar',
  TRENDING: 'trending',
  NEARBY: 'nearby',
  COMPLEMENTARY: 'complementary',
  FORYOU: 'for_you',
  OFTEN_TOGETHER: 'often_together'
};

// App context mapping
const APP_CONTEXT = {
  'rez-app-consumer': { categories: ['restaurant', 'retail', 'grocery', 'pharmacy'] },
  'rez-app-merchant': { categories: ['merchant_analytics', 'inventory'] },
  'Hotel-OTA': { categories: ['hotel', 'stay', 'experience'] },
  'Rendez': { categories: ['social', 'event', 'dating'] },
  'do-app': { categories: ['do', 'activity', 'booking'] },
  'REZ-ads-service': { categories: ['ad_targeting'] }
};

// MongoDB Schemas
const recommendationSchema = new mongoose.Schema({
  recommendationId: { type: String, required: true, unique: true, index: true },

  // User
  userId: String,
  unifiedId: String,
  appId: String,

  // Type
  type: { type: String, enum: Object.values(REC_TYPES), required: true },

  // Items
  items: [{
    itemId: String,
    name: String,
    category: String,
    price: Number,
    merchantId: String,
    merchantName: String,
    image: String,
    score: Number, // Relevance score 0-1
    reason: String, // Why recommended
    metadata: mongoose.Schema.Types.Mixed
  }],

  // Context
  context: {
    trigger: String, // 'homepage', 'cart', 'checkout', 'search', 'nudge'
    location: { lat: Number, lng: Number },
    sessionId: String
  },

  // Display
  display: {
    title: String,
    subtitle: String,
    ctaText: String
  },

  // Performance tracking
  tracking: {
    shown: { type: Boolean, default: false },
    clicked: { type: Boolean, default: false },
    purchased: { type: Boolean, default: false },
    revenue: Number
  },

  // Source
  source: { type: String, enum: ['ai', 'rule', 'hybrid'], default: 'ai' },

  createdAt: { type: Date, default: Date.now },
  expiresAt: Date
});

recommendationSchema.index({ userId: 1, type: 1, createdAt: -1 });
recommendationSchema.index({ recommendationId: 1 });

const Recommendation = mongoose.model('Recommendation', recommendationSchema);

// Redis client
let redis;

async function initRedis() {
  try {
    redis = createClient({ url: process.env.REDIS_URL });
    redis.on('error', err => logger.error('Redis error', { error: err.message }));
    await redis.connect();
    logger.info('Redis connected');
  } catch (err) {
    logger.warn('Redis connection failed', { error: err.message });
  }
}

// Express app
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
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
  res.json({ status: 'ok', service: 'unified-recommendations', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ error: 'Not ready' });
  }
});

// ============================================
// UNIFIED RECOMMENDATIONS API
// ============================================

// Get recommendations for user
app.get('/api/recommendations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      types = 'reorder,cross_sell,personalized',
      limit = 10,
      context,
      appId
    } = req.query;

    const typeList = types.split(',');
    const recommendations = [];

    for (const type of typeList) {
      const recs = await getRecommendationsByType(userId, type.trim(), parseInt(limit), {
        context,
        appId
      });
      recommendations.push(...recs);
    }

    res.json({
      success: true,
      userId,
      recommendations,
      count: recommendations.length
    });
  } catch (err) {
    logger.error('Get recommendations failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Get single recommendation type
app.get('/api/recommendations/:userId/:type', async (req, res) => {
  try {
    const { userId, type } = req.params;
    const { limit = 10, context, appId } = req.query;

    const recommendations = await getRecommendationsByType(userId, type, parseInt(limit), {
      context,
      appId
    });

    res.json({
      success: true,
      userId,
      type,
      recommendations,
      count: recommendations.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GENERATE RECOMMENDATIONS (Internal)
// ============================================

async function getRecommendationsByType(userId, type, limit, options = {}) {
  // Try cache first
  const cacheKey = `rec:${userId}:${type}:${options.context || 'default'}`;

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  // Generate based on type
  let recommendations = [];

  switch (type) {
    case REC_TYPES.REORDER:
      recommendations = await generateReorderRecommendations(userId, limit, options);
      break;
    case REC_TYPES.CROSS_SELL:
      recommendations = await generateCrossSellRecommendations(userId, limit, options);
      break;
    case REC_TYPES.PERSONALIZED:
      recommendations = await generatePersonalizedRecommendations(userId, limit, options);
      break;
    case REC_TYPES.TRENDING:
      recommendations = await generateTrendingRecommendations(userId, limit, options);
      break;
    case REC_TYPES.NEARBY:
      recommendations = await generateNearbyRecommendations(userId, limit, options);
      break;
    case REC_TYPES.OFTEN_TOGETHER:
      recommendations = await generateOftenTogetherRecommendations(userId, limit, options);
      break;
    default:
      recommendations = await generateHybridRecommendations(userId, limit, options);
  }

  // Cache result
  if (redis) {
    await redis.setEx(cacheKey, 300, JSON.stringify(recommendations)); // 5 min cache
  }

  return recommendations;
}

// Reorder recommendations (from reorder engine)
async function generateReorderRecommendations(userId, limit, options) {
  // In production, call REZ-reorder-engine
  // For now, return mock data
  return [
    {
      recommendationId: `rec_${uuidv4()}`,
      type: REC_TYPES.REORDER,
      items: [
        {
          itemId: 'item_1',
          name: 'Your usual Biryani',
          category: 'restaurant',
          price: 250,
          score: 0.92,
          reason: 'You ordered this 5 times in the last month'
        }
      ].slice(0, limit),
      display: {
        title: 'Order Again',
        subtitle: 'Based on your order history'
      },
      source: 'ai'
    }
  ];
}

// Cross-sell recommendations
async function generateCrossSellRecommendations(userId, limit, options) {
  return [
    {
      recommendationId: `rec_${uuidv4()}`,
      type: REC_TYPES.CROSS_SELL,
      items: [
        {
          itemId: 'item_cs_1',
          name: 'Cold Drink',
          category: 'beverage',
          price: 60,
          score: 0.85,
          reason: 'Often ordered with your selections'
        },
        {
          itemId: 'item_cs_2',
          name: 'Dessert',
          category: 'sweet',
          price: 120,
          score: 0.78,
          reason: 'Popular with this meal'
        }
      ].slice(0, limit),
      display: {
        title: 'Complete Your Meal',
        subtitle: 'Complete your order with these'
      },
      source: 'ai'
    }
  ];
}

// Personalized recommendations
async function generatePersonalizedRecommendations(userId, limit, options) {
  const appContext = APP_CONTEXT[options.appId] || { categories: ['general'] };

  return [
    {
      recommendationId: `rec_${uuidv4()}`,
      type: REC_TYPES.PERSONALIZED,
      items: [
        {
          itemId: 'item_p_1',
          name: 'New Restaurant Near You',
          category: appContext.categories[0],
          price: 300,
          score: 0.88,
          reason: 'Matches your taste profile'
        }
      ].slice(0, limit),
      display: {
        title: 'Recommended For You',
        subtitle: 'Based on your preferences'
      },
      source: 'ai'
    }
  ];
}

// Trending recommendations
async function generateTrendingRecommendations(userId, limit, options) {
  return [
    {
      recommendationId: `rec_${uuidv4()}`,
      type: REC_TYPES.TRENDING,
      items: [
        {
          itemId: 'item_t_1',
          name: 'Trending: Viral Dish',
          category: 'restaurant',
          price: 199,
          score: 0.95,
          reason: 'Trending in your area'
        }
      ].slice(0, limit),
      display: {
        title: '🔥 Trending Now',
        subtitle: 'Hot in your area'
      },
      source: 'rule'
    }
  ];
}

// Nearby recommendations
async function generateNearbyRecommendations(userId, limit, options) {
  return [
    {
      recommendationId: `rec_${uuidv4()}`,
      type: REC_TYPES.NEARBY,
      items: [
        {
          itemId: 'item_n_1',
          name: 'Nearby Restaurant',
          category: 'restaurant',
          merchantName: 'Local Kitchen',
          price: 200,
          score: 0.82,
          reason: '0.5 km from your location'
        }
      ].slice(0, limit),
      display: {
        title: 'Nearby',
        subtitle: 'Great options close to you'
      },
      source: 'rule'
    }
  ];
}

// Often bought together
async function generateOftenTogetherRecommendations(userId, limit, options) {
  return [
    {
      recommendationId: `rec_${uuidv4()}`,
      type: REC_TYPES.OFTEN_TOGETHER,
      items: [
        {
          itemId: 'item_o_1',
          name: 'Combo: Pizza + Coke',
          category: 'combo',
          price: 349,
          score: 0.91,
          reason: 'Frequently ordered together'
        }
      ].slice(0, limit),
      display: {
        title: 'Complete the Combo',
        subtitle: 'Most popular combination'
      },
      source: 'rule'
    }
  ];
}

// Hybrid recommendations (mix of all)
async function generateHybridRecommendations(userId, limit, options) {
  const types = [REC_TYPES.REORDER, REC_TYPES.CROSS_SELL, REC_TYPES.PERSONALIZED];
  const results = [];

  for (const type of types.slice(0, 2)) {
    const recs = await getRecommendationsByType(userId, type, Math.ceil(limit / 2), options);
    if (recs[0]?.items) {
      results.push(...recs[0].items);
    }
  }

  return [{
    recommendationId: `rec_${uuidv4()}`,
    type: 'hybrid',
    items: results.slice(0, limit),
    display: {
      title: 'For You',
      subtitle: 'Curated recommendations'
    },
    source: 'hybrid'
  }];
}

// ============================================
// TRACKING & FEEDBACK
// ============================================

// Track impression
app.post('/api/recommendations/:recommendationId/show', async (req, res) => {
  try {
    const { recommendationId } = req.params;
    const { position } = req.body;

    await Recommendation.findOneAndUpdate(
      { recommendationId },
      { $set: { 'tracking.shown': true } }
    );

    // Send to feedback collector
    if (redis) {
      await redis.publish('recommendation:shown', JSON.stringify({
        recommendationId,
        position,
        timestamp: new Date().toISOString()
      }));
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Track click
app.post('/api/recommendations/:recommendationId/click', async (req, res) => {
  try {
    const { recommendationId } = req.params;
    const { itemId, position } = req.body;

    await Recommendation.findOneAndUpdate(
      { recommendationId },
      { $set: { 'tracking.clicked': true } }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Track purchase
app.post('/api/recommendations/:recommendationId/purchase', async (req, res) => {
  try {
    const { recommendationId } = req.params;
    const { itemId, revenue } = req.body;

    await Recommendation.findOneAndUpdate(
      { recommendationId },
      { $set: {
        'tracking.purchased': true,
        'tracking.revenue': revenue
      }}
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ANALYTICS
// ============================================

app.get('/api/analytics/performance', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const stats = await Recommendation.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: {
        _id: '$type',
        shown: { $sum: { $cond: ['$tracking.shown', 1, 0] } },
        clicked: { $sum: { $cond: ['$tracking.clicked', 1, 0] } },
        purchased: { $sum: { $cond: ['$tracking.purchased', 1, 0] } },
        revenue: { $sum: { $ifNull: ['$tracking.revenue', 0] } }
      }}
    ]);

    const results = stats.map(s => ({
      type: s._id,
      shown: s.shown,
      clicked: s.clicked,
      purchased: s.purchased,
      ctr: s.shown > 0 ? (s.clicked / s.shown * 100).toFixed(2) : 0,
      cvr: s.clicked > 0 ? (s.purchased / s.clicked * 100).toFixed(2) : 0,
      revenue: s.revenue
    }));

    res.json({
      success: true,
      period: `${days} days`,
      performance: results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4090;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    await initRedis();

    app.listen(PORT, () => {
      console.log(`Unified Recommendations running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();
