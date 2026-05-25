/**
 * REZ Temporal Intelligence - Main Server
 *
 * Sequence learning, habit detection, behavioral transitions, lifecycle prediction
 * Port: 4144
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { z } from 'zod';
import logger from './utils/logger';
import {
  analyzeSequence,
  detectHabits,
  predictTransition,
  getLifecycle,
  getHealthStatus,
  getStats,
} from './temporalService';
import type {
  SequenceEvent,
  AnalyzeSequenceRequest,
  DetectHabitsRequest,
  PredictTransitionRequest,
  GetLifecycleRequest,
} from './types';

const app = express();
const PORT = process.env.PORT || 4144;

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip,
  });
  next();
});

// ============================================
// VALIDATION SCHEMAS
// ============================================

const sequenceEventSchema = z.object({
  eventType: z.string().min(1),
  timestamp: z.union([z.string().datetime(), z.date()]).transform(v => new Date(v)),
  duration: z.number().optional(),
  properties: z.record(z.unknown()).optional(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
});

const analyzeSequenceSchema = z.object({
  entityId: z.string().min(1),
  entityType: z.enum(['user', 'merchant', 'product', 'location']),
  events: z.array(sequenceEventSchema).min(1),
  options: z.object({
    detectPattern: z.boolean().optional(),
    generateEmbedding: z.boolean().optional(),
    predictNext: z.boolean().optional(),
  }).optional(),
});

const detectHabitsSchema = z.object({
  entityId: z.string().min(1),
  entityType: z.enum(['user', 'merchant']),
  events: z.array(sequenceEventSchema).min(1),
  options: z.object({
    minConfidence: z.number().min(0).max(1).optional(),
    minFrequency: z.number().min(1).optional(),
  }).optional(),
});

const predictTransitionSchema = z.object({
  entityId: z.string().min(1),
  entityType: z.enum(['user', 'merchant']),
  currentState: z.string().min(1),
  targetState: z.string().optional(),
});

const getLifecycleSchema = z.object({
  entityId: z.string().min(1),
  entityType: z.enum(['user', 'merchant']),
});

// ============================================
// SEQUENCE ENDPOINTS
// ============================================

/**
 * POST /api/sequences
 * Analyze a sequence of events
 */
