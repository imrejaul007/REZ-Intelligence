import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    userId?: string;
    apiKey?: string;
    internalToken?: string;
    requestId?: string;
}
export declare enum Permission {
    READ = "read",
    WRITE = "write",
    PUBLISH = "publish",
    SUBSCRIBE = "subscribe",
    ADMIN = "admin"
}
export declare function verifyInternalToken(req: Request, res: Response, next: NextFunction): void;
export declare function requirePermission(permission: Permission): (req: Request, res: Response, next: NextFunction) => void;
export interface AuthConfig {
    apiKeys?: string[];
    internalTokens?: string[];
    bypassPaths?: string[];
}
export declare function createAuthMiddleware(config: AuthConfig): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map