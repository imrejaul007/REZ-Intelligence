/**
 * REZ Taste Profile Service - TypeScript Migration
 *
 * Service for tracking consumer taste and preference intelligence
 * across multiple commerce categories.
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
  PreferenceScore,
  Interaction,
  SourceLink,
  AllPreferences,
  ITasteProfile,
  ProfileResponse,
  PersonalizationContext,
  AggregateResponse
} from './types.js';
import {
  interactionSchema,
  orderBatchSchema,
  linkProfileSchema,
  aggregateQuerySchema,
  validate
} from './schemas.js';

// ============================================
// LOGGING SETUP
// ============================================

const SERVICE_NAME = process.env.SERVICE_NAME || 'rez-taste-profile';
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

const preferenceSchema = new Schema<PreferenceScore>({
  key: { type: String, required: true },
  score: { type: Number, min: 0, max: 1, default: 0.5 },
  count: { type: Number, default: 1 },
  lastInteraction: { type: Date }
}, { _id: false });

const interactionSchemaMongoose = new Schema<Interaction>({
  merchantId: String,
  itemId: String,
  itemName: String,
  category: String,
  subcategory: String,
  value: Number,
  quantity: Number,
  rating: Number,
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const sourceLinkSchema = new Schema<SourceLink>({
  source: { type: String },
  userId: String,
  linkedAt: { type: Date, default: Date.now }
}, { _id: false });

const tasteProfileSchema = new Schema<ITasteProfile>({
  userId: { type: String, required: true, unique: true, index: true },

  preferences: {
    categories: [preferenceSchema],
    subcategories: [preferenceSchema],
    brands: [preferenceSchema],
    priceTiers: [preferenceSchema],
    features: [preferenceSchema],
    amenities: [preferenceSchema],
    diets: [preferenceSchema],
    occasions: [preferenceSchema]
  },

  behaviors: {
    adventurousness: { type: Number, default: 0.5 },
    brandLoyalty: { type: Number, default: 0.5 },
    valueConsciousness: { type: Number, default: 0.5 },
    qualityOverPrice: { type: Number, default: 0.5 },
    spontaneity: { type: Number, default: 0.5 },
    socialInfluence: { type: Number, default: 0.5 }
  },

  timePatterns: [{
    hour: { type: Number, min: 0, max: 23 },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    score: { type: Number, min: 0, max: 1, default: 0.5 },
    count: { type: Number, default: 0 }
  }],

  locations: [{
    type: { type: String, enum: ['home', 'work', 'travel', 'other'] },
    latitude: Number,
    longitude: Number,
    radius: Number,
    score: { type: Number, min: 0, max: 1, default: 0.5 }
  }],

  recentInteractions: [interactionSchemaMongoose],

  topPreferences: {
    categories: [String],
    priceTier: String,
    topOccasions: [String],
    signatureItems: [String]
  },

  stats: {
    totalTransactions: { type: Number, default: 0 },
    totalSpend: { type: Number, default: 0 },
    avgOrderValue: { type: Number, default: 0 },
    favoriteMerchantId: String,
    lastActive: Date,
    accountAge: Number
  },

  sources: [sourceLinkSchema]
}, { timestamps: true });

const TasteProfile: Model<ITasteProfile> = mongoose.model<ITasteProfile>('TasteProfile', tasteProfileSchema);

// ============================================
// BUSINESS LOGIC
// ============================================

/**
 * Update preference helper
 */
function updatePreference(
  profile: ITasteProfile,
  category: keyof AllPreferences,
  key: string,
  increment: number = 1
): PreferenceScore[] {
  const prefs = profile.preferences[category] || [];
  const existing = prefs.find(p => p.key === key);

  if (existing) {
    existing.score = Math.min(1, existing.score + 0.05 * increment);
    existing.count += increment;
    existing.lastInteraction = new Date();
  } else {
    prefs.push({
      key,
      score: 0.3 + 0.1 * increment,
      count: increment,
      lastInteraction: new Date()
    });
  }

  // Keep only top 20
  prefs.sort((a, b) => b.score - a.score);
  profile.preferences[category] = prefs.slice(0, 20) as PreferenceScore[];

  return profile.preferences[category] as PreferenceScore[];
}

