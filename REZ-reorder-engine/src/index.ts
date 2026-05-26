/**
 * REZ Reorder Engine - TypeScript Migration
 *
 * Service for predicting when users will reorder and triggering
 * timely nudge notifications to drive repeat purchases.
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import mongoose, { Schema, Model } from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

import {
  COMMERCE_CATEGORIES,
  UrgencyLevel,
  NUDGE_TYPES,
  OrderItem,
  OrderSummary,
  ProfileMetrics,
  NudgeInteractions,
  IReorderProfile,
  INudgeQueue,
  ReorderRecommendation,
  HomepageRecommendations,
  ReorderAnalytics
} from './types.js';
import {
  createProfileSchema,
  reorderQuerySchema,
  nudgeInteractionSchema,
  analyticsQuerySchema,
  validate
} from './schemas.js';

// ============================================
// LOGGING SETUP
// ============================================

const SERVICE_NAME = process.env.SERVICE_NAME || 'rez-reorder-engine';
const NODE_ENV = process.env.NODE_ENV || 'development';

const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const prettyFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }: { timestamp?: string; level: string; message: string; [key: string]: unknown }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} ${level} [${SERVICE_NAME}]: ${message} ${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: NODE_ENV === 'production' ? structuredFormat : prettyFormat,
  defaultMeta: { service: SERVICE_NAME },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    })
  ]
});

// ============================================
// ENVIRONMENT VALIDATION
// ============================================

const REQUIRED_ENV = ['MONGODB_URI', 'REDIS_URL', 'INTERNAL_SERVICE_TOKEN'] as const;

for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    logger.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// ============================================
// MONGOOSE SCHEMAS
// ============================================

// Preference schema for order items
const orderItemSchema = new Schema<OrderItem>({
  itemId: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  category: { type: String }
}, { _id: false });

// Order summary embedded schema
const orderSummarySchema = new Schema<OrderSummary>({
  items: [orderItemSchema],
  totalValue: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR' }
}, { _id: false });

// Profile metrics embedded schema
const profileMetricsSchema = new Schema<ProfileMetrics>({
  totalOrders: { type: Number, default: 1 },
  avgOrderValue: { type: Number },
  avgQuantity: { type: Number },
  lastInteraction: { type: String },
  favoriteItemId: { type: String },
  favoriteItemName: { type: String }
}, { _id: false });

// Nudge interactions embedded schema
const nudgeInteractionsSchema = new Schema<NudgeInteractions>({
  sent: { type: Number, default: 0 },
  clicked: { type: Number, default: 0 },
  converted: { type: Number, default: 0 }
}, { _id: false });

// Main reorder profile schema
const reorderProfileSchema = new Schema<IReorderProfile>({
  userId: { type: String, required: true, index: true },
  merchantId: { type: String, required: true, index: true },
  category: {
    type: String,
    enum: Object.values(COMMERCE_CATEGORIES),
    default: COMMERCE_CATEGORIES.RESTAURANT
  },
  lastOrderId: { type: String, required: true },
  lastOrderDate: { type: Date, required: true },
  orderFrequencyDays: { type: Number, default: 7 },
  predictedReorderDate: { type: Date },
  reorderScore: { type: Number, min: 0, max: 1 },
  urgency: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'low'
  },
  nudgeSent: { type: Boolean, default: false },
  nudgeSentAt: { type: Date },
  nudgeInteractions: { type: nudgeInteractionsSchema, default: () => ({}) },
  orderSummary: { type: orderSummarySchema, required: true },
  metrics: { type: profileMetricsSchema, default: () => ({}) }
}, { timestamps: true });

// Compound indexes
reorderProfileSchema.index({ userId: 1, merchantId: 1, category: 1 }, { unique: true });
reorderProfileSchema.index({ predictedReorderDate: 1, nudgeSent: 1, reorderScore: 1 });

const ReorderProfile: Model<IReorderProfile> = mongoose.model<IReorderProfile>('ReorderProfile', reorderProfileSchema);

// Nudge content embedded schema
const nudgeContentSchema = new Schema({
  title: String,
  body: String,
  imageUrl: String,
  actionText: String,
  items: [String]
}, { _id: false });

// Nudge queue schema
const nudgeQueueSchema = new Schema<INudgeQueue>({
  userId: { type: String, required: true, index: true },
  merchantId: { type: String, required: true },
  reorderProfileId: { type: String, required: true },
  category: { type: String, default: 'restaurant' },
  nudgeType: {
    type: String,
    enum: Object.values(NUDGE_TYPES),
    required: true
  },
  scheduledFor: { type: Date, required: true, index: true },
  content: { type: nudgeContentSchema },
  channels: [{
    type: String,
    enum: Object.values(NUDGE_CHANNELS)
  }],
  status: {
    type: String,
    enum: Object.values(NUDGE_STATUS),
    default: NUDGE_STATUS.PENDING
  },
  sentAt: Date,
  clickAt: Date,
  convertAt: Date,
  error: String
}, { timestamps: true });

nudgeQueueSchema.index({ status: 1, scheduledFor: 1 });

const NudgeQueue: Model<INudgeQueue> = mongoose.model<INudgeQueue>('NudgeQueue', nudgeQueueSchema);

// ============================================
// BUSINESS LOGIC
// ============================================

/**
 * Calculate the reorder score based on profile data
 */
