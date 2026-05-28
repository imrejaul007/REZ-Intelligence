import { Queue, Worker, Job } from 'bullmq';
import axios from 'axios';
import { getRedisClient, config } from '../config';
import { Event, EventType, logger, BaseEvent, InventoryLowEventPayloadSchema, OrderCompletedEventPayloadSchema, PaymentSuccessEventPayloadSchema } from './schema-registry';
import { EventEmitter } from './emitter';
import { EventStore, DeadLetterEvent } from '../models/event-store';
import {
  markEventProcessingStarted,
  markEventCompleted,
  markEventFailedByTracker,
  moveEventToDlq,
  alertOnEventFailure,
} from '../middleware/eventTracking';
import {
  analyzeInventoryPatterns,
  analyzeOrderPatterns,
  analyzePaymentRisk,
  analyzeAdPerformance,
  analyzeCampaignPerformance,
  analyzeVoucherPerformance,
  analyzeNotificationPerformance,
  InventoryAnalysisInput,
  OrderAnalysisInput,
  PaymentAnalysisInput,
  AdAnalysisInput,
  CampaignAnalysisInput,
  VoucherAnalysisInput,
  NotificationAnalysisInput,
} from '../services/rez-mind.service';

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

  // Parse and validate payload
  const payloadResult = InventoryLowEventPayloadSchema.safeParse(event.payload);
  if (!payloadResult.success) {
    logger.error('Invalid inventory.low payload', {
      eventId: event.id,
      errors: payloadResult.error.issues,
    });
    throw new Error(`Invalid inventory.low payload: ${payloadResult.error.message}`);
  }

  const payload = payloadResult.data;

  logger.info('Processing inventory.low event', {
    jobId: job.id,
    eventId: event.id,
    inventoryId: payload.inventoryId,
  });

  // Build AI analysis input
  const analysisInput: InventoryAnalysisInput = {
    inventoryId: payload.inventoryId,
    productId: payload.productId,
    productName: payload.productName,
    currentQuantity: payload.currentQuantity,
    threshold: payload.threshold,
    warehouseId: payload.warehouseId,
    sku: payload.sku,
    supplierId: payload.supplierId,
    suggestedReorderQuantity: payload.suggestedReorderQuantity,
    severity: payload.severity,
    eventTimestamp: event.timestamp,
  };

  // Call ReZ Mind AI for inventory pattern analysis
  const analysisResult = await analyzeInventoryPatterns(analysisInput);

  // Log analysis results
  if (analysisResult.success && analysisResult.data) {
    logger.info('Inventory AI analysis completed', {
      eventId: event.id,
      recommendedReorderQuantity: analysisResult.data.recommendedReorderQuantity,
      predictedRestockDate: analysisResult.data.predictedRestockDate,
      urgency: analysisResult.data.urgency,
      confidence: analysisResult.data.confidence,
      recommendations: analysisResult.data.recommendations,
    });

    // PRODUCTION: Trigger restock workflow based on urgency
    if (analysisResult.data.urgency === 'immediate' || payload.severity === 'critical' || payload.severity === 'high') {
      try {
        await triggerRestockWorkflow({
          sku: payload.sku || 'unknown',
          currentStock: payload.currentQuantity,
          recommendedReorderQuantity: analysisResult.data.recommendedReorderQuantity,
          urgency: payload.severity,
          predictedRestockDate: analysisResult.data.predictedRestockDate
        });
      } catch (e) {
        logger.error('Failed to trigger restock workflow:', e);
      }
    }
  } else {
    logger.warn('Inventory AI analysis used fallback', {
      eventId: event.id,
      error: analysisResult.error,
      fallbackActive: analysisResult.fallback,
    });
  }

  logger.info('inventory.low event processed', {
    eventId: event.id,
    recommendedReorderQuantity: analysisResult.data?.recommendedReorderQuantity,
    urgency: analysisResult.data?.urgency,
    confidence: analysisResult.data?.confidence,
    analysisSource: analysisResult.fallback ? 'fallback' : 'rez-mind',
  });
}

