/**
 * REZ Price Predictor Service - TypeScript Migration
 *
 * Service for dynamic pricing intelligence and optimization
 * for merchants across the REZ platform.
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import mongoose, { Schema, Model } from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

import {
  IPricePrediction,
  IMerchantPricing,
  PriceOptimization,
  PricePredictionResponse,
  SlotPriceResponse,
  SlotPriceItem,
  PricingRecommendation,
  PricingAnalytics,
  CompetitorPricingResponse,
  CompetitorPrice
} from './types.js';
import {
  recordPriceSchema,
  pricePredictionQuerySchema,
  slotPriceQuerySchema,
  validate
} from './schemas.js';

// ============================================
// LOGGING SETUP
// ============================================

const SERVICE_NAME = process.env['SERVICE_NAME'] || 'rez-price-predictor';
const NODE_ENV = process.env['NODE_ENV'] || 'development';

const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const prettyFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info: winston.Logform.TransformableInfo) => {
    const { timestamp, level, message, ...meta } = info;
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} ${level} [${process.env['SERVICE_NAME'] || 'rez-price-predictor'}]: ${message} ${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
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

const priceHistorySchema = new Schema<IPricePrediction>({
  merchantId: { type: String, required: true, index: true },
  itemId: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  price: { type: Number, required: true },
  demand: { type: Number, default: 0 },
  elasticity: { type: Number, default: -1 },
  factors: {
    dayOfWeek: Number,
    hour: Number,
    weather: Number,
    events: Number,
    competition: Number
  }
}, { timestamps: true });

priceHistorySchema.index({ merchantId: 1, itemId: 1, date: -1 });

const PricePrediction: Model<IPricePrediction> = mongoose.model<IPricePrediction>('PricePrediction', priceHistorySchema);

const merchantPricingSchema = new Schema<IMerchantPricing>({
  merchantId: { type: String, required: true, unique: true, index: true },
  name: String,

  strategy: {
    type: String,
    enum: ['fixed', 'dynamic', 'competitive', 'value'],
    default: 'dynamic'
  },

  baseMargin: { type: Number, default: 0.3 },
  minMargin: { type: Number, default: 0.15 },
  maxMargin: { type: Number, default: 0.5 },

  peakMultiplier: { type: Number, default: 1.15 },
  offPeakMultiplier: { type: Number, default: 0.9 },
  weekendMultiplier: { type: Number, default: 1.1 },

  pricePosition: {
    type: String,
    enum: ['budget', 'mid', 'premium'],
    default: 'mid'
  },
  maxDiscountPercent: { type: Number, default: 20 },

  competitorIds: [String],
  avgCompetitorPrice: { type: Number },

  avgOrderValue: { type: Number, default: 0 },
  conversionRate: { type: Number, default: 0.05 },

  lastUpdated: Date
}, { timestamps: true });

const MerchantPricing: Model<IMerchantPricing> = mongoose.model<IMerchantPricing>('MerchantPricing', merchantPricingSchema);

// ============================================
// BUSINESS LOGIC
// ============================================

interface HistoricalRecord {
  price: number;
  demand: number;
}

/**
 * Calculate price elasticity from historical data
 */
function calculateElasticity(historicalData: HistoricalRecord[]): number {
  if (historicalData.length < 5) return -1;

  let totalElasticity = 0;
  let count = 0;

  for (let i = 1; i < historicalData.length; i++) {
    const prev = historicalData[i - 1];
    const curr = historicalData[i];

    if (prev.price > 0 && curr.demand > 0) {
      const priceChange = (curr.price - prev.price) / prev.price;
      const demandChange = (curr.demand - prev.demand) / prev.demand;

      if (Math.abs(priceChange) > 0.01) {
        const elasticity = demandChange / priceChange;
        totalElasticity += elasticity;
        count++;
      }
    }
  }

  return count > 0 ? totalElasticity / count : -1;
}

interface OptimizePriceOptions {
  demandLevel?: number;
  timeMultiplier?: number;
  competitionMultiplier?: number;
  elasticity?: number;
  minMargin?: number;
  maxMargin?: number;
}

