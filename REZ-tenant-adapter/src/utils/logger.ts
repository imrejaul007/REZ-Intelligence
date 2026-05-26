/**
 * Simple Logger
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private service: string;
  constructor(service = 'REZ-Tenant-Adapter') {
    this.service = service;
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      ...meta
    };
    const output = JSON.stringify(entry);
    if (level === 'error') console.error(output);
    else if (level === 'warn') console.warn(output);
    else console.log(output);
  }

  info(message: string, meta?: Record<string, unknown>): void { this.log('info', message, meta); }
  warn(message: string, meta?: Record<string, unknown>): void { this.log('warn', message, meta); }
  error(message: string, meta?: Record<string, unknown>): void { this.log('error', message, meta); }
}

export const logger = new Logger();
