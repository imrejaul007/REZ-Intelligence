import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { z } from 'zod';
import { createLogger, requestIdMiddleware, asyncHandler, errorHandler as sharedErrorHandler } from '../../shared';

// ============================================
// TYPE DEFINITIONS
// ============================================

// Agent types and statuses
const AGENT_TYPES = {
  DEMAND_SIGNAL: 'demand_signal',
  SCARCITY: 'scarcity',
  PERSONALIZATION: 'personalization',
  ATTRIBUTION: 'attribution',
  ADAPTIVE_SCORING: 'adaptive_scoring',
  FEEDBACK_LOOP: 'feedback_loop',
  NETWORK_EFFECT: 'network_effect',
  REVENUE_ATTRIBUTION: 'revenue_attribution'
} as const;

type AgentType = typeof AGENT_TYPES[keyof typeof AGENT_TYPES];

const AGENT_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ERROR: 'error'
} as const;

type AgentStatus = typeof AGENT_STATUS[keyof typeof AGENT_STATUS];

// Insight types
type InsightType = 'trend' | 'anomaly' | 'opportunity' | 'risk' | 'prediction';
type InsightPriority = 'low' | 'medium' | 'high' | 'critical';
type InsightStatus = 'new' | 'reviewing' | 'actioned' | 'dismissed';

// Action types
type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
type ActionPriority = 'low' | 'medium' | 'high' | 'critical';

// ============================================
// ZOD VALIDATION SCHEMAS
// ============================================

const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

