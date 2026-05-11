const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const logger = require('../utils/logger');

/**
 * Security middleware - Helmet
 */
const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
});

/**
 * CORS configuration
 */
const corsMiddleware = cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID'],
  credentials: true,
  maxAge: 86400
});

/**
 * Compression middleware
 */
const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6
});

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel]({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });

  next();
};

/**
 * Rate limiting middleware
 */
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests',
    message: 'Please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-user-id'] || req.ip;
  }
});

/**
 * Stricter rate limiting for write operations
 */
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    error: 'Too many write requests',
    message: 'Please slow down',
    retryAfter: '1 minute'
  },
  keyGenerator: (req) => {
    return req.headers['x-user-id'] || req.ip;
  }
});

/**
 * Validation middleware for personalization endpoints
 */
const validatePersonalizationRequest = (req, res, next) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({
      error: 'Missing required parameter',
      message: 'userId is required for personalization'
    });
  }

  // Basic userId validation (alphanumeric, underscores, hyphens)
  const userIdPattern = /^[a-zA-Z0-9_-]+$/;
  if (!userIdPattern.test(userId)) {
    return res.status(400).json({
      error: 'Invalid userId format',
      message: 'userId must be alphanumeric with underscores or hyphens'
    });
  }

  next();
};

/**
 * Request timeout middleware
 */
const timeoutMiddleware = (timeout = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      logger.warn({
        message: 'Request timeout',
        path: req.path,
        method: req.method,
        userId: req.query.userId
      });

      res.status(504).json({
        error: 'Gateway timeout',
        message: 'The request took too long to process'
      });
    }, timeout);

    res.on('finish', () => {
      clearTimeout(timer);
    });

    next();
  };
};

/**
 * Error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  logger.error({
    message: 'Unhandled error',
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      message: err.message,
      details: err.errors
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format',
      message: 'The provided ID has an invalid format'
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: 'Duplicate entry',
      message: 'A record with this identifier already exists'
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message
  });
};

/**
 * 404 handler
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      'GET /personalize/homepage',
      'GET /personalize/search',
      'POST /personalize/search',
      'GET /personalize/recommendations',
      'POST /personalize/user/:userId',
      'GET /personalize/user/:userId',
      'POST /personalize/interaction',
      'GET /personalize/segment/:userId',
      'POST /content',
      'GET /content',
      'POST /interactions'
    ]
  });
};

/**
 * Health check middleware
 */
const healthCheck = (req, res) => {
  const mongoose = require('mongoose');

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'rez-personalization-engine',
    version: '1.0.0',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  };

  const isHealthy = health.mongodb === 'connected' && process.uptime() > 0;

  res.status(isHealthy ? 200 : 503).json({
    ...health,
    status: isHealthy ? 'healthy' : 'unhealthy'
  });
};

module.exports = {
  securityMiddleware,
  corsMiddleware,
  compressionMiddleware,
  requestLogger,
  limiter,
  writeLimiter,
  validatePersonalizationRequest,
  timeoutMiddleware,
  errorHandler,
  notFoundHandler,
  healthCheck
};
