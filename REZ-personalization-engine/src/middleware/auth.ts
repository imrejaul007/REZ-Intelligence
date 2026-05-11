/**
 * Security & Utility Middleware
 *
 * Collection of Express middleware functions including:
 * - Security headers (Helmet)
 * - CORS configuration
 * - Compression
 * - Rate limiting
 * - Request validation
 * - Error handling
 *
 * @module middleware/auth
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import mongoose from 'mongoose';
import logger from '../utils/logger';

/**
 * Security middleware - Helmet
 *
 * Sets various HTTP headers for security including:
 * - Content Security Policy
 * - X-Frame-Options
 * - X-Content-Type-Options
 */
export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

/**
 * CORS configuration
 *
 * Allows cross-origin requests from configured origins or any origin.
 */
export const corsMiddleware = cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID'],
  credentials: true,
  maxAge: 86400,
});

/**
 * Compression middleware
 *
 * Compresses response bodies for specified content types.
 * Respects X-No-Compression header.
 */
export const compressionMiddleware = compression({
  filter: (req: Request, res: Response) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
});

/**
 * Request logging middleware
 *
 * Logs HTTP method, path, status code, duration, IP, and user agent
 * for each request. Uses 'warn' level for 4xx/5xx responses.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
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
      userAgent: req.get('user-agent'),
    });
  });

  next();
};

/**
 * Rate limiting middleware
 *
 * Limits requests per IP/userId within a time window.
 * Uses X-User-ID header as primary identifier, falls back to IP.
 */
export const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '') || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '') || 100,
  message: {
    error: 'Too many requests',
    message: 'Please try again later',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return (req.headers['x-user-id'] as string) || req.ip || 'unknown';
  },
});

/**
 * Stricter rate limiting for write operations
 *
 * More restrictive limits for mutation endpoints.
 */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    error: 'Too many write requests',
    message: 'Please slow down',
    retryAfter: '1 minute',
  },
  keyGenerator: (req: Request) => {
    return (req.headers['x-user-id'] as string) || req.ip || 'unknown';
  },
});

/**
 * Validation middleware for personalization endpoints
 *
 * Validates that userId is present and follows the expected format.
 */
export const validatePersonalizationRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { userId } = req.query;

  if (!userId) {
    res.status(400).json({
      error: 'Missing required parameter',
      message: 'userId is required for personalization',
    });
    return;
  }

  // Basic userId validation (alphanumeric, underscores, hyphens)
  const userIdPattern = /^[a-zA-Z0-9_-]+$/;
  if (!userIdPattern.test(userId as string)) {
    res.status(400).json({
      error: 'Invalid userId format',
      message: 'userId must be alphanumeric with underscores or hyphens',
    });
    return;
  }

  next();
};

/**
 * Request timeout middleware
 *
 * Returns 504 Gateway Timeout if request exceeds the specified timeout.
 *
 * @param timeout - Timeout in milliseconds (default: 30000)
 */
export const timeoutMiddleware = (timeout = 30000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      logger.warn({
        message: 'Request timeout',
        path: req.path,
        method: req.method,
        userId: req.query.userId,
      });

      res.status(504).json({
        error: 'Gateway timeout',
        message: 'The request took too long to process',
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
 *
 * Catches and formats errors with appropriate status codes.
 * Handles Mongoose validation errors, cast errors, and duplicate key errors.
 */
export const errorHandler = (
  err: Error & { status?: number; code?: number; name?: string; errors?: Record<string, unknown> },
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error({
    message: 'Unhandled error',
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation error',
      message: err.message,
      details: err.errors,
    });
    return;
  }

  if (err.name === 'CastError') {
    res.status(400).json({
      error: 'Invalid ID format',
      message: 'The provided ID has an invalid format',
    });
    return;
  }

  if (err.code === 11000) {
    res.status(409).json({
      error: 'Duplicate entry',
      message: 'A record with this identifier already exists',
    });
    return;
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    message:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
  });
};

/**
 * 404 handler middleware
 *
 * Returns a structured response for unmatched routes with available endpoints.
 */
export const notFoundHandler = (req: Request, res: Response): void => {
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
      'POST /interactions',
    ],
  });
};

/**
 * Health check endpoint handler
 *
 * Returns service health status including:
 * - MongoDB connection state
 * - Service uptime
 * - Service version
 */
export const healthCheck = (_req: Request, res: Response): void => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'rez-personalization-engine',
    version: '1.0.0',
    mongodb:
      mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  };

  const isHealthy = health.mongodb === 'connected' && process.uptime() > 0;

  res.status(isHealthy ? 200 : 503).json({
    ...health,
    status: isHealthy ? 'healthy' : 'unhealthy',
  });
};

export default {
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
  healthCheck,
};
