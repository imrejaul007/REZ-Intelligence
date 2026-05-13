/**
 * Authentication Middleware
 * Verifies internal service tokens for service-to-service communication
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../services/logger';

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
export enum Permission {
  READ = 'read',
  WRITE = 'write',
  PUBLISH = 'publish',
  SUBSCRIBE = 'subscribe',
  ADMIN = 'admin',
}

/**
 * Service permissions mapping
 */
const SERVICE_PERMISSIONS: Record<string, Permission[]> = {
  'payment-service': [Permission.READ, Permission.WRITE, Permission.PUBLISH, Permission.SUBSCRIBE],
  'wallet-service': [Permission.READ, Permission.WRITE, Permission.PUBLISH, Permission.SUBSCRIBE],
  'order-service': [Permission.READ, Permission.WRITE, Permission.PUBLISH, Permission.SUBSCRIBE],
  'notification-service': [Permission.READ, Permission.PUBLISH, Permission.SUBSCRIBE],
  'intent-service': [Permission.READ, Permission.WRITE, Permission.PUBLISH, Permission.SUBSCRIBE],
  'merchant-service': [Permission.READ, Permission.WRITE, Permission.PUBLISH, Permission.SUBSCRIBE],
  'identity-service': [Permission.READ, Permission.WRITE, Permission.PUBLISH, Permission.SUBSCRIBE],
  'admin-panel': [Permission.READ, Permission.WRITE, Permission.PUBLISH, Permission.SUBSCRIBE, Permission.ADMIN],
};

/**
 * Get permissions for a service
 */
function getServicePermissions(serviceName: string): Permission[] {
  return SERVICE_PERMISSIONS[serviceName] || [Permission.READ, Permission.PUBLISH];
}

/**
 * Generate request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Verify internal service token
 */
export function verifyInternalToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string;

  // Add request ID for tracing
  req.requestId = generateRequestId();

  if (!token) {
    logger.warn('Missing internal token', {
      requestId: req.requestId,
      path: req.path,
      ip: req.ip,
    });

    res.status(401).json({
      error: 'Unauthorized',
      code: 'MISSING_TOKEN',
      message: 'X-Internal-Token header is required',
      requestId: req.requestId,
    });
    return;
  }

  // Look up service by token
  const serviceName = config.auth.internalServiceTokens[token];

  if (!serviceName) {
    logger.warn('Invalid internal token', {
      requestId: req.requestId,
      path: req.path,
      ip: req.ip,
    });

    res.status(401).json({
      error: 'Unauthorized',
      code: 'INVALID_TOKEN',
      message: 'Invalid service token',
      requestId: req.requestId,
    });
    return;
  }

  // Set service info on request
  req.serviceInfo = {
    serviceName,
    permissions: getServicePermissions(serviceName),
  };

  logger.debug('Service authenticated', {
    requestId: req.requestId,
    serviceName,
    permissions: req.serviceInfo.permissions,
  });

  next();
}

/**
 * Require specific permission
 */
export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.serviceInfo) {
      res.status(401).json({
        error: 'Unauthorized',
        code: 'NOT_AUTHENTICATED',
        message: 'Authentication required',
        requestId: req.requestId,
      });
      return;
    }

    if (!req.serviceInfo.permissions.includes(permission)) {
      logger.warn('Insufficient permissions', {
        requestId: req.requestId,
        serviceName: req.serviceInfo.serviceName,
        requiredPermission: permission,
        currentPermissions: req.serviceInfo.permissions,
      });

      res.status(403).json({
        error: 'Forbidden',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `Required permission: ${permission}`,
        requestId: req.requestId,
      });
      return;
    }

    next();
  };
}

/**
 * Require admin permission
 */
export const requireAdmin = requirePermission(Permission.ADMIN);

/**
 * Require publish permission
 */
export const requirePublish = requirePermission(Permission.PUBLISH);

/**
 * Require subscribe permission
 */
export const requireSubscribe = requirePermission(Permission.SUBSCRIBE);

/**
 * Optional authentication - doesn't fail if no token
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string;
  req.requestId = generateRequestId();

  if (token) {
    const serviceName = config.auth.internalServiceTokens[token];
    if (serviceName) {
      req.serviceInfo = {
        serviceName,
        permissions: getServicePermissions(serviceName),
      };
    }
  }

  next();
}

/**
 * Add request ID to response headers
 */
export function addRequestId(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.requestId) {
    req.requestId = generateRequestId();
  }

  res.setHeader('X-Request-Id', req.requestId);
  next();
}

export default {
  verifyInternalToken,
  requirePermission,
  requireAdmin,
  requirePublish,
  requireSubscribe,
  optionalAuth,
  addRequestId,
};
