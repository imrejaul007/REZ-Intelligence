import { logger } from '../utils/logger.js';

import config from '../config/index.js';
import type { SegmentEventPayload, SegmentEventType } from '../types/index.js';

interface WebhookDeliveryResult {
  endpoint: string;
  success: boolean;
  statusCode?: number;
  error?: string;
  deliveredAt: string;
  attempts?: number;
}

interface WebhookBatchResult {
  total: number;
  successful: number;
  failed: number;
  results: WebhookDeliveryResult[];
}

// Queue for async webhook delivery
const webhookQueue: SegmentEventPayload[] = [];
let isProcessing = false;
let processingInterval: ReturnType<typeof setInterval> | null = null;

// Maximum retries for failed webhooks
const MAX_RETRIES = 3;

// Webhook retry tracking
const retryTracker: Map<string, { attempts: number; lastAttempt: string }> = new Map();

export function startWebhookProcessor(): void {
  if (processingInterval) {
    return;
  }

  processingInterval = setInterval(processWebhookQueue, 5000);
  logger.info('Webhook processor started');
}

export function stopWebhookProcessor(): void {
  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
  }
  logger.info('Webhook processor stopped');
}

async function processWebhookQueue(): Promise<void> {
  if (isProcessing || webhookQueue.length === 0) {
    return;
  }

  isProcessing = true;

  try {
    while (webhookQueue.length > 0) {
      const payload = webhookQueue.shift();
      if (payload) {
        await deliverWebhook(payload);
      }
    }
  } finally {
    isProcessing = false;
  }
}

async function deliverWebhook(payload: SegmentEventPayload): Promise<WebhookDeliveryResult> {
  const endpoints = config.webhooks.endpoints;
  const results: WebhookDeliveryResult[] = [];

  for (const endpoint of endpoints) {
    const result = await attemptWebhookDelivery(endpoint, payload);
    results.push(result);
  }

  // Return the first result (or a summary if multiple)
  const firstResult = results[0] || {
    endpoint: 'none',
    success: false,
    error: 'No endpoints configured',
    deliveredAt: new Date().toISOString()
  };

  if (!firstResult.success && firstResult.attempts !== undefined) {
    // Track for retry
    const key = `${payload.userId}:${payload.segmentId}:${payload.eventType}`;
    const attempts = (retryTracker.get(key)?.attempts || 0) + 1;

    if (attempts < MAX_RETRIES) {
      retryTracker.set(key, { attempts, lastAttempt: new Date().toISOString() });
      // Re-queue for retry
      webhookQueue.push(payload);
    } else {
      retryTracker.delete(key);
      logger.error(`Webhook delivery failed after ${MAX_RETRIES} attempts for ${key}`);
    }
  } else {
    // Clear retry tracking on success
    const key = `${payload.userId}:${payload.segmentId}:${payload.eventType}`;
    retryTracker.delete(key);
  }

  return firstResult;
}

async function attemptWebhookDelivery(
  endpoint: string,
  payload: SegmentEventPayload
): Promise<WebhookDeliveryResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Source': 'rez-realtime-segments',
        'X-Webhook-Timestamp': new Date().toISOString(),
        'X-Event-Type': payload.eventType
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    const duration = Date.now() - startTime;

    if (response.ok) {
      logger.info(`Webhook delivered successfully to ${endpoint} in ${duration}ms`);
      return {
        endpoint,
        success: true,
        statusCode: response.status,
        deliveredAt: new Date().toISOString()
      };
    } else {
      logger.warn(`Webhook delivery failed to ${endpoint}: ${response.status}`);
      return {
        endpoint,
        success: false,
        statusCode: response.status,
        deliveredAt: new Date().toISOString()
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error(`Webhook delivery error to ${endpoint} after ${duration}ms: ${errorMessage}`);

    return {
      endpoint,
      success: false,
      error: errorMessage,
      deliveredAt: new Date().toISOString()
    };
  }
}

// Queue a webhook event for delivery
export function queueWebhook(payload: SegmentEventPayload): void {
  webhookQueue.push(payload);
  logger.info(`Webhook queued: ${payload.eventType} for user ${payload.userId} in segment ${payload.segmentId}`);
}

// Emit user entered segment event
export function emitUserEnteredSegment(
  userId: string,
  segmentId: string,
  segmentName: string,
  previousMembership: boolean
): void {
  const payload: SegmentEventPayload = {
    eventType: 'USER_ENTERED_SEGMENT',
    userId,
    segmentId,
    segmentName,
    timestamp: new Date().toISOString(),
    previousMembership,
    currentMembership: true
  };

  queueWebhook(payload);
}

// Emit user exited segment event
export function emitUserExitedSegment(
  userId: string,
  segmentId: string,
  segmentName: string,
  previousMembership: boolean
): void {
  const payload: SegmentEventPayload = {
    eventType: 'USER_EXITED_SEGMENT',
    userId,
    segmentId,
    segmentName,
    timestamp: new Date().toISOString(),
    previousMembership,
    currentMembership: false
  };

  queueWebhook(payload);
}

// Emit batch segment events
export async function emitBatchSegmentEvents(
  events: Array<{
    userId: string;
    segmentId: string;
    segmentName: string;
    eventType: SegmentEventType;
    previousMembership: boolean;
  }>
): Promise<WebhookBatchResult> {
  const results: WebhookDeliveryResult[] = [];
  let successful = 0;
  let failed = 0;

  for (const event of events) {
    const payload: SegmentEventPayload = {
      eventType: event.eventType,
      userId: event.userId,
      segmentId: event.segmentId,
      segmentName: event.segmentName,
      timestamp: new Date().toISOString(),
      previousMembership: event.previousMembership,
      currentMembership: event.eventType === 'USER_ENTERED_SEGMENT'
    };

    const result = await attemptWebhookDelivery(config.webhooks.endpoints[0] || '', payload);
    results.push(result);

    if (result.success) {
      successful++;
    } else {
      failed++;
    }
  }

  return {
    total: events.length,
    successful,
    failed,
    results
  };
}

// Get queue status
export function getQueueStatus(): {
  queued: number;
  processing: boolean;
  retryTrackerSize: number;
} {
  return {
    queued: webhookQueue.length,
    processing: isProcessing,
    retryTrackerSize: retryTracker.size
  };
}

// Get pending webhooks for a specific user
export function getPendingWebhooksForUser(userId: string): SegmentEventPayload[] {
  return webhookQueue.filter(w => w.userId === userId);
}

// Clear webhook queue
export function clearWebhookQueue(): number {
  const size = webhookQueue.length;
  webhookQueue.length = 0;
  return size;
}

export default {
  startWebhookProcessor,
  stopWebhookProcessor,
  queueWebhook,
  emitUserEnteredSegment,
  emitUserExitedSegment,
  emitBatchSegmentEvents,
  getQueueStatus,
  getPendingWebhooksForUser,
  clearWebhookQueue
};
