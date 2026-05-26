import { Request, Response, NextFunction } from 'express';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Internal Service Authentication Middleware
 * Validates the X-Internal-Token header for service-to-service communication
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string | undefined;

  if (!token) {
    logger.warn('Missing authentication token', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Missing X-Internal-Token header',
    });
    return;
  }

  // Use timing-safe comparison to prevent timing attacks
  if (!timingSafeEqual(token, config.auth.internalServiceToken)) {
    logger.warn('Invalid authentication token', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid authentication token',
    });
    return;
  }

  next();
}

/**
 * Timing-safe string comparison
 */
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
 * Optional auth middleware - allows requests without token in development
 */
export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string | undefined;

  // Skip auth in development if no token provided
  if (!token && config.nodeEnv === 'development') {
    next();
    return;
  }

  // If token is provided, validate it
  if (token) {
    authMiddleware(req, res, next);
    return;
  }

  // Require auth in production
  res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: 'X-Internal-Token header required',
  });
}
