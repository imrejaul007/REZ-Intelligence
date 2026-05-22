/**
 * REZ Flow Runtime - Execution Model
 * MongoDB model for workflow execution state
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  ExecutionStatus,
  NodeStatus,
  TriggerType,
  ExecutionLog as ExecutionLogType,
  NodeResult as NodeResultType
} from '../types/workflow';

export interface IExecution extends Document {
  workflowId: mongoose.Types.ObjectId;
  workflowVersion: number;
  status: ExecutionStatus;
  triggerType: TriggerType;
  triggerData: Record<string, unknown>;
  context: {
    userId?: string;
    sessionId?: string;
    variables: Record<string, unknown>;
  };
  nodeResults: Array<{
    nodeId: string;
    status: NodeStatus;
    output?: unknown;
    error?: string;
    errorDetails?: {
      message: string;
      stack?: string;
      code?: string;
    };
    startedAt: Date;
    completedAt?: Date;
    duration?: number;
    retryCount: number;
    metadata?: Record<string, unknown>;
  }>;
  executionPath: string[];
  logs: Array<{
    id: string;
    timestamp: Date;
    level: 'info' | 'warn' | 'error' | 'debug';
    nodeId?: string;
    message: string;
    data?: Record<string, unknown>;
  }>;
  error?: {
    message: string;
    nodeId?: string;
    stack?: string;
  };
  stats: {
    totalNodes: number;
    completedNodes: number;
    failedNodes: number;
    skippedNodes: number;
    totalRetries: number;
    totalDuration?: number;
  };
  startedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  addLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, nodeId?: string, data?: Record<string, unknown>): void;
  updateNodeResult(result: Partial<NodeResultType>): void;
  markStarted(nodeId: string): void;
  markCompleted(): void;
  markFailed(error: string, nodeId?: string): void;
  markCancelled(): void;
}

// Static method types
export interface ExecutionModel extends mongoose.Model<IExecution> {
  findByWorkflow(workflowId: string, options?: { page?: number; limit?: number; status?: ExecutionStatus }): Promise<IExecution[]>;
  getStats(workflowId?: string): Promise<{
    totalExecutions: number;
    completed: number;
    failed: number;
    cancelled: number;
    running: number;
    avgDuration: number;
    avgNodesCompleted: number;
  }>;
}

// IWorkflow instance method type
export interface WorkflowModel extends mongoose.Model<IWorkflow> {
  publish(workflowId: string): Promise<IWorkflow>;
}

const NodeResultSchema = new Schema({
  nodeId: { type: String, required: true },
  status: {
    type: String,
    enum: Object.values(NodeStatus),
    required: true
  },
  output: { type: Schema.Types.Mixed },
  error: { type: String },
  errorDetails: {
    message: { type: String },
    stack: { type: String },
    code: { type: String }
  },
  startedAt: { type: Date, required: true },
  completedAt: { type: Date },
  duration: { type: Number },
  retryCount: { type: Number, default: 0 },
  metadata: { type: Schema.Types.Mixed }
}, { _id: false });

const ExecutionLogSchema = new Schema({
  id: { type: String, required: true },
  timestamp: { type: Date, required: true },
  level: {
    type: String,
    enum: ['info', 'warn', 'error', 'debug'],
    required: true
  },
  nodeId: { type: String },
  message: { type: String, required: true },
  data: { type: Schema.Types.Mixed }
}, { _id: false });

const ExecutionSchema = new Schema<IExecution>(
  {
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: 'Workflow',
      required: true,
      index: true
    },
    workflowVersion: {
      type: Number,
      required: true,
      default: 1
    },
    status: {
      type: String,
      enum: Object.values(ExecutionStatus),
      required: true,
      default: ExecutionStatus.PENDING,
      index: true
    },
    triggerType: {
      type: String,
      enum: Object.values(TriggerType),
      required: true
    },
    triggerData: {
      type: Schema.Types.Mixed,
      default: {}
    },
    context: {
      userId: { type: String, index: true },
      sessionId: { type: String },
      variables: {
        type: Schema.Types.Mixed,
        default: {}
      }
    },
    nodeResults: [NodeResultSchema],
    executionPath: [String],
    logs: [ExecutionLogSchema],
    error: {
      message: { type: String },
      nodeId: { type: String },
      stack: { type: String }
    },
    stats: {
      totalNodes: { type: Number, default: 0 },
      completedNodes: { type: Number, default: 0 },
      failedNodes: { type: Number, default: 0 },
      skippedNodes: { type: Number, default: 0 },
      totalRetries: { type: Number, default: 0 },
      totalDuration: { type: Number }
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    completedAt: { type: Date },
    cancelledAt: { type: Date }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient querying
ExecutionSchema.index({ 'context.userId': 1, createdAt: -1 });
ExecutionSchema.index({ workflowId: 1, status: 1, createdAt: -1 });
ExecutionSchema.index({ status: 1, createdAt: -1 });

// TTL index for automatic cleanup of old executions (optional, 90 days)
ExecutionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60, partialFilterExpression: { status: { $in: [ExecutionStatus.COMPLETED, ExecutionStatus.FAILED, ExecutionStatus.CANCELLED] } } }
);

// Instance methods
ExecutionSchema.methods.addLog = function(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  nodeId?: string,
  data?: Record<string, unknown>
): void {
  const { v4: uuidv4 } = require('uuid');
  this.logs.push({
    id: uuidv4(),
    timestamp: new Date(),
    level,
    nodeId,
    message,
    data
  });
};

ExecutionSchema.methods.updateNodeResult = function(result: Partial<NodeResultType>): void {
  const existingIndex = this.nodeResults.findIndex(r => r.nodeId === result.nodeId);

  if (existingIndex >= 0) {
    this.nodeResults[existingIndex] = {
      ...this.nodeResults[existingIndex],
      ...result
    } as typeof this.nodeResults[0];
  } else {
    this.nodeResults.push(result as typeof this.nodeResults[0]);
  }

  // Update stats
  this.stats.completedNodes = this.nodeResults.filter(r => r.status === NodeStatus.COMPLETED).length;
  this.stats.failedNodes = this.nodeResults.filter(r => r.status === NodeStatus.FAILED).length;
  this.stats.skippedNodes = this.nodeResults.filter(r => r.status === NodeStatus.SKIPPED).length;
  this.stats.totalRetries = this.nodeResults.reduce((sum, r) => sum + r.retryCount, 0);
};

ExecutionSchema.methods.markStarted = function(nodeId: string): void {
  this.status = ExecutionStatus.RUNNING;
  this.startedAt = new Date();
  this.executionPath.push(nodeId);
  this.addLog('info', `Execution started at node ${nodeId}`, nodeId);
};

ExecutionSchema.methods.markCompleted = function(): void {
  this.status = ExecutionStatus.COMPLETED;
  this.completedAt = new Date();
  this.stats.totalDuration = this.completedAt.getTime() - this.startedAt.getTime();
  this.addLog('info', 'Execution completed successfully');
};

ExecutionSchema.methods.markFailed = function(error: string, nodeId?: string): void {
  this.status = ExecutionStatus.FAILED;
  this.completedAt = new Date();
  this.error = { message: error, nodeId };
  this.stats.totalDuration = this.completedAt.getTime() - this.startedAt.getTime();
  this.addLog('error', `Execution failed: ${error}`, nodeId);
};

ExecutionSchema.methods.markCancelled = function(): void {
  this.status = ExecutionStatus.CANCELLED;
  this.cancelledAt = new Date();
  this.addLog('info', 'Execution cancelled');
};

// Static methods
ExecutionSchema.statics.findByWorkflow = function(
  workflowId: string,
  options: { page?: number; limit?: number; status?: ExecutionStatus } = {}
) {
  const { page = 1, limit = 20, status } = options;
  const query: Record<string, unknown> = { workflowId };

  if (status) {
    query.status = status;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

ExecutionSchema.statics.getStats = async function(workflowId?: string) {
  const match: Record<string, unknown> = {};
  if (workflowId) {
    match.workflowId = new mongoose.Types.ObjectId(workflowId);
  }

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalExecutions: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', ExecutionStatus.COMPLETED] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', ExecutionStatus.FAILED] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', ExecutionStatus.CANCELLED] }, 1, 0] } },
        running: { $sum: { $cond: [{ $eq: ['$status', ExecutionStatus.RUNNING] }, 1, 0] } },
        avgDuration: { $avg: '$stats.totalDuration' },
        avgNodesCompleted: { $avg: '$stats.completedNodes' }
      }
    }
  ]);

  return stats[0] || {
    totalExecutions: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    running: 0,
    avgDuration: 0,
    avgNodesCompleted: 0
  };
};

// Pre-save middleware
ExecutionSchema.pre('save', function(next) {
  if (this.isModified('nodeResults')) {
    this.stats.totalNodes = Math.max(
      this.stats.totalNodes,
      this.nodeResults.length
    );
  }
  next();
});

export const Execution = mongoose.model<IExecution, ExecutionModel>('Execution', ExecutionSchema);

// ==================== WORKFLOW MODEL ====================

export interface IWorkflow extends Document {
  workflowId: string;
  name: string;
  description?: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  definition: Record<string, unknown>;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  entryNodeId: string;
  variables?: Record<string, unknown>;
  metadata?: {
    createdBy?: string;
    tags?: string[];
    category?: string;
  };
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  publish(): Promise<IWorkflow>;
}

const WorkflowSchema = new Schema<IWorkflow>(
  {
    workflowId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      index: true
    },
    description: { type: String },
    version: {
      type: Number,
      required: true,
      default: 1
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      required: true,
      default: 'draft'
    },
    definition: {
      type: Schema.Types.Mixed,
      required: true
    },
    nodes: [Schema.Types.Mixed],
    edges: [Schema.Types.Mixed],
    entryNodeId: {
      type: String,
      required: true
    },
    variables: Schema.Types.Mixed,
    metadata: {
      createdBy: String,
      tags: [String],
      category: String
    },
    publishedAt: Date
  },
  {
    timestamps: true
  }
);

WorkflowSchema.index({ status: 1, updatedAt: -1 });
WorkflowSchema.index({ 'metadata.tags': 1 });
WorkflowSchema.index({ 'metadata.category': 1 });

WorkflowSchema.statics.publish = async function(workflowId: string) {
  const workflow = await this.findOne({ workflowId });
  if (!workflow) {
    throw new Error('Workflow not found');
  }

  workflow.status = 'published';
  workflow.publishedAt = new Date();
  workflow.version += 1;
  await workflow.save();

  return workflow;
};

export const Workflow = mongoose.model<IWorkflow, WorkflowModel>('Workflow', WorkflowSchema);

export default { Execution, Workflow };
