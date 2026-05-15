import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Rate limiting map (in-memory, use Redis for production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Internal service authentication middleware
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-internal-token'] as string;
  const serviceToken = process.env.INTERNAL_SERVICE_TOKEN;

  // Skip auth in development if no token is set
  if (!serviceToken) {
    next();
    return;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Missing X-Internal-Token header',
      timestamp: new Date()
    });
    return;
  }

  // Timing-safe comparison
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(serviceToken);

  if (tokenBuffer.length !== expectedBuffer.length) {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      timestamp: new Date()
    });
    return;
  }

  if (!crypto.timingSafeEqual(tokenBuffer, expectedBuffer)) {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      timestamp: new Date()
    });
    return;
  }

  next();
}

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(
  maxRequests: number = 100,
  windowMs: number = 60000
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `rate:${ip}`;
    const now = Date.now();

    const record = rateLimitMap.get(key);

    if (!record || now > record.resetTime) {
      rateLimitMap.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (maxRequests - 1).toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000).toString());
      next();
      return;
    }

    if (record.count >= maxRequests) {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        timestamp: new Date(),
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
      return;
    }

    record.count++;
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - record.count).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());
    next();
  };
}

/**
 * Error handling middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', err);

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    timestamp: new Date()
  });
}

/**
 * Request logging middleware
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`
    );
  });

  next();
}

/**
 * CORS middleware
 */
export function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];

  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Internal-Token');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

/**
 * Security headers middleware
 */
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}
