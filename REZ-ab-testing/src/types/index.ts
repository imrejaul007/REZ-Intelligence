import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const ExperimentStatus = z.enum(['draft', 'running', 'paused', 'completed']);
export type ExperimentStatus = z.infer<typeof ExperimentStatus>;

// ============================================================================
// Input Schemas (Zod)
// ============================================================================

export const VariantInputSchema = z.object({
  variantId: z.string().min(1),
  name: z.string().min(1),
  weight: z.number().min(0).max(100).default(50),
  config: z.record(z.unknown()).optional(),
});

export type VariantInput = z.infer<typeof VariantInputSchema>;

export const TargetInputSchema = z.object({
  metric: z.string().min(1),
  goal: z.string().optional(),
  minimumDetectableEffect: z.number().optional(),
});

export type TargetInput = z.infer<typeof TargetInputSchema>;

export const AudienceInputSchema = z.object({
  userSegments: z.array(z.string()).optional(),
  apps: z.array(z.string()).optional(),
  percentage: z.number().min(0).max(100).default(100),
});

export type AudienceInput = z.infer<typeof AudienceInputSchema>;

export const CreateExperimentInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  hypothesis: z.string().optional(),
  variants: z.array(VariantInputSchema).min(2),
  target: TargetInputSchema,
  audience: AudienceInputSchema.optional(),
});

export type CreateExperimentInput = z.infer<typeof CreateExperimentInputSchema>;

export const VariantAssignmentQuerySchema = z.object({
  userId: z.string().min(1),
  appId: z.string().optional(),
});

export type VariantAssignmentQuery = z.infer<typeof VariantAssignmentQuerySchema>;

export const RecordConversionInputSchema = z.object({
  assignmentId: z.string().min(1),
  value: z.number().optional(),
});

export type RecordConversionInput = z.infer<typeof RecordConversionInputSchema>;

export const ExperimentQuerySchema = z.object({
  status: ExperimentStatus.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type ExperimentQuery = z.infer<typeof ExperimentQuerySchema>;

// ============================================================================
// Domain Types
// ============================================================================

export interface Variant {
  variantId: string;
  name: string;
  weight: number;
  config?: Record<string, unknown>;
}

export interface Target {
  metric: string;
  goal?: string;
  minimumDetectableEffect?: number;
}

export interface Audience {
  userSegments?: string[];
  apps?: string[];
  percentage: number;
}

export interface ExperimentStats {
  startDate?: Date;
  endDate?: Date;
  sampleSize?: number;
  confidence: number;
}

export interface VariantResult {
  variantId: string;
  name?: string;
  users: number;
  conversions: number;
  rate: number;
  uplift?: number;
  pValue?: number;
  significant?: boolean;
}

export interface ExperimentResults {
  control: VariantResult;
  variants: VariantResult[];
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ExperimentResponse {
  experimentId: string;
  name: string;
  description?: string;
  status: ExperimentStatus;
  hypothesis?: string;
  variants: Variant[];
  target: Target;
  audience?: Audience;
  stats: ExperimentStats;
  results?: ExperimentResults;
  createdAt: Date;
  updatedAt: Date;
}

export interface VariantAssignmentResponse {
  variantId: string | null;
  assignmentId?: string;
  reason?: string;
}

export interface ConversionResponse {
  success: boolean;
}

export interface ExperimentListResponse {
  experiments: ExperimentResponse[];
}

// ============================================================================
// MongoDB Document Types
// ============================================================================

export interface IExperiment extends Document {
  experimentId: string;
  name: string;
  description?: string;
  status: ExperimentStatus;
  hypothesis?: string;
  variants: Variant[];
  target: Target;
  audience?: Audience;
  stats: ExperimentStats;
  results?: ExperimentResults;
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

// ============================================================================
// Statistical Analysis Types
// ============================================================================

export interface StatisticalSignificance {
  pValue: number;
  significant: boolean;
  uplift: number;
}

export interface SignificanceResult {
  variantId: string;
  name?: string;
  users: number;
  conversions: number;
  rate: number;
  uplift?: number;
  pValue?: number;
  significant?: boolean;
}
