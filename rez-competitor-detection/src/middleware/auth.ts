import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      serviceName?: string;
      isInternalCall?: boolean;
    }
  }
}

// Service tokens from environment
const SERVICE_TOKENS = new Map<string, string>();

/**
 * Initialize service tokens from environment
 */
export function initializeServiceTokens(): void {
  const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON;
  if (tokensJson) {
    try {
      const tokens = JSON.parse(tokensJson);
      Object.entries(tokens).forEach(([service, token]) => {
        SERVICE_TOKENS.set(service, token as string);
      });
      console.log(`Loaded ${SERVICE_TOKENS.size} service tokens`);
    } catch (error) {
      console.error('Failed to parse INTERNAL_SERVICE_TOKENS_JSON:', error);
    }
  }
}

/**
 * Validate internal service token
 */
function validateToken(token: string): { valid: boolean; serviceName?: string } {
  // Check against main service token
  const mainToken = process.env.INTERNAL_SERVICE_TOKEN;
  if (mainToken && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(mainToken))) {
    return { valid: true, serviceName: 'internal' };
  }

  // Check against individual service tokens
  for (const [serviceName, serviceToken] of SERVICE_TOKENS.entries()) {
    try {
      if (token.length === serviceToken.length &&
          crypto.timingSafeEqual(Buffer.from(token), Buffer.from(serviceToken))) {
        return { valid: true, serviceName };
      }
    } catch {
      // Length mismatch, continue checking
    }
  }

  return { valid: false };
}

/**
 * Authentication middleware for internal service calls
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Missing X-Internal-Token header',
      timestamp: new Date()
    });
    return;
  }

  const validation = validateToken(token);
  if (!validation.valid) {
    res.status(401).json({
      success: false,
      error: 'Invalid internal token',
      timestamp: new Date()
    });
    return;
  }

  req.serviceName = validation.serviceName;
  req.isInternalCall = true;
  next();
}

/**
 * Optional auth - doesn't fail if no token provided
 */
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string;

  if (token) {
    const validation = validateToken(token);
    if (validation.valid) {
      req.serviceName = validation.serviceName;
      req.isInternalCall = true;
    }
  }

  next();
}
