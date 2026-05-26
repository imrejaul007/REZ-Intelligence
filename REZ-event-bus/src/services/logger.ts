/**
 * Logger Service
 * Winston-based structured logging for the REZ Event Bus
 */

import winston from 'winston';
import { config } from '../config';

/**
 * Custom log format for structured logging
 */
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Human-readable format for development
 */
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }: { timestamp?: string; level: string; message: string; [key: string]: unknown }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

/**
 * Create logger instance
 */
const logger = winston.createLogger({
  level: config.logging.level,
  format: config.logging.format === 'json' ? structuredFormat : devFormat,
  defaultMeta: {
    service: 'rez-event-bus',
    version: '1.0.0',
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

/**
 * Add file transport in production
 */
if (config.server.nodeEnv === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );

  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );
}

/**
 * Create child logger with additional context
 */
export function createChildLogger(context: Record<string, unknown>): winston.Logger {
  return logger.child(context);
}

/**
 * Log event-related operations
 */
export const eventLogger = createChildLogger({ component: 'event' });

/**
 * Log subscription-related operations
 */
export const subscriptionLogger = createChildLogger({ component: 'subscription' });

/**
 * Log Kafka-related operations
 */
export const kafkaLogger = createChildLogger({ component: 'kafka' });

/**
 * Log Redis-related operations
 */
export const redisLogger = createChildLogger({ component: 'redis' });

/**
 * Log HTTP request/response
 */
export const httpLogger = createChildLogger({ component: 'http' });

export { logger };

export default logger;
