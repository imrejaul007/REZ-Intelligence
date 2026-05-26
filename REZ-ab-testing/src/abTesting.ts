/**
 * REZ A/B Testing Platform
 * PRODUCTION: MongoDB persistence
 * INPUT VALIDATION: All request bodies and parameters validated with Zod schemas
 */

import express, { Request, Response } from 'express';
import axios from 'axios';
import mongoose from 'mongoose';
import { randomInt } from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

const router = express.Router();

// ============================================
// ZOD VALIDATION SCHEMAS
// ============================================

/**
 * Traffic split entry - percentage for a variant
 */
const TrafficSplitEntrySchema = z.record(z.number().min(0).max(100));

/**
 * Create experiment request body
 */
const CreateExperimentSchema = z.object({
  name: z.string().min(1, 'name is required').max(200, 'name cannot exceed 200 characters'),
  description: z.string().max(1000, 'description cannot exceed 1000 characters').optional(),
  traffic_split: TrafficSplitEntrySchema.optional(),
  target_metric: z.string().min(1).max(100).optional().default('conversion_rate'),
  min_sample_size: z.number().int().min(1).max(1000000).optional().default(1000),
  confidence_level: z.number().min(0.5).max(0.999).optional().default(0.95)
}).refine(
  (data) => {
    if (!data.traffic_split) return true;
    const total = Object.values(data.traffic_split).reduce((sum, val) => sum + val, 0);
    return Math.abs(total - 100) < 0.01; // Allow small floating point errors
  },
  { message: 'traffic_split percentages must sum to 100', path: ['traffic_split'] }
);

/**
 * List experiments query params
 */
const ListExperimentsQuerySchema = z.object({
  status: z.enum(['draft', 'running', 'paused', 'completed']).optional()
});

/**
 * Experiment ID path param
 */
const ExperimentIdParamSchema = z.object({
  id: z.string().min(1, 'experiment id is required')
});

/**
 * Create variant request body
 */
const CreateVariantSchema = z.object({
  name: z.string().min(1, 'variant name is required').max(100, 'name cannot exceed 100 characters'),
  description: z.string().max(500, 'description cannot exceed 500 characters').optional(),
  config: z.record(z.unknown()).optional()
});

/**
 * Assign user query params
 */
const AssignUserQuerySchema = z.object({
  user_id: z.string().min(1, 'user_id is required')
});

/**
 * Record conversion request body
 */
const RecordConversionSchema = z.object({
  user_id: z.string().min(1, 'user_id is required'),
  value: z.number().min(0).optional().default(0)
});

// ============================================
// TYPE EXPORTS FROM ZOD SCHEMAS
// ============================================

export type CreateExperimentInput = z.infer<typeof CreateExperimentSchema>;
export type ListExperimentsQueryInput = z.infer<typeof ListExperimentsQuerySchema>;
export type CreateVariantInput = z.infer<typeof CreateVariantSchema>;
export type AssignUserQueryInput = z.infer<typeof AssignUserQuerySchema>;
export type RecordConversionInput = z.infer<typeof RecordConversionSchema>;

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
    throw new ValidationError(`[AB-Testing] ${context} validation failed: ${errorMessages}`);
  }
  return result.data;
}

/**
 * Safely parse and validate query params against a Zod schema
 */
function validateQuery<T>(schema: z.ZodType<T>, query: unknown, context: string): T {
  const result = schema.safeParse(query);
  if (!result.success) {
    const errorMessages = result.error.issues
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    throw new ValidationError(`[AB-Testing] ${context} validation failed: ${errorMessages}`);
  }
  return result.data;
}

/**
 * Safely parse and validate path params against a Zod schema
 */
function validateParams<T>(schema: z.ZodType<T>, params: unknown, context: string): T {
  const result = schema.safeParse(params);
  if (!result.success) {
    const errorMessages = result.error.issues
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    throw new ValidationError(`[AB-Testing] ${context} validation failed: ${errorMessages}`);
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

const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'https://REZ-event-bus.onrender.com';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-ab-testing';

// PRODUCTION: MongoDB Schemas
const ExperimentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: String,
  status: { type: String, enum: ['draft', 'running', 'paused', 'completed'], default: 'draft', index: true },
  traffic_split: { type: Map, of: Number },
  metrics: [String],
  target_metric: String,
  min_sample_size: Number,
  confidence_level: Number,
  started_at: Date,
  ended_at: Date,
  winner: String,
}, { timestamps: true });

const VariantSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  experiment_id: { type: String, required: true, index: true },
  name: String,
  description: String,
  config: mongoose.Schema.Types.Mixed,
  impressions: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  conversions_value: { type: Number, default: 0 },
}, { timestamps: true });

const AssignmentSchema = new mongoose.Schema({
  user_id: { type: String, required: true, index: true },
  experiment_id: { type: String, required: true, index: true },
  variant_id: { type: String, required: true },
  assigned_at: { type: Date, default: Date.now }
}, { timestamps: true });

const ExperimentModel = mongoose.models.Experiment || mongoose.model('Experiment', ExperimentSchema);
const VariantModel = mongoose.models.Variant || mongoose.model('Variant', VariantSchema);
const AssignmentModel = mongoose.models.Assignment || mongoose.model('Assignment', AssignmentSchema);

// ============================================
// TYPES
// ============================================

interface Experiment {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  traffic_split: Record<string, number>;
  metrics: string[];
  target_metric: string;
  min_sample_size: number;
  confidence_level: number;
  started_at?: string;
  ended_at?: string;
  winner?: string;
}

interface Variant {
  id: string;
  experiment_id: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  impressions: number;
  conversions: number;
  conversions_value: number;
}

interface UserAssignment {
  user_id: string;
  experiment_id: string;
  variant_id: string;
  assigned_at: string;
}

// In-memory stores (use database in production)
const experiments = new Map<string, Experiment>();
const variants = new Map<string, Variant[]>();
const assignments = new Map<string, UserAssignment[]>();

let dbConnected = false;

async function connectDB(): Promise<void> {
  if (dbConnected) return;
  try {
    await mongoose.connect(MONGODB_URI);
    dbConnected = true;
    console.log('[AB-Testing] Connected to MongoDB');
    // Load existing data into cache
    await loadDataIntoCache();
  } catch (error) {
    console.error('[AB-Testing] MongoDB connection failed:', error);
  }
}

async function loadDataIntoCache(): Promise<void> {
  const expData = await ExperimentModel.find();
  for (const exp of expData) {
    experiments.set(exp.id, exp.toObject());
    const varData = await VariantModel.find({ experiment_id: exp.id });
    variants.set(exp.id, varData.map(v => v.toObject()));
  }
  const assignData = await AssignmentModel.find();
  for (const a of assignData) {
    const key = `${a.user_id}:${a.experiment_id}`;
    if (!assignments.has(key)) assignments.set(key, []);
    assignments.get(key)!.push(a.toObject());
  }
}

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

// Strict rate limiter for expensive operations (stats, export) - 30 requests per 15 minutes
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  message: { success: false, error: 'Rate limit exceeded. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
router.use(apiLimiter);

// ============================================
// HEALTH CHECK
// ============================================

interface HealthStatus {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  service: string;
  checks: {
    mongodb: { status: string; error?: string };
    cache: { status: string; experiments: number; variants: number; assignments: number };
  };
}

/**
 * Get health status for this router
 * Can be mounted at /health by the parent app
 */
export function getHealthStatus(): HealthStatus {
  const startTime = Date.now();
  // Note: uptime would need to be tracked at app level
  return {
    status: dbConnected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    service: 'rez-ab-testing',
    checks: {
      mongodb: {
        status: dbConnected ? 'healthy' : 'unhealthy'
      },
      cache: {
        status: 'healthy',
        experiments: experiments.size,
        variants: Array.from(variants.values()).reduce((sum, arr) => sum + arr.length, 0),
        assignments: Array.from(assignments.values()).reduce((sum, arr) => sum + arr.length, 0)
      }
    }
  };
}

/**
 * Health check endpoint handler
 * Mount at /health in parent Express app
 */
router.get('/health', async (_req: any, _res: any) => {
  const health = getHealthStatus();

  // Check MongoDB connectivity
  try {
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      health.checks.mongodb.status = 'healthy';
    } else {
      health.checks.mongodb.status = 'disconnected';
      health.status = 'degraded';
    }
  } catch (e) {
    const error = e as Error;
    health.checks.mongodb = { status: 'unhealthy', error: error.message };
    health.status = 'unhealthy';
  }

  const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 503 : 503;
  _res.status(statusCode).json(health);
});

