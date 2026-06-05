import winston from 'winston';
import { config, isProduction } from '../config';

// Custom format for development
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;

    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }

    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  })
);

// Custom format for production
const prodFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
export const logger = winston.createLogger({
  level: config.logLevel,
  defaultMeta: {
    service: 'rez-mind-retail-service',
    version: process.env.npm_package_version || '1.0.0',
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: isProduction ? prodFormat : devFormat,
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

// Create a stream object for Morgan HTTP logging integration
export const logStream = {
  write: (message: string): void => {
    logger.info(message.trim());
  },
};

// Helper functions for structured logging
export const logRequest = (
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  meta?: Record<string, unknown>
): void => {
  logger.info('HTTP Request', {
    method,
    path,
    statusCode,
    duration,
    ...meta,
  });
};

export const logError = (
  error: Error,
  context?: Record<string, unknown>
): void => {
  logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    ...context,
  });
};

export const logInfo = (
  message: string,
  meta?: Record<string, unknown>
): void => {
  logger.info(message, meta);
};

export const logWarn = (
  message: string,
  meta?: Record<string, unknown>
): void => {
  logger.warn(message, meta);
};

export const logDebug = (
  message: string,
  meta?: Record<string, unknown>
): void => {
  logger.debug(message, meta);
};

// Create child logger for specific components
export const createComponentLogger = (component: string) => {
  return logger.child({ component });
};

// Request logging helper
export const createRequestLogger = (requestId: string) => {
  return {
    info: (message: string, meta?: Record<string, unknown>) =>
      logger.info(`[${requestId}] ${message}`, meta),
    warn: (message: string, meta?: Record<string, unknown>) =>
      logger.warn(`[${requestId}] ${message}`, meta),
    error: (message: string, meta?: Record<string, unknown>) =>
      logger.error(`[${requestId}] ${message}`, meta),
    debug: (message: string, meta?: Record<string, unknown>) =>
      logger.debug(`[${requestId}] ${message}`, meta),
  };
};

export default logger;