/**
 * REZ Human Context Graph - Main Server
 *
 * Unified 15-layer context aggregation for Human Life Intelligence
 * Port: 4162
 */

import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { z } from 'zod';
import logger from './utils/logger.js';
import {
  HumanContextModel,
  SignalModel,
  collectLayerSignal,
  aggregateHumanContext,
  generateCosmicContext,
} from './services/contextGraphService.js';
import type { LifeLayer, HumanContext, CosmicContext } from './types/index.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4162', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_human_context';

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ============================================
// VALIDATION SCHEMAS
// ============================================

const signalSchema = z.object({
  userId: z.string().min(1),
  layer: z.enum([
    'health', 'commerce', 'relationship', 'karma', 'career', 'business',
    'mobility', 'spiritual', 'financial', 'realestate', 'hospitality',
    'daily', 'hyperlocal', 'events', 'student'
  ]),
  signal: z.string().min(1),
  value: z.unknown(),
  source: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const contextRequestSchema = z.object({
  userId: z.string().min(1),
  layers: z.array(z.string()).optional(),
  includeCosmic: z.boolean().optional(),
});

const batchSignalSchema = z.object({
  signals: z.array(signalSchema).min(1).max(100),
});

// ============================================
// HEALTH ENDPOINTS
// ============================================

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-human-context-graph',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', (_req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: mongoStatus === 'connected' ? 'ready' : 'not_ready',
    mongodb: mongoStatus,
  });
});

// ============================================
// SERVICE INFO
// ============================================

app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'REZ Human Context Graph',
    version: '1.0.0',
    port: PORT,
    description: 'Unified 15-layer context aggregation for Human Life Intelligence',
    layers: [
      'health', 'commerce', 'relationship', 'karma', 'career', 'business',
      'mobility', 'spiritual', 'financial', 'realestate', 'hospitality',
      'daily', 'hyperlocal', 'events', 'student'
    ],
    endpoints: {
      signals: {
        'POST /api/signals': 'Record layer signal',
        'POST /api/signals/batch': 'Batch record signals',
        'GET /api/signals/:userId/:layer': 'Get layer signals',
      },
      context: {
        'POST /api/context': 'Get unified human context',
        'POST /api/context/cosmic': 'Get cosmic context (abstracted)',
        'GET /api/context/:userId': 'Get context by userId',
      },
      layers: {
        'GET /api/layers/:userId/:layer': 'Get specific layer context',
        'GET /api/layers/:userId/summary': 'Get all layers summary',
      },
      insights: {
        'GET /api/insights/:userId/cross-layer': 'Get cross-layer insights',
        'GET /api/insights/:userId/risks': 'Get risk factors',
        'GET /api/insights/:userId/opportunities': 'Get opportunities',
      },
    },
  });
});

// ============================================
// SIGNAL ENDPOINTS
// ============================================

