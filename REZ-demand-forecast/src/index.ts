/**
 * REZ Demand Forecast Service - TypeScript Migration
 *
 * Service for predicting merchant demand and providing
 * staffing/inventory recommendations.
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import mongoose, { Schema, Model } from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

import {
  IDemandForecast,
  IMerchantDemand,
  ForecastResult,
  DayForecastResult,
  StaffingRecommendation,
  InventoryRecommendation,
  DemandInsights
} from './types.js';
import {
  recordDemandSchema,
  forecastQuerySchema,
  itemForecastQuerySchema,
  validate
} from './schemas.js';

// ============================================
// LOGGING SETUP
// ============================================

const SERVICE_NAME = process.env['SERVICE_NAME'] || 'rez-demand-forecast';
const NODE_ENV = process.env['NODE_ENV'] || 'development';
const LOG_LEVEL = process.env['LOG_LEVEL'] || 'info';

const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const prettyFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} ${level} [${SERVICE_NAME}]: ${message} ${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: LOG_LEVEL,
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

const demandRecordSchema = new Schema<IDemandForecast>({
  merchantId: { type: String, required: true, index: true },
  itemId: { type: String, index: true },
  date: { type: Date, required: true, index: true },
  hour: { type: Number, min: 0, max: 23 },
  dayOfWeek: { type: Number, min: 0, max: 6 },
  predictedDemand: { type: Number, default: 0 },
  actualDemand: { type: Number, default: 0 },
  accuracy: { type: Number, min: 0, max: 1 },
  features: {
    historicalAvg: Number,
    dayOfWeekFactor: Number,
    timeFactor: Number,
    weatherFactor: Number,
    eventFactor: Number,
    trendFactor: Number
  }
}, { timestamps: true });

demandRecordSchema.index({ merchantId: 1, itemId: 1, date: 1 }, { unique: true });

const DemandForecast: Model<IDemandForecast> = mongoose.model<IDemandForecast>('DemandForecast', demandRecordSchema);

const merchantDemandSchema = new Schema<IMerchantDemand>({
  merchantId: { type: String, required: true, unique: true, index: true },
  name: String,

  peakHours: [{ type: Number }],
  busyDays: [{ type: Number }],

  avgDailyOrders: { type: Number, default: 0 },
  avgOrderValue: { type: Number, default: 0 },
  avgPrepTime: { type: Number, default: 30 },

  forecastAccuracy: { type: Number, default: 0.8 },

  todayForecast: {
    totalOrders: Number,
    peakHour: Number,
    estimatedRevenue: Number,
    confidence: Number
  },

  weeklyForecast: [{
    date: Date,
    predictedOrders: Number,
    predictedRevenue: Number,
    confidence: Number
  }],

  alerts: [{
    type: { type: String, enum: ['demand_spike', 'demand_drop', 'inventory_low', 'staffing'] },
    severity: { type: String, enum: ['info', 'warning', 'critical'] },
    message: String,
    recommendedAction: String,
    createdAt: { type: Date, default: Date.now },
    acknowledged: { type: Boolean, default: false }
  }],

  lastUpdated: Date
}, { timestamps: true });

const MerchantDemand: Model<IMerchantDemand> = mongoose.model<IMerchantDemand>('MerchantDemand', merchantDemandSchema);

// ============================================
// DEMAND FORECASTER CLASS
// ============================================

interface Weights {
  historicalAvg: number;
  dayOfWeek: number;
  time: number;
  weather: number;
  events: number;
  trend: number;
}

class DemandForecaster {
  private readonly WEIGHTS: Weights = {
    historicalAvg: 0.4,
    dayOfWeek: 0.2,
    time: 0.15,
    weather: 0.1,
    events: 0.1,
    trend: 0.05
  };

  /**
   * Get historical average for merchant/item
   */
  async getHistoricalAvg(merchantId: string, itemId?: string | null, dayOfWeek?: number | null): Promise<number> {
    const match: Record<string, unknown> = { merchantId };
    if (itemId) match.itemId = itemId;

    const records = await DemandForecast.find(match)
      .sort({ date: -1 })
      .limit(30)
      .lean();

    if (records.length === 0) return 0;

    let filtered = records;
    if (dayOfWeek !== null && dayOfWeek !== undefined) {
      filtered = records.filter(r => r.dayOfWeek === dayOfWeek);
    }

    return filtered.reduce((sum, r) => sum + (r.actualDemand || r.predictedDemand), 0) / filtered.length;
  }

  /**
   * Calculate day of week factor
   */
  getDayOfWeekFactor(dayOfWeek: number): number {
    // Weekend boost
    if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) return 1.3;
    // Monday dip
    if (dayOfWeek === 1) return 0.8;
    return 1.0;
  }

  /**
   * Calculate time factor
   */
  getTimeFactor(hour: number): number {
    // Lunch peak
    if (hour >= 12 && hour <= 14) return 1.5;
    // Dinner peak
    if (hour >= 19 && hour <= 21) return 1.4;
    // Late night
    if (hour >= 22 || hour <= 5) return 0.3;
    // Regular hours
    return 1.0;
  }

  /**
   * Get time-based pattern for merchant
   */
  getMerchantTimeFactor(_merchantId: string, hour: number): number {
    return this.getTimeFactor(hour);
  }

  /**
   * Simple trend calculation
   */
  async getTrendFactor(merchantId: string, days: number = 7): Promise<number> {
    const recent = await DemandForecast.find({
      merchantId,
      date: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
    }).lean();

    if (recent.length < 2) return 1.0;

    const halfPoint = Math.floor(recent.length / 2);
    const firstHalf = recent.slice(0, halfPoint);
    const secondHalf = recent.slice(halfPoint);

    const firstAvg = firstHalf.reduce((s, r) => s + r.actualDemand, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, r) => s + r.actualDemand, 0) / secondHalf.length;

    if (firstAvg === 0) return 1.0;
    return Math.min(1.5, Math.max(0.5, secondAvg / firstAvg));
  }

  /**
   * Main forecast function
   */
  async forecast(merchantId: string, itemId?: string | null, date?: Date, hour?: number | null): Promise<ForecastResult> {
    const forecastDate = date || new Date();
    const dayOfWeek = forecastDate.getDay();
    const forecastHour = hour !== null && hour !== undefined ? hour : forecastDate.getHours();

    // Get components
    const historicalAvg = await this.getHistoricalAvg(merchantId, itemId, dayOfWeek);
    const dayFactor = this.getDayOfWeekFactor(dayOfWeek);
    const timeFactor = this.getMerchantTimeFactor(merchantId, forecastHour);
    const trendFactor = await this.getTrendFactor(merchantId);

    // Calculate weighted prediction
    const predictedDemand = Math.round(
      historicalAvg * this.WEIGHTS.historicalAvg * dayFactor +
      historicalAvg * this.WEIGHTS.dayOfWeek * dayFactor +
      historicalAvg * this.WEIGHTS.time * timeFactor +
      historicalAvg * this.WEIGHTS.trend * trendFactor
    );

    // Calculate confidence based on data availability
    const dataPoints = await DemandForecast.countDocuments({ merchantId });
    const confidence = Math.min(0.95, 0.5 + (dataPoints / 100) * 0.4);

    return {
      predictedDemand: Math.max(0, predictedDemand),
      confidence,
      features: {
        historicalAvg: Math.round(historicalAvg * 100) / 100,
        dayOfWeekFactor: dayFactor,
        timeFactor,
        trendFactor,
        dayOfWeek,
        hour: forecastHour
      }
    };
  }

  /**
   * Forecast for entire day
   */
  async forecastDay(merchantId: string, date?: Date): Promise<DayForecastResult> {
    const forecastDate = date || new Date();
    const hourlyForecasts: Array<{
      hour: number;
      predictedDemand: number;
      confidence: number;
      features: ForecastResult['features'];
    }> = [];
    let totalDemand = 0;

    for (let hour = 6; hour <= 23; hour++) {
      const forecast = await this.forecast(merchantId, null, forecastDate, hour);
      hourlyForecasts.push({
        hour,
        ...forecast
      });
      totalDemand += forecast.predictedDemand;
    }

    // Find peak hour
    const peakHourData = hourlyForecasts.reduce((max, h) =>
      h.predictedDemand > max.predictedDemand ? h : max
    , hourlyForecasts[0]);

    return {
      date: forecastDate,
      totalDemand,
      peakHour: peakHourData.hour,
      peakDemand: peakHourData.predictedDemand,
      hourlyBreakdown: hourlyForecasts,
      confidence: peakHourData.confidence
    };
  }
}

