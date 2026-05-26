import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(`[${req.method}] ${req.path}:`, err.message);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.code,
      message: err.message,
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
}

// Async handler wrapper
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Validation helper using zod
import { z } from 'zod';

export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ success: false, errors: result.error.issues });
      return;
    }
    next();
  };
};

// Validation schemas
export const schemas = {
  createTicket: z.object({
    userId: z.string().optional(),
    subject: z.string().min(1),
    category: z.enum(['billing', 'technical', 'general', 'complaint']),
    message: z.string().min(1),
    relatedEntity: z.string().optional(),
    attachments: z.array(z.string()).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    platform: z.enum(['consumer', 'merchant']).optional(),
  }),
};

// Fallback sentiment (placeholder)
export const fallbackSentiment = (message: string) => ({ score: 0, label: 'neutral' });
