import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    merchantId?: string;
    serviceId?: string;
  };
}

// JWT Authentication middleware
export const auth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No valid authorization token provided',
        },
      });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, config.internalServiceToken) as AuthRequest['user'];
      (req as AuthRequest).user = decoded;
      next();
    } catch (jwtError) {
      logger.warn('JWT verification failed', { error: jwtError });
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token',
        },
      });
    }
  } catch (error) {
    logger.error('Auth middleware error', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication service error',
      },
    });
  }
};

// Internal service token authentication
export const internalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const internalToken = req.headers['x-internal-token'] as string;

    if (!internalToken) {
      res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_INTERNAL_TOKEN',
          message: 'X-Internal-Token header is required',
        },
      });
      return;
    }

    if (internalToken !== config.internalServiceToken) {
      logger.warn('Invalid internal token attempted', {
        ip: req.ip,
        path: req.path,
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'INVALID_INTERNAL_TOKEN',
          message: 'Invalid service token',
        },
      });
      return;
    }

    // Add service identification to request
    (req as AuthRequest).user = {
      serviceId: 'internal-service',
    };

    next();
  } catch (error) {
    logger.error('Internal auth middleware error', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Internal authentication service error',
      },
    });
  }
};

// Optional authentication - continues even without token
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, config.internalServiceToken) as AuthRequest['user'];
        (req as AuthRequest).user = decoded;
      } catch {
        // Token invalid but we allow request to continue
        logger.debug('Optional auth: invalid token ignored');
      }
    }

    next();
  } catch (error) {
    // Continue without auth
    next();
  }
};

// Merchant context extraction
export const extractMerchantContext = (req: Request, res: Response, next: NextFunction): void => {
  const merchantId = req.headers['x-merchant-id'] as string;

  if (merchantId) {
    (req as AuthRequest).user = {
      ...(req as AuthRequest).user,
      merchantId,
    };
  }

  next();
};

export default {
  auth,
  internalAuth,
  optionalAuth,
  extractMerchantContext,
};