/**
 * Job Queue Service
 *
 * Async job processing with Bull (Redis-based).
 * Supports retries, concurrency, scheduling.
 *
 * Usage:
 * ```typescript
 * const emailQueue = new JobQueue('send-email', redis);
 * await emailQueue.add({ to: 'user@example.com', subject: '...' });
 * emailQueue.process(async (job) => { ... });
 * ```
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import type { Job } from 'bullmq';
import type Redis from 'ioredis';
import { createServiceLogger } from '../config/logger';

const logger = createServiceLogger('JobQueue');

export interface JobQueueOptions {
  concurrency?: number;
  maxRetries?: number;
  retryBackoff?: 'exponential' | 'fixed';
  defaultDelay?: number;
  /**
   * Retention policy for completed jobs.
   * - 'short': 1 hour (default for non-critical jobs)
   * - 'medium': 24 hours (for audit trails)
   * - 'long': 7 days (for critical operations, allows replay)
   * - 'permanent': Never remove (for compliance/archival)
   */
  retentionPolicy?: 'short' | 'medium' | 'long' | 'permanent';
}

export interface AsyncJobData {
  type?: string;
  [key: string]: any;
}

/**
 * Generic job queue wrapper
 */
export class JobQueue<T extends AsyncJobData = AsyncJobData> {
  private queue: Queue<any, any, string>;
  private worker?: Worker<any, any, string>;
  private queueEvents?: QueueEvents;
  private readonly redisConnection: object;

  constructor(
    name: string,
    redis: Redis,
    private options: JobQueueOptions = {}
  ) {
    this.redisConnection = (redis as any).options || { host: 'localhost', port: 6379 };

    // Determine retention age in seconds based on policy
    const retentionAgeSeconds = this.getRetentionAge(options.retentionPolicy || 'short');

    // Create queue
    this.queue = new Queue(name, {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: options.maxRetries || 3,
        backoff: options.retryBackoff === 'fixed'
          ? { type: 'fixed', delay: 5000 }
          : { type: 'exponential', delay: 1000 },
        removeOnComplete: retentionAgeSeconds ? { age: retentionAgeSeconds } : false,
      },
    });

    // Monitor queue events
    this.queueEvents = new QueueEvents(name, {
      connection: this.redisConnection,
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error(`[${name}] Job ${jobId} failed: ${failedReason}`);
    });

    this.queueEvents.on('completed', ({ jobId }) => {
      logger.debug(`[${name}] Job ${jobId} completed`);
    });
  }

  /**
   * Get retention age in seconds based on policy
   */
  private getRetentionAge(policy: string): number | false {
    switch (policy) {
      case 'short':
        return 3600; // 1 hour
      case 'medium':
        return 86400; // 24 hours
      case 'long':
        return 604800; // 7 days
      case 'permanent':
        return false; // Never remove
      default:
        return 3600;
    }
  }

  /**
   * Add job to queue
   */
  async add(data: T, options?: { priority?: number; delay?: number }): Promise<Job<any, any, string>> {
    return this.queue.add(data.type || 'job', data as any, {
      priority: options?.priority || 0,
      delay: options?.delay ?? this.options.defaultDelay ?? 0,
    });
  }

  /**
   * Add job with unique key (deduplication)
   */
  async addUnique(
    uniqueKey: string,
    data: T,
    options?: { priority?: number }
  ): Promise<Job<any, any, string>> {
    return this.queue.add(data.type || 'job', data as any, {
      jobId: uniqueKey,
      priority: options?.priority || 0,
    });
  }

  /**
   * Add job to be processed at specific time
   * Note: If scheduledTime is in the past, the job will be executed immediately
   */
  async schedule(
    data: T,
    scheduledTime: Date,
    options?: { priority?: number }
  ): Promise<Job<any, any, string>> {
    const delay = scheduledTime.getTime() - Date.now();
    if (delay < 0) {
      logger.warn(`[${this.queue.name}] Job scheduled for past time (${scheduledTime.toISOString()}), executing immediately`);
    }
    return this.queue.add(data.type || 'job', data as any, {
      priority: options?.priority || 0,
      delay: Math.max(0, delay),
    });
  }

  /**
   * Set up job processor
   */
  process(
    handler: (job: Job<any, any, string>) => Promise<any>,
    concurrency: number = this.options.concurrency || 4
  ): void {
    this.worker = new Worker(this.queue.name, handler, {
      connection: this.redisConnection,
      concurrency,
      // C-28 FIX: Job timeout enforcement - prevent stuck jobs
      lockDuration: 30000, // 30 second lock
      lockRenewTime: 5000, // Renew lock every 5 seconds
      stalledInterval: 30000, // Check for stalled jobs every 30 seconds
      maxStalledCount: 2, // Fail job after 2 stalled attempts
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`[${this.queue.name}] Worker failed`, { error: err });
    });

    this.worker.on('error', (err) => {
      logger.error(`[${this.queue.name}] Worker error`, { error: err });
    });

    // C-28 FIX: Stuck job detection and recovery
    this.worker.on('stalled', (jobId: string) => {
      logger.warn(`[${this.queue.name}] Job stalled (lock expired without renewal)`, { jobId });
    });
  }

  /**
   * Get queue status
   */
  async getStatus() {
    const counts = await this.queue.getJobCounts();
    const jobs = await this.queue.getJobs(['active', 'waiting', 'failed']);

    return {
      ...counts,
      queueSize: jobs.length,
    };
  }

  /**
   * Pause queue
   */
  async pause(): Promise<void> {
    await this.queue.pause();
  }

  /**
   * Resume queue
   */
  async resume(): Promise<void> {
    await this.queue.resume();
  }

  /**
   * Clean completed jobs
   */
  async clean(olderThan: number = 3600000): Promise<void> {
    await this.queue.clean(olderThan, 1000, 'completed');
  }

  /**
   * Drain queue (remove all jobs)
   */
  async drain(): Promise<void> {
    await this.queue.drain();
  }

  /**
   * Close queue
   */
  async close(): Promise<void> {
    if (this.worker) await this.worker.close();
    if (this.queueEvents) await this.queueEvents.close();
    await this.queue.close();
  }
}

