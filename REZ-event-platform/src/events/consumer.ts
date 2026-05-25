import { Queue, Worker, Job } from 'bullmq';
import { getRedisClient, config } from '../config';
import { Event, EventType, logger, BaseEvent } from './schema-registry';
import { EventEmitter } from './emitter';
import { EventStore, DeadLetterEvent } from '../models/event-store';
import {
  markEventProcessingStarted,
  markEventCompleted,
  markEventFailedByTracker,
  moveEventToDlq,
  alertOnEventFailure,
} from '../middleware/eventTracking';

// Queue instances
const queues: Map<string, Queue> = new Map();
const workers: Map<string, Worker> = new Map();

// Dead letter queue configuration
const DEAD_LETTER_QUEUE = 'dead-letter-queue';

/**
 * Get or create a queue for an event type
 */
export function getEventQueue(eventType: string): Queue | undefined {
  return queues.get(eventType);
}

/**
 * Create a queue for an event type
 */
function createQueue(eventType: string): Queue {
  const queueName = `events-${eventType.replace('.', '-')}`;
  const redis = getRedisClient();

  if (!redis) {
    throw new Error('Redis client not initialized');
  }

  const queue = new Queue(queueName, {
    connection: redis,
    defaultJobOptions: {
      attempts: config.bullmq.maxRetries,
      backoff: {
        type: 'exponential',
        delay: config.bullmq.retryDelay,
      },
      removeOnComplete: 100,
      removeOnFail: false,
    },
  });

  queues.set(eventType, queue);
  logger.info('Queue created', { eventType, queueName });

  return queue;
}

/**
 * Initialize all event queues
 */
export async function initializeQueues(): Promise<void> {
  // Create queues for each event type
  Object.values(EventType).forEach(type => {
    createQueue(type);
  });

  // Create dead letter queue
  const redis = getRedisClient();
  if (redis && config.events.enableDeadLetterQueue) {
    new Queue(DEAD_LETTER_QUEUE, {
      connection: redis,
    });
    logger.info('Dead letter queue created', { queueName: DEAD_LETTER_QUEUE });
  }
}

/**
 * Move failed job to dead letter queue
 */
async function moveToDeadLetter(job: Job, error: Error): Promise<void> {
  if (!config.events.enableDeadLetterQueue) {
    logger.warn('Dead letter queue disabled, job will be discarded', { jobId: job.id });
    return;
  }

  try {
    const redis = getRedisClient();
    if (!redis) {
      logger.error('Redis not available for dead letter');
      return;
    }

    const dlq = new Queue(DEAD_LETTER_QUEUE, { connection: redis });

    const jobData = job.data as { event: Event; publishedAt: string };

    await dlq.add('failed-event', {
      originalJobId: job.id,
      event: jobData.event,
      error: error.message,
      failedAt: new Date().toISOString(),
      attemptsMade: job.attemptsMade,
    });

    logger.info('Event moved to dead letter queue', {
      jobId: job.id,
      eventType: jobData.event?.type,
    });
  } catch (dlqError) {
    logger.error('Failed to move event to dead letter queue', {
      jobId: job.id,
      error: dlqError instanceof Error ? dlqError.message : 'Unknown',
    });
  }
}

/**
 * Process inventory.low events
 */
async function handleInventoryLow(job: Job): Promise<void> {
  const { event } = job.data as { event: Event; publishedAt: string };

  logger.info('Processing inventory.low event', {
    jobId: job.id,
    eventId: event.id,
    inventoryId: (event as unknown).payload?.inventoryId,
  });

  // ReZ Mind integration stub
  // TODO: Implement ReZ Mind AI analysis
  // - Analyze inventory patterns
  // - Predict restocking needs
  // - Generate reorder recommendations

  logger.info('inventory.low event processed', {
    eventId: event.id,
    // Analysis results would go here
  });
}

/**
 * Process order.completed events
 */
async function handleOrderCompleted(job: Job): Promise<void> {
  const { event } = job.data as { event: Event; publishedAt: string };

  logger.info('Processing order.completed event', {
    jobId: job.id,
    eventId: event.id,
    orderId: (event as unknown).payload?.orderId,
    total: (event as unknown).payload?.total,
  });

  // ReZ Mind integration stub
  // TODO: Implement ReZ Mind AI analysis
  // - Analyze purchase patterns
  // - Update customer profiles
  // - Trigger fulfillment workflows
  // - Generate analytics data

  logger.info('order.completed event processed', {
    eventId: event.id,
    // Analysis results would go here
  });
}

/**
 * Process payment.success events
 */
