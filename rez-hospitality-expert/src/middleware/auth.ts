/**
 * Authentication Middleware
 * Internal service authentication for API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

interface AuthenticatedRequest extends Request {
  internalService?: {
    name: string;
    authenticated: boolean;
  };
}

/**
 * Validate internal service token
 */
export function internalServiceAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string | undefined;

  if (!token) {
    logger.warn('Missing internal service token', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-Internal-Token header',
    });
    return;
  }

  try {
    const tokens = JSON.parse(config.INTERNAL_SERVICE_TOKENS_JSON || '{}') as Record<string, string>;

    // Find matching service
    const serviceName = Object.entries(tokens).find(
      ([, serviceToken]) => serviceToken === token
    )?.[0];

    if (!serviceName) {
      logger.warn('Invalid internal service token', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid service token',
      });
      return;
    }

    // Attach service info to request
    req.internalService = {
      name: serviceName,
      authenticated: true,
    };

    logger.debug('Internal service authenticated', {
      service: serviceName,
      path: req.path,
    });

    next();
  } catch (error) {
    logger.error('Error validating internal token', { error });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication service unavailable',
    });
  }
}

/**
 * Optional authentication - continues even without token
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string | undefined;

  if (!token) {
    next();
    return;
  }

  // Validate token if present
  internalServiceAuth(req, res, next);
}

/**
 * Guest authentication for public endpoints
 */
export function guestAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // For now, allow all requests through
  // In production, this could validate guest tokens or session IDs
  next();
}
