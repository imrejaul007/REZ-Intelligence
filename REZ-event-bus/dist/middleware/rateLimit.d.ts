import { Request, Response, NextFunction } from 'express';
/**
 * Redis-based distributed rate limiter
 * Uses sliding window algorithm
 */
export declare class RateLimiter {
    private defaultWindowMs;
    private defaultMaxRequests;
    private redis;
    constructor(defaultWindowMs?: number, defaultMaxRequests?: number);
    /**
     * Check rate limit for a key
     */
    check(key: string, options?: {
        windowMs?: number;
        maxRequests?: number;
    }): Promise<{
        allowed: boolean;
        remaining: number;
        resetMs: number;
    }>;
    /**
     * Express middleware factory
     */
    middleware(options?: {
        windowMs?: number;
        maxRequests?: number;
        keyGenerator?: (req: Request) => string;
    }): (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
export declare const eventBusLimiter: RateLimiter;
export declare const publishLimiter: RateLimiter;
export declare const subscriptionLimiter: RateLimiter;
//# sourceMappingURL=rateLimit.d.ts.map