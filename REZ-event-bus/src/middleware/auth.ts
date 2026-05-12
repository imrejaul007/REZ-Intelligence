import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Internal Service Authentication Middleware
 * Authenticates requests from internal services using a shared token
 */

interface ServiceInfo {
  service: string;
  permissions: string[];
}

const serviceTokens = new Map<string, ServiceInfo>();

function initializeServiceTokens(): void {
  const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON;
  if (tokensJson) {
    try {
      const tokens = JSON.parse(tokensJson);
      for (const [service, token] of Object.entries(tokens)) {
        serviceTokens.set(token as string, {
          service,
          permissions: getServicePermissions(service)
        });
      }
      console.log(`[Auth] Loaded ${serviceTokens.size} internal service tokens`);
    } catch (error) {
      console.error('[Auth] Failed to parse INTERNAL_SERVICE_TOKENS_JSON:', error);
    }
  }
}

function getServicePermissions(service: string): string[] {
  const permissions: Record<string, string[]> = {
    'admin-panel': ['read', 'write', 'delete', 'publish'],
    'payment-service': ['read', 'write', 'publish'],
    'identity-service': ['read', 'write', 'publish'],
    'capital-service': ['read', 'write', 'publish'],
    'bnpl-service': ['read', 'write', 'publish'],
    'ops-center': ['read', 'publish'],
    'intent-service': ['read', 'write', 'publish'],
    'wallet-service': ['read', 'write', 'publish'],
    'order-service': ['read', 'write', 'publish'],
    'merchant-service': ['read', 'write', 'publish'],
    'notification-service': ['read', 'publish'],
  };
  return permissions[service] || ['read', 'publish'];
}

initializeServiceTokens();

export interface AuthenticatedRequest extends Request {
  serviceInfo?: ServiceInfo;
}

/**
 * Verify internal service token
 */
export function verifyInternalToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'MISSING_TOKEN',
      message: 'X-Internal-Token header is required'
    });
    return;
  }

  const serviceInfo = serviceTokens.get(token);

  if (!serviceInfo) {
    res.status(401).json({
      error: 'Unauthorized',
      code: 'INVALID_TOKEN',
      message: 'Invalid service token'
    });
    return;
  }

  (req as AuthenticatedRequest).serviceInfo = serviceInfo;
  next();
}

/**
 * Require specific permissions for an endpoint
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    const permissions = authReq.serviceInfo?.permissions || [];

    if (!permissions.includes(permission)) {
      res.status(403).json({
        error: 'Forbidden',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `Required permission: ${permission}`
      });
      return;
    }

    next();
  };
}

/**
 * Timing-safe string comparison
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
