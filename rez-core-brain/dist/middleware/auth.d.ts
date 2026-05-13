import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            userId?: string;
            agentId?: string;
            isInternal?: boolean;
            requestId?: string;
        }
    }
}
interface JWTPayload {
    userId: string;
    agentId?: string;
    type: 'user' | 'agent' | 'service';
    iat?: number;
    exp?: number;
}
/**
 * Authentication middleware for user requests
 */
export declare function authenticate(req: Request, res: Response, next: NextFunction): void;
/**
 * Internal service authentication middleware
 */
export declare function internalAuth(req: Request, res: Response, next: NextFunction): void;
/**
 * Combined auth middleware - accepts either user JWT or internal token
 */
export declare function authenticateAny(req: Request, res: Response, next: NextFunction): void;
/**
 * Optional authentication - doesn't fail if no token provided
 */
export declare function optionalAuth(req: Request, res: Response, next: NextFunction): void;
/**
 * Generate a JWT token for a user
 */
export declare function generateUserToken(userId: string, agentId?: string, expiresIn?: string): string;
/**
 * Generate a service token for internal service communication
 */
export declare function generateServiceToken(serviceName: string): string;
/**
 * Verify a token without middleware
 */
export declare function verifyToken(token: string): JWTPayload | null;
/**
 * Request ID middleware - adds unique ID to each request
 */
export declare function requestId(req: Request, res: Response, next: NextFunction): void;
/**
 * Role-based access control middleware factory
 */
export declare function requireRole(...roles: string[]): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Rate limiting by user ID
 */
export declare function userRateLimit(): (req: Request, res: Response, next: NextFunction) => void;
declare const _default: {
    authenticate: typeof authenticate;
    internalAuth: typeof internalAuth;
    authenticateAny: typeof authenticateAny;
    optionalAuth: typeof optionalAuth;
    generateUserToken: typeof generateUserToken;
    generateServiceToken: typeof generateServiceToken;
    verifyToken: typeof verifyToken;
    requestId: typeof requestId;
    requireRole: typeof requireRole;
    userRateLimit: typeof userRateLimit;
};
export default _default;
//# sourceMappingURL=auth.d.ts.map