/**
 * REZ Shared Middleware Package
 * Standard middleware for all REZ services
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// ============================================
// Authentication Middleware
// ============================================

export interface AuthConfig {
  headerName?: string;
  bypassPaths?: string[];
  optional?: boolean;
}

export function createAuthMiddleware(config: AuthConfig = {}) {
  const {
    headerName = 'x-internal-token',
    bypassPaths = ['/health', '/ready', '/metrics'],
    optional = false,
  } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (bypassPaths.some(p => req.path.startsWith(p))) {
      return next();
    }

    const token = req.headers[headerName.toLowerCase()] as string | undefined;

    if (!token) {
      if (optional) return next();
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: `${headerName} header required`,
      });
      return;
    }

    const validToken = process.env.INTERNAL_SERVICE_TOKEN;
    if (!validToken) {
      // Allow in development mode
      if (process.env.NODE_ENV === 'development') {
        return next();
      }
      res.status(500).json({
        success: false,
        error: 'Server Error',
        message: 'Authentication not configured',
      });
      return;
    }

    try {
      if (token.length !== validToken.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(validToken))) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid token',
        });
        return;
      }
    } catch {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid token',
      });
      return;
    }

    next();
  };
}

// API Key middleware for external access
export function createApiKeyMiddleware(config: { apiKeys?: string[]; bypassPaths?: string[] } = {}) {
  const { apiKeys = [], bypassPaths = ['/health', '/ready', '/webhook'] } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (bypassPaths.some(p => req.path.startsWith(p))) {
      return next();
    }

    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'API key required',
      });
      return;
    }

    if (!apiKeys.includes(apiKey)) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
      return;
    }

    next();
  };
}

// ============================================
// Rate Limiting Middleware
// ============================================

interface RateLimitStore {
  cache: Map<string, { count: number; resetAt: number }>;
  get(key: string): { count: number; resetAt: number } | undefined;
  set(key: string, value: { count: number; resetAt: number }): void;
  cleanup(): void;
}

const memoryStore: RateLimitStore = {
  cache: new Map<string, { count: number; resetAt: number }>(),
  get(key: string) {
    const record = memoryStore.cache.get(key);
    if (record && Date.now() > record.resetAt) {
      memoryStore.cache.delete(key);
      return undefined;
    }
    return record;
  },
  set(key: string, value: { count: number; resetAt: number }) {
    memoryStore.cache.set(key, value);
  },
  cleanup() {
    const now = Date.now();
    for (const [key, value] of memoryStore.cache.entries()) {
      if (now > value.resetAt) {
        memoryStore.cache.delete(key);
      }
    }
  },
};

// Cleanup every minute
setInterval(() => memoryStore.cleanup(), 60000);

export interface RateLimitConfig {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

export function createRateLimiter(config: RateLimitConfig = {}) {
  const {
    windowMs = 60000,
    max = 100,
    message = 'Too many requests',
    keyGenerator = (req: Request) => req.ip || 'unknown',
  } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();
    const record = memoryStore.get(key);

    if (!record) {
      memoryStore.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(max - 1));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));
      return next();
    }

    if (record.count >= max) {
      res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message,
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      });
      return;
    }

    record.count++;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - record.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));
    next();
  };
}

// Pre-configured limiters
export const strictLimiter = createRateLimiter({ windowMs: 60000, max: 30 });
export const standardLimiter = createRateLimiter({ windowMs: 60000, max: 100 });
export const relaxedLimiter = createRateLimiter({ windowMs: 60000, max: 500 });
export const authLimiter = createRateLimiter({ windowMs: 900000, max: 10 }); // 15 min window

// ============================================
// Error Handling Middleware
// ============================================

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.code,
      message: err.message,
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ============================================
// Security Headers
// ============================================

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

// ============================================
// Request Validation
// ============================================

export function validateBody(schema: Record<string, unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const [key, rules] of Object.entries(schema)) {
      const value = req.body[key];
      const rule = rules as { required?: boolean; type?: string; min?: number; max?: number; pattern?: RegExp };

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${key} is required`);
        continue;
      }

      if (value !== undefined && value !== null && value !== '') {
        if (rule.type && typeof value !== rule.type) {
          errors.push(`${key} must be of type ${rule.type}`);
        }
        if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
          errors.push(`${key} must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
          errors.push(`${key} must be at most ${rule.max}`);
        }
        if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
          errors.push(`${key} has invalid format`);
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors,
      });
      return;
    }

    next();
  };
}

// ============================================
// Request Logging
// ============================================

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();

  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
}

// ============================================
// CORS Configuration
// ============================================

export function createCorsMiddleware(config: {
  origins?: string[];
  methods?: string[];
  headers?: string[];
} = {}) {
  const {
    origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization', 'x-api-key', 'x-internal-token', 'x-request-id'],
  } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    if (origin && (origins.includes('*') || origins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', headers.join(', '));
      res.setHeader('Access-Control-Max-Age', '86400');
      res.status(204).end();
      return;
    }

    next();
  };
}
