import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { logger } from '../utils/logger';

export const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRead,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
  },
  handler: (req, res) => {
    logger.warn('Global rate limit exceeded', { ip: req.ip });
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
    });
  },
});

export const aiConsultationLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxAI,
  message: {
    success: false,
    error: { code: 'AI_RATE_LIMIT_EXCEEDED', message: 'AI consultation rate limit exceeded' },
  },
  handler: (req, res) => {
    logger.warn('AI consultation rate limit exceeded', { ip: req.ip });
    res.status(429).json({
      success: false,
      error: { code: 'AI_RATE_LIMIT_EXCEEDED', message: 'AI consultation rate limit exceeded' },
    });
  },
});

export const readLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRead,
  message: {
    success: false,
    error: { code: 'READ_RATE_LIMIT_EXCEEDED', message: 'Read operation rate limit exceeded' },
  },
});

export default { globalLimiter, aiConsultationLimiter, readLimiter };