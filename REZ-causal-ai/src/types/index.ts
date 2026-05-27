import { z } from 'zod';

export const CausalMethod = z.enum([
  'correlation',
  'regression',
  'difference_in_differences',
  'propensity_score_matching',
  'instrumental_variables',
  'causal_forest',
  'doubly_robust',
  'syntactic'
]);
export type CausalMethod = z.infer<typeof CausalMethod>;

export const OutcomeType = z.enum([
  'binary',
  'continuous',
  'count',
  'survival'
]);
export type OutcomeType = z.infer<typeof OutcomeType>;

export const TreatmentType = z.enum([
  'binary',
  'categorical',
  'continuous'
]);
export type TreatmentType = z.infer<typeof TreatmentType>;

export const CausalAnalysisRequestSchema = z.object({
  analysisId: z.string().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  outcomeVariable: z.string().min(1),
  treatmentVariable: z.string().min(1),
  treatmentType: TreatmentType,
  outcomeType: OutcomeType,
  method: CausalMethod.default('correlation'),
  covariates: z.array(z.string()),
  data: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))).optional(),
  sampleSize: z.number().optional()
});
export type CausalAnalysisRequest = z.infer<typeof CausalAnalysisRequestSchema>;

export const UpliftModelRequestSchema = z.object({
  modelId: z.string().optional(),
  name: z.string().min(1).max(200),
  treatment: z.string().min(1),
  outcome: z.string().min(1),
  features: z.array(z.string()),
  modelType: z.enum(['t-learner', 's-learner', 'x-learner', 'causal_forest', 'uplift_tree']).default('t-learner'),
  targetPopulation: z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
  controlPopulation: z.array(z.record(z.string(), z.union([z.string(), z.number()]))).optional()
});
export type UpliftModelRequest = z.infer<typeof UpliftModelRequestSchema>;

export const CounterfactualRequestSchema = z.object({
  entityId: z.string(),
  entityData: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  intervention: z.object({
    variable: z.string(),
    newValue: z.union([z.string(), z.number(), z.boolean()])
  }),
  causalModel: z.string().optional()
});
export type CounterfactualRequest = z.infer<typeof CounterfactualRequestSchema>;

export interface CausalResult {
  analysisId: string;
  method: CausalMethod;
  treatmentEffect: {
    ate: number;
    ateStdError: number;
    ateCI: [number, number];
    atePValue: number;
  };
  uplift?: {
    targetEffect: number;
    controlEffect: number;
    upliftScore: number;
    confidence: number;
  };
  heterogeneity?: {
    subgroup: string;
    treatmentEffect: number;
    sampleSize: number;
  }[];
  confounders: {
    variable: string;
    effect: number;
    significance: number;
  }[];
  diagnostics: {
    test: string;
    statistic: number;
    pValue: number;
    passed: boolean;
  }[];
  recommendations: {
    action: string;
    impact: 'high' | 'medium' | 'low';
    confidence: number;
  }[];
  analyzedAt: Date;
}

export interface UpliftResult {
  modelId: string;
  upliftScores: {
    entityId: string;
    predictedUplift: number;
    confidence: number;
    recommendedAction: 'treat' | 'control' | 'uncertain';
  }[];
  segmentAnalysis: {
    segment: string;
    averageUplift: number;
    segmentSize: number;
    recommendation: string;
  }[];
  modelMetrics: {
    qini: number;
    auuc: number;
    upliftAtTop: number;
  };
  generatedAt: Date;
}

export interface CounterfactualResult {
  entityId: string;
  originalOutcome: number;
  counterfactualOutcome: number;
  causalEffect: number;
  confidenceInterval: [number, number];
  assumptions: string[];
  generatedAt: Date;
}
