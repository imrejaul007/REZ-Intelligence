/**
 * REZ Explainability Engine - Main Entry Point
 *
 * Port: 4145
 *
 * Features:
 * - SHAP-like feature importance
 * - Natural language explanations
 * - Counterfactual reasoning
 * - Audit trails for compliance
 * - Trust scoring
 */

import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { logger } from './utils/logger';
import { ExplainabilityService, getExplainabilityService } from './explainabilityService';
import {
  ExplanationRequest,
  ModelType,
  AuditEntry,
  AuditFilter,
  TrustScore,
  ComplianceReport,
  IExplanation,
  IAuditEntry,
} from './types';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  PORT: parseInt(process.env.PORT || '4145', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-explainability',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  NODE_ENV: process.env.NODE_ENV || 'development',
  INTERNAL_TOKEN: process.env.INTERNAL_SERVICE_TOKEN || '',
  CACHE_TTL: 3600,
};

// ============================================
// EXPRESS APP
// ============================================

const app: Express = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// ============================================
// MONGODB MODELS
// ============================================

const explanationSchema = new mongoose.Schema({
  predictionId: { type: String, required: true, unique: true, index: true },
  modelType: { type: String, required: true, enum: ['churn_predictor', 'ltv_predictor', 'revisit_predictor', 'conversion_predictor', 'recommendation_engine', 'price_predictor', 'demand_forecast', 'fraud_detector', 'segmentation', 'propensity_scorer'] },
  originalPrediction: Number,
  predictionLabel: String,
  confidence: Number,
  factors: mongoose.Schema.Types.Mixed,
  reasoning: String,
  naturalLanguageExplanation: String,
  counterfactuals: mongoose.Schema.Types.Mixed,
  featureImportance: mongoose.Schema.Types.Mixed,
  confidenceInterval: mongoose.Schema.Types.Mixed,
  context: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

explanationSchema.index({ modelType: 1, createdAt: -1 });
explanationSchema.index({ 'context.userId': 1, createdAt: -1 });

const ExplanationModel = mongoose.model<IExplanation>('Explanation', explanationSchema);

const auditEntrySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  userId: String,
  action: String,
  modelType: String,
  predictionId: String,
  explanationId: String,
  request: mongoose.Schema.Types.Mixed,
  response: mongoose.Schema.Types.Mixed,
  latencyMs: Number,
  userAgent: String,
  ipAddress: String,
});

auditEntrySchema.index({ timestamp: -1, action: 1 });
auditEntrySchema.index({ userId: 1, timestamp: -1 });

const AuditEntryModel = mongoose.model<IAuditEntry>('AuditEntry', auditEntrySchema);

// ============================================
// SERVICES
// ============================================

let explainabilityService: ExplainabilityService;
let redis: Redis | null = null;

// ============================================
// VALIDATION SCHEMAS
// ============================================

const ExplainRequestSchema = z.object({
  modelType: z.enum(['churn_predictor', 'ltv_predictor', 'revisit_predictor', 'conversion_predictor', 'recommendation_engine', 'price_predictor', 'demand_forecast', 'fraud_detector', 'segmentation', 'propensity_scorer']),
  predictionId: z.string(),
  prediction: z.number(),
  features: z.record(z.string(), z.number()),
  context: z.object({
    userId: z.string().optional(),
    merchantId: z.string().optional(),
    orderId: z.string().optional(),
    sessionId: z.string().optional(),
  }).optional(),
  options: z.object({
    includeCounterfactuals: z.boolean().optional(),
    includeFeatureImportance: z.boolean().optional(),
    includeConfidenceInterval: z.boolean().optional(),
    maxFactors: z.number().optional(),
  }).optional(),
});

const AuditFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  userId: z.string().optional(),
  modelType: z.string().optional(),
  action: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).optional(),
});

// ============================================
// HEALTH ENDPOINTS
// ============================================

app.get('/health', async (req: Request, res: Response) => {
  const stats = explainabilityService.getStats();
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const redisStatus = redis?.status === 'ready' ? 'connected' : 'disconnected';

  res.json({
    status: 'healthy',
    service: 'rez-explainability-engine',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dependencies: {
      mongodb: mongoStatus,
      redis: redisStatus,
    },
    stats: {
      totalRequests: stats.totalRequests,
      cacheHitRate: (stats.cacheHitRate * 100).toFixed(2) + '%',
      avgLatency: stats.avgLatency.toFixed(2) + 'ms',
    },
  });
});

