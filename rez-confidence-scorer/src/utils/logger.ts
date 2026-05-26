import winston from 'winston';
import config from '../config';

/**
 * Winston logger configuration for REZ Confidence Scorer
 */
const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Custom log format
 */
const logFormat = printf((info: winston.Logform.TransformableInfo) => {
  const { level, message, timestamp: ts, ...metadata } = info;
  let log = `${ts} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0) {
    log += ` ${JSON.stringify(metadata)}`;
  }

  return log;
});

/**
 * Create logger instance
 */
const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(errors({ stack: true }), timestamp(), logFormat),
  defaultMeta: {
    service: config.app.name,
    version: '1.0.0',
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
  ],
  exitOnError: false,
});

/**
 * Add request context to logs
 */
export function addRequestContext(context: Record<string, unknown>): void {
  logger.defaultMeta = {
    ...logger.defaultMeta,
    ...context,
  };
}

/**
 * Clear request context
 */
export function clearRequestContext(): void {
  logger.defaultMeta = {
    service: config.app.name,
    version: '1.0.0',
  };
}

export default logger;
