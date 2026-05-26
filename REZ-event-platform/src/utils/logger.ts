/**
 * Event Platform Logger
 * Centralized logging with correlation ID support for event tracking
 */

import winston from 'winston';

const { combine, timestamp, json, errors, printf } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...meta }: { level: string; message: string; timestamp: string; [key: string]: unknown }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
});

// Create base logger format
const baseFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  json()
);

// Create logger instance
const baseLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: baseFormat,
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'rez-event-platform',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Console output
    new winston.transports.Console({
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        consoleFormat
      ),
    }),
  ],
});

// Create child logger function
function createChildLogger(meta: Record<string, unknown>): winston.Logger {
  return winston.createLogger({
    level: baseLogger.level,
    format: baseFormat,
    defaultMeta: {
      ...baseLogger.defaultMeta,
      ...meta,
    },
    transports: baseLogger.transports,
  });
}

// Export both the logger and child function
export const logger = Object.assign(baseLogger, {
  child: createChildLogger,
});

export type Logger = winston.Logger & {
  child(meta: Record<string, unknown>): winston.Logger;
};