function calculateReorderScore(profile: IReorderProfile): number {
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

  const interactions = profile.nudgeInteractions || { sent: 0, clicked: 0, converted: 0 };
  const conversionScore = interactions.converted > 0 ? 0.8 :
                        interactions.clicked > 0 ? 0.5 : 0.2;

  const finalScore = (
    timingScore * 0.35 +
    frequencyScore * 0.25 +
    recencyScore * 0.25 +
    conversionScore * 0.15
  );

  return Math.min(1, Math.max(0, finalScore));
}

/**
 * Determine urgency level from score
 */
function determineUrgency(score: number): UrgencyLevel {
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

/**
 * Generate personalized nudge content
 */
function generateNudgeContent(profile: IReorderProfile, merchantName: string): { title: string; body: string; actionText: string } {
  const daysSince = Math.floor(
    (Date.now() - profile.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const category = profile.category;
  const items = profile.orderSummary?.items || [];
  const topItem = items[0];

  const templates: Record<CommerceCategory, { title: string; body: string; actionText: string }> = {
    restaurant: {
      title: `${daysSince} days since ${topItem?.name || 'your last order'}?`,
      body: `Your favorite at ${merchantName} is waiting. Reorder now!`,
      actionText: 'Order Again'
    },
    hotel: {
      title: 'Ready for your next stay?',
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

/**
 * Get reorder title based on category
 */
function getReorderTitle(category: CommerceCategory): string {
  const titles: Record<CommerceCategory, string> = {
    restaurant: 'Order again?',
    hotel: 'Book your next stay?',
    retail: 'Time to restock?',
    booking: 'Book again?',
    services: 'Need service again?',
    fintech: 'Manage your account?'
  };
  return titles[category] || titles.restaurant;
}

/**
 * Format date as human-readable string
 */
function formatDate(date: Date | null): string {
  if (!date) return 'today';
  const days = Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

// ============================================
// ERROR HANDLING
// ============================================

class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

class ValidationError extends AppError {
  constructor(message: string, public details: unknown[] = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as Request & { requestId?: string }).requestId || 'unknown';

  if (err instanceof AppError) {
    logger.warn('Operational error', {
      requestId,
      code: err.code,
      statusCode: err.statusCode,
      path: req.path
    });

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err instanceof ValidationError && { details: err.details })
      },
      requestId
    });
    return;
  }

  logger.error('Unhandled error', {
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    },
    requestId
  });
}

function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ============================================
// EXPRESS APP
// ============================================

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  res.setHeader('x-request-id', req.requestId);
  logger.info(`${req.method} ${req.path}`, { requestId: req.requestId });
  next();
});

// Authentication middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const publicPaths = ['/health', '/ready'];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();

  const token = req.headers['x-internal-token'] as string;
  if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'reorder-engine',
    categories: Object.values(COMMERCE_CATEGORIES),
    timestamp: new Date().toISOString()
  });
});

