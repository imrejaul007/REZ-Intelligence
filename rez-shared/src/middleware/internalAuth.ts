/**
 * Unified Internal Service Authentication Middleware
 *
 * OPS-003 FIX: Consolidates internal auth across all services.
 * Replaces 6+ different implementations with a single, audited implementation.
 *
 * Features:
 * - Timing-safe token comparison (prevents timing attacks)
 * - Scoped tokens support (per-service tokens)
 * - Legacy token fallback (DEPRECATED - for migration period only)
 * - IP allowlisting (optional)
 * - Constant-time comparison for all secrets
 *
 * MIGRATION: Replace INTERNAL_SERVICE_TOKEN with INTERNAL_SERVICE_TOKENS_JSON
 * Format: '[{"serviceId":"order-service","token":"secret1"},{"serviceId":"payment-service","token":"secret2"}]'
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

// Track if legacy token warning has been logged (avoid log spam)
let legacyWarningLogged = false;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InternalAuthOptions {
  /** JSON array of {serviceId, token} objects */
  scopedTokensJson?: string;
  /** Legacy single token (deprecated, use scopedTokensJson) */
  legacyToken?: string;
  /** Optional HMAC secret for HMAC-based validation */
  hmacSecret?: string;
  /** Optional IP allowlist */
  allowedIps?: string[];
  /** Service ID for this service (for logging) */
  serviceId?: string;
}

export interface ServiceToken {
  serviceId: string;
  token: string;
}

export interface AuthenticatedRequest extends Request {
  serviceId?: string;
  isInternal?: boolean;
}

// ─── Token Parsing ────────────────────────────────────────────────────────────

/**
 * Parse scoped tokens from JSON environment variable.
 */
export function parseScopedTokens(json: string): ServiceToken[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (t): t is ServiceToken =>
          typeof t === 'object' &&
          t !== null &&
          typeof t.serviceId === 'string' &&
          typeof t.token === 'string',
      );
    }
    return [];
  } catch {
    logger.error('[InternalAuth] Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
    return [];
  }
}

/**
 * Find service token by serviceId.
 */
export function findServiceToken(
  tokens: ServiceToken[],
  serviceId: string,
): string | null {
  const entry = tokens.find((t) => t.serviceId === serviceId);
  return entry?.token ?? null;
}

// ─── Timing-Safe Comparison ───────────────────────────────────────────────────

/**
 * Compare two strings in constant time to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to maintain constant time
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ─── XFF Spoofing Detection ────────────────────────────────────────────────────

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^0\.0\.0\.0$/,
];

function isPrivateIp(ip: string): boolean {
  const normalized = ip.replace(/^::ffff:/, '');
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(normalized));
}

// ─── Core Auth Function ───────────────────────────────────────────────────────

/**
 * Verify internal service token.
 *
 * Checks in order:
 * 1. Scoped tokens (preferred)
 * 2. Legacy single token (deprecated)
 * 3. HMAC-based validation (if hmacSecret provided)
 */
export function verifyInternalToken(
  token: string | undefined,
  options: InternalAuthOptions,
): { valid: boolean; serviceId?: string } {
  if (!token) {
    return { valid: false };
  }

  const { scopedTokensJson, legacyToken, hmacSecret } = options;

  // 1. Check scoped tokens first (preferred)
  if (scopedTokensJson) {
    const scopedTokens = parseScopedTokens(scopedTokensJson);
    for (const { serviceId, token: serviceToken } of scopedTokens) {
      if (timingSafeEqual(token, serviceToken)) {
        return { valid: true, serviceId };
      }
    }
  }

  // 2. Check legacy token (deprecated)
  if (legacyToken && timingSafeEqual(token, legacyToken)) {
    if (!legacyWarningLogged) {
      logger.warn('[InternalAuth] DEPRECATED: Legacy INTERNAL_SERVICE_TOKEN used. ' +
        'Migrate to INTERNAL_SERVICE_TOKENS_JSON format: ' +
        '[{"serviceId":"order-service","token":"secret1"},{"serviceId":"payment-service","token":"secret2"}]');
      legacyWarningLogged = true;
    }
    return { valid: true, serviceId: 'legacy' };
  }

  // 3. Check HMAC-based validation (if secret provided)
  if (hmacSecret) {
    // Token format: timestamp.signature
    const parts = token.split('.');
    if (parts.length === 2) {
      const [timestampStr, providedSignature] = parts;
      const timestamp = parseInt(timestampStr, 10);

      // Reject if timestamp is too old (5 minute window)
      const now = Date.now();
      if (!isNaN(timestamp) && Math.abs(now - timestamp) < 5 * 60 * 1000) {
        const expectedSignature = crypto
          .createHmac('sha256', hmacSecret)
          .update(`${timestamp}`)
          .digest('hex');

        if (timingSafeEqual(providedSignature, expectedSignature)) {
          return { valid: true, serviceId: 'hmac-validated' };
        }
      }
    }
  }

  return { valid: false };
}

