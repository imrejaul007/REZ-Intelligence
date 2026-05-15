import { z } from 'zod';
import { Document } from 'mongoose';

// ============================================================
// ENUMS & CONSTANTS
// ============================================================

export enum ExperimentStatus {
  DRAFT = 'draft',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
}

export enum AudiencePercentage {
  DEFAULT = 100,
}

// ============================================================
// ZOD SCHEMAS
// ============================================================

export const VariantConfigSchema = z.object({
  variantId: z.string(),
  name: z.string(),
  weight: z.number().min(0).max(100).default(50),
  config: z.record(z.unknown()).optional(),
});

export const TargetSchema = z.object({
  metric: z.string(),
  goal: z.string().optional(),
  minimumDetectableEffect: z.number().optional(),
});

export const AudienceSchema = z.object({
  userSegments: z.array(z.string()).default([]),
  apps: z.array(z.string()).default([]),
  percentage: z.number().min(0).max(100).default(100),
});

export const StatsSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  sampleSize: z.number().optional(),
  confidence: z.number().min(0).max(1).default(0.95),
});

export const VariantResultSchema = z.object({
  variantId: z.string(),
  name: z.string().optional(),
  conversions: z.number().default(0),
  users: z.number().default(0),
  rate: z.number().default(0),
  uplift: z.number().optional(),
  pValue: z.number().optional(),
  significant: z.boolean().optional(),
});

export const ControlResultSchema = z.object({
  conversions: z.number().default(0),
  users: z.number().default(0),
  rate: z.number().default(0),
});

export const ResultsSchema = z.object({
  control: ControlResultSchema,
  variants: z.array(VariantResultSchema),
});

export const ExperimentSchema = z.object({
  experimentId: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  status: z.nativeEnum(ExperimentStatus).default(ExperimentStatus.DRAFT),
  hypothesis: z.string().optional(),
  variants: z.array(VariantConfigSchema),
  target: TargetSchema,
  audience: AudienceSchema.default({}),
  stats: StatsSchema.optional(),
  results: ResultsSchema.optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export const AssignmentSchema = z.object({
  assignmentId: z.string(),
  experimentId: z.string(),
  userId: z.string(),
  variantId: z.string(),
  assignedAt: z.date().default(() => new Date()),
  converted: z.boolean().default(false),
  convertedAt: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CreateExperimentRequestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  hypothesis: z.string().optional(),
  variants: z.array(z.object({
    variantId: z.string(),
    name: z.string(),
    weight: z.number().min(0).max(100).default(50),
    config: z.record(z.unknown()).optional(),
  })),
  target: z.object({
    metric: z.string(),
    goal: z.string().optional(),
    minimumDetectableEffect: z.number().optional(),
  }),
  audience: z.object({
    userSegments: z.array(z.string()).optional(),
    apps: z.array(z.string()).optional(),
    percentage: z.number().min(0).max(100).optional(),
  }).optional(),
});

export const RecordConversionRequestSchema = z.object({
  assignmentId: z.string(),
  value: z.number().optional(),
});

export const VariantAssignmentRequestSchema = z.object({
  userId: z.string(),
  appId: z.string().optional(),
});

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export type VariantConfig = z.infer<typeof VariantConfigSchema>;
export type Target = z.infer<typeof TargetSchema>;
export type Audience = z.infer<typeof AudienceSchema>;
export type Stats = z.infer<typeof StatsSchema>;
export type VariantResult = z.infer<typeof VariantResultSchema>;
export type ControlResult = z.infer<typeof ControlResultSchema>;
export type Results = z.infer<typeof ResultsSchema>;
export type Experiment = z.infer<typeof ExperimentSchema>;
export type Assignment = z.infer<typeof AssignmentSchema>;
export type CreateExperimentRequest = z.infer<typeof CreateExperimentRequestSchema>;
export type RecordConversionRequest = z.infer<typeof RecordConversionRequestSchema>;
export type VariantAssignmentRequest = z.infer<typeof VariantAssignmentRequestSchema>;

// Mongoose Document types
export interface IExperiment extends Document {
  experimentId: string;
  name: string;
  description?: string;
  status: ExperimentStatus;
  hypothesis?: string;
  variants: VariantConfig[];
  target: Target;
  audience: Audience;
  stats?: Stats;
  results?: Results;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAssignment extends Document {
  assignmentId: string;
  experimentId: string;
  userId: string;
  variantId: string;
  assignedAt: Date;
  converted: boolean;
  convertedAt?: Date;
  metadata?: Record<string, unknown>;
}

// Statistical types
export interface SignificanceResult {
  pValue: number;
  significant: boolean;
  uplift: number;
}

// API Response Types
export interface ExperimentListResponse {
  experiments: IExperiment[];
}

export interface AssignmentResponse {
  variantId: string;
  assignmentId: string;
}

export interface ResultsResponse {
  control: ControlResult;
  variants: VariantResult[];
}
