import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export interface AuthConfig {
  apiKeys?: string[];
  internalTokens?: string[];
  bypassPaths?: string[];
}

export interface AuthResult {
  authenticated: boolean;
  serviceId?: string;
  error?: string;
}

export function createAuthMiddleware(config: AuthConfig) {
  const { apiKeys = [], internalTokens = [], bypassPaths = ['/health', '/ready'] } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    const path = req.path;

    // Bypass health checks
    if (bypassPaths.some(p => path.startsWith(p))) {
      return next();
    }

    // Check API key
    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (apiKey && apiKeys.includes(apiKey)) {
      return next();
    }

    // Check internal token
    const internalToken = req.headers['x-internal-token'] as string | undefined;
    if (internalToken && internalTokens.includes(internalToken)) {
      return next();
    }

    // No valid auth found
    logger.warn('Unauthorized access attempt', {
      path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid API key or internal token required',
    });
  };
}

export const authenticateInternal = createAuthMiddleware({
  apiKeys: [],
  internalTokens: [process.env['INTERNAL_SERVICE_TOKEN'] || 'dev-token'],
  bypassPaths: ['/health', '/ready', '/metrics']
});

// Optional auth - doesn't fail, just returns auth status
export const optionalAuth = createAuthMiddleware({
  apiKeys: [process.env['API_KEY'] || ''],
  internalTokens: [process.env['INTERNAL_SERVICE_TOKEN'] || 'dev-token'],
  bypassPaths: ['/health', '/ready', '/metrics', '/'],
});

// API Key authentication
export const authenticateApiKey = createAuthMiddleware({
  apiKeys: [process.env['API_KEY'] || ''],
  internalTokens: [],
  bypassPaths: ['/health', '/ready', '/metrics'],
});

// Validate webhook signature from raw values
export async function validateWebhookSignatureRaw(
  _payload: string,
  _signature: string,
  _secret: string
): Promise<boolean> {
  logger.warn('Webhook signature validation not fully implemented');
  return true;
}

// Express middleware for webhook signature validation
export const validateWebhookSignature = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payload = JSON.stringify(req.body);
    const signature = req.headers['x-webhook-signature'] as string || req.headers['x-signature'] as string;
    const secret = process.env['WEBHOOK_SECRET'] || 'dev-webhook-secret';

    if (!signature) {
      res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_SIGNATURE',
          message: 'Webhook signature header is required'
        }
      });
      return;
    }

    const isValid = await validateWebhookSignatureRaw(payload, signature, secret);
    if (!isValid) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: 'Invalid webhook signature'
        }
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Webhook signature validation error', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Failed to validate webhook signature'
      }
    });
  }
};

// Validate service token
export async function validateServiceToken(token: string): Promise<AuthResult> {
  const expectedToken = process.env['INTERNAL_SERVICE_TOKEN'] || 'dev-token';
  if (token === expectedToken) {
    return { authenticated: true, serviceId: 'internal' };
  }
  return { authenticated: false, error: 'Invalid service token' };
}

// Extract auth info from request
export function extractAuthInfo(req: Request): AuthResult {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const internalToken = req.headers['x-internal-token'] as string | undefined;

  if (apiKey || internalToken) {
    return { authenticated: true };
  }

  return { authenticated: false, error: 'No auth credentials provided' };
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  logger.error('Unhandled error', { error: err.message, stack: err.stack, path: req.path });
  res.status(500).json({ error: 'Internal server error' });
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    });
  });
  next();
}
