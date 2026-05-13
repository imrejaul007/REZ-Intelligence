import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { logger } from '../utils/logger';

export const PriorityRequestSchema = z.object({
  requestId: z.string().uuid().optional(),
  intent: z.string().min(1, 'Intent cannot be empty').max(2000),
  context: z
    .object({
      userId: z.string().optional(),
      sessionId: z.string().optional(),
      domain: z.string().optional(),
      customerTier: z.number().int().min(0).max(10).optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .optional(),
  bypassCache: z.boolean().optional(),
});

export type PriorityRequest = z.infer<typeof PriorityRequestSchema>;

export const CreateRuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  ruleType: z.enum([
    'emergency',
    'payment',
    'fraud',
    'support',
    'domain',
    'sales',
    'loyalty',
    'analytics',
    'custom',
  ]),
  priorityTier: z.number().int().min(1).max(7),
  conditions: z.array(
    z.object({
      field: z.string().min(1),
      operator: z.enum([
        'eq',
        'neq',
        'gt',
        'gte',
        'lt',
        'lte',
        'contains',
        'startsWith',
        'endsWith',
        'in',
        'nin',
        'regex',
      ]),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
    })
  ),
  actions: z
    .object({
      routeTo: z.string().optional(),
      escalate: z.boolean().optional(),
      notify: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      slaMinutes: z.number().int().positive().optional(),
    })
    .optional(),
  enabled: z.boolean().default(true),
  domain: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateRuleInput = z.infer<typeof CreateRuleSchema>;

export const UpdateRuleSchema = CreateRuleSchema.partial();

export type UpdateRuleInput = z.infer<typeof UpdateRuleSchema>;

export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.parse(req.body);
      req.body = result;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request body',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}

export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.parse(req.query);
      req.query = result as typeof req.query;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid query parameters',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationParams = z.infer<typeof PaginationSchema>;

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error.message,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
}

export default {
  validateBody,
  validateQuery,
  errorHandler,
  notFoundHandler,
  PriorityRequestSchema,
  CreateRuleSchema,
  UpdateRuleSchema,
  PaginationSchema,
};
