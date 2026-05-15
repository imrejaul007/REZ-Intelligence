import { Request, Response, NextFunction } from 'express';
import { logWarn } from '../services/logger.js';
import { ApiResponse } from '../types/index.js';

// Rate limiting map
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip || 'unknown';
  const now = Date.now();

  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    next();
    return;
  }

  const record = rateLimitMap.get(key)!;

  if (now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    next();
    return;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded. Please try again later.',
      },
    };

    res.status(429).json(response);
    return;
  }

  record.count++;
  next();
}

// Request logging middleware
export function requestLoggingMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const start = Date.now();

  _res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      ip: req.ip,
      duration,
      userAgent: req.get('user-agent'),
    };

    if (_res.statusCode >= 400) {
      logWarn(`${req.method} ${req.path} ${_res.statusCode}`, logData);
    }
  });

  next();
}

// Error handling wrapper
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Not found handler
export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  };

  res.status(404).json(response);
}

// Global error handler
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const NODE_ENV = process.env.NODE_ENV || 'development';

  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
      details: NODE_ENV === 'production' ? undefined : { stack: err.stack },
    },
  };

  res.status(500).json(response);
}
