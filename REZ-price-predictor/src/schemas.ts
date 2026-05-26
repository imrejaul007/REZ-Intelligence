/**
 * Zod validation schemas for REZ Price Predictor
 */

import { z } from 'zod';

/**
 * Schema for recording price and demand
 */
export const recordPriceSchema = z.object({
  price: z.number().min(0, 'Price must be positive'),
  demand: z.number().int().min(0).optional(),
  factors: z.object({
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    hour: z.number().int().min(0).max(23).optional(),
    weather: z.number().optional(),
    events: z.number().optional(),
    competition: z.number().optional()
  }).optional()
});

/**
 * Schema for price prediction query
 */
export const pricePredictionQuerySchema = z.object({
  basePrice: z.coerce.number().min(0).optional(),
  demandLevel: z.coerce.number().min(0).max(2).default(1),
  hour: z.coerce.number().int().min(0).max(23).optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  includeAlternatives: z.enum(['true', 'false']).default('false')
});

/**
 * Schema for slot price query
 */
export const slotPriceQuerySchema = z.object({
  items: z.string().optional(),
  hour: z.coerce.number().int().min(0).max(23).optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional()
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
export type RecordPriceInput = z.infer<typeof recordPriceSchema>;
export type PricePredictionQueryInput = z.infer<typeof pricePredictionQuerySchema>;
export type SlotPriceQueryInput = z.infer<typeof slotPriceQuerySchema>;
