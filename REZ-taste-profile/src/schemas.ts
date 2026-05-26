/**
 * Zod validation schemas for REZ Taste Profile
 */

import { z } from 'zod';

// UUID regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Schema for single interaction
 */
export const interactionSchema = z.object({
  userId: z.string().regex(UUID_REGEX, 'Invalid userId format'),
  merchantId: z.string().optional(),
  itemId: z.string().optional(),
  itemName: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  value: z.number().min(0).default(0),
  quantity: z.number().int().min(1).default(1),
  rating: z.number().min(0).max(5).default(0),
  timestamp: z.string().datetime().optional()
});

/**
 * Schema for order batch update
 */
export const orderBatchSchema = z.object({
  userId: z.string().regex(UUID_REGEX, 'Invalid userId format'),
  merchantId: z.string().optional(),
  category: z.string().default('restaurant'),
  items: z.array(z.object({
    itemId: z.string().optional(),
    name: z.string(),
    category: z.string().optional(),
    subcategory: z.string().optional(),
    brand: z.string().optional(),
    features: z.array(z.string()).optional(),
    diet: z.string().optional(),
    price: z.number().min(0).optional()
  })).optional(),
  orderValue: z.number().min(0).optional(),
  rating: z.number().min(0).max(5).default(0),
  timestamp: z.string().datetime().optional()
});

/**
 * Schema for profile link
 */
export const linkProfileSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  sourceUserId: z.string().min(1, 'Source userId is required')
});

/**
 * Schema for aggregate query
 */
export const aggregateQuerySchema = z.object({
  category: z.string().optional(),
  minTransactions: z.coerce.number().int().min(1).default(5)
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
    const errors = result.error.issues.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }));
    return { valid: false, errors };
  }
  return { valid: true, data: result.data };
}

// Type exports
export type InteractionInput = z.infer<typeof interactionSchema>;
export type OrderBatchInput = z.infer<typeof orderBatchSchema>;
export type LinkProfileInput = z.infer<typeof linkProfileSchema>;
export type AggregateQueryInput = z.infer<typeof aggregateQuerySchema>;
