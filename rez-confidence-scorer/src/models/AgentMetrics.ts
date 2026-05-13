import mongoose, { Schema, Document, Model } from 'mongoose';
import { IAgentMetrics, AgentStatus, AgentCapabilities, AgentLoadMetrics } from '../types';

/**
 * Mongoose schema for storing agent metrics and capabilities
 */
const AgentCapabilitiesSchema = new Schema<AgentCapabilities>(
  {
    domains: {
      type: [String],
      required: true,
      default: [],
    },
    maxConcurrentTasks: {
      type: Number,
      required: true,
      min: 1,
      default: 10,
    },
    specializations: {
      type: [String],
      required: true,
      default: [],
    },
    supportedLanguages: {
      type: [String],
      required: true,
      default: ['en'],
    },
    version: {
      type: String,
      required: true,
      default: '1.0.0',
    },
  },
  { _id: false }
);

const AgentLoadMetricsSchema = new Schema<AgentLoadMetrics>(
  {
    currentLoad: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    maxLoad: {
      type: Number,
      required: true,
      min: 1,
      default: 100,
    },
    queueDepth: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    averageResponseTimeMs: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    successRate: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      default: 1,
    },
  },
  { _id: false }
);

const AgentMetricsSchema = new Schema<IAgentMetrics & Document>(
  {
    agentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(AgentStatus),
      required: true,
      default: AgentStatus.ACTIVE,
    },
    capabilities: {
      type: AgentCapabilitiesSchema,
      required: true,
    },
    loadMetrics: {
      type: AgentLoadMetricsSchema,
      required: true,
    },
    performance: {
      totalTasks: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
      successfulTasks: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
      failedTasks: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
      averageConfidenceScore: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
        default: 0,
      },
      lastTaskTimestamp: {
        type: Date,
        default: null,
      },
    },
    intentAccuracy: {
      type: Map,
      of: {
        attempts: { type: Number, default: 0 },
        successes: { type: Number, default: 0 },
        averageScore: { type: Number, default: 0 },
      },
      default: new Map(),
    },
  },
  {
    timestamps: true,
    collection: 'agent_metrics',
  }
);

// Indexes for efficient queries
AgentMetricsSchema.index({ status: 1 });
AgentMetricsSchema.index({ status: 1, 'loadMetrics.currentLoad': 1 });
AgentMetricsSchema.index({ 'capabilities.domains': 1 });
AgentMetricsSchema.index({ 'performance.averageConfidenceScore': -1 });

/**
 * Get all active agents
 */
AgentMetricsSchema.statics.getActiveAgents = async function (): Promise<IAgentMetrics[]> {
  return this.find({ status: AgentStatus.ACTIVE })
    .lean()
    .exec();
};

/**
 * Get agents by domain
 */
AgentMetricsSchema.statics.getAgentsByDomain = async function (
  domain: string
): Promise<IAgentMetrics[]> {
  return this.find({
    status: AgentStatus.ACTIVE,
    'capabilities.domains': domain,
  })
    .lean()
    .exec();
};

/**
 * Get agents with available capacity
 */
AgentMetricsSchema.statics.getAvailableAgents = async function (
  requiredCapacity: number = 1
): Promise<IAgentMetrics[]> {
  return this.find({
    status: AgentStatus.ACTIVE,
    $expr: {
      $gte: [
        { $subtract: ['$loadMetrics.maxLoad', '$loadMetrics.currentLoad'] },
        requiredCapacity,
      ],
    },
  })
    .lean()
    .exec();
};

/**
 * Update agent load metrics
 */
AgentMetricsSchema.methods.updateLoad = function (
  currentLoad: number,
  queueDepth: number
): void {
  this.loadMetrics.currentLoad = currentLoad;
  this.loadMetrics.queueDepth = queueDepth;
  this.markModified('loadMetrics');
};

/**
 * Record task completion
 */
AgentMetricsSchema.methods.recordTaskCompletion = function (
  success: boolean,
  confidenceScore: number,
  responseTimeMs: number
): void {
  this.performance.totalTasks += 1;
  if (success) {
    this.performance.successfulTasks += 1;
  } else {
    this.performance.failedTasks += 1;
  }
  this.performance.lastTaskTimestamp = new Date();

  // Update rolling average
  const total = this.performance.totalTasks;
  const currentAvg = this.performance.averageConfidenceScore;
  this.performance.averageConfidenceScore =
    (currentAvg * (total - 1) + confidenceScore) / total;

  // Update load metrics
  if (this.loadMetrics.currentLoad > 0) {
    this.loadMetrics.currentLoad -= 1;
  }
  if (this.loadMetrics.queueDepth > 0) {
    this.loadMetrics.queueDepth -= 1;
  }

  // Update average response time
  const currentAvgTime = this.loadMetrics.averageResponseTimeMs;
  this.loadMetrics.averageResponseTimeMs =
    (currentAvgTime * (total - 1) + responseTimeMs) / total;

  // Update success rate
  this.loadMetrics.successRate =
    this.performance.successfulTasks / this.performance.totalTasks;
};

/**
 * Update intent accuracy
 */
AgentMetricsSchema.methods.updateIntentAccuracy = function (
  intent: string,
  success: boolean,
  score: number
): void {
  const current = this.intentAccuracy.get(intent) || {
    attempts: 0,
    successes: 0,
    averageScore: 0,
  };

  current.attempts += 1;
  if (success) {
    current.successes += 1;
  }
  current.averageScore =
    (current.averageScore * (current.attempts - 1) + score) / current.attempts;

  this.intentAccuracy.set(intent, current);
  this.markModified('intentAccuracy');
};

/**
 * Get agent performance summary
 */
AgentMetricsSchema.methods.getPerformanceSummary = function () {
  return {
    totalTasks: this.performance.totalTasks,
    successRate: this.performance.successfulTasks / this.performance.totalTasks || 0,
    averageConfidenceScore: this.performance.averageConfidenceScore,
    averageResponseTimeMs: this.loadMetrics.averageResponseTimeMs,
    currentLoadPercentage:
      (this.loadMetrics.currentLoad / this.loadMetrics.maxLoad) * 100,
    status: this.status,
  };
};

/**
 * AgentMetrics model interface
 */
export interface AgentMetricsDocument extends IAgentMetrics, Document {
  _id: mongoose.Types.ObjectId;
  updateLoad(currentLoad: number, queueDepth: number): void;
  recordTaskCompletion(
    success: boolean,
    confidenceScore: number,
    responseTimeMs: number
  ): void;
  updateIntentAccuracy(intent: string, success: boolean, score: number): void;
  getPerformanceSummary(): {
    totalTasks: number;
    successRate: number;
    averageConfidenceScore: number;
    averageResponseTimeMs: number;
    currentLoadPercentage: number;
    status: AgentStatus;
  };
}

export interface AgentMetricsModel extends Model<AgentMetricsDocument> {
  getActiveAgents(): Promise<IAgentMetrics[]>;
  getAgentsByDomain(domain: string): Promise<IAgentMetrics[]>;
  getAvailableAgents(requiredCapacity?: number): Promise<IAgentMetrics[]>;
}

// Compile model or use existing one
export const AgentMetrics: AgentMetricsModel =
  mongoose.models.AgentMetrics ||
  mongoose.model<AgentMetricsDocument, AgentMetricsModel>(
    'AgentMetrics',
    AgentMetricsSchema
  );

export default AgentMetrics;