/**
 * Calculate behavior scores
 */
function calculateBehaviors(profile: ITasteProfile): void {
  const totalTx = profile.stats.totalTransactions;
  if (totalTx < 3) return;

  const recentInteractions = profile.recentInteractions || [];

  // Adventurousness: high variety in categories
  const uniqueCategories = new Set(recentInteractions.map(i => i.category)).size;
  profile.behaviors.adventurousness = Math.min(1, uniqueCategories / 10);

  // Brand loyalty: repeats same items/merchants
  const repeats = recentInteractions.filter(i =>
    recentInteractions.filter(r => r.itemId === i.itemId).length > 1
  ).length;
  profile.behaviors.brandLoyalty = totalTx > 0 ? repeats / totalTx : 0.5;

  // Value consciousness: budget tier preference
  const budgetPref = profile.preferences.priceTiers?.find(p => p.key === 'budget');
  profile.behaviors.valueConsciousness = budgetPref?.score || 0.5;

  // Quality over price: premium tier + high ratings
  const premiumPref = profile.preferences.priceTiers?.find(p => p.key === 'premium');
  const avgRating = recentInteractions.reduce((s, i) => s + (i.rating || 0), 0) / (recentInteractions.length || 1);
  profile.behaviors.qualityOverPrice = ((premiumPref?.score || 0) * 0.6 + avgRating / 5 * 0.4);
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
    service: 'taste-profile',
    categories: Object.values(COMMERCE_CATEGORIES),
    timestamp: new Date().toISOString()
  });
});

// Readiness check
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready' });
  }
});

// Update taste profile from single interaction
app.post('/api/taste/interaction', asyncHandler(async (req: Request, res: Response) => {
  const validation = validate(interactionSchema, req.body);
  if (!validation.valid) {
    throw new ValidationError('Invalid request body', validation.errors);
  }

  const { userId, merchantId, itemId, itemName, category, subcategory, value, quantity, rating, timestamp } = validation.data;

  let profile = await TasteProfile.findOne({ userId });

  if (!profile) {
    profile = new TasteProfile({
      userId,
      preferences: {
        categories: [],
        subcategories: [],
        brands: [],
        priceTiers: [],
        features: [],
        amenities: [],
        diets: [],
        occasions: []
      },
      recentInteractions: [],
      stats: { totalTransactions: 0, totalSpend: 0, avgOrderValue: 0 }
    });
  }

  // Update preferences
  updatePreference(profile, 'categories', category);
  if (subcategory) updatePreference(profile, 'subcategories', subcategory);
  if (value > 0) {
    const priceTier = value > 1000 ? 'luxury' : value > 500 ? 'premium' : value > 200 ? 'moderate' : 'budget';
    updatePreference(profile, 'priceTiers', priceTier);
  }

  // Add interaction
  profile.recentInteractions.unshift({
    merchantId,
    itemId,
    itemName,
    category,
    subcategory,
    value,
    quantity,
    rating,
    timestamp: timestamp ? new Date(timestamp) : new Date()
  });

  // Keep only last 100
  profile.recentInteractions = profile.recentInteractions.slice(0, 100);

  // Update stats
  profile.stats.totalTransactions += 1;
  profile.stats.totalSpend += value || 0;
  profile.stats.avgOrderValue = profile.stats.totalSpend / profile.stats.totalTransactions;
  profile.stats.lastActive = new Date();
  profile.stats.favoriteMerchantId = merchantId;

  // Recalculate behaviors
  calculateBehaviors(profile);

  // Update top preferences
  const signatureItems = profile.recentInteractions
    .filter(i => profile.recentInteractions.filter(r => r.itemId === i.itemId).length > 1)
    .slice(0, 5)
    .map(i => i.itemName);

  profile.topPreferences = {
    categories: profile.preferences.categories?.slice(0, 5).map(p => p.key) || [],
    priceTier: profile.preferences.priceTiers?.sort((a, b) => b.score - a.score)[0]?.key || 'moderate',
    topOccasions: profile.preferences.occasions?.slice(0, 3).map(p => p.key) || [],
    signatureItems: signatureItems.filter(Boolean) as string[]
  };

  await profile.save();

  logger.info('Taste profile updated', {
    requestId: req.requestId,
    userId,
    category,
    subcategory
  });

  res.json({
    success: true,
    profile: {
      userId: profile.userId,
      topCategories: profile.topPreferences.categories,
      priceTier: profile.topPreferences.priceTier,
      behaviors: profile.behaviors
    }
  });
}));

