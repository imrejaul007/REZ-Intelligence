import { Request, Response, NextFunction } from 'express';
export interface AuthConfig {
    apiKeys?: string[];
    internalTokens?: string[];
    bypassPaths?: string[];
}
/**
 * Request ID middleware - adds unique request ID to each request
 */
export declare function requestId(req: Request, _res: Response, next: NextFunction): void;
/**
 * Simple authentication middleware (no-op for backward compatibility)
 */
export declare function authenticate(_req: Request, _res: Response, next: NextFunction): void;
/**
 * Internal auth middleware (no-op for backward compatibility)
 */
export declare function internalAuth(_req: Request, _res: Response, next: NextFunction): void;
/**
 * Any auth middleware (no-op for backward compatibility)
 */
export declare function authenticateAny(_req: Request, _res: Response, next: NextFunction): void;
export declare function createAuthMiddleware(config: AuthConfig): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map