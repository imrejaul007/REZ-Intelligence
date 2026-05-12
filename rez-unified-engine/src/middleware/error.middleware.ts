/**
 * Error Handling Middleware
 * Centralized error handling for the application
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { config } from '../config';

const errorLogger = logger.child({ component: 'ErrorHandler' });

/**
 * Custom application error class
 */
export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;
  public details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND', true);
  }
}

/**
 * Unauthorized error
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED', true);
  }
}

/**
 * Forbidden error
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN', true);
  }
}

/**
 * Conflict error
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT', true);
  }
}

/**
 * Service unavailable error
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(`${service} is currently unavailable`, 503, 'SERVICE_UNAVAILABLE', true);
  }
}

/**
 * Error response interface
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    path?: string;
    method?: string;
  };
}

/**
 * Generate error response
 */
function generateErrorResponse(
  error: AppError | Error,
  requestId: string,
  path?: string,
  method?: string
): ErrorResponse {
  const response: ErrorResponse = {
    success: false,
    error: {
      code: error instanceof AppError ? error.code : 'INTERNAL_ERROR',
      message: error.message,
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      path,
      method,
    },
  };

  if (error instanceof AppError && error.details) {
    response.error.details = error.details;
  }

  // Include stack trace in development
  if (config.server.nodeEnv === 'development' && error.stack) {
    response.meta = {
      ...response.meta,
      stack: error.stack,
    };
  }

  return response;
}

/**
 * Not found handler (404)
 */
export function notFoundHandler(req: Request, res: Response): void {
  const requestId = (req.headers['x-request-id'] as string) || generateRequestId();

  errorLogger.warn('Route not found', {
    requestId,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    },
  });
}

/**
 * Global error handler
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req.headers['x-request-id'] as string) || generateRequestId();

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    errorLogger.warn('Validation error', {
      requestId,
      errors: error.errors,
      path: req.path,
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.errors,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Handle AppError instances
  if (error instanceof AppError) {
    errorLogger.error('Application error', {
      requestId,
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      path: req.path,
      method: req.method,
    });

    res.status(error.statusCode).json(generateErrorResponse(
      error,
      requestId,
      req.path,
      req.method
    ));
    return;
  }

  // Handle unexpected errors
  errorLogger.error('Unexpected error', {
    requestId,
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  // Don't expose internal error details in production
  const message = config.server.nodeEnv === 'production'
    ? 'An unexpected error occurred'
    : error.message;

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Async handler wrapper to catch errors in async routes
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Request ID middleware
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = (req.headers['x-request-id'] as string) || generateRequestId();
  res.setHeader('X-Request-Id', requestId);
  next();
}

/**
 * Request logging middleware
 */
export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    errorLogger.http('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}
