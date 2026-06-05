/**
 * Authentication & Security Middleware for Merchant Growth OS
 *
 * Features:
 * - API Key authentication
 * - JWT validation via RABTUL Auth
 * - Rate limiting
 * - Request logging
 */

import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

// ============== TYPES ==============

interface AuthConfig {
  authServiceUrl: string;
  internalToken: string;
  apiKeys?: string[];
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

// ============== AUTH MIDDLEWARE ==============

export function authMiddleware(config: AuthConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get auth token from header
      const authHeader = req.headers.authorization;
      const apiKey = req.headers['x-api-key'] as string;

      if (!authHeader && !apiKey) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Check API key first (if configured)
      if (apiKey && config.apiKeys?.length) {
        if (config.apiKeys.includes(apiKey)) {
          (req as any).merchantId = req.headers['x-merchant-id'];
          return next();
        }
      }

      // Validate token via RABTUL Auth
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');

        try {
          const response = await axios.post(
            `${config.authServiceUrl}/api/auth/verify`,
            { token },
            {
              headers: {
                'X-Internal-Token': config.internalToken
              },
              timeout: 5000
            }
          );

          if (response.data.valid) {
            (req as any).merchantId = response.data.merchantId;
            (req as any).userId = response.data.userId;
            (req as any).permissions = response.data.permissions || [];
            return next();
          }
        } catch (error) {
          console.error('[Auth] Token validation failed:', error);
        }
      }

      return res.status(401).json({
        error: 'Invalid authentication',
        code: 'AUTH_INVALID'
      });
    } catch (error) {
      console.error('[Auth] Middleware error:', error);
      return res.status(500).json({
        error: 'Authentication service unavailable',
        code: 'AUTH_SERVICE_ERROR'
      });
    }
  };
}

// ============== PERMISSION CHECK ==============

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const permissions = (req as any).permissions || [];

    if (!permissions.includes(permission) && !permissions.includes('admin')) {
      return res.status(403).json({
        error: `Permission denied: ${permission} required`,
        code: 'PERMISSION_DENIED'
      });
    }

    next();
  };
}

// ============== RATE LIMITING ==============

export class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, value] of this.requests.entries()) {
      if (value.resetTime < now) {
        this.requests.delete(key);
      }
    }
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = (req as any).merchantId || req.ip || 'unknown';
      const now = Date.now();

      let record = this.requests.get(key);

      if (!record || record.resetTime < now) {
        record = {
          count: 0,
          resetTime: now + this.config.windowMs
        };
        this.requests.set(key, record);
      }

      record.count++;

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.maxRequests - record.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

      if (record.count > this.config.maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          code: 'RATE_LIMITED',
          retryAfter: Math.ceil((record.resetTime - now) / 1000)
        });
      }

      next();
    };
  }
}

// ============== REQUEST LOGGING ==============

export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
      );
    });

    next();
  };
}

// ============== MERCHANT ISOLATION ==============

export function merchantIsolation() {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestedMerchantId = req.params.merchantId || req.body?.merchantId;
    const authenticatedMerchantId = (req as any).merchantId;

    // Admin can access any merchant
    const permissions = (req as any).permissions || [];
    if (permissions.includes('admin')) {
      return next();
    }

    // Regular users can only access their own merchant
    if (requestedMerchantId && requestedMerchantId !== authenticatedMerchantId) {
      return res.status(403).json({
        error: 'Access denied to this merchant',
        code: 'MERCHANT_ACCESS_DENIED'
      });
    }

    // Ensure merchantId is set
    if (!requestedMerchantId) {
      (req as any).merchantId = authenticatedMerchantId;
    }

    next();
  };
}

// ============== VALIDATION HELPERS ==============

export function validateRequest(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    // Basic validation (in production, use zod or joi)
    if (schema.body) {
      for (const field of schema.body) {
        if (field.required && !req.body[field.name]) {
          errors.push(`${field.name} is required`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors
      });
    }

    next();
  };
}

// ============== ERROR HANDLER ==============

export function errorHandler() {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[Error]', err);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';

    res.status(statusCode).json({
      error: message,
      code: err.code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  };
}

// ============== EXPORTS ==============

export const defaultRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100
});

export const strictRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30
});
