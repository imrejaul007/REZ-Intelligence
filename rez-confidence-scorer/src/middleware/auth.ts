import { Request, Response, NextFunction } from 'express';
import { internalServiceTokens } from '../config';
import logger from '../utils/logger';

/**
 * Extend Express Request to include service info
 */
declare global {
  namespace Express {
    interface Request {
      serviceName?: string;
      isInternalRequest?: boolean;
    }
  }
}

/**
 * Internal service authentication middleware
 *
 * Validates X-Internal-Token header against configured service tokens.
 */
export function internalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string | undefined;

  // If no token provided, allow request to continue (may be validated elsewhere)
  if (!token) {
    // Check if JWT is provided instead (for user requests)
    const jwtToken = req.headers.authorization?.replace('Bearer ', '');
    if (jwtToken) {
      // JWT authentication would be handled by a separate middleware
      next();
      return;
    }

    // No authentication provided
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        details: 'Provide X-Internal-Token header for service-to-service calls',
      },
      timestamp: new Date(),
    });
    return;
  }

  // Find service by token
  const serviceName = Object.entries(internalServiceTokens).find(
    ([, t]) => t === token
  )?.[0];

  if (!serviceName) {
    logger.warn('Invalid internal token attempt', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });

    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token',
      },
      timestamp: new Date(),
    });
    return;
  }

  // Attach service info to request
  req.serviceName = serviceName;
  req.isInternalRequest = true;

  logger.debug('Internal service authenticated', {
    service: serviceName,
    path: req.path,
  });

  next();
}

/**
 * Optional internal auth - sets service info if token provided, but doesn't block
 */
export function optionalInternalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string | undefined;

  if (token) {
    const serviceName = Object.entries(internalServiceTokens).find(
      ([, t]) => t === token
    )?.[0];

    if (serviceName) {
      req.serviceName = serviceName;
      req.isInternalRequest = true;
    }
  }

  next();
}
