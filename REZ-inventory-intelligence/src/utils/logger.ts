import winston from 'winston';
import { ServiceConfig } from '../types/inventory.types.js';

/**
 * Winston Logger Configuration
 * Structured logging with JSON format for production, human-readable for development
 */

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Get environment variables
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Custom format for development
const devFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0 && metadata.stack) {
    msg += `\n${metadata.stack}`;
  } else if (Object.keys(metadata).length > 0) {
    // Filter out non-essential metadata for cleaner output
    const relevantMeta = { ...metadata };
    delete relevantMeta.service;
    if (Object.keys(relevantMeta).length > 0) {
      msg += ` ${JSON.stringify(relevantMeta)}`;
    }
  }

  return msg;
});

// Custom format for production (JSON)
const prodFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  json()
);

// Development format with colors
const developmentFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  colorize({ all: true }),
  devFormat
);

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: {
    service: 'rez-inventory-intelligence',
    version: '1.0.0',
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: NODE_ENV === 'production' ? prodFormat : developmentFormat,
    }),
  ],
  // Don't exit on unhandled exceptions in production (let Winston handle it)
  exitOnError: NODE_ENV !== 'production',
});

// Create child logger with context
export const createContextLogger = (context: string) => {
  return logger.child({ context });
};

// Specific loggers for different components
export const forecastLogger = createContextLogger('forecast');
export const optimizationLogger = createContextLogger('optimization');
export const reorderLogger = createContextLogger('reorder');
export const apiLogger = createContextLogger('api');
export const dbLogger = createContextLogger('database');
export const analyticsLogger = createContextLogger('analytics');

export default logger;
