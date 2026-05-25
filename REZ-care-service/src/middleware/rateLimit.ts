/**
 * REZ Care - Rate Limiting Middleware
 *
 * Protects APIs from abuse using in-memory store
 * For production, use Redis-backed store
 */

import { Request, Response, NextFunction } from 'express';

// In-memory rate limit store (use Redis for production)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// Configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMITS = {
  default: 100,        // 100 requests per minute
  auth: 10,            // 10 attempts per minute for auth
  webhook: 1000,       // 1000 requests per minute for webhooks
  internal: 10000,     // 10000 requests per minute for internal
  public: 30,          // 30 requests per minute for public endpoints
};

// Clean up expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (value.resetTime < now) {
      requestCounts.delete(key);
    }
  }
}, 60000);

// ============================================
// TYPES
// ============================================

interface RateLimitConfig {
  windowMs?: number;
  max?: number;
  keyPrefix?: string;
  skipInternal?: boolean;
  message?: string;
}

type RateLimitType = 'default' | 'auth' | 'webhook' | 'internal' | 'public';

// ============================================
// HELPERS
// ============================================

/**
 * Get client identifier for rate limiting
 */
function getClientId(req: Request): string {
  // Check for internal service token
  const internalToken = req.headers['x-internal-token'];
  if (internalToken) {
    return `internal:${internalToken}`;
  }

  // Check for authenticated user
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }

  // Fall back to IP address
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0])
    : req.ip || req.socket.remoteAddress || 'unknown';

  return `ip:${ip}`;
}

/**
 * Check and update rate limit
 */
function checkRateLimit(key: string, limit: number, windowMs: number): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const record = requestCounts.get(key);

  // No existing record or window expired
  if (!record || record.resetTime < now) {
    const resetTime = now + windowMs;
    requestCounts.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: limit - 1, resetTime };
  }

  // Increment count
  record.count++;

  // Check if over limit
  if (record.count > limit) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  return {
    allowed: true,
    remaining: limit - record.count,
    resetTime: record.resetTime,
  };
}

// ============================================
// MIDDLEWARE FACTORIES
// ============================================

/**
 * Create rate limit middleware
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs = RATE_LIMIT_WINDOW,
    max = RATE_LIMITS.default,
    keyPrefix = 'rl',
    message = 'Too many requests, please try again later',
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = getClientId(req);
    const key = `${keyPrefix}:${clientId}`;
    const result = checkRateLimit(key, max, windowMs);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());

      res.status(429).json({
        error: message,
        retryAfter,
        limit: max,
      });
      return;
    }

    next();
  };
}

/**
 * Pre-configured rate limiters for common scenarios
 */
export const rateLimits = {
  // Standard API endpoints
  api: rateLimit({
    max: RATE_LIMITS.default,
    keyPrefix: 'api',
    message: 'Too many API requests, please slow down',
  }),

  // Authentication endpoints (login, register, etc.)
  auth: rateLimit({
    max: RATE_LIMITS.auth,
    keyPrefix: 'auth',
    message: 'Too many authentication attempts, please wait',
  }),

  // Webhook endpoints (higher limit for high-volume webhooks)
  webhook: rateLimit({
    max: RATE_LIMITS.webhook,
    keyPrefix: 'webhook',
    message: 'Webhook rate limit exceeded',
  }),

  // Internal service calls (very high limit)
  internal: rateLimit({
    max: RATE_LIMITS.internal,
    keyPrefix: 'internal',
    skipInternal: true,
    message: 'Internal rate limit exceeded',
  }),

  // Public endpoints (lower limit)
  public: rateLimit({
    max: RATE_LIMITS.public,
    keyPrefix: 'public',
    message: 'Too many requests from this source',
  }),

  // Stricter limit for sensitive operations
  strict: rateLimit({
    max: 20,
    windowMs: 60000,
    keyPrefix: 'strict',
    message: 'Rate limit exceeded for this operation',
  }),

  // Create custom rate limiter
  create: rateLimit,
};

// ============================================
// UTILITIES
// ============================================

/**
 * Skip rate limiting based on request characteristics
 */
export function skipRateLimit(req: Request): boolean {
  // Skip rate limiting for internal services
  if (req.headers['x-internal-token']) {
    return true;
  }

  // Skip for health checks
  if (req.path === '/health' || req.path === '/api/services/health') {
    return true;
  }

  return false;
}

/**
 * Conditional rate limiting
 */
export function conditionalRateLimit(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (skipRateLimit(req)) {
      next();
      return;
    }
    rateLimit(config)(req, res, next);
  };
}

export default rateLimits;
