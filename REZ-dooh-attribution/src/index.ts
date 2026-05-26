/**
 * REZ DOOH Attribution - Production Ready
 * Track DOOH impressions to conversions with real data
 * INPUT VALIDATION: All request bodies validated with Zod schemas
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import axios from 'axios';
import { randomUUID } from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { logger } from './utils/logger.js';

// ============================================
// ZOD VALIDATION SCHEMAS (Zod v3 API)
// ============================================

/**
 * ISO 8601 datetime string validator
 */
const isoDateTimeString = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'timestamp must be a valid ISO 8601 datetime string' }
);

/**
 * UUID string validator
 */
const uuidString = z.string().refine(
  (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val),
  { message: 'touchpointId must be a valid UUID' }
);

/**
 * Location schema for geo-based touchpoints
 */
const LocationSchema = z.object({
  lat: z.number().min(-90, 'Latitude must be at least -90').max(90, 'Latitude must be at most 90'),
  lng: z.number().min(-180, 'Longitude must be at least -180').max(180, 'Longitude must be at most 180'),
  city: z.string().optional(),
  area: z.string().optional()
});

/**
 * Touchpoint event types
 */
const TouchpointEventSchema = z.enum(['impression', 'view_through', 'click', 'engagement']);

/**
 * Create touchpoint request body
 */
export const CreateTouchpointSchema = z.object({
  touchpointId: uuidString.optional(),
  screenId: z.string().min(1, 'screenId is required and cannot be empty'),
  screenType: z.string().min(1, 'screenType is required and cannot be empty'),
  userId: z.string().optional(),
  deviceId: z.string().optional(),
  event: TouchpointEventSchema,
  timestamp: isoDateTimeString.optional(),
  location: LocationSchema.optional(),
  campaignId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * Aggregate metrics request body
 */
export const AggregateMetricsSchema = z.object({
  screenIds: z.array(z.string().min(1)).max(100, 'Maximum 100 screenIds allowed').optional(),
  period: z.number().int().min(1, 'period must be at least 1').max(365, 'period must be at most 365').optional().default(7),
  groupBy: z.enum(['screenType', 'screenId']).optional().default('screenType')
});

// ============================================
// TYPE EXPORTS FROM ZOD SCHEMAS
// ============================================

export type CreateTouchpointInput = z.infer<typeof CreateTouchpointSchema>;
export type AggregateMetricsInput = z.infer<typeof AggregateMetricsSchema>;
export type LocationInput = z.infer<typeof LocationSchema>;

// ============================================
// VALIDATION HELPER
// ============================================

/**
 * Safely parse and validate request body against a Zod schema
 */
function validateBody<T>(schema: z.ZodType<T>, body: unknown, context: string): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const errorMessages = result.error.issues
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    logger.warn(`[DOOH Attribution] ${context} validation failed: ${errorMessages}`);
    throw new ValidationError(`[DOOH Attribution] ${context} validation failed: ${errorMessages}`);
  }
  return result.data;
}

