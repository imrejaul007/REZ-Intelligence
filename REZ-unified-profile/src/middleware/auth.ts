import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];

/**
 * Internal service authentication middleware
 * Validates X-Internal-Token header for service-to-service communication
 */
export function internalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    logger.warn('Missing internal token', {
      path: req.path,
      ip: req.ip
    });
    res.status(401).json({
      success: false,
      error: 'Missing authentication token'
    });
    return;
  }

  if (token !== INTERNAL_TOKEN) {
    logger.warn('Invalid internal token', {
      path: req.path,
      ip: req.ip
    });
    res.status(401).json({
      success: false,
      error: 'Invalid authentication token'
    });
    return;
  }

  next();
}

/**
 * CORS middleware for cross-origin requests
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.includes('*') || (origin && ALLOWED_ORIGINS.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Internal-Token, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });

  next();
}

/**
 * Rate limiting headers middleware
 */
export function rateLimitHeaders(req: Request, res: Response, next: NextFunction): void {
  // Placeholder for actual rate limiting implementation
  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Remaining', '95');
  res.setHeader('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + 60));
  next();
}

/**
 * Error handling middleware
 */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'Not found',
    path: req.path
  });
}

export default {
  internalAuth,
  corsMiddleware,
  requestLogger,
  rateLimitHeaders,
  errorHandler,
  notFoundHandler
};
