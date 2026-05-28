/**
 * REZ Intelligence Shared Module
 * Exports utilities for all services
 */

import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

// Re-export from circuitBreaker
export * from './circuitBreaker.js';

// Re-export from utils
export * from './utils.js';

// ============================================
// LOGGER SETUP
// ============================================

const { combine, timestamp, json, errors, printf } = winston.format;

const serviceName = process.env.SERVICE_NAME || 'rez-intelligence';

const logFormat = printf(({ level, message, timestamp: ts, service, requestId, ...meta }) => {
  return JSON.stringify({
    timestamp: ts,
    level,
    service,
    requestId,
    message,
    ...meta
  });
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: serviceName },
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    process.env.NODE_ENV === 'production' ? json() : logFormat
  ),
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    })
  ]
});

// ============================================
// REQUEST LOGGING
// ============================================

export interface RequestLogger {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
}

export function createRequestLogger(requestId: string): RequestLogger {
  return {
    info: (message, meta = {}) => logger.info(message, { requestId, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { requestId, ...meta }),
    error: (message, meta = {}) => logger.error(message, { requestId, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { requestId, ...meta })
  };
}

// ============================================
// SANITIZATION
// ============================================

export function sanitize(obj: unknown, depth = 0): unknown {
  if (depth > 10) return '[MaxDepth]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitize(item, depth + 1));
  }
  const sensitive = ['password', 'token', 'secret', 'key', 'authorization', 'cookie'];
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (sensitive.some(s => k.toLowerCase().includes(s))) {
      sanitized[k] = '[REDACTED]';
    } else {
      sanitized[k] = sanitize(v, depth + 1);
    }
  }
  return sanitized;
}

// ============================================
// CONVENIENCE LOGGING FUNCTIONS
// ============================================

export const error = (message: string, meta?: Record<string, unknown>): void => {
  logger.error(message, sanitize(meta));
};

export const warn = (message: string, meta?: Record<string, unknown>): void => {
  logger.warn(message, sanitize(meta));
};

export const info = (message: string, meta?: Record<string, unknown>): void => {
  logger.info(message, sanitize(meta));
};

export const debug = (message: string, meta?: Record<string, unknown>): void => {
  logger.debug(message, sanitize(meta));
};

// ============================================
// ASYNC HANDLER
// ============================================

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export function asyncHandler(
  fn: AsyncRequestHandler
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ============================================
// REQUEST ID MIDDLEWARE
// ============================================

export interface RequestIdOptions {
  header?: string;
  generator?: () => string;
}

export function requestIdMiddleware(options: RequestIdOptions = {}): (
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  const { header = 'x-request-id', generator } = options;
  const { v4: uuidv4 } = require('uuid');

  return (req: Request, res: Response, next: NextFunction): void => {
    let requestId = req.headers[header] as string | undefined;

    if (!requestId) {
      requestId = generator ? generator() : uuidv4();
    }

    req.headers[header] = requestId;
    res.setHeader(header, requestId);

    next();
  };
}

// ============================================
// ERROR HANDLER
// ============================================

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(`[${req.method}] ${req.path}:`, err);

  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
}