/**
 * Optimize price based on various factors
 */
function optimizePrice(basePrice: number, options: OptimizePriceOptions = {}): PriceOptimization {
  const {
    demandLevel = 1,
    timeMultiplier = 1,
    competitionMultiplier = 1,
    elasticity = -1,
    minMargin = 0.15,
    maxMargin = 0.5
  } = options;

  let optimizedPrice = basePrice;

  // Apply time-based pricing
  optimizedPrice *= timeMultiplier;

  // Apply demand-based pricing
  if (elasticity < 0) {
    // Elastic item: lower price for high demand
    const demandAdjustment = 1 - (demandLevel - 1) * Math.abs(elasticity) * 0.2;
    optimizedPrice *= demandAdjustment;
  } else {
    // Inelastic item: can charge more for high demand
    optimizedPrice *= (0.9 + demandLevel * 0.2);
  }

  // Apply competitive pressure
  if (competitionMultiplier < 1) {
    optimizedPrice *= (0.95 + competitionMultiplier * 0.05);
  }

  // Apply margin constraints
  const baseCost = basePrice / (1 + 0.3);
  const minPrice = baseCost * (1 + minMargin);
  const maxPrice = baseCost * (1 + maxMargin);

  optimizedPrice = Math.max(minPrice, Math.min(maxPrice, optimizedPrice));

  return {
    price: Math.round(optimizedPrice * 100) / 100,
    discount: Math.max(0, Math.round((1 - optimizedPrice / basePrice) * 100)),
    recommended: optimizedPrice < basePrice * 0.95,
    confidence: Math.abs(elasticity) > 0.5 ? 'high' : Math.abs(elasticity) > 0.2 ? 'medium' : 'low'
  };
}

/**
 * Generate pricing recommendations
 */
function generateRecommendations(
  merchantPricing: IMerchantPricing,
  avgPrice: number
): PricingRecommendation[] {
  const recs: PricingRecommendation[] = [];

  if (merchantPricing.conversionRate < 0.03) {
    recs.push({
      type: 'low_conversion',
      priority: 'high',
      message: 'Conversion rate is low. Consider testing 5-10% price reduction.',
      potential: 'Increase conversions by 10-20%'
    });
  }

  if (avgPrice < 100) {
    recs.push({
      type: 'low_aov',
      priority: 'medium',
      message: 'Average order value is low. Consider bundle pricing.',
      potential: 'Increase AOV by 15-25%'
    });
  }

  if (merchantPricing.strategy === 'fixed') {
    recs.push({
      type: 'dynamic_pricing',
      priority: 'low',
      message: 'Consider implementing dynamic pricing for peak hours.',
      potential: 'Increase revenue by 5-10%'
    });
  }

  return recs;
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
  if (token !== process.env['INTERNAL_SERVICE_TOKEN']) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'price-predictor',
    timestamp: new Date().toISOString()
  });
});

// Readiness check
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
});

