/**
 * REZ Flow Runtime - Dead Letter Queue Service
 * Handles failed workflow executions with proper Redis SCAN, distributed locks, and idempotency
 */

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { DLQMessage, WorkflowDefinition, ExecutionContext, NodeData } from '../types/workflow';
import logger from './logger';

// ==================== CONSTANTS ====================

const LOCK_TTL_MS = 60000; // 1 minute for DLQ operations

// ==================== UTILITIES ====================

function safeJsonParse<T = unknown>(
  data: string | null,
  fallback: T | null = null
): T | null {
  if (!data) return fallback;
  try {
    return JSON.parse(data) as T;
  } catch {
    logger.error('Failed to parse JSON', { data: data?.substring(0, 100) });
    return fallback;
  }
}

async function scanKeys(
  redis: Redis,
  pattern: string,
  count: number = 100
): Promise<string[]> {
  const allKeys: string[] = [];
  let cursor = '0';

  do {
    const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', count);
    cursor = newCursor;
    allKeys.push(...keys);
  } while (cursor !== '0');

  return allKeys;
}

async function acquireLock(
  redis: Redis,
  key: string,
  ttlMs: number = LOCK_TTL_MS
): Promise<string | null> {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const result = await redis.set(`lock:${key}`, token, 'PX', ttlMs, 'NX');
  return result === 'OK' ? token : null;
}

async function releaseLock(
  redis: Redis,
  key: string,
  token: string
): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  const result = await redis.eval(script, 1, `lock:${key}`, token);
  return result === 1;
}

// ==================== CONFIG ====================

interface DLQConfig {
  redisUrl?: string;
  maxRetries?: number;
  retryDelay?: number;
  ttl?: number;
  cleanupInterval?: number;
}

const DEFAULT_CONFIG: Required<DLQConfig> = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  maxRetries: 5,
  retryDelay: 60000,
  ttl: 7 * 24 * 60 * 60 * 1000,
  cleanupInterval: 60 * 60 * 1000
};

class DLQService {
  private redis: Redis;
  private queue: Queue<DLQMessage>;
  private worker: Worker<DLQMessage> | null = null;
  private config: Required<DLQConfig>;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;
  private processingLocks = new Map<string, NodeJS.Timeout>();