// ─── Express Middleware Factory ───────────────────────────────────────────────

/**
 * Create internal auth middleware for Express.
 *
 * @example
 * ```typescript
 * const authMiddleware = createInternalAuthMiddleware({
 *   scopedTokensJson: process.env.INTERNAL_SERVICE_TOKENS_JSON,
 *   legacyToken: process.env.INTERNAL_SERVICE_TOKEN,
 *   allowedIps: ['10.0.0.0/8'],
 *   serviceId: 'wallet-service',
 * });
 *
 * app.use('/internal', authMiddleware);
 * ```
 */
export function createInternalAuthMiddleware(options: InternalAuthOptions) {
  const { allowedIps, serviceId } = options;

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const token = req.headers['x-internal-token'] as string | undefined;

    // Check IP allowlist first (if configured)
    if (allowedIps && allowedIps.length > 0) {
      const clientIp = getClientIp(req);
      if (!isIpAllowed(clientIp, allowedIps)) {
        logger.warn('[InternalAuth] IP not in allowlist', {
          clientIp,
          allowedIps,
          path: req.path,
        });
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }
    }

    // Check XFF spoofing
    const forwarded = req.headers['x-forwarded-for'] as string | undefined;
    if (forwarded) {
      const outermost = forwarded.split(',')[0].trim();
      if (isPrivateIp(outermost)) {
        logger.warn('[InternalAuth] XFF spoofing detected', {
          outermostIp: outermost,
          path: req.path,
        });
        return res.status(400).json({
          success: false,
          message: 'Invalid request',
        });
      }
    }

    // Verify token
    const result = verifyInternalToken(token, options);

    if (!result.valid) {
      logger.warn('[InternalAuth] Invalid token', {
        path: req.path,
        serviceId,
        ip: getClientIp(req),
      });
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // Attach service info to request
    req.serviceId = result.serviceId;
    req.isInternal = true;

    logger.debug('[InternalAuth] Request authenticated', {
      serviceId: result.serviceId,
      path: req.path,
    });

    next();
  };
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string | undefined;
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function isIpAllowed(ip: string, allowedIps: string[]): boolean {
  const normalized = ip.replace(/^::ffff:/, '');

  // Check exact match first
  if (allowedIps.includes(normalized)) {
    return true;
  }

  // Check CIDR notation
  for (const allowed of allowedIps) {
    if (allowed.includes('/')) {
      if (ipInCidr(normalized, allowed)) {
        return true;
      }
    }
  }

  return false;
}

function ipInCidr(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);

  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);

  return (ipNum & mask) === (rangeNum & mask);
}

function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

// ─── JWT Validation Helper ────────────────────────────────────────────────────

export interface JwtPayload {
  sub?: string;
  userId?: string;
  merchantId?: string;
  role?: string;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

/**
 * Verify JWT token (for external-facing endpoints).
 * Uses RS256 or HS256 based on configuration.
 */
export async function verifyJwt(
  token: string,
  options: {
    secret?: string;
    publicKey?: string;
    algorithm?: 'RS256' | 'HS256';
  },
): Promise<JwtPayload | null> {
  const { secret, publicKey, algorithm = 'HS256' } = options;

  // Lazy import to avoid bundling issues
  const jwt = await import('jsonwebtoken');

  try {
    const verifyOptions = {
      algorithms: [algorithm] as ('RS256' | 'HS256')[],
    };

    const payload = jwt.verify(token, secret || publicKey || '', verifyOptions);
    return payload as JwtPayload;
  } catch (error) {
    logger.debug('[InternalAuth] JWT verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

// ─── Convenience Exports ──────────────────────────────────────────────────────

/**
 * Standard internal auth options from environment.
 */
export function createAuthOptionsFromEnv(): InternalAuthOptions {
  return {
    scopedTokensJson: process.env.INTERNAL_SERVICE_TOKENS_JSON,
    legacyToken: process.env.INTERNAL_SERVICE_TOKEN,
    hmacSecret: process.env.INTERNAL_SERVICE_HMAC_SECRET,
    serviceId: process.env.SERVICE_NAME,
  };
}

/**
 * Pre-configured middleware for common use cases.
 */
export const internalAuthMiddleware = createInternalAuthMiddleware(
  createAuthOptionsFromEnv(),
);
