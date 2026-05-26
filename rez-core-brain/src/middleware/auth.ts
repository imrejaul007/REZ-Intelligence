import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface AuthConfig {
  apiKeys?: string[];
  internalTokens?: string[];
  bypassPaths?: string[];
}

/**
 * Request ID middleware - adds unique request ID to each request
 */
export function requestId(req: Request, _res: Response, next: NextFunction): void {
  (req as Request & { requestId?: string }).requestId = req.headers['x-request-id'] as string || uuidv4();
  next();
}

/**
 * Simple authentication middleware (no-op for backward compatibility)
 */
export function authenticate(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

/**
 * Internal auth middleware (no-op for backward compatibility)
 */
export function internalAuth(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

/**
 * Any auth middleware (no-op for backward compatibility)
 */
export function authenticateAny(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

export function createAuthMiddleware(config: AuthConfig) {
  const { apiKeys = [], internalTokens = [], bypassPaths = ['/health', '/ready'] } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    const path = req.path;

    // Bypass health checks
    if (bypassPaths.some(p => path.startsWith(p))) {
      return next();
    }

    // Check API key
    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (apiKey && apiKeys.includes(apiKey)) {
      return next();
    }

    // Check internal token
    const internalToken = req.headers['x-internal-token'] as string | undefined;
    if (internalToken && internalTokens.includes(internalToken)) {
      return next();
    }

    // No valid auth found
    logger.warn('Unauthorized access attempt', {
      path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid API key or internal token required',
    });
  };
}
