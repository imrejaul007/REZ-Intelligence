/**
 * Logger utility for Aggregator Hub
 * Provides structured logging with context
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LoggerConfig {
  level: LogLevel;
  includeTimestamp: boolean;
  includeContext: boolean;
  prettyPrint: boolean;
  transport?: 'console' | 'file' | 'remote';
  remoteUrl?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_CONFIG: LoggerConfig = {
  level: 'info',
  includeTimestamp: true,
  includeContext: true,
  prettyPrint: true,
  transport: 'console',
};

export class Logger {
  private config: LoggerConfig;
  private context: Record<string, unknown>;

  constructor(config: Partial<LoggerConfig> = {}, defaultContext: Record<string, unknown> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.context = defaultContext;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatMessage(level: LogLevel, message: string, context?: Record<string, unknown>): string {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.config.includeContext ? { ...this.context, ...context } : undefined,
    };

    if (this.config.prettyPrint) {
      return JSON.stringify(logEntry, null, 2);
    }

    return JSON.stringify(logEntry);
  }

  private log(level: LogLevel, message: string, error?: Error, context?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.config.includeContext ? { ...this.context, ...context } : undefined,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    const output = this.config.prettyPrint ? JSON.stringify(entry, null, 2) : JSON.stringify(entry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
        console.debug(output);
        break;
      default:
        console.log(output);
    }

    // If remote transport is configured, send to remote logger
    if (this.config.transport === 'remote' && this.config.remoteUrl) {
      this.sendToRemote(entry).catch((err) => {
        console.error('Failed to send log to remote:', err);
      });
    }
  }

  private async sendToRemote(entry: LogEntry): Promise<void> {
    if (!this.config.remoteUrl) return;

    try {
      await fetch(this.config.remoteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });
    } catch {
      // Silently fail - we don't want logging failures to break the app
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: Record<string, unknown>): Logger {
    return new Logger(this.config, { ...this.context, ...additionalContext });
  }

  /**
   * Set the logging level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Log debug level message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, undefined, context);
  }

  /**
   * Log info level message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, undefined, context);
  }

  /**
   * Log warning level message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, undefined, context);
  }

  /**
   * Log error level message
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, error, context);
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, durationMs: number, context?: Record<string, unknown>): void {
    this.info(`Performance: ${operation}`, {
      ...context,
      durationMs,
      operation,
    });
  }

  /**
   * Log API request
   */
  apiRequest(
    method: string,
    url: string,
    statusCode?: number,
    durationMs?: number,
    context?: Record<string, unknown>
  ): void {
    this.info(`API Request: ${method} ${url}`, {
      ...context,
      method,
      url,
      statusCode,
      durationMs,
    });
  }

  /**
   * Log webhook event
   */
  webhook(aggregator: string, eventType: string, success: boolean, context?: Record<string, unknown>): void {
    const level = success ? 'info' : 'error';
    this.log(level, `Webhook: ${aggregator} ${eventType}`, undefined, {
      ...context,
      aggregator,
      eventType,
      success,
    });
  }
}

// Default logger instance
export const logger = new Logger();

// Factory function for creating loggers
export function createLogger(
  config?: Partial<LoggerConfig>,
  context?: Record<string, unknown>
): Logger {
  return new Logger(config, context);
}
