import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Rate limiter for AI consultation endpoints
 * 30 requests per minute to prevent abuse
 */
export const aiConsultationLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 1 minute window
  max: config.rateLimit.maxAI, // 30 requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many consultation requests. Please try again later.',
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    // Use merchant ID if available, otherwise use IP
    const merchantId = req.body?.merchantId;
    if (merchantId) {
      return `merchant:${merchantId}`;
    }
    return req.ip || 'unknown';
  },
  handler: (req: Request, res: Response): void => {
    logger.warn('AI consultation rate limit exceeded', {
      ip: req.ip,
      merchantId: req.body?.merchantId,
      path: req.path,
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many consultation requests. Please try again later.',
        retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
      },
    });
  },
  skip: (req: Request): boolean => {
    // Skip rate limiting for internal services
    return !!req.headers['x-internal-token'];
  },
});

/**
 * Rate limiter for read-only endpoints
 * 100 requests per minute
 */
export const readLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRead, // 100 requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    // Use user ID if authenticated, otherwise use IP
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    return req.ip || 'unknown';
  },
  handler: (req: Request, res: Response): void => {
    logger.warn('Read endpoint rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.id,
      path: req.path,
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
      },
    });
  },
  skip: (req: Request): boolean => {
    // Skip rate limiting for internal services
    return !!req.headers['x-internal-token'];
  },
});

/**
 * Rate limiter for pricing endpoints
 * 50 requests per minute
 */
export const pricingLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 50,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many pricing requests. Please try again later.',
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return `merchant:${req.body?.merchantId || req.params?.merchantId || req.ip}`;
  },
  handler: (req: Request, res: Response): void => {
    logger.warn('Pricing endpoint rate limit exceeded', {
      ip: req.ip,
      merchantId: req.body?.merchantId,
      path: req.path,
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many pricing requests. Please try again later.',
        retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
      },
    });
  },
});

/**
 * Global rate limiter for all endpoints
 * 200 requests per minute
 */
export const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 200,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down.',
      retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return req.ip || 'unknown';
  },
  handler: (req: Request, res: Response): void => {
    logger.warn('Global rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please slow down.',
        retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
      },
    });
  },
  skip: (req: Request): boolean => {
    // Skip global rate limiting for health checks
    return req.path === '/health' || req.path === '/health/ready';
  },
});

/**
 * Create a custom rate limiter with specific configuration
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  skipInternal?: boolean;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: options.message || 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000),
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request): string => {
      return req.user?.id || req.ip || 'unknown';
    },
    skip: (req: Request): boolean => {
      if (options.skipInternal !== false && req.headers['x-internal-token']) {
        return true;
      }
      return false;
    },
  });
}