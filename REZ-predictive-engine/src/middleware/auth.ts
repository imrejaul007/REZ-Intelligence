import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';

/**
 * Authentication middleware for internal service-to-service calls
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string | undefined;
  const serviceToken = process.env.INTERNAL_SERVICE_TOKEN;

  // If no token is configured, skip authentication (development mode)
  if (!serviceToken) {
    logger.warn('No INTERNAL_SERVICE_TOKEN configured, skipping auth');
    return next();
  }

  // If service tokens JSON is provided, allow any service token from the list
  const serviceTokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON;
  if (serviceTokensJson) {
    try {
      const tokens = JSON.parse(serviceTokensJson);
      if (token && Object.values(tokens).includes(token)) {
        return next();
      }
    } catch {
      logger.warn('Invalid INTERNAL_SERVICE_TOKENS_JSON format');
    }
  }

  // Check main service token
  if (!token) {
    logger.warn('Missing X-Internal-Token header', {
      path: req.path,
      ip: req.ip
    });
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing authentication token'
      },
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Timing-safe comparison to prevent timing attacks
  const isValid = timingSafeEqual(token, serviceToken);

  if (!isValid) {
    logger.warn('Invalid authentication token', {
      path: req.path,
      ip: req.ip
    });
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid authentication token'
      },
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Optional auth middleware - continues even without token
 */
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string | undefined;

  if (token) {
    (req as unknown).authenticatedToken = token;
  }

  next();
}

/**
 * CORS middleware configuration
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // In production, restrict to specific origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];

  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Internal-Token');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
}

/**
 * Request ID middleware
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) ||
    generateRequestId();

  (req as unknown).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
