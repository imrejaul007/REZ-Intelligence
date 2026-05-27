/**
 * Error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Logger } from '../utils/logger.js';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export default function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const logger = new Logger('error-handler');
  const statusCode = err.statusCode || 500;

  // Log the error
  if (statusCode >= 500) {
    logger.error('Server error:', {
      path: req.path,
      method: req.method,
      error: err.message,
      stack: err.stack
    });
  } else {
    logger.warn('Client error:', {
      path: req.path,
      method: req.method,
      error: err.message
    });
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.errors
    });
    return;
  }

  // Handle other errors
  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal server error' : err.message,
    code: err.code || 'INTERNAL_ERROR',
    ...(err.details && { details: err.details })
  });
}