/**
 * Process order.completed events
 */
async function handleOrderCompleted(job: Job): Promise<void> {
  const { event } = job.data as { event: Event; publishedAt: string };

  // Parse and validate payload
  const payloadResult = OrderCompletedEventPayloadSchema.safeParse(event.payload);
  if (!payloadResult.success) {
    logger.error('Invalid order.completed payload', {
      eventId: event.id,
      errors: payloadResult.error.issues,
    });
    throw new Error(`Invalid order.completed payload: ${payloadResult.error.message}`);
  }

  const payload = payloadResult.data;

  logger.info('Processing order.completed event', {
    jobId: job.id,
    eventId: event.id,
    orderId: payload.orderId,
    total: payload.total,
  });

  // Build AI analysis input
  const analysisInput: OrderAnalysisInput = {
    orderId: payload.orderId,
    customerId: payload.customerId,
    items: payload.items,
    subtotal: payload.subtotal,
    tax: payload.tax,
    shipping: payload.shipping,
    total: payload.total,
    currency: payload.currency,
    paymentMethod: payload.paymentMethod,
    shippingAddress: payload.shippingAddress,
    eventTimestamp: event.timestamp,
  };

  // Call ReZ Mind AI for order pattern analysis
  const analysisResult = await analyzeOrderPatterns(analysisInput);

  // Log analysis results
  if (analysisResult.success && analysisResult.data) {
    logger.info('Order AI analysis completed', {
      eventId: event.id,
      orderId: payload.orderId,
      customerSegment: analysisResult.data.customerSegment,
      lifetimeValueImpact: analysisResult.data.lifetimeValueImpact,
      churnRisk: analysisResult.data.churnRisk,
      nextBestAction: analysisResult.data.nextBestAction,
      fulfillmentPriority: analysisResult.data.fulfillmentPriority,
      deliveryEstimate: analysisResult.data.deliveryEstimate,
      fraudRisk: analysisResult.data.fraudRisk,
      confidence: analysisResult.data.confidence,
    });

    // PRODUCTION: Trigger workflows based on analysis
    try {
      // Update customer profile with insights
      await updateCustomerProfile(payload.customerId, {
        customerSegment: analysisResult.data.customerSegment,
        churnRisk: analysisResult.data.churnRisk === 'high' ? 1 : analysisResult.data.churnRisk === 'medium' ? 0.5 : 0,
        lifetimeValue: analysisResult.data.lifetimeValueImpact
      });
      // Trigger fulfillment workflow
      await triggerFulfillmentWorkflow(payload.orderId, {
        priority: analysisResult.data.fulfillmentPriority,
        deliveryEstimate: analysisResult.data.deliveryEstimate
      });
      // Process cross-sell recommendations
      if (analysisResult.data.crossSellRecommendations?.length > 0) {
        await processCrossSellRecommendations(payload.customerId, analysisResult.data.crossSellRecommendations);
      }
    } catch (e) {
      logger.error('Failed to trigger workflows after order:', e);
    }
  } else {
    logger.warn('Order AI analysis used fallback', {
      eventId: event.id,
      orderId: payload.orderId,
      error: analysisResult.error,
      fallbackActive: analysisResult.fallback,
    });
  }

  logger.info('order.completed event processed', {
    eventId: event.id,
    orderId: payload.orderId,
    customerSegment: analysisResult.data?.customerSegment,
    churnRisk: analysisResult.data?.churnRisk,
    fulfillmentPriority: analysisResult.data?.fulfillmentPriority,
    confidence: analysisResult.data?.confidence,
    analysisSource: analysisResult.fallback ? 'fallback' : 'rez-mind',
  });
}

/**
 * Process payment.success events
 */
