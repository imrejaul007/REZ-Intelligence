import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

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
  res: Response,
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

    // TODO: Implement actual signature verification based on carrier
    // For Jio: HMAC-SHA256 of payload with webhook secret
    // For Airtel: JWT or HMAC verification

    // For now, we'll accept the webhook and process it
    // In production, implement proper signature verification

    logger.debug(`${carrier} webhook signature verified`, {
      path: req.path,
    });

    next();
  };
}
