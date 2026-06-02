const Queue = require('bull');
const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

class QueueManager {
  constructor() {
    // Use REDIS_URL if provided, otherwise use individual settings
    if (config.redis.url) {
      this.redisConfig = config.redis.url;
    } else {
      this.redisConfig = {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
        maxRetriesPerRequest: null,
      };
    }

    this.queues = {
      notification: null,
      retry: null,
      broadcast: null,
    };

    this.redisClient = null;
    this.processors = new Map();
  }

  async initialize() {
    try {
      this.redisClient = new Redis(this.redisConfig);
      await this.redisClient.ping();

      this.queues.notification = new Queue('notification', {
        redis: this.redisConfig,
        defaultJobOptions: {
          attempts: config.queue.retryAttempts,
          backoff: {
            type: 'exponential',
            delay: config.queue.retryDelay,
          },
          removeOnComplete: 100,
          removeOnFail: 1000,
        },
      });

      this.queues.retry = new Queue('notification-retry', {
        redis: this.redisConfig,
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: true,
        },
      });

      this.queues.broadcast = new Queue('broadcast', {
        redis: this.redisConfig,
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: true,
        },
      });

      this.setupEventListeners();

      logger.info('Queue manager initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize queue manager:', error);
      throw error;
    }
  }

  setupEventListeners() {
    for (const [name, queue] of Object.entries(this.queues)) {
      queue.on('error', (error) => {
        logger.error(`Queue ${name} error:`, error);
      });

      queue.on('failed', (job, error) => {
        logger.error(`Queue ${name} job ${job.id} failed:`, {
          error: error.message,
          attemptsMade: job.attemptsMade,
          data: job.data,
        });
      });

      queue.on('completed', (job, result) => {
        logger.debug(`Queue ${name} job ${job.id} completed:`, result);
      });

      queue.on('stalled', (job) => {
        logger.warn(`Queue ${name} job ${job.id} stalled`);
      });
    }
  }

  async addNotificationJob(data, options = {}) {
    const jobOptions = {
      priority: data.priority === 'high' ? 1 : data.priority === 'low' ? 3 : 2,
      delay: options.delay || 0,
      jobId: data.notificationId,
    };

    return this.queues.notification.add(data, jobOptions);
  }

  async addBroadcastJob(data) {
    return this.queues.broadcast.add(data, {
      jobId: `broadcast_${data.broadcastId}`,
    });
  }

  async addRetryJob(data, delay = config.queue.retryDelay) {
    return this.queues.retry.add(data, {
      delay,
      jobId: `retry_${data.notificationId}_${Date.now()}`,
    });
  }

  async addBulkNotificationJobs(jobs) {
    const jobData = jobs.map(job => ({
      name: job.name || 'notification',
      data: job.data,
      opts: {
        priority: job.data.priority === 'high' ? 1 : 2,
        delay: job.delay || 0,
        jobId: job.data.notificationId,
      },
    }));

    return this.queues.notification.addBulk(jobData);
  }

  processNotifications(concurrency = config.queue.concurrency) {
    if (this.processors.has('notification')) {
      logger.warn('Notification processor already registered');
      return;
    }

    const processor = async (job) => {
      const { handler } = job.data;
      return handler(job.data);
    };

    this.queues.notification.process(concurrency, processor);
    this.processors.set('notification', processor);

    logger.info(`Notification processor registered with concurrency: ${concurrency}`);
  }

  processBroadcast(concurrency = 1) {
    if (this.processors.has('broadcast')) {
      logger.warn('Broadcast processor already registered');
      return;
    }

    const processor = async (job) => {
      const { handler } = job.data;
      return handler(job.data);
    };

    this.queues.broadcast.process(concurrency, processor);
    this.processors.set('broadcast', processor);

    logger.info(`Broadcast processor registered with concurrency: ${concurrency}`);
  }

  async getJobCounts(queueName = 'notification') {
    const queue = this.queues[queueName];
    if (!queue) return null;

    const counts = await queue.getJobCounts();
    return counts;
  }

  async getQueueStats() {
    const stats = {};

    for (const [name, queue] of Object.entries(this.queues)) {
      const counts = await queue.getJobCounts();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();
      const waiting = await queue.getWaiting();
      const delayed = await queue.getDelayed();

      stats[name] = {
        counts,
        recentCompleted: completed.slice(0, 10).map(j => ({
          id: j.id,
          timestamp: j.finishedOn,
        })),
        recentFailed: failed.slice(0, 10).map(j => ({
          id: j.id,
          failedReason: j.failedReason,
          timestamp: j.finishedOn,
        })),
        waitingIds: waiting.slice(0, 10).map(j => j.id),
        delayedIds: delayed.slice(0, 10).map(j => j.id),
      };
    }

    return stats;
  }

  async retryJob(queueName, jobId) {
    const queue = this.queues[queueName];
    if (!queue) return null;

    const job = await queue.getJob(jobId);
    if (!job) return null;

    return job.retry();
  }

  async removeJob(queueName, jobId) {
    const queue = this.queues[queueName];
    if (!queue) return false;

    const job = await queue.getJob(jobId);
    if (!job) return false;

    await job.remove();
    return true;
  }

  async pauseQueue(queueName = 'notification') {
    const queue = this.queues[queueName];
    if (!queue) return false;

    await queue.pause();
    logger.info(`Queue ${queueName} paused`);
    return true;
  }

  async resumeQueue(queueName = 'notification') {
    const queue = this.queues[queueName];
    if (!queue) return false;

    await queue.resume();
    logger.info(`Queue ${queueName} resumed`);
    return true;
  }

  async close() {
    for (const [name, queue] of Object.entries(this.queues)) {
      await queue.close();
      logger.info(`Queue ${name} closed`);
    }

    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
    }

    this.processors.clear();
  }
}

const queueManager = new QueueManager();

module.exports = queueManager;
