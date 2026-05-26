import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface AuthConfig {
  apiKeys?: string[];
  internalTokens?: string[];
  bypassPaths?: string[];
}

/**
 * Create authentication middleware
 */
export const internalAuth = createAuthMiddleware({
  apiKeys: process.env.API_KEYS?.split(',') || [],
  internalTokens: process.env.INTERNAL_SERVICE_TOKENS_JSON ? Object.values(
    JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON)
  ) : [],
});

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
