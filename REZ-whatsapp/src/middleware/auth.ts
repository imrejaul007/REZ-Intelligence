import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import twilio from 'twilio';
import Redis from 'ioredis';
import { z } from 'zod';
import { logger } from '../utils/logger';

// ==================== TYPES ====================

export interface AuthenticatedRequest extends Request {
  serviceId?: string;
  isInternalService?: boolean;
}

// ==================== VALIDATION SCHEMAS ====================

export const WebhookEventSchema = z.object({
  entry: z.array(z.object({
    id: z.string(),
    changes: z.array(z.object({
      value: z.object({
        messaging_product: z.string(),
        metadata: z.object({
          display_phone_number: z.string(),
          phone_number_id: z.string(),
        }),
        contacts: z.array(z.object({
          profile: z.object({ name: z.string() }),
          wa_id: z.string(),
        })).optional(),
        messages: z.array(z.object({
          from: z.string().regex(/^\+?[1-9]\d{6,14}$/),
          id: z.string(),
          timestamp: z.string(),
          type: z.enum(['text', 'image', 'audio', 'video', 'document', 'location', 'sticker', 'contacts', 'interactive']),
          text: z.object({ body: z.string() }).optional(),
          image: z.object({ id: z.string(), mime_type: z.string(), sha256: z.string() }).optional(),
          audio: z.object({ id: z.string(), mime_type: z.string(), sha256: z.string() }).optional(),
          video: z.object({ id: z.string(), mime_type: z.string(), sha256: z.string() }).optional(),
          document: z.object({ id: z.string(), filename: z.string(), mime_type: z.string(), sha256: z.string() }).optional(),
          location: z.object({ latitude: z.number(), longitude: z.number(), name: z.string().optional() }).optional(),
          interactive: z.unknown().optional(),
        })).optional(),
        statuses: z.array(z.object({
          id: z.string(),
          recipient_id: z.string(),
          status: z.enum(['sent', 'delivered', 'read', 'failed', 'undelivered']),
          timestamp: z.string(),
          errors: z.array(z.object({
            code: z.number(),
            title: z.string(),
          })).optional(),
        })).optional(),
      }),
      field: z.string(),
    })),
  })),
});

export const PhoneSchema = z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number');
export const EmailSchema = z.string().email('Invalid email');

// ==================== REDIS CLIENT ====================

let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return redisClient;
}

// ==================== INTERNAL TOKEN VALIDATION ====================

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

  const validTokens = getValidTokens();
  const isValid = validTokens.some((validToken) => {
    try {
      return timingSafeEqual(token, validToken);
    } catch {
      return false;
    }
  });

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

  req.isInternalService = true;
  next();
};

// ==================== TIMING SAFE COMPARISON ====================

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ==================== TWILIO WEBHOOK VERIFICATION ====================

export const verifyTwilioWebhook = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const signature = req.headers['x-twilio-signature'] as string;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const webhookUrl = process.env.WEBHOOK_URL || getWebhookUrl(req);
  const isProduction = process.env.NODE_ENV === 'production';

  // Check for missing signature
  if (!signature) {
    if (isProduction) {
      logger.warn('Missing Twilio signature in production', {
        path: req.path,
        ip: req.ip,
      });
      res.status(403).json({
        success: false,
        error: {
          code: 'MISSING_SIGNATURE',
          message: 'Missing Twilio webhook signature',
        },
      });
      return;
    }
    logger.warn('Missing Twilio signature (development mode)', {
      path: req.path,
    });
    next();
    return;
  }

  // Check for missing auth token
  if (!authToken) {
    logger.error('TWILIO_AUTH_TOKEN not configured');
    res.status(500).json({
      success: false,
      error: {
        code: 'CONFIGURATION_ERROR',
        message: 'Server misconfiguration: missing auth token',
      },
    });
    return;
  }

  // Validate signature
  try {
    const isValid = twilio.validateRequest(authToken, signature, webhookUrl, req.body);

    if (!isValid) {
      logger.warn('Invalid Twilio signature', {
        path: req.path,
        ip: req.ip,
      });

      if (isProduction) {
        res.status(403).json({
          success: false,
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Invalid webhook signature',
          },
        });
        return;
      }
      logger.warn('Invalid signature accepted in development mode');
    }

    logger.debug('Twilio webhook signature verified', {
      path: req.path,
      valid: isValid,
    });

    next();
  } catch (error) {
    logger.error('Error validating Twilio webhook', { error });

    if (isProduction) {
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Error validating webhook',
        },
      });
      return;
    }
    next();
  }
};

function getWebhookUrl(req: Request): string {
  const protocol = req.protocol;
  const host = req.get('host') || 'localhost:4202';
  return `${protocol}://${host}${req.path}`;
}

export function verifyTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, unknown>
): boolean {
  return twilio.validateRequest(authToken, signature, url, params);
}

export function generateHmacSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// ==================== MERCHANT AUTH ====================

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

  try {
    // In production, validate JWT and extract merchant ID
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // req.merchantId = decoded.merchantId;
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

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      // const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // req.userId = decoded.userId;
      req.serviceId = token;
    } catch {
      // Ignore invalid tokens for optional auth
    }
  }

  next();
};

function getValidTokens(): string[] {
  const tokens: string[] = [];

  if (process.env.INTERNAL_SERVICE_TOKEN) {
    tokens.push(process.env.INTERNAL_SERVICE_TOKEN);
  }

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

// ==================== REDIS-BASED RATE LIMITING ====================

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
}

export const rateLimiter = (options: RateLimitOptions) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const key = `ratelimit:${options.keyPrefix}:${req.serviceId || req.ip || 'unknown'}`;
    const redis = getRedis();

    try {
      const now = Date.now();
      const windowStart = now - options.windowMs;

      const multi = redis.multi();
      multi.zremrangebyscore(key, 0, windowStart);
      multi.zcard(key);
      multi.zadd(key, now.toString(), `${now}-${Math.random()}`);
      multi.expire(key, Math.ceil(options.windowMs / 1000));
      multi.zcard(key);

      const results = await multi.exec();
      const currentCount = (results![1][1] as number) || 0;
      const newCount = (results![4][1] as number) || 0;

      res.setHeader('X-RateLimit-Limit', options.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - currentCount - 1));
      res.setHeader('X-RateLimit-Reset', new Date(now + options.windowMs).toISOString());

      if (currentCount >= options.max) {
        logger.warn('Rate limit exceeded', {
          key,
          count: currentCount,
          limit: options.max,
          ip: req.ip,
        });

        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
            retryAfter: Math.ceil(options.windowMs / 1000),
          },
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Rate limiter error', { error });
      // Fail open - allow request if Redis is down
      next();
    }
  };
};

// ==================== INPUT VALIDATION ====================

export function validateWebhookPayload(data: unknown): { valid: boolean; error?: string } {
  try {
    WebhookEventSchema.parse(data);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors.map(e => e.message).join(', ') };
    }
    return { valid: false, error: 'Invalid payload' };
  }
}

// ==================== MASK PII ====================

export function maskPII(value: string): string {
  if (!value) return value;
  if (value.includes('@')) {
    return value.replace(/(.{2}).*(@.*)/, '$1***$2');
  }
  if (/^\+?[0-9]{10,}$/.test(value.replace(/\s/g, ''))) {
    return value.replace(/(.{3}).*(.{4})$/, '$1****$2');
  }
  return value;
}

export default {
  validateInternalToken,
  verifyTwilioWebhook,
  validateMerchantAuth,
  optionalAuth,
  requireRole,
  rateLimiter,
  validateWebhookPayload,
  maskPII,
};
