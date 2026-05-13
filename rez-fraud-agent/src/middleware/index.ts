import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { logger } from '../utils/logger';

export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      req.body = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function authenticateRequest(req: Request, res: Response, next: NextFunction) {
  // Check for internal service token
  const internalToken = req.headers['x-internal-token'] as string;

  if (internalToken) {
    const serviceTokens = JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}');
    const isValid = Object.values(serviceTokens).includes(internalToken);

    if (isValid) {
      req.headers['x-authenticated'] = 'true';
      req.headers['x-service-type'] = 'internal';
      return next();
    }
  }

  // Check for JWT token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      // In production, verify JWT here
      // For now, just check if token exists
      if (token) {
        req.headers['x-authenticated'] = 'true';
        req.headers['x-service-type'] = 'jwt';
        return next();
      }
    } catch (error) {
      logger.warn('JWT verification failed', { error });
    }
  }

  // No valid authentication
  return res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: 'Valid authentication token required',
  });
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: err.message,
    });
  }

  if (err.name === 'MongoServerError') {
    return res.status(503).json({
      success: false,
      error: 'Database Error',
      message: 'Database operation failed',
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
}

export function rateLimiter(options?: {
  windowMs?: number;
  maxRequests?: number;
}) {
  const windowMs = options?.windowMs || 60000;
  const maxRequests = options?.maxRequests || 100;

  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    let record = requests.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
      requests.set(key, record);
    }

    record.count++;

    if (record.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - record.count).toString());
    res.setHeader('X-RateLimit-Reset', record.resetTime.toString());

    next();
  };
}
