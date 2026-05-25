/**
 * REZ Geo Intelligence Core - Middleware
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        phone?: string;
      };
    }
  }
}

/**
 * Internal service authentication
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string;
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;

  if (!token || !expectedToken || token !== expectedToken) {
    logger.warn('Unauthorized access attempt', { path: req.path, ip: req.ip });
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  // For internal calls, extract userId from header or body
  req.user = {
    id: (req.headers['x-user-id'] as string) || (req.body?.userId as string) || 'system',
  };

  next();
}

/**
 * Optional auth - allows public access but extracts user if available
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string;
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;

  if (token && expectedToken && token === expectedToken) {
    req.user = {
      id: (req.headers['x-user-id'] as string) || (req.body?.userId as string) || 'system',
    };
  }

  next();
}

/**
 * Error handler
 */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

/**
 * Not found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}

/**
 * Rate limiter (basic in-memory)
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(windowMs: number = 60000, max: number = 100) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || now > record.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (record.count >= max) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
          retryAfter: Math.ceil((record.resetAt - now) / 1000),
        },
      });
      return;
    }

    record.count++;
    next();
  };
}
