/**
 * Standardized Error Handler
 *
 * Provides consistent error response format across all services.
 * Usage: app.use(globalErrorHandler);
 */

import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from '../config/logger';

const logger = createServiceLogger('error-handler');

/**
 * Standard error codes used across the platform
 */
export enum ErrorCode {
  // Validation errors (400)
  INVALID_REQUEST = 'INVALID_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_INPUT = 'INVALID_INPUT',

  // Authentication errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Authorization errors (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Not found errors (404)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  MERCHANT_NOT_FOUND = 'MERCHANT_NOT_FOUND',
  STORE_NOT_FOUND = 'STORE_NOT_FOUND',

  // Conflict errors (409)
  CONFLICT = 'CONFLICT',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  INVALID_TRANSITION = 'INVALID_TRANSITION',

  // Rate limit errors (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // Server errors (500)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

/**
 * Structured error response
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode | string;
    message: string;
    statusCode: number;
    details?: Record<string, any>;
    requestId?: string;
  };
}

/**
 * Custom application error
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code: ErrorCode | string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Validation error (extends AppError)
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 400, ErrorCode.VALIDATION_ERROR, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, ErrorCode.NOT_FOUND);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Unauthorized error
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, ErrorCode.UNAUTHORIZED);
    this.name = 'UnauthorizedError';
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('Too many requests, please try again later', 429, ErrorCode.RATE_LIMIT_EXCEEDED);
    if (retryAfter) {
      this.details = { retryAfter };
    }
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Global error handler middleware
 *
 * Usage:
 * ```typescript
 * app.use(globalErrorHandler);
 * ```
 */
export function globalErrorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = (req as any).correlationId || 'unknown';

  // Log error with proper context
  logger.error('[ERROR]', {
    requestId,
    path: req.path,
    method: req.method,
    error: error.message,
    code: error.code || error.constructor.name,
    errorType: error.name || error.constructor.name,
    stack: error.stack,
    statusCode: error.statusCode || 500,
  });

  // Handle AppError
  if (error instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        requestId,
        ...(error.details && { details: error.details }),
      },
    };
    res.status(error.statusCode).json(response);
    return;
  }

  // Handle MongoDB errors
  if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    if (error.code === 11000) {
      // Duplicate key error
      const response: ErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.DUPLICATE_RESOURCE,
          message: 'A resource with this value already exists',
          statusCode: 409,
          requestId,
        },
      };
      res.status(409).json(response);
      return;
    }
  }

  // Handle validation errors (from Zod, Joi, etc.)
  if (error.isJoi || error.isZod) {
    const details = error.details ? error.details.reduce((acc: any, detail: any) => {
      // Defensive check: ensure path is an array before calling join()
      let fieldPath = 'unknown';
      if (detail.path) {
        fieldPath = Array.isArray(detail.path) ? detail.path.join('.') : String(detail.path);
      }
      acc[fieldPath] = detail.message;
      return acc;
    }, {}) : undefined;

    const response: ErrorResponse = {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        statusCode: 400,
        requestId,
        ...(details && { details }),
      },
    };
    res.status(400).json(response);
    return;
  }

  // Default error
  const response: ErrorResponse = {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error.message,
      statusCode: 500,
      requestId,
    },
  };
  res.status(500).json(response);
}

/**
 * Async route wrapper to catch errors
 *
 * Usage:
 * ```typescript
 * router.get('/', asyncHandler(async (req, res) => {
 *   const data = await getData();
 *   res.json(data);
 * }));
 * ```
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
