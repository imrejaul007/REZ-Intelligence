import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { z } from 'zod';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      serviceName?: string;
      internalToken?: string;
    }
  }
}

// Validation schema for API key auth
const ApiKeyAuthSchema = z.object({
  'x-api-key': z.string(),
});

// Validation schema for internal service auth
const InternalAuthSchema = z.object({
  'x-internal-token': z.string(),
  'x-service-name': z.string().optional(),
});

/**
 * API Key authentication for mobile app requests
 */
export function appApiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  const expectedApiKey = process.env.APP_API_KEY;

  if (!apiKey) {
    logger.warn('Missing API key', {
      ip: req.ip,
      path: req.path,
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required',
    });
    return;
  }

  if (!expectedApiKey || apiKey !== expectedApiKey) {
    logger.warn('Invalid API key', {
      ip: req.ip,
      path: req.path,
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
    return;
  }

  // API key validated
  next();
}

/**
 * Internal service authentication
 * Validates X-Internal-Token header against configured tokens
 */
export function internalServiceAuth(req: Request, res: Response, next: NextFunction): void {
  const authResult = InternalAuthSchema.safeParse({
    'x-internal-token': req.headers['x-internal-token'],
    'x-service-name': req.headers['x-service-name'],
  });

  if (!authResult.success) {
    logger.warn('Missing internal auth headers', {
      ip: req.ip,
      path: req.path,
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Internal service authentication required',
    });
    return;
  }

  const { 'x-internal-token': token, 'x-service-name': serviceName } = authResult.data;

  // Validate token
  const tokens = JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}') as Record<string, string>;
  const validToken = Object.values(tokens).some(t => t === token);

  if (!validToken) {
    logger.warn('Invalid internal token', {
      ip: req.ip,
      path: req.path,
      serviceName,
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid internal token',
    });
    return;
  }

  // Attach service info to request
  req.serviceName = serviceName;
  req.internalToken = token;

  next();
}

/**
 * Combined auth middleware
 * Accepts either API key (app) or internal token (service-to-service)
 */
export function combinedAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  const internalToken = req.headers['x-internal-token'] as string;

  if (apiKey) {
    // Validate as app API key
    const expectedApiKey = process.env.APP_API_KEY;
    if (expectedApiKey && apiKey === expectedApiKey) {
      next();
      return;
    }
  }

  if (internalToken) {
    // Validate as internal token
    const tokens = JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}') as Record<string, string>;
    const validToken = Object.values(tokens).some(t => t === internalToken);
    if (validToken) {
      req.serviceName = req.headers['x-service-name'] as string;
      req.internalToken = internalToken;
      next();
      return;
    }
  }

  logger.warn('Authentication failed', {
    ip: req.ip,
    path: req.path,
    hasApiKey: !!apiKey,
    hasInternalToken: !!internalToken,
  });

  res.status(401).json({
    error: 'Unauthorized',
    message: 'Valid authentication required',
  });
}

/**
 * Validate user ID from request body/params/query
 */
export function validateUserId(req: Request, res: Response, next: NextFunction): void {
  const userId = req.body?.userId || req.params?.userId || req.query?.userId;

  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Valid user ID required',
    });
    return;
  }

  next();
}

/**
 * Rate limiting middleware (simple in-memory implementation)
 * In production, use Redis-backed rate limiting
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(
  maxRequests: number = 100,
  windowMs: number = 60000
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    let record = rateLimitMap.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      rateLimitMap.set(key, record);
    }

    record.count++;

    if (record.count > maxRequests) {
      logger.warn('Rate limit exceeded', { ip: key, count: record.count });
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
      return;
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    next();
  };
}

/**
 * Input validation middleware factory
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      logger.warn('Request validation failed', {
        path: req.path,
        errors: result.error.errors,
      });
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request body',
        details: result.error.errors,
      });
      return;
    }

    req.body = result.data;
    next();
  };
}

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });

  next();
}
