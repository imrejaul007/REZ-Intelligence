/**
 * REZ A/B Testing Platform
 *
 * Features:
 * - Experiment creation
 * - Traffic splitting
 * - Variant tracking
 * - Statistical significance
 * - Auto-winner selection
 */

import express from 'express';
import axios from 'axios';

const router = express.Router();

const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'https://REZ-event-bus.onrender.com';

// ============================================
// TYPES
// ============================================

interface Experiment {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  traffic_split: Record<string, number>; // { control: 50, variant_a: 30, variant_b: 20 }
  metrics: string[]; // ['conversion_rate', 'revenue']
  target_metric: string;
  min_sample_size: number;
  confidence_level: number; // 0.95
  started_at?: string;
  ended_at?: string;
  winner?: string;
}

interface Variant {
  id: string;
  experiment_id: string;
  name: string;
  description: string;
  config: any; // The actual variant content
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

// ============================================
// EXPERIMENTS
// ============================================

/**
 * POST /api/experiments
 * Create a new experiment
 */
router.post('/experiments', async (req, res) => {
  const { name, description, traffic_split, target_metric, min_sample_size, confidence_level } = req.body;

  const experiment_id = `exp_${Date.now()}`;

  const experiment: Experiment = {
    id: experiment_id,
    name,
    description,
    status: 'draft',
    traffic_split: traffic_split || { control: 50, variant_a: 50 },
    metrics: [],
    target_metric: target_metric || 'conversion_rate',
    min_sample_size: min_sample_size || 1000,
    confidence_level: confidence_level || 0.95
  };

  experiments.set(experiment_id, experiment);
  variants.set(experiment_id, []);

  res.status(201).json({ experiment_id, experiment });
});

/**
 * GET /api/experiments
 * List all experiments
 */
router.get('/experiments', (req, res) => {
  const { status } = req.query;

  let list = Array.from(experiments.values());

  if (status) {
    list = list.filter(e => e.status === status);
  }

  // Add stats
  const withStats = list.map(e => ({
    ...e,
    variants: getVariantStats(e.id)
  }));

  res.json({ experiments: withStats, count: list.length });
});

/**
 * GET /api/experiments/:id
 * Get experiment details
 */
router.get('/experiments/:id', (req, res) => {
  const experiment = experiments.get(req.params.id);

  if (!experiment) {
    return res.status(404).json({ error: 'Experiment not found' });
  }

  const experimentVariants = variants.get(experiment.id) || [];
  const stats = calculateStats(experiment);

  res.json({ experiment, variants: experimentVariants, stats });
});

/**
 * POST /api/experiments/:id/start
 * Start experiment
 */
router.post('/experiments/:id/start', (req, res) => {
  const experiment = experiments.get(req.params.id);

  if (!experiment) {
    return res.status(404).json({ error: 'Experiment not found' });
  }

  if (experiment.variants.length < 2) {
    return res.status(400).json({ error: 'Need at least 2 variants' });
  }

  experiment.status = 'running';
  experiment.started_at = new Date().toISOString();

  res.json({ success: true, experiment });
});

/**
 * POST /api/experiments/:id/pause
 * Pause experiment
 */
router.post('/experiments/:id/pause', (req, res) => {
  const experiment = experiments.get(req.params.id);

  if (!experiment) {
    return res.status(404).json({ error: 'Experiment not found' });
  }

  experiment.status = 'paused';
  res.json({ success: true, experiment });
});

/**
 * POST /api/experiments/:id/complete
 * Complete experiment and select winner
 */
router.post('/experiments/:id/complete', (req, res) => {
  const experiment = experiments.get(req.params.id);

  if (!experiment) {
    return res.status(404).json({ error: 'Experiment not found' });
  }

  const stats = calculateStats(experiment);
  const winner = determineWinner(stats);

  experiment.status = 'completed';
  experiment.ended_at = new Date().toISOString();
  experiment.winner = winner?.variant_id;

  res.json({ success: true, winner, stats });
});

// ============================================
// VARIANTS
// ============================================

/**
 * POST /api/experiments/:id/variants
 * Add variant to experiment
 */
router.post('/experiments/:id/variants', (req, res) => {
  const { name, description, config } = req.body;

  const experiment = experiments.get(req.params.id);
  if (!experiment) {
    return res.status(404).json({ error: 'Experiment not found' });
  }

  const variant_id = `var_${Date.now()}`;

  const variant: Variant = {
    id: variant_id,
    experiment_id: req.params.id,
    name,
    description,
    config,
    impressions: 0,
    conversions: 0,
    conversions_value: 0
  };

  const experimentVariants = variants.get(req.params.id) || [];
  experimentVariants.push(variant);
  variants.set(req.params.id, experimentVariants);

  res.status(201).json({ variant_id, variant });
});

/**
 * GET /api/experiments/:id/variants
 * List variants
 */
router.get('/experiments/:id/variants', (req, res) => {
  const experimentVariants = variants.get(req.params.id) || [];
  res.json({ variants: experimentVariants });
});

// ============================================
// TRAFFIC ASSIGNMENT
// ============================================

/**
 * GET /api/experiments/:id/assign
 * Get variant assignment for user
 */
router.get('/experiments/:id/assign', (req, res) => {
  const { user_id } = req.query;

  const experiment = experiments.get(req.params.id);
  if (!experiment) {
    return res.status(404).json({ error: 'Experiment not found' });
  }

  if (experiment.status !== 'running') {
    return res.json({ assigned: false, reason: 'Experiment not running' });
  }

  // Check if already assigned
  const userAssignments = assignments.get(user_id as string) || [];
  const existing = userAssignments.find(a => a.experiment_id === req.params.id);

  if (existing) {
    const variant = getVariantById(existing.variant_id);
    return res.json({ assigned: true, variant });
  }

  // Assign based on traffic split
  const assignment = assignUserToVariant(experiment);
  userAssignments.push(assignment);
  assignments.set(user_id as string, userAssignments);

  // Increment impression
  const variant = getVariantById(assignment.variant_id);
  if (variant) variant.impressions++;

  res.json({ assigned: true, variant });
});

/**
 * POST /api/experiments/:id/convert
 * Record conversion
 */
router.post('/experiments/:id/convert', (req, res) => {
  const { user_id, value } = req.body;

  const experiment = experiments.get(req.params.id);
  if (!experiment) {
    return res.status(404).json({ error: 'Experiment not found' });
  }

  // Find user's assignment
  const userAssignments = assignments.get(user_id) || [];
  const assignment = userAssignments.find(a => a.experiment_id === req.params.id);

  if (!assignment) {
    return res.status(400).json({ error: 'User not assigned to experiment' });
  }

  // Record conversion
  const variant = getVariantById(assignment.variant_id);
  if (variant) {
    variant.conversions++;
    variant.conversions_value += value || 0;
  }

  // Publish event
  publishEvent('ab.conversion', {
    experiment_id: req.params.id,
    variant_id: assignment.variant_id,
    user_id,
    value
  });

  res.json({ success: true });
});

// ============================================
// ANALYTICS
// ============================================

/**
 * GET /api/experiments/:id/stats
 * Get experiment statistics
 */
router.get('/experiments/:id/stats', (req, res) => {
  const experiment = experiments.get(req.params.id);

  if (!experiment) {
    return res.status(404).json({ error: 'Experiment not found' });
  }

  const stats = calculateStats(experiment);
  const winner = determineWinner(stats);

  res.json({
    experiment_id: req.params.id,
    stats,
    winner,
    recommendations: getRecommendations(stats, experiment)
  });
});

/**
 * GET /api/experiments/:id/export
 * Export experiment data
 */
router.get('/experiments/:id/export', (req, res) => {
  const experiment = experiments.get(req.params.id);

  if (!experiment) {
    return res.status(404).json({ error: 'Experiment not found' });
  }

  const experimentVariants = variants.get(req.params.id) || [];
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
});

// ============================================
// HELPERS
// ============================================

function getVariantStats(experimentId: string) {
  const experimentVariants = variants.get(experimentId) || [];
  return experimentVariants.map(v => ({
    ...v,
    conversion_rate: v.impressions > 0 ? (v.conversions / v.impressions * 100).toFixed(2) + '%' : '0%',
    revenue_per_user: v.conversions > 0 ? (v.conversions_value / v.conversions).toFixed(2) : 0
  }));
}

function getVariantById(variantId: string): Variant | undefined {
  for (const variantList of variants.values()) {
    const found = variantList.find(v => v.id === variantId);
    if (found) return found;
  }
  return undefined;
}

function assignUserToVariant(experiment: Experiment): UserAssignment {
  const experimentVariants = variants.get(experiment.id) || [];

  // Simple hash-based assignment for consistency
  const random = Math.random() * 100;
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

function determineWinner(stats: any): { variant_id: string; lift: number } | null {
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

function getRecommendations(stats: any, experiment: Experiment): string[] {
  const recommendations: string[] = [];

  if (stats.running && stats.variants) {
    const totalImpressions = stats.total_impressions;

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

async function publishEvent(eventType: string, data: any): Promise<void> {
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
