import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { logger } from '../utils/logger';

// Global rate limiter
export const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRead,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn('Global rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    res.status(options.statusCode).json(options.message);
  },
});

// AI Consultation rate limiter - 30 req/min
export const aiConsultationLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxAI,
  message: {
    success: false,
    error: {
      code: 'AI_RATE_LIMIT_EXCEEDED',
      message: 'AI consultation rate limit exceeded. Please wait before making more requests.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use API key or IP for key generation
    return (req.headers['x-api-key'] as string) || req.ip || 'default';
  },
  handler: (req, res, next, options) => {
    logger.warn('AI consultation rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('user-agent'),
    });
    res.status(options.statusCode).json(options.message);
  },
});

// Read operations rate limiter - 100 req/min
export const readLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRead,
  message: {
    success: false,
    error: {
      code: 'READ_RATE_LIMIT_EXCEEDED',
      message: 'Read operation rate limit exceeded',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET',
});

// Pricing operations rate limiter - 50 req/min
export const pricingLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: Math.floor(config.rateLimit.maxRead / 2),
  message: {
    success: false,
    error: {
      code: 'PRICING_RATE_LIMIT_EXCEEDED',
      message: 'Pricing operation rate limit exceeded',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check rate limiter - 120 req/min
export const healthLimiter = rateLimit({
  windowMs: 60000,
  max: 120,
  message: {
    success: false,
    error: {
      code: 'HEALTH_RATE_LIMIT_EXCEEDED',
      message: 'Health check rate limit exceeded',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

export default {
  globalLimiter,
  aiConsultationLimiter,
  readLimiter,
  pricingLimiter,
  healthLimiter,
};