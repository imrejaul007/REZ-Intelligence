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

// Mask PII data
export function maskPII(data: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...data };
  const piiFields = ['email', 'phone', 'name', 'address'];
  for (const field of piiFields) {
    if (masked[field] && typeof masked[field] === 'string') {
      const val = masked[field] as string;
      masked[field] = val.substring(0, 2) + '***';
    }
  }
  return masked;
}

// Validate webhook payload
export function validateWebhookPayload(_payload: unknown): boolean {
  // Add webhook validation logic here
  return true;
}
