import { Request, Response, NextFunction } from 'express';
export interface AuthConfig {
    apiKeys?: string[];
    internalTokens?: string[];
    bypassPaths?: string[];
}
export declare function createAuthMiddleware(config: AuthConfig): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map