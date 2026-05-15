/**
 * Zod validation schemas for REZ Reorder Engine
 */

import { z } from 'zod';

// UUID regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Schema for creating/updating a reorder profile
 */
export const createProfileSchema = z.object({
  userId: z.string().regex(UUID_REGEX, 'Invalid userId format'),
  merchantId: z.string().regex(UUID_REGEX, 'Invalid merchantId format'),
  orderId: z.string().min(1, 'Order ID is required'),
  category: z.enum(['restaurant', 'hotel', 'retail', 'booking', 'services', 'fintech']).optional(),
  items: z.array(z.object({
    itemId: z.string().optional(),
    productId: z.string().optional(),
    name: z.string(),
    quantity: z.number().int().min(1).default(1),
    price: z.number().min(0).default(0),
    category: z.string().optional()
  })).optional(),
  orderValue: z.number().min(0).optional(),
  currency: z.string().default('INR')
});

/**
 * Schema for querying reorder recommendations
 */
export const reorderQuerySchema = z.object({
  userId: z.string().regex(UUID_REGEX, 'Invalid userId format'),
  category: z.enum(['restaurant', 'hotel', 'retail', 'booking', 'services', 'fintech']).optional(),
  threshold: z.coerce.number().min(0).max(1).default(0.5),
  limit: z.coerce.number().int().min(1).max(50).default(10)
});

/**
 * Schema for nudge interaction tracking
 */
export const nudgeInteractionSchema = z.object({
  nudgeId: z.string().min(1, 'Nudge ID is required'),
  orderId: z.string().optional()
});

/**
 * Schema for analytics query
 */
export const analyticsQuerySchema = z.object({
  merchantId: z.string().optional(),
  category: z.enum(['restaurant', 'hotel', 'retail', 'booking', 'services', 'fintech']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

/**
 * Validation helper function
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): {
  valid: true;
  data: T;
} | {
  valid: false;
  errors: Array<{ field: string; message: string }>;
} {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }));
    return { valid: false, errors };
  }
  return { valid: true, data: result.data };
}

// Type exports
export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type ReorderQueryInput = z.infer<typeof reorderQuerySchema>;
export type NudgeInteractionInput = z.infer<typeof nudgeInteractionSchema>;
export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;
