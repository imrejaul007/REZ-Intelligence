import { Request, Response, NextFunction } from 'express';
export interface RateLimitConfig {
    windowMs?: number;
    max?: number;
    keyGenerator?: (req: Request) => string;
}
export declare function createRateLimiter(config?: RateLimitConfig): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=rateLimit.d.ts.map