/**
 * Authentication Middleware - RABTUL Integration
 *
 * Uses RABTUL Auth Service for centralized token verification.
 * Falls back to local JWT for backward compatibility.
 *
 * @see RABTUL-Technologies/RAP.md
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../config/logger';

const authLogger = logger.child({ component: 'AuthMiddleware' });

// RABTUL Auth Service Configuration
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

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
 * RABTUL Auth Service response
 */
interface RABTULAuthResponse {
  success: boolean;
  user?: {
    id: string;
    phone?: string;
    email?: string;
    role?: string;
  };
  error?: string;
}

/**
 * Verify token via RABTUL Auth Service
 */
async function verifyWithRABTUL(token: string): Promise<JWTPayload | null> {
  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_SERVICE_TOKEN,
      },
      body: JSON.stringify({ token }),
    });

    if (response.ok) {
      const result: RABTULAuthResponse = await response.json();
      if (result.success && result.user) {
        return {
          userId: result.user.id,
          sessionId: undefined,
          channel: undefined,
          type: 'user',
        };
      }
    }
  } catch (error) {
    authLogger.warn('RABTUL auth service unavailable, using local verification', { error });
  }
  return null;
}

/**
 * Authenticate using JWT token
 * First tries RABTUL Auth Service, falls back to local JWT
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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

  // Try RABTUL Auth Service first
  const rabtulResult = await verifyWithRABTUL(token);
  if (rabtulResult) {
    req.user = {
      userId: rabtulResult.userId,
      sessionId: rabtulResult.sessionId,
      channel: rabtulResult.channel,
    };

    authLogger.debug('User authenticated via RABTUL', {
      userId: rabtulResult.userId,
    });

    next();
    return;
  }

  // Fallback to local JWT verification
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

    req.user = {
      userId: decoded.userId,
      sessionId: decoded.sessionId,
      channel: decoded.channel,
    };

    authLogger.debug('User authenticated locally', {
      userId: decoded.userId,
    });

    next();
  } catch (error) {
    authLogger.warn('Token verification failed', { error });

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired',
        },
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authorization token',
      },
    });
  }
}

/**
 * Service-to-service authentication
 */
export async function serviceAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const serviceToken = req.headers['x-internal-token'];

  if (!serviceToken || serviceToken !== INTERNAL_SERVICE_TOKEN) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid service token',
      },
    });
    return;
  }

  req.service = {
    serviceId: 'rez-unified-engine',
    name: 'REZ Unified Engine',
  };

  next();
}