app.post('/api/sequences', async (req: Request, res: Response) => {
  try {
    const validation = analyzeSequenceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const request: AnalyzeSequenceRequest = {
      ...validation.data,
      events: validation.data.events.map(e => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })),
    };

    const result = await analyzeSequence(request);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Sequence analysis error', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/sequences/:entityId
 * Get sequences for an entity
 */
app.get('/api/sequences/:entityId', (req: Request, res: Response) => {
  const { entityId } = req.params;
  const { entityType } = req.query;

  // This would query the database in production
  res.json({
    success: true,
    entityId,
    entityType: entityType || 'user',
    sequences: [],
  });
});

/**
 * GET /api/sequences/:entityId/patterns
 * Get detected patterns for an entity
 */
app.get('/api/sequences/:entityId/patterns', (req: Request, res: Response) => {
  const { entityId } = req.params;

  res.json({
    success: true,
    entityId,
    patterns: [],
  });
});

// ============================================
// HABIT ENDPOINTS
// ============================================

/**
 * POST /api/habits
 * Detect habits from event sequences
 */
app.post('/api/habits', async (req: Request, res: Response) => {
  try {
    const validation = detectHabitsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const request: DetectHabitsRequest = {
      ...validation.data,
      events: validation.data.events.map(e => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })),
    };

    const result = await detectHabits(request);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Habit detection error', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/habits/:entityId
 * Get detected habits for an entity
 */
app.get('/api/habits/:entityId', (req: Request, res: Response) => {
  const { entityId } = req.params;
  const { entityType } = req.query;

  res.json({
    success: true,
    entityId,
    entityType: entityType || 'user',
    habits: [],
  });
});

/**
 * GET /api/habits/:entityId/:habitId
 * Get specific habit details
 */
app.get('/api/habits/:entityId/:habitId', (req: Request, res: Response) => {
  const { entityId, habitId } = req.params;

  res.json({
    success: true,
    entityId,
    habitId,
    habit: null,
  });
});

/**
 * GET /api/habits/:entityId/:habitId/contexts
 * Get context triggers for a habit
 */
app.get('/api/habits/:entityId/:habitId/contexts', (req: Request, res: Response) => {
  const { entityId, habitId } = req.params;

  res.json({
    success: true,
    entityId,
    habitId,
    contexts: [],
  });
});

/**
 * GET /api/habits/:entityId/:habitId/streak
 * Get streak information for a habit
 */
app.get('/api/habits/:entityId/:habitId/streak', (req: Request, res: Response) => {
  const { entityId, habitId } = req.params;

  res.json({
    success: true,
    entityId,
    habitId,
    current: 0,
    max: 0,
    lastOccurrence: null,
  });
});

// ============================================
// TRANSITION ENDPOINTS
// ============================================

/**
 * POST /api/transitions
 * Predict behavioral transitions
 */
app.post('/api/transitions', async (req: Request, res: Response) => {
  try {
    const validation = predictTransitionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const request: PredictTransitionRequest = validation.data;
    const result = await predictTransition(request);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Transition prediction error', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/transitions/:entityId
 * Get transition history for an entity
 */
app.get('/api/transitions/:entityId', (req: Request, res: Response) => {
  const { entityId } = req.params;
  const { entityType } = req.query;

  res.json({
    success: true,
    entityId,
    entityType: entityType || 'user',
    transitions: [],
  });
});

/**
 * GET /api/transitions/:entityId/:transitionId
 * Get specific transition details
 */
app.get('/api/transitions/:entityId/:transitionId', (req: Request, res: Response) => {
  const { entityId, transitionId } = req.params;

  res.json({
    success: true,
    entityId,
    transitionId,
    transition: null,
  });
});

/**
 * GET /api/transitions/types
 * Get all transition types
 */
app.get('/api/transitions/types', (_req: Request, res: Response) => {
  res.json({
    success: true,
    types: [
      { type: 'engagement', description: 'Increasing engagement' },
      { type: 'disengagement', description: 'Decreasing engagement' },
      { type: 'upgrade', description: 'Upgrading subscription/tier' },
      { type: 'downgrade', description: 'Downgrading subscription/tier' },
      { type: 'activation', description: 'First meaningful action' },
      { type: 'churn', description: 'Complete disengagement' },
      { type: 'retention', description: 'Sustained engagement' },
      { type: 'advocacy', description: 'Becoming a promoter' },
      { type: 'dormancy', description: 'Temporary inactivity' },
      { type: 'reactivation', description: 'Returning after dormancy' },
    ],
  });
});

// ============================================
// LIFECYCLE ENDPOINTS
// ============================================

/**
 * POST /api/lifecycle
 * Get lifecycle state for an entity
 */
app.post('/api/lifecycle', async (req: Request, res: Response) => {
  try {
    const validation = getLifecycleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const request: GetLifecycleRequest = validation.data;
    const result = await getLifecycle(request);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Lifecycle retrieval error', { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/lifecycle/:entityId
 * Get lifecycle state for an entity (GET variant)
 */
app.get('/api/lifecycle/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityId } = req.params;
    const entityType = (req.query.entityType as string) || 'user';

    const request: GetLifecycleRequest = { entityId, entityType: entityType as 'user' | 'merchant' };
    const result = await getLifecycle(request);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/lifecycle/stages
 * Get all lifecycle stages
 */
app.get('/api/lifecycle/stages', (_req: Request, res: Response) => {
  res.json({
    success: true,
    stages: [
      { type: 'acquisition', name: 'Acquisition', description: 'New entity discovered' },
      { type: 'onboarding', name: 'Onboarding', description: 'Learning the platform' },
      { type: 'activation', name: 'Activation', description: 'First meaningful action' },
      { type: 'engagement', name: 'Engagement', description: 'Regular platform usage' },
      { type: 'retention', name: 'Retention', description: 'Sustained engagement' },
      { type: 'churn_risk', name: 'Churn Risk', description: 'Declining engagement' },
      { type: 'churned', name: 'Churned', description: 'Complete disengagement' },
      { type: 'reactivation', name: 'Reactivation', description: 'Returning after churn' },
      { type: 'advocacy', name: 'Advocacy', description: 'Promoting the platform' },
      { type: 'dormancy', name: 'Dormancy', description: 'Temporary inactivity' },
    ],
  });
});

/**
 * GET /api/lifecycle/:entityId/history
 * Get lifecycle transition history
 */
app.get('/api/lifecycle/:entityId/history', (req: Request, res: Response) => {
  const { entityId } = req.params;

  res.json({
    success: true,
    entityId,
    history: [],
  });
});

/**
 * GET /api/lifecycle/:entityId/predictions
 * Get lifecycle predictions
 */
app.get('/api/lifecycle/:entityId/predictions', (req: Request, res: Response) => {
  const { entityId } = req.params;

  res.json({
    success: true,
    entityId,
    predictions: [],
  });
});

// ============================================
// PREDICTIONS ENDPOINTS
// ============================================

/**
 * GET /api/predictions/:entityId
 * Get temporal predictions for an entity
 */
app.get('/api/predictions/:entityId', (req: Request, res: Response) => {
  const { entityId } = req.params;
  const { type } = req.query;

  res.json({
    success: true,
    entityId,
    type: type || 'all',
    predictions: [],
  });
});

/**
 * POST /api/predictions/:entityId/refresh
 * Refresh predictions for an entity
 */
app.post('/api/predictions/:entityId/refresh', (req: Request, res: Response) => {
  const { entityId } = req.params;

  res.json({
    success: true,
    entityId,
    refreshed: true,
  });
});

// ============================================
// TEMPORAL FEATURES ENDPOINT
// ============================================

/**
 * POST /api/features
 * Calculate temporal features from events
 */
app.post('/api/features', (req: Request, res: Response) => {
  const { events } = req.body;

  if (!events || !Array.isArray(events)) {
    return res.status(400).json({
      success: false,
      error: 'Events array required',
    });
  }

  const { calculateTemporalFeatures } = require('./types');
  const features = calculateTemporalFeatures(
    events.map((e: unknown) => ({
      ...e as object,
      timestamp: new Date((e as { timestamp: string }).timestamp),
    }))
  );

  res.json({
    success: true,
    features,
  });
});

// ============================================
// STATS & HEALTH
// ============================================

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (_req: Request, res: Response) => {
  const health = getHealthStatus();
  res.json({
    success: true,
    ...health,
  });
});

/**
 * GET /api/stats
 * Get service statistics
 */
app.get('/api/stats', (_req: Request, res: Response) => {
  const stats = getStats();
  res.json({
    success: true,
    ...stats,
  });
});

/**
 * GET /api/stats/patterns
 * Get pattern statistics
 */
app.get('/api/stats/patterns', (_req: Request, res: Response) => {
  res.json({
    success: true,
    byType: {},
    total: 0,
  });
});

/**
 * GET /api/stats/habits
 * Get habit statistics
 */
app.get('/api/stats/habits', (_req: Request, res: Response) => {
  res.json({
    success: true,
    byType: {},
    total: 0,
    avgConfidence: 0,
  });
});

/**
 * GET /api/stats/transitions
 * Get transition statistics
 */
app.get('/api/stats/transitions', (_req: Request, res: Response) => {
  res.json({
    success: true,
    byType: {},
    total: 0,
  });
});

/**
 * GET /api/stats/lifecycle
 * Get lifecycle statistics
 */
app.get('/api/stats/lifecycle', (_req: Request, res: Response) => {
  res.json({
    success: true,
    byStage: {},
    total: 0,
    avgTimeInStage: 0,
  });
});

// ============================================
// ROOT & DOCS
// ============================================

/**
 * GET /
 * Root endpoint with API info
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'REZ Temporal Intelligence',
    version: '1.0.0',
    description: 'Sequence learning, habit detection, behavioral transitions, lifecycle prediction',
    port: PORT,
    endpoints: {
      sequences: [
        'POST /api/sequences - Analyze sequence',
        'GET /api/sequences/:entityId - Get sequences',
        'GET /api/sequences/:entityId/patterns - Get patterns',
      ],
      habits: [
        'POST /api/habits - Detect habits',
        'GET /api/habits/:entityId - Get habits',
        'GET /api/habits/:entityId/:habitId - Get habit details',
        'GET /api/habits/:entityId/:habitId/contexts - Get contexts',
        'GET /api/habits/:entityId/:habitId/streak - Get streak',
      ],
      transitions: [
        'POST /api/transitions - Predict transitions',
        'GET /api/transitions/:entityId - Get transitions',
        'GET /api/transitions/:entityId/:transitionId - Get transition',
        'GET /api/transitions/types - Get transition types',
      ],
      lifecycle: [
        'POST /api/lifecycle - Get lifecycle state',
        'GET /api/lifecycle/:entityId - Get lifecycle (GET)',
        'GET /api/lifecycle/stages - Get all stages',
        'GET /api/lifecycle/:entityId/history - Get history',
        'GET /api/lifecycle/:entityId/predictions - Get predictions',
      ],
      predictions: [
        'GET /api/predictions/:entityId - Get predictions',
        'POST /api/predictions/:entityId/refresh - Refresh predictions',
      ],
      features: [
        'POST /api/features - Calculate temporal features',
      ],
      stats: [
        'GET /api/stats - Get stats',
        'GET /api/stats/patterns - Get pattern stats',
        'GET /api/stats/habits - Get habit stats',
        'GET /api/stats/transitions - Get transition stats',
        'GET /api/stats/lifecycle - Get lifecycle stats',
      ],
      health: [
        'GET /api/health - Health check',
      ],
    },
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  logger.info(`REZ Temporal Intelligence started on port ${PORT}`);
});

export default app;
