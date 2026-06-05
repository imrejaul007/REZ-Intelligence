import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Global rate limiter - applies to all requests
 */
export const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  handler: (req, res, next, options) => {
    logger.warn('Global rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json(options.message);
  },
});

/**
 * AI Consultation rate limiter - stricter limits for AI endpoints
 */
export const aiConsultationLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxAI,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use internal service token or IP as key
    const internalToken = req.headers['x-internal-token'] as string;
    return internalToken || req.ip || 'unknown';
  },
  message: {
    success: false,
    error: {
      code: 'AI_RATE_LIMIT_EXCEEDED',
      message: 'AI consultation rate limit exceeded. Please wait before making more requests.',
    },
  },
  handler: (req, res, next, options) => {
    logger.warn('AI consultation rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      internalService: !!req.headers['x-internal-token'],
    });
    res.status(429).json(options.message);
  },
});

/**
 * Read-only endpoint rate limiter - higher limits for read operations
 */
export const readLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRead,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const internalToken = req.headers['x-internal-token'] as string;
    return internalToken || req.ip || 'unknown';
  },
  message: {
    success: false,
    error: {
      code: 'READ_RATE_LIMIT_EXCEEDED',
      message: 'Read rate limit exceeded. Please wait before making more requests.',
    },
  },
  handler: (req, res, next, options) => {
    logger.warn('Read rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json(options.message);
  },
});

/**
 * Interaction check rate limiter - specific for interaction checking
 */
export const interactionCheckLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const internalToken = req.headers['x-internal-token'] as string;
    const merchantId = (req.body as any)?.merchantId;
    return internalToken || merchantId || req.ip || 'unknown';
  },
  message: {
    success: false,
    error: {
      code: 'INTERACTION_RATE_LIMIT_EXCEEDED',
      message: 'Drug interaction check rate limit exceeded.',
    },
  },
  handler: (req, res, next, options) => {
    logger.warn('Interaction check rate limit exceeded', {
      ip: req.ip,
      merchantId: (req.body as any)?.merchantId,
    });
    res.status(429).json(options.message);
  },
});

/**
 * Compliance alert rate limiter - for compliance monitoring
 */
export const complianceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const internalToken = req.headers['x-internal-token'] as string;
    return internalToken || req.ip || 'unknown';
  },
  message: {
    success: false,
    error: {
      code: 'COMPLIANCE_RATE_LIMIT_EXCEEDED',
      message: 'Compliance monitoring rate limit exceeded.',
    },
  },
});

/**
 * Refill reminder rate limiter - for batch operations
 */
export const refillReminderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const internalToken = req.headers['x-internal-token'] as string;
    return internalToken || req.ip || 'unknown';
  },
  message: {
    success: false,
    error: {
      code: 'REFILL_RATE_LIMIT_EXCEEDED',
      message: 'Refill reminder rate limit exceeded.',
    },
  },
  handler: (req, res, next, options) => {
    logger.warn('Refill reminder rate limit exceeded', {
      ip: req.ip,
      merchantId: (req.body as any)?.merchantId,
    });
    res.status(429).json(options.message);
  },
});