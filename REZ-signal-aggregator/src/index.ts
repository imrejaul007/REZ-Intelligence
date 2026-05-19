import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import winston from 'winston';
import axios from 'axios';
import { z } from 'zod';

// ============================================
// Configuration & Environment
// ============================================

const config = {
  port: parseInt(process.env.PORT || '4142', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-signals',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  cacheTtl: parseInt(process.env.CACHE_TTL || '300', 10), // 5 minutes default
  realtimeCacheTtl: parseInt(process.env.REALTIME_CACHE_TTL || '30', 10), // 30 seconds
  internalToken: process.env.INTERNAL_SERVICE_TOKEN || 'dev-token',
};

// ============================================
// Signal Weights Configuration
// ============================================

export const SIGNAL_WEIGHTS = {
  location: 0.15,
  behavioral: 0.25,
  social: 0.15,
  competitor: 0.20,
  engagement: 0.25,
} as const;

export type SignalType = keyof typeof SIGNAL_WEIGHTS;

// ============================================
// Types & Interfaces
// ============================================

export interface SignalScores {
  location: number;
  behavioral: number;
  social: number;
  competitor: number;
  engagement: number;
}

export interface UnifiedSignalScore {
  userId: string;
  signals: SignalScores;
  overall: number;
  segments: string[];
  computedAt: Date;
}

export interface SegmentMembership {
  segment: string;
  score: number;
  active: boolean;
  joinedAt: Date;
}

export interface SignalSummary {
  userId: string;
  overall: number;
  topSignals: Array<{ type: SignalType; score: number }>;
  segmentCount: number;
  lastUpdated: Date;
}

export interface RealTimeSignals {
  userId: string;
  signals: SignalScores;
  overall: number;
  velocity: {
    location: number;
    behavioral: number;
    social: number;
    competitor: number;
    engagement: number;
  };
  timestamp: Date;
}

// ============================================
// Segment Definitions
// ============================================

const SEGMENT_THRESHOLDS = {
  HIGH_VALUE: 75,
  MEDIUM_VALUE: 50,
  ENGAGED: 60,
  AT_RISK: 40,
  POWER_USER: 80,
  CASUAL: 30,
  COMPETITOR_CONSCIOUS: 70,
  LOCATION_SENSITIVE: 65,
  SOCIAL_BUTTERFLY: 70,
  INFLUENCER: 75,
} as const;

// ============================================
// Utility Functions
// ============================================

export function computeOverall(signals: SignalScores): number {
  return Math.round(
    signals.location * SIGNAL_WEIGHTS.location +
    signals.behavioral * SIGNAL_WEIGHTS.behavioral +
    signals.social * SIGNAL_WEIGHTS.social +
    signals.competitor * SIGNAL_WEIGHTS.competitor +
    signals.engagement * SIGNAL_WEIGHTS.engagement
  );
}

export function evaluateSegments(signals: SignalScores, overall: number): string[] {
  const segments: string[] = [];

  if (overall >= SEGMENT_THRESHOLDS.HIGH_VALUE) {
    segments.push('high-value');
  } else if (overall >= SEGMENT_THRESHOLDS.MEDIUM_VALUE) {
    segments.push('medium-value');
  } else if (overall <= SEGMENT_THRESHOLDS.AT_RISK) {
    segments.push('at-risk');
  }

  if (overall >= SEGMENT_THRESHOLDS.ENGAGED) {
    segments.push('engaged');
  } else if (overall < SEGMENT_THRESHOLDS.CASUAL) {
    segments.push('casual');
  }

  if (signals.engagement >= SEGMENT_THRESHOLDS.POWER_USER) {
    segments.push('power-user');
  }

  if (signals.competitor >= SEGMENT_THRESHOLDS.COMPETITOR_CONSCIOUS) {
    segments.push('competitor-conscious');
  }

  if (signals.location >= SEGMENT_THRESHOLDS.LOCATION_SENSITIVE) {
    segments.push('location-sensitive');
  }

  if (signals.social >= SEGMENT_THRESHOLDS.SOCIAL_BUTTERFLY) {
    segments.push('social-butterfly');
  }

  if (signals.social >= SEGMENT_THRESHOLDS.INFLUENCER &&
      signals.engagement >= SEGMENT_THRESHOLDS.INFLUENCER) {
    segments.push('influencer');
  }

  return segments;
}

function getTopSignals(signals: SignalScores): Array<{ type: SignalType; score: number }> {
  return Object.entries(signals)
    .map(([type, score]) => ({ type: type as SignalType, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

// ============================================
// MongoDB Models
// ============================================

const unifiedSignalSchema = new mongoose.Schema<UnifiedSignalScore>({
  userId: { type: String, required: true, unique: true, index: true },
  signals: {
    location: { type: Number, default: 0, min: 0, max: 100 },
    behavioral: { type: Number, default: 0, min: 0, max: 100 },
    social: { type: Number, default: 0, min: 0, max: 100 },
    competitor: { type: Number, default: 0, min: 0, max: 100 },
    engagement: { type: Number, default: 0, min: 0, max: 100 },
  },
  overall: { type: Number, default: 0, min: 0, max: 100 },
  segments: { type: [String], default: [] },
  computedAt: { type: Date, default: Date.now },
});

const segmentMembershipSchema = new mongoose.Schema<SegmentMembership & { userId: string }>({
  userId: { type: String, required: true, index: true },
  segment: { type: String, required: true, index: true },
  score: { type: Number, required: true },
  active: { type: Boolean, default: true },
  joinedAt: { type: Date, default: Date.now },
});

segmentMembershipSchema.index({ segment: 1, active: 1 });

const UnifiedSignal = mongoose.model<UnifiedSignalScore>('UnifiedSignal', unifiedSignalSchema);
const SegmentMembership = mongoose.model<SegmentMembership & { userId: string }>('SegmentMembership', segmentMembershipSchema);

// ============================================
// Redis Client
// ============================================

class CacheService {
  private redis: Redis | null = null;
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    try {
      this.redis = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true,
      });

      await this.redis.connect();
      this.isConnected = true;
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.warn('Redis connection failed, caching disabled:', error);
      this.isConnected = false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.redis) return null;

    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number = config.cacheTtl): Promise<void> {
    if (!this.isConnected || !this.redis) return;

    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      logger.error('Redis set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected || !this.redis) return;

    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error('Redis del error:', error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.isConnected || !this.redis) return;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      logger.error('Redis invalidate error:', error);
    }
  }
}

const cacheService = new CacheService();

// ============================================
// Logger
// ============================================

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// ============================================
// Signal Source Service Integration
// ============================================

interface SignalSourceConfig {
  name: string;
  baseUrl: string;
  endpoint: string;
  weight: number;
}

const SIGNAL_SOURCES: SignalSourceConfig[] = [
  {
    name: 'location',
    baseUrl: process.env.REZ_LOCATION_SERVICE_URL || 'http://localhost:4013',
    endpoint: '/api/signals',
    weight: SIGNAL_WEIGHTS.location,
  },
  {
    name: 'behavioral',
    baseUrl: process.env.REZ_BEHAVIORAL_SERVICE_URL || 'http://localhost:4014',
    endpoint: '/api/signals',
    weight: SIGNAL_WEIGHTS.behavioral,
  },
  {
    name: 'social',
    baseUrl: process.env.REZ_SOCIAL_SERVICE_URL || 'http://localhost:4015',
    endpoint: '/api/signals',
    weight: SIGNAL_WEIGHTS.social,
  },
  {
    name: 'competitor',
    baseUrl: process.env.REZ_COMPETITOR_SERVICE_URL || 'http://localhost:4016',
    endpoint: '/api/signals',
    weight: SIGNAL_WEIGHTS.competitor,
  },
  {
    name: 'engagement',
    baseUrl: process.env.REZ_ENGAGEMENT_SERVICE_URL || 'http://localhost:4017',
    endpoint: '/api/signals',
    weight: SIGNAL_WEIGHTS.engagement,
  },
];

interface FetchedSignal {
  type: SignalType;
  score: number;
  timestamp: Date;
}

async function fetchSignalFromSource(source: SignalSourceConfig, userId: string): Promise<FetchedSignal> {
  try {
    const response = await axios.get(`${source.baseUrl}${source.endpoint}/${userId}`, {
      timeout: 2000,
      headers: {
        'X-Internal-Token': config.internalToken,
      },
    });

    return {
      type: source.name as SignalType,
      score: Math.min(100, Math.max(0, response.data.score || 0)),
      timestamp: new Date(),
    };
  } catch (error) {
    logger.warn(`Failed to fetch ${source.name} signal for user ${userId}:`, error);
    // Return default score on failure
    return {
      type: source.name as SignalType,
      score: 50, // Neutral default
      timestamp: new Date(),
    };
  }
}

async function aggregateSignals(userId: string, bypassCache: boolean = false): Promise<UnifiedSignalScore> {
  const cacheKey = `signals:${userId}`;

  // Check cache unless bypass requested
  if (!bypassCache) {
    const cached = await cacheService.get<UnifiedSignalScore>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for user ${userId}`);
      return cached;
    }
  }

  // Fetch signals from all sources in parallel
  const signalPromises = SIGNAL_SOURCES.map(source => fetchSignalFromSource(source, userId));
  const fetchedSignals = await Promise.all(signalPromises);

  // Build signals object
  const signals: SignalScores = {
    location: 0,
    behavioral: 0,
    social: 0,
    competitor: 0,
    engagement: 0,
  };

  for (const signal of fetchedSignals) {
    signals[signal.type] = signal.score;
  }

  // Compute overall score
  const overall = computeOverall(signals);

  // Evaluate segments
  const segments = evaluateSegments(signals, overall);

  const unifiedSignal: UnifiedSignalScore = {
    userId,
    signals,
    overall,
    segments,
    computedAt: new Date(),
  };

  // Save to MongoDB
  try {
    await UnifiedSignal.findOneAndUpdate(
      { userId },
      unifiedSignal,
      { upsert: true, new: true }
    );

    // Update segment memberships
    await updateSegmentMemberships(userId, segments, overall);
  } catch (error) {
    logger.error('Failed to save unified signal:', error);
  }

  // Cache the result
  await cacheService.set(cacheKey, unifiedSignal, config.cacheTtl);

  return unifiedSignal;
}

async function updateSegmentMemberships(userId: string, segments: string[], overall: number): Promise<void> {
  // Deactivate all existing memberships
  await SegmentMembership.updateMany({ userId }, { active: false });

  // Create new memberships
  const memberships = segments.map(segment => ({
    userId,
    segment,
    score: overall,
    active: true,
    joinedAt: new Date(),
  }));

  if (memberships.length > 0) {
    await SegmentMembership.bulkWrite(
      memberships.map(m => ({
        updateOne: {
          filter: { userId, segment: m.segment },
          update: { $set: m },
          upsert: true,
        },
      }))
    );
  }
}

async function getRealTimeSignals(userId: string): Promise<RealTimeSignals> {
  const cacheKey = `signals:realtime:${userId}`;

  // Check cache first
  const cached = await cacheService.get<RealTimeSignals>(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch fresh signals
  const signalPromises = SIGNAL_SOURCES.map(source => fetchSignalFromSource(source, userId));
  const fetchedSignals = await Promise.all(signalPromises);

  const signals: SignalScores = {
    location: 0,
    behavioral: 0,
    social: 0,
    competitor: 0,
    engagement: 0,
  };

  for (const signal of fetchedSignals) {
    signals[signal.type] = signal.score;
  }

  const overall = computeOverall(signals);

  // Calculate velocity (simplified - would need historical data for real velocity)
  const velocity = {
    location: signals.location > 70 ? 1 : signals.location < 30 ? -1 : 0,
    behavioral: signals.behavioral > 70 ? 1 : signals.behavioral < 30 ? -1 : 0,
    social: signals.social > 70 ? 1 : signals.social < 30 ? -1 : 0,
    competitor: signals.competitor > 70 ? 1 : signals.competitor < 30 ? -1 : 0,
    engagement: signals.engagement > 70 ? 1 : signals.engagement < 30 ? -1 : 0,
  };

  const realtimeSignals: RealTimeSignals = {
    userId,
    signals,
    overall,
    velocity,
    timestamp: new Date(),
  };

  // Cache with short TTL
  await cacheService.set(cacheKey, realtimeSignals, config.realtimeCacheTtl);

  return realtimeSignals;
}

// ============================================
// Request Validation Schemas
// ============================================

const userIdParamsSchema = z.object({
  userId: z.string().min(1, 'userId is required').max(100),
});

const segmentParamsSchema = z.object({
  segment: z.string().min(1, 'segment is required').max(50),
});

// ============================================
// Express Application
// ============================================

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    query: req.query,
  });
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-signal-aggregator',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    redis: cacheService.isConnected ? 'connected' : 'disconnected',
  });
});

// GET /signals/:userId - Get unified signals
app.get('/signals/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamsSchema.parse(req.params);

    const signals = await aggregateSignals(userId);

    res.json({
      success: true,
      data: signals,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    logger.error('Error fetching signals:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /signals/:userId/summary - Get signal summary
app.get('/signals/:userId/summary', async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamsSchema.parse(req.params);

    const signals = await aggregateSignals(userId);
    const topSignals = getTopSignals(signals.signals);

    const summary: SignalSummary = {
      userId,
      overall: signals.overall,
      topSignals,
      segmentCount: signals.segments.length,
      lastUpdated: signals.computedAt,
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    logger.error('Error fetching signal summary:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /signals/:userId/segments - Get segment memberships
app.get('/signals/:userId/segments', async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamsSchema.parse(req.params);

    const memberships = await SegmentMembership.find({
      userId,
      active: true,
    }).sort({ joinedAt: -1 });

    res.json({
      success: true,
      data: memberships,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    logger.error('Error fetching segments:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /signals/segments/:segment - Get users in segment
app.get('/signals/segments/:segment', async (req: Request, res: Response) => {
  try {
    const { segment } = segmentParamsSchema.parse(req.params);
    const limit = Math.min(parseInt(req.query.limit as string || '100', 10), 1000);
    const offset = parseInt(req.query.offset as string || '0', 10);

    const memberships = await SegmentMembership.find({
      segment,
      active: true,
    })
      .sort({ score: -1 })
      .skip(offset)
      .limit(limit);

    const total = await SegmentMembership.countDocuments({
      segment,
      active: true,
    });

    res.json({
      success: true,
      data: {
        users: memberships.map(m => ({
          userId: m.userId,
          score: m.score,
          joinedAt: m.joinedAt,
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + memberships.length < total,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    logger.error('Error fetching segment users:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /signals/compute/:userId - Force recompute
app.post('/signals/compute/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamsSchema.parse(req.params);

    // Invalidate cache
    await cacheService.del(`signals:${userId}`);
    await cacheService.del(`signals:realtime:${userId}`);

    // Force recompute
    const signals = await aggregateSignals(userId, true);

    res.json({
      success: true,
      data: signals,
      message: 'Signals recomputed successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    logger.error('Error recomputing signals:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /signals/real-time/:userId - Get real-time signals (no long cache)
app.get('/signals/real-time/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = userIdParamsSchema.parse(req.params);

    const realtimeSignals = await getRealTimeSignals(userId);

    res.json({
      success: true,
      data: realtimeSignals,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    logger.error('Error fetching real-time signals:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /signals/weights - Get current signal weights
app.get('/signals/weights', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: SIGNAL_WEIGHTS,
  });
});

// GET /signals/segments/list - List all available segments
app.get('/signals/segments/list', (_req: Request, res: Response) => {
  const segments = [
    { name: 'high-value', threshold: SEGMENT_THRESHOLDS.HIGH_VALUE, description: 'Overall score >= 75' },
    { name: 'medium-value', threshold: SEGMENT_THRESHOLDS.MEDIUM_VALUE, description: 'Overall score >= 50' },
    { name: 'at-risk', threshold: SEGMENT_THRESHOLDS.AT_RISK, description: 'Overall score <= 40' },
    { name: 'engaged', threshold: SEGMENT_THRESHOLDS.ENGAGED, description: 'Overall score >= 60' },
    { name: 'casual', threshold: SEGMENT_THRESHOLDS.CASUAL, description: 'Overall score < 30' },
    { name: 'power-user', threshold: SEGMENT_THRESHOLDS.POWER_USER, description: 'Engagement score >= 80' },
    { name: 'competitor-conscious', threshold: SEGMENT_THRESHOLDS.COMPETITOR_CONSCIOUS, description: 'Competitor score >= 70' },
    { name: 'location-sensitive', threshold: SEGMENT_THRESHOLDS.LOCATION_SENSITIVE, description: 'Location score >= 65' },
    { name: 'social-butterfly', threshold: SEGMENT_THRESHOLDS.SOCIAL_BUTTERFLY, description: 'Social score >= 70' },
    { name: 'influencer', threshold: SEGMENT_THRESHOLDS.INFLUENCER, description: 'Social >= 75 and Engagement >= 75' },
  ];

  res.json({
    success: true,
    data: segments,
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// ============================================
// Server Startup
// ============================================

async function startServer(): Promise<void> {
  try {
    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(config.mongodbUri);
    logger.info('MongoDB connected successfully');

    // Connect to Redis
    await cacheService.connect();

    // Start Express server
    app.listen(config.port, () => {
      logger.info(`REZ Signal Aggregator running on port ${config.port}`);
      logger.info('Endpoints:');
      logger.info('  GET  /health                    - Health check');
      logger.info('  GET  /signals/:userId            - Get unified signals');
      logger.info('  GET  /signals/:userId/summary     - Get signal summary');
      logger.info('  GET  /signals/:userId/segments   - Get segment memberships');
      logger.info('  GET  /signals/segments/:segment  - Get users in segment');
      logger.info('  POST /signals/compute/:userId     - Force recompute');
      logger.info('  GET  /signals/real-time/:userId  - Get real-time signals');
      logger.info('  GET  /signals/weights            - Get signal weights');
      logger.info('  GET  /signals/segments/list      - List all segments');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

// Start the server
startServer();

export { app, aggregateSignals, getRealTimeSignals, evaluateSegments };
