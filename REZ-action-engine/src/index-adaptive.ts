/**
 * REZ Action Engine - ADAPTIVE MODE
 *
 * Uses learned parameters from Feedback Service to make better decisions.
 * Implements 20% baseline/control group for A/B testing learning effectiveness.
 *
 * Flow:
 * Event → Decision (with/without learning) → Feedback → Comparison → Better Decision
 */

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import axios from 'axios';

const app: Application = express();
const PORT = parseInt(process.env.PORT || '4009', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://work_db_user:ZAFYAYH1zK0C74Ap@rez-intent-graph.a8ilqgi.mongodb.net/rez-actions?retryWrites=true&w=majority';
const FEEDBACK_SERVICE_URL = process.env.FEEDBACK_SERVICE_URL || 'http://localhost:4010';

// Safety thresholds for auto-actions
const SAFETY_THRESHOLDS = {
  // SAFE: auto-execute allowed (INCREASED requirements)
  SAFE: {
    minConfidence: 0.95,      // Was 0.9, increased
    minApprovalRate: 0.85,      // Was 0.8, increased
    minTotalDecisions: 30,      // Was 10, increased significantly
  },
  // SEMI_SAFE: suggest only, require approval
  SEMI_SAFE: {
    minConfidence: 0.8,         // Was 0.7, increased
    minTotalDecisions: 15,       // Was 5, increased
  },
  // RISKY: block, require manual review
  RISKY: {
    maxNewItemDecisions: 15,    // Was 5, increased
    maxConfidence: 0.7,          // confidence < 0.7 is risky
  },
  // Value and quantity caps
  maxAutoOrderValue: 5000,  // INR
  capQuantityAt: 50,        // units
} as const;

// Action recommendation types
type ActionRecommendation = 'auto_execute' | 'suggest' | 'block';

// Hybrid mode: Use baseline for decisions, adaptive as suggestions only
const HYBRID_MODE = {
  enabled: true,                    // HYBRID MODE: adaptive = suggestion, baseline = decision
  baselineForDecisions: true,       // Always use baseline values for final decisions
  useAdaptiveOnlyFor: ['suggestion_confidence'],  // Only use adaptive for confidence display
  requireProvenLift: true,         // Only enable auto-execute if lift > +5%
  minimumLiftForAuto: 0.05,         // Need +5% lift for auto-execute
  rollbackIfLiftDropsBelow: -0.05, // Auto-rollback if lift drops below -5%
};

// Rollback guard: Disable adaptive if performance drops
const ROLLBACK_CONFIG = {
  enabled: true,
  checkWindow: 50,              // Check last 50 decisions
  minDecisionsForCheck: 30,       // Need at least 30 decisions
  maxAcceptableDrop: 0.05,       // If approval drops >5%, disable adaptive
  autoDisable: false,             // Set to true to auto-disable (currently monitoring only)
};

// Baseline group constants
const BASELINE_PERCENTAGE = 0.5; // 50% to baseline (more conservative)

// Decision schema
const decisionSchema = new mongoose.Schema({
  correlationId: String,
  eventType: String,
  decision: String,
  confidence: Number,
  actionLevel: String,
  actionRecommendation: String,
  payload: mongoose.Schema.Types.Mixed,
  // Learning info
  usedLearnedParams: { type: Boolean, default: false },
  learnedParams: {
    multiplier: Number,
    bias: Number,
  },
  baseQuantity: Number,
  finalQuantity: Number,
  // Safety cap info
  safetyCapped: { type: Boolean, default: false },
  capReason: String,
  // Baseline tracking (35% control group)
  isBaseline: { type: Boolean, default: false },
  group: { type: String, enum: ['adaptive', 'baseline'], default: 'adaptive' },
  // Outcome tracking (updated via feedback)
  wasApproved: { type: Boolean, default: null },
  // Effective success tracking
  wasEffective: { type: Boolean, default: null }, // approved OR small modification
  modificationDelta: { type: Number, default: null }, // % delta if modified
  createdAt: { type: Date, default: Date.now },
});

const Decision = mongoose.models.Decision || mongoose.model('Decision', decisionSchema, 'decisions');

// Learned params comparison metrics schema (stores adaptive vs baseline comparison)
const learnedParamsComparisonSchema = new mongoose.Schema({
  merchantId: String,
  itemId: String,
  eventType: String,
  // Counts
  adaptiveCount: { type: Number, default: 0 },
  baselineCount: { type: Number, default: 0 },
  // Approval counts
  adaptiveApproved: { type: Number, default: 0 },
  baselineApproved: { type: Number, default: 0 },
  // Calculated rates
  adaptiveApprovalRate: { type: Number, default: 0 },
  baselineApprovalRate: { type: Number, default: 0 },
  // Improvement metrics
  approvalLift: { type: Number, default: 0 }, // % relative improvement
  absoluteLift: { type: Number, default: 0 }, // absolute % difference
  // Statistical significance (simplified)
  sampleSizeSufficient: { type: Boolean, default: false },
  confidenceInterval95: {
    lower: Number,
    upper: Number,
  },
  // Meta
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

// Compound index for efficient lookups
learnedParamsComparisonSchema.index({ merchantId: 1, itemId: 1, eventType: 1 }, { unique: true });

const LearnedParamsComparison = mongoose.models.LearnedParamsComparison ||
  mongoose.model('LearnedParamsComparison', learnedParamsComparisonSchema, 'learned_params_comparison');

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

function log(message: string, meta?: any) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} [ACTION] ${message}`, meta ? JSON.stringify(meta) : '');
}

// Health
app.get('/health', async (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-action-engine',
    mode: 'shadow',
    description: 'Learning disabled - baseline only',
    baselinePercentage: BASELINE_PERCENTAGE * 100 + '%',
    hybridMode: HYBRID_MODE.baselineForDecisions ? 'baseline_for_decisions' : 'adaptive_decisions',
    learningEnabled: false,
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    feedbackService: FEEDBACK_SERVICE_URL,
    timestamp: new Date().toISOString(),
  });
});

app.get('/live', (req: Request, res: Response) => {
  res.json({ alive: true });
});

// Root
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'rez-action-engine',
    version: '1.0.0',
    mode: 'adaptive',
    description: 'Adaptive decision engine with 20% baseline control group for A/B testing',
    endpoints: {
      health: '/health',
      decisions: '/decisions',
      stats: '/stats',
      statsCompare: '/stats/compare',
      adaptive: '/adaptive/:merchantId/:itemId',
      feedback: '/webhook/feedback',
    },
  });
});

// Stats
app.get('/stats', async (req: Request, res: Response) => {
  try {
    const total = await Decision.countDocuments();
    const withLearning = await Decision.countDocuments({ usedLearnedParams: true });
    const byDecision = await Decision.aggregate([
      { $group: { _id: '$decision', count: { $sum: 1 } } }
    ]);

    // Baseline vs adaptive breakdown
    const baselineCount = await Decision.countDocuments({ isBaseline: true });
    const adaptiveCount = await Decision.countDocuments({ isBaseline: false });

    // Outcome stats
    const baselineApproved = await Decision.countDocuments({ isBaseline: true, wasApproved: true });
    const adaptiveApproved = await Decision.countDocuments({ isBaseline: false, wasApproved: true });

    res.json({
      total,
      withLearning,
      withoutLearning: total - withLearning,
      learningAdoptionRate: total > 0 ? ((withLearning / total) * 100).toFixed(1) + '%' : '0%',
      byDecision,
      groupBreakdown: {
        baseline: {
          count: baselineCount,
          approved: baselineApproved,
          approvalRate: baselineCount > 0 ? ((baselineApproved / baselineCount) * 100).toFixed(1) + '%' : '0%',
        },
        adaptive: {
          count: adaptiveCount,
          approved: adaptiveApproved,
          approvalRate: adaptiveCount > 0 ? ((adaptiveApproved / adaptiveCount) * 100).toFixed(1) + '%' : '0%',
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /stats/compare
 * Compare adaptive vs baseline group performance
 */
app.get('/stats/compare', async (req: Request, res: Response) => {
  try {
    const { merchantId, itemId, eventType } = req.query;

    // Build match filter
    const matchFilter: any = {};
    if (merchantId) matchFilter['payload.data.merchant_id'] = merchantId;
    if (itemId) matchFilter['payload.data.item_id'] = itemId;
    if (eventType) matchFilter.eventType = eventType;

    // Aggregate comparison data
    const comparison = await Decision.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$group',
          count: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ['$wasApproved', true] }, 1, 0] },
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$wasApproved', false] }, 1, 0] },
          },
          effective: {
            $sum: { $cond: [{ $eq: ['$wasEffective', true] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ['$wasApproved', null] }, 1, 0] },
          },
        },
      },
    ]);

    // Organize results
    const adaptiveData = comparison.find(c => c._id === 'adaptive') || { count: 0, approved: 0, rejected: 0, effective: 0, pending: 0 };
    const baselineData = comparison.find(c => c._id === 'baseline') || { count: 0, approved: 0, rejected: 0, effective: 0, pending: 0 };

    // Calculate approval rates (only for decisions with outcomes)
    const adaptiveRate = adaptiveData.count > 0 ? (adaptiveData.approved / adaptiveData.count) : 0;
    const baselineRate = baselineData.count > 0 ? (baselineData.approved / baselineData.count) : 0;

    // Calculate effective success rates (approved OR small modification)
    const adaptiveEffectiveRate = adaptiveData.count > 0 ? (adaptiveData.effective / adaptiveData.count) : 0;
    const baselineEffectiveRate = baselineData.count > 0 ? (baselineData.effective / baselineData.count) : 0;

    // Calculate lift (using effective success rate)
    const absoluteLift = adaptiveEffectiveRate - baselineEffectiveRate;
    const relativeLift = baselineEffectiveRate > 0 ? ((adaptiveEffectiveRate - baselineEffectiveRate) / baselineEffectiveRate) * 100 : 0;

    // Determine if sample size is sufficient (30+ per group)
    const sampleSizeSufficient = adaptiveData.count >= 30 && baselineData.count >= 30;

    // Calculate 95% confidence interval (simplified Wilson score)
    const calculateCI = (approved: number, total: number) => {
      if (total === 0) return { lower: 0, upper: 0 };
      const p = approved / total;
      const z = 1.96; // 95% confidence
      const denominator = 1 + z * z / total;
      const center = (p + z * z / (2 * total)) / denominator;
      const margin = (z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total)) / denominator;
      return {
        lower: Math.max(0, center - margin),
        upper: Math.min(1, center + margin),
      };
    };

    const adaptiveCI = calculateCI(adaptiveData.approved, adaptiveData.count);
    const baselineCI = calculateCI(baselineData.approved, baselineData.count);

    // Get per-item comparisons from stored metrics
    const storedComparisons = await LearnedParamsComparison.find({
      ...(merchantId && { merchantId }),
      ...(itemId && { itemId }),
      ...(eventType && { eventType }),
    }).sort({ lastUpdated: -1 }).limit(20);

    res.json({
      summary: {
        adaptive: {
          count: adaptiveData.count,
          approved: adaptiveData.approved,
          rejected: adaptiveData.rejected,
          effective: adaptiveData.effective,
          pending: adaptiveData.pending,
          approvalRate: (adaptiveRate * 100).toFixed(1) + '%',
          effectiveSuccessRate: (adaptiveEffectiveRate * 100).toFixed(1) + '%',
          confidenceInterval: {
            lower: (adaptiveCI.lower * 100).toFixed(1) + '%',
            upper: (adaptiveCI.upper * 100).toFixed(1) + '%',
          },
        },
        baseline: {
          count: baselineData.count,
          approved: baselineData.approved,
          rejected: baselineData.rejected,
          effective: baselineData.effective,
          pending: baselineData.pending,
          approvalRate: (baselineRate * 100).toFixed(1) + '%',
          effectiveSuccessRate: (baselineEffectiveRate * 100).toFixed(1) + '%',
          confidenceInterval: {
            lower: (baselineCI.lower * 100).toFixed(1) + '%',
            upper: (baselineCI.upper * 100).toFixed(1) + '%',
          },
        },
        lift: {
          absolute: (absoluteLift * 100).toFixed(2) + '%',
          relative: relativeLift.toFixed(1) + '%',
          direction: absoluteLift > 0 ? 'positive' : absoluteLift < 0 ? 'negative' : 'neutral',
        },
        statisticalSignificance: {
          sufficient: sampleSizeSufficient,
          message: sampleSizeSufficient
            ? 'Sample size is sufficient for statistical significance'
            : 'Need 30+ decisions per group for statistical significance',
        },
        hybridMode: {
          enabled: HYBRID_MODE.enabled,
          baselineForDecisions: HYBRID_MODE.baselineForDecisions,
          status: absoluteLift > HYBRID_MODE.minimumLiftForAuto ? 'learning_better' :
                  absoluteLift < ROLLBACK_CONFIG.maxAcceptableDrop ? 'ROLLBACK_RECOMMENDED' : 'monitoring',
        },
        rollbackGuard: {
          enabled: ROLLBACK_CONFIG.enabled,
          recommendation: absoluteLift < ROLLBACK_CONFIG.maxAcceptableDrop ? 'DISABLE_ADAPTIVE' : 'monitoring',
          currentLift: (absoluteLift * 100).toFixed(2) + '%',
          threshold: (ROLLBACK_CONFIG.maxAcceptableDrop * 100) + '%',
        },
      },
      storedComparisons,
      filters: { merchantId, itemId, eventType },
    });
  } catch (error: any) {
    log('[COMPARE ERROR]', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Decisions list
app.get('/decisions', async (req: Request, res: Response) => {
  try {
    const decisions = await Decision.find().sort({ createdAt: -1 }).limit(20);
    res.json({ decisions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get learned params from Feedback Service
async function getLearnedParams(merchantId: string, itemId: string): Promise<any> {
  try {
    const response = await axios.get(
      `${FEEDBACK_SERVICE_URL}/learned-params/${merchantId}/${itemId}`,
      { timeout: 3000 }
    );
    return response.data;
  } catch (error: any) {
    log('[LEARNING LOOKUP FAILED]', { merchantId, itemId, error: error.message });
    return { found: false };
  }
}

/**
 * Determine action level and recommendation based on confidence and learned params
 */
function determineActionLevel(
  confidence: number,
  learnedParams: any
): { level: 'SAFE' | 'SEMI_SAFE' | 'RISKY'; recommendation: ActionRecommendation; reason: string } {
  const totalDecisions = learnedParams.found ? learnedParams.params.totalDecisions || 0 : 0;
  const approvalRate = learnedParams.found ? learnedParams.params.approvalRate || 0 : 0;

  // RISKY: Any new item (< 5 decisions) OR confidence < 0.7
  if (totalDecisions < SAFETY_THRESHOLDS.RISKY.maxNewItemDecisions || confidence < SAFETY_THRESHOLDS.RISKY.maxConfidence) {
    const reason = totalDecisions < SAFETY_THRESHOLDS.RISKY.maxNewItemDecisions
      ? `New item: only ${totalDecisions} decision(s), need ${SAFETY_THRESHOLDS.RISKY.maxNewItemDecisions}+ for trust`
      : `Low confidence: ${(confidence * 100).toFixed(0)}%, requires ${(SAFETY_THRESHOLDS.RISKY.maxConfidence * 100).toFixed(0)}%+`;
    return { level: 'RISKY', recommendation: 'block', reason };
  }

  // SAFE: confidence > 0.9 AND approval_rate > 0.8 AND totalDecisions > 10
  if (
    confidence > SAFETY_THRESHOLDS.SAFE.minConfidence &&
    approvalRate > SAFETY_THRESHOLDS.SAFE.minApprovalRate &&
    totalDecisions > SAFETY_THRESHOLDS.SAFE.minTotalDecisions
  ) {
    return {
      level: 'SAFE',
      recommendation: 'auto_execute',
      reason: `Trusted: ${(confidence * 100).toFixed(0)}% confidence, ${(approvalRate * 100).toFixed(0)}% approval, ${totalDecisions} decisions`,
    };
  }

  // SEMI_SAFE: confidence > 0.7 AND totalDecisions > 5
  if (confidence > SAFETY_THRESHOLDS.SEMI_SAFE.minConfidence && totalDecisions > SAFETY_THRESHOLDS.SEMI_SAFE.minTotalDecisions) {
    return {
      level: 'SEMI_SAFE',
      recommendation: 'suggest',
      reason: `Learning: ${(confidence * 100).toFixed(0)}% confidence, ${totalDecisions} decisions, needs more data for auto-execute`,
    };
  }

  // Fallback to RISKY if nothing else matches
  return {
    level: 'RISKY',
    recommendation: 'block',
    reason: `Insufficient data: ${totalDecisions} decisions, ${(confidence * 100).toFixed(0)}% confidence`,
  };
}

/**
 * Apply safety caps to quantity and value
 */
function applySafetyCaps(
  quantity: number,
  unitPrice: number
): { finalQuantity: number; finalValue: number; capped: boolean; capReason?: string } {
  let finalQuantity = quantity;
  let capped = false;
  let capReason: string | undefined;

  // Cap quantity at maximum
  if (finalQuantity > SAFETY_THRESHOLDS.capQuantityAt) {
    finalQuantity = SAFETY_THRESHOLDS.capQuantityAt;
    capped = true;
    capReason = `Quantity capped at ${SAFETY_THRESHOLDS.capQuantityAt} units`;
  }

  const finalValue = finalQuantity * unitPrice;

  // Check value cap (only if unitPrice is available)
  if (unitPrice > 0 && finalValue > SAFETY_THRESHOLDS.maxAutoOrderValue) {
    // Recalculate quantity to stay within value limit
    const maxQtyForValue = Math.floor(SAFETY_THRESHOLDS.maxAutoOrderValue / unitPrice);
    if (maxQtyForValue < finalQuantity) {
      finalQuantity = maxQtyForValue;
      capped = true;
      capReason = `Order value capped at ${SAFETY_THRESHOLDS.maxAutoOrderValue} INR`;
    }
  }

  return { finalQuantity, finalValue, capped, capReason };
}

/**
 * Assign decision to baseline or adaptive group
 * 20% of decisions go to baseline (no learning applied)
 */
function assignBaselineGroup(): { isBaseline: boolean; group: 'adaptive' | 'baseline' } {
  const rand = Math.random();
  const isBaseline = rand < BASELINE_PERCENTAGE;
  return {
    isBaseline,
    group: isBaseline ? 'baseline' : 'adaptive',
  };
}

/**
 * Update comparison metrics for a merchant/item/eventType combination
 */
async function updateComparisonMetrics(
  merchantId: string,
  itemId: string,
  eventType: string
): Promise<void> {
  try {
    // Get counts for each group
    const baselineDecisions = await Decision.find({
      'payload.data.merchant_id': merchantId,
      'payload.data.item_id': itemId,
      eventType,
      group: 'baseline',
      wasApproved: { $ne: null },
    });

    const adaptiveDecisions = await Decision.find({
      'payload.data.merchant_id': merchantId,
      'payload.data.item_id': itemId,
      eventType,
      group: 'adaptive',
      wasApproved: { $ne: null },
    });

    const baselineCount = baselineDecisions.length;
    const adaptiveCount = adaptiveDecisions.length;
    const baselineApproved = baselineDecisions.filter(d => d.wasApproved).length;
    const adaptiveApproved = adaptiveDecisions.filter(d => d.wasApproved).length;

    const baselineRate = baselineCount > 0 ? baselineApproved / baselineCount : 0;
    const adaptiveRate = adaptiveCount > 0 ? adaptiveApproved / adaptiveCount : 0;

    const absoluteLift = adaptiveRate - baselineRate;
    const relativeLift = baselineRate > 0 ? ((adaptiveRate - baselineRate) / baselineRate) * 100 : 0;

    // Calculate 95% CI using Wilson score interval
    const calculateCI = (approved: number, total: number) => {
      if (total === 0) return { lower: 0, upper: 0 };
      const p = approved / total;
      const z = 1.96;
      const denominator = 1 + z * z / total;
      const center = (p + z * z / (2 * total)) / denominator;
      const margin = (z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total)) / denominator;
      return {
        lower: Math.max(0, center - margin),
        upper: Math.min(1, center + margin),
      };
    };

    const adaptiveCI = calculateCI(adaptiveApproved, adaptiveCount);
    const baselineCI = calculateCI(baselineApproved, baselineCount);

    // Upsert comparison metrics
    await LearnedParamsComparison.findOneAndUpdate(
      { merchantId, itemId, eventType },
      {
        $set: {
          adaptiveCount,
          baselineCount,
          adaptiveApproved,
          baselineApproved,
          adaptiveApprovalRate: adaptiveRate,
          baselineApprovalRate: baselineRate,
          approvalLift: relativeLift,
          absoluteLift: absoluteLift,
          sampleSizeSufficient: adaptiveCount >= 30 && baselineCount >= 30,
          confidenceInterval95: {
            lower: adaptiveCI.lower,
            upper: adaptiveCI.upper,
          },
          lastUpdated: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    log('[COMPARISON METRICS UPDATED]', {
      merchantId,
      itemId,
      eventType,
      adaptiveRate: (adaptiveRate * 100).toFixed(1) + '%',
      baselineRate: (baselineRate * 100).toFixed(1) + '%',
      lift: (absoluteLift * 100).toFixed(2) + '%',
    });
  } catch (error: any) {
    log('[COMPARISON UPDATE ERROR]', { error: error.message });
  }
}

// Adaptive event webhook receiver
app.post('/webhook/events', async (req: Request, res: Response) => {
  const event = req.body;
  const eventType = event.event || event.type;

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('[EVENT RECEIVED]', { eventType, correlationId: event.correlation_id });

  try {
    // Get learned params if available
    const merchantId = event.data?.merchant_id || event.data?.merchantId || 'default';
    const itemId = event.data?.item_id || event.data?.itemId || 'default';

    // Assign baseline vs adaptive group (20% baseline)
    const groupAssignment = assignBaselineGroup();

    log('[GROUP ASSIGNMENT]', {
      correlationId: event.correlation_id,
      ...groupAssignment,
    });

    // Only use learning for adaptive group
    const useLearning = !groupAssignment.isBaseline;

    log('[LOOKING UP LEARNED PARAMS]', {
      merchantId,
      itemId,
      useLearning,
      group: groupAssignment.group,
    });

    const learnedParams = useLearning
      ? await getLearnedParams(merchantId, itemId)
      : { found: false, reason: 'Baseline group - learning ignored' };

    // Create decision (baseline ignores learning)
    const decision = createAdaptiveDecision(eventType, event, learnedParams, groupAssignment.isBaseline);

    // Store decision
    const doc = new Decision({
      correlationId: event.correlation_id,
      eventType: eventType,
      decision: decision.type,
      confidence: decision.confidence,
      actionLevel: decision.actionLevel,
      actionRecommendation: decision.actionRecommendation,
      payload: event,
      usedLearnedParams: learnedParams.found,
      learnedParams: learnedParams.found ? {
        multiplier: learnedParams.params.quantityMultiplier,
        bias: learnedParams.params.confidenceBias,
      } : null,
      baseQuantity: decision.baseQuantity,
      finalQuantity: decision.finalQuantity,
      safetyCapped: decision.safety?.capped || false,
      capReason: decision.safety?.capReason || null,
      isBaseline: groupAssignment.isBaseline,
      group: groupAssignment.group,
    });
    await doc.save();

    log('[ADAPTIVE DECISION CREATED]', {
      correlationId: event.correlation_id,
      decision: decision.type,
      confidence: decision.confidence,
      actionLevel: decision.actionLevel,
      actionRecommendation: decision.actionRecommendation,
      safetyCapped: decision.safety?.capped || false,
      usedLearning: learnedParams.found,
      multiplier: learnedParams.found ? learnedParams.params.quantityMultiplier : 'N/A',
      group: groupAssignment.group,
      isBaseline: groupAssignment.isBaseline,
    });
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    res.json({
      success: true,
      decision: decision,
      decisionId: doc._id,
      group: groupAssignment,
      learning: {
        usedLearnedParams: learnedParams.found,
        params: learnedParams.found ? learnedParams.params : null,
      },
    });
  } catch (error: any) {
    log('[DECISION ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Feedback webhook - receive approval/rejection outcomes
 */
app.post('/webhook/feedback', async (req: Request, res: Response) => {
  const { correlationId, approved, merchantId, itemId, eventType, outcome, modificationDelta } = req.body;

  try {
    // Calculate effective success: approved OR small modification (±15%)
    let wasEffective = approved === true;
    if (outcome === 'modified' && modificationDelta !== undefined) {
      wasEffective = Math.abs(modificationDelta) <= 15;
    }

    // Update the decision with the outcome
    let updateResult = await Decision.updateOne(
      { correlationId },
      {
        $set: {
          wasApproved: approved,
          wasEffective: wasEffective,
          modificationDelta: modificationDelta || null
        }
      }
    );

    if (updateResult.matchedCount === 0) {
      // Try to find by searching payload
      const decision = await Decision.findOne({
        'payload.correlation_id': correlationId,
      });

      if (decision) {
        decision.wasApproved = approved;
        decision.wasEffective = wasEffective;
        decision.modificationDelta = modificationDelta || null;
        await decision.save();
        updateResult = { matchedCount: 1, modifiedCount: 1 } as any;
      }
    }

    log('[FEEDBACK RECEIVED]', {
      correlationId,
      approved,
      outcome,
      wasEffective,
      modificationDelta,
    });

    // Update comparison metrics asynchronously
    if (merchantId && itemId && eventType) {
      updateComparisonMetrics(merchantId, itemId, eventType).catch(err => {
        log('[COMPARISON UPDATE FAILED]', { error: err.message });
      });
    }

    res.json({ success: true, updated: updateResult.matchedCount > 0, wasEffective });
  } catch (error: any) {
    log('[FEEDBACK ERROR]', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create adaptive decision based on event type and learned parameters
 * @param isBaseline - if true, use improved baseline calculation with context
 */
function createAdaptiveDecision(eventType: string, event: any, learnedParams: any, isBaseline: boolean = false) {

  // CONTEXT FEATURES - Extract from event data
  const dayOfWeek = new Date().getDay(); // 0=Sunday, 6=Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const hourOfDay = new Date().getHours();
  const isRushHour = hourOfDay >= 11 && hourOfDay <= 14 || hourOfDay >= 18 && hourOfDay <= 21;

  // From event data (if available)
  const recentOrders = event.data?.recent_orders_last_3_days || 0;
  const avgDailySales = event.data?.avg_daily_sales || 5;
  const currentStock = event.data?.current_stock || 3;
  const threshold = event.data?.threshold || 5;
  const itemId = event.data?.item_id || 'unknown';

  // BASE CALCULATION - Context-aware baseline
  // This is the STRONG baseline that should perform well
  const deficit = Math.max(0, threshold - currentStock);
  const safetyBuffer = avgDailySales * 2; // 2 days of average sales as buffer
  const weekendBoost = isWeekend ? 1.3 : 1.0; // 30% more on weekends
  const rushBoost = isRushHour ? 1.15 : 1.0; // 15% more during rush hours

  const baseQuantity = Math.max(
    deficit,
    Math.round(safetyBuffer * weekendBoost * rushBoost)
  );

  const baseConfidence = 0.85; // Higher base confidence with context

  switch (eventType) {
    case 'inventory.low': {
      // LEARNING DISABLED - Using context-aware baseline only
      // Re-enable learning only when proven better than baseline

      // CONTEXT-AWARE QUANTITY (no learning applied)
      const multiplier = 1.0; // No learning
      let suggestedQuantity = Math.round(baseQuantity * multiplier);
      suggestedQuantity = Math.max(1, Math.min(suggestedQuantity, 50));

      // Confidence based on context only
      const confidence = baseConfidence;
      const unitPrice = event.data?.unit_price || event.data?.price || 0;

      // Determine action level
      const { level: actionLevel, recommendation: actionRecommendation } = determineActionLevel(confidence, learnedParams);

      // Apply safety caps
      const { finalQuantity, finalValue, capped, capReason } = applySafetyCaps(suggestedQuantity, unitPrice);

      const reason = 'Context-aware baseline (learning disabled)';

      return {
        type: 'draft_po_suggested',
        confidence: Math.round(confidence * 1000) / 1000,
        actionLevel,
        actionRecommendation,
        reason,
        data: {
          item_id: event.data?.item_id || event.data?.itemId,
          item_name: event.data?.item_name || event.data?.itemName,
          current_stock: currentStock,
          threshold: threshold,
          suggested_quantity: suggestedQuantity,
          base_quantity: baseQuantity,
          multiplier_applied: multiplier,
          unit_price: unitPrice,
          estimated_value: suggestedQuantity * unitPrice,
          final_quantity: finalQuantity,
          final_value: finalValue,
          safety_capped: capped,
          cap_reason: capReason,
          safety_thresholds: {
            max_auto_order_value: SAFETY_THRESHOLDS.maxAutoOrderValue,
            cap_quantity_at: SAFETY_THRESHOLDS.capQuantityAt,
          },
        },
        baseQuantity,
        finalQuantity,
        safety: {
          max_auto_order_value: SAFETY_THRESHOLDS.maxAutoOrderValue,
          cap_quantity_at: SAFETY_THRESHOLDS.capQuantityAt,
          capped,
          capReason,
        },
      };
    }

    case 'order.completed': {
      // Determine action level for order completed
      const { level: actionLevel, recommendation: actionRecommendation, reason: actionReason } = determineActionLevel(0.95, learnedParams);

      return {
        type: 'loyalty_reward',
        confidence: 0.95,
        actionLevel,
        actionRecommendation,
        actionReason,
        reason: 'Order completed, reward points credited',
        data: {
          order_id: event.data?.order_id,
          coins_earned: event.data?.coins_earned || Math.round((event.data?.total_amount || 0) * 0.1),
        },
        baseQuantity: 0,
        finalQuantity: 0,
      };
    }

    case 'payment.success': {
      // Determine action level for payment success
      const { level: actionLevel, recommendation: actionRecommendation, reason: actionReason } = determineActionLevel(0.99, learnedParams);

      return {
        type: 'payment_confirmed',
        confidence: 0.99,
        actionLevel,
        actionRecommendation,
        actionReason,
        reason: 'Payment successful, order can proceed',
        data: {
          transaction_id: event.data?.transaction_id,
          amount: event.data?.amount,
        },
        baseQuantity: 0,
        finalQuantity: 0,
      };
    }

    default:
      return {
        type: 'unknown_event',
        confidence: 0.0,
        actionLevel: 'RISKY',
        actionRecommendation: 'block',
        actionReason: 'Unknown event type, manual review required',
        reason: 'Unknown event type, manual review required',
        data: {},
        baseQuantity: 0,
        finalQuantity: 0,
      };
  }
}

// Get adaptive params for testing
app.get('/adaptive/:merchantId/:itemId', async (req: Request, res: Response) => {
  const { merchantId, itemId } = req.params;
  const learnedParams = await getLearnedParams(merchantId, itemId);

  // Show what decision would look like with/without learning
  const baseQuantity = 10;
  const multiplier = learnedParams.found ? learnedParams.params.quantityMultiplier : 1.0;

  res.json({
    merchantId,
    itemId,
    learned: learnedParams.found,
    params: learnedParams.found ? learnedParams.params : null,
    impact: {
      baseSuggestion: baseQuantity,
      adaptiveSuggestion: Math.round(baseQuantity * multiplier),
      improvement: learnedParams.found
        ? `+${((multiplier - 1) * 100).toFixed(1)}% more accurate`
        : 'No learning data yet',
    },
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Startup
async function start() {
  try {
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('Starting REZ Action Engine (ADAPTIVE MODE)');
    log('Baseline Control Group: ' + (BASELINE_PERCENTAGE * 100) + '%');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    log('MongoDB connected');
    log('Feedback Service:', FEEDBACK_SERVICE_URL);

    app.listen(PORT, () => {
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      log('Action Engine started (Adaptive)', { port: PORT });
      log('Health: http://localhost:' + PORT + '/health');
      log('Stats: http://localhost:' + PORT + '/stats');
      log('Compare: http://localhost:' + PORT + '/stats/compare');
      log('Adaptive: http://localhost:' + PORT + '/adaptive/:merchantId/:itemId');
      log('Feedback: http://localhost:' + PORT + '/webhook/feedback');
      log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

  } catch (error: any) {
    log('[FATAL]', { error: error.message });
    process.exit(1);
  }
}

start();
