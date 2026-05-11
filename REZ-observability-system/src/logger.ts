import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  service: string;
  message: string;
  metadata?: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
}

export interface LogQuery {
  level?: string;
  service?: string;
  startTime?: string;
  endTime?: string;
  traceId?: string;
  limit?: number;
  offset?: number;
}

class Logger {
  private logs: LogEntry[] = [];
  private readonly maxLogs = 10000;
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
      ]
    });
  }

  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    service: string,
    metadata?: Record<string, unknown>,
    traceId?: string,
    spanId?: string
  ): LogEntry {
    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level,
      service,
      message,
      metadata,
      traceId,
      spanId
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    return entry;
  }

  debug(message: string, service: string, metadata?: Record<string, unknown>, traceId?: string, spanId?: string): LogEntry {
    const entry = this.createLogEntry('debug', message, service, metadata, traceId, spanId);
    this.logger.debug(message, { service, ...metadata, traceId, spanId });
    return entry;
  }

  info(message: string, service: string, metadata?: Record<string, unknown>, traceId?: string, spanId?: string): LogEntry {
    const entry = this.createLogEntry('info', message, service, metadata, traceId, spanId);
    this.logger.info(message, { service, ...metadata, traceId, spanId });
    return entry;
  }

  warn(message: string, service: string, metadata?: Record<string, unknown>, traceId?: string, spanId?: string): LogEntry {
    const entry = this.createLogEntry('warn', message, service, metadata, traceId, spanId);
    this.logger.warn(message, { service, ...metadata, traceId, spanId });
    return entry;
  }

  error(message: string, service: string, metadata?: Record<string, unknown>, traceId?: string, spanId?: string): LogEntry {
    const entry = this.createLogEntry('error', message, service, metadata, traceId, spanId);
    this.logger.error(message, { service, ...metadata, traceId, spanId });
    return entry;
  }

  queryLogs(query: LogQuery): { logs: LogEntry[]; total: number } {
    let filtered = [...this.logs];

    if (query.level) {
      filtered = filtered.filter(log => log.level === query.level);
    }

    if (query.service) {
      filtered = filtered.filter(log => log.service === query.service);
    }

    if (query.traceId) {
      filtered = filtered.filter(log => log.traceId === query.traceId);
    }

    if (query.startTime) {
      const start = new Date(query.startTime).getTime();
      filtered = filtered.filter(log => new Date(log.timestamp).getTime() >= start);
    }

    if (query.endTime) {
      const end = new Date(query.endTime).getTime();
      filtered = filtered.filter(log => new Date(log.timestamp).getTime() <= end);
    }

    const total = filtered.length;
    const offset = query.offset || 0;
    const limit = query.limit || 100;

    filtered = filtered
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(offset, offset + limit);

    return { logs: filtered, total };
  }

  getLogById(id: string): LogEntry | undefined {
    return this.logs.find(log => log.id === id);
  }

  getLogStats(): { total: number; byLevel: Record<string, number>; byService: Record<string, number> } {
    const byLevel: Record<string, number> = {};
    const byService: Record<string, number> = {};

    for (const log of this.logs) {
      byLevel[log.level] = (byLevel[log.level] || 0) + 1;
      byService[log.service] = (byService[log.service] || 0) + 1;
    }

    return { total: this.logs.length, byLevel, byService };
  }
}

export const logger = new Logger();