async function handlePaymentSuccess(job: Job): Promise<void> {
  const { event } = job.data as { event: Event; publishedAt: string };

  // Parse and validate payload
  const payloadResult = PaymentSuccessEventPayloadSchema.safeParse(event.payload);
  if (!payloadResult.success) {
    logger.error('Invalid payment.success payload', {
      eventId: event.id,
      errors: payloadResult.error.issues,
    });
    throw new Error(`Invalid payment.success payload: ${payloadResult.error.message}`);
  }

  const payload = payloadResult.data;

  logger.info('Processing payment.success event', {
    jobId: job.id,
    eventId: event.id,
    paymentId: payload.paymentId,
    amount: payload.amount,
  });

  // Build AI analysis input
  const analysisInput: PaymentAnalysisInput = {
    paymentId: payload.paymentId,
    orderId: payload.orderId,
    customerId: payload.customerId,
    amount: payload.amount,
    currency: payload.currency,
    method: payload.method,
    transactionId: payload.transactionId,
    gateway: payload.gateway,
    eventTimestamp: event.timestamp,
  };

  // Call ReZ Mind AI for fraud detection and payment analytics
  const analysisResult = await analyzePaymentRisk(analysisInput);

  // Log analysis results
  if (analysisResult.success && analysisResult.data) {
    logger.info('Payment AI analysis completed', {
      eventId: event.id,
      paymentId: payload.paymentId,
      fraudScore: analysisResult.data.fraudScore,
      riskLevel: analysisResult.data.riskLevel,
      recommendedAction: analysisResult.data.recommendedAction,
      creditScoreImpact: analysisResult.data.creditScoreImpact,
      anomalyScore: analysisResult.data.anomalyScore,
      velocityCheckPassed: analysisResult.data.velocityCheck.passed,
      geoAnomaly: analysisResult.data.geoAnomaly,
      confidence: analysisResult.data.confidence,
    });

    // Handle fraud alerts if detected
    if (analysisResult.data.riskLevel === 'high' || analysisResult.data.riskLevel === 'critical') {
      logger.warn('High risk payment detected', {
        eventId: event.id,
        paymentId: payload.paymentId,
        riskLevel: analysisResult.data.riskLevel,
        fraudIndicators: analysisResult.data.fraudIndicators,
        recommendedAction: analysisResult.data.recommendedAction,
      });
      // PRODUCTION: Trigger fraud alert workflow
      try {
        await triggerFraudAlert({
          paymentId: payload.paymentId,
          customerId: payload.customerId,
          amount: payload.amount,
          riskLevel: analysisResult.data.riskLevel,
          fraudIndicators: analysisResult.data.fraudIndicators
        });
      } catch (e) {
        logger.error('Failed to trigger fraud alert:', e);
      }
    }

    // PRODUCTION: Update payment records with risk scores and track analytics
    try {
      await updatePaymentRiskScore(payload.paymentId, {
        fraudScore: analysisResult.data.fraudScore,
        riskLevel: analysisResult.data.riskLevel,
        recommendedAction: analysisResult.data.recommendedAction
      });
      await trackRevenueAnalytics(payload, {
        fraudRisk: analysisResult.data.fraudScore,
        riskLevel: analysisResult.data.riskLevel
      });
    } catch (e) {
      logger.error('Failed to update payment records:', e);
    }
  } else {
    logger.warn('Payment AI analysis used fallback', {
      eventId: event.id,
      paymentId: payload.paymentId,
      error: analysisResult.error,
      fallbackActive: analysisResult.fallback,
    });
  }

  logger.info('payment.success event processed', {
    eventId: event.id,
    paymentId: payload.paymentId,
    fraudScore: analysisResult.data?.fraudScore,
    riskLevel: analysisResult.data?.riskLevel,
    recommendedAction: analysisResult.data?.recommendedAction,
    confidence: analysisResult.data?.confidence,
    analysisSource: analysisResult.fallback ? 'fallback' : 'rez-mind',
  });
}

/**
 * Process ad.impression events
 */
