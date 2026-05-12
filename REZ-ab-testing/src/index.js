/**
 * REZ A/B Testing Service
 *
 * Experiment management and statistical analysis
 * - Create experiments
 * - Assign users to variants
 * - Track conversions
 * - Calculate statistical significance
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');

const app = express();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()]
});

app.use(express.json());

// =============================================================================
// SCHEMAS
// =============================================================================

const experimentSchema = new mongoose.Schema({
  experimentId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: String,
  status: { type: String, enum: ['draft', 'running', 'paused', 'completed'], default: 'draft' },
  hypothesis: String,

  // Variants
  variants: [{
    variantId: { type: String, required: true },
    name: { type: String, required: true }, // e.g., "Control", "Variant A"
    weight: { type: Number, default: 50 }, // Percentage
    config: mongoose.Schema.Types.Mixed // Variant-specific config
  }],

  // Target
  target: {
    metric: { type: String, required: true }, // e.g., "conversion_rate", "revenue"
    goal: String,
    minimumDetectableEffect: Number
  },

  // Audience
  audience: {
    userSegments: [String],
    apps: [String],
    percentage: { type: Number, default: 100 }
  },

  // Stats
  stats: {
    startDate: Date,
    endDate: Date,
    sampleSize: Number,
    confidence: { type: Number, default: 0.95 }
  },

  // Results
  results: {
    control: { conversions: Number, users: Number, rate: Number },
    variants: [{
      variantId: String,
      conversions: Number,
      users: Number,
      rate: Number,
      uplift: Number,
      pValue: Number,
      significant: Boolean
    }]
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Experiment = mongoose.model('Experiment', experimentSchema);

const experimentAssignmentSchema = new mongoose.Schema({
  assignmentId: { type: String, required: true, unique: true },
  experimentId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  variantId: { type: String, required: true },
  assignedAt: { type: Date, default: Date.now },
  converted: { type: Boolean, default: false },
  convertedAt: Date,
  metadata: mongoose.Schema.Types.Mixed
});

const Assignment = mongoose.model('Assignment', experimentAssignmentSchema);

// =============================================================================
// EXPERIMENT MANAGEMENT
// =============================================================================

/**
 * Create experiment
 */