/**
 * Custom error class for validation failures
 */
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Environment
const PORT = parseInt(process.env.PORT || '4081', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-dooh';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// External service URLs
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'http://localhost:4025';
const ANALYTICS_URL = process.env.ANALYTICS_URL || 'http://localhost:4016';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:4006';

// PRODUCTION: MongoDB Schemas
const TouchpointSchema = new mongoose.Schema({
  touchpointId: { type: String, required: true, unique: true, index: true },
  screenId: { type: String, required: true, index: true },
  screenType: { type: String, required: true, index: true },
  userId: { type: String, index: true },
  deviceId: { type: String, index: true },
  event: { type: String, enum: ['impression', 'view_through', 'click', 'engagement'], required: true },
  timestamp: { type: Date, required: true, index: true },
  location: {
    lat: Number,
    lng: Number,
    city: String,
    area: String
  },
  campaignId: { type: String, index: true },
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const ConversionSchema = new mongoose.Schema({
  conversionId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  deviceId: { type: String, index: true },
  event: { type: String, required: true },
  value: Number,
  orderId: String,
  timestamp: { type: Date, required: true, index: true },
  touchpoints: [{
    touchpointId: String,
    screenId: String,
    timestamp: Date
  }],
  attributedTouchpoints: [{
    touchpointId: String,
    screenId: String,
    screenType: String,
    weight: Number
  }]
}, { timestamps: true });

const Touchpoint = mongoose.models.Touchpoint || mongoose.model('Touchpoint', TouchpointSchema);
const Conversion = mongoose.models.Conversion || mongoose.model('Conversion', ConversionSchema);

// ============================================
// RATE LIMITING
// ============================================

// General API rate limiter - 100 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Express setup
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Apply general API rate limiter to all /api routes
app.use('/api/', apiLimiter);

// Database connection
let dbConnected = false;
async function connectDB(): Promise<void> {
  if (dbConnected) return;
  try {
    await mongoose.connect(MONGODB_URI);
    dbConnected = true;
    logger.info('[DOOH Attribution] Connected to MongoDB');
  } catch (error) {
    logger.error('[DOOH Attribution] MongoDB connection failed:', error);
    throw error;
  }
}

// Strict rate limiter for expensive operations - 30 requests per 15 minutes
const metricsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  message: { success: false, error: 'Rate limit exceeded for metrics. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Touchpoint ingestion rate limiter - 1000 requests per 15 minutes (higher for DOOH data)
const touchpointLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Higher limit for DOOH impression data
  message: { success: false, error: 'Too many touchpoint requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// External service calls with error handling
async function fetchAppVisits(userId: string, startTime: Date, endTime: Date): Promise<number> {
  try {
    const response = await axios.get(`${ANALYTICS_URL}/api/analytics/app-visits`, {
      params: { userId, start: startTime.toISOString(), end: endTime.toISOString() },
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: 5000
    });
    return response.data?.visits || 0;
  } catch (error) {
    logger.warn('[DOOH Attribution] Failed to fetch app visits:', error);
    return 0;
  }
}

async function fetchSearches(userId: string, startTime: Date, endTime: Date): Promise<number> {
  try {
    const response = await axios.get(`${ANALYTICS_URL}/api/analytics/searches`, {
      params: { userId, start: startTime.toISOString(), end: endTime.toISOString() },
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: 5000
    });
    return response.data?.searches || 0;
  } catch (error) {
    logger.warn('[DOOH Attribution] Failed to fetch searches:', error);
    return 0;
  }
}

async function fetchConversions(userId: string, startTime: Date, endTime: Date): Promise<{ count: number; revenue: number }> {
  try {
    const response = await axios.get(`${ORDER_SERVICE_URL}/api/orders/conversions`, {
      params: { userId, start: startTime.toISOString(), end: endTime.toISOString() },
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: 5000
    });
    return { count: response.data?.count || 0, revenue: response.data?.revenue || 0 };
  } catch (error) {
    logger.warn('[DOOH Attribution] Failed to fetch conversions:', error);
    return { count: 0, revenue: 0 };
  }
}

// Health check - Comprehensive
app.get('/health', async (_req: Request, res: Response) => {
  const health: {
    status: string;
    timestamp: string;
    uptime: number;
    service: string;
    checks: {
      mongodb: { status: string; error?: string };
      redis: { status: string };
      external: { status: string; services: Record<string, string> };
    };
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'rez-dooh-attribution',
    checks: {
      mongodb: { status: 'unknown' },
      redis: { status: 'not_configured' },
      external: { status: 'unknown', services: {} }
    }
  };

  // Check MongoDB
  try {
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      health.checks.mongodb = { status: 'healthy' };
    } else {
      health.checks.mongodb = { status: 'disconnected' };
      health.status = 'degraded';
    }
  } catch (e) {
    const error = e as Error;
    health.checks.mongodb = { status: 'unhealthy', error: error.message };
    health.status = 'degraded';
  }

  // Check External Services (Event Bus, Analytics, Order Service)
  const externalChecks: { url: string; name: string }[] = [
    { url: EVENT_BUS_URL, name: 'eventBus' },
    { url: ANALYTICS_URL, name: 'analytics' },
    { url: ORDER_SERVICE_URL, name: 'orderService' }
  ];

  const externalResults: Record<string, string> = {};
  for (const svc of externalChecks) {
    try {
      const response = await axios.get(`${svc.url}/health`, { timeout: 3000 });
      externalResults[svc.name] = response.status === 200 ? 'healthy' : 'degraded';
    } catch {
      externalResults[svc.name] = 'unavailable';
    }
  }
  health.checks.external = { status: 'checked', services: externalResults };

  // Set status based on checks
  if (health.status === 'degraded' || Object.values(externalResults).some(s => s === 'unavailable')) {
    health.status = 'degraded';
    return res.status(503).json(health);
  }
  res.json(health);
});

// Simple liveness probe
app.get('/health/live', (_req: Request, res: Response) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// Readiness probe - checks if service can handle requests
app.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
    }
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'not_ready', timestamp: new Date().toISOString() });
  }
});

// TOUCHPOINT ENDPOINTS - with touchpoint-specific rate limiter
app.post('/api/touchpoints', touchpointLimiter, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedBody = validateBody(CreateTouchpointSchema, req.body, 'POST /api/touchpoints');

    await connectDB();
    const touchpoint = new Touchpoint({
      screenId: validatedBody.screenId,
      screenType: validatedBody.screenType,
      userId: validatedBody.userId,
      deviceId: validatedBody.deviceId,
      event: validatedBody.event,
      timestamp: validatedBody.timestamp ? new Date(validatedBody.timestamp) : new Date(),
      location: validatedBody.location,
      campaignId: validatedBody.campaignId,
      metadata: validatedBody.metadata,
      touchpointId: validatedBody.touchpointId || randomUUID(),
    });
    await touchpoint.save();

    // Publish event to event bus
    try {
      await axios.post(`${EVENT_BUS_URL}/api/events/publish`, {
        type: 'dooh.touchpoint',
        source: 'rez-dooh-attribution',
        data: { touchpointId: touchpoint.touchpointId, event: touchpoint.event }
      }, { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 3000 });
    } catch (e) { /* Non-critical */ }

    res.status(201).json({ success: true, data: { touchpointId: touchpoint.touchpointId } });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    logger.error('[DOOH Attribution] POST /api/touchpoints error:', error);
    res.status(500).json({ success: false, error: 'Failed to save touchpoint' });
  }
});

