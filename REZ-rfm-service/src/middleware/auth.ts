import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import config from '../config/index.js';
import logger from '../utils/logger.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      serviceName?: string;
    }
  }
}

/**
 * Timing-safe comparison for token comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Internal Service Authentication Middleware
 * Verifies X-Internal-Token header against configured tokens
 */
export function internalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string | undefined;

  if (!token) {
    logger.warn('Missing internal token', { path: req.path, ip: req.ip });
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Missing X-Internal-Token header',
    });
    return;
  }

  // Check against main token
  if (config.auth.internalServiceToken && timingSafeEqual(token, config.auth.internalServiceToken)) {
    req.serviceName = 'internal';
    next();
    return;
  }

  // Check against service-specific tokens
  for (const [serviceName, serviceToken] of Object.entries(config.auth.internalServiceTokensJson)) {
    if (timingSafeEqual(token, serviceToken)) {
      req.serviceName = serviceName;
      next();
      return;
    }
  }

  logger.warn('Invalid internal token', { path: req.path, ip: req.ip });
  res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: 'Invalid X-Internal-Token',
  });
}

/**
 * Optional auth - continues without auth but logs if token is present
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string | undefined;

  if (!token) {
    next();
    return;
  }

  // Try to identify the service
  if (config.auth.internalServiceToken && timingSafeEqual(token, config.auth.internalServiceToken)) {
    req.serviceName = 'internal';
  } else {
    for (const [serviceName, serviceToken] of Object.entries(config.auth.internalServiceTokensJson)) {
      if (timingSafeEqual(token, serviceToken)) {
        req.serviceName = serviceName;
        break;
      }
    }
  }

  next();
}
