/**
 * Logger - Winston-based logging utility
 * Provides structured logging for the expert service
 */

import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

export interface LogContext {
  expertId?: string;
  intentId?: string;
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  requestId?: string;
  duration?: number;
}

export class Logger {
  private logger: winston.Logger;
  private serviceName: string;
  private requestId?: string;

  private static readonly levels: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    verbose: 4
  };

  constructor(serviceName: string = 'expert-base') {
    this.serviceName = serviceName;

    const logLevel = process.env.LOG_LEVEL || 'info';
    const logFormat = process.env.LOG_FORMAT || 'json';

    const formatters = logFormat === 'json'
      ? winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      : winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.errors({ stack: true }),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }: { timestamp?: string; level: string; message: string; [key: string]: unknown }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
            return `${timestamp} [${level}] ${message} ${metaStr}`;
          })
        );

    this.logger = winston.createLogger({
      level: logLevel,
      levels: Logger.levels,
      format: formatters,
      defaultMeta: { service: this.serviceName },
      transports: [
        new winston.transports.Console()
      ]
    });
  }

  /**
   * Set request ID for the current operation
   */
  setRequestId(requestId?: string): void {
    this.requestId = requestId || uuidv4();
  }

  /**
   * Get current request ID
   */
  getRequestId(): string {
    return this.requestId || uuidv4();
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger(this.serviceName);
    childLogger.requestId = this.requestId;
    return childLogger;
  }

  /**
   * Log error message
   */
  error(message: string, ...args: unknown[]): void {
    this.logger.error(this.formatMessage(message), ...args);
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: unknown[]): void {
    this.logger.warn(this.formatMessage(message), ...args);
  }

  /**
   * Log info message
   */
  info(message: string, ...args: unknown[]): void {
    this.logger.info(this.formatMessage(message), ...args);
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: unknown[]): void {
    this.logger.debug(this.formatMessage(message), ...args);
  }

  /**
   * Log verbose message
   */
  verbose(message: string, ...args: unknown[]): void {
    this.logger.verbose(this.formatMessage(message), ...args);
  }

  /**
   * Log with timing
   */
  timed<T>(
    operation: string,
    fn: () => T | Promise<T>,
    context?: LogContext
  ): Promise<T> | T {
    const startTime = Date.now();
    const requestId = this.getRequestId();

    if (context) {
      this.info(`[${requestId}] Starting: ${operation}`, context);
    } else {
      this.info(`[${requestId}] Starting: ${operation}`);
    }

    const result = fn();

    if (result instanceof Promise) {
      return result
        .then((value) => {
          const duration = Date.now() - startTime;
          if (context) {
            this.info(`[${requestId}] Completed: ${operation}`, { ...context, durationMs: duration });
          } else {
            this.info(`[${requestId}] Completed: ${operation}`, { durationMs: duration });
          }
          return value;
        })
        .catch((error) => {
          const duration = Date.now() - startTime;
          if (context) {
            this.error(`[${requestId}] Failed: ${operation}`, { ...context, durationMs: duration, error: error.message });
          } else {
            this.error(`[${requestId}] Failed: ${operation}`, { durationMs: duration, error: error.message });
          }
          throw error;
        });
    } else {
      const duration = Date.now() - startTime;
      if (context) {
        this.info(`[${requestId}] Completed: ${operation}`, { ...context, durationMs: duration });
      } else {
        this.info(`[${requestId}] Completed: ${operation}`, { durationMs: duration });
      }
      return result;
    }
  }

  /**
   * Log request/response
   */
  logRequest(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    context?: LogContext
  ): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const message = `${method} ${path} ${statusCode} - ${durationMs}ms`;

    if (context) {
      this.logger.log(level, message, context);
    } else {
      this.logger.log(level, message);
    }
  }

  /**
   * Log structured entry
   */
  log(entry: LogEntry): void {
    this.logger.log(entry.level, entry.message, {
      ...entry.context,
      requestId: entry.requestId || this.requestId,
      duration: entry.duration
    });
  }

  /**
   * Get log entries as array
   */
  getEntries(level?: LogLevel): LogEntry[] {
    // This would need integration with a transport that stores entries
    return [];
  }

  private formatMessage(message: string): string {
    if (this.requestId) {
      return `[${this.requestId}] ${message}`;
    }
    return message;
  }
}

/**
 * Create a logger instance
 */
export function createLogger(serviceName?: string): Logger {
  return new Logger(serviceName);
}
