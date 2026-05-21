/**
 * REZ Flow Runtime - Authentication Middleware
 * Internal service authentication using timing-safe token comparison
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../services/logger';

export interface AuthenticatedRequest extends Request {
  serviceId?: string;
  isInternal?: boolean;
}

// Timing-safe string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to maintain constant time
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Validate X-Internal-Token header
 */
export function authenticateInternal(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string;
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;

  if (!token) {
    logger.warn('Missing internal token', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing authentication token'
      }
    });
    return;
  }

  if (!internalToken) {
    logger.error('INTERNAL_SERVICE_TOKEN not configured');
    res.status(500).json({
      success: false,
      error: {
        code: 'CONFIGURATION_ERROR',
        message: 'Service authentication not configured'
      }
    });
    return;
  }

  // Timing-safe comparison
  if (!timingSafeEqual(token, internalToken)) {
    logger.warn('Invalid internal token', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid authentication token'
      }
    });
    return;
  }

  // Extract service ID from header if provided
  req.serviceId = req.headers['x-service-id'] as string;
  req.isInternal = true;

  next();
}

/**
 * Validate API key for workflow builder
 */
export function authenticateApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const apiKey = req.headers['x-api-key'] as string;

  // Allow either internal token or API key
  if (req.headers['x-internal-token']) {
    return authenticateInternal(req, res, next);
  }

  if (!apiKey) {
    logger.warn('Missing API key', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing API key'
      }
    });
    return;
  }

  // In production, validate against stored API keys
  const validApiKeys = (process.env.VALID_API_KEYS || '').split(',').filter(Boolean);

  if (validApiKeys.length === 0) {
    // If no keys configured, allow all (development mode)
    logger.warn('No API keys configured - allowing all requests');
    next();
    return;
  }

  const isValid = validApiKeys.some(key => timingSafeEqual(key, apiKey));

  if (!isValid) {
    logger.warn('Invalid API key', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid API key'
      }
    });
    return;
  }

  req.isInternal = false;
  next();
}

/**
 * Optional authentication - allows unauthenticated requests but adds context if present
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string;
  const apiKey = req.headers['x-api-key'] as string;

  if (!token && !apiKey) {
    // No auth provided, continue without auth context
    next();
    return;
  }

  // Try internal token first
  if (token) {
    return authenticateInternal(req, res, next);
  }

  // Try API key
  if (apiKey) {
    return authenticateApiKey(req, res, next);
  }

  next();
}

/**
 * Validate webhook signature (for webhook triggers)
 */
export function validateWebhookSignature(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const signature = req.headers['x-webhook-signature'] as string;
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    // No secret configured, skip validation
    logger.warn('WEBHOOK_SECRET not configured - skipping signature validation');
    next();
    return;
  }

  if (!signature) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing webhook signature'
      }
    });
    return;
  }

  // Compute expected signature
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  if (!timingSafeEqual(signature, expectedSignature)) {
    logger.warn('Invalid webhook signature', {
      ip: req.ip,
      path: req.path
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid webhook signature'
      }
    });
    return;
  }

  next();
}

/**
 * Rate limiting by service
 */
export function serviceRateLimit(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const serviceId = req.serviceId || 'anonymous';

  // In production, implement actual rate limiting using Redis
  // This is a placeholder for the rate limiting logic
  const key = `ratelimit:${serviceId}:${req.path}`;

  // The actual rate limiting is handled by express-rate-limit middleware
  // This is just for logging and service identification
  logger.debug('Rate limit check', { serviceId, path: req.path, key });

  next();
}

export default {
  authenticateInternal,
  authenticateApiKey,
  optionalAuth,
  validateWebhookSignature,
  serviceRateLimit
};