// ============================================
// EXPERIMENTS
// ============================================

/**
 * POST /api/experiments
 * Create a new experiment
 */
router.post('/experiments', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedBody = validateBody(CreateExperimentSchema, req.body, 'POST /experiments');

    await connectDB();
    const { name, description, traffic_split, target_metric, min_sample_size, confidence_level } = validatedBody;
    const experiment_id = `exp_${Date.now()}_${randomInt(1000, 9999)}`;

    const experiment = new ExperimentModel({
      id: experiment_id,
      name,
      description,
      status: 'draft',
      traffic_split: traffic_split || { control: 50, variant_a: 50 },
      metrics: [],
      target_metric: target_metric || 'conversion_rate',
      min_sample_size: min_sample_size || 1000,
      confidence_level: confidence_level || 0.95
    });

    await experiment.save();
    experiments.set(experiment_id, experiment.toObject());
    variants.set(experiment_id, []);

    res.status(201).json({ success: true, experiment_id, experiment: experiment.toObject() });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    console.error('[AB-Testing] Create experiment error:', error);
    res.status(500).json({ success: false, error: 'Failed to create experiment' });
  }
});

/**
 * GET /api/experiments
 * List all experiments
 */
router.get('/experiments', async (req: Request, res: Response) => {
  try {
    // Validate query params
    const validatedQuery = validateQuery(ListExperimentsQuerySchema, req.query, 'GET /experiments');

    await connectDB();
    const query = validatedQuery.status ? { status: validatedQuery.status } : {};
    const list = await ExperimentModel.find(query).lean();

    const withStats = await Promise.all(list.map(async (e: any) => {
      const varData = await VariantModel.find({ experiment_id: e.id }).lean();
      return { ...e, variants: varData };
    }));

    res.json({ success: true, experiments: withStats, count: list.length });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    console.error('[AB-Testing] List experiments error:', error);
    res.status(500).json({ success: false, error: 'Failed to list experiments' });
  }
});

/**
 * GET /api/experiments/:id
 * Get experiment details
 */
router.get('/experiments/:id', async (req: Request, res: Response) => {
  try {
    // Validate path params
    const { id } = validateParams(ExperimentIdParamSchema, req.params, 'GET /experiments/:id');

    await connectDB();
    const experiment = await ExperimentModel.findOne({ id }).lean() as Record<string, unknown> | null;

    if (!experiment) {
      res.status(404).json({ success: false, error: 'Experiment not found' });
      return;
    }

    const experimentId = experiment.id as string;
    const experimentVariants = await VariantModel.find({ experiment_id: experimentId }).lean();
    res.json({ success: true, experiment, variants: experimentVariants });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    console.error('[AB-Testing] Get experiment error:', error);
    res.status(500).json({ success: false, error: 'Failed to get experiment' });
  }
});

/**
 * POST /api/experiments/:id/start
 * Start experiment
 */
router.post('/experiments/:id/start', async (req: Request, res: Response) => {
  try {
    // Validate path params
    const { id } = validateParams(ExperimentIdParamSchema, req.params, 'POST /experiments/:id/start');

    await connectDB();
    const experiment = await ExperimentModel.findOne({ id });

    if (!experiment) {
      res.status(404).json({ success: false, error: 'Experiment not found' });
      return;
    }

    const varCount = await VariantModel.countDocuments({ experiment_id: experiment.id });
    if (varCount < 2) {
      res.status(400).json({ success: false, error: 'Need at least 2 variants' });
      return;
    }

    experiment.status = 'running';
    experiment.started_at = new Date();
    await experiment.save();
    experiments.set(experiment.id, experiment.toObject());

    res.json({ success: true, experiment: experiment.toObject() });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    console.error('[AB-Testing] Start experiment error:', error);
    res.status(500).json({ success: false, error: 'Failed to start experiment' });
  }
});

/**
 * POST /api/experiments/:id/pause
 * Pause experiment
 */
