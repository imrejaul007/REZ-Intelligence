import 'dotenv/config';
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger.js';
import { asyncHandler, errorHandler } from './errors.js';
import { experimentEngine } from './services/index.js';
import {
  ExperimentStatus,
  IExperiment,
  IAssignment,
  VariantConfig,
  VariantResult,
  ControlResult,
  Results,
  CreateExperimentRequest,
  RecordConversionRequest,
} from './types.js';

// =============================================================================
// SCHEMAS
// =============================================================================

const experimentSchema = new mongoose.Schema({
  experimentId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: String,
  status: {
    type: String,
    enum: Object.values(ExperimentStatus),
    default: ExperimentStatus.DRAFT,
  },
  hypothesis: String,

  // Variants
  variants: [{
    variantId: { type: String, required: true },
    name: { type: String, required: true },
    weight: { type: Number, default: 50 },
    config: mongoose.Schema.Types.Mixed,
  }],

  // Target
  target: {
    metric: { type: String, required: true },
    goal: String,
    minimumDetectableEffect: Number,
  },

  // Audience
  audience: {
    userSegments: [String],
    apps: [String],
    percentage: { type: Number, default: 100 },
  },

  // Stats
  stats: {
    startDate: Date,
    endDate: Date,
    sampleSize: Number,
    confidence: { type: Number, default: 0.95 },
  },

  // Results
  results: {
    control: {
      conversions: Number,
      users: Number,
      rate: Number,
    },
    variants: [{
      variantId: String,
      conversions: Number,
      users: Number,
      rate: Number,
      uplift: Number,
      pValue: Number,
      significant: Boolean,
    }],
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Experiment = mongoose.models.Experiment || mongoose.model<IExperiment>('Experiment', experimentSchema);

const experimentAssignmentSchema = new mongoose.Schema({
  assignmentId: { type: String, required: true, unique: true },
  experimentId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  variantId: { type: String, required: true },
  assignedAt: { type: Date, default: Date.now },
  converted: { type: Boolean, default: false },
  convertedAt: Date,
  metadata: mongoose.Schema.Types.Mixed,
});

const Assignment = mongoose.models.Assignment || mongoose.model<IAssignment>('Assignment', experimentAssignmentSchema);

// =============================================================================
// EXPRESS APP
// =============================================================================

const app = express();

app.use(express.json());

// =============================================================================
// EXPERIMENT MANAGEMENT
// =============================================================================

/**
 * Create experiment
 */
app.post('/api/experiments', asyncHandler(async (req: Request, res: Response) => {
  const experimentId = uuidv4();
  const experiment = new Experiment({
    experimentId,
    ...req.body,
    status: ExperimentStatus.DRAFT,
  });

  await experiment.save();
  res.json({ success: true, experimentId, experiment });
}));

/**
 * Get experiment
 */
app.get('/api/experiments/:experimentId', asyncHandler(async (req: Request, res: Response) => {
  const experiment = await Experiment.findOne({ experimentId: req.params.experimentId });
  if (!experiment) {
    return res.status(404).json({ error: 'Experiment not found' });
  }
  res.json({ success: true, experiment });
}));

/**
 * List experiments
 */
app.get('/api/experiments', asyncHandler(async (req: Request, res: Response) => {
  const { status, limit = '50' } = req.query;
  const filter = status ? { status } : {};
  const experiments = await Experiment.find(filter)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit as string));
  res.json({ success: true, experiments });
}));

/**
 * Start experiment
 */
app.post('/api/experiments/:experimentId/start', asyncHandler(async (req: Request, res: Response) => {
  const experiment = await Experiment.findOneAndUpdate(
    { experimentId: req.params.experimentId },
    { status: ExperimentStatus.RUNNING, 'stats.startDate': new Date() },
    { new: true }
  );

  if (!experiment) {
    return res.status(404).json({ error: 'Experiment not found' });
  }

  logger.info(`Experiment ${experiment.experimentId} started`);
  res.json({ success: true, experiment });
}));

/**
 * Stop experiment
 */
app.post('/api/experiments/:experimentId/stop', asyncHandler(async (req: Request, res: Response) => {
  const experiment = await Experiment.findOneAndUpdate(
    { experimentId: req.params.experimentId },
    { status: ExperimentStatus.COMPLETED, 'stats.endDate': new Date() },
    { new: true }
  );

  if (!experiment) {
    return res.status(404).json({ error: 'Experiment not found' });
  }

  // Calculate final results
  await calculateResults(experiment.experimentId);

  logger.info(`Experiment ${experiment.experimentId} stopped`);
  res.json({ success: true, experiment });
}));

// =============================================================================
// USER ASSIGNMENT
// =============================================================================

/**
 * Get variant for user
 */
app.get('/api/experiments/:experimentId/variant', asyncHandler(async (req: Request, res: Response) => {
  const { userId, appId } = req.query as { userId?: string; appId?: string };
  const experimentId = req.params.experimentId;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Check if already assigned
  let assignment = await Assignment.findOne({ experimentId, userId });

  if (!assignment) {
    // Get experiment
    const experiment = await Experiment.findOne({ experimentId });
    if (!experiment || experiment.status !== ExperimentStatus.RUNNING) {
      return res.status(404).json({ error: 'Experiment not found or not running' });
    }

    // Check audience rules
    if (!experimentEngine.matchesAudience(experiment, appId)) {
      return res.json({ success: true, variantId: null, reason: 'not_in_audience' });
    }

    // Assign variant based on weights
    const variantId = experimentEngine.assignVariant(experiment.variants as VariantConfig[]);
    assignment = new Assignment({
      assignmentId: uuidv4(),
      experimentId,
      userId,
      variantId,
    });
    await assignment.save();
  }

  res.json({
    success: true,
    variantId: assignment.variantId,
    assignmentId: assignment.assignmentId,
  });
}));

/**
 * Record conversion
 */
app.post('/api/conversions', asyncHandler(async (req: Request, res: Response) => {
  const { assignmentId, value } = req.body as RecordConversionRequest;

  const assignment = await Assignment.findOneAndUpdate(
    { assignmentId },
    {
      converted: true,
      convertedAt: new Date(),
      'metadata.value': value,
    },
    { new: true }
  );

  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found' });
  }

  res.json({ success: true });
}));

