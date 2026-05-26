/**
 * Winston Logger Configuration
 * Centralized logging for the REZ AI Voice Agent Service
 */

import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom log format for development
const devFormat = printf(({ level, message, timestamp, ...metadata }: { level: string; message: string; timestamp?: string; [key: string]: unknown }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

// Custom log format for production (JSON)
const prodFormat = combine(
  errors({ stack: true }),
  timestamp(),
  json()
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'rez-ai-voice' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? prodFormat : combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        devFormat
      )
    })
  ]
});

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: path.join(process.env.LOG_DIR || './logs', 'error.log'),
    level: 'error',
    format: prodFormat
  }));

  logger.add(new winston.transports.File({
    filename: path.join(process.env.LOG_DIR || './logs', 'combined.log'),
    format: prodFormat
  }));
}

// Helper methods for structured logging
export const logCallEvent = (callSid: string, event: string, metadata?: Record<string, unknown>) => {
  logger.info(`[Call ${callSid}] ${event}`, { callSid, event, ...metadata });
};

export const logAIService = (service: string, operation: string, metadata?: Record<string, unknown>) => {
  logger.info(`[AI:${service}] ${operation}`, { aiService: service, operation, ...metadata });
};

export const logError = (context: string, error: unknown, metadata?: Record<string, unknown>) => {
  const errorInfo = error instanceof Error
    ? { message: error.message, stack: error.stack }
    : { error: String(error) };
  logger.error(`[Error:${context}]`, { context, ...errorInfo, ...metadata });
};

export const logMetric = (metric: string, value: number, metadata?: Record<string, unknown>) => {
  logger.info(`[Metric:${metric}]`, { metric, value, timestamp: new Date().toISOString(), ...metadata });
};

export default logger;
