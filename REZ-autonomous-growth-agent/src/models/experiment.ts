import { z } from 'zod';

/**
 * Growth goal types
 */
export enum GoalType {
  REVENUE = 'revenue',
  CUSTOMERS = 'customers',
  ENGAGEMENT = 'engagement',
  RETENTION = 'retention',
  ACQUISITION = 'acquisition',
  CONVERSION = 'conversion'
}

/**
 * Metric types for tracking
 */
export enum MetricType {
  REVENUE = 'revenue',
  TRANSACTIONS = 'transactions',
  ACTIVE_USERS = 'active_users',
  SESSIONS = 'sessions',
  CONVERSION_RATE = 'conversion_rate',
  RETENTION_RATE = 'retention_rate',
  AOV = 'aov',
  LTV = 'ltv',
  CAC = 'cac',
  NPS = 'nps'
}

/**
 * Experiment status
 */
export enum ExperimentStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REJECTED = 'rejected'
}

/**
 * Hypothesis confidence level
 */
export enum ConfidenceLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

/**
 * Target segment definition
 */
export const TargetSegmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  criteria: z.object({
    ageRanges: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional(),
    userTypes: z.array(z.enum(['new', 'existing', 'churned', 'vip'])).optional(),
    activities: z.array(z.string()).optional(),
    spendRanges: z.object({
      min: z.number().optional(),
      max: z.number().optional()
    }).optional(),
    customFilters: z.record(z.any()).optional()
  }),
  size: z.number(),
  estimatedReach: z.number()
});

export type TargetSegment = z.infer<typeof TargetSegmentSchema>;

/**
 * Experiment hypothesis
 */
export const ExperimentHypothesisSchema = z.object({
  id: z.string(),
  statement: z.string(),
  expectedOutcome: z.string(),
  confidenceLevel: z.nativeEnum(ConfidenceLevel),
  supportingData: z.string().optional(),
  risks: z.array(z.string())
});

export type ExperimentHypothesis = z.infer<typeof ExperimentHypothesisSchema>;

/**
 * Experiment variant
 */
export const ExperimentVariantSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  trafficAllocation: z.number().min(0).max(100),
  changes: z.object({
    messaging: z.string().optional(),
    visuals: z.array(z.string()).optional(),
    targeting: z.record(z.any()).optional(),
    timing: z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional()
    }).optional(),
    channel: z.string().optional(),
    custom: z.record(z.any()).optional()
  }),
  successCriteria: z.object({
    primary: z.object({
      metric: z.nativeEnum(MetricType),
      improvement: z.number(),
      minimumSampleSize: z.number()
    }),
    secondary: z.array(z.object({
      metric: z.nativeEnum(MetricType),
      improvement: z.number()
    })).optional()
  })
});

export type ExperimentVariant = z.infer<typeof ExperimentVariantSchema>;

/**
 * Experiment budget
 */
export const ExperimentBudgetSchema = z.object({
  totalBudget: z.number().positive(),
  spent: z.number().min(0),
  currency: z.string().default('INR'),
  dailyLimit: z.number().positive().optional(),
  autoPauseThreshold: z.number().min(0).max(1).optional()
});

export type ExperimentBudget = z.infer<typeof ExperimentBudgetSchema>;

/**
 * Main experiment schema
 */
export const ExperimentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  goalType: z.nativeEnum(GoalType),
  targetMetric: z.nativeEnum(MetricType),
  hypothesis: ExperimentHypothesisSchema,
  variants: z.array(ExperimentVariantSchema).min(2),
  targetSegment: TargetSegmentSchema,
  budget: ExperimentBudgetSchema,
  status: z.nativeEnum(ExperimentStatus).default(ExperimentStatus.DRAFT),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  owner: z.string(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

export type Experiment = z.infer<typeof ExperimentSchema>;

/**
 * Experiment results
 */
export const ExperimentResultsSchema = z.object({
  experimentId: z.string(),
  variantResults: z.array(z.object({
    variantId: z.string(),
    variantName: z.string(),
    sampleSize: z.number(),
    conversions: z.number(),
    conversionRate: z.number(),
    revenue: z.number(),
    primaryMetricValue: z.number(),
    primaryMetricImprovement: z.number().optional(),
    secondaryMetrics: z.record(z.number()),
    statisticalSignificance: z.number(),
    confidenceInterval: z.object({
      lower: z.number(),
      upper: z.number()
    }),
    isWinner: z.boolean().optional()
  })),
  overallResults: z.object({
    totalSampleSize: z.number(),
    totalConversions: z.number(),
    overallConversionRate: z.number(),
    totalRevenue: z.number(),
    duration: z.number(),
    learnings: z.array(z.string())
  }),
  recommendation: z.object({
    action: z.enum(['scale', 'kill', 'iterate', 'hold']),
    winningVariant: z.string().optional(),
    scaleFactor: z.number().optional(),
    reasoning: z.string()
  }),
  calculatedAt: z.string()
});

export type ExperimentResults = z.infer<typeof ExperimentResultsSchema>;

/**
 * Growth goal definition
 */
export const GrowthGoalSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.nativeEnum(GoalType),
  targetValue: z.number(),
  currentValue: z.number(),
  unit: z.enum(['absolute', 'percentage', 'currency']),
  deadline: z.string(),
  priority: z.number().min(1).max(5),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(['active', 'paused', 'achieved', 'expired'])
});

export type GrowthGoal = z.infer<typeof GrowthGoalSchema>;

/**
 * Create experiment request
 */
export const CreateExperimentRequestSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500),
  goalType: z.nativeEnum(GoalType),
  targetMetric: z.nativeEnum(MetricType),
  hypothesis: z.object({
    statement: z.string(),
    expectedOutcome: z.string(),
    confidenceLevel: z.nativeEnum(ConfidenceLevel),
    supportingData: z.string().optional(),
    risks: z.array(z.string())
  }),
  variants: z.array(z.object({
    name: z.string(),
    description: z.string(),
    trafficAllocation: z.number().min(0).max(100),
    changes: z.record(z.any())
  })).min(2),
  targetSegment: z.object({
    name: z.string(),
    criteria: z.record(z.any())
  }),
  budget: z.object({
    totalBudget: z.number().positive(),
    currency: z.string().optional(),
    dailyLimit: z.number().positive().optional()
  }),
  owner: z.string(),
  tags: z.array(z.string()).optional()
});

export type CreateExperimentRequest = z.infer<typeof CreateExperimentRequestSchema>;