/**
 * Pre-configured job queues for common operations
 */
export class JobQueueService {
  private emailQueue: JobQueue;
  private smsQueue: JobQueue;
  private pushQueue: JobQueue;
  private webhookQueue: JobQueue;
  private orderQueue: JobQueue;

  constructor(redis: Redis) {
    this.emailQueue = new JobQueue('send-email', redis);
    this.smsQueue = new JobQueue('send-sms', redis);
    this.pushQueue = new JobQueue('send-push', redis);
    this.webhookQueue = new JobQueue('send-webhook', redis);
    this.orderQueue = new JobQueue('process-order', redis);
  }

  /**
   * Queue email to be sent
   * @param dedupTTL - Optional TTL in seconds for email deduplication key. If set, identical
   *   emails sent within this window will be deduplicated. Defaults to 24 hours (86400s).
   *   Set to 0 to disable deduplication entirely.
   */
  async sendEmail(
    to: string,
    subject: string,
    body: string,
    options?: { dedupTTL?: number } & any
  ): Promise<void> {
    const ttl = options?.dedupTTL ?? 86400;
    const jobId = ttl > 0 ? `email:${to}:${subject}` : undefined;
    if (jobId) {
      await this.emailQueue.addUnique(jobId, {
        type: 'send-email',
        to,
        subject,
        body,
        ...options,
      });
    } else {
      await this.emailQueue.add({
        type: 'send-email',
        to,
        subject,
        body,
        ...options,
      });
    }
  }

  /**
   * Queue SMS to be sent
   */
  async sendSms(phone: string, message: string, options?: any): Promise<void> {
    await this.smsQueue.add({
      type: 'send-sms',
      phone,
      message,
      ...options,
    });
  }

  /**
   * Queue push notification
   */
  async sendPush(userId: string, title: string, body: string, options?: any): Promise<void> {
    await this.pushQueue.add({
      type: 'send-push',
      userId,
      title,
      body,
      ...options,
    });
  }

  /**
   * Queue webhook call
   * Uses idempotent jobId (url + event) to prevent duplicate deliveries when the same
   * webhook is triggered multiple times in quick succession.
   */
  async sendWebhook(url: string, event: string, payload: any, options?: any): Promise<void> {
    // Use url + event as idempotent jobId to deduplicate rapid-fire triggers
    const jobId = `webhook:${url}:${event}`;
    await this.webhookQueue.addUnique(jobId, {
      type: 'send-webhook',
      url,
      event,
      payload,
      ...options,
    }, {
      priority: 5, // Higher priority for webhooks
    });
  }

  /**
   * Queue order processing
   */
  async processOrder(orderId: string, data: any): Promise<void> {
    await this.orderQueue.add({
      type: 'process-order',
      orderId,
      ...data,
    });
  }

  /**
   * Setup all processors
   */
  setupProcessors(handlers: {
    email?: (job: Job) => Promise<any>;
    sms?: (job: Job) => Promise<any>;
    push?: (job: Job) => Promise<any>;
    webhook?: (job: Job) => Promise<any>;
    order?: (job: Job) => Promise<any>;
  }): void {
    if (handlers.email) this.emailQueue.process(handlers.email, 2); // 2 concurrent emails
    if (handlers.sms) this.smsQueue.process(handlers.sms, 5); // 5 concurrent SMS
    if (handlers.push) this.pushQueue.process(handlers.push, 10); // 10 concurrent push
    if (handlers.webhook) this.webhookQueue.process(handlers.webhook, 5);
    if (handlers.order) this.orderQueue.process(handlers.order, 2);
  }

  /**
   * Get all queue statuses
   */
  async getAllStatus() {
    return {
      email: await this.emailQueue.getStatus(),
      sms: await this.smsQueue.getStatus(),
      push: await this.pushQueue.getStatus(),
      webhook: await this.webhookQueue.getStatus(),
      order: await this.orderQueue.getStatus(),
    };
  }

  /**
   * Close all queues
   */
  async closeAll(): Promise<void> {
    await Promise.all([
      this.emailQueue.close(),
      this.smsQueue.close(),
      this.pushQueue.close(),
      this.webhookQueue.close(),
      this.orderQueue.close(),
    ]);
  }
}