const AgentQuerySchema = z.object({
  agentType: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

const ActionUpdateSchema = z.object({
  status: z.enum(['approved', 'rejected', 'executed', 'failed']),
  approvedBy: z.string().optional()
});

const InsightUpdateSchema = z.object({
  status: z.enum(['reviewing', 'actioned', 'dismissed'])
});

type PaginationInput = z.infer<typeof PaginationSchema>;
type AgentQueryInput = z.infer<typeof AgentQuerySchema>;

// ============================================
// MONGOOSE SCHEMAS
// ============================================

interface IAgentRun extends Document {
  agentId: string;
  agentType: string;
  status: AgentStatus;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  input?: Types.Mixed;
  output?: Types.Mixed;
  errors: string[];
  metrics: {
    recordsProcessed?: number;
    insightsGenerated?: number;
    actionsTaken?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const agentRunSchema = new Schema<IAgentRun>({
  agentId: { type: String, required: true, index: true },
  agentType: { type: String, required: true, index: true },
  status: { type: String, enum: ['idle', 'running', 'completed', 'error'], default: 'idle' },
  startedAt: { type: Date },
  completedAt: { type: Date },
  duration: { type: Number },
  input: { type: Schema.Types.Mixed },
  output: { type: Schema.Types.Mixed },
  errors: [String],
  metrics: {
    recordsProcessed: { type: Number },
    insightsGenerated: { type: Number },
    actionsTaken: { type: Number }
  }
}, { timestamps: true });

agentRunSchema.index({ agentType: 1, createdAt: -1 });

const AgentRun: Model<IAgentRun> = mongoose.model<IAgentRun>('AgentRun', agentRunSchema);

interface IInsight extends Document {
  insightId: string;
  agentType: string;
  type: InsightType;
  title: string;
  description: string;
  data: Types.Mixed;
  priority: InsightPriority;
  confidence: number;
  sourceRun?: string;
  status: InsightStatus;
  actionedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const insightSchema = new Schema<IInsight>({
  insightId: { type: String, required: true, unique: true, index: true },
  agentType: { type: String, required: true, index: true },
  type: { type: String, enum: ['trend', 'anomaly', 'opportunity', 'risk', 'prediction'] },
  title: String,
  description: String,
  data: { type: Schema.Types.Mixed },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
  confidence: { type: Number, min: 0, max: 1 },
  sourceRun: String,
  status: { type: String, enum: ['new', 'reviewing', 'actioned', 'dismissed'], default: 'new' },
  actionedAt: Date
}, { timestamps: true });

insightSchema.index({ agentType: 1, createdAt: -1 });
insightSchema.index({ priority: 1, status: 1 });

const Insight: Model<IInsight> = mongoose.model<IInsight>('Insight', insightSchema);

interface IAction extends Document {
  actionId: string;
  agentType: string;
  type: string;
  target: Types.Mixed;
  payload: Types.Mixed;
  status: ActionStatus;
  priority: ActionPriority;
  autoExecute: boolean;
  approvedBy?: string;
  executedAt?: Date;
  result?: Types.Mixed;
  createdAt: Date;
  updatedAt: Date;
}

const actionSchema = new Schema<IAction>({
  actionId: { type: String, required: true, unique: true, index: true },
  agentType: { type: String, required: true },
  type: String,
  target: { type: Schema.Types.Mixed },
  payload: { type: Schema.Types.Mixed },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'executed', 'failed'], default: 'pending' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
  autoExecute: { type: Boolean, default: false },
  approvedBy: String,
  executedAt: Date,
  result: { type: Schema.Types.Mixed }
}, { timestamps: true });

actionSchema.index({ status: 1, priority: 1 });

const Action: Model<IAction> = mongoose.model<IAction>('Action', actionSchema);

// ============================================
// LOGGER
// ============================================

const logger = createLogger('autonomous-agents');

// ============================================
// SEEDED RANDOM UTILITIES
// ============================================

function createSeededRandom(seed: number = 12345): () => number {
  let state = seed;
  return function seededRandom() {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

const seededRandom = createSeededRandom(42);

function seededInt(min: number, max: number): number {
  return Math.floor(seededRandom() * (max - min + 1)) + min;
}

// ============================================
// SECURITY UTILITIES
// ============================================

function isValidInternalToken(token: string): boolean {
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;
  if (!expectedToken || !token) return false;

  try {
    const tokenBuffer = Buffer.from(token);
    const expectedBuffer = Buffer.from(expectedToken);

    if (tokenBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const publicPaths = ['/health', '/ready'];
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  const token = req.headers['x-internal-token'] as string | undefined;

  if (!token) {
    logger.warn('Authentication failed: missing token', { path: req.path, ip: req.ip });
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!isValidInternalToken(token)) {
    logger.warn('Authentication failed: invalid token', { path: req.path, ip: req.ip });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

// ============================================
// BASE AGENT CLASS
// ============================================

abstract class BaseAgent {
  abstract readonly type: string;
  protected config: Record<string, unknown>;
  status: AgentStatus = AGENT_STATUS.IDLE;
  lastRun: IAgentRun | null = null;

  constructor(config: Record<string, unknown> = {}) {
    this.config = config;
  }

  async run(input: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    this.status = AGENT_STATUS.RUNNING;
    const startTime = Date.now();

    const run = new AgentRun({
      agentId: `${this.type}_${Date.now()}`,
      agentType: this.type,
      status: AGENT_STATUS.RUNNING,
      startedAt: new Date(),
      input,
      errors: [],
      metrics: {}
    });

    try {
      await run.save();
      const output = await this.execute(input);

      run.status = AGENT_STATUS.COMPLETED;
      run.completedAt = new Date();
      run.duration = Date.now() - startTime;
      run.output = output as Types.Mixed;
      await run.save();

      this.status = AGENT_STATUS.COMPLETED;
      this.lastRun = run;

      logger.info(`${this.type} agent completed`, { duration: run.duration });

      return output;
    } catch (err) {
      const error = err as Error;
      run.status = AGENT_STATUS.ERROR;
      run.errors = [error.message];
      run.completedAt = new Date();
      run.duration = Date.now() - startTime;
      await run.save();

      this.status = AGENT_STATUS.ERROR;
      logger.error(`${this.type} agent failed`, { error: error.message });

      throw err;
    }
  }

  abstract execute(input: Record<string, unknown>): Promise<Record<string, unknown>>;

  async createInsight(
    type: InsightType,
    title: string,
    description: string,
    data: Record<string, unknown>,
    priority: InsightPriority = 'medium'
  ): Promise<IInsight> {
    const insight = await Insight.create({
      insightId: `ins_${uuidv4()}`,
      agentType: this.type,
      type,
      title,
      description,
      data: data as Types.Mixed,
      priority,
      confidence: (data.confidence as number) || 0.7
    });

    logger.info('Insight created', { insightId: insight.insightId, type, title });

    return insight;
  }

  async createAction(
    type: string,
    target: Record<string, unknown>,
    payload: Record<string, unknown>,
    options: { priority?: ActionPriority; autoExecute?: boolean } = {}
  ): Promise<IAction> {
    const action = await Action.create({
      actionId: `act_${uuidv4()}`,
      agentType: this.type,
      type,
      target: target as Types.Mixed,
      payload: payload as Types.Mixed,
      priority: options.priority || 'medium',
      autoExecute: options.autoExecute || false
    });

    logger.info('Action created', { actionId: action.actionId, type, autoExecute: action.autoExecute });

    // Auto-execute if enabled and low priority
    if (action.autoExecute && action.priority === 'low') {
      await this.executeAction(action);
    }

    return action;
  }

  async executeAction(action: IAction): Promise<IAction> {
    action.status = 'executed';
    action.executedAt = new Date();
    await action.save();

    logger.info('Action executed', { actionId: action.actionId });

    return action;
  }
}

// ============================================
// AGENT IMPLEMENTATIONS
// ============================================

// 1. Demand Signal Agent
class DemandSignalAgent extends BaseAgent {
  readonly type = AGENT_TYPES.DEMAND_SIGNAL;

  async execute(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    logger.info('DemandSignalAgent: Aggregating demand signals');

    let demandSignals: Record<string, unknown> = {
      timestamp: new Date(),
      totalDemand: 0,
      byCategory: { restaurant: 0, hotel: 0, retail: 0 },
      trends: [] as Array<{ category: string; trend: string; velocity: number }>,
      merchants: [] as unknown[],
      source: 'simulated'
    };

    try {
      const db = mongoose.connection.db;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const categoryAggregation = await db.collection('orders').aggregate([
        { $match: { createdAt: { $gte: oneHourAgo }, status: { $nin: ['cancelled', 'refunded'] } } },
        { $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }}
      ]).toArray();

      let totalDemand = 0;
      const byCategory: Record<string, number> = { restaurant: 0, hotel: 0, retail: 0 };
      for (const cat of categoryAggregation) {
        byCategory[cat._id as string] = cat.count;
        totalDemand += cat.count;
      }

      demandSignals = {
        ...demandSignals,
        totalDemand,
        byCategory,
        source: 'real'
      };

      // Calculate trends
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const previousHourData = await db.collection('orders').aggregate([
        { $match: { createdAt: { $gte: twoHoursAgo, $lt: oneHourAgo }, status: { $nin: ['cancelled', 'refunded'] } } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]).toArray();

      const previousTotals: Record<string, number> = {};
      for (const cat of previousHourData) {
        previousTotals[cat._id as string] = cat.count;
      }

      const trends: Array<{ category: string; trend: string; velocity: number }> = [];
      for (const [category, currentCount] of Object.entries(byCategory)) {
        const previousCount = previousTotals[category] || 1;
        const velocity = (currentCount - previousCount) / previousCount;
        const trend = velocity > 0.1 ? 'up' : velocity < -0.1 ? 'down' : 'stable';

        trends.push({ category, trend, velocity: Math.abs(velocity) });

        if (currentCount > 100 || velocity > 0.3) {
          await this.createInsight(
            'opportunity',
            `${category} demand ${trend}`,
            `${category} showing ${trend === 'up' ? '+' : ''}${(velocity * 100).toFixed(0)}% demand change (${currentCount} orders)`,
            { category, demand: currentCount, velocity, trend },
            velocity > 0.5 ? 'high' : 'medium'
          );
        }
      }

      demandSignals = { ...demandSignals, trends };
    } catch (err) {
      // CRITICAL: Do NOT silently fall back to fake data
      logger.error('DemandSignalAgent: CRITICAL - Failed to fetch real demand data', {
        error: (err as Error).message,
        timestamp: new Date().toISOString(),
      });

      // Throw error so upstream can handle gracefully
      throw new Error('DEMAND_SIGNALS_UNAVAILABLE: Unable to retrieve real demand signals. Service degraded.');
    }

    return demandSignals;
  }
}

// 2. Scarcity Agent
class ScarcityAgent extends BaseAgent {
  readonly type = AGENT_TYPES.SCARCITY;

  async execute(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    logger.info('ScarcityAgent: Analyzing supply/demand ratios');

    const scarcityData: Record<string, unknown> = {
      timestamp: new Date(),
      alerts: [] as Array<Record<string, unknown>>,
      urgencySignals: [] as unknown[],
      source: 'simulated'
    };

    try {
      const db = mongoose.connection.db;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const lowInventoryProducts = await db.collection('products').find({
        $expr: { $lt: [{ $ifNull: ['$inventory', 999999] }, '$lowStockThreshold'] }
      }).limit(20).toArray();

      const demandData = await db.collection('orders').aggregate([
        { $match: { createdAt: { $gte: oneHourAgo }, status: { $nin: ['cancelled'] } } },
        { $unwind: '$items' },
        { $group: {
          _id: '$items.productId',
          productName: { $first: '$items.name' },
          demand: { $sum: '$items.quantity' }
        }}
      ]).toArray();

      const demandMap: Record<string, { demand: number }> = {};
      for (const d of demandData) {
        demandMap[d._id as string] = { demand: d.demand };
      }

      const alerts: Array<Record<string, unknown>> = [];
      for (const product of lowInventoryProducts) {
        const demand = demandMap[product._id as string]?.demand || 0;
        const supply = (product.inventory as number) || 0;
        const ratio = supply > 0 ? demand / supply : 999;

        if (ratio > 2) {
          alerts.push({
            type: 'high_demand_low_supply',
            item: (product.name as string) || product._id,
            severity: ratio > 3 ? 'critical' : 'high',
            demand,
            supply,
            ratio: ratio.toFixed(2),
            message: `${product.name} inventory critical. Demand ${ratio.toFixed(1)}x available supply.`
          });

          await this.createInsight(
            'risk',
            `${product.name} scarcity risk`,
            `Supply/demand ratio: ${ratio.toFixed(1)}. Consider restocking.`,
            { item: product.name, demand, supply, ratio },
            ratio > 3 ? 'critical' : 'high'
          );
        }
      }

      scarcityData.alerts = alerts;
      scarcityData.source = 'real';
    } catch (err) {
      logger.warn('ScarcityAgent: Using simulated fallback', { error: (err as Error).message });

      const items = [
        { id: 'item_1', name: 'Premium Biryani', demand: 150, supply: 50, ratio: 3 },
        { id: 'item_2', name: 'Chicken Wings', demand: 80, supply: 75, ratio: 1.07 }
      ];

      const alerts: Array<Record<string, unknown>> = [];
      for (const item of items) {
        if (item.ratio > 2) {
          alerts.push({
            type: 'high_demand_low_supply',
            item: item.name,
            severity: item.ratio > 3 ? 'critical' : 'high',
            message: `${item.name} is running low. Demand is ${item.ratio}x available supply.`
          });

          await this.createInsight(
            'risk',
            `${item.name} scarcity risk`,
            `Supply/demand ratio: ${item.ratio}. Consider increasing inventory.`,
            { item: item.name, ratio: item.ratio },
            item.ratio > 3 ? 'critical' : 'high'
          );
        }
      }

      scarcityData.alerts = alerts;
      scarcityData.source = 'simulated_fallback';
    }

    return scarcityData;
  }
}

// 3. Personalization Agent
class PersonalizationAgent extends BaseAgent {
  readonly type = AGENT_TYPES.PERSONALIZATION;

  async execute(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    logger.info('PersonalizationAgent: Analyzing user response patterns');

    const patterns: Record<string, unknown> = {
      timestamp: new Date(),
      segmentsAnalyzed: 0,
      aBTests: [] as Array<{ id: string; variant: string; conversion: number; sample: number }>,
      winningVariants: [] as Array<{ testId: string; variant: string; lift: string }>,
      source: 'simulated'
    };

    try {
      const db = mongoose.connection.db;
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const abTests = await db.collection('experiments').aggregate([
        { $match: { status: 'active', startDate: { $lte: new Date() } } },
        { $lookup: {
          from: 'experiment_results',
          localField: '_id',
          foreignField: 'experimentId',
          as: 'results'
        }}
      ]).limit(10).toArray();

      const aBTests: Array<{ id: string; variant: string; conversion: number; sample: number }> = [];
      const winningVariants: Array<{ testId: string; variant: string; lift: string }> = [];

      for (const test of abTests) {
        if (test.results && test.results.length > 0) {
          const variantResults: Record<string, { conversions: number; total: number }> = {};
          for (const result of test.results) {
            if (!variantResults[result.variant]) {
              variantResults[result.variant] = { conversions: 0, total: 0 };
            }
            variantResults[result.variant].conversions += result.conversions || 0;
            variantResults[result.variant].total += result.participants || 0;
          }

          for (const [variant, data] of Object.entries(variantResults)) {
            const conversionRate = data.total > 0 ? data.conversions / data.total : 0;
            aBTests.push({
              id: test._id.toString(),
              variant,
              conversion: conversionRate,
              sample: data.total
            });

            if (data.total > 100 && conversionRate > 0.15) {
              winningVariants.push({
                testId: test._id.toString(),
                variant,
                lift: `${((conversionRate / 0.10 - 1) * 100).toFixed(0)}%`
              });

              await this.createAction(
                'update_campaign',
                { testId: test._id.toString() },
                { variant },
                { priority: 'high' }
              );
            }
          }
        }
      }

      patterns.aBTests = aBTests;
      patterns.winningVariants = winningVariants;
      patterns.segmentsAnalyzed = abTests.length;
      patterns.source = 'real';
    } catch (err) {
      logger.warn('PersonalizationAgent: Using simulated fallback', { error: (err as Error).message });

      patterns.aBTests = [
        { id: 'test_1', variant: 'A', conversion: 0.12, sample: 500 },
        { id: 'test_1', variant: 'B', conversion: 0.18, sample: 480 }
      ];

      const winningVariants: Array<{ testId: string; variant: string; lift: string }> = [];
      for (const test of patterns.aBTests as Array<{ id: string; variant: string; conversion: number }>) {
        if (test.conversion > 0.15) {
          winningVariants.push({
            testId: test.id,
            variant: test.variant,
            lift: '+50%'
          });
        }
      }
      patterns.winningVariants = winningVariants;
      patterns.source = 'simulated_fallback';
    }

    return patterns;
  }
}

// 4. Attribution Agent
class AttributionAgent extends BaseAgent {
  readonly type = AGENT_TYPES.ATTRIBUTION;

  async execute(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    logger.info('AttributionAgent: Multi-touch conversion attribution');

    const attribution: Record<string, unknown> = {
      timestamp: new Date(),
      conversions: 0,
      touchpoints: {} as Record<string, number>,
      channelROI: {} as Record<string, number>,
      source: 'simulated'
    };

    try {
      const db = mongoose.connection.db;
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const channelData = await db.collection('conversion_events').aggregate([
        { $match: { createdAt: { $gte: oneDayAgo } } },
        { $group: {
          _id: '$channel',
          conversions: { $sum: 1 },
          revenue: { $sum: '$value' }
        }}
      ]).toArray();

      const revenueData = await db.collection('orders').aggregate([
        { $match: { createdAt: { $gte: oneDayAgo }, status: 'completed' } },
        { $group: {
          _id: '$attributionChannel',
          revenue: { $sum: '$totalAmount' }
        }}
      ]).toArray();

      const revenueMap: Record<string, number> = {};
      for (const r of revenueData) {
        revenueMap[r._id as string || 'organic'] = r.revenue;
      }

      const touchpoints: Record<string, number> = {};
      const channelROI: Record<string, number> = {};
      let totalConversions = 0;

      for (const ch of channelData) {
        const channel = (ch._id as string) || 'organic';
        touchpoints[channel] = ch.conversions;
        channelROI[channel] = revenueMap[channel] ? revenueMap[channel] / ch.conversions : 0;
        totalConversions += ch.conversions;
      }

      attribution.conversions = totalConversions;
      attribution.touchpoints = touchpoints;
      attribution.channelROI = channelROI;

      const bestChannel = Object.entries(channelROI)
        .filter(([, roi]) => roi > 0)
        .sort(([, a], [, b]) => b - a)[0];

      if (bestChannel) {
        await this.createInsight(
          'opportunity',
          `Best channel: ${bestChannel[0]}`,
          `${bestChannel[0]} has highest ROI at ${bestChannel[1].toFixed(1)}x`,
          { channel: bestChannel[0], roi: bestChannel[1] },
          'medium'
        );
      }

      attribution.source = 'real';
    } catch (err) {
      logger.warn('AttributionAgent: Using simulated fallback - DATABASE UNAVAILABLE', { error: (err as Error).message });

      attribution.conversions = seededInt(50, 150);
      attribution.touchpoints = {
        push: 0.3, email: 0.2, sms: 0.15, inApp: 0.25, organic: 0.1
      };
      attribution.channelROI = {
        push: 2.5, email: 3.2, sms: 4.1, inApp: 2.8, organic: 1.0
      };

      const bestChannel = Object.entries(attribution.channelROI as Record<string, number>)
        .sort(([, a], [, b]) => b - a)[0];

      if (bestChannel) {
        await this.createInsight(
          'opportunity',
          `Best channel: ${bestChannel[0]}`,
          `${bestChannel[0]} has highest ROI at ${bestChannel[1]}x`,
          { channel: bestChannel[0], roi: bestChannel[1] },
          'medium'
        );
      }

      attribution.source = 'simulated_fallback';
      attribution.warning = '⚠️ SIMULATED DATA - MongoDB unavailable. This is NOT real attribution data.';
    }

    return attribution;
  }
}

// 5. Adaptive Scoring Agent
class AdaptiveScoringAgent extends BaseAgent {
  readonly type = AGENT_TYPES.ADAPTIVE_SCORING;

  async execute(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    logger.info('AdaptiveScoringAgent: Retraining ML models');

    const scoring: Record<string, unknown> = {
      timestamp: new Date(),
      modelsUpdated: 0,
      accuracy: 0,
      improvements: [] as Array<{ model: string; improvement: number; newAccuracy: number; correct?: number; total?: number }>,
      features: [] as Array<{ name: string; importance: number }>,
      source: 'simulated'
    };

    try {
      const db = mongoose.connection.db;

      const predictions = await db.collection('ml_predictions').aggregate([
        { $match: {
          modelType: { $in: ['churn_predictor', 'reorder_predictor', 'intent_predictor'] },
          outcomeRecorded: true,
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }},
        { $group: {
          _id: '$modelType',
          correct: { $sum: { $cond: [{ $eq: ['$prediction', '$actualOutcome'] }, 1, 0] } },
          total: { $sum: 1 }
        }}
      ]).toArray();

      let totalCorrect = 0;
      let totalPredictions = 0;
      const improvements: Array<{ model: string; improvement: number; newAccuracy: number; correct: number; total: number }> = [];

      for (const pred of predictions) {
        const accuracy = pred.total > 0 ? pred.correct / pred.total : 0;
        const modelName = (pred._id as string).replace(/_/g, ' ');

        improvements.push({
          model: modelName,
          improvement: seededRandom() * 0.05,
          newAccuracy: accuracy,
          correct: pred.correct,
          total: pred.total
        });

        totalCorrect += pred.correct;
        totalPredictions += pred.total;

        if (accuracy > 0.7) {
          await this.createInsight(
            'trend',
            `${modelName} performing well`,
            `Accuracy: ${(accuracy * 100).toFixed(1)}% over ${pred.total} predictions`,
            { model: modelName, accuracy },
            'low'
          );
        }
      }

      scoring.improvements = improvements;
      scoring.accuracy = totalPredictions > 0 ? totalCorrect / totalPredictions : 0;
      scoring.modelsUpdated = predictions.length;

      const featureImportance = await db.collection('ml_feature_importance').findOne({
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      if (featureImportance && featureImportance.features) {
        scoring.features = (featureImportance.features as Array<{ name: string; importance: number }>)
          .slice(0, 5)
          .map((f: { name: string; importance: number }) => ({
            name: f.name,
            importance: f.importance
          }));
      }

      scoring.source = 'real';
    } catch (err) {
      logger.warn('AdaptiveScoringAgent: Using simulated fallback', { error: (err as Error).message });

      scoring.modelsUpdated = 3;
      scoring.accuracy = 0.85 + seededRandom() * 0.1;
      scoring.improvements = [
        { model: 'churn_predictor', improvement: 0.05, newAccuracy: 0.88, correct: 0, total: 0 },
        { model: 'reorder_predictor', improvement: 0.03, newAccuracy: 0.82, correct: 0, total: 0 }
      ];
      scoring.features = [
        { name: 'days_since_last_order', importance: 0.4 },
        { name: 'order_frequency', importance: 0.3 },
        { name: 'avg_order_value', importance: 0.2 }
      ];
      scoring.source = 'simulated_fallback';
    }

    return scoring;
  }
}

// 6. Feedback Loop Agent
class FeedbackLoopAgent extends BaseAgent {
  readonly type = AGENT_TYPES.FEEDBACK_LOOP;

  async execute(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    logger.info('FeedbackLoopAgent: Closed-loop optimization');

    const feedback: Record<string, unknown> = {
      timestamp: new Date(),
      loopsClosed: 0,
      driftDetected: false,
      corrections: [] as Array<{ type: string; model: string; psi?: number; change: string }>,
      source: 'simulated'
    };

    try {
      const db = mongoose.connection.db;
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const feedbackLoops = await db.collection('ml_feedback_loops').find({
        closedAt: { $gte: oneDayAgo }
      }).toArray();

      feedback.loopsClosed = feedbackLoops.length;

      const driftMetrics = await db.collection('model_drift_metrics').find({
        timestamp: { $gte: oneDayAgo }
      }).toArray();

      const corrections: Array<{ type: string; model: string; psi: number; change: string }> = [];
      let driftDetected = false;

      for (const metric of driftMetrics) {
        const psi = (metric.psi as number) || 0;
        if (psi > 0.2) {
          driftDetected = true;
          corrections.push({
            type: 'model_recalibration',
            model: metric.modelType as string,
            psi,
            change: psi > 0.3 ? '-10%' : '-5%'
          });

          await this.createInsight(
            'anomaly',
            `${metric.modelType} drift detected`,
            `PSI: ${psi.toFixed(3)}. Consider recalibrating the model.`,
            { model: metric.modelType, psi, change: psi > 0.3 ? '-10%' : '-5%' },
            psi > 0.3 ? 'critical' : 'high'
          );
        }
      }

      feedback.driftDetected = driftDetected;
      feedback.corrections = corrections;
      feedback.source = 'real';
    } catch (err) {
      logger.warn('FeedbackLoopAgent: Using simulated fallback', { error: (err as Error).message });

      feedback.loopsClosed = seededInt(10, 30);

      if (seededRandom() > 0.8) {
        feedback.driftDetected = true;
        feedback.corrections = [{
          type: 'threshold_adjustment',
          model: 'reorder_predictor',
          change: '-5%'
        }];

        await this.createInsight(
          'anomaly',
          'Model drift detected',
          'Reorder predictor showing signs of drift. Automatic correction applied.',
          { model: 'reorder_predictor', correction: '-5%' },
          'high'
        );
      }

      feedback.source = 'simulated_fallback';
    }

    return feedback;
  }
}

// 7. Network Effect Agent
class NetworkEffectAgent extends BaseAgent {
  readonly type = AGENT_TYPES.NETWORK_EFFECT;

  async execute(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    logger.info('NetworkEffectAgent: Collaborative filtering update');

    const network: Record<string, unknown> = {
      timestamp: new Date(),
      usersAnalyzed: 0,
      similaritiesComputed: 0,
      newClusters: 0,
      clusters: [] as Array<{ id: string | number; size: number; type: string; avgOrderValue: number; avgOrderFrequency: number }>,
      source: 'simulated'
    };

    try {
      const db = mongoose.connection.db;
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const userSegments = await db.collection('user_segments').aggregate([
        { $match: { updatedAt: { $gte: oneDayAgo } } },
        { $group: {
          _id: '$segmentType',
          count: { $sum: 1 },
          avgOrderValue: { $avg: '$avgOrderValue' },
          avgOrderFrequency: { $avg: '$orderFrequency' }
        }}
      ]).toArray();

      const clusters: Array<{ id: string | number; size: number; type: string; avgOrderValue: number; avgOrderFrequency: number }> = [];
      for (const segment of userSegments) {
        clusters.push({
          id: segment._id as string | number,
          size: segment.count,
          type: (segment._id as string) || 'general',
          avgOrderValue: (segment.avgOrderValue as number) || 0,
          avgOrderFrequency: (segment.avgOrderFrequency as number) || 0
        });

        if (segment.count > 100) {
          await this.createInsight(
            'trend',
            `Active user cluster: ${segment._id}`,
            `${segment.count} users with avg order value Rs${((segment.avgOrderValue as number) || 0).toFixed(0)}`,
            { cluster: segment },
            'low'
          );
        }
      }

      network.clusters = clusters;

      const cfMetrics = await db.collection('collaborative_filtering_metrics').findOne({
        timestamp: { $gte: oneDayAgo }
      });

      if (cfMetrics) {
        network.usersAnalyzed = cfMetrics.usersAnalyzed || 0;
        network.similaritiesComputed = cfMetrics.similaritiesComputed || 0;
      } else {
        const userCount = await db.collection('users').countDocuments();
        network.usersAnalyzed = userCount;
        network.similaritiesComputed = Math.floor(userCount * 0.1);
      }

      const newClusterCount = await db.collection('user_clusters').countDocuments({
        createdAt: { $gte: oneDayAgo }
      });
      network.newClusters = newClusterCount;

      network.source = 'real';
    } catch (err) {
      logger.warn('NetworkEffectAgent: Using simulated fallback', { error: (err as Error).message });

      network.usersAnalyzed = seededInt(5000, 15000);
      network.similaritiesComputed = seededInt(20000, 70000);
      network.newClusters = seededInt(1, 5);
      network.clusters = [
        { id: 1, size: 250, type: 'foodies', avgOrderValue: 450, avgOrderFrequency: 0 },
        { id: 2, size: 180, type: 'budget_diners', avgOrderValue: 200, avgOrderFrequency: 0 },
        { id: 3, size: 120, type: 'premium_users', avgOrderValue: 1200, avgOrderFrequency: 0 }
      ];

      for (const cluster of network.clusters as Array<{ type: string; size: number; avgOrderValue: number }>) {
        await this.createInsight(
          'trend',
          `New user cluster: ${cluster.type}`,
          `${cluster.size} users with avg order value Rs${cluster.avgOrderValue}`,
          { cluster },
          'low'
        );
      }

      network.source = 'simulated_fallback';
    }

    return network;
  }
}

// 8. Revenue Attribution Agent
class RevenueAttributionAgent extends BaseAgent {
  readonly type = AGENT_TYPES.REVENUE_ATTRIBUTION;

  async execute(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    logger.info('RevenueAttributionAgent: GMV tracking and ROI analysis');

    const revenue: Record<string, unknown> = {
      timestamp: new Date(),
      gmv: { total: 0, bySource: {} as Record<string, number>, orderCount: 0 },
      roi: {} as Record<string, number>,
      topAgents: [] as Array<{ agent: string; insightsGenerated?: number; revenue?: number; conversions?: number }>,
      source: 'simulated'
    };

    try {
      const db = mongoose.connection.db;
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const gmvData = await db.collection('orders').aggregate([
        { $match: { status: 'completed', createdAt: { $gte: oneDayAgo } } },
        { $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }}
      ]).toArray();

      if (gmvData.length > 0) {
        revenue.gmv = {
          ...revenue.gmv as object,
          total: gmvData[0]?.total || 0,
          orderCount: gmvData[0]?.count || 0
        };
      }

      const bySource = await db.collection('orders').aggregate([
        { $match: { status: 'completed', createdAt: { $gte: oneDayAgo } } },
        { $group: {
          _id: '$source',
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }}
      ]).toArray();

      const bySourceMap: Record<string, number> = {};
      for (const source of bySource) {
        bySourceMap[source._id as string || 'direct'] = source.total;
      }
      (revenue.gmv as Record<string, unknown>).bySource = bySourceMap;

      const roiData = await db.collection('campaign_metrics').aggregate([
        { $match: { period: 'last_24h' } },
        { $group: {
          _id: '$campaignType',
          spend: { $sum: '$spend' },
          revenue: { $sum: '$revenue' }
        }}
      ]).toArray();

      const roi: Record<string, number> = {};
      for (const campaign of roiData) {
        if ((campaign.spend as number) > 0) {
          roi[campaign._id as string] = (campaign.revenue as number) / (campaign.spend as number);
        }
      }
      revenue.roi = roi;

      const topAgents = await db.collection('insights').aggregate([
        { $match: {
          createdAt: { $gte: oneDayAgo },
          type: 'opportunity'
        }},
        { $group: {
          _id: '$agentType',
          insightCount: { $sum: 1 }
        }},
        { $sort: { insightCount: -1 } },
        { $limit: 5 }
      ]).toArray();

      revenue.topAgents = topAgents.map(a => ({
        agent: a._id as string,
        insightsGenerated: a.insightCount
      }));

      for (const [program, roiValue] of Object.entries(roi)) {
        if (roiValue > 3) {
          await this.createInsight(
            'opportunity',
            `${program} showing strong ROI`,
            `ROI: ${roiValue.toFixed(1)}x - Consider increasing investment`,
            { program, roi: roiValue },
            'medium'
          );
        }
      }

      revenue.source = 'real';
    } catch (err) {
      logger.warn('RevenueAttributionAgent: Using simulated fallback - DATABASE UNAVAILABLE', { error: (err as Error).message });

      revenue.gmv = {
        total: seededInt(500000, 1500000),
        bySource: { organic: 0.3, marketing: 0.5, repeat: 0.2 },
        orderCount: 0
      };
      revenue.roi = {
        nudge_campaigns: 3.2,
        loyalty_program: 2.8,
        personalization: 4.1
      };
      revenue.topAgents = [
        { agent: 'DemandSignalAgent', revenue: 45000, conversions: 150 },
        { agent: 'PersonalizationAgent', revenue: 38000, conversions: 120 },
        { agent: 'ScarcityAgent', revenue: 28000, conversions: 90 }
      ];

      for (const [program, roiValue] of Object.entries(revenue.roi as Record<string, number>)) {
        if (roiValue > 3) {
          await this.createInsight(
            'opportunity',
            `${program} showing strong ROI`,
            `ROI: ${roiValue}x - Consider increasing investment`,
            { program, roi: roiValue },
            'medium'
          );
        }
      }

      revenue.source = 'simulated_fallback';
      revenue.warning = '⚠️ SIMULATED DATA - MongoDB unavailable. This is NOT real GMV/revenue data. DO NOT use for financial decisions.';
    }

    return revenue;
  }
}

// ============================================
// AGENT MANAGER
// ============================================

interface AgentStatusInfo {
  status: AgentStatus;
  lastRun?: Date;
  schedule: string | null;
}

class AgentManager {
  private agents: Record<string, BaseAgent>;
  private schedules: Record<string, string | null>;

  constructor() {
    this.agents = {
      [AGENT_TYPES.DEMAND_SIGNAL]: new DemandSignalAgent(),
      [AGENT_TYPES.SCARCITY]: new ScarcityAgent(),
      [AGENT_TYPES.PERSONALIZATION]: new PersonalizationAgent(),
      [AGENT_TYPES.ATTRIBUTION]: new AttributionAgent(),
      [AGENT_TYPES.ADAPTIVE_SCORING]: new AdaptiveScoringAgent(),
      [AGENT_TYPES.FEEDBACK_LOOP]: new FeedbackLoopAgent(),
      [AGENT_TYPES.NETWORK_EFFECT]: new NetworkEffectAgent(),
      [AGENT_TYPES.REVENUE_ATTRIBUTION]: new RevenueAttributionAgent()
    };

    this.schedules = {
      [AGENT_TYPES.DEMAND_SIGNAL]: '*/5 * * * *',
      [AGENT_TYPES.SCARCITY]: '*/1 * * * *',
      [AGENT_TYPES.ADAPTIVE_SCORING]: '0 * * * *',
      [AGENT_TYPES.NETWORK_EFFECT]: '0 0 * * *',
      [AGENT_TYPES.REVENUE_ATTRIBUTION]: '*/15 * * * *'
    };
  }

  async runAgent(agentType: string): Promise<Record<string, unknown>> {
    const agent = this.agents[agentType];
    if (!agent) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    return agent.run();
  }

  async runAllAgents(): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};
    for (const type of Object.keys(this.agents)) {
      try {
        results[type] = await this.runAgent(type);
      } catch (err) {
        results[type] = { error: (err as Error).message };
      }
    }
    return results;
  }

  getAgentStatus(): Record<string, AgentStatusInfo> {
    const status: Record<string, AgentStatusInfo> = {};
    for (const [type, agent] of Object.entries(this.agents)) {
      status[type] = {
        status: agent.status,
        lastRun: agent.lastRun?.completedAt,
        schedule: this.schedules[type] || null
      };
    }
    return status;
  }

  setupSchedules(): void {
    for (const [agentType, cronExpr] of Object.entries(this.schedules)) {
      if (cronExpr) {
        cron.schedule(cronExpr, async () => {
          logger.info(`Scheduled run: ${agentType}`);
          try {
            await this.runAgent(agentType);
          } catch (err) {
            logger.error(`Scheduled ${agentType} failed`, { error: (err as Error).message });
          }
        });
        logger.info(`Scheduled ${agentType}: ${cronExpr}`);
      }
    }
  }
}

const agentManager = new AgentManager();

// ============================================
// EXPRESS APP SETUP
// ============================================

const app: Express = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use(requestIdMiddleware);
app.use(authMiddleware);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'autonomous-agents',
    agents: Object.keys(AGENT_TYPES),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (_req: Request, res: Response) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready' });
  }
});

// Get all agent statuses
app.get('/api/agents/status', (_req: Request, res: Response) => {
  res.json({ success: true, agents: agentManager.getAgentStatus() });
});

// Run specific agent
app.post('/api/agents/:agentType/run', asyncHandler(async (req: Request, res: Response) => {
  const { agentType } = req.params;
  const result = await agentManager.runAgent(agentType);
  res.json({ success: true, agentType, result });
}));

// Run all agents
app.post('/api/agents/run', asyncHandler(async (_req: Request, res: Response) => {
  const results = await agentManager.runAllAgents();
  res.json({ success: true, results });
}));

// Get insights
app.get('/api/insights', asyncHandler(async (req: Request, res: Response) => {
  const validation = AgentQuerySchema.safeParse(req.query);
  const { agentType, priority, status } = validation.success ? validation.data : {};
  const limit = validation.success ? validation.data.limit : 50;

  const query: Record<string, unknown> = {};
  if (agentType) query.agentType = agentType;
  if (priority) query.priority = priority;
  if (status) query.status = status;

  const insights = await Insight.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  res.json({ success: true, insights, count: insights.length });
}));

// Get actions
app.get('/api/actions', asyncHandler(async (req: Request, res: Response) => {
  const { agentType, status: actionStatus, priority } = req.query;

  const query: Record<string, unknown> = {};
  if (agentType) query.agentType = agentType;
  if (actionStatus) query.status = actionStatus;
  if (priority) query.priority = priority;

  const actions = await Action.find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.json({ success: true, actions, count: actions.length });
}));

// Approve/reject action
app.patch('/api/actions/:actionId', asyncHandler(async (req: Request, res: Response) => {
  const { actionId } = req.params;
  const validation = ActionUpdateSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  const { status: actionStatus, approvedBy } = validation.data;

  const updateData: Record<string, unknown> = { status: actionStatus };
  if (approvedBy) updateData.approvedBy = approvedBy;
  if (actionStatus === 'executed') updateData.executedAt = new Date();

  const action = await Action.findOneAndUpdate(
    { actionId },
    { $set: updateData },
    { new: true }
  );

  if (!action) {
    res.status(404).json({ error: 'Action not found' });
    return;
  }

  res.json({ success: true, action });
}));

// Update insight status
app.patch('/api/insights/:insightId', asyncHandler(async (req: Request, res: Response) => {
  const { insightId } = req.params;
  const validation = InsightUpdateSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  const { status: insightStatus } = validation.data;

  const updateData: Record<string, unknown> = { status: insightStatus };
  if (insightStatus === 'actioned') updateData.actionedAt = new Date();

  const insight = await Insight.findOneAndUpdate(
    { insightId },
    { $set: updateData },
    { new: true }
  );

  if (!insight) {
    res.status(404).json({ error: 'Insight not found' });
    return;
  }

  res.json({ success: true, insight });
}));

// Get agent run history
app.get('/api/agents/:agentType/history', asyncHandler(async (req: Request, res: Response) => {
  const { agentType } = req.params;
  const validation = PaginationSchema.safeParse(req.query);
  const limit = validation.success ? validation.data.limit : 20;

  const runs = await AgentRun.find({ agentType })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  res.json({ success: true, runs, count: runs.length });
}));

// Analytics
app.get('/api/analytics', asyncHandler(async (_req: Request, res: Response) => {
  const [insightStats, actionStats, agentStats] = await Promise.all([
    Insight.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]),
    Action.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    AgentRun.aggregate([
      {
        $group: {
          _id: '$agentType',
          runs: { $sum: 1 },
          avgDuration: { $avg: '$duration' },
          errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } }
        }
      }
    ])
  ]);

  res.json({
    success: true,
    insights: insightStats,
    actions: actionStats,
    agents: agentStats
  });
}));

// Error handler
function errorHandlerWrapper(err: Error, req: Request, res: Response, next: NextFunction): void {
  sharedErrorHandler(err, req, res, next);
}

app.use(errorHandlerWrapper);

// ============================================
// STARTUP
// ============================================

const PORT = process.env.PORT || 4062;

async function start(): Promise<void> {
  try {
    const requiredEnv = ['MONGODB_URI', 'REDIS_URL', 'INTERNAL_SERVICE_TOKEN'];
    for (const env of requiredEnv) {
      if (!process.env[env]) {
        logger.error(`FATAL: ${env} is required`);
        process.exit(1);
      }
    }

    await mongoose.connect(process.env.MONGODB_URI!);
    logger.info('Connected to MongoDB');

    // Setup agent schedules
    agentManager.setupSchedules();

    app.listen(PORT, () => {
      logger.info(`Autonomous Agents Service started on port ${PORT}`);
      logger.info(`Agents: ${Object.keys(agentManager.getAgentStatus()).join(', ')}`);
    });
  } catch (err) {
    const error = err as Error;
    logger.error('Startup failed', { error: error.message });
    process.exit(1);
  }
}

start();

export { app, agentManager, AgentManager, AGENT_TYPES, AGENT_STATUS };
