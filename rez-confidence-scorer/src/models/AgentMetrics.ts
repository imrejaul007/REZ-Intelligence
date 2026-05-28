import mongoose, { Schema } from 'mongoose';
import { AgentStatus } from '../types';

// Re-export types
export type { IAgentMetrics } from '../types';

/**
 * Mongoose schema for storing agent metrics and capabilities
 */
const AgentCapabilitiesSchema = new Schema(
  {
    domains: { type: [String], required: true, default: [] },
    maxConcurrentTasks: { type: Number, required: true, min: 1, default: 10 },
    specializations: { type: [String], required: true, default: [] },
    supportedLanguages: { type: [String], required: true, default: ['en'] },
    version: { type: String, required: true, default: '1.0.0' },
  },
  { _id: false }
);

const AgentLoadMetricsSchema = new Schema(
  {
    currentLoad: { type: Number, required: true, min: 0, default: 0 },
    maxLoad: { type: Number, required: true, min: 1, default: 10 },
    averageResponseTimeMs: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const AgentPerformanceSchema = new Schema(
  {
    totalTasks: { type: Number, required: true, min: 0, default: 0 },
    successfulTasks: { type: Number, required: true, min: 0, default: 0 },
    failedTasks: { type: Number, required: true, min: 0, default: 0 },
    averageConfidenceScore: { type: Number, required: true, min: 0, max: 1, default: 0.5 },
    lastTaskTimestamp: { type: Date, default: null },
  },
  { _id: false }
);

const AgentMetricsSchema = new Schema(
  {
    agentId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    status: { type: String, enum: Object.values(AgentStatus), default: AgentStatus.OFFLINE },
    capabilities: { type: AgentCapabilitiesSchema, required: true },
    loadMetrics: { type: AgentLoadMetricsSchema, required: true },
    performance: { type: AgentPerformanceSchema, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Indexes
AgentMetricsSchema.index({ status: 1 });
AgentMetricsSchema.index({ 'capabilities.domains': 1 });
AgentMetricsSchema.index({ 'loadMetrics.currentLoad': 1 });

// Static methods
AgentMetricsSchema.statics.getActiveAgents = async function () {
  return this.find({ status: AgentStatus.ONLINE }).lean();
};

AgentMetricsSchema.statics.getAgentsByDomain = async function (domain: string) {
  return this.find({ status: AgentStatus.ONLINE, 'capabilities.domains': domain }).lean();
};

AgentMetricsSchema.statics.getAvailableAgents = async function (requiredCapacity = 1) {
  return this.find({
    status: AgentStatus.ONLINE,
    $expr: {
      $lte: ['$loadMetrics.currentLoad', { $subtract: ['$loadMetrics.maxLoad', requiredCapacity] }],
    },
  }).lean();
};

// Instance methods
AgentMetricsSchema.methods.updateLoad = function (delta: number) {
  this.loadMetrics.currentLoad = Math.max(0, this.loadMetrics.currentLoad + delta);
};

AgentMetricsSchema.methods.recordTaskCompletion = function (success: boolean, confidenceScore: number) {
  this.performance.totalTasks += 1;
  if (success) {
    this.performance.successfulTasks += 1;
  } else {
    this.performance.failedTasks += 1;
  }
  const n = this.performance.totalTasks;
  this.performance.averageConfidenceScore =
    (this.performance.averageConfidenceScore * (n - 1) + confidenceScore) / n;
  this.performance.lastTaskTimestamp = new Date();
};

AgentMetricsSchema.methods.updateIntentAccuracy = function (intent: string, accuracy: number) {
  if (!this.metadata) this.metadata = {};
  if (!this.metadata.intentAccuracy) this.metadata.intentAccuracy = {};
  this.metadata.intentAccuracy[intent] = accuracy;
};

AgentMetricsSchema.methods.getPerformanceSummary = function () {
  return {
    totalTasks: this.performance.totalTasks,
    successRate: this.performance.totalTasks > 0
      ? this.performance.successfulTasks / this.performance.totalTasks
      : 0,
    averageConfidenceScore: this.performance.averageConfidenceScore,
    lastTaskTimestamp: this.performance.lastTaskTimestamp,
  };
};

// Export the model with any type to avoid mongoose typing issues
export const AgentMetrics = mongoose.models.AgentMetrics || mongoose.model('AgentMetrics', AgentMetricsSchema);
export default AgentMetrics;
