import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger, { addRequestContext, clearRequestContext } from '../utils/logger';

/**
 * Request logging middleware
 *
 * Adds request ID and logs request/response details
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate unique request ID
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Add context for logging
  addRequestContext({
    requestId,
    method: req.method,
    path: req.path,
  });

  const startTime = Date.now();

  // Log request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    service: req.serviceName,
  });

  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    const logData = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      service: req.serviceName,
    };

    if (res.statusCode >= 500) {
      logger.error('Request failed', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request error', logData);
    } else {
      logger.info('Request completed', logData);
    }

    clearRequestContext();
  });

  // Capture response close (client disconnected)
  res.on('close', () => {
    if (!res.writableFinished) {
      logger.warn('Request closed before response sent', {
        requestId,
        method: req.method,
        path: req.path,
      });
    }
  });

  next();
}

/**
 * Performance monitoring middleware
 *
 * Tracks slow requests and reports them
 */
export function performanceMonitor(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    // Log if request is slow (> 1 second)
    if (durationMs > 1000) {
      logger.warn('Slow request detected', {
        requestId: req.headers['x-request-id'],
        method: req.method,
        path: req.path,
        durationMs: Math.round(durationMs),
        threshold: '1000ms',
      });
    }

    // Log if request is very slow (> 5 seconds)
    if (durationMs > 5000) {
      logger.error('Critical slow request', {
        requestId: req.headers['x-request-id'],
        method: req.method,
        path: req.path,
        durationMs: Math.round(durationMs),
        threshold: '5000ms',
      });
    }
  });

  next();
}

/**
 * CORS middleware configuration
 */
export function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // CORS headers are typically set by a library, but this provides custom handling
  const origin = req.headers.origin;

  // Log CORS requests for monitoring
  if (origin) {
    logger.debug('CORS request', {
      origin,
      path: req.path,
    });
  }

  next();
}
