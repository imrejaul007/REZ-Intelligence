/**
 * Simple logger utility for REZ Intelligence services
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

const logger = {
  debug: (message: string, meta?: Record<string, unknown>): void => {
    if (levels[LOG_LEVEL as LogLevel] <= levels.debug) {
      console.log(formatMessage('debug', message, meta));
    }
  },
  info: (message: string, meta?: Record<string, unknown>): void => {
    if (levels[LOG_LEVEL as LogLevel] <= levels.info) {
      console.log(formatMessage('info', message, meta));
    }
  },
  warn: (message: string, meta?: Record<string, unknown>): void => {
    if (levels[LOG_LEVEL as LogLevel] <= levels.warn) {
      console.warn(formatMessage('warn', message, meta));
    }
  },
  error: (message: string, meta?: Record<string, unknown>): void => {
    if (levels[LOG_LEVEL as LogLevel] <= levels.error) {
      console.error(formatMessage('error', message, meta));
    }
  },
};

export { logger };
export type { LogLevel };
