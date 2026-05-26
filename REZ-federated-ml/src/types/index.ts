import { z } from 'zod';

export const ClientNodeSchema = z.object({
  clientId: z.string().min(1),
  nodeType: z.enum(['mobile', 'edge', 'server', 'browser']),
  capabilities: z.object({
    computeUnits: z.number().optional(),
    memoryMB: z.number().optional(),
    supportedAlgorithms: z.array(z.string()).optional(),
    maxModelSizeMB: z.number().optional(),
  }),
  status: z.enum(['active', 'inactive', 'training', 'disconnected']),
  lastSync: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ClientNode = z.infer<typeof ClientNodeSchema>;

export const FederatedTrainingConfigSchema = z.object({
  rounds: z.number().min(1).max(1000),
  minClientsPerRound: z.number().min(1).max(100),
  clientSelectionStrategy: z.enum(['random', 'bandwidth', 'availability', 'weighted']),
  aggregationAlgorithm: z.enum(['fedavg', 'fedprox', 'scaffold', 'fednova']),
  learningRate: z.number().positive(),
  batchSize: z.number().positive().optional(),
  epochsPerRound: z.number().positive().optional(),
  momentum: z.number().min(0).max(1).optional(),
  privacyBudget: z.number().positive().optional(),
  differentialPrivacy: z.object({
    enabled: z.boolean(),
    epsilon: z.number().positive().optional(),
    delta: z.number().positive().optional(),
    maxGradNorm: z.number().positive().optional(),
  }).optional(),
});

export type FederatedTrainingConfig = z.infer<typeof FederatedTrainingConfigSchema>;

export const ModelUpdateSchema = z.object({
  clientId: z.string().min(1),
  roundNumber: z.number().min(1),
  weights: z.array(z.number()),
  numSamples: z.number().min(1),
  trainingLoss: z.number().optional(),
  validationAccuracy: z.number().optional(),
  gradients: z.array(z.number()).optional(),
  clientTimestamp: z.string().datetime(),
});

export type ModelUpdate = z.infer<typeof ModelUpdateSchema>;

export const AggregatedModelSchema = z.object({
  modelId: z.string(),
  roundNumber: z.number(),
  globalWeights: z.array(z.number()),
  aggregatedFrom: z.array(z.string()),
  aggregationMetrics: z.object({
    totalSamples: z.number(),
    avgLoss: z.number().optional(),
    weightedAccuracy: z.number().optional(),
    staleness: z.number().optional(),
  }),
  privacyMetrics: z.object({
    noiseAdded: z.number().optional(),
    clipRatio: z.number().optional(),
  }).optional(),
  createdAt: z.string().datetime(),
});

export type AggregatedModel = z.infer<typeof AggregatedModelSchema>;

export const FederatedTrainingRequestSchema = z.object({
  modelConfig: FederatedTrainingConfigSchema,
  clientPool: z.array(z.string()),
  initialWeights: z.array(z.number()).optional(),
  modelArchitecture: z.object({
    type: z.enum(['neural_network', 'tree', 'linear', 'ensemble']),
    layers: z.array(z.object({
      type: z.string(),
      units: z.number().optional(),
      activation: z.string().optional(),
    })).optional(),
    inputDim: z.number().optional(),
    outputDim: z.number().optional(),
  }).optional(),
});

export type FederatedTrainingRequest = z.infer<typeof FederatedTrainingRequestSchema>;

export const TrainingStatusSchema = z.object({
  trainingId: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'paused']),
  currentRound: z.number(),
  totalRounds: z.number(),
  participatingClients: z.array(z.string()),
  aggregatedMetrics: z.object({
    globalLoss: z.number().optional(),
    globalAccuracy: z.number().optional(),
    clientsPerRound: z.number().optional(),
    avgRoundTime: z.number().optional(),
  }).optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  error: z.string().optional(),
});

export type TrainingStatus = z.infer<typeof TrainingStatusSchema>;

export interface FederatedMetrics {
  roundNumber: number;
  globalAccuracy: number;
  globalLoss: number;
  participatingClients: number;
  totalSamples: number;
  avgRoundDuration: number;
  modelStaleness: number;
}

export interface ClientMetrics {
  clientId: string;
  roundsParticipated: number;
  avgLocalAccuracy: number;
  avgLocalLoss: number;
  totalDataProcessed: number;
  lastActiveAt: string;
}
