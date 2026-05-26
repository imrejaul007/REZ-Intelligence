import winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';

const asyncLocalStorage = new AsyncLocalStorage<Map<string, unknown>>();

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export function createLogger(service: string): winston.Logger {
  return winston.createLogger({
    level: (process.env.LOG_LEVEL as LogLevel) || 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ level, message, timestamp, ...meta }: { level: string; message: string; timestamp?: string; [key: string]: unknown }) => {
        return JSON.stringify({
          timestamp,
          level,
          service,
          message,
          ...meta,
          ...asyncLocalStorage.getStore(),
        });
      })
    ),
    transports: [new winston.transports.Console()],
  });
}

export function withContext<T>(context: Record<string, unknown>, fn: () => T): T {
  return asyncLocalStorage.run(new Map(Object.entries(context)), fn);
}

export function getContext(key: string): unknown {
  return asyncLocalStorage.getStore()?.get(key);
}

const loggers = new Map<string, winston.Logger>();

export function getLogger(service: string): winston.Logger {
  if (!loggers.has(service)) {
    loggers.set(service, createLogger(service));
  }
  return loggers.get(service)!;
}
