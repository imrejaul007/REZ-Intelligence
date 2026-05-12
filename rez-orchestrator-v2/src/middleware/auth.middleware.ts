import { Request, Response, NextFunction } from 'express';
import { appConfig } from '../config';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  serviceId?: string;
  isInternal?: boolean;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const internalToken = req.headers['x-internal-token'] as string;

  // Skip auth for health check
  if (req.path === appConfig.healthCheck.route) {
    next();
    return;
  }

  if (!internalToken) {
    // Check for API key in development
    if (appConfig.nodeEnv === 'development') {
      const apiKey = req.headers['x-api-key'] as string;
      if (apiKey === 'dev-api-key') {
        req.isInternal = true;
        req.serviceId = 'dev-client';
        next();
        return;
      }
    }

    logger.warn('Missing authentication token', {
      path: req.path,
      ip: req.ip,
    });

    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
    return;
  }

  // Validate internal service token
  const tokens = appConfig.internalServiceTokens;
  const validToken = Object.entries(tokens).find(([, token]) => token === internalToken);

  if (!validToken) {
    logger.warn('Invalid authentication token', {
      path: req.path,
      ip: req.ip,
    });

    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid authentication token',
    });
    return;
  }

  req.isInternal = true;
  req.serviceId = validToken[0];

  logger.debug('Request authenticated', {
    serviceId: req.serviceId,
    path: req.path,
  });

  next();
}

export function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const internalToken = req.headers['x-internal-token'] as string;

  if (internalToken) {
    const tokens = appConfig.internalServiceTokens;
    const validToken = Object.entries(tokens).find(([, token]) => token === internalToken);

    if (validToken) {
      req.isInternal = true;
      req.serviceId = validToken[0];
    }
  }

  next();
}