async function handleAdImpression(job: Job): Promise<void> {
  const { event } = job.data as { event: Event; publishedAt: string };
  const payload = event.payload as Record<string, unknown>;

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
  const payload = event.payload as Record<string, unknown>;

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
  const payload = event.payload as Record<string, unknown>;

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
  const payload = event.payload as Record<string, unknown>;

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
  const payload = event.payload as Record<string, unknown>;

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
  const payload = event.payload as Record<string, unknown>;

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
  const payload = event.payload as Record<string, unknown>;

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

// PRODUCTION: Helper functions for workflow triggers
async function triggerRestockWorkflow(data: {
  sku: string;
  currentStock: number;
  recommendedReorderQuantity: number;
  urgency: string;
  predictedRestockDate: string;
}): Promise<void> {
  try {
    const response = await axios.post(
      `${process.env.ORDER_SERVICE_URL || 'http://localhost:4006'}/api/inventory/restock`,
      data,
      { headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '' }, timeout: 5000 }
    );
    logger.info('Restock workflow triggered', { sku: data.sku, urgency: data.urgency });
  } catch (error) {
    logger.error('Failed to trigger restock workflow:', error);
  }
}

async function updateCustomerProfile(customerId: string, data: {
  customerSegment?: string;
  churnRisk?: number;
  lifetimeValue?: number;
}): Promise<void> {
  try {
    await axios.patch(
      `${process.env.PROFILE_SERVICE_URL || 'http://localhost:4013'}/api/profiles/${customerId}`,
      data,
      { headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '' }, timeout: 5000 }
    );
  } catch (error) {
    logger.error('Failed to update customer profile:', error);
  }
}

async function triggerFulfillmentWorkflow(orderId: string, data: {
  priority: string;
  deliveryEstimate?: string;
}): Promise<void> {
  try {
    await axios.post(
      `${process.env.ORDER_SERVICE_URL || 'http://localhost:4006'}/api/orders/${orderId}/priority`,
      data,
      { headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '' }, timeout: 5000 }
    );
  } catch (error) {
    logger.error('Failed to trigger fulfillment workflow:', error);
  }
}

async function processCrossSellRecommendations(customerId: string, recommendations: string[]): Promise<void> {
  try {
    await axios.post(
      `${process.env.RECOMMENDATION_URL || 'http://localhost:4008'}/api/recommendations/cross-sell`,
      { customerId, recommendations },
      { headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '' }, timeout: 5000 }
    );
  } catch (error) {
    logger.error('Failed to process cross-sell recommendations:', error);
  }
}

async function triggerFraudAlert(data: {
  paymentId: string;
  customerId: string;
  amount: number;
  riskLevel: string;
  fraudIndicators?: string[];
}): Promise<void> {
  try {
    await axios.post(
      `${process.env.FRAUD_SERVICE_URL || 'http://localhost:3007'}/api/alerts`,
      data,
      { headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '' }, timeout: 5000 }
    );
    logger.warn('Fraud alert triggered', { paymentId: data.paymentId, riskLevel: data.riskLevel });
  } catch (error) {
    logger.error('Failed to trigger fraud alert:', error);
  }
}

async function updatePaymentRiskScore(paymentId: string, data: {
  fraudScore: number;
  riskLevel: string;
  recommendedAction: string;
}): Promise<void> {
  try {
    await axios.patch(
      `${process.env.PAYMENT_SERVICE_URL || 'http://localhost:4001'}/api/payments/${paymentId}/risk`,
      data,
      { headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '' }, timeout: 5000 }
    );
  } catch (error) {
    logger.error('Failed to update payment risk score:', error);
  }
}

async function trackRevenueAnalytics(payload: any, data: { fraudRisk?: number; riskLevel?: string }): Promise<void> {
  try {
    await axios.post(
      `${process.env.ANALYTICS_URL || 'http://localhost:4016'}/api/events`,
      { type: 'revenue.analytics', paymentId: payload.paymentId, amount: payload.amount, ...data },
      { headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '' }, timeout: 5000 }
    );
  } catch (error) {
    logger.error('Failed to track revenue analytics:', error);
  }
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
