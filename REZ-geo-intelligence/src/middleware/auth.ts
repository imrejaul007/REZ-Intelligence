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
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}

/**
 * Not found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
  });
}

/**
 * Rate limiter factory
 */
export function rateLimiter(windowMs: number, maxRequests: number) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    let record = requests.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      requests.set(key, record);
    }

    record.count++;

    if (record.count > maxRequests) {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
      return;
    }

    next();
  };
}