async function handlePaymentSuccess(job: Job): Promise<void> {
  const { event } = job.data as { event: Event; publishedAt: string };

  logger.info('Processing payment.success event', {
    jobId: job.id,
    eventId: event.id,
    paymentId: (event as unknown).payload?.paymentId,
    amount: (event as unknown).payload?.amount,
  });

  // ReZ Mind integration stub
  // TODO: Implement ReZ Mind AI analysis
  // - Fraud detection
  // - Revenue tracking
  // - Payment analytics
  // - Customer credit assessment

  logger.info('payment.success event processed', {
    eventId: event.id,
    // Analysis results would go here
  });
}

/**
 * Process ad.impression events
 */
async function handleAdImpression(job: Job): Promise<void> {
  const { event } = job.data as { event: Event; publishedAt: string };
  const payload = (event as unknown).payload;

  logger.info('Processing ad.impression event', {
    jobId: job.id,
    eventId: event.id,
    adId: payload?.adId,
    campaignId: payload?.campaignId,
  });

  // Store for analytics - ad.impression events are tracked for ROAS calculation
  // analytics-events service will consume this and store in appevents collection

  logger.info('ad.impression event processed', { eventId: event.id });
}

/**
 * Process ad.click events
 */
async function handleAdClick(job: Job): Promise<void> {
  const { event } = job.data as { event: Event; publishedAt: string };
  const payload = (event as unknown).payload;

  logger.info('Processing ad.click event', {
    jobId: job.id,
    eventId: event.id,
    adId: payload?.adId,
    campaignId: payload?.campaignId,
  });

  logger.info('ad.click event processed', { eventId: event.id });
}

/**
 * Process conversion events
 */
async function handleConversion(job: Job): Promise<void> {
  const { event } = job.data as { event: Event; publishedAt: string };
  const payload = (event as unknown).payload;

  logger.info('Processing conversion event', {
    jobId: job.id,
    eventId: event.id,
    campaignId: payload?.campaignId,
    value: payload?.value,
  });

  // Conversion events are critical for ROAS calculation
  // Store in analytics for cross-service reporting

  logger.info('conversion event processed', { eventId: event.id });
}

/**
 * Process campaign.created events
 */
async function handleCampaignCreated(job: Job): Promise<void> {
  const { event } = job.data as { event: Event; publishedAt: string };
  const payload = (event as unknown).payload;

  logger.info('Processing campaign.created event', {
    jobId: job.id,
    eventId: event.id,
    campaignId: payload?.campaignId,
    campaignName: payload?.campaignName,
  });

  logger.info('campaign.created event processed', { eventId: event.id });
}

/**
 * Process voucher.issued events
 */
async function handleVoucherIssued(job: Job): Promise<void> {
  const { event } = job.data as { event: Event; publishedAt: string };
  const payload = (event as unknown).payload;

  logger.info('Processing voucher.issued event', {
    jobId: job.id,
    eventId: event.id,
    voucherId: payload?.voucherId,
    campaignId: payload?.campaignId,
  });

  logger.info('voucher.issued event processed', { eventId: event.id });
}

/**
 * Process notification.sent events
 */
async function handleNotificationSent(job: Job): Promise<void> {
  const { event } = job.data as { event: Event; publishedAt: string };
  const payload = (event as unknown).payload;

  logger.info('Processing notification.sent event', {
    jobId: job.id,
    eventId: event.id,
    notificationId: payload?.notificationId,
    channel: payload?.channel,
  });

  logger.info('notification.sent event processed', { eventId: event.id });
}

/**
 * Process notification.opened events
 */
async function handleNotificationOpened(job: Job): Promise<void> {
  const { event } = job.data as { event: Event; publishedAt: string };
  const payload = (event as unknown).payload;

  logger.info('Processing notification.opened event', {
    jobId: job.id,
    eventId: event.id,
    notificationId: payload?.notificationId,
    channel: payload?.channel,
  });

  logger.info('notification.opened event processed', { eventId: event.id });
}

/**
 * Create a worker for an event type
 */
