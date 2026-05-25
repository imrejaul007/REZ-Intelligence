/**
 * REZ Memory Layer - Authentication Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      serviceId?: string;
      isInternal?: boolean;
    }
  }
}

/**
 * Validate internal service token
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string;
  const apiKey = req.headers['x-api-key'] as string;

  // Check for valid internal token or API key
  if (token === INTERNAL_SERVICE_TOKEN) {
    req.isInternal = true;
    req.serviceId = 'internal';
    next();
    return;
  }

  // Validate API key format
  if (apiKey) {
    // In production, validate against a database or service
    if (isValidApiKey(apiKey)) {
      req.isInternal = true;
      req.serviceId = extractServiceId(apiKey);
      next();
      return;
    }
  }

  // No valid authentication
  logger.warn('Unauthorized access attempt', {
    ip: req.ip,
    path: req.path,
    method: req.method
  });

  res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Invalid or missing authentication token'
    }
  });
}

/**
 * Optional auth - doesn't fail if no token provided
 */
export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string;
  const apiKey = req.headers['x-api-key'] as string;

  if (token === INTERNAL_SERVICE_TOKEN) {
    req.isInternal = true;
    req.serviceId = 'internal';
  } else if (apiKey && isValidApiKey(apiKey)) {
    req.isInternal = true;
    req.serviceId = extractServiceId(apiKey);
  }

  next();
}

/**
 * Validate API key format
 */
function isValidApiKey(apiKey: string): boolean {
  // Simple format validation - in production, validate against stored keys
  // Expected format: rez_<service>_<uuid>
  const validPrefix = apiKey.startsWith('rez_');

  if (!validPrefix) {
    return false;
  }

  // Check minimum length
  return apiKey.length >= 10;
}

/**
 * Extract service ID from API key
 */
function extractServiceId(apiKey: string): string {
  const parts = apiKey.split('_');
  if (parts.length >= 2) {
    return parts[1];
  }
  return 'unknown';
}

/**
 * Rate limiting middleware with service identification
 */
export function serviceRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const serviceId = req.serviceId || req.ip || 'unknown';
  const key = `rate_limit:${serviceId}:${req.path}`;

  // In production, use Redis for distributed rate limiting
  // This is a simple in-memory implementation
  const rateLimitStore = (req.app.locals as unknown).rateLimitStore as Map<string, { count: number; resetTime: number }> || new Map();

  const now = Date.now();
  const limit = 1000; // requests per window
  const windowMs = 15 * 60 * 1000; // 15 minutes

  const current = rateLimitStore.get(key);

  if (!current || now > current.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
    next();
    return;
  }

  if (current.count >= limit) {
    logger.warn('Rate limit exceeded', {
      serviceId,
      path: req.path,
      count: current.count
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      }
    });
    return;
  }

  current.count++;
  next();
}

/**
 * Request logging middleware
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      serviceId: req.serviceId,
      ip: req.ip
    });
  });

  next();
}

/**
 * Error handling middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
}
