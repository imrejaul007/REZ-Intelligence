import { Request, Response, NextFunction } from 'express';
import { logger } from './utils/logger.js';

/**
 * API Key Authentication Middleware
 * Validates X-API-Key header for merchant authentication
 */
export function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    logger.warn('Missing API key', { path: req.path, ip: req.ip });
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Missing X-API-Key header',
    });
    return;
  }

  if (apiKey.length < 32) {
    logger.warn('Invalid API key format', { path: req.path });
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
    return;
  }

  (req as Request & { merchantId?: string }).merchantId = extractMerchantId(apiKey);
  next();
}

export function rateLimitMiddleware(
  maxRequests: number = 100,
  windowMs: number = 60000
) {
  const requests = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const record = requests.get(key);

    if (!record || now > record.resetAt) {
      requests.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (record.count >= maxRequests) {
      logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
      res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      });
      return;
    }

    record.count++;
    next();
  };
}

function extractMerchantId(apiKey: string): string {
  return `merchant_${apiKey.substring(0, 8)}`;
}

declare global {
  namespace Express {
    interface Request {
      merchantId?: string;
    }
  }
}

// Additional auth middleware for flexible token validation
export interface AuthConfig {
  apiKeys?: string[];
  internalTokens?: string[];
  bypassPaths?: string[];
}

export function createAuthMiddleware(config: AuthConfig) {
  const { apiKeys = [], internalTokens = [], bypassPaths = ['/health', '/ready'] } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    const path = req.path;

    if (bypassPaths.some(p => path.startsWith(p))) {
      return next();
    }

    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (apiKey && apiKeys.includes(apiKey)) {
      return next();
    }

    const internalToken = req.headers['x-internal-token'] as string | undefined;
    if (internalToken && internalTokens.includes(internalToken)) {
      return next();
    }

    logger.warn('Unauthorized access attempt', {
      path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Valid API key or internal token required',
    });
  };
}
