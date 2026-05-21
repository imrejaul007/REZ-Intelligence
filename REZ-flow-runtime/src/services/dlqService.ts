/**
 * REZ Flow Runtime - Dead Letter Queue Service
 * Handles failed workflow executions that need manual intervention
 */

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { DLQMessage, WorkflowDefinition, ExecutionContext, NodeData } from '../types/workflow';
import logger from './logger';

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
  retryDelay: 60000, // 1 minute
  ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
  cleanupInterval: 60 * 60 * 1000 // 1 hour
};

class DLQService {
  private redis: Redis;
  private queue: Queue<DLQMessage>;
  private worker: Worker<DLQMessage> | null = null;
  private config: Required<DLQConfig>;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;

  constructor(config: DLQConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize Redis connection
    this.redis = new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });

    // Initialize queue
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

  /**
   * Connect to Redis and start processing
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      // Test connection
      await this.redis.ping();
      this.isConnected = true;

      // Start cleanup timer
      this.startCleanup();

      logger.info('DLQ service connected', { redisUrl: this.config.redisUrl });
    } catch (error) {
      logger.error('Failed to connect DLQ service', { error });
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
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
   * Add a failed execution to the DLQ
   */
  async addToQueue(message: DLQMessage): Promise<string> {
    const jobId = `${message.executionId}-${message.nodeId}-${Date.now()}`;

    try {
      // Store in Redis with TTL for fast access
      const dlqKey = `dlq:${jobId}`;
      await this.redis.setex(
        dlqKey,
        Math.floor(this.config.ttl / 1000),
        JSON.stringify(message)
      );

      // Add to BullMQ queue for retry processing
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

  /**
   * Get DLQ message by ID
   */
  async getMessage(jobId: string): Promise<DLQMessage | null> {
    const dlqKey = `dlq:${jobId}`;
    const data = await this.redis.get(dlqKey);

    if (!data) return null;

    try {
      return JSON.parse(data) as DLQMessage;
    } catch {
      return null;
    }
  }

  /**
   * Get all DLQ messages with pagination
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

    const keys = await this.redis.keys('dlq:*');
    const total = keys.length;

    // Sort by most recent (assuming keys have timestamp suffix)
    keys.sort().reverse();

    // Paginate
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

    return {
      messages,
      total,
      page,
      limit
    };
  }

  /**
   * Get DLQ statistics
   */
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
    const keys = await this.redis.keys('dlq:*');

    const byWorkflow: Record<string, number> = {};
    let oldestMessage: Date | null = null;
    let newestMessage: Date | null = null;

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        try {
          const message = JSON.parse(data) as DLQMessage;
          byWorkflow[message.workflowId] = (byWorkflow[message.workflowId] || 0) + 1;

          const failedAt = new Date(message.failedAt);
          if (!oldestMessage || failedAt < oldestMessage) {
            oldestMessage = failedAt;
          }
          if (!newestMessage || failedAt > newestMessage) {
            newestMessage = failedAt;
          }
        } catch {
          // Skip invalid entries
        }
      }
    }

    // Get retry stats from BullMQ
    const completed = await this.queue.getCompletedCount();
    const failed = await this.queue.getFailedCount();

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
   * Retry a specific DLQ message
   */
  async retryMessage(jobId: string): Promise<boolean> {
    const message = await this.getMessage(jobId);

    if (!message) {
      logger.warn(`DLQ message not found: ${jobId}`);
      return false;
    }

    try {
      // Re-add to queue
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
    }
  }

  /**
   * Discard a DLQ message (permanent removal)
   */
  async discardMessage(jobId: string, reason: string): Promise<boolean> {
    const message = await this.getMessage(jobId);

    if (!message) {
      return false;
    }

    try {
      // Remove from Redis
      await this.redis.del(`dlq:${jobId}`);

      // Remove from BullMQ if exists
      const job = await this.queue.getJob(jobId);
      if (job) {
        await job.remove();
      }

      logger.dlq.discarded(message.executionId, message.nodeId, reason);

      return true;
    } catch (error) {
      logger.error('Failed to discard DLQ message', { jobId, error });
      return false;
    }
  }

  /**
   * Retry all DLQ messages for a specific execution
   */
  async retryExecution(executionId: string): Promise<number> {
    const keys = await this.redis.keys('dlq:*');
    let retried = 0;

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        try {
          const message = JSON.parse(data) as DLQMessage;
          if (message.executionId === executionId) {
            const jobId = key.replace('dlq:', '');
            const success = await this.retryMessage(jobId);
            if (success) retried++;
          }
        } catch {
          // Skip invalid entries
        }
      }
    }

    return retried;
  }

  /**
   * Clean up expired DLQ messages
   */
  async cleanup(): Promise<number> {
    const keys = await this.redis.keys('dlq:*');
    let cleaned = 0;
    const now = Date.now();

    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl <= 0) {
        await this.redis.del(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`DLQ cleanup completed`, { cleaned, remaining: keys.length - cleaned });
    }

    return cleaned;
  }

  /**
   * Start automatic cleanup
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(error => {
        logger.error('DLQ cleanup error', { error });
      });
    }, this.config.cleanupInterval);
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.queue.on('error', (error) => {
      logger.error('DLQ queue error', { error });
    });

    this.redis.on('error', (error) => {
      logger.error('DLQ Redis error', { error });
    });
  }

  /**
   * Start worker to process retries
   */
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

// Export singleton instance
const dlqService = new DLQService();

export default dlqService;
export { DLQService };
