import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
export declare function validateRequest(schema: ZodSchema): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function authenticateRequest(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
export declare function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function rateLimiter(options?: {
    windowMs?: number;
    maxRequests?: number;
}): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=index.d.ts.map