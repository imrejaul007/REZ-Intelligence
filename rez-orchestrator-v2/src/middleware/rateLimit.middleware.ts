import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { appConfig } from '../config';
import { logger } from '../utils/logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export class RateLimiter {
  private redis: Redis;
  private defaultLimit: number;
  private windowMs: number;

  constructor(redis: Redis) {
    this.redis = redis;
    this.defaultLimit = appConfig.rateLimit.maxRequests;
    this.windowMs = appConfig.rateLimit.windowMs;
  }

  private getKey(req: Request): string {
    // Use service ID if authenticated, otherwise use IP
    const identifier = (req as any).serviceId || req.ip || 'unknown';
    return `ratelimit:${identifier}`;
  }

  async check(req: Request): Promise<RateLimitInfo> {
    const key = this.getKey(req);
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Use Redis sorted set for sliding window
    const multi = this.redis.multi();

    // Remove old entries
    multi.zremrangebyscore(key, 0, windowStart);

    // Count current requests
    multi.zcard(key);

    // Add current request
    multi.zadd(key, now, `${now}-${Math.random()}`);

    // Set expiry
    multi.expire(key, Math.ceil(this.windowMs / 1000));

    const results = await multi.exec();

    if (!results) {
      return {
        limit: this.defaultLimit,
        remaining: this.defaultLimit,
        reset: now + this.windowMs,
      };
    }

    const count = results[1][1] as number;
    const remaining = Math.max(0, this.defaultLimit - count - 1);
    const reset = now + this.windowMs;

    return {
      limit: this.defaultLimit,
      remaining,
      reset,
    };
  }

  async middleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const info = await this.check(req);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', info.limit);
      res.setHeader('X-RateLimit-Remaining', info.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(info.reset / 1000));

      if (info.remaining <= 0) {
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          serviceId: (req as any).serviceId,
          resetAt: new Date(info.reset).toISOString(),
        });

        res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          retryAfter: Math.ceil((info.reset - Date.now()) / 1000),
        });
        return;
      }

      next();
    } catch (error) {
      // If Redis fails, allow the request but log the error
      logger.error('Rate limiter error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next();
    }
  }
}

export const createRateLimiter = (redis: Redis): RateLimiter => {
  return new RateLimiter(redis);
};
