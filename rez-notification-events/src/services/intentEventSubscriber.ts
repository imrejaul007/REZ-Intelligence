/**
 * ReZ Mind Intent Event Subscriber
 *
 * Subscribes to the 'rez-mind' Redis channel to receive intent signals
 * from ReZ Mind and triggers appropriate notifications.
 *
 * Events handled:
 * - intent.dormant_user_signals: Lapsed users showing purchase intent
 * - intent.purchase_intent: Users with high purchase intent
 * - intent.abandoned_cart: Cart abandonment signals
 */

import { bullmqRedis } from '../config/redis';
import { logger } from '../config/logger';

const REZ_MIND_CHANNEL = 'rez-mind';

export interface IntentEvent {
  event: string;
  data: {
    userId?: string;
    merchantId?: string;
    storeId?: string;
    intentType?: string;
    category?: string;
    confidence?: number;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
  timestamp: number;
}

let isSubscribed = false;

/**
 * Handle incoming intent events from ReZ Mind
 */
async function handleIntentEvent(event: IntentEvent): Promise<void> {
  const { event: eventType, data, timestamp } = event;

  logger.info(`[IntentSubscriber] Received event: ${eventType}`, {
    userId: data.userId,
    merchantId: data.merchantId,
    intentType: data.intentType,
    confidence: data.confidence,
  });

  switch (eventType) {
    case 'intent.dormant_user_signals':
      await handleDormantUserSignals(data);
      break;
    case 'intent.purchase_intent':
      await handlePurchaseIntent(data);
      break;
    case 'intent.abandoned_cart':
      await handleAbandonedCart(data);
      break;
    case 'insight.dormancy_alert':
      await handleDormancyAlert(data);
      break;
    default:
      logger.debug(`[IntentSubscriber] Unhandled event type: ${eventType}`);
  }
}

/**
 * Handle dormant user showing purchase signals
 */
async function handleDormantUserSignals(data: IntentEvent['data']): Promise<void> {
  const { userId, merchantId, category, confidence, metadata } = data;

  if (!userId || !merchantId) return;

  logger.info('[IntentSubscriber] Dormant user signals detected', {
    userId,
    merchantId,
    category,
    confidence,
  });

  // TODO: Trigger re-engagement notification
  // Could send push notification, email, or SMS based on user preferences
  // Example: "We miss you! Here's 10% off your favorite category"
}

/**
 * Handle high-confidence purchase intent
 */
async function handlePurchaseIntent(data: IntentEvent['data']): Promise<void> {
  const { userId, merchantId, category, confidence } = data;

  if (!userId || !merchantId) return;

  logger.info('[IntentSubscriber] High purchase intent detected', {
    userId,
    merchantId,
    category,
    confidence,
  });

  // TODO: Trigger promotional notification with urgency
  // Example: "Prices going up tomorrow! Complete your purchase now"
}

/**
 * Handle abandoned cart signals
 */
async function handleAbandonedCart(data: IntentEvent['data']): Promise<void> {
  const { userId, merchantId, metadata } = data;

  if (!userId || !merchantId) return;

  logger.info('[IntentSubscriber] Abandoned cart detected', {
    userId,
    merchantId,
    cartValue: metadata?.cartValue,
  });

  // TODO: Trigger cart recovery notification
  // Example: "You left something behind! Complete your order"
}

/**
 * Handle dormancy alerts from cross-app aggregation
 */
async function handleDormancyAlert(data: IntentEvent['data']): Promise<void> {
  const { userId, merchantId, metadata } = data;

  if (!userId || !merchantId) return;

  logger.info('[IntentSubscriber] Dormancy alert', {
    userId,
    merchantId,
    lastActive: metadata?.lastActive,
    daysSinceActive: metadata?.daysSinceActive,
  });

  // TODO: Trigger win-back campaign
}

/**
 * Subscribe to the rez-mind channel
 */
export async function startIntentSubscriber(): Promise<void> {
  if (isSubscribed) {
    logger.warn('[IntentSubscriber] Already subscribed to rez-mind channel');
    return;
  }

  try {
    await bullmqRedis.subscribe(REZ_MIND_CHANNEL);
    isSubscribed = true;

    bullmqRedis.on('message', async (channel: string, message: string) => {
      if (channel !== REZ_MIND_CHANNEL) return;

      try {
        const event = JSON.parse(message) as IntentEvent;
        await handleIntentEvent(event);
      } catch (err) {
        logger.error('[IntentSubscriber] Failed to process event', {
          error: err instanceof Error ? err.message : String(err),
          message: message.substring(0, 200),
        });
      }
    });

    logger.info(`[IntentSubscriber] Subscribed to ${REZ_MIND_CHANNEL} channel`);
  } catch (err) {
    logger.error('[IntentSubscriber] Failed to subscribe', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Unsubscribe from the rez-mind channel
 */
export async function stopIntentSubscriber(): Promise<void> {
  if (!isSubscribed) return;

  try {
    await bullmqRedis.unsubscribe(REZ_MIND_CHANNEL);
    isSubscribed = false;
    logger.info(`[IntentSubscriber] Unsubscribed from ${REZ_MIND_CHANNEL} channel`);
  } catch (err) {
    logger.error('[IntentSubscriber] Failed to unsubscribe', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
