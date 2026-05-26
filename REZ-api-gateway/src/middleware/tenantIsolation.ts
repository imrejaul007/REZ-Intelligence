/**
 * Tenant Isolation Middleware
 * Handles 3 client types:
 * 1. REZ Ecosystem - Full intelligence sharing
 * 2. Non-REZ Companies - Isolated tenant data
 * 3. Rabtul SaaS - Plugin-based isolation
 */

import { Request, Response, NextFunction } from 'express';

export enum ClientType {
  REZ_ECOSYSTEM = 'rez_ecosystem',
  NON_REZ = 'non_rez',
  RABTUL_SAAS = 'rabtul_saas'
}

export interface TenantContext {
  tenantId: string;
  clientType: ClientType;
  merchantId?: string;
  permissions: string[];
  dataIsolation: 'full' | 'limited' | 'isolated';
  intelligenceSharing: boolean;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

// Tenant configuration by client type
const TENANT_CONFIG = {
  [ClientType.REZ_ECOSYSTEM]: {
    dataIsolation: 'full' as const,
    intelligenceSharing: true,
    permissions: ['read', 'write', 'admin', 'share']
  },
  [ClientType.NON_REZ]: {
    dataIsolation: 'isolated' as const,
    intelligenceSharing: false,
    permissions: ['read', 'write']
  },
  [ClientType.RABTUL_SAAS]: {
    dataIsolation: 'isolated' as const,
    intelligenceSharing: false,
    permissions: ['read', 'write', 'plugin']
  }
};

/**
 * Extract tenant from API key or JWT
 */
export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  const authHeader = req.headers['authorization'] as string;

  // For development, allow X-Tenant-ID header
  const devTenantId = req.headers['x-tenant-id'] as string;
  const devClientType = req.headers['x-client-type'] as ClientType;

  if (devTenantId && devClientType && process.env.NODE_ENV !== 'production') {
    const config = TENANT_CONFIG[devClientType];
    req.tenant = {
      tenantId: devTenantId,
      clientType: devClientType,
      permissions: config.permissions,
      dataIsolation: config.dataIsolation,
      intelligenceSharing: config.intelligenceSharing
    };
    return next();
  }

  // Extract tenant from API key format: rez_{type}_{tenantId}
  if (apiKey && apiKey.startsWith('rez_')) {
    const parts = apiKey.split('_');
    if (parts.length >= 3) {
      const clientType = parts[1] as ClientType;
      const tenantId = parts.slice(2).join('_');

      if (TENANT_CONFIG[clientType]) {
        const config = TENANT_CONFIG[clientType];
        req.tenant = {
          tenantId,
          clientType,
          permissions: config.permissions,
          dataIsolation: config.dataIsolation,
          intelligenceSharing: config.intelligenceSharing
        };
        return next();
      }
    }
  }

  // Check for REZ ecosystem internal token
  const internalToken = req.headers['x-internal-token'] as string;
  if (internalToken && internalToken === process.env.INTERNAL_SERVICE_TOKEN) {
    req.tenant = {
      tenantId: 'rez_internal',
      clientType: ClientType.REZ_ECOSYSTEM,
      permissions: ['admin'],
      dataIsolation: 'full',
      intelligenceSharing: true
    };
    return next();
  }

  // Default: Non-authenticated (will be rejected by auth middleware if needed)
  res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Valid API key or authentication required'
    }
  });
}

/**
 * Check if tenant has permission
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Tenant context required' }
      });
      return;
    }

    if (!req.tenant.permissions.includes(permission) && !req.tenant.permissions.includes('admin')) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Permission '${permission}' required`
        }
      });
      return;
    }

    next();
  };
}

/**
 * Check if intelligence sharing is allowed
 */
export function requireIntelligenceSharing(req: Request, res: Response, next: NextFunction): void {
  if (!req.tenant) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    return;
  }

  if (!req.tenant.intelligenceSharing) {
    res.status(403).json({
      success: false,
      error: {
        code: 'INTELLIGENCE_RESTRICTED',
        message: 'Intelligence sharing not allowed for this tenant type'
      }
    });
    return;
  }

  next();
}