app.post('/api/signals', async (req: Request, res: Response) => {
  try {
    const validated = signalSchema.parse(req.body);

    await collectLayerSignal(
      validated.userId,
      validated.layer,
      validated.signal,
      validated.value,
      validated.source,
      validated.confidence,
      validated.metadata
    );

    res.status(201).json({
      success: true,
      message: 'Signal recorded',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    logger.error('Record signal error', { error });
    res.status(500).json({ error: 'Failed to record signal' });
  }
});

app.post('/api/signals/batch', async (req: Request, res: Response) => {
  try {
    const validated = batchSignalSchema.parse(req.body);

    const results = await Promise.allSettled(
      validated.signals.map(sig =>
        collectLayerSignal(
          sig.userId,
          sig.layer,
          sig.signal,
          sig.value,
          sig.source,
          sig.confidence,
          sig.metadata
        )
      )
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    res.status(201).json({
      success: true,
      recorded: succeeded,
      failed,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    logger.error('Batch signals error', { error });
    res.status(500).json({ error: 'Failed to record signals' });
  }
});

app.get('/api/signals/:userId/:layer', async (req: Request, res: Response) => {
  try {
    const { userId, layer } = req.params;
    const { limit = '50' } = req.query;

    const signals = await SignalModel.find({
      userId,
      layer,
    })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit as string, 10));

    res.json({
      success: true,
      count: signals.length,
      signals,
    });
  } catch (error) {
    logger.error('Get signals error', { error });
    res.status(500).json({ error: 'Failed to get signals' });
  }
});

app.get('/api/signals/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { days = '30' } = req.query;

    const daysNum = parseInt(days as string, 10);
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    const signals = await SignalModel.find({
      userId,
      timestamp: { $gte: startDate },
    }).sort({ timestamp: -1 });

    // Group by layer
    const byLayer: Record<string, number> = {};
    for (const signal of signals) {
      byLayer[signal.layer] = (byLayer[signal.layer] || 0) + 1;
    }

    res.json({
      success: true,
      total: signals.length,
      byLayer,
      recent: signals.slice(0, 10),
    });
  } catch (error) {
    logger.error('Get all signals error', { error });
    res.status(500).json({ error: 'Failed to get signals' });
  }
});

// ============================================
// CONTEXT ENDPOINTS
// ============================================

app.post('/api/context', async (req: Request, res: Response) => {
  try {
    const validated = contextRequestSchema.parse(req.body);

    const context = await aggregateHumanContext(
      validated.userId,
      validated.layers as LifeLayer[] | undefined
    );

    // Optionally include cosmic interpretation
    let cosmicContext: CosmicContext | undefined;
    if (validated.includeCosmic) {
      cosmicContext = await generateCosmicContext(context);
    }

    res.json({
      success: true,
      context,
      ...(cosmicContext && { cosmic: cosmicContext }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    logger.error('Get context error', { error });
    res.status(500).json({ error: 'Failed to get context' });
  }
});

app.post('/api/context/cosmic', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId required' });
      return;
    }

    const context = await aggregateHumanContext(userId);
    const cosmic = await generateCosmicContext(context);

    res.json({
      success: true,
      cosmic,
      context: {
        userId: context.userId,
        lifeStage: context.lifeStage,
        riskFactors: context.riskFactors,
        opportunities: context.opportunities,
      },
    });
  } catch (error) {
    logger.error('Get cosmic context error', { error });
    res.status(500).json({ error: 'Failed to get cosmic context' });
  }
});

app.get('/api/context/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { includeCosmic = 'false' } = req.query;

    const context = await aggregateHumanContext(userId as string);

    let cosmic: CosmicContext | undefined;
    if (includeCosmic === 'true') {
      cosmic = await generateCosmicContext(context);
    }

    res.json({
      success: true,
      context,
      ...(cosmic && { cosmic }),
    });
  } catch (error) {
    logger.error('Get context error', { error });
    res.status(500).json({ error: 'Failed to get context' });
  }
});

// ============================================
// LAYER ENDPOINTS
// ============================================

app.get('/api/layers/:userId/:layer', async (req: Request, res: Response) => {
  try {
    const { userId, layer } = req.params;

    const context = await HumanContextModel.findOne({ userId });
    const layerData = context?.layers[layer as LifeLayer];

    if (!layerData) {
      // Fetch signals for this layer
      const signals = await SignalModel.find({
        userId,
        layer,
      })
        .sort({ timestamp: -1 })
        .limit(100);

      res.json({
        success: true,
        layer,
        signals,
        summary: `Found ${signals.length} signals for ${layer}`,
      });
      return;
    }

    res.json({
      success: true,
      layer,
      data: layerData,
    });
  } catch (error) {
    logger.error('Get layer error', { error });
    res.status(500).json({ error: 'Failed to get layer' });
  }
});