/**
 * Get user's experiments
 */
app.get('/api/users/:userId/experiments', asyncHandler(async (req: Request, res: Response) => {
  const assignments = await Assignment.find({ userId: req.params.userId })
    .populate('experimentId', 'name status variants');
  res.json({ success: true, assignments });
}));

// =============================================================================
// STATISTICAL ANALYSIS
// =============================================================================

/**
 * Get experiment results
 */
app.get('/api/experiments/:experimentId/results', asyncHandler(async (req: Request, res: Response) => {
  const experiment = await Experiment.findOne({ experimentId: req.params.experimentId });
  if (!experiment) {
    return res.status(404).json({ error: 'Experiment not found' });
  }

  // Calculate real-time results
  const results = await calculateResults(experiment.experimentId);

  res.json({ success: true, results });
}));

/**
 * Calculate results for an experiment
 */
async function calculateResults(experimentId: string): Promise<Results | null> {
  const experiment = await Experiment.findOne({ experimentId });
  if (!experiment) return null;

  const variants = experiment.variants as VariantConfig[];

  // Find control variant (usually has "control" in name or is first)
  const control = variants.find(v => v.name.toLowerCase().includes('control')) || variants[0];
  const controlStats = await Assignment.aggregate([
    { $match: { experimentId, variantId: control.variantId } },
    {
      $group: {
        _id: null,
        users: { $sum: 1 },
        conversions: { $sum: { $cond: ['$converted', 1, 0] } },
      },
    },
  ]);

  const controlResult: ControlResult = {
    users: controlStats[0]?.users || 0,
    conversions: controlStats[0]?.conversions || 0,
    rate: controlStats[0]?.users > 0
      ? controlStats[0].conversions / controlStats[0].users
      : 0,
  };

  const results: Results = {
    control: controlResult,
    variants: [],
  };

  for (const variant of variants) {
    if (variant.variantId === control.variantId) continue;

    const variantStats = await Assignment.aggregate([
      { $match: { experimentId, variantId: variant.variantId } },
      {
        $group: {
          _id: null,
          users: { $sum: 1 },
          conversions: { $sum: { $cond: ['$converted', 1, 0] } },
        },
      },
    ]);

    const users = variantStats[0]?.users || 0;
    const conversions = variantStats[0]?.conversions || 0;
    const rate = users > 0 ? conversions / users : 0;

    const stats = experimentEngine.calculateSignificance(
      results.control.users,
      results.control.conversions,
      users,
      conversions
    );

    const variantResult: VariantResult = {
      variantId: variant.variantId,
      name: variant.name,
      users,
      conversions,
      rate,
      uplift: stats.uplift,
      pValue: stats.pValue,
      significant: stats.significant,
    };

    results.variants.push(variantResult);
  }

  // Update experiment
  await Experiment.updateOne({ experimentId }, { results });
  return results;
}

// =============================================================================
// HEALTH ENDPOINTS
// =============================================================================

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'ab-testing',
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', asyncHandler(async (_req: Request, res: Response) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
}));

app.use(errorHandler);

// =============================================================================
// START
// =============================================================================

const PORT = process.env.PORT || 4110;

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-ab-testing')
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`A/B Testing service running on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error('MongoDB connection failed:', err);
    process.exit(1);
  });

export { app };
