/**
 * rateLimiter.ts — Redis-backed HTTP rate limiting middleware
 *
 * NTF-011 FIX: Returns 503 when Redis is unavailable instead of falling back
 * to an in-memory Map. In-memory maps are per-process-instance; in multi-instance
 * deployments (e.g. multiple Render dynos, Kubernetes pods) they provide no
 * actual rate limiting and allow attackers to bypass limits by distributing
 * requests across instances.
 *
 * This follows the same fail-closed pattern as GAM-MED-02 (already fixed in
 * rez-gamification-service/src/middleware/rateLimiter.ts).
 */

import { Request, Response, NextFunction } from 'express';
import { bullmqRedis } from '../config/redis';
import { createServiceLogger } from '../config/logger';

const logger = createServiceLogger('rate-limiter');

/**
 * Create an IP-based rate limiter middleware.
 *
 * @param prefix - Redis key prefix for this limiter (e.g. 'notification-send')
 * @param maxRequests - Maximum requests allowed within the window
 * @param windowSec - Time window in seconds
 */
function createRateLimiter(prefix: string, maxRequests: number, windowSec: number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = `rl:${prefix}:${req.ip}`;

    try {
      const count = await bullmqRedis.incr(key);

      if (count === 1) {
        await bullmqRedis.expire(key, windowSec);
      }

      if (count > maxRequests) {
        res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: windowSec,
        });
        return;
      }

      // Attach remaining count to response headers for client visibility
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - count)));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + windowSec));

      next();
    } catch (redisErr: unknown) {
      // NTF-011 FIX: Fail closed — return 503 instead of falling back to
      // in-memory Map. An in-memory Map is not shared across instances,
      // so attackers can trivially bypass rate limits in multi-instance deployments.
      // Returning 503 signals to upstream load balancers to retry a different
      // instance, spreading load evenly while preserving the service's integrity.
      logger.error('[RateLimiter] Redis unavailable — rejecting request (fail-closed)', {
        key,
        error: redisErr instanceof Error ? redisErr.message : String(redisErr),
        ip: req.ip,
      });
      res.status(503).json({
        success: false,
        error: 'Rate limiting unavailable',
      });
    }
  };
}

/**
 * Create a user-ID-based rate limiter middleware.
 * Falls back to IP-based limiting if userId is not available on the request.
 *
 * @param prefix - Redis key prefix for this limiter
 * @param maxRequests - Maximum requests allowed within the window
 * @param windowSec - Time window in seconds
 */
function createUserRateLimiter(prefix: string, maxRequests: number, windowSec: number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).userId as string | undefined;
    const key = userId
      ? `rl:${prefix}:user:${userId}`
      : `rl:${prefix}:ip:${req.ip}`;

    try {
      const count = await bullmqRedis.incr(key);

      if (count === 1) {
        await bullmqRedis.expire(key, windowSec);
      }

      if (count > maxRequests) {
        res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: windowSec,
        });
        return;
      }

      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - count)));

      next();
    } catch (redisErr: unknown) {
      // NTF-011 FIX: Fail closed — do not fall back to in-memory tracking.
      logger.error('[RateLimiter] Redis unavailable — rejecting request (fail-closed)', {
        key,
        error: redisErr instanceof Error ? redisErr.message : String(redisErr),
      });
      res.status(503).json({
        success: false,
        error: 'Rate limiting unavailable',
      });
    }
  };
}

// Pre-built limiters for notification endpoints

/** Notification send: 60 requests per minute per IP */
export const notificationSendLimiter = createRateLimiter('notif:send', 60, 60);

/** Notification batch send: 10 requests per minute per IP */
export const notificationBatchLimiter = createRateLimiter('notif:batch', 10, 60);

/** Digest trigger: 5 requests per minute per IP */
export const digestTriggerLimiter = createRateLimiter('notif:digest', 5, 60);

export { createRateLimiter, createUserRateLimiter };
