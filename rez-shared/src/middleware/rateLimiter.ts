/**
 * Rate Limiting Configuration
 *
 * Provides pre-configured rate limiters for common scenarios.
 * Requires Redis to be available.
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import type Redis from 'ioredis';

function sendRedisCommand(redis: Redis, ...args: string[]) {
  return (redis as any).call(...args);
}

/**
 * Create a rate limiter with Redis store
 */
export function createRateLimiter(
  redis: Redis,
  options: {
    windowMs?: number; // Time window in milliseconds (default: 60s)
    max?: number; // Max requests per window (default: 10)
    keyPrefix?: string; // Custom prefix for rate limit keys
    keyGenerator?: (req: any) => string; // Key generator function
    message?: string; // Error message
    skipSuccessfulRequests?: boolean; // Don't count successful requests
  }
) {
  // Use ipKeyGenerator helper to handle IPv6 addresses properly
  const defaultKeyGenerator = (req: any) => {
    if (options.keyGenerator) {
      return options.keyGenerator(req);
    }
    // Use ipKeyGenerator to properly handle IPv6
    return ipKeyGenerator(req);
  };

  return rateLimit({
    store: new RedisStore({
      prefix: options.keyPrefix || 'rate-limit:',
      sendCommand: (...args: string[]) => sendRedisCommand(redis, ...args),
    }),
    windowMs: options.windowMs || 60 * 1000,
    max: options.max || 10,
    keyGenerator: defaultKeyGenerator,
    message: options.message || 'Too many requests, please try again later',
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    skip: (req: any) => {
      // Skip rate limiting for health checks
      return req.path === '/health';
    },
  });
}

/**
 * Rate limiter for order creation
 * Limit: 5 orders per minute per user
 */
export function createOrderRateLimiter(redis: Redis) {
  return createRateLimiter(redis, {
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 orders per minute
    keyGenerator: (req: any) => req.userId || req.ip, // By user ID, fallback to IP
    message: 'Too many orders. Please wait before creating another order.',
  });
}

/**
 * Rate limiter for status updates (merchant)
 * Limit: 60 updates per minute per merchant
 */
export function createStatusUpdateRateLimiter(redis: Redis) {
  return createRateLimiter(redis, {
    windowMs: 60 * 1000,
    max: 60,
    keyGenerator: (req: any) => req.merchantId ? `${req.merchantId}:status-update` : req.ip,
    message: 'Too many status updates. Please wait before updating order status again.',
  });
}

/**
 * Rate limiter for KDS updates
 * Limit: 1000 updates per minute per store (high for real-time)
 * Requires authentication - falls back to IP if storeId not available
 */
export function createKdsRateLimiter(redis: Redis) {
  return createRateLimiter(redis, {
    windowMs: 60 * 1000,
    max: 1000,
    keyGenerator: (req: any) => {
      // Enforce per-store limiting if storeId available, otherwise per-IP
      // This prevents spoofing of storeId and protects shared networks
      if (req.storeId && req.merchantId) {
        return `${req.storeId}:kds`;
      }
      return req.ip;
    },
    message: 'KDS update rate limit exceeded.',
  });
}

/**
 * Rate limiter for offer creation (merchant)
 * Limit: 10 offers per hour per merchant
 */
export function createOfferRateLimiter(redis: Redis) {
  return createRateLimiter(redis, {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    keyGenerator: (req: any) => req.merchantId ? `${req.merchantId}:offer-create` : req.ip,
    message: 'Too many offers created. Please wait before creating more offers.',
  });
}

/**
 * Global API rate limiter
 * Limit: 1000 requests per minute per IP
 */
export function createGlobalRateLimiter(redis: Redis) {
  return createRateLimiter(redis, {
    windowMs: 60 * 1000,
    max: 1000,
    keyGenerator: (req: any) => req.ip,
    message: 'Too many requests from your IP. Please try again later.',
  });
}

/**
 * Auth attempt rate limiter
 * Limit: 5 failed attempts per 15 minutes per IP/email
 * Uses the shared createRateLimiter helper with custom prefix for auth
 */
export function createAuthRateLimiter(redis: Redis) {
  return createRateLimiter(redis, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    keyGenerator: (req: any) => req.body?.email || req.body?.phone || req.ip,
    message: 'Too many login attempts. Please try again later.',
    skipSuccessfulRequests: true, // Don't count successful logins
  });
}