const forecaster = new DemandForecaster();

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
    service: 'demand-forecast',
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

// Get forecast for merchant
app.get('/api/forecast/:merchantId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  const validation = validate(forecastQuerySchema, req.query);
  if (!validation.valid) {
    throw new ValidationError('Invalid query parameters', validation.errors);
  }

  const { date, days } = validation.data;
  const forecastDate = date ? new Date(date) : new Date();

  const forecast = await forecaster.forecastDay(merchantId, forecastDate);

  // Get weekly forecast if requested
  let weeklyForecast = null;
  if (days > 1) {
    weeklyForecast = [];
    for (let i = 0; i < days; i++) {
      const dayDate = new Date(forecastDate);
      dayDate.setDate(dayDate.getDate() + i);
      const dayForecast = await forecaster.forecastDay(merchantId, dayDate);
      weeklyForecast.push({
        date: dayDate.toISOString().split('T')[0],
        predictedOrders: dayForecast.totalDemand,
        predictedRevenue: dayForecast.totalDemand * 300,
        confidence: dayForecast.confidence
      });
    }
  }

  res.json({
    success: true,
    merchantId,
    forecast: {
      date: forecastDate.toISOString().split('T')[0],
      totalOrders: forecast.totalDemand,
      peakHour: forecast.peakHour,
      peakDemand: forecast.peakDemand,
      confidence: forecast.confidence,
      hourlyBreakdown: forecast.hourlyBreakdown
    },
    weekly: weeklyForecast
  });
}));

