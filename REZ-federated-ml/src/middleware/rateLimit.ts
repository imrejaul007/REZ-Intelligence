import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

export interface RateLimitConfig {
  windowMs?: number;
  max?: number;
  message?: string;
}

export function createRateLimiter(config: RateLimitConfig = {}) {
  const {
    windowMs = 60 * 1000,
    max = 100,
    message = 'Too many requests, please try again later',
  } = config;

  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
    },
  });
}

export const publicLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 });
export const apiLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 100 });
export const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