// Get price prediction for item
app.get('/api/price/:merchantId/:itemId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId, itemId } = req.params;

  const validation = validate(pricePredictionQuerySchema, req.query);
  if (!validation.valid) {
    throw new ValidationError('Invalid query parameters', validation.errors);
  }

  const { basePrice, demandLevel, hour, dayOfWeek, includeAlternatives } = validation.data;

  const now = new Date();
  const queryHour = hour !== undefined ? hour : now.getHours();
  const queryDay = dayOfWeek !== undefined ? dayOfWeek : now.getDay();

  // Get merchant pricing config
  let merchantPricing = await MerchantPricing.findOne({ merchantId });
  if (!merchantPricing) {
    merchantPricing = await MerchantPricing.create({ merchantId });
  }

  // Calculate time multiplier
  let timeMultiplier = 1;

  if ((queryHour >= 12 && queryHour <= 14) || (queryHour >= 19 && queryHour <= 21)) {
    timeMultiplier *= merchantPricing.peakMultiplier;
  } else if (queryHour >= 15 && queryHour <= 17) {
    timeMultiplier *= merchantPricing.offPeakMultiplier;
  }

  if (queryDay === 0 || queryDay === 5 || queryDay === 6) {
    timeMultiplier *= merchantPricing.weekendMultiplier;
  }

  // Get historical elasticity
  const history = await PricePrediction.find({
    merchantId,
    itemId,
    date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  }).sort({ date: -1 }).limit(30).lean();

  const elasticity = calculateElasticity(history);

  // Calculate competitive multiplier
  let competitionMultiplier = 1;
  if (merchantPricing.avgCompetitorPrice && basePrice) {
    competitionMultiplier = parseFloat(basePrice.toString()) / merchantPricing.avgCompetitorPrice;
  }

  // Get optimization
  const base = basePrice || 200;
  const optimization = optimizePrice(base, {
    demandLevel,
    timeMultiplier,
    competitionMultiplier,
    elasticity,
    minMargin: merchantPricing.minMargin,
    maxMargin: merchantPricing.maxMargin
  });

  // Generate alternatives if requested
  let alternatives = null;
  if (includeAlternatives === 'true') {
    alternatives = {
      rushHour: optimizePrice(base, {
        ...optimization,
        timeMultiplier: merchantPricing.peakMultiplier
      }),
      offPeak: optimizePrice(base, {
        ...optimization,
        timeMultiplier: merchantPricing.offPeakMultiplier
      }),
      weekend: optimizePrice(base, {
        ...optimization,
        timeMultiplier: merchantPricing.weekendMultiplier
      })
    };
  }

  const response: PricePredictionResponse = {
    merchantId,
    itemId,
    currentPrice: base,
    recommendedPrice: optimization.price,
    discount: optimization.discount,
    confidence: optimization.confidence,
    factors: {
      timeMultiplier: Math.round(timeMultiplier * 100) / 100,
      elasticity: Math.round(elasticity * 100) / 100 || 'unknown',
      demandLevel
    },
    alternatives
  };

  res.json({
    success: true,
    ...response
  });
}));

// Get optimal price for time slot
app.get('/api/price/:merchantId/slot', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  const validation = validate(slotPriceQuerySchema, req.query);
  if (!validation.valid) {
    throw new ValidationError('Invalid query parameters', validation.errors);
  }

  const { items, hour, dayOfWeek } = validation.data;

  const queryHour = hour !== undefined ? hour : new Date().getHours();
  const queryDay = dayOfWeek !== undefined ? dayOfWeek : new Date().getDay();

  let merchantPricing = await MerchantPricing.findOne({ merchantId });
  if (!merchantPricing) {
    merchantPricing = await MerchantPricing.create({ merchantId });
  }

  const itemList = items ? JSON.parse(items) : [];

  let timeMultiplier = 1;
  if ((queryHour >= 12 && queryHour <= 14) || (queryHour >= 19 && queryHour <= 21)) {
    timeMultiplier *= merchantPricing.peakMultiplier;
  } else if (queryHour >= 15 && queryHour <= 17) {
    timeMultiplier *= merchantPricing.offPeakMultiplier;
  }
  if (queryDay === 0 || queryDay === 5 || queryDay === 6) {
    timeMultiplier *= merchantPricing.weekendMultiplier;
  }

  let totalOriginal = 0;
  let totalOptimized = 0;

  const itemPrices: SlotPriceItem[] = itemList.map((item: { itemId: string; name: string; price?: number }) => {
    const optimization = optimizePrice(item.price || 200, {
      timeMultiplier,
      minMargin: merchantPricing.minMargin,
      maxMargin: merchantPricing.maxMargin
    });

    const itemPrice = item.price || 200;
    totalOriginal += itemPrice;
    totalOptimized += optimization.price;

    return {
      itemId: item.itemId,
      name: item.name,
      originalPrice: itemPrice,
      optimizedPrice: optimization.price,
      discount: optimization.discount
    };
  });

  const response: SlotPriceResponse = {
    merchantId,
    slot: { hour: queryHour, dayOfWeek: queryDay },
    multiplier: Math.round(timeMultiplier * 100) / 100,
    items: itemPrices,
    totals: {
      original: Math.round(totalOriginal * 100) / 100,
      optimized: Math.round(totalOptimized * 100) / 100,
      savings: Math.round((totalOriginal - totalOptimized) * 100) / 100
    }
  };

  res.json({
    success: true,
    ...response
  });
}));

