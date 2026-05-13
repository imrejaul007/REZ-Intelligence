/**
 * Authentication Middleware
 * Verifies internal service tokens for service-to-service communication
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Service information extracted from token
 */
export interface ServiceInfo {
    serviceName: string;
    permissions: string[];
}
/**
 * Authenticated request with service info
 */
export interface AuthenticatedRequest extends Request {
    serviceInfo?: ServiceInfo;
    requestId?: string;
}
/**
 * Permission types
 */
export declare enum Permission {
    READ = "read",
    WRITE = "write",
    PUBLISH = "publish",
    SUBSCRIBE = "subscribe",
    ADMIN = "admin"
}
/**
 * Verify internal service token
 */
export declare function verifyInternalToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
/**
 * Require specific permission
 */
export declare function requirePermission(permission: Permission): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
/**
 * Require admin permission
 */
export declare const requireAdmin: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
/**
 * Require publish permission
 */
export declare const requirePublish: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
/**
 * Require subscribe permission
 */
export declare const requireSubscribe: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
/**
 * Optional authentication - doesn't fail if no token
 */
export declare function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
/**
 * Add request ID to response headers
 */
export declare function addRequestId(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
declare const _default: {
    verifyInternalToken: typeof verifyInternalToken;
    requirePermission: typeof requirePermission;
    requireAdmin: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
    requirePublish: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
    requireSubscribe: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
    optionalAuth: typeof optionalAuth;
    addRequestId: typeof addRequestId;
};
export default _default;
//# sourceMappingURL=auth.d.ts.map