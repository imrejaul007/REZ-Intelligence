'use strict';

const rateLimit = require('express-rate-limit');
const { RateLimitError } = require('./errorHandler');
const logger = require('./logger');

const createRateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 1000,
    max = 100,
    message = 'Too many requests',
    keyGenerator = (req) => req.ip,
    skip = () => false
  } = options;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMIT', message } },
    keyGenerator: async (req) => {
      try {
        return await Promise.resolve(keyGenerator(req));
      } catch {
        return req.ip;
      }
    },
    skip: async (req) => {
      try {
        return await Promise.resolve(skip(req));
      } catch {
        return false;
      }
    },
    handler: (req, res, next, options) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT',
          message: options.message,
          retryAfter: Math.ceil(options.windowMs / 1000)
        }
      });
    }
  });
};

const publicLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP'
});

const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts'
});

const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 1000,
  message: 'API rate limit exceeded'
});

const aiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 50,
  message: 'AI request limit exceeded'
});

const userLimiter = (getUserId) => createRateLimiter({
  windowMs: 60 * 1000,
  max: 500,
  keyGenerator: (req) => getUserId(req) || req.ip,
  skip: (req) => !getUserId(req)
});

module.exports = {
  createRateLimiter,
  publicLimiter,
  authLimiter,
  apiLimiter,
  aiLimiter,
  userLimiter
};
