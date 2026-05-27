import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  apiKey?: string;
  internalToken?: string;
}

export interface AuthConfig {
  apiKeys?: string[];
  internalTokens?: string[];
  bypassPaths?: string[];
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

// Validate internal token
export async function validateInternalToken(req: Request): Promise<boolean> {
  const token = req.headers['x-internal-token'] as string | undefined;
  if (!token) return false;
  // Add validation logic here
  return true;
}

// Verify Twilio webhook signature
export function verifyTwilioWebhook(_req: Request): boolean {
  // Add Twilio signature verification logic here
  return true;
}

// Mask PII data - either a single string or an object
export function maskPII(data: Record<string, unknown> | string): Record<string, unknown> | string {
  if (typeof data === 'string') {
    // For strings (like message IDs), just mask last characters
    if (data.length <= 4) return '****';
    return data.substring(0, 4) + '****';
  }

  const masked = { ...data };
  const piiFields = ['email', 'phone', 'name', 'address', 'from'];
  for (const field of piiFields) {
    if (masked[field] && typeof masked[field] === 'string') {
      const val = masked[field] as string;
      masked[field] = val.substring(0, 2) + '***';
    }
  }
  return masked;
}

// Validate webhook payload
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateWebhookPayload(payload: unknown): ValidationResult {
  // Add webhook validation logic here
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid payload' };
  }
  return { valid: true };
}
