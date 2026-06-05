import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        merchantId?: string;
        role?: string;
      };
      isInternalService?: boolean;
    }
  }
}

/**
 * Authentication middleware for internal services
 * Uses X-Internal-Token header for service-to-service communication
 */
export function internalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const internalToken = req.headers['x-internal-token'] as string;

  if (!internalToken) {
    logger.warn('Missing internal token', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_AUTH_TOKEN',
        message: 'Authentication required',
      },
    });
    return;
  }

  // Validate internal service token
  if (internalToken !== config.internalServiceToken) {
    logger.warn('Invalid internal token', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_AUTH_TOKEN',
        message: 'Invalid authentication token',
      },
    });
    return;
  }

  req.isInternalService = true;
  next();
}

/**
 * JWT authentication middleware
 * Validates JWT tokens for user authentication
 */
export function jwtAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Allow internal service calls without JWT
    if (req.headers['x-internal-token']) {
      return internalAuth(req, res, next);
    }

    logger.warn('Missing or invalid authorization header', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_AUTH',
        message: 'Authorization header required',
      },
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    // For development, allow a simple token format
    if (config.nodeEnv === 'development' && token.startsWith('dev_')) {
      const parts = token.split('_');
      if (parts.length >= 3) {
        req.user = {
          id: parts[1],
          merchantId: parts[2],
          role: parts[3] || 'user',
        };
        next();
        return;
      }
    }

    // Production JWT validation
    if (config.nodeEnv === 'development') {
      try {
        const decoded = jwt.decode(token) as { sub?: string; merchantId?: string; role?: string } | null;
        if (decoded) {
          req.user = {
            id: decoded.sub || 'unknown',
            merchantId: decoded.merchantId,
            role: decoded.role,
          };
          next();
          return;
        }
      } catch {
        // Fall through to error
      }
    }

    // Production JWT verification
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as {
      sub: string;
      merchantId?: string;
      role?: string;
    };

    req.user = {
      id: decoded.sub,
      merchantId: decoded.merchantId,
      role: decoded.role,
    };

    logger.debug('User authenticated', {
      userId: req.user.id,
      merchantId: req.user.merchantId,
      path: req.path,
    });

    next();
  } catch (error) {
    logger.warn('JWT validation failed', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      },
    });
  }
}

/**
 * Combined auth middleware - accepts either internal token or JWT
 */
export function auth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Check for internal service token first
  if (req.headers['x-internal-token']) {
    return internalAuth(req, res, next);
  }

  // Fall back to JWT auth
  return jwtAuth(req, res, next);
}

/**
 * Optional auth - allows unauthenticated requests but adds user info if present
 */
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const internalToken = req.headers['x-internal-token'];

  // Internal service takes priority
  if (internalToken) {
    return internalAuth(req, res, next);
  }

  // Check for JWT
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return jwtAuth(req, res, next);
  }

  // No auth provided - continue without user info
  next();
}

/**
 * Merchant validation middleware
 * Ensures requests are scoped to the authenticated merchant
 */
export function validateMerchant(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { merchantId } = req.body || req.query || {};

  // Internal services can access any merchant
  if (req.isInternalService) {
    next();
    return;
  }

  // Regular users must match their merchant
  if (req.user?.merchantId && merchantId && req.user.merchantId !== merchantId) {
    logger.warn('Merchant access denied', {
      userMerchant: req.user.merchantId,
      requestedMerchant: merchantId,
      userId: req.user.id,
    });

    res.status(403).json({
      success: false,
      error: {
        code: 'ACCESS_DENIED',
        message: 'Access to this merchant is not allowed',
      },
    });
    return;
  }

  next();
}

/**
 * Role-based access control middleware
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Internal services bypass role checks
    if (req.isInternalService) {
      next();
      return;
    }

    if (!req.user?.role) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ROLE_REQUIRED',
          message: 'Role information required',
        },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Role access denied', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission for this action',
        },
      });
      return;
    }

    next();
  };
}

/**
 * Pharmacist validation middleware
 * Ensures only authorized pharmacists can perform certain actions
 */
export function requirePharmacist(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.isInternalService) {
    next();
    return;
  }

  // Check for pharmacist role or internal service
  if (req.user?.role === 'pharmacist' || req.user?.role === 'admin') {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    error: {
      code: 'PHARMACIST_REQUIRED',
      message: 'Pharmacist authorization required for this action',
    },
  });
}