app.get('/health/live', (req: Request, res: Response) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

app.get('/health/ready', async (req: Request, res: Response) => {
  const isReady = mongoose.connection.readyState === 1 && redis?.status === 'ready';
  if (isReady) {
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  } else {
    res.status(503).json({ status: 'not ready', timestamp: new Date().toISOString() });
  }
});

// ============================================
// MAIN EXPLANATION ENDPOINTS
// ============================================

/**
 * POST /api/explain
 * Generate explanation for a prediction
 */
app.post('/api/explain', async (req: Request, res: Response) => {
  try {
    const validation = ExplainRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const request: ExplanationRequest = {
      ...validation.data,
      options: validation.data.options || {},
    };

    const result = await explainabilityService.explain(request);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Store in MongoDB
    const explanation = new ExplanationModel({
      predictionId: request.predictionId,
      modelType: request.modelType,
      originalPrediction: request.prediction,
      predictionLabel: result.explanation!.predictionLabel,
      confidence: result.explanation!.confidence,
      factors: result.explanation!.factors,
      reasoning: result.explanation!.reasoning,
      naturalLanguageExplanation: result.explanation!.naturalLanguageExplanation,
      counterfactuals: result.explanation!.counterfactuals,
      featureImportance: result.explanation!.featureImportance,
      confidenceInterval: result.explanation!.confidenceInterval,
      context: request.context,
    });

    await explanation.save();

    // Log to audit
    await logAuditEntry({
      action: 'explain',
      modelType: request.modelType,
      predictionId: request.predictionId,
      explanationId: explanation._id.toString(),
      request: req.body,
      response: result.explanation ?? null,
      latencyMs: Date.now() - Date.now(),
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: result.explanation,
      cached: result.cached,
    });
  } catch (error) {
    logger.error('Explain endpoint error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/explain/batch
 * Generate explanations for multiple predictions
 */
app.post('/api/explain/batch', async (req: Request, res: Response) => {
  try {
    const { requests } = req.body as { requests: ExplanationRequest[] };

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'requests must be a non-empty array',
      });
    }

    if (requests.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 requests per batch',
      });
    }

    const results = await Promise.all(
      requests.map((request) => explainabilityService.explain(request))
    );

    const explanations = results.map((result, index) => ({
      index,
      success: result.success,
      data: result.success ? result.explanation : null,
      error: result.success ? null : result.error,
      cached: result.cached,
    }));

    res.json({
      success: true,
      total: requests.length,
      successful: explanations.filter((e) => e.success).length,
      failed: explanations.filter((e) => !e.success).length,
      results: explanations,
    });
  } catch (error) {
    logger.error('Batch explain endpoint error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/explain/:predictionId
 * Get existing explanation by prediction ID
 */
app.get('/api/explain/:predictionId', async (req: Request, res: Response) => {
  try {
    const { predictionId } = req.params;

    const explanation = await ExplanationModel.findOne({ predictionId });
    if (!explanation) {
      return res.status(404).json({
        success: false,
        error: 'Explanation not found',
      });
    }

    res.json({
      success: true,
      data: explanation,
    });
  } catch (error) {
    logger.error('Get explanation error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/explain/model/:modelType
 * Get explanations by model type
 */
app.get('/api/explain/model/:modelType', async (req: Request, res: Response) => {
  try {
    const { modelType } = req.params;
    const { limit = 50, startDate, endDate } = req.query;

    const query: Record<string, unknown> = { modelType };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) (query.createdAt as Record<string, Date>).$gte = new Date(startDate as string);
      if (endDate) (query.createdAt as Record<string, Date>).$lte = new Date(endDate as string);
    }

    const explanations = await ExplanationModel.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string, 10));

    res.json({
      success: true,
      count: explanations.length,
      data: explanations,
    });
  } catch (error) {
    logger.error('Get explanations by model error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// ============================================
// AUDIT ENDPOINTS
// ============================================

/**
 * GET /api/audit
 * Get audit entries
 */
app.get('/api/audit', async (req: Request, res: Response) => {
  try {
    const validation = AuditFilterSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: validation.error.errors,
      });
    }

    const filterData = validation.data;
    const query: Record<string, unknown> = {};
    const startDate = filterData.startDate ? new Date(filterData.startDate) : undefined;
    const endDate = filterData.endDate ? new Date(filterData.endDate) : undefined;

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) (query.timestamp as Record<string, Date>).$gte = startDate;
      if (endDate) (query.timestamp as Record<string, Date>).$lte = endDate;
    }
    if (filterData.userId) query.userId = filterData.userId;
    if (filterData.modelType) query.modelType = filterData.modelType;
    if (filterData.action) query.action = filterData.action;

    const entries = await AuditEntryModel.find(query)
      .sort({ timestamp: -1 })
      .limit(filterData.limit || 100);

    res.json({
      success: true,
      count: entries.length,
      data: entries,
    });
  } catch (error) {
    logger.error('Get audit entries error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/audit/stats
 * Get audit statistics
 */
app.get('/api/audit/stats', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const match: Record<string, unknown> = {};
    if (startDate || endDate) {
      match.timestamp = {};
      if (startDate) (match.timestamp as Record<string, Date>).$gte = new Date(startDate as string);
      if (endDate) (match.timestamp as Record<string, Date>).$lte = new Date(endDate as string);
    }

    const [byModel, byAction, byDay] = await Promise.all([
      AuditEntryModel.aggregate([
        { $match: match },
        { $group: { _id: '$modelType', count: { $sum: 1 } } },
      ]),
      AuditEntryModel.aggregate([
        { $match: match },
        { $group: { _id: '$action', count: { $sum: 1 } } },
      ]),
      AuditEntryModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 30 },
      ]),
    ]);

    res.json({
      success: true,
      stats: {
        byModel,
        byAction,
        byDay,
      },
    });
  } catch (error) {
    logger.error('Get audit stats error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// ============================================
// TRUST SCORING ENDPOINTS
// ============================================

/**
 * GET /api/trust/:entityType/:entityId
 * Get trust score for an entity
 */
app.get('/api/trust/:entityType/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;

    // Get recent explanations for this entity
    const query: Record<string, unknown> = {};
    if (entityType === 'user') query['context.userId'] = entityId;
    else if (entityType === 'merchant') query['context.merchantId'] = entityId;

    const recentExplanations = await ExplanationModel.find(query)
      .sort({ createdAt: -1 })
      .limit(100);

    if (recentExplanations.length === 0) {
      return res.json({
        success: true,
        data: {
          entityId,
          entityType,
          overallScore: 50,
          factors: {
            transparency: 50,
            consistency: 50,
            accuracy: 50,
            fairness: 50,
          },
          lastUpdated: new Date(),
          message: 'No data available - returning default score',
        },
      });
    }

    // Calculate trust factors
    const avgConfidence = recentExplanations.reduce(
      (sum, e) => sum + (e.confidence || 0),
      0
    ) / recentExplanations.length;

    const consistency = calculateConsistency(recentExplanations);
    const transparency = avgConfidence * 100;
    const accuracy = calculateAccuracy(recentExplanations);
    const fairness = calculateFairness(recentExplanations);

    const trustScore: TrustScore = {
      entityId,
      entityType: entityType as 'user' | 'merchant' | 'campaign',
      overallScore: Math.round((transparency + consistency + accuracy + fairness) / 4),
      factors: {
        transparency: Math.round(transparency),
        consistency: Math.round(consistency),
        accuracy: Math.round(accuracy),
        fairness: Math.round(fairness),
      },
      lastUpdated: new Date(),
    };

    res.json({
      success: true,
      data: trustScore,
    });
  } catch (error) {
    logger.error('Get trust score error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// ============================================
// COMPLIANCE ENDPOINTS
// ============================================

/**
 * GET /api/compliance/report
 * Generate compliance report
 */
app.get('/api/compliance/report', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, reportType = 'audit' } = req.query;

    const match: Record<string, unknown> = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) (match.createdAt as Record<string, Date>).$gte = new Date(startDate as string);
      if (endDate) (match.createdAt as Record<string, Date>).$lte = new Date(endDate as string);
    }

    const [explanationCount, auditStats] = await Promise.all([
      ExplanationModel.countDocuments(match),
      AuditEntryModel.aggregate([
        {
          $match: {
            timestamp: startDate || endDate ? {
              ...(startDate && { $gte: new Date(startDate as string) }),
              ...(endDate && { $lte: new Date(endDate as string) }),
            } : {},
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            avgLatency: { $avg: '$latencyMs' },
          },
        },
      ]),
    ]);

    const report: ComplianceReport = {
      id: uuidv4(),
      reportType: reportType as 'gdpr' | 'audit' | 'regulatory',
      period: {
        start: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate as string) : new Date(),
      },
      modelExplanations: explanationCount,
      auditEntries: auditStats[0]?.count || 0,
      averageLatency: auditStats[0]?.avgLatency || 0,
      cacheHitRate: explainabilityService.getStats().cacheHitRate,
      generatedAt: new Date(),
    };

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Generate compliance report error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// ============================================
// STATISTICS ENDPOINT
// ============================================

/**
 * GET /api/stats
 * Get service statistics
 */
app.get('/api/stats', async (req: Request, res: Response) => {
  try {
    const stats = explainabilityService.getStats();
    const modelCounts = await ExplanationModel.aggregate([
      { $group: { _id: '$modelType', count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      stats: {
        ...stats,
        cacheHitRate: (stats.cacheHitRate * 100).toFixed(2) + '%',
        avgLatency: stats.avgLatency.toFixed(2) + 'ms',
        storedExplanations: modelCounts,
      },
    });
  } catch (error) {
    logger.error('Get stats error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

async function logAuditEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
  try {
    const auditEntry = new AuditEntryModel({
      id: uuidv4(),
      timestamp: new Date(),
      ...entry,
    });
    await auditEntry.save();
  } catch (error) {
    logger.error('Failed to log audit entry', { error });
  }
}

function calculateConsistency(explanations: IExplanation[]): number {
  if (explanations.length < 2) return 80;
  const predictions = explanations.map((e) => e.originalPrediction);
  const variance = calculateVariance(predictions);
  return Math.max(0, 100 - variance * 10);
}

function calculateAccuracy(explanations: IExplanation[]): number {
  const confidences = explanations.map((e) => e.confidence || 0);
  const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  return avgConfidence * 100;
}

function calculateFairness(explanations: IExplanation[]): number {
  // Check for bias in explanations - simplified version
  const factorVariance = explanations.reduce((acc, e) => {
    const factorCount = Array.isArray(e.factors) ? e.factors.length : 0;
    return acc + factorCount;
  }, 0) / explanations.length;

  // Ideal is having multiple factors (not just one dominant factor)
  return Math.min(100, factorVariance * 10);
}

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
}

// ============================================
// ERROR HANDLING
// ============================================

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    path: req.path,
  });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(500).json({
    success: false,
    error: CONFIG.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// ============================================
// STARTUP
// ============================================

async function start(): Promise<void> {
  try {
    // Connect to MongoDB (optional - service works without it)
    try {
      await mongoose.connect(CONFIG.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      logger.info('Connected to MongoDB');
    } catch (mongoError) {
      logger.warn('MongoDB not available - running without persistence');
    }

    // Connect to Redis (optional - service works without it)
    try {
      redis = new Redis(CONFIG.REDIS_URL, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        connectTimeout: 5000,
      });
      await redis.connect();
      logger.info('Connected to Redis');
    } catch (redisError) {
      logger.warn('Redis not available - running without cache');
      redis = null;
    }

    // Initialize service
    explainabilityService = getExplainabilityService(redis ?? undefined);

    // Start server
    app.listen(CONFIG.PORT, () => {
      logger.info(`REZ Explainability Engine started on port ${CONFIG.PORT}`);
      logger.info(`Health: http://localhost:${CONFIG.PORT}/health`);
      logger.info(`API: http://localhost:${CONFIG.PORT}/api/explain`);
      logger.info(`Audit: http://localhost:${CONFIG.PORT}/api/audit`);
      logger.info(`Trust: http://localhost:${CONFIG.PORT}/api/trust`);
      logger.info(`Compliance: http://localhost:${CONFIG.PORT}/api/compliance/report`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down...');
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
      if (redis) {
        await redis.quit();
      }
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

start();

export { app };
