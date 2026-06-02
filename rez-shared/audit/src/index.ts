import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  who: {
    userId: string;
    userRole: string;
    ipAddress?: string;
  };
  what: {
    action: string;
    resource: string;
    resourceId: string;
  };
  before?: Record<string, any>;
  after?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AuditSinkConfig {
  baseUrl: string;
  apiKey?: string;
  batchSize?: number;
  flushInterval?: number;
}

export class AuditLogger {
  private client: AxiosInstance;
  private queue: AuditLogEntry[] = [];
  private batchSize: number;
  private flushInterval: number;
  private flushTimer?: NodeJS.Timeout;

  constructor(config: AuditSinkConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: config.apiKey ? { 'X-API-Key': config.apiKey } : {},
    });

    this.batchSize = config.batchSize || 10;
    this.flushInterval = config.flushInterval || 5000; // 5 seconds
    this.startAutoFlush();
  }

  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  async log(
    action: string,
    resource: string,
    resourceId: string,
    who: { userId: string; userRole: string; ipAddress?: string },
    options?: {
      before?: Record<string, any>;
      after?: Record<string, any>;
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    const entry: AuditLogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      who,
      what: { action, resource, resourceId },
      before: options?.before,
      after: options?.after,
      metadata: options?.metadata,
    };

    this.queue.push(entry);

    if (this.queue.length >= this.batchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const entries = this.queue.splice(0, this.batchSize);

    try {
      await this.client.post('/audit-logs', {
        entries,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Re-queue on failure
      this.queue.unshift(...entries);
      console.error('Failed to flush audit logs:', error);
    }
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }
}

export async function createAuditEntry(
  logger: AuditLogger,
  action: string,
  resource: string,
  resourceId: string,
  who: { userId: string; userRole: string; ipAddress?: string },
  before?: Record<string, any>,
  after?: Record<string, any>,
): Promise<void> {
  await logger.log(action, resource, resourceId, who, {
    before,
    after,
  });
}
