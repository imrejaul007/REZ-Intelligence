/**
 * REZ Flow Runtime - Logger Service
 * Winston-based structured logging
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let log = `${timestamp} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0) {
    log += ` ${JSON.stringify(metadata, null, 2)}`;
  }

  return log;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    json()
  ),
  defaultMeta: {
    service: 'rez-flow-runtime',
    version: '1.0.0'
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'HH:mm:ss' }),
        logFormat
      ),
      handleExceptions: true,
      handleRejections: true
    }),

    // Error file transport
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),

    // Combined file transport
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ],
  exitOnError: false
});

// Create child logger with execution context
logger.child = (meta: Record<string, unknown>) => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
      errors({ stack: true }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      json()
    ),
    defaultMeta: {
      service: 'rez-flow-runtime',
      version: '1.0.0',
      ...meta
    },
    transports: logger.transports
  });
};

// Log execution-specific events
logger.execution = {
  started: (executionId: string, workflowId: string, context: Record<string, unknown>) => {
    logger.info('Workflow execution started', { executionId, workflowId, event: 'execution_started', ...context });
  },

  nodeStarted: (executionId: string, nodeId: string, nodeType: string) => {
    logger.debug(`Node execution started: ${nodeId}`, { executionId, nodeId, nodeType, event: 'node_started' });
  },

  nodeCompleted: (executionId: string, nodeId: string, duration: number, output?: unknown) => {
    logger.debug(`Node execution completed: ${nodeId}`, { executionId, nodeId, duration, event: 'node_completed', output });
  },

  nodeFailed: (executionId: string, nodeId: string, error: string) => {
    logger.error(`Node execution failed: ${nodeId}`, { executionId, nodeId, error, event: 'node_failed' });
  },

  completed: (executionId: string, duration: number, stats: Record<string, number>) => {
    logger.info('Workflow execution completed', { executionId, duration, event: 'execution_completed', ...stats });
  },

  failed: (executionId: string, error: string, nodeId?: string) => {
    logger.error('Workflow execution failed', { executionId, error, nodeId, event: 'execution_failed' });
  },

  cancelled: (executionId: string, cancelledBy?: string) => {
    logger.warn('Workflow execution cancelled', { executionId, cancelledBy, event: 'execution_cancelled' });
  },

  retried: (executionId: string, nodeId: string, retryCount: number) => {
    logger.info(`Node retry attempted`, { executionId, nodeId, retryCount, event: 'node_retry' });
  },

  delayed: (executionId: string, nodeId: string, delayUntil: Date) => {
    logger.info(`Node delayed until ${delayUntil.toISOString()}`, { executionId, nodeId, delayUntil, event: 'node_delayed' });
  }
};

// Log DLQ events
logger.dlq = {
  added: (executionId: string, nodeId: string, error: string, reason: string) => {
    logger.error('Message added to DLQ', { executionId, nodeId, error, reason, event: 'dlq_added' });
  },

  retried: (executionId: string, nodeId: string, attempt: number) => {
    logger.info('DLQ message retry attempted', { executionId, nodeId, attempt, event: 'dlq_retried' });
  },

  discarded: (executionId: string, nodeId: string, reason: string) => {
    logger.warn('DLQ message discarded', { executionId, nodeId, reason, event: 'dlq_discarded' });
  }
};

// Ensure logs directory exists
import fs from 'fs';
const logsDir = 'logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export default logger;