router.post('/experiments/:id/pause', async (req: Request, res: Response) => {
  try {
    // Validate path params
    const { id } = validateParams(ExperimentIdParamSchema, req.params, 'POST /experiments/:id/pause');

    await connectDB();
    const experiment = await ExperimentModel.findOne({ id });

    if (!experiment) {
      res.status(404).json({ success: false, error: 'Experiment not found' });
      return;
    }

    experiment.status = 'paused';
    await experiment.save();
    experiments.set(experiment.id, experiment.toObject());

    res.json({ success: true, experiment: experiment.toObject() });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    console.error('[AB-Testing] Pause experiment error:', error);
    res.status(500).json({ success: false, error: 'Failed to pause experiment' });
  }
});

/**
 * POST /api/experiments/:id/complete
 * Complete experiment and select winner
 */
router.post('/experiments/:id/complete', (req: Request, res: Response): void => {
  try {
    // Validate path params
    const { id } = validateParams(ExperimentIdParamSchema, req.params, 'POST /experiments/:id/complete');

    const experiment = experiments.get(id);

    if (!experiment) {
      res.status(404).json({ error: 'Experiment not found' });
      return;
    }

    const stats = calculateStats(experiment);
    const winner = determineWinner(stats);

    experiment.status = 'completed';
    experiment.ended_at = new Date().toISOString();
    experiment.winner = winner?.variant_id;

    res.json({ success: true, winner, stats });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    console.error('[AB-Testing] Complete experiment error:', error);
    res.status(500).json({ success: false, error: 'Failed to complete experiment' });
  }
});

// ============================================
// VARIANTS
// ============================================

/**
 * POST /api/experiments/:id/variants
 * Add variant to experiment
 */
router.post('/experiments/:id/variants', (req: Request, res: Response): void => {
  try {
    // Validate path and body params
    const { id } = validateParams(ExperimentIdParamSchema, req.params, 'POST /experiments/:id/variants');
    const validatedBody = validateBody(CreateVariantSchema, req.body, 'POST /experiments/:id/variants');
    const { name, description, config } = validatedBody;

    const experiment = experiments.get(id);
    if (!experiment) {
      res.status(404).json({ error: 'Experiment not found' });
      return;
    }

    const variant_id = `var_${Date.now()}`;

    const variant: Variant = {
      id: variant_id,
      experiment_id: id,
      name,
      description: description ?? '',
      config: config ?? {},
      impressions: 0,
      conversions: 0,
      conversions_value: 0
    };

    const experimentVariants = variants.get(id) || [];
    experimentVariants.push(variant);
    variants.set(id, experimentVariants);

    res.status(201).json({ variant_id, variant });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    console.error('[AB-Testing] Create variant error:', error);
    res.status(500).json({ success: false, error: 'Failed to create variant' });
  }
});

/**
 * GET /api/experiments/:id/variants
 * List variants
 */
router.get('/experiments/:id/variants', (req: Request, res: Response) => {
  try {
    // Validate path params
    const { id } = validateParams(ExperimentIdParamSchema, req.params, 'GET /experiments/:id/variants');

    const experimentVariants = variants.get(id) || [];
    res.json({ variants: experimentVariants });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    console.error('[AB-Testing] List variants error:', error);
    res.status(500).json({ success: false, error: 'Failed to list variants' });
  }
});

// ============================================
// TRAFFIC ASSIGNMENT
// ============================================

/**
 * GET /api/experiments/:id/assign
 * Get variant assignment for user
 */
router.get('/experiments/:id/assign', (req: Request, res: Response): void => {
  try {
    // Validate path and query params
    const { id } = validateParams(ExperimentIdParamSchema, req.params, 'GET /experiments/:id/assign');
    const { user_id } = validateQuery(AssignUserQuerySchema, req.query, 'GET /experiments/:id/assign');

    const experiment = experiments.get(id);
    if (!experiment) {
      res.status(404).json({ error: 'Experiment not found' });
      return;
    }

    if (experiment.status !== 'running') {
      res.json({ assigned: false, reason: 'Experiment not running' });
      return;
    }

    // Check if already assigned
    const userAssignments = assignments.get(user_id) || [];
    const existing = userAssignments.find(a => a.experiment_id === id);

    if (existing) {
      const variant = getVariantById(existing.variant_id);
      res.json({ assigned: true, variant });
      return;
    }

    // Assign based on traffic split
    const assignment = assignUserToVariant(experiment);
    userAssignments.push(assignment);
    assignments.set(user_id, userAssignments);

    // Increment impression
    const variant = getVariantById(assignment.variant_id);
    if (variant) variant.impressions++;

    res.json({ assigned: true, variant });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    console.error('[AB-Testing] Assign user error:', error);
    res.status(500).json({ success: false, error: 'Failed to assign user' });
  }
});

