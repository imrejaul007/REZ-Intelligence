import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import config from '../config/index.js';

interface AuthenticatedRequest extends Request {
  serviceId?: string;
}

// Simple internal service authentication
export function authenticateInternalService(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing X-Internal-Token header',
      },
    });
    return;
  }

  // In production, verify against INTERNAL_SERVICE_TOKENS_JSON
  // For now, use a simple check
  if (token === process.env.INTERNAL_SERVICE_TOKEN) {
    next();
  } else {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid internal service token',
      },
    });
  }
}

// API key authentication for external access
export function authenticateApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing X-API-Key header',
      },
    });
    return;
  }

  // In production, verify against stored API keys
  // For now, accept any non-empty key
  if (apiKey && apiKey.length >= 32) {
    next();
  } else {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid API key',
      },
    });
  }
}

// HMAC signature verification for webhooks
export function verifyWebhookSignature(
  secret: string,
  signatureHeader: string
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const signature = req.headers['x-signature'] as string;

    if (!signature) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing X-Signature header',
        },
      });
      return;
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      next();
    } else {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid webhook signature',
        },
      });
    }
  };
}

// Rate limiting using token bucket algorithm
export function rateLimit(
  maxRequests: number,
  windowMs: number
): (req: Request, res: Response, next: NextFunction) => void {
  const tokens = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || 'unknown';
    const now = Date.now();

    let tokenData = tokens.get(ip);

    if (!tokenData || now > tokenData.resetTime) {
      tokenData = {
        count: 1,
        resetTime: now + windowMs,
      };
      tokens.set(ip, tokenData);
      next();
      return;
    }

    if (tokenData.count >= maxRequests) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Too many requests. Max ${maxRequests} per ${windowMs / 1000} seconds.`,
          details: {
            retryAfter: Math.ceil((tokenData.resetTime - now) / 1000),
          },
        },
      });
      return;
    }

    tokenData.count++;
    next();
  };
}

// Request validation middleware
export function validateRequest<T>(
  schema: {
    parse: (data: unknown) => T;
  }
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed;
      next();
    } catch (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error,
        },
      });
    }
  };
}

// Error handling middleware
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.env === 'production' ? 'Internal server error' : err.message,
    },
  });
}

// Request logging middleware
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.path} ${res.statusCode} ${duration}ms`
    );
  });

  next();
}
