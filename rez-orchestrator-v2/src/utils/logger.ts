import winston from 'winston';
import { appConfig } from '../config';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  return msg;
});

const jsonFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  json()
);

const simpleFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  colorize(),
  logFormat
);

export const logger = winston.createLogger({
  level: appConfig.logging.level,
  format: appConfig.logging.format === 'json' ? jsonFormat : simpleFormat,
  defaultMeta: {
    service: 'rez-orchestrator-v2',
    version: '1.0.0',
  },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

// Add request context logging helper
export function createRequestLogger(requestId: string) {
  return {
    info: (message: string, metadata?: Record<string, unknown>) => {
      logger.info(message, { requestId, ...metadata });
    },
    warn: (message: string, metadata?: Record<string, unknown>) => {
      logger.warn(message, { requestId, ...metadata });
    },
    error: (message: string, metadata?: Record<string, unknown>) => {
      logger.error(message, { requestId, ...metadata });
    },
    debug: (message: string, metadata?: Record<string, unknown>) => {
      logger.debug(message, { requestId, ...metadata });
    },
  };
}

// Metrics logging
export function logMetrics(metrics: Record<string, unknown>) {
  logger.info('Metrics', { type: 'metrics', ...metrics });
}

// Health check logging
export function logHealthCheck(status: 'healthy' | 'degraded' | 'unhealthy', details?: Record<string, unknown>) {
  logger.info('Health check', { status, ...details });
}

export default logger;
