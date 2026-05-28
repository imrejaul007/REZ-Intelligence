export * from './auth.js';
export * from './rateLimit.js';
export * from './errorHandler.js';

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createAuthMiddleware } from './auth.js';

// Extended request interface with serviceId
export interface AuthenticatedRequest extends Request {
  serviceId?: string;
  userId?: string;
}

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.headers['x-request-id'] = (req.headers['x-request-id'] as string || require('crypto').randomUUID());
  next();
}

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { logger } = require('../utils/logger.js');
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
}

// Internal service auth middleware
export const internalServiceAuth = createAuthMiddleware({
  internalTokens: process.env.INTERNAL_SERVICE_TOKENS?.split(',') || [],
  bypassPaths: ['/health', '/ready']
});

// Validation middlewares
export function validateBody<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, errors: error.issues });
      } else {
        next(error);
      }
    }
  };
}

export function validateQuery<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.query);
      (req as Request & { query: typeof parsed }).query = parsed;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, errors: error.issues });
      } else {
        next(error);
      }
    }
  };
}

// Schemas
export const PriorityRequestSchema = z.object({
  userId: z.string(),
  intent: z.string(),
  context: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const CreateRuleSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  priority: z.number().int().min(1).max(100),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'contains']),
    value: z.unknown()
  })),
  tier: z.number().int().min(1).max(7),
  action: z.object({
    type: z.string(),
    target: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
  }).optional(),
  active: z.boolean().default(true)
});

export const UpdateRuleSchema = CreateRuleSchema.partial().extend({
  active: z.boolean().optional()
});

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});
