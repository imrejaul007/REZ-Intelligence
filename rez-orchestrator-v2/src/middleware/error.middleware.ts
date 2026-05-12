import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  requestId?: string;
  details?: unknown;
  stack?: string;
}

export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;
  public isOperational: boolean;
  public details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_ERROR',
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(`${service} is temporarily unavailable`, 503, 'SERVICE_UNAVAILABLE');
  }
}

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string || `REQ-${Date.now()}`;

  // Log error
  if (err instanceof AppError && err.isOperational) {
    logger.warn('Operational error', {
      requestId,
      errorCode: err.errorCode,
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
    });
  } else {
    logger.error('Unexpected error', {
      requestId,
      error: err.message,
      stack: err.stack,
      path: req.path,
    });
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const response: ErrorResponse = {
      error: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      statusCode: 400,
      requestId,
      details: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    };

    res.status(400).json(response);
    return;
  }

  // Handle AppError instances
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      error: err.errorCode,
      message: err.message,
      statusCode: err.statusCode,
      requestId,
      details: err.details,
    };

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle unknown errors
  const response: ErrorResponse = {
    error: 'INTERNAL_ERROR',
    message:
      appConfig.nodeEnv === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    statusCode: 500,
    requestId,
  };

  if (appConfig.nodeEnv !== 'production') {
    response.stack = err.stack;
  }

  res.status(500).json(response);
}

export function notFoundMiddleware(req: Request, res: Response): void {
  const requestId = req.headers['x-request-id'] as string || `REQ-${Date.now()}`;

  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
    statusCode: 404,
    requestId,
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
