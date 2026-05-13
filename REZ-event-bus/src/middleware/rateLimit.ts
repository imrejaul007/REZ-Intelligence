import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { config } from '../config';

/**
 * Redis-based distributed rate limiter
 * Uses sliding window algorithm
 */
export class RateLimiter {
  private defaultWindowMs: number;
  private defaultMaxRequests: number;
  private redis: Redis;

  constructor(defaultWindowMs = 60000, defaultMaxRequests = 100) {
    this.defaultWindowMs = defaultWindowMs;
    this.defaultMaxRequests = defaultMaxRequests;
    this.redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      keyPrefix: config.redis.keyPrefix,
    });
  }

  /**
   * Check rate limit for a key
   */
  async check(
    key: string,
    options?: { windowMs?: number; maxRequests?: number }
  ): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
    const windowMs = options?.windowMs || this.defaultWindowMs;
    const maxRequests = options?.maxRequests || this.defaultMaxRequests;
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      const redisKey = `ratelimit:${key}`;

      // Use pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      pipeline.zremrangebyscore(redisKey, 0, windowStart);
      pipeline.zcard(redisKey);
      pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
      pipeline.pexpire(redisKey, windowMs);

      const results = await pipeline.exec();

      if (!results) {
        return { allowed: true, remaining: maxRequests, resetMs: windowMs };
      }

      const currentCount = results[1][1] as number;

      if (currentCount >= maxRequests) {
        const oldestEntry = await this.redis.zrange(redisKey, 0, 0, 'WITHSCORES');
        const oldestTimestamp = oldestEntry.length > 1 ? parseInt(oldestEntry[1]) : now;
        const resetMs = Math.max(0, oldestTimestamp + windowMs - now);
        return { allowed: false, remaining: 0, resetMs };
      }

      return {
        allowed: true,
        remaining: maxRequests - currentCount - 1,
        resetMs: windowMs
      };
    } catch (error) {
      console.error('[RateLimit] Error:', error);
      return { allowed: true, remaining: maxRequests, resetMs: windowMs };
    }
  }

  /**
   * Express middleware factory
   */
  middleware(options?: { windowMs?: number; maxRequests?: number; keyGenerator?: (req: Request) => string }) {
    const windowMs = options?.windowMs || this.defaultWindowMs;
    const maxRequests = options?.maxRequests || this.defaultMaxRequests;
    const keyGenerator = options?.keyGenerator || ((req) => req.ip || 'unknown');

    return async (req: Request, res: Response, next: NextFunction) => {
      const key = keyGenerator(req);
      const result = await this.check(key, { windowMs, maxRequests });

      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() + result.resetMs) / 1000).toString());

      if (!result.allowed) {
        res.setHeader('Retry-After', Math.ceil(result.resetMs / 1000).toString());
        res.status(429).json({
          error: 'Too Many Requests',
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfterMs: result.resetMs
        });
        return;
      }

      next();
    };
  }
}

// Pre-configured rate limiters
export const eventBusLimiter = new RateLimiter(60000, 100); // 100 events/min
export const publishLimiter = new RateLimiter(60000, 50); // 50 publishes/min
export const subscriptionLimiter = new RateLimiter(60000, 30); // 30 subscriptions/min
