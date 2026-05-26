import { Request, Response, NextFunction } from 'express';
import { logger } from './utils/logger.js';

export interface AuthConfig {
  apiKeys?: string[];
  internalTokens?: string[];
  bypassPaths?: string[];
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

export const authMiddleware = createAuthMiddleware({
  apiKeys: (process.env['API_KEYS'] || '').split(',').filter(Boolean),
  internalTokens: (process.env['INTERNAL_TOKENS'] || '').split(',').filter(Boolean).concat([process.env['INTERNAL_SERVICE_TOKEN'] || '']).filter(Boolean),
  bypassPaths: ['/health', '/ready']
});

// Request ID middleware
export function requestIdMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

// CORS middleware placeholder
export function corsMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  next();
}