// Readiness check
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready', mongodb: 'connected' });
  } catch (err) {
    const error = err as Error;
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// Create/update reorder profile
app.post('/api/reorder/profile', asyncHandler(async (req: Request, res: Response) => {
  const validation = validate(createProfileSchema, req.body);
  if (!validation.valid) {
    throw new ValidationError('Invalid request body', validation.errors);
  }

  const { userId, merchantId, orderId, items, orderValue, currency } = validation.data;
  const category = validation.data.category || COMMERCE_CATEGORIES.RESTAURANT;

  let profile = await ReorderProfile.findOne({ userId, merchantId, category });

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
      (profile.metrics.avgOrderValue! * prevOrders + (orderValue || 0)) / profile.metrics.totalOrders
    );

    const mappedItems: OrderItem[] = items?.map(i => ({
      itemId: i.itemId || i.productId || uuidv4(),
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      category: i.category
    })) || [];

    profile.orderSummary = {
      items: mappedItems,
      totalValue: orderValue || 0,
      currency: currency || 'INR'
    };

    // Update favorite item
    if (mappedItems.length > 0) {
      const maxQty = mappedItems.reduce((max, i) => i.quantity > max.quantity ? i : max, mappedItems[0]);
      profile.metrics.favoriteItemId = maxQty.itemId;
      profile.metrics.favoriteItemName = maxQty.name;
    }

    profile.nudgeSent = false;
    profile.reorderScore = calculateReorderScore(profile);
    profile.urgency = determineUrgency(profile.reorderScore);

    await profile.save();
  } else {
    // Create new profile
    const mappedItems: OrderItem[] = items?.map(i => ({
      itemId: i.itemId || i.productId || uuidv4(),
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      category: i.category
    })) || [];

    profile = await ReorderProfile.create({
      userId,
      merchantId,
      category,
      lastOrderId: orderId,
      lastOrderDate: new Date(),
      orderFrequencyDays: 7,
      predictedReorderDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      reorderScore: 0.5,
      urgency: 'medium',
      orderSummary: {
        items: mappedItems,
        totalValue: orderValue || 0,
        currency: currency || 'INR'
      },
      metrics: {
        totalOrders: 1,
        avgOrderValue: orderValue || 0,
        avgQuantity: items?.reduce((s, i) => s + i.quantity, 0) || 0,
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
    category,
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

// Get reorder recommendations for user
app.get('/api/reorder/user/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { category, threshold = '0.5', limit = '10' } = req.query;

  const query: Record<string, unknown> = {
    userId,
    reorderScore: { $gte: parseFloat(threshold as string) },
    nudgeSent: false
  };
  if (category) query.category = category;

  const profiles = await ReorderProfile.find(query)
    .sort({ reorderScore: -1, predictedReorderDate: 1 })
    .limit(parseInt(limit as string))
    .lean();

  const recommendations: ReorderRecommendation[] = profiles.map(profile => ({
    merchantId: profile.merchantId,
    category: profile.category,
    reorderScore: profile.reorderScore!,
    urgency: profile.urgency,
    predictedReorderDate: profile.predictedReorderDate!,
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

// Get homepage recommendations
app.get('/api/reorder/homepage/:userId', asyncHandler(async (req: Request, res: Response) => {
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

  // Get high-intent recommendations
  const imminent = await ReorderProfile.find({
    userId,
    urgency: 'high',
    predictedReorderDate: { $lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }
  })
  .sort({ predictedReorderDate: 1 })
  .limit(3)
  .lean();

  const response: HomepageRecommendations = {
    personalized: personalized.map(p => ({
      type: 'reorder',
      category: p.category,
      merchantId: p.merchantId,
      title: getReorderTitle(p.category),
      subtitle: p.metrics?.favoriteItemName || p.orderSummary?.items?.[0]?.name,
      score: p.reorderScore!,
      urgency: p.urgency,
      items: p.orderSummary?.items?.slice(0, 3) || []
    })),
    imminent: imminent.map(p => ({
      type: 'imminent_reorder',
      category: p.category,
      merchantId: p.merchantId,
      title: 'Reorder soon!',
      subtitle: `Due ${formatDate(p.predictedReorderDate!)}`,
      score: p.reorderScore!,
      urgency: 'high'
    }))
  };

  res.json({
    success: true,
    userId,
    ...response
  });
}));

// Track nudge click
app.post('/api/reorder/nudge/:nudgeId/click', asyncHandler(async (req: Request, res: Response) => {
  const { nudgeId } = req.params;

  const nudge = await NudgeQueue.findByIdAndUpdate(
    nudgeId,
    { status: 'clicked', clickAt: new Date() },
    { new: true }
  );

  if (!nudge) {
    throw new NotFoundError('Nudge not found');
  }

  await ReorderProfile.findByIdAndUpdate(nudge.reorderProfileId, {
    'nudgeInteractions.clicked': true
  });

  res.json({ success: true, nudge });
}));

// Track nudge conversion
app.post('/api/reorder/nudge/:nudgeId/convert', asyncHandler(async (req: Request, res: Response) => {
  const { nudgeId } = req.params;
  const { orderId } = req.body;

  const nudge = await NudgeQueue.findByIdAndUpdate(
    nudgeId,
    { status: 'converted', convertAt: new Date() },
    { new: true }
  );

  if (!nudge) {
    throw new NotFoundError('Nudge not found');
  }

  await ReorderProfile.findByIdAndUpdate(nudge.reorderProfileId, {
    'nudgeInteractions.converted': true,
    lastOrderDate: new Date(),
    nudgeSent: false
  });

  logger.info('Reorder converted', { requestId: req.requestId, nudgeId, orderId });

  res.json({ success: true, nudge });
}));

// Get analytics
app.get('/api/reorder/analytics', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId, category, startDate, endDate } = req.query;

  const match: Record<string, unknown> = {};
  if (merchantId) match.merchantId = merchantId;
  if (category) match.category = category;
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) (match.createdAt as Record<string, Date>).$gte = new Date(startDate as string);
    if (endDate) (match.createdAt as Record<string, Date>).$lte = new Date(endDate as string);
  }

  const [profiles, nudges, conversions] = await Promise.all([
    ReorderProfile.countDocuments(match),
    NudgeQueue.countDocuments({ ...match, nudgeType: 'reorder_reminder' }),
    NudgeQueue.countDocuments({ ...match, status: 'converted' })
  ]);

  const conversionRate = nudges > 0 ? (conversions / nudges * 100).toFixed(2) : '0';

  const categoryBreakdown = await ReorderProfile.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 }, avgScore: { $avg: '$reorderScore' } } }
  ]);

  const analytics: ReorderAnalytics = {
    totalProfiles: profiles,
    nudgesSent: nudges,
    conversions,
    conversionRate: parseFloat(conversionRate),
    byCategory: categoryBreakdown as Array<{ _id: CommerceCategory; count: number; avgScore: number }>
  };

  res.json({
    success: true,
    analytics
  });
}));

// Cron job: Process nudge queue
async function processNudgeQueue(): Promise<void> {
  try {
    const now = new Date();

    const pendingNudges = await NudgeQueue.find({
      status: 'pending',
      scheduledFor: { $lte: now }
    }).limit(100).lean();

    for (const nudge of pendingNudges) {
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
    const error = err as Error;
    logger.error('Nudge queue processing failed', { error: error.message });
  }
}

// Error handler middleware
app.use(errorHandler);

// ============================================
// SERVER STARTUP
// ============================================

const PORT = parseInt(process.env.PORT || '4156', 10);

async function start(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    logger.info('Connected to MongoDB');

    app.listen(PORT, () => {
      logger.info(`Reorder Engine started on port ${PORT}`);
      logger.info(`Categories: ${Object.values(COMMERCE_CATEGORIES).join(', ')}`);

      // Start nudge processor (every minute)
      setInterval(processNudgeQueue, 60 * 1000);
    });
  } catch (err) {
    const error = err as Error;
    logger.error('Startup failed', { error: error.message });
    process.exit(1);
  }
}

start();
