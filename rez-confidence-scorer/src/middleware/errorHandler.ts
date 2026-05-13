import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import logger from '../utils/logger';
import { ApiError } from '../types';

/**
 * Custom application error
 */
export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}

/**
 * Service unavailable error
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string, details?: unknown) {
    super(`${service} is currently unavailable`, 503, 'SERVICE_UNAVAILABLE', details);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    service: req.serviceName,
  });

  // Handle AppError
  if (err instanceof AppError) {
    const errorResponse: ApiError = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      timestamp: new Date(),
    };
    res.status(err.statusCode).json(errorResponse);
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const errorResponse: ApiError = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
      },
      timestamp: new Date(),
    };
    res.status(400).json(errorResponse);
    return;
  }

  // Handle MongoDB duplicate key errors
  if ((err as NodeJS.ErrnoException).code === '11000') {
    const errorResponse: ApiError = {
      error: {
        code: 'DUPLICATE_KEY',
        message: 'Resource already exists',
      },
      timestamp: new Date(),
    };
    res.status(409).json(errorResponse);
    return;
  }

  // Handle unknown errors
  const errorResponse: ApiError = {
    error: {
      code: 'INTERNAL_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : err.message,
    },
    timestamp: new Date(),
  };
  res.status(500).json(errorResponse);
}

/**
 * 404 handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
    timestamp: new Date(),
  });
}

/**
 * Async handler wrapper to catch async errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Request validation middleware factory
 */
export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Query validation middleware factory
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      next(error);
    }
  };
}
