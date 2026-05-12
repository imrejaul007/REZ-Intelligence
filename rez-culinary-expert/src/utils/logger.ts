/**
 * Logger Utility
 * Centralized logging for the culinary expert agent
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  if (stack) {
    msg += `\n${stack}`;
  }

  return msg;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  exitOnError: false,
});

// Add request logging helper
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  metadata?: Record<string, unknown>
): void {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

  logger.log({
    level,
    message: `${method} ${path} ${statusCode} - ${duration}ms`,
    ...metadata,
  });
}

// Add audit logging helper
export function logAudit(
  action: string,
  userId: string,
  details: Record<string, unknown>
): void {
  logger.info(`AUDIT: ${action}`, {
    action,
    userId,
    ...details,
    timestamp: new Date().toISOString(),
  });
}

// Add performance logging helper
export function logPerformance(
  operation: string,
  duration: number,
  metadata?: Record<string, unknown>
): void {
  const level = duration > 1000 ? 'warn' : 'info';

  logger.log({
    level,
    message: `PERF: ${operation} took ${duration}ms`,
    operation,
    duration,
    ...metadata,
  });
}

export type Logger = typeof logger;
