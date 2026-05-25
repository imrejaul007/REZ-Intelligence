/**
 * REZ Care - Authentication Middleware
 *
 * Verifies JWT tokens via RABTUL Auth Service (4002)
 * Supports both internal service tokens and user JWTs
 */

import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// ============================================
// TYPES
// ============================================

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  role: 'admin' | 'agent' | 'merchant' | 'customer' | 'service';
  permissions?: string[];
  clientId?: string;
}

export interface AuthResult {
  valid: boolean;
  user?: AuthUser;
  error?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  isInternal?: boolean;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      isInternal?: boolean;
    }
  }
}

// ============================================
// AUTH CLIENT
// ============================================

class AuthClient {
  /**
   * Verify user JWT token via RABTUL Auth Service
   */
  async verifyToken(token: string): Promise<AuthResult> {
    try {
      const response = await axios.get(`${AUTH_SERVICE_URL}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Internal-Token': INTERNAL_TOKEN,
        },
        timeout: 5000,
      });

      if (response.data.success && response.data.user) {
        return {
          valid: true,
          user: this.mapUser(response.data.user),
        };
      }

      return { valid: false, error: 'Invalid token' };
    } catch (error) {
      console.error('[AuthClient] Token verification failed:', error.message);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Verify internal service token
   */
  verifyInternalToken(token: string): boolean {
    return token === INTERNAL_TOKEN && INTERNAL_TOKEN.length > 0;
  }

  /**
   * Map raw user data to AuthUser interface
   */
  private mapUser(data): AuthUser {
    return {
      id: data.id || data.userId || data._id,
      email: data.email,
      phone: data.phone,
      name: data.name,
      role: data.role || 'customer',
      permissions: data.permissions || [],
      clientId: data.clientId || data.merchantId,
    };
  }
}

export const authClient = new AuthClient();

// ============================================
// MIDDLEWARE FUNCTIONS
// ============================================

/**
 * Require valid user authentication
 * Checks Authorization header for Bearer token
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'Authorization header required' });
    return;
  }

  const [type, token] = authHeader.split(' ');

  if (type !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Invalid authorization format. Use: Bearer <token>' });
    return;
  }

  authClient.verifyToken(token).then(result => {
    if (!result.valid) {
      res.status(401).json({ error: result.error || 'Invalid token' });
      return;
    }

    req.user = result.user;
    next();
  }).catch(error => {
    console.error('[AuthMiddleware] Unexpected error:', error);
    res.status(500).json({ error: 'Authentication service unavailable' });
  });
}

/**
 * Optional authentication - sets user if valid, continues otherwise
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  const [type, token] = authHeader.split(' ');

  if (type !== 'Bearer' || !token) {
    next();
    return;
  }

  authClient.verifyToken(token).then(result => {
    if (result.valid) {
      req.user = result.user;
    }
    next();
  }).catch(() => {
    next();
  });
}

/**
 * Require internal service token
 * Used for service-to-service communication
 */
export function requireInternal(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    res.status(401).json({ error: 'Internal token required' });
    return;
  }

  if (!authClient.verifyInternalToken(token)) {
    res.status(403).json({ error: 'Invalid internal token' });
    return;
  }

  (req as AuthenticatedRequest).isInternal = true;
  next();
}

/**
 * Require specific role(s)
 */
export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role,
      });
      return;
    }

    next();
  };
}

/**
 * Require specific permission(s)
 */
export function requirePermission(...permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.every(p => userPermissions.includes(p));

    if (!hasPermission) {
      res.status(403).json({
        error: 'Missing required permissions',
        required: permissions,
      });
      return;
    }

    next();
  };
}

/**
 * Require specific client access
 * Ensures user can only access their own client's data
 */
export function requireClientAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const requestedClientId = req.params.clientId || req.body?.clientId;

  if (!requestedClientId) {
    next();
    return;
  }

  // Admins can access any client
  if (req.user?.role === 'admin') {
    next();
    return;
  }

  // Services can access any client
  if (req.user?.role === 'service') {
    next();
    return;
  }

  // Agents can access their assigned clients
  if (req.user?.role === 'agent') {
    next();
    return;
  }

  // Other users can only access their own client
  if (req.user?.clientId && req.user.clientId !== requestedClientId) {
    res.status(403).json({
      error: 'Access denied to this client',
      requested: requestedClientId,
      yourClient: req.user.clientId,
    });
    return;
  }

  next();
}

/**
 * Combined middleware for common auth patterns
 */
export const auth = {
  // Public endpoint (no auth required)
  public: (req: Request, res: Response, next: NextFunction) => next(),

  // User authentication required
  user: requireAuth,

  // Internal service call
  internal: requireInternal,

  // Either user OR internal
  userOrInternal: (req: Request, res: Response, next: NextFunction) => {
    const internalToken = req.headers['x-internal-token'];
    if (internalToken && authClient.verifyInternalToken(internalToken as string)) {
      (req as AuthenticatedRequest).isInternal = true;
      next();
      return;
    }
    requireAuth(req as AuthenticatedRequest, res, next);
  },

  // Admin only
  admin: requireRole('admin'),

  // Agent or admin
  agent: requireRole('admin', 'agent'),

  // Merchant access
  merchant: requireRole('admin', 'merchant'),
};

export default auth;