function createWorker(eventType: string, handler: (job: Job) => Promise<void>): Worker {
  const queueName = `events-${eventType.replace('.', '-')}`;
  const redis = getRedisClient();

  if (!redis) {
    throw new Error('Redis client not initialized');
  }

  const worker = new Worker(queueName, async (job: Job) => {
    const emitter = EventEmitter.getInstance();

    try {
      // Set correlation ID for tracing
      const jobData = job.data as { event: Event };
      if (jobData.event?.correlationId) {
        emitter.setCorrelationId(jobData.event.correlationId);
      }

      // Mark event as processing (both in event store and tracking)
      await markEventProcessing(jobData.event.id);
      await markEventProcessingStarted(jobData.event.id, worker.name);

      // Process the event
      await handler(job);

      // Mark event as processed (both in event store and tracking)
      await markEventProcessed(jobData.event.id);
      await markEventCompleted(jobData.event.id, worker.name);

    } catch (error) {
      // Re-throw to trigger BullMQ retry handling
      throw error;
    } finally {
      // Clear correlation context
      emitter.clearCorrelationId();
    }
  }, {
    connection: redis,
    concurrency: config.bullmq.concurrency,
    limiter: {
      max: 100,
      duration: 1000,
    },
  });

  worker.on('completed', (job) => {
    logger.debug('Job completed', {
      jobId: job.id,
      eventType,
      duration: job.finishedOn ? job.finishedOn - job.timestamp : undefined,
    });
  });

  worker.on('failed', async (job, error) => {
    logger.error('Job failed', {
      jobId: job?.id,
      eventType,
      error: error.message,
      attemptsMade: job?.attemptsMade,
    });

    // Update tracking with failure
    if (job?.data?.event?.id) {
      await markEventFailedByTracker(
        job.data.event.id,
        error.message,
        true // increment retry count
      );
    }

    // Move to dead letter queue if max retries reached
    if (job && job.attemptsMade >= config.bullmq.maxRetries) {
      await moveToDeadLetter(job, error);
      if (job.data?.event?.id) {
        await moveEventToDlq(job.data.event.id, error.message);
      }
      // Trigger alert check after DLQ addition
      setImmediate(() => {
        alertOnEventFailure().catch((err) => {
          logger.error('Alert check failed after DLQ move', {
            error: err instanceof Error ? err.message : 'Unknown',
          });
        });
      });
    }
  });

  worker.on('error', (error) => {
    logger.error('Worker error', { eventType, error: error.message });
  });

  workers.set(eventType, worker);
  logger.info('Worker created', { eventType, queueName });

  return worker;
}

/**
 * Mark event as processing
 */
async function markEventProcessing(eventId: string): Promise<void> {
  try {
    await EventStore.updateOne(
      { eventId },
      {
        $set: {
          processedAt: new Date(),
          status: 'processing',
        },
      }
    );
  } catch (error) {
    logger.warn('Failed to mark event processing', { eventId, error });
  }
}

/**
 * Mark event as processed
 */
async function markEventProcessed(eventId: string): Promise<void> {
  try {
    await EventStore.updateOne(
      { eventId },
      {
        $set: {
          processed: true,
          status: 'completed',
        },
      }
    );
  } catch (error) {
    logger.warn('Failed to mark event processed', { eventId, error });
  }
}

/**
 * Mark event as failed
 */
async function markEventFailed(eventId: string, error: string): Promise<void> {
  try {
    await EventStore.updateOne(
      { eventId },
      {
        $set: {
          status: 'failed',
          error,
        },
      }
    );
  } catch (err) {
    logger.warn('Failed to mark event failed', { eventId, error });
  }
}

/**
 * Initialize all workers
 */
export async function initializeWorkers(): Promise<void> {
  createWorker(EventType.INVENTORY_LOW, handleInventoryLow);
  createWorker(EventType.ORDER_COMPLETED, handleOrderCompleted);
  createWorker(EventType.PAYMENT_SUCCESS, handlePaymentSuccess);
  // Ad/Growth Event Workers
  createWorker(EventType.AD_IMPRESSION, handleAdImpression);
  createWorker(EventType.AD_CLICK, handleAdClick);
  createWorker(EventType.CONVERSION, handleConversion);
  createWorker(EventType.CAMPAIGN_CREATED, handleCampaignCreated);
  createWorker(EventType.VOUCHER_ISSUED, handleVoucherIssued);
  createWorker(EventType.NOTIFICATION_SENT, handleNotificationSent);
  createWorker(EventType.NOTIFICATION_OPENED, handleNotificationOpened);

  logger.info('All workers initialized');
}

/**
 * Graceful shutdown
 */
export async function shutdownWorkers(): Promise<void> {
  logger.info('Shutting down workers...');

  const closePromises: Promise<void>[] = [];

  workers.forEach((worker, eventType) => {
    closePromises.push(
      worker.close().then(() => {
        logger.info('Worker closed', { eventType });
      })
    );
  });

  queues.forEach((queue, eventType) => {
    closePromises.push(
      queue.close().then(() => {
        logger.info('Queue closed', { eventType });
      })
    );
  });

  await Promise.all(closePromises);
  logger.info('All workers and queues closed');
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<Record<string, {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}>> {
  const stats: Record<string, { waiting: number; active: number; completed: number; failed: number }> = {};

  for (const [eventType, queue] of queues.entries()) {
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
    stats[eventType] = counts as { waiting: number; active: number; completed: number; failed: number };
  }

  return stats;
}
