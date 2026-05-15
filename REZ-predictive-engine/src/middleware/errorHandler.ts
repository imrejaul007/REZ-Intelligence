import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
  }
}

/**
 * Not found error
 */
export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

/**
 * Validation error
 */
export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

/**
 * Conflict error
 */
export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as any).requestId || 'unknown';

  // Log the error
  logger.logError('API Error', err, {
    requestId,
    path: req.path,
    method: req.method,
    userId: (req as any).params?.userId
  });

  // Handle known API errors
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      },
      timestamp: new Date().toISOString(),
      requestId
    });
    return;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.message
      },
      timestamp: new Date().toISOString(),
      requestId
    });
    return;
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ID',
        message: 'Invalid ID format'
      },
      timestamp: new Date().toISOString(),
      requestId
    });
    return;
  }

  // Handle duplicate key errors
  if ((err as any).code === 11000) {
    res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'A record with this identifier already exists'
      },
      timestamp: new Date().toISOString(),
      requestId
    });
    return;
  }

  // Handle unexpected errors
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction
        ? 'An unexpected error occurred'
        : err.message,
      ...(isProduction ? {} : { stack: err.stack })
    },
    timestamp: new Date().toISOString(),
    requestId
  });
}

/**
 * 404 handler for unknown routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    },
    timestamp: new Date().toISOString(),
    requestId: (req as any).requestId || 'unknown'
  });
}

/**
 * Async handler wrapper to catch promise rejections
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Request validation middleware
 */
export function validateRequest<T>(
  schema: {
    params?: Record<string, any>;
    query?: Record<string, any>;
    body?: Record<string, any>;
  },
  source: 'params' | 'query' | 'body' = 'body'
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = req[source];

    // Basic validation - extend as needed
    if (schema.params) {
      for (const key of Object.keys(schema.params)) {
        if (schema.params[key].required && !data[key]) {
          next(new ValidationError(`Missing required field: ${key}`));
          return;
        }
      }
    }

    next();
  };
}

/**
 * Rate limiting middleware (simple in-memory implementation)
 * For production, use Redis-based rate limiting
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimitMiddleware(
  windowMs: number = 60000,
  maxRequests: number = 100
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    let record = rateLimitMap.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      rateLimitMap.set(key, record);
    } else {
      record.count++;
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > maxRequests) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later'
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    next();
  };
}

/**
 * Clean up old rate limit records periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);
