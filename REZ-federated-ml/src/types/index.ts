import { z } from 'zod';

export const ModelType = z.enum([
  'linear_regression',
  'logistic_regression',
  'decision_tree',
  'random_forest',
  'gradient_boosting',
  'neural_network',
  'matrix_factorization',
  'clustering'
]);
export type ModelType = z.infer<typeof ModelType>;

export const PrivacyMechanism = z.enum([
  'none',
  'differential_privacy',
  'secure_aggregation',
  'homomorphic_encryption'
]);
export type PrivacyMechanism = z.infer<typeof PrivacyMechanism>;

export const FLNodeStatus = z.enum([
  'registered',
  'training',
  'idle',
  'offline',
  'error'
]);
export type FLNodeStatus = z.infer<typeof FLNodeStatus>;

export const RoundStatus = z.enum([
  'pending',
  'in_progress',
  'aggregating',
  'completed',
  'failed'
]);
export type RoundStatus = z.infer<typeof RoundStatus>;

export const FederatedConfigSchema = z.object({
  modelType: ModelType,
  privacyMechanism: PrivacyMechanism.default('differential_privacy'),
  minNodesRequired: z.number().min(2).default(3),
  maxNodesPerRound: z.number().min(2).default(100),
  rounds: z.number().min(1).max(1000).default(100),
  epochsPerRound: z.number().min(1).max(100).default(5),
  batchSize: z.number().min(1).max(10000).default(32),
  learningRate: z.number().min(0.0001).max(1).default(0.001),
  momentum: z.number().min(0).max(0.99).default(0.9),
  regularization: z.number().min(0).max(1).default(0.0001),
  earlyStoppingPatience: z.number().min(1).max(100).default(10),
  differentialPrivacyEpsilon: z.number().min(0.1).max(10).default(1.0),
  differentialPrivacyDelta: z.number().min(0).max(0.1).default(1e-5),
  secureAggregationThreshold: z.number().min(0.5).max(1).default(0.8),
  features: z.array(z.string()),
  targetColumn: z.string(),
  validationSplit: z.number().min(0).max(1).default(0.2)
});
export type FederatedConfig = z.infer<typeof FederatedConfigSchema>;

export const FLNodeSchema = z.object({
  nodeId: z.string(),
  nodeName: z.string(),
  organizationId: z.string().optional(),
  status: FLNodeStatus,
  datasetsCount: z.number().default(0),
  totalSamples: z.number().default(0),
  lastActive: z.date().optional(),
  capabilities: z.object({
    maxBatchSize: z.number().default(1000),
    supportsSecureAggregation: z.boolean().default(false),
    supportsDifferentialPrivacy: z.boolean().default(true)
  }),
  performance: z.object({
    avgRoundTime: z.number().default(0),
    roundsCompleted: z.number().default(0),
    successRate: z.number().default(1.0)
  })
});
export type FLNode = z.infer<typeof FLNodeSchema>;

export const TrainingRoundSchema = z.object({
  roundId: z.string(),
  jobId: z.string(),
  roundNumber: z.number(),
  status: RoundStatus,
  participatingNodes: z.array(z.string()),
  requiredNodes: z.number(),
  aggregatedWeights: Record<string, number[]>.optional(),
  aggregatedBias: number[].optional(),
  validationAccuracy: z.number().optional(),
  validationLoss: z.number().optional(),
  startTime: z.date().optional(),
  endTime: z.date().optional(),
  duration: z.number().optional(),
  createdAt: z.date()
});
export type TrainingRound = z.infer<typeof TrainingRoundSchema>;

export const FLJobSchema = z.object({
  jobId: z.string().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  config: FederatedConfigSchema,
  status: z.enum(['pending', 'training', 'paused', 'completed', 'failed', 'cancelled']),
  createdAt: z.date().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  currentRound: z.number().default(0),
  totalRounds: z.number(),
  globalModelVersion: z.string().optional(),
  bestMetrics: z.object({
    accuracy: z.number().optional(),
    loss: z.number().optional(),
    round: z.number().optional()
  }).optional(),
  createdBy: z.string().optional()
});
export type FLJob = z.infer<typeof FLJobSchema>;

export const NodeRegistrationSchema = z.object({
  nodeName: z.string().min(1).max(100),
  organizationId: z.string().optional(),
  capabilities: z.object({
    maxBatchSize: z.number().min(1).default(1000),
    supportsSecureAggregation: z.boolean().default(false),
    supportsDifferentialPrivacy: z.boolean().default(true)
  }).optional()
});
export type NodeRegistration = z.infer<typeof NodeRegistrationSchema>;

export const LocalTrainingRequestSchema = z.object({
  jobId: z.string(),
  roundNumber: z.number(),
  nodeId: z.string(),
  localModelWeights: z.array(z.number()),
  localModelBias: z.array(z.number()),
  gradientUpdates: z.array(z.number()).optional(),
  sampleCount: z.number(),
  trainingMetrics: z.object({
    loss: z.number(),
    accuracy: z.number().optional(),
    samplesProcessed: z.number()
  }),
  privacyMetadata: z.object({
    mechanism: PrivacyMechanism,
    noiseScale: z.number().optional(),
    clippingNorm: z.number().optional(),
    secureAggregationProof: z.string().optional()
  }).optional()
});
export type LocalTrainingRequest = z.infer<typeof LocalTrainingRequestSchema>;

export interface AggregationResult {
  jobId: string;
  roundNumber: number;
  globalWeights: number[];
  globalBias: number[];
  participatingNodes: number;
  aggregationMethod: string;
  privacyMechanism: PrivacyMechanism;
  noiseAdded: number;
  convergenceScore: number;
}

export interface PrivacyBudget {
  spentEpsilon: number;
  remainingEpsilon: number;
  totalBudget: number;
  roundsUsed: number;
  compositionBound: number;
}

export interface ModelContribution {
  nodeId: string;
  weight: number;
  contribution: number;
  privacyCost: number;
}
