import { Request, Response, NextFunction } from 'express';
import { rateLimitService } from '../services/rateLimitService';

export interface RateLimitMiddlewareOptions {
  /**
   * Enable/disable per-user rate limiting
   * @default true
   */
  enableUserLimit?: boolean;

  /**
   * Enable/disable per-IP rate limiting
   * @default true
   */
  enableIpLimit?: boolean;

  /**
   * Enable/disable per-endpoint rate limiting
   * @default true
   */
  enableEndpointLimit?: boolean;

  /**
   * Custom function to extract user ID from request
   * If not provided, checks Authorization header or x-user-id header
   */
  getUserId?: (req: Request) => string | undefined;

  /**
   * Custom function to extract IP from request
   * If not provided, uses x-forwarded-for or socket.remoteAddress
   */
  getIp?: (req: Request) => string;

  /**
   * Headers to add to response
   * @default true
   */
  addHeaders?: boolean;

  /**
   * Custom endpoint whitelist (paths that skip rate limiting)
   */
  whitelist?: string[];

  /**
   * Custom endpoint blacklist (paths that are blocked)
   */
  blacklist?: string[];
}

/**
 * Extract client IP from request
 */
function extractIp(req: Request): string {
  // Check for proxy headers
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(',')[0].trim();
  }

  // Check for other common headers
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Fall back to socket address
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Extract user ID from request
 */
function extractUserId(req: Request): string | undefined {
  // Check Authorization header for Bearer token (simplified check)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    // In a real app, you'd decode the JWT here
    // For now, we'll use a hash of the token as user ID
    const token = authHeader.substring(7);
    return `user:${Buffer.from(token).toString('base64').substring(0, 16)}`;
  }

  // Check for x-user-id header (set by auth middleware)
  const userIdHeader = req.headers['x-user-id'];
  if (userIdHeader) {
    return Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;
  }

  // Check for user object attached by auth middleware
  if ((req as any).user?.id) {
    return (req as any).user.id;
  }

  return undefined;
}

/**
 * Create rate limiting middleware
 */
export function createRateLimitMiddleware(options: RateLimitMiddlewareOptions = {}) {
  const {
    enableUserLimit = true,
    enableIpLimit = true,
    enableEndpointLimit = true,
    getUserId = extractUserId,
    getIp = extractIp,
    addHeaders = true,
    whitelist = [],
    blacklist = [],
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const path = req.path;
    const method = req.method;
    const fullPath = `${method}:${path}`;

    // Check blacklist
    if (blacklist.some(pattern => {
      if (pattern.endsWith('*')) {
        return fullPath.startsWith(pattern.slice(0, -1));
      }
      return fullPath === pattern || path === pattern;
    })) {
      res.status(403).json({
        success: false,
        error: 'Endpoint is rate limited',
        code: 'ENDPOINT_BLACKLISTED',
      });
      return;
    }

    // Check whitelist
    if (whitelist.some(pattern => {
      if (pattern.endsWith('*')) {
        return fullPath.startsWith(pattern.slice(0, -1));
      }
      return fullPath === pattern || path === pattern;
    })) {
      next();
      return;
    }

    try {
      const ip = getIp(req);
      const userId = getUserId(req);

      // Perform all rate limit checks
      const results = await rateLimitService.checkAllLimits(userId, ip, path);

      // Set response headers if enabled
      if (addHeaders) {
        // Endpoint headers (primary limit)
        res.setHeader('X-RateLimit-Limit', results.endpoint.limit.toString());
        res.setHeader('X-RateLimit-Remaining', results.endpoint.remaining.toString());
        res.setHeader('X-RateLimit-Reset', Math.ceil(results.endpoint.resetAt / 1000).toString());

        // IP headers
        if (results.ip) {
          res.setHeader('X-RateLimit-IP-Limit', results.ip.limit.toString());
          res.setHeader('X-RateLimit-IP-Remaining', results.ip.remaining.toString());
        }

        // User headers
        if (results.user) {
          res.setHeader('X-RateLimit-User-Limit', results.user.limit.toString());
          res.setHeader('X-RateLimit-User-Remaining', results.user.remaining.toString());
        }
      }

      if (!results.allowed) {
        const blockedBy = results.blockedBy || 'endpoint';
        const limitResult = results[blockedBy];

        if (addHeaders && limitResult?.retryAfterMs) {
          res.setHeader('Retry-After', Math.ceil(limitResult.retryAfterMs / 1000).toString());
        }

        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          blockedBy,
          limit: limitResult?.limit,
          remaining: 0,
          retryAfterMs: limitResult?.retryAfterMs,
          resetAt: limitResult?.resetAt,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Rate limit middleware error:', error);

      // On error, allow the request (fail open) but log the error
      // You can change this to fail closed by uncommenting the lines below:
      // res.status(503).json({
      //   success: false,
      //   error: 'Rate limiting service unavailable',
      //   code: 'SERVICE_UNAVAILABLE',
      // });

      next();
    }
  };
}

/**
 * Pre-configured middleware for different scenarios
 */
export const strictRateLimit = createRateLimitMiddleware({
  enableUserLimit: true,
  enableIpLimit: true,
  enableEndpointLimit: true,
});

export const ipOnlyRateLimit = createRateLimitMiddleware({
  enableUserLimit: false,
  enableIpLimit: true,
  enableEndpointLimit: false,
});

export const userOnlyRateLimit = createRateLimitMiddleware({
  enableUserLimit: true,
  enableIpLimit: false,
  enableEndpointLimit: false,
});

/**
 * Health check endpoint that bypasses rate limiting
 */
export const healthCheckMiddleware = createRateLimitMiddleware({
  whitelist: ['GET:/health', 'GET:/api/health'],
});

export default createRateLimitMiddleware;
