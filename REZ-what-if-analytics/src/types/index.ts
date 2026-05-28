import { z } from 'zod';

export const ScenarioType = z.enum([
  'pricing',
  'demand',
  'promotion',
  'inventory',
  'customer',
  'marketing',
  'operational',
  'financial'
]);
export type ScenarioType = z.infer<typeof ScenarioType>;

export const MetricType = z.enum([
  'revenue',
  'margin',
  'units_sold',
  'customers',
  'conversion_rate',
  'avg_order_value',
  'retention_rate',
  'acquisition_cost',
  'ltv',
  'market_share'
]);
export type MetricType = z.infer<typeof MetricType>;

export const TimeHorizon = z.enum([
  'day',
  'week',
  'month',
  'quarter',
  'year'
]);
export type TimeHorizon = z.infer<typeof TimeHorizon>;

export const ScenarioSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  type: ScenarioType,
  baselineId: z.string().optional(),
  assumptions: z.record(z.union([z.string(), z.number()])),
  parameters: z.object({
    metric: MetricType,
    changePercent: z.number().min(-100).max(1000),
    timeHorizon: TimeHorizon,
    confidenceLevel: z.number().min(0).max(1).default(0.95).optional()
  }),
  constraints: z.array(z.object({
    type: z.enum(['min', 'max', 'equal']),
    metric: MetricType,
    value: z.number()
  })).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const ScenarioResultSchema = z.object({
  scenarioId: z.string(),
  baselineMetrics: z.record(z.string(), z.number()),
  projectedMetrics: z.record(z.string(), z.number()),
  deltas: z.record(z.string(), z.number()),
  percentChanges: z.record(z.string(), z.number()),
  confidenceInterval: z.object({
    lower: z.record(z.string(), z.number()),
    upper: z.record(z.string(), z.number())
  }),
  riskScore: z.number().min(0).max(100),
  recommendations: z.array(z.object({
    action: z.string(),
    impact: z.enum(['high', 'medium', 'low']),
    confidence: z.number().min(0).max(1)
  })),
  simulatedAt: z.date()
});
export type ScenarioResult = z.infer<typeof ScenarioResultSchema>;

export const WhatIfQuerySchema = z.object({
  whatIf: z.string().describe('Natural language what-if question'),
  context: z.object({
    businessType: z.enum(['restaurant', 'retail', 'salon', 'hotel', 'fitness', 'ecommerce', 'marketplace']).optional(),
    currentMetrics: z.record(z.number()).optional(),
    timeHorizon: TimeHorizon.optional()
  }).optional()
});
export type WhatIfQuery = z.infer<typeof WhatIfQuerySchema>;

export const SensitivityAnalysisSchema = z.object({
  metric: MetricType,
  inputVariables: z.array(z.string()),
  ranges: z.record(z.object({
    min: z.number(),
    max: z.number(),
    step: z.number()
  })),
  outputMetrics: z.array(MetricType)
});
export type SensitivityAnalysis = z.infer<typeof SensitivityAnalysisSchema>;

export interface ISimulationEngine {
  runScenario(scenario: Scenario): Promise<ScenarioResult>;
  compareScenarios(scenarioIds: string[]): Promise<ScenarioComparison>;
  sensitivityAnalysis(params: SensitivityAnalysis): Promise<SensitivityResult>;
}

export interface ScenarioComparison {
  scenarioIds: string[];
  metrics: Record<MetricType, Record<string, number>>;
  rankings: Record<MetricType, string[]>;
  winner: string;
}

export interface SensitivityResult {
  inputVariable: string;
  impactOnOutputs: Record<MetricType, number>;
  tornadoData: Array<{ variable: string; impact: number }>;
}

export interface MonteCarloResult {
  metric: MetricType;
  mean: number;
  median: number;
  stdDev: number;
  percentiles: Record<number, number>;
  histogram: Array<{ range: string; frequency: number }>;
  probabilityOfGoal: number;
}

export const MonteCarloParamsSchema = z.object({
  metric: MetricType,
  simulations: z.number().min(100).max(100000).default(10000).optional(),
  inputDistributions: z.record(z.object({
    type: z.enum(['normal', 'uniform', 'triangular', 'poisson', 'exponential']),
    params: z.record(z.number())
  })),
  goalThreshold: z.number().optional()
});
export type MonteCarloParams = z.infer<typeof MonteCarloParamsSchema>;
