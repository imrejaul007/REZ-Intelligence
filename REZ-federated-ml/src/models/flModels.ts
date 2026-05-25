import mongoose, { Schema, Document } from 'mongoose';

export interface IFLNodeDocument extends Document {
  nodeId: string;
  nodeName: string;
  organizationId?: string;
  status: string;
  datasetsCount: number;
  totalSamples: number;
  lastActive: Date;
  capabilities: {
    maxBatchSize: number;
    supportsSecureAggregation: boolean;
    supportsDifferentialPrivacy: boolean;
  };
  performance: {
    avgRoundTime: number;
    roundsCompleted: number;
    successRate: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const FLNodeSchema = new Schema<IFLNodeDocument>({
  nodeId: { type: String, required: true, unique: true, index: true },
  nodeName: { type: String, required: true },
  organizationId: { type: String, index: true },
  status: { type: String, enum: ['registered', 'training', 'idle', 'offline', 'error'], default: 'registered' },
  datasetsCount: { type: Number, default: 0 },
  totalSamples: { type: Number, default: 0 },
  lastActive: { type: Date, default: Date.now },
  capabilities: {
    maxBatchSize: { type: Number, default: 1000 },
    supportsSecureAggregation: { type: Boolean, default: false },
    supportsDifferentialPrivacy: { type: Boolean, default: true }
  },
  performance: {
    avgRoundTime: { type: Number, default: 0 },
    roundsCompleted: { type: Number, default: 0 },
    successRate: { type: Number, default: 1.0 }
  }
}, { timestamps: true });

FLNodeSchema.index({ status: 1 });
FLNodeSchema.index({ organizationId: 1 });

export const FLNodeModel = mongoose.model<IFLNodeDocument>('FLNode', FLNodeSchema);

export interface IFLJobDocument extends Document {
  jobId: string;
  name: string;
  description?: string;
  config: {
    modelType: string;
    privacyMechanism: string;
    minNodesRequired: number;
    maxNodesPerRound: number;
    rounds: number;
    epochsPerRound: number;
    batchSize: number;
    learningRate: number;
    momentum: number;
    regularization: number;
    earlyStoppingPatience: number;
    differentialPrivacyEpsilon: number;
    differentialPrivacyDelta: number;
    secureAggregationThreshold: number;
    features: string[];
    targetColumn: string;
    validationSplit: number;
  };
  status: string;
  startedAt?: Date;
  completedAt?: Date;
  currentRound: number;
  totalRounds: number;
  globalModelVersion?: string;
  bestMetrics?: {
    accuracy?: number;
    loss?: number;
    round?: number;
  };
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FLJobSchema = new Schema<IFLJobDocument>({
  jobId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, maxlength: 200 },
  description: { type: String, maxlength: 1000 },
  config: { type: Schema.Types.Mixed, required: true },
  status: {
    type: String,
    enum: ['pending', 'training', 'paused', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  startedAt: { type: Date },
  completedAt: { type: Date },
  currentRound: { type: Number, default: 0 },
  totalRounds: { type: Number, required: true },
  globalModelVersion: { type: String },
  bestMetrics: {
    accuracy: { type: Number },
    loss: { type: Number },
    round: { type: Number }
  },
  createdBy: { type: String }
}, { timestamps: true });

FLJobSchema.index({ status: 1 });
FLJobSchema.index({ createdBy: 1 });

export const FLJobModel = mongoose.model<IFLJobDocument>('FLJob', FLJobSchema);

export interface ITrainingRoundDocument extends Document {
  roundId: string;
  jobId: string;
  roundNumber: number;
  status: string;
  participatingNodes: string[];
  requiredNodes: number;
  aggregatedWeights?: number[];
  aggregatedBias?: number[];
  validationAccuracy?: number;
  validationLoss?: number;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
}

const TrainingRoundSchema = new Schema<ITrainingRoundDocument>({
  roundId: { type: String, required: true, unique: true, index: true },
  jobId: { type: String, required: true, index: true },
  roundNumber: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'aggregating', 'completed', 'failed'],
    default: 'pending'
  },
  participatingNodes: [{ type: String }],
  requiredNodes: { type: Number, required: true },
  aggregatedWeights: [{ type: Number }],
  aggregatedBias: [{ type: Number }],
  validationAccuracy: { type: Number },
  validationLoss: { type: Number },
  startTime: { type: Date },
  endTime: { type: Date },
  duration: { type: Number }
}, { timestamps: true });

TrainingRoundSchema.index({ jobId: 1, roundNumber: 1 });
TrainingRoundSchema.index({ status: 1 });

export const TrainingRoundModel = mongoose.model<ITrainingRoundDocument>('TrainingRound', TrainingRoundSchema);

export interface INodeContributionDocument extends Document {
  contributionId: string;
  roundId: string;
  jobId: string;
  nodeId: string;
  nodeName: string;
  localWeights: number[];
  localBias: number[];
  sampleCount: number;
  trainingMetrics: {
    loss: number;
    accuracy?: number;
    samplesProcessed: number;
  };
  privacyMetadata?: {
    mechanism: string;
    noiseScale?: number;
    clippingNorm?: number;
    secureAggregationProof?: string;
  };
  status: string;
  receivedAt: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NodeContributionSchema = new Schema<INodeContributionDocument>({
  contributionId: { type: String, required: true, unique: true, index: true },
  roundId: { type: String, required: true, index: true },
  jobId: { type: String, required: true, index: true },
  nodeId: { type: String, required: true, index: true },
  nodeName: { type: String, required: true },
  localWeights: [{ type: Number }],
  localBias: [{ type: Number }],
  sampleCount: { type: Number, required: true },
  trainingMetrics: {
    loss: { type: Number },
    accuracy: { type: Number },
    samplesProcessed: { type: Number }
  },
  privacyMetadata: {
    mechanism: { type: String },
    noiseScale: { type: Number },
    clippingNorm: { type: Number },
    secureAggregationProof: { type: String }
  },
  status: { type: String, enum: ['received', 'processed', 'failed'], default: 'received' },
  receivedAt: { type: Date, default: Date.now },
  processedAt: { type: Date }
}, { timestamps: true });

NodeContributionSchema.index({ roundId: 1, nodeId: 1 }, { unique: true });
NodeContributionSchema.index({ jobId: 1, status: 1 });

export const NodeContributionModel = mongoose.model<INodeContributionDocument>('NodeContribution', NodeContributionSchema);