app.post('/api/experiments', async (req, res) => {
  try {
    const experimentId = uuidv4();
    const experiment = new Experiment({
      experimentId,
      ...req.body,
      status: 'draft'
    });

    await experiment.save();
    res.json({ success: true, experimentId, experiment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get experiment
 */
app.get('/api/experiments/:experimentId', async (req, res) => {
  try {
    const experiment = await Experiment.findOne({ experimentId: req.params.experimentId });
    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }
    res.json({ success: true, experiment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * List experiments
 */
app.get('/api/experiments', async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const filter = status ? { status } : {};
    const experiments = await Experiment.find(filter).sort({ createdAt: -1 }).limit(parseInt(limit));
    res.json({ success: true, experiments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Start experiment
 */
app.post('/api/experiments/:experimentId/start', async (req, res) => {
  try {
    const experiment = await Experiment.findOneAndUpdate(
      { experimentId: req.params.experimentId },
      { status: 'running', 'stats.startDate': new Date() },
      { new: true }
    );

    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    logger.info(`Experiment ${experiment.experimentId} started`);
    res.json({ success: true, experiment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Stop experiment
 */
app.post('/api/experiments/:experimentId/stop', async (req, res) => {
  try {
    const experiment = await Experiment.findOneAndUpdate(
      { experimentId: req.params.experimentId },
      { status: 'completed', 'stats.endDate': new Date() },
      { new: true }
    );

    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    // Calculate final results
    await calculateResults(experiment.experimentId);

    logger.info(`Experiment ${experiment.experimentId} stopped`);
    res.json({ success: true, experiment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// USER ASSIGNMENT
// =============================================================================

/**
 * Get variant for user
 */
app.get('/api/experiments/:experimentId/variant', async (req, res) => {
  try {
    const { userId, appId } = req.query;
    const experimentId = req.params.experimentId;

    // Check if already assigned
    let assignment = await Assignment.findOne({ experimentId, userId });

    if (!assignment) {
      // Get experiment
      const experiment = await Experiment.findOne({ experimentId });
      if (!experiment || experiment.status !== 'running') {
        return res.status(404).json({ error: 'Experiment not found or not running' });
      }

      // Check audience rules
      if (!matchesAudience(experiment, appId)) {
        return res.json({ success: true, variantId: null, reason: 'not_in_audience' });
      }

      // Assign variant based on weights
      const variantId = assignVariant(experiment.variants);
      assignment = new Assignment({
        assignmentId: uuidv4(),
        experimentId,
        userId,
        variantId
      });
      await assignment.save();
    }

    res.json({ success: true, variantId: assignment.variantId, assignmentId: assignment.assignmentId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Record conversion
 */
app.post('/api/conversions', async (req, res) => {
  try {
    const { assignmentId, value } = req.body;

    const assignment = await Assignment.findOneAndUpdate(
      { assignmentId },
      { converted: true, convertedAt: new Date(), 'metadata.value': value },
      { new: true }
    );

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Update experiment stats
    await Experiment.updateOne(
      { experimentId: assignment.experimentId },
      { $inc: { 'results.control.conversions': value || 1 } }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get user's experiments
 */
app.get('/api/users/:userId/experiments', async (req, res) => {
  try {
    const assignments = await Assignment.find({ userId: req.params.userId })
      .populate('experimentId', 'name status variants');
    res.json({ success: true, assignments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// STATISTICAL ANALYSIS
// =============================================================================

/**
 * Get experiment results
 */
app.get('/api/experiments/:experimentId/results', async (req, res) => {
  try {
    const experiment = await Experiment.findOne({ experimentId: req.params.experimentId });
    if (!experiment) {
      return res.status(404).json({ error: 'Experiment not found' });
    }

    // Calculate real-time results
    const results = await calculateResults(experiment.experimentId);

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Calculate statistical significance
 */
function calculateSignificance(n1, c1, n2, c2) {
  if (n1 === 0 || n2 === 0) return { pValue: 1, significant: false };

  const p1 = c1 / n1;
  const p2 = c2 / n2;
  const pooledP = (c1 + c2) / (n1 + n2);
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));

  if (se === 0) return { pValue: 1, significant: false };

  const z = (p2 - p1) / se;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return {
    pValue,
    significant: pValue < 0.05,
    uplift: ((p2 - p1) / p1) * 100
  };
}

function normalCDF(x) {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

async function calculateResults(experimentId) {
  const experiment = await Experiment.findOne({ experimentId });
  if (!experiment) return null;

  const control = experiment.variants.find(v => v.name.toLowerCase().includes('control')) || experiment.variants[0];
  const controlStats = await Assignment.aggregate([
    { $match: { experimentId, variantId: control.variantId } },
    { $group: {
      _id: null,
      users: { $sum: 1 },
      conversions: { $sum: { $cond: ['$converted', 1, 0] } }
    }}
  ]);

  const results = {
    control: {
      users: controlStats[0]?.users || 0,
      conversions: controlStats[0]?.conversions || 0,
      rate: controlStats[0]?.users > 0 ? controlStats[0].conversions / controlStats[0].users : 0
    },
    variants: []
  };

  for (const variant of experiment.variants) {
    if (variant.variantId === control.variantId) continue;

    const variantStats = await Assignment.aggregate([
      { $match: { experimentId, variantId: variant.variantId } },
      { $group: {
        _id: null,
        users: { $sum: 1 },
        conversions: { $sum: { $cond: ['$converted', 1, 0] } }
      }}
    ]);

    const users = variantStats[0]?.users || 0;
    const conversions = variantStats[0]?.conversions || 0;
    const rate = users > 0 ? conversions / users : 0;

    const stats = calculateSignificance(
      results.control.users, results.control.conversions,
      users, conversions
    );

    results.variants.push({
      variantId: variant.variantId,
      name: variant.name,
      users,
      conversions,
      rate,
      uplift: stats.uplift,
      pValue: stats.pValue,
      significant: stats.significant
    });
  }

  // Update experiment
  await Experiment.updateOne({ experimentId }, { results });
  return results;
}

// =============================================================================
// HELPERS
// =============================================================================

function matchesAudience(experiment, appId) {
  const { audience } = experiment;

  // Check app filter
  if (audience.apps?.length > 0 && appId && !audience.apps.includes(appId)) {
    return false;
  }

  // Check percentage
  if (audience.percentage < 100) {
    const hash = hashCode(appId || uuidv4());
    if ((hash % 100) > audience.percentage) {
      return false;
    }
  }

  return true;
}

function assignVariant(variants) {
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  const random = Math.random() * totalWeight;

  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.weight;
    if (random < cumulative) {
      return variant.variantId;
    }
  }

  return variants[0].variantId;
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

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
  .catch(err => {
    logger.error('MongoDB connection failed:', err);
    process.exit(1);
  });

module.exports = { app };