// Get forecast for specific item
app.get('/api/forecast/:merchantId/item/:itemId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId, itemId } = req.params;

  const validation = validate(itemForecastQuerySchema, req.query);
  if (!validation.valid) {
    throw new ValidationError('Invalid query parameters', validation.errors);
  }

  const { date } = validation.data;
  const forecastDate = date ? new Date(date) : new Date();
  const forecast = await forecaster.forecast(merchantId, itemId, forecastDate);

  res.json({
    success: true,
    merchantId,
    itemId,
    forecast: {
      date: forecastDate.toISOString().split('T')[0],
      predictedDemand: forecast.predictedDemand,
      confidence: forecast.confidence
    }
  });
}));

// Record actual demand
app.post('/api/forecast/:merchantId/record', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  const validation = validate(recordDemandSchema, req.body);
  if (!validation.valid) {
    throw new ValidationError('Invalid request body', validation.errors);
  }

  const { itemId, date, hour, actualDemand, predictedDemand } = validation.data;
  const recordDate = new Date(date);

  const record = await DemandForecast.findOneAndUpdate(
    { merchantId, itemId: itemId || null, date: recordDate },
    {
      $set: {
        actualDemand,
        dayOfWeek: recordDate.getDay(),
        hour: hour || recordDate.getHours(),
        accuracy: predictedDemand ? Math.max(0, 1 - Math.abs(actualDemand - predictedDemand) / Math.max(1, predictedDemand)) : null
      }
    },
    { upsert: true, new: true }
  );

  // Update merchant demand summary
  await updateMerchantDemand(merchantId);

  res.json({ success: true, record });
}));

// Get demand insights
app.get('/api/insights/:merchantId', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  const merchantDemand = await MerchantDemand.findOne({ merchantId });

  if (!merchantDemand) {
    return res.json({
      success: true,
      insights: { message: 'Insufficient data for insights' }
    });
  }

  const insights: DemandInsights = {
    merchantId,
    summary: {
      avgDailyOrders: merchantDemand.avgDailyOrders,
      avgOrderValue: merchantDemand.avgOrderValue,
      forecastAccuracy: `${(merchantDemand.forecastAccuracy * 100).toFixed(1)}%`
    },
    patterns: {
      peakHours: merchantDemand.peakHours || [],
      busyDays: merchantDemand.busyDays || []
    },
    alerts: merchantDemand.alerts.filter(a => !a.acknowledged)
  };

  res.json({ success: true, insights });
}));