app.get('/api/layers/:userId/summary', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Get signal counts per layer
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const allLayers = [
      'health', 'commerce', 'relationship', 'karma', 'career', 'business',
      'mobility', 'spiritual', 'financial', 'realestate', 'hospitality',
      'daily', 'hyperlocal', 'events', 'student'
    ];

    const summary: Record<string, { signals: number; lastUpdated?: Date }> = {};

    for (const layer of allLayers) {
      const signals = await SignalModel.find({
        userId,
        layer,
        timestamp: { $gte: thirtyDaysAgo },
      })
        .sort({ timestamp: -1 })
        .limit(1);

      summary[layer] = {
        signals: await SignalModel.countDocuments({
          userId,
          layer,
          timestamp: { $gte: thirtyDaysAgo },
        }),
        lastUpdated: signals[0]?.timestamp,
      };
    }

    // Calculate overall completeness
    const layersWithData = Object.values(summary).filter(s => s.signals > 0).length;
    const completeness = Math.round((layersWithData / allLayers.length) * 100);

    res.json({
      success: true,
      summary,
      overallCompleteness: completeness,
      activeLayers: layersWithData,
      totalLayers: allLayers.length,
    });
  } catch (error) {
    logger.error('Get layers summary error', { error });
    res.status(500).json({ error: 'Failed to get layers summary' });
  }
});

// ============================================
// INSIGHTS ENDPOINTS
// ============================================

app.get('/api/insights/:userId/cross-layer', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const context = await aggregateHumanContext(userId as string);

    res.json({
      success: true,
      insights: context.crossLayerInsights,
      count: context.crossLayerInsights.length,
    });
  } catch (error) {
    logger.error('Get cross-layer insights error', { error });
    res.status(500).json({ error: 'Failed to get insights' });
  }
});

app.get('/api/insights/:userId/risks', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { level } = req.query;

    const context = await aggregateHumanContext(userId as string);

    let risks = context.riskFactors;
    if (level) {
      risks = risks.filter(r => r.level === level);
    }

    res.json({
      success: true,
      risks,
      count: risks.length,
      summary: {
        critical: risks.filter(r => r.level === 'critical').length,
        high: risks.filter(r => r.level === 'high').length,
        medium: risks.filter(r => r.level === 'medium').length,
        low: risks.filter(r => r.level === 'low').length,
      },
    });
  } catch (error) {
    logger.error('Get risks error', { error });
    res.status(500).json({ error: 'Failed to get risks' });
  }
});

app.get('/api/insights/:userId/opportunities', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const context = await aggregateHumanContext(userId as string);

    // Sort by potential
    const opportunities = [...context.opportunities].sort((a, b) => b.potential - a.potential);

    res.json({
      success: true,
      opportunities,
      count: opportunities.length,
    });
  } catch (error) {
    logger.error('Get opportunities error', { error });
    res.status(500).json({ error: 'Failed to get opportunities' });
  }
});

app.get('/api/insights/:userId/life-stage', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const context = await aggregateHumanContext(userId as string);

    res.json({
      success: true,
      lifeStage: context.lifeStage,
    });
  } catch (error) {
    logger.error('Get life stage error', { error });
    res.status(500).json({ error: 'Failed to get life stage' });
  }
});

// ============================================
// STATISTICS
// ============================================

app.get('/api/stats', async (_req: Request, res: Response) => {
  try {
    const userCount = await HumanContextModel.countDocuments();
    const signalCount = await SignalModel.countDocuments();

    // Layer distribution
    const layerCounts: Record<string, number> = {};
    const layers = await SignalModel.aggregate([
      { $group: { _id: '$layer', count: { $sum: 1 } } }
    ]);
    for (const layer of layers) {
      layerCounts[layer._id] = layer.count;
    }

    res.json({
      success: true,
      stats: {
        users: userCount,
        signals: signalCount,
        byLayer: layerCounts,
      },
    });
  } catch (error) {
    logger.error('Stats error', { error });
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error: err });
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// STARTUP
// ============================================

async function start(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB', { uri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@') });

    // Create indexes
    await SignalModel.createIndexes();
    await HumanContextModel.createIndexes();

    app.listen(PORT, () => {
      logger.info(`REZ Human Context Graph started on port ${PORT}`);
      logger.info(`Health: http://localhost:${PORT}/health`);
      logger.info(`API: http://localhost:${PORT}/`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down');
  await mongoose.disconnect();
  process.exit(0);
});

start();

export { app };
