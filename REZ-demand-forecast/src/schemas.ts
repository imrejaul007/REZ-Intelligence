/**
 * Zod validation schemas for REZ Demand Forecast
 */

import { z } from 'zod';

/**
 * Schema for recording demand data
 */
export const recordDemandSchema = z.object({
  itemId: z.string().optional(),
  date: z.string().datetime({ message: 'Invalid date format' }),
  hour: z.number().int().min(0).max(23).optional(),
  actualDemand: z.number().int().min(0),
  predictedDemand: z.number().int().min(0).optional()
});

/**
 * Schema for forecast query
 */
export const forecastQuerySchema = z.object({
  date: z.string().datetime().optional(),
  days: z.coerce.number().int().min(1).max(30).default(1)
});

/**
 * Schema for item forecast query
 */
export const itemForecastQuerySchema = z.object({
  date: z.string().datetime().optional()
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
export type RecordDemandInput = z.infer<typeof recordDemandSchema>;
export type ForecastQueryInput = z.infer<typeof forecastQuerySchema>;
export type ItemForecastQueryInput = z.infer<typeof itemForecastQuerySchema>;
