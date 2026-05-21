import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  serviceId?: string;
  isInternalService?: boolean;
}

// Internal service token validation
export const validateInternalToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    logger.warn('Missing internal token', {
      path: req.path,
      ip: req.ip,
    });
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing internal service token',
      },
    });
    return;
  }

  // Validate token against configured tokens
  const validTokens = getValidTokens();

  // Check if token matches any valid token
  const isValid = validTokens.some((validToken) =>
    crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(validToken)
    )
  );

  if (!isValid) {
    logger.warn('Invalid internal token', {
      path: req.path,
      ip: req.ip,
    });
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid internal service token',
      },
    });
    return;
  }

  // Set service ID from token map if available
  req.isInternalService = true;
  next();
};

// Twilio webhook signature verification
export const verifyTwilioWebhook = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const signature = req.headers['x-twilio-signature'] as string;

  if (!signature) {
    logger.warn('Missing Twilio signature', {
      path: req.path,
    });
    // Allow through for now, but log
  }

  // In production, verify against Twilio's signature
  // const twilioSignature = req.headers['x-twilio-signature'];
  // const validator = new Twilio.validateRequest(authToken, twilioSignature, url, req.body);

  next();
};

// Merchant authentication (for merchant-facing endpoints)
export const validateMerchantAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
      },
    });
    return;
  }

  const token = authHeader.substring(7);

  // In production, validate JWT and extract merchant ID
  try {
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // req.merchantId = decoded.merchantId;

    // For development, accept any token
    req.serviceId = token;

    next();
  } catch (error) {
    logger.warn('Invalid merchant token', {
      path: req.path,
      error,
    });
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      },
    });
  }
};

// Optional authentication - sets user if valid token, continues otherwise
export const optionalAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  // Process token if present
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      // const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // req.userId = decoded.userId;
      req.serviceId = token;
    } catch (error) {
      // Ignore invalid tokens for optional auth
    }
  }

  next();
};

// Get valid tokens from environment
function getValidTokens(): string[] {
  const tokens: string[] = [];

  // Primary internal token
  if (process.env.INTERNAL_SERVICE_TOKEN) {
    tokens.push(process.env.INTERNAL_SERVICE_TOKEN);
  }

  // Additional tokens from JSON map
  if (process.env.INTERNAL_SERVICE_TOKENS_JSON) {
    try {
      const tokenMap = JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON);
      Object.values(tokenMap).forEach((token) => {
        if (typeof token === 'string' && token) {
          tokens.push(token);
        }
      });
    } catch (error) {
      logger.error('Failed to parse INTERNAL_SERVICE_TOKENS_JSON', { error });
    }
  }

  return tokens;
}

// Role-based access control
export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const userRole = req.headers['x-user-role'] as string;

    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
      return;
    }

    next();
  };
};

// Rate limiting for authenticated endpoints
export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const rateLimiter = (options: RateLimitOptions) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const key = req.serviceId || req.ip || 'unknown';
    const now = Date.now();

    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + options.windowMs,
      };
      rateLimitStore.set(key, record);
    }

    record.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - record.count));
    res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());

    if (record.count > options.max) {
      logger.warn('Rate limit exceeded', {
        key,
        count: record.count,
        limit: options.max,
      });

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
        },
      });
      return;
    }

    next();
  };
};

// Clean up rate limit store periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

export default {
  validateInternalToken,
  verifyTwilioWebhook,
  validateMerchantAuth,
  optionalAuth,
  requireRole,
  rateLimiter,
};
