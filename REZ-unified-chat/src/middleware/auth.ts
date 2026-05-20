/**
 * REZ Unified Chat - Authentication Middleware
 *
 * Uses RABTUL Auth Service for internal service authentication.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
const INTERNAL_SERVICE_TOKENS_JSON = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
const NODE_ENV = process.env.NODE_ENV || 'development';

interface ServiceTokens {
  [service: string]: string;
}

let serviceTokens: ServiceTokens = {};
try {
  serviceTokens = JSON.parse(INTERNAL_SERVICE_TOKENS_JSON);
} catch {
  serviceTokens = {};
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Verify internal service token
 */
function verifyInternalToken(token: string): boolean {
  if (!token) return false;

  if (INTERNAL_SERVICE_TOKEN && timingSafeCompare(token, INTERNAL_SERVICE_TOKEN)) {
    return true;
  }

  for (const t of Object.values(serviceTokens)) {
    if (timingSafeCompare(token, t)) {
      return true;
    }
  }

  return false;
}

/**
 * Authentication middleware for internal services
 * Requires X-Internal-Token header
 */
export function requireInternalAuth(req: Request, res: Response, next: NextFunction): void {
  if (NODE_ENV !== 'production' && !INTERNAL_SERVICE_TOKEN && Object.keys(serviceTokens).length === 0) {
    console.warn('[AUTH] Running in development mode without authentication');
    (req as any).isInternalService = true;
    (req as any).serviceName = 'development';
    return next();
  }

  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    console.warn('Authentication failed: No token provided', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });

    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Provide X-Internal-Token header.'
      }
    });
  }

  if (!verifyInternalToken(token)) {
    console.warn('Authentication failed: Invalid token', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });

    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token.'
      }
    });
  }

  (req as any).isInternalService = true;
  (req as any).serviceName = 'internal-service';

  next();
}
