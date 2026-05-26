import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  cache: Map<string, { count: number; resetAt: number }>;
  get(key: string): { count: number; resetAt: number } | undefined;
  set(key: string, value: { count: number; resetAt: number }): void;
}

const memoryStore: RateLimitStore = {
  cache: new Map(),
  get(key: string) {
    const record = this.cache.get(key);
    if (record && Date.now() > record.resetAt) {
      this.cache.delete(key);
      return undefined;
    }
    return record;
  },
  set(key: string, value: { count: number; resetAt: number }) {
    this.cache.set(key, value);
  },
};

export interface RateLimitConfig {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: Request) => string;
}

export function createRateLimiter(config: RateLimitConfig = {}) {
  const {
    windowMs = 60000,
    max = 100,
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
      return next();
    }

    if (record.count >= max) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      });
      return;
    }

    record.count++;
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - record.count)));
    next();
  };
}
