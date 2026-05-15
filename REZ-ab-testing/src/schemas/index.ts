import { z } from 'zod';

// Re-export all validation schemas from types
export * from '../types/index.js';

// Additional validation schemas

export const ExperimentIdParamSchema = z.object({
  experimentId: z.string().uuid().or(z.string().min(1)),
});

export const AssignmentIdParamSchema = z.object({
  assignmentId: z.string().min(1),
});

export const UserIdParamSchema = z.object({
  userId: z.string().min(1),
});

// Validate weight distribution
export function validateWeights(variants: Array<{ weight: number }>): { valid: boolean; error?: string } {
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);

  if (Math.abs(totalWeight - 100) > 0.01) {
    return { valid: false, error: `Variant weights must sum to 100, got ${totalWeight}` };
  }

  return { valid: true };
}

// Validate minimum sample size
export function validateSampleSize(n: number, minimum = 30): { valid: boolean; error?: string } {
  if (n < minimum) {
    return { valid: false, error: `Sample size too small. Minimum: ${minimum}, got: ${n}` };
  }
  return { valid: true };
}