// Batch update from order
app.post('/api/taste/order', asyncHandler(async (req: Request, res: Response) => {
  const validation = validate(orderBatchSchema, req.body);
  if (!validation.valid) {
    throw new ValidationError('Invalid request body', validation.errors);
  }

  const { userId, merchantId, category, items, orderValue, rating, timestamp } = validation.data;

  let profile = await TasteProfile.findOne({ userId });

  if (!profile) {
    profile = new TasteProfile({
      userId,
      preferences: { categories: [], subcategories: [], priceTiers: [] },
      recentInteractions: [],
      stats: { totalTransactions: 0, totalSpend: 0, avgOrderValue: 0 }
    });
  }

  // Process each item
  for (const item of items || []) {
    updatePreference(profile, 'categories', category);
    if (item.category) updatePreference(profile, 'categories', item.category);
    if (item.subcategory) updatePreference(profile, 'subcategories', item.subcategory);
    if (item.brand) updatePreference(profile, 'brands', item.brand);
    if (item.features) {
      for (const feature of item.features) {
        updatePreference(profile, 'features', feature);
      }
    }
    if (item.diet) updatePreference(profile, 'diets', item.diet);

    // Price tier
    const price = item.price || (orderValue || 0) / ((items?.length) || 1);
    const priceTier = price > 1000 ? 'luxury' : price > 500 ? 'premium' : price > 200 ? 'moderate' : 'budget';
    updatePreference(profile, 'priceTiers', priceTier);

    profile.recentInteractions.unshift({
      merchantId,
      itemId: item.itemId,
      itemName: item.name,
      category: item.category || category,
      subcategory: item.subcategory,
      value: item.price,
      quantity: 1,
      rating,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });
  }

  profile.recentInteractions = profile.recentInteractions.slice(0, 100);

  profile.stats.totalTransactions += 1;
  profile.stats.totalSpend += orderValue || 0;
  profile.stats.avgOrderValue = profile.stats.totalSpend / profile.stats.totalTransactions;
  profile.stats.lastActive = new Date();

  calculateBehaviors(profile);

  profile.topPreferences = {
    categories: profile.preferences.categories?.slice(0, 5).map(p => p.key) || [],
    priceTier: profile.preferences.priceTiers?.sort((a, b) => b.score - a.score)[0]?.key || 'moderate',
    topOccasions: [],
    signatureItems: []
  };

  await profile.save();

  res.json({
    success: true,
    profile: {
      userId,
      topCategories: profile.topPreferences.categories
    }
  });
}));

// Get user taste profile
app.get('/api/taste/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  const profile = await TasteProfile.findOne({ userId });

  if (!profile) {
    return res.json({ success: true, profile: null, isNewUser: true });
  }

  const response: ProfileResponse = {
    userId: profile.userId,
    topCategories: profile.topPreferences?.categories || [],
    priceTier: profile.topPreferences?.priceTier || 'moderate',
    behaviors: profile.behaviors,
    signatureItems: profile.topPreferences?.signatureItems || [],
    stats: {
      totalTransactions: profile.stats.totalTransactions,
      avgOrderValue: Math.round(profile.stats.avgOrderValue),
      totalSpend: Math.round(profile.stats.totalSpend)
    },
    sources: profile.sources
  };

  res.json({
    success: true,
    isNewUser: false,
    profile: response
  });
}));

