/**
 * Authentication Middleware
 * Validates internal service tokens
 */

import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string | undefined;

  if (!token) {
    logger.warn('Missing authentication token', {
      path: req.path,
      ip: req.ip
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-Internal-Token header'
    });
    return;
  }

  // Timing-safe comparison
  if (!timingSafeEqual(token, INTERNAL_TOKEN)) {
    logger.warn('Invalid authentication token', {
      path: req.path,
      ip: req.ip
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token'
    });
    return;
  }

  next();
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Optional auth middleware - doesn't block requests without token
 * Useful for health checks
 */
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string | undefined;

  if (token) {
    if (!timingSafeEqual(token, INTERNAL_TOKEN)) {
      logger.warn('Invalid optional auth token', {
        path: req.path,
        ip: req.ip
      });
    }
  }

  next();
}
