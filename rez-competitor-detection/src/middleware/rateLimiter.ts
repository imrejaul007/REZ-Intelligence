import { Request, Response, NextFunction } from 'express';

// Rate limiting configuration
const RATE_LIMIT_REQUESTS = parseInt(process.env.RATE_LIMIT_REQUESTS || '100', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);

// In-memory store for rate limiting
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Get client identifier from request
 */
function getClientId(req: Request): string {
  // Use service name if authenticated
  if (req.serviceName) {
    return `service:${req.serviceName}`;
  }

  // Fall back to IP address
  return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
}

/**
 * Rate limiting middleware
 */
export function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const clientId = getClientId(req);
  const now = Date.now();

  let entry = rateLimitStore.get(clientId);

  if (!entry || now > entry.resetTime) {
    // Create new entry
    entry = {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    };
    rateLimitStore.set(clientId, entry);
  } else {
    entry.count++;
  }

  // Set rate limit headers
  const remaining = Math.max(0, RATE_LIMIT_REQUESTS - entry.count);
  const resetTime = Math.ceil(entry.resetTime / 1000);

  res.set({
    'X-RateLimit-Limit': RATE_LIMIT_REQUESTS.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': resetTime.toString()
  });

  if (entry.count > RATE_LIMIT_REQUESTS) {
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      timestamp: new Date(),
      retryAfter: Math.ceil((entry.resetTime - now) / 1000)
    });
    return;
  }

  next();
}

/**
 * Create rate limiter with custom configuration
 */
export function createRateLimiter(
  requests: number = RATE_LIMIT_REQUESTS,
  windowMs: number = RATE_LIMIT_WINDOW_MS
) {
  const customStore = new Map<string, RateLimitEntry>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = getClientId(req);
    const now = Date.now();

    let entry = customStore.get(clientId);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + windowMs
      };
      customStore.set(clientId, entry);
    } else {
      entry.count++;
    }

    res.set({
      'X-RateLimit-Limit': requests.toString(),
      'X-RateLimit-Remaining': Math.max(0, requests - entry.count).toString(),
      'X-RateLimit-Reset': Math.ceil(entry.resetTime / 1000).toString()
    });

    if (entry.count > requests) {
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        timestamp: new Date(),
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      });
      return;
    }

    next();
  };
}
