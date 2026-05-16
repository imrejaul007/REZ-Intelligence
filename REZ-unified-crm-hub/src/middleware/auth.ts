/**
 * Authentication Middleware
 *
 * Handles:
 * - Internal API: Service token validation
 * - Merchant API: JWT token validation
 */

import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      merchantId?: string;
      merchantName?: string;
      merchantPermissions?: string[];
      isInternal?: boolean;
    }
  }
}

// JWT payload for merchants
export interface MerchantJWTPayload {
  merchantId: string;
  merchantName: string;
  permissions: string[];
  storeIds: string[];
  iat: number;
  exp: number;
}

// Internal token validation
export function validateInternalToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    logger.warn('Missing internal token', { ip: req.ip, path: req.path });
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'X-Internal-Token header required',
    });
  }

  // In production, validate against a list of valid service tokens
  const validTokens = (process.env.INTERNAL_SERVICE_TOKENS_JSON || process.env.INTERNAL_SERVICE_TOKEN || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  if (validTokens.length === 0) {
    logger.error('No internal tokens configured');
    return res.status(500).json({
      success: false,
      error: 'Configuration Error',
      message: 'Internal service tokens not configured',
    });
  }

  if (!validTokens.includes(token)) {
    logger.warn('Invalid internal token', { ip: req.ip, path: req.path });
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid internal token',
    });
  }

  req.isInternal = true;
  next();
}

// Merchant JWT validation
export async function validateMerchantJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Missing or invalid authorization header', { ip: req.ip, path: req.path });
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Bearer token required',
    });
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.MERCHANT_JWT_SECRET;

  if (!jwtSecret) {
    logger.error('MERCHANT_JWT_SECRET not configured');
    return res.status(500).json({
      success: false,
      error: 'Configuration Error',
      message: 'JWT secret not configured',
    });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as MerchantJWTPayload;

    // Validate required fields
    if (!decoded.merchantId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid token: missing merchantId',
      });
    }

    // Attach merchant info to request
    req.merchantId = decoded.merchantId;
    req.merchantName = decoded.merchantName;
    req.merchantPermissions = decoded.permissions;

    // Log successful auth
    logger.debug('Merchant authenticated', {
      merchantId: decoded.merchantId,
      path: req.path,
    });

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Expired merchant token', { ip: req.ip });
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Token expired',
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid merchant token', { ip: req.ip, error: (error as Error).message });
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid token',
      });
    }

    logger.error('Token validation error', { error });
    return res.status(500).json({
      success: false,
      error: 'Server Error',
      message: 'Token validation failed',
    });
  }
}

// Permission check middleware
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const permissions = req.merchantPermissions || [];

    if (!permissions.includes(permission) && !permissions.includes('admin')) {
      logger.warn('Permission denied', {
        merchantId: req.merchantId,
        required: permission,
        permissions,
      });
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Permission '${permission}' required`,
      });
    }

    next();
  };
}

// Generate merchant JWT (for testing)
export function generateMerchantToken(merchant: {
  merchantId: string;
  merchantName: string;
  permissions?: string[];
  storeIds?: string[];
  expiresIn?: string;
}): string {
  const jwtSecret = process.env.MERCHANT_JWT_SECRET || 'dev-secret-change-in-production';

  const payload = {
    merchantId: merchant.merchantId,
    merchantName: merchant.merchantName,
    permissions: merchant.permissions || ['read:customers', 'write:customers', 'read:orders'],
    storeIds: merchant.storeIds || [],
  };

  return jwt.sign(payload, jwtSecret, {
    expiresIn: merchant.expiresIn || '7d',
  } as SignOptions);
}

// Generate internal token (for testing)
export function generateInternalToken(): string {
  const tokens = (process.env.INTERNAL_SERVICE_TOKENS_JSON || process.env.INTERNAL_SERVICE_TOKEN || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  return tokens[0] || 'dev-internal-token';
}