// Get personalization context
app.get('/api/taste/:userId/context', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  const profile = await TasteProfile.findOne({ userId });

  if (!profile) {
    return res.json({
      success: true,
      context: {
        isNewUser: true,
        preferences: {},
        behaviors: {}
      } as PersonalizationContext
    });
  }

  const context: PersonalizationContext = {
    isNewUser: false,
    preferences: {
      categories: profile.topPreferences?.categories || [],
      priceTier: profile.topPreferences?.priceTier,
      diets: profile.preferences.diets?.filter(d => d.score > 0.6).map(d => d.key) || [],
      features: profile.preferences.features?.filter(f => f.score > 0.6).map(f => f.key) || []
    },
    behaviors: profile.behaviors,
    stats: {
      avgOrderValue: profile.stats.avgOrderValue,
      totalTransactions: profile.stats.totalTransactions
    }
  };

  res.json({ success: true, context });
}));

// Link taste profiles (for identity graph)
app.post('/api/taste/:userId/link', asyncHandler(async (req: Request, res: Response) => {
  const validation = validate(linkProfileSchema, req.body);
  if (!validation.valid) {
    throw new ValidationError('Invalid request body', validation.errors);
  }

  const { userId } = req.params;
  const { source, sourceUserId } = validation.data;

  const profile = await TasteProfile.findOneAndUpdate(
    { userId },
    {
      $push: {
        sources: { source, userId: sourceUserId, linkedAt: new Date() }
      }
    },
    { new: true }
  );

  if (!profile) {
    throw new NotFoundError('Profile not found');
  }

  res.json({ success: true, sources: profile.sources });
}));

// Get aggregate preferences
app.get('/api/taste/aggregate', asyncHandler(async (req: Request, res: Response) => {
  const validation = validate(aggregateQuerySchema, req.query);
  if (!validation.valid) {
    throw new ValidationError('Invalid query parameters', validation.errors);
  }

  const { category, minTransactions } = validation.data;

  const match: Record<string, unknown> = { 'stats.totalTransactions': { $gte: minTransactions } };
  if (category) match['preferences.categories.key'] = category;

  const profiles = await TasteProfile.find(match).limit(1000).lean();

  if (profiles.length === 0) {
    return res.json({ success: true, aggregate: null });
  }

  // Aggregate preferences
  const categoryScores: Record<string, number> = {};
  const priceTierScores: Record<string, number> = {};
  const behaviorAvgs = { adventurousness: 0, brandLoyalty: 0, valueConsciousness: 0 };

  for (const p of profiles) {
    for (const c of p.preferences.categories || []) {
      categoryScores[c.key] = (categoryScores[c.key] || 0) + c.score;
    }
    for (const pt of p.preferences.priceTiers || []) {
      priceTierScores[pt.key] = (priceTierScores[pt.key] || 0) + pt.score;
    }
    behaviorAvgs.adventurousness += p.behaviors.adventurousness;
    behaviorAvgs.brandLoyalty += p.behaviors.brandLoyalty;
    behaviorAvgs.valueConsciousness += p.behaviors.valueConsciousness;
  }

  const n = profiles.length;

  const aggregate: AggregateResponse = {
    sampleSize: n,
    topCategories: Object.entries(categoryScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([key, score]) => ({ category: key, avgScore: score / n })),
    priceTierDistribution: Object.fromEntries(
      Object.entries(priceTierScores).map(([k, v]) => [k, v / n])
    ),
    avgBehaviors: {
      adventurousness: behaviorAvgs.adventurousness / n,
      brandLoyalty: behaviorAvgs.brandLoyalty / n,
      valueConsciousness: behaviorAvgs.valueConsciousness / n
    }
  };

  res.json({ success: true, aggregate });
}));

// Error handler middleware
app.use(errorHandler);

// ============================================
// SERVER STARTUP
// ============================================

const PORT = parseInt(process.env.PORT || '4157', 10);

async function start(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(`Taste Profile Service started on port ${PORT}`);
    });
  } catch (err) {
    const error = err as Error;
    logger.error('Startup failed', { error: error.message });
    process.exit(1);
  }
}

start();
