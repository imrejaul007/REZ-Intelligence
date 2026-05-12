/**
 * Authentication Middleware
 * JWT and internal service token authentication
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../config/logger';

const authLogger = logger.child({ component: 'AuthMiddleware' });

// Extended Request with user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        sessionId?: string;
        channel?: string;
      };
      service?: {
        serviceId: string;
        name: string;
      };
    }
  }
}

/**
 * JWT payload structure
 */
interface JWTPayload {
  userId: string;
  sessionId?: string;
  channel?: string;
  type: 'user' | 'service';
  iat?: number;
  exp?: number;
}

/**
 * Authenticate using JWT token
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authorization header required',
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
        message: 'Authorization header must be: Bearer <token>',
      },
    });
    return;
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

    req.user = {
      userId: decoded.userId,
      sessionId: decoded.sessionId,
      channel: decoded.channel,
    };

    authLogger.debug('User authenticated', {
      userId: decoded.userId,
      path: req.path,
    });

    next();
  } catch (error) {
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

    authLogger.error('Authentication error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

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
 * Internal service authentication (for service-to-service communication)
 */
export function internalServiceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const serviceToken = req.headers['x-internal-token'] as string;

  if (!serviceToken) {
    // Check for API key
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Service token or API key required',
        },
      });
      return;
    }

    // Validate API key (simple validation)
    const validApiKeys = Object.values(config.internalServiceTokens);
    if (!validApiKeys.includes(apiKey)) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key',
        },
      });
      return;
    }

    authLogger.debug('API key authenticated', { path: req.path });
    next();
    return;
  }

  // Validate internal service token
  const validTokens = config.internalServiceTokens;
  let serviceId: string | undefined;

  for (const [name, token] of Object.entries(validTokens)) {
    if (token === serviceToken) {
      serviceId = name;
      break;
    }
  }

  if (!serviceId) {
    authLogger.warn('Invalid internal service token', {
      path: req.path,
      ip: req.ip,
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_SERVICE_TOKEN',
        message: 'Invalid internal service token',
      },
    });
    return;
  }

  req.service = {
    serviceId,
    name: serviceId,
  };

  authLogger.debug('Service authenticated', {
    service: serviceId,
    path: req.path,
  });

  next();
}

/**
 * Optional authentication - doesn't fail if no token provided
 */
export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    next();
    return;
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

    req.user = {
      userId: decoded.userId,
      sessionId: decoded.sessionId,
      channel: decoded.channel,
    };
  } catch {
    // Ignore token errors for optional auth
  }

  next();
}

/**
 * Generate JWT token for user
 */
export function generateUserToken(
  userId: string,
  options: {
    sessionId?: string;
    channel?: string;
    expiresIn?: string;
  } = {}
): string {
  const payload: JWTPayload = {
    userId,
    sessionId: options.sessionId,
    channel: options.channel,
    type: 'user',
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: options.expiresIn || '24h',
  });
}

/**
 * Generate service token for internal service
 */
export function generateServiceToken(serviceId: string): string | null {
  const token = config.internalServiceTokens[serviceId];
  return token || null;
}

/**
 * Verify token without throwing
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, config.jwt.secret) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Rate limit by user ID
 */
export function userRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const userId = req.user?.userId || req.ip;

  // In production, use Redis for rate limiting
  // This is a simple in-memory implementation
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  const now = Date.now();
  const windowMs = config.rateLimit.windowMs;
  const maxRequests = config.rateLimit.maxRequests;

  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + windowMs });
    next();
    return;
  }

  if (userLimit.count >= maxRequests) {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000),
      },
    });
    return;
  }

  userLimit.count++;
  next();
}
