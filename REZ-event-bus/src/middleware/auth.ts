import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  apiKey?: string;
  internalToken?: string;
  requestId?: string;
}

// Permission types
export enum Permission {
  READ = 'read',
  WRITE = 'write',
  PUBLISH = 'publish',
  SUBSCRIBE = 'subscribe',
  ADMIN = 'admin',
}

// Token validation helper
function validateInternalToken(token: string, validTokens: string[]): boolean {
  return validTokens.includes(token);
}

// Middleware to verify internal service tokens
export function verifyInternalToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string | undefined;

  if (!token) {
    res.status(401).json({ error: 'Internal token required' });
    return;
  }

  const config = req.app.get('config');
  if (!config) {
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  const tokens = config.auth?.internalServiceTokens || {};
  const isValid = Object.values(tokens).includes(token);

  if (!isValid) {
    logger.warn('Invalid internal token attempt', { path: req.path, ip: req.ip });
    res.status(401).json({ error: 'Invalid internal token' });
    return;
  }

  (req as AuthenticatedRequest).internalToken = token;
  next();
}

// Middleware factory to require specific permission
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // For internal service tokens, all permissions are granted
    const authReq = req as AuthenticatedRequest;
    if (authReq.internalToken) {
      next();
      return;
    }

    // Check for API key with appropriate permissions
    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (apiKey) {
      const config = req.app.get('config');
      // API keys have all permissions for now
      if (config?.auth?.apiKeys?.includes(apiKey)) {
        next();
        return;
      }
    }

    logger.warn('Permission denied', { path: req.path, permission, ip: req.ip });
    res.status(403).json({ error: 'Permission denied' });
  };
}

export interface AuthConfig {
  apiKeys?: string[];
  internalTokens?: string[];
  bypassPaths?: string[];
}

export function createAuthMiddleware(config: AuthConfig) {
  const { apiKeys = [], internalTokens = [], bypassPaths = ['/health', '/ready'] } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    const path = req.path;

    // Bypass health checks
    if (bypassPaths.some(p => path.startsWith(p))) {
      return next();
    }

    // Check API key
    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (apiKey && apiKeys.includes(apiKey)) {
      return next();
    }

    // Check internal token
    const internalToken = req.headers['x-internal-token'] as string | undefined;
    if (internalToken && internalTokens.includes(internalToken)) {
      return next();
    }

    // No valid auth found
    logger.warn('Unauthorized access attempt', {
      path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid API key or internal token required',
    });
  };
}
