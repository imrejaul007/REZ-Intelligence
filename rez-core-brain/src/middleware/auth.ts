import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config, getInternalServiceTokens } from '../config';
import { logger } from '../utils/logger';

// Extend Express Request type
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
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authorization header is required',
      },
    });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN_FORMAT',
        message: 'Authorization header must be in format: Bearer <token>',
      },
    });
    return;
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as JWTPayload;

    req.userId = decoded.userId;
    req.agentId = decoded.agentId;
    req.isInternal = decoded.type === 'service';

    next();
  } catch (error) {
    logger.warn('JWT verification failed', { error });

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired',
        },
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token',
        },
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Authentication failed',
      },
    });
  }
}

/**
 * Internal service authentication middleware
 */
export function internalAuth(req: Request, res: Response, next: NextFunction): void {
  const internalToken = req.headers['x-internal-token'] as string;

  if (!internalToken) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Internal token is required',
      },
    });
    return;
  }

  const tokens = getInternalServiceTokens();
  const serviceName = req.headers['x-service-name'] as string;

  // Verify token matches service name
  const expectedToken = tokens[serviceName];
  if (!expectedToken || expectedToken !== internalToken) {
    logger.warn('Invalid internal token', { serviceName });
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_SERVICE_TOKEN',
        message: 'Invalid internal service token',
      },
    });
    return;
  }

  req.isInternal = true;
  req.agentId = serviceName;

  next();
}

/**
 * Combined auth middleware - accepts either user JWT or internal token
 */
export function authenticateAny(req: Request, res: Response, next: NextFunction): void {
  // Try internal auth first
  const internalToken = req.headers['x-internal-token'] as string;
  const serviceName = req.headers['x-service-name'] as string;

  if (internalToken && serviceName) {
    const tokens = getInternalServiceTokens();
    const expectedToken = tokens[serviceName];

    if (expectedToken && expectedToken === internalToken) {
      req.isInternal = true;
      req.agentId = serviceName;
      next();
      return;
    }
  }

  // Fall back to user JWT auth
  authenticate(req, res, next);
}

/**
 * Optional authentication - doesn't fail if no token provided
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  authenticate(req, res, next);
}

/**
 * Generate a JWT token for a user
 */
export function generateUserToken(
  userId: string,
  agentId?: string,
  expiresIn?: string
): string {
  const payload: JWTPayload = {
    userId,
    agentId,
    type: 'user',
  };

  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: expiresIn || config.JWT_EXPIRES_IN,
  });
}

/**
 * Generate a service token for internal service communication
 */
export function generateServiceToken(serviceName: string): string {
  const payload: JWTPayload = {
    userId: `service:${serviceName}`,
    type: 'service',
  };

  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: '24h',
  });
}

/**
 * Verify a token without middleware
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, config.JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Request ID middleware - adds unique ID to each request
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = req.headers['x-request-id'] as string ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  req.requestId = id;
  res.setHeader('X-Request-ID', id);

  next();
}

/**
 * Role-based access control middleware factory
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // This would be expanded with actual role checking
    // For now, just pass through
    next();
  };
}

/**
 * Rate limiting by user ID
 */
export function userRateLimit() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        },
      });
      return;
    }

    next();
  };
}

export default {
  authenticate,
  internalAuth,
  authenticateAny,
  optionalAuth,
  generateUserToken,
  generateServiceToken,
  verifyToken,
  requestId,
  requireRole,
  userRateLimit,
};