  constructor(config: DLQConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.redis = new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });

    this.queue = new Queue<DLQMessage>('rez-flow-dlq', {
      connection: this.redis,
      defaultJobOptions: {
        attempts: this.config.maxRetries,
        backoff: {
          type: 'exponential',
          delay: this.config.retryDelay
        },
        removeOnComplete: false,
        removeOnFail: false
      }
    });

    this.setupEventHandlers();
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      await this.redis.ping();
      this.isConnected = true;
      this.startCleanup();
      logger.info('DLQ service connected', { redisUrl: this.config.redisUrl });
    } catch (error) {
      logger.error('Failed to connect DLQ service', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }

    await this.queue.close();
    await this.redis.quit();
    this.isConnected = false;
    logger.info('DLQ service disconnected');
  }

  /**
   * Add a failed execution to the DLQ with idempotency check
   */
  async addToQueue(message: DLQMessage): Promise<string> {
    const jobId = `${message.executionId}-${message.nodeId}-${Date.now()}`;

    try {
      // Check for duplicate using idempotency key
      const idempotencyKey = `dlq:idem:${message.executionId}:${message.nodeId}`;
      const existing = await this.redis.get(idempotencyKey);

      if (existing) {
        logger.info('Duplicate DLQ entry ignored', {
          executionId: message.executionId,
          nodeId: message.nodeId
        });
        return existing;
      }

      // Store in Redis with TTL
      const dlqKey = `dlq:${jobId}`;
      await this.redis.setex(
        dlqKey,
        Math.floor(this.config.ttl / 1000),
        JSON.stringify(message)
      );

      // Mark as processed for idempotency
      await this.redis.setex(idempotencyKey, this.config.ttl, jobId);

      // Add to BullMQ queue
      await this.queue.add('failed-node', message, {
        jobId,
        removeOnComplete: false,
        removeOnFail: false
      });

      logger.dlq.added(message.executionId, message.nodeId, message.error, 'Added to DLQ');

      return jobId;
    } catch (error) {
      logger.error('Failed to add to DLQ', { error, message });
      throw error;
    }
  }

  async getMessage(jobId: string): Promise<DLQMessage | null> {
    const dlqKey = `dlq:${jobId}`;
    const data = await this.redis.get(dlqKey);
    return safeJsonParse<DLQMessage>(data);
  }

  /**
   * List all DLQ messages with pagination using SCAN (non-blocking)
   */
  async listMessages(options: {
    page?: number;
    limit?: number;
    fromDate?: Date;
    toDate?: Date;
  } = {}): Promise<{
    messages: Array<DLQMessage & { jobId: string }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20 } = options;

    // Use SCAN instead of KEYS
    const keys = await scanKeys(this.redis, 'dlq:[^i]*', 100);
    const total = keys.length;

    keys.sort().reverse();

    const start = (page - 1) * limit;
    const end = start + limit;
    const pageKeys = keys.slice(start, end);

    const messages: Array<DLQMessage & { jobId: string }> = [];

    for (const key of pageKeys) {
      const jobId = key.replace('dlq:', '');
      const message = await this.getMessage(jobId);
      if (message) {
        messages.push({ ...message, jobId });
      }
    }

    return { messages, total, page, limit };
  }

  async getStats(): Promise<{
    totalMessages: number;
    byWorkflow: Record<string, number>;
    oldestMessage: Date | null;
    newestMessage: Date | null;
    retryStats: {
      total: number;
      succeeded: number;
      failed: number;
    };
  }> {
    // Use SCAN instead of KEYS
    const keys = await scanKeys(this.redis, 'dlq:[^i]*', 100);

    const byWorkflow: Record<string, number> = {};
    let oldestMessage: Date | null = null;
    let newestMessage: Date | null = null;

    for (const key of keys) {
      const data = await this.redis.get(key);
      const message = safeJsonParse<DLQMessage>(data);

      if (message) {
        byWorkflow[message.workflowId] = (byWorkflow[message.workflowId] || 0) + 1;

        const failedAt = new Date(message.failedAt);
        if (!oldestMessage || failedAt < oldestMessage) {
          oldestMessage = failedAt;
        }
        if (!newestMessage || failedAt > newestMessage) {
          newestMessage = failedAt;
        }
      }
    }

    const [completed, failed] = await Promise.all([
      this.queue.getCompletedCount(),
      this.queue.getFailedCount()
    ]);

    return {
      totalMessages: keys.length,
      byWorkflow,
      oldestMessage,
      newestMessage,
      retryStats: {
        total: completed + failed,
        succeeded: completed,
        failed
      }
    };
  }

  /**
   * Retry a specific DLQ message with distributed lock
   */
  async retryMessage(jobId: string): Promise<boolean> {
    // Acquire lock to prevent duplicate processing
    const lockToken = await acquireLock(this.redis, `dlq:retry:${jobId}`);
    if (!lockToken) {
      logger.warn('Could not acquire DLQ retry lock', { jobId });
      return false;
    }

    try {
      const message = await this.getMessage(jobId);

      if (!message) {
        logger.warn('DLQ message not found', { jobId });
        return false;
      }

      // Create new job with unique ID
      await this.queue.add('retry', message, {
        jobId: `retry-${jobId}-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: false
      });

      logger.dlq.retried(message.executionId, message.nodeId, message.retryCount + 1);

      return true;
    } catch (error) {
      logger.error('Failed to retry DLQ message', { jobId, error });
      return false;
    } finally {
      await releaseLock(this.redis, `dlq:retry:${jobId}`, lockToken);
    }
  }

  async discardMessage(jobId: string, reason: string): Promise<boolean> {
    const lockToken = await acquireLock(this.redis, `dlq:discard:${jobId}`);
    if (!lockToken) {
      return false;
    }

    try {
      const message = await this.getMessage(jobId);

      if (!message) {
        return false;
      }

      await this.redis.del(`dlq:${jobId}`);
      await this.redis.del(`dlq:idem:${message.executionId}:${message.nodeId}`);

      const job = await this.queue.getJob(jobId);
      if (job) {
        await job.remove();
      }

      logger.dlq.discarded(message.executionId, message.nodeId, reason);

      return true;
    } catch (error) {
      logger.error('Failed to discard DLQ message', { jobId, error });
      return false;
    } finally {
      await releaseLock(this.redis, `dlq:discard:${jobId}`, lockToken);
    }
  }

  async retryExecution(executionId: string): Promise<number> {
    // Use SCAN instead of KEYS
    const keys = await scanKeys(this.redis, 'dlq:[^i]*', 100);
    let retried = 0;

    for (const key of keys) {
      const data = await this.redis.get(key);
      const message = safeJsonParse<DLQMessage>(data);

      if (message && message.executionId === executionId) {
        const jobId = key.replace('dlq:', '');
        const success = await this.retryMessage(jobId);
        if (success) retried++;
      }
    }

    return retried;
  }

  /**
   * Clean up expired DLQ messages using SCAN
   */
  async cleanup(): Promise<number> {
    const keys = await scanKeys(this.redis, 'dlq:[^i]*', 100);
    let cleaned = 0;

    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl <= 0) {
        await this.redis.del(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('DLQ cleanup completed', { cleaned, remaining: keys.length - cleaned });
    }

    return cleaned;
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(error => {
        logger.error('DLQ cleanup error', { error });
      });
    }, this.config.cleanupInterval);
  }

  private setupEventHandlers(): void {
    this.queue.on('error', (error) => {
      logger.error('DLQ queue error', { error });
    });

    this.redis.on('error', (error) => {
      logger.error('DLQ Redis error', { error });
    });
  }

  async startWorker(
    processor: (message: DLQMessage) => Promise<boolean>
  ): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }

    this.worker = new Worker<DLQMessage>(
      'rez-flow-dlq',
      async (job: Job<DLQMessage>) => {
        const message = job.data;

        logger.info('Processing DLQ message', {
          executionId: message.executionId,
          nodeId: message.nodeId,
          attempt: job.attemptsMade
        });

        try {
          const success = await processor(message);

          if (!success) {
            throw new Error(`Processor returned failure for node ${message.nodeId}`);
          }

          // Remove from DLQ on success
          await this.redis.del(`dlq:${job.id}`);
          await this.redis.del(`dlq:idem:${message.executionId}:${message.nodeId}`);
        } catch (error) {
          logger.error('DLQ processing failed', {
            executionId: message.executionId,
            nodeId: message.nodeId,
            error
          });
          throw error;
        }
      },
      {
        connection: this.redis,
        concurrency: 5
      }
    );

    this.worker.on('completed', (job) => {
      logger.info('DLQ job completed', { jobId: job.id, executionId: job.data.executionId });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('DLQ job failed', { jobId: job?.id, error: error.message });
    });
  }
}

// ==================== LOGGER EXTENSIONS ====================

declare module './logger' {
  interface Logger {
    dlq?: {
      added?: (executionId: string, nodeId: string, error: string, message: string) => void;
      retried?: (executionId: string, nodeId: string, retryCount: number) => void;
      discarded?: (executionId: string, nodeId: string, reason: string) => void;
    };
  }
}

const originalLogger = logger;
if (!originalLogger.dlq) {
  (originalLogger as unknown).dlq = {
    added: (executionId: string, nodeId: string, error: string, message: string) => {
      originalLogger.info('DLQ entry added', {
        executionId,
        nodeId,
        error,
        message,
        event: 'dlq_added'
      });
    },
    retried: (executionId: string, nodeId: string, retryCount: number) => {
      originalLogger.info('DLQ message retried', {
        executionId,
        nodeId,
        retryCount,
        event: 'dlq_retried'
      });
    },
    discarded: (executionId: string, nodeId: string, reason: string) => {
      originalLogger.info('DLQ message discarded', {
        executionId,
        nodeId,
        reason,
        event: 'dlq_discarded'
      });
    }
  };
}

// Export singleton instance
const dlqService = new DLQService();

export default dlqService;
export { DLQService };
