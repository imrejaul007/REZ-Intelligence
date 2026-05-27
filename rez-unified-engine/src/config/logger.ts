/**
 * REZ Unified Engine Logger
 * Winston-based structured logging with multiple transports
 */

import winston from 'winston';
import { config } from './index';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom log format
const logFormat = printf((info: winston.Logform.TransformableInfo) => {
  const { level, message, timestamp, ...metadata } = info;
  let log = `${timestamp} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0) {
    log += ` ${JSON.stringify(metadata)}`;
  }

  return log;
});

// JSON format for production
const jsonLogFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  json()
);

// Console format for development
const consoleLogFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  colorize({ all: true }),
  logFormat
);

// Create logger instance
export const logger = winston.createLogger({
  level: config.server.logLevel,
  defaultMeta: {
    service: 'rez-unified-engine',
    version: '1.0.0',
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: config.server.nodeEnv === 'production' ? jsonLogFormat : consoleLogFormat,
    }),
  ],
  exitOnError: false,
});

// Add file transports in production
if (config.server.nodeEnv === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: jsonLogFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: jsonLogFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create child logger for specific components
export function createChildLogger(component: string): winston.Logger {
  return logger.child({ component });
}

export default logger;