app.get('/api/touchpoints/:id', async (req: Request, res: Response) => {
  try {
    // Validate path parameter
    const touchpointId = req.params.id;
    if (!touchpointId || typeof touchpointId !== 'string' || touchpointId.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid touchpoint id parameter' });
    }

    await connectDB();
    const touchpoint = await Touchpoint.findOne({ touchpointId });
    if (!touchpoint) {
      return res.status(404).json({ success: false, error: 'Touchpoint not found' });
    }
    res.json({ success: true, data: touchpoint });
  } catch (error) {
    logger.error('[DOOH Attribution] GET /api/touchpoints/:id error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch touchpoint' });
  }
});

// METRICS ENDPOINTS - REAL DATA (with metrics-specific rate limiter)
app.get('/api/metrics/screen/:screenId', metricsLimiter, async (req: Request, res: Response) => {
  try {
    // Validate path parameter
    const screenId = req.params.screenId;
    if (!screenId || typeof screenId !== 'string' || screenId.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid screenId parameter' });
    }

    await connectDB();
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get touchpoints from MongoDB
    const touchpoints = await Touchpoint.find({
      screenId,
      timestamp: { $gte: start, $lte: end }
    });

    const impressions = touchpoints.filter(t => (t.event as string) === 'impression').length;
    const engagements = touchpoints.filter(t => (t.event as string) === 'view_through' || (t.event as string) === 'click').length;

    // Get real conversion data
    const userIds = [...new Set(touchpoints.map(t => t.userId as string).filter(Boolean))];
    let totalAppVisits = 0, totalSearches = 0, totalConversions = 0, totalRevenue = 0;

    for (const userId of userIds.slice(0, 100)) { // Limit external calls
      totalAppVisits += await fetchAppVisits(userId, start, end);
      totalSearches += await fetchSearches(userId, start, end);
      const conv = await fetchConversions(userId, start, end);
      totalConversions += conv.count;
      totalRevenue += conv.revenue;
    }

    const spend = impressions * 0.05; // CPM of ₹50 per 1000 impressions
    const roas = spend > 0 ? totalRevenue / spend : 0;

    res.json({
      success: true,
      data: {
        screenId,
        period: { start: start.toISOString(), end: end.toISOString() },
        impressions,
        engagements,
        appVisits: totalAppVisits,
        searches: totalSearches,
        conversions: totalConversions,
        revenue: totalRevenue,
        spend,
        roas: Math.round(roas * 100) / 100
      }
    });
  } catch (error) {
    logger.error('[DOOH Attribution] GET /api/metrics/screen error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch metrics' });
  }
});

// AGGREGATE METRICS - REAL DATA (with metrics-specific rate limiter)
app.post('/api/metrics/aggregate', metricsLimiter, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedBody = validateBody(AggregateMetricsSchema, req.body, 'POST /api/metrics/aggregate');

    await connectDB();
    const { screenIds, period = 7, groupBy } = validatedBody;
    const end = new Date();
    const start = new Date(end.getTime() - period * 24 * 60 * 60 * 1000);

    const match: Record<string, unknown> = { timestamp: { $gte: start, $lte: end } };
    if (screenIds?.length) match.screenId = { $in: screenIds };

    const aggregation = await Touchpoint.aggregate([
      { $match: match },
      { $group: {
        _id: groupBy === 'screenType' ? '$screenType' : '$screenId',
        impressions: { $sum: 1 },
        engagements: { $sum: { $cond: [{ $in: ['$event', ['view_through', 'click']] }, 1, 0] } },
        uniqueUsers: { $addToSet: '$userId' }
      }},
      { $project: {
        screenType: { $ifNull: ['$_id', 'unknown'] },
        impressions: 1,
        engagements: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
        roas: 0 // Would calculate from conversions
      }}
    ]);

    const totals = aggregation.reduce((acc: { impressions: number; engagements: number; uniqueUsers: number }, g: { impressions: number; engagements: number; uniqueUsers: number }) => ({
      impressions: acc.impressions + g.impressions,
      engagements: acc.engagements + g.engagements,
      uniqueUsers: acc.uniqueUsers + g.uniqueUsers
    }), { impressions: 0, engagements: 0, uniqueUsers: 0 });

    res.json({
      success: true,
      data: {
        totalImpressions: totals.impressions,
        totalEngagements: totals.engagements,
        totalUniqueUsers: totals.uniqueUsers,
        averageViewability: totals.impressions > 0 ? Math.round((totals.engagements / totals.impressions) * 100) / 100 : 0,
        byScreenType: aggregation
      }
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    logger.error('[DOOH Attribution] POST /api/metrics/aggregate error:', error);
    res.status(500).json({ success: false, error: 'Failed to aggregate metrics' });
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`[DOOH Attribution] Service started on port ${PORT}`);
});