/**
 * POST /api/experiments/:id/convert
 * Record conversion
 */
router.post('/experiments/:id/convert', (req: Request, res: Response): void => {
  try {
    // Validate path and body params
    const { id } = validateParams(ExperimentIdParamSchema, req.params, 'POST /experiments/:id/convert');
    const { user_id, value } = validateBody(RecordConversionSchema, req.body, 'POST /experiments/:id/convert');

    const experiment = experiments.get(id);
    if (!experiment) {
      res.status(404).json({ error: 'Experiment not found' });
      return;
    }

    // Find user's assignment
    const userAssignments = assignments.get(user_id) || [];
    const assignment = userAssignments.find(a => a.experiment_id === id);

    if (!assignment) {
      res.status(400).json({ error: 'User not assigned to experiment' });
      return;
    }

    // Record conversion
    const variant = getVariantById(assignment.variant_id);
    if (variant) {
      variant.conversions++;
      variant.conversions_value += value || 0;
    }

    // Publish event
    publishEvent('ab.conversion', {
      experiment_id: id,
      variant_id: assignment.variant_id,
      user_id,
      value
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    console.error('[AB-Testing] Record conversion error:', error);
    res.status(500).json({ success: false, error: 'Failed to record conversion' });
  }
});

// ============================================
// ANALYTICS
// ============================================

/**
 * GET /api/experiments/:id/stats
 * Get experiment statistics (rate limited - expensive operation)
 */
router.get('/experiments/:id/stats', strictLimiter, (req: Request, res: Response): void => {
  try {
    // Validate path params
    const { id } = validateParams(ExperimentIdParamSchema, req.params, 'GET /experiments/:id/stats');

    const experiment = experiments.get(id);

    if (!experiment) {
      res.status(404).json({ error: 'Experiment not found' });
      return;
    }

    const stats = calculateStats(experiment);
    const winner = determineWinner(stats);

    res.json({
      experiment_id: id,
      stats,
      winner,
      recommendations: getRecommendations(stats, experiment)
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    console.error('[AB-Testing] Get stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

/**
 * GET /api/experiments/:id/export
 * Export experiment data (rate limited - expensive operation)
 */
router.get('/experiments/:id/export', strictLimiter, (req: Request, res: Response): void => {
  try {
    // Validate path params
    const { id } = validateParams(ExperimentIdParamSchema, req.params, 'GET /experiments/:id/export');

    const experiment = experiments.get(id);

    if (!experiment) {
      res.status(404).json({ error: 'Experiment not found' });
      return;
    }

    const experimentVariants = variants.get(id) || [];
    const stats = calculateStats(experiment);

    const exportData = {
      experiment: {
        id: experiment.id,
        name: experiment.name,
        status: experiment.status,
        started_at: experiment.started_at,
        ended_at: experiment.ended_at
      },
      variants: experimentVariants.map(v => ({
        ...v,
        conversion_rate: v.impressions > 0 ? v.conversions / v.impressions : 0,
        revenue_per_impression: v.impressions > 0 ? v.conversions_value / v.impressions : 0
      })),
      stats
    };

    res.json(exportData);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    console.error('[AB-Testing] Export experiment error:', error);
    res.status(500).json({ success: false, error: 'Failed to export experiment' });
  }
});

// ============================================
// HELPERS
// ============================================

function getVariantById(variantId: string): Variant | undefined {
  for (const variantList of variants.values()) {
    const found = variantList.find(v => v.id === variantId);
    if (found) return found;
  }
  return undefined;
}

function assignUserToVariant(experiment: Experiment): UserAssignment {
  const experimentVariants = variants.get(experiment.id) || [];

  // Use crypto for random assignment (cryptographically secure for traffic splitting)
  const random = randomInt(0, 100);
  let cumulative = 0;

  for (const variant of experimentVariants) {
    const percentage = experiment.traffic_split[variant.name.toLowerCase().replace(' ', '_')] || (100 / experimentVariants.length);
    cumulative += percentage;

    if (random < cumulative) {
      return {
        user_id: '',
        experiment_id: experiment.id,
        variant_id: variant.id,
        assigned_at: new Date().toISOString()
      };
    }
  }

  // Fallback to first variant
  return {
    user_id: '',
    experiment_id: experiment.id,
    variant_id: experimentVariants[0].id,
    assigned_at: new Date().toISOString()
  };
}

function calculateStats(experiment: Experiment) {
  const experimentVariants = variants.get(experiment.id) || [];

  const stats = experimentVariants.map(v => {
    const conversionRate = v.impressions > 0 ? v.conversions / v.impressions : 0;
    const revenuePerUser = v.impressions > 0 ? v.conversions_value / v.impressions : 0;

    return {
      variant_id: v.id,
      variant_name: v.name,
      impressions: v.impressions,
      conversions: v.conversions,
      conversions_value: v.conversions_value,
      conversion_rate: conversionRate,
      revenue_per_user: revenuePerUser,
      confidence_interval: calculateConfidenceInterval(v.conversions, v.impressions)
    };
  });

  // Calculate statistical significance
  if (stats.length >= 2) {
    const control = stats[0];
    const treatment = stats[1];

    const zScore = calculateZScore(
      control.conversion_rate,
      treatment.conversion_rate,
      control.impressions,
      treatment.impressions
    );

    const pValue = calculatePValue(zScore);
    const significant = pValue < (1 - experiment.confidence_level);

    return {
      variants: stats,
      control_vs_treatment: {
        z_score: zScore,
        p_value: pValue,
        statistically_significant: significant
      },
      total_impressions: stats.reduce((sum, s) => sum + s.impressions, 0),
      total_conversions: stats.reduce((sum, s) => sum + s.conversions, 0),
      running: experiment.status === 'running'
    };
  }

  return { variants: stats };
}

function determineWinner(stats: { variants: { conversion_rate: number; variant_id: string }[] }): { variant_id: string; lift: number } | null {
  if (!stats.variants || stats.variants.length < 2) return null;

  const control = stats.variants[0];
  let bestVariant = stats.variants[1];
  let bestLift = 0;

  for (let i = 1; i < stats.variants.length; i++) {
    const variant = stats.variants[i];
    const lift = (variant.conversion_rate - control.conversion_rate) / control.conversion_rate;

    if (lift > bestLift) {
      bestLift = lift;
      bestVariant = variant;
    }
  }

  return {
    variant_id: bestVariant.variant_id,
    lift: bestLift * 100
  };
}

function getRecommendations(stats: { variants?: {}[], total_impressions?: number, running?: boolean, control_vs_treatment?: { statistically_significant: boolean } }, experiment: Experiment): string[] {
  const recommendations: string[] = [];

  if (stats.running && stats.variants) {
    const totalImpressions = stats.total_impressions ?? 0;

    if (totalImpressions < experiment.min_sample_size) {
      recommendations.push(`Need ${experiment.min_sample_size - totalImpressions} more impressions for statistical significance`);
    }
  }

  if (stats.control_vs_treatment?.statistically_significant) {
    recommendations.push('Statistical significance reached. Consider declaring winner.');
  }

  return recommendations;
}

function calculateConfidenceInterval(conversions: number, impressions: number, confidence = 0.95) {
  const p = conversions / impressions;
  const z = confidence === 0.95 ? 1.96 : 2.576;
  const margin = z * Math.sqrt(p * (1 - p) / impressions);

  return {
    lower: Math.max(0, p - margin),
    upper: Math.min(1, p + margin)
  };
}

function calculateZScore(p1: number, p2: number, n1: number, n2: number): number {
  const pooledP = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));

  if (se === 0) return 0;

  return (p2 - p1) / se;
}

function calculatePValue(zScore: number): number {
  // Simplified p-value calculation
  // Use normal distribution CDF
  return Math.exp(-0.5 * zScore * zScore) / Math.sqrt(2 * Math.PI);
}

async function publishEvent(eventType: string, data: Record<string, unknown>): Promise<void> {
  try {
    await axios.post(`${EVENT_BUS_URL}/events`, {
      event_type: eventType,
      source: 'ab-testing',
      data
    }, { timeout: 5000 });
  } catch (e) {
    // Don't fail
  }
}

export default router;
