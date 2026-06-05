import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger.js';

/**
 * Internal service authentication middleware
 * Validates X-Internal-Token header against registered service tokens
 */
export function internalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const internalToken = req.headers['x-internal-token'] as string;

  if (!internalToken) {
    logger.warn('Missing internal auth token', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing authentication token',
      },
    });
    return;
  }

  // Check if token matches any registered service
  const serviceName = Object.entries(config.auth.serviceTokens).find(
    ([_, token]) => token === internalToken
  )?.[0];

  if (!serviceName) {
    logger.warn('Invalid internal auth token', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid authentication token',
      },
    });
    return;
  }

  // Attach service name to request for downstream use
  (req as Request & { serviceName?: string }).serviceName = serviceName;

  logger.debug('Internal auth successful', {
    serviceName,
    path: req.path,
  });

  next();
}

/**
 * Optional internal auth - doesn't fail if no token present
 */
export function optionalInternalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const internalToken = req.headers['x-internal-token'] as string;

  if (internalToken) {
    const serviceName = Object.entries(config.auth.serviceTokens).find(
      ([_, token]) => token === internalToken
    )?.[0];

    if (serviceName) {
      (req as Request & { serviceName?: string }).serviceName = serviceName;
    }
  }

  next();
}

/**
 * Webhook signature verification middleware
 * Validates carrier webhook signatures
 */
export function webhookSignatureMiddleware(
  carrier: 'jio' | 'airtel'
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const signature = req.headers['x-webhook-signature'] as string;

    if (!signature) {
      logger.warn(`Missing ${carrier} webhook signature`, {
        path: req.path,
        ip: req.ip,
      });
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing webhook signature',
        },
      });
      return;
    }

    // Verify signature based on carrier
    // Jio: HMAC-SHA256 of payload with webhook secret
    // Airtel: JWT or HMAC verification
    // Google RCS: OAuth 2.0 or HMAC

    const webhookSecret = process.env[`RCS_${carrier.toUpperCase()}_WEBHOOK_SECRET`];

    if (!webhookSecret) {
      logger.warn(`[RCS:Auth] ${carrier} webhook secret not configured - accepting anyway`);
      return next();
    }

    const isValid = verifyCarrierSignature(carrier, payload, signature, webhookSecret);
    if (!isValid) {
      logger.warn(`[RCS:Auth] Invalid ${carrier} webhook signature`, { path: req.path });
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Invalid webhook signature',
      });
    }

    logger.debug(`${carrier} webhook signature verified`, {
      path: req.path,
    });

    next();
  };
}

/**
 * Verify webhook signature based on carrier type
 */
function verifyCarrierSignature(
  carrier: string,
  payload: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require('crypto');

  switch (carrier.toLowerCase()) {
    case 'jio':
    case 'airtel':
    case 'google':
    default:
      // All carriers use HMAC-SHA256
      const expectedSignature = crypto.createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      try {
        return crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSignature)
        );
      } catch {
        return false;
      }
  }
}