// Record price and demand
app.post('/api/price/:merchantId/:itemId/record', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId, itemId } = req.params;

  const validation = validate(recordPriceSchema, req.body);
  if (!validation.valid) {
    throw new ValidationError('Invalid request body', validation.errors);
  }

  const { price, demand, factors = {} } = validation.data;

  const record = await PricePrediction.create({
    merchantId,
    itemId,
    date: new Date(),
    price,
    demand: demand || 0,
    factors: {
      ...factors,
      dayOfWeek: factors.dayOfWeek ?? new Date().getDay(),
      hour: factors.hour ?? new Date().getHours()
    }
  });

  // Update merchant avg order value
  const recentRecords = await PricePrediction.find({
    merchantId,
    date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  }).lean();

  const avgOrderValue = recentRecords.reduce((sum, r) => sum + r.price, 0) / (recentRecords.length || 1);
  await MerchantPricing.findOneAndUpdate(
    { merchantId },
    { avgOrderValue, lastUpdated: new Date() }
  );

  res.json({ success: true, record });
}));

// Get pricing analytics
app.get('/api/analytics/:merchantId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  const merchantPricing = await MerchantPricing.findOne({ merchantId });

  if (!merchantPricing) {
    return res.json({ success: true, analytics: null });
  }

  const recentPrices = await PricePrediction.find({
    merchantId,
    date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  }).lean();

  // Calculate price distribution
  const prices = recentPrices.map(p => p.price);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / (prices.length || 1);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const analytics: PricingAnalytics = {
    strategy: merchantPricing.strategy,
    baseMargin: `${(merchantPricing.baseMargin * 100).toFixed(1)}%`,
    priceRange: { min: minPrice, max: maxPrice, avg: Math.round(avgPrice) },
    conversionRate: `${(merchantPricing.conversionRate * 100).toFixed(2)}%`,
    avgOrderValue: Math.round(merchantPricing.avgOrderValue),
    recommendations: generateRecommendations(merchantPricing, avgPrice)
  };

  res.json({
    success: true,
    merchantId,
    analytics
  });
}));

// Get competitive pricing
app.get('/api/competition/:merchantId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  const merchantPricing = await MerchantPricing.findOne({ merchantId });

  if (!merchantPricing || !merchantPricing.competitorIds?.length) {
    return res.json({
      success: true,
      competitors: [],
      message: 'No competitors tracked'
    });
  }

  const competitorPrices = await PricePrediction.aggregate([
    { $match: { merchantId: { $in: merchantPricing.competitorIds } } },
    { $sort: { date: -1 } },
    { $group: {
      _id: '$merchantId',
      avgPrice: { $avg: '$price' },
      latestPrice: { $first: '$price' },
      recordCount: { $sum: 1 }
    }}
  ]);

  const competitors: CompetitorPrice[] = competitorPrices.map(c => ({
    merchantId: c._id as string,
    avgPrice: c.avgPrice as number,
    latestPrice: c.latestPrice as number,
    recordCount: c.recordCount as number
  }));

  const response: CompetitorPricingResponse = {
    merchantId,
    competitors,
    avgCompetitorPrice: competitors.reduce((sum, c) => sum + c.avgPrice, 0) / (competitors.length || 1)
  };

  res.json({
    success: true,
    ...response
  });
}));

// Error handler middleware
app.use(errorHandler);

// ============================================
// SERVER STARTUP
// ============================================

const PORT = process.env.PORT || 4043;

async function start(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(`Price Predictor Service started on port ${PORT}`);
    });
  } catch (err) {
    const error = err as Error;
    logger.error('Startup failed', { error: error.message });
    process.exit(1);
  }
}

start();