// Get staffing recommendations
app.get('/api/recommendations/:merchantId/staffing', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  const todayForecast = await forecaster.forecastDay(merchantId);

  // Simple staffing model
  const ordersPerStaffPerHour = 5;

  const recommendations: StaffingRecommendation[] = todayForecast.hourlyBreakdown.map(h => {
    const recommendedStaff = Math.ceil(h.predictedDemand / ordersPerStaffPerHour);
    const status = recommendedStaff > 3 ? 'busy' :
                   recommendedStaff > 1 ? 'normal' : 'quiet';

    return {
      hour: h.hour,
      predictedOrders: h.predictedDemand,
      recommendedStaff,
      status
    };
  });

  res.json({
    success: true,
    merchantId,
    recommendations
  });
}));

// Get inventory recommendations
app.get('/api/recommendations/:merchantId/inventory', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  const todayForecast = await forecaster.forecastDay(merchantId);
  const totalOrders = todayForecast.totalDemand;

  // Simple inventory model
  const avgItemsPerOrder = 3;
  const bufferPercent = 0.2;

  const recommendedInventory = Math.ceil(totalOrders * avgItemsPerOrder * (1 + bufferPercent));

  const recommendations: InventoryRecommendation = {
    merchantId,
    date: new Date().toISOString().split('T')[0],
    estimatedOrders: totalOrders,
    estimatedItems: recommendedInventory,
    bufferStock: Math.ceil(recommendedInventory * bufferPercent),
    alerts: []
  };

  // Add alerts
  if (totalOrders > 50) {
    recommendations.alerts.push({
      type: 'demand_spike',
      severity: 'info',
      message: 'High demand expected. Consider increasing inventory by 30%.',
      recommendedAction: 'Increase inventory by 30%',
      createdAt: new Date(),
      acknowledged: false
    });
  }

  res.json({ success: true, recommendations });
}));

// Update merchant demand summary
async function updateMerchantDemand(merchantId: string): Promise<void> {
  const recentOrders = await DemandForecast.find({
    merchantId,
    date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  }).lean();

  if (recentOrders.length === 0) return;

  // Calculate metrics
  const dailyTotals: Record<string, number> = {};
  for (const order of recentOrders) {
    const dateKey = order.date.toISOString().split('T')[0];
    dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + order.actualDemand;
  }

  const avgDailyOrders = Object.values(dailyTotals).reduce((a, b) => a + b, 0) / Object.keys(dailyTotals).length;

  // Calculate peak hours
  const hourlyTotals: Record<number, number> = {};
  for (const order of recentOrders) {
    const hour = order.hour || 12;
    hourlyTotals[hour] = (hourlyTotals[hour] || 0) + order.actualDemand;
  }

  const peakHours = Object.entries(hourlyTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([h]) => parseInt(h));

  // Calculate busy days
  const dayTotals: Record<number, number> = {};
  for (const order of recentOrders) {
    const day = order.dayOfWeek || 0;
    dayTotals[day] = (dayTotals[day] || 0) + order.actualDemand;
  }

  const busyDays = Object.entries(dayTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([d]) => parseInt(d));

  await MerchantDemand.findOneAndUpdate(
    { merchantId },
    {
      $set: {
        avgDailyOrders: Math.round(avgDailyOrders * 10) / 10,
        peakHours,
        busyDays,
        lastUpdated: new Date()
      }
    },
    { upsert: true }
  );
}

// Error handler middleware
app.use(errorHandler);

// ============================================
// SERVER STARTUP
// ============================================

const PORT = process.env.PORT || 4042;

async function start(): Promise<void> {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(`Demand Forecast Service started on port ${PORT}`);
    });
  } catch (err) {
    const error = err as Error;
    logger.error('Startup failed', { error: error.message });
    process.exit(1);
  }
}

start();
