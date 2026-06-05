import { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';

export const validate = (schema: z.ZodSchema, source: 'body' | 'query' | 'params' = 'body') => (req: Request, _res: Response, next: NextFunction): void => {
  try { const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params; const parsed = schema.parse(data); if (source === 'body') req.body = parsed; else if (source === 'query') req.query = parsed as any; else req.params = parsed as any; next(); } catch (error) { next(error); }
};

export const consultRequestSchema = z.object({ message: z.string().min(1).max(4000), context: z.object({ customerId: z.string().optional(), productId: z.string().optional(), merchantId: z.string().optional(), sessionId: z.string().optional() }).optional() });

export const styleMatchRequestSchema = z.object({
  customerId: z.string().min(1),
  merchantId: z.string().min(1),
  styleProfile: z.object({
    bodyType: z.string().optional(),
    stylePreferences: z.array(z.string()).optional(),
    colorPreferences: z.array(z.string()).optional(),
    budgetRange: z.object({ min: z.number(), max: z.number() }).optional(),
  }).optional(),
  limit: z.number().int().positive().default(10),
});

export const trendRequestSchema = z.object({ category: z.string().optional(), season: z.string().optional(), region: z.string().optional(), demographics: z.array(z.string()).optional() });

export const inventoryOptimizationRequestSchema = z.object({ merchantId: z.string().min(1), category: z.string().optional(), forecastPeriod: z.number().int().positive().default(30) });