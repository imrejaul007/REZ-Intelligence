/**
 * Logger Service
 * Winston-based structured logging for the Attribution-Loyalty Bridge
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom format for structured logging
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const structuredFormat = printf((info: any) => {
  const { level, message, timestamp, ...metadata } = info;
  let msg = `${timestamp} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0 && metadata.stack === undefined) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  if (metadata.stack) {
    msg += `\n${metadata.stack}`;
  }

  return msg;
});

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    structuredFormat
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'rez-attribution-loyalty-bridge'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        structuredFormat
      )
    })
  ]
});

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  );

  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  );
}

// Child logger for specific components
export const createComponentLogger = (component: string) => {
  return logger.child({ component });
};

// Specialized loggers
export const cashbackLogger = createComponentLogger('cashback-engine');
export const loyaltyLogger = createComponentLogger('loyalty-trigger');
export const attributionLogger = createComponentLogger('attribution-listener');
export const bridgeLogger = createComponentLogger('bridge-api');

export default logger;
