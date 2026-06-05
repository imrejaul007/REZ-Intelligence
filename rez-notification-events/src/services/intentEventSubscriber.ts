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

// Notification helper functions
async function getUserNotificationPreferences(userId: string): Promise<{ push: boolean; email: boolean; sms: boolean }> {
  // const prefs = await prisma.userNotificationPrefs.findUnique({ where: { userId } });
  // return prefs || { push: true, email: true, sms: true };
  return { push: true, email: true, sms: true }; // Default to all enabled
}

async function sendPushNotification(userId: string, payload: { title: string; body: string; data?: Record<string, unknown> }): Promise<void> {
  const pushServiceUrl = process.env.PUSH_SERVICE_URL || 'http://localhost:8081';
  await fetch(`${pushServiceUrl}/api/push/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...payload }),
  });
}

async function sendEmailNotification(userId: string, payload: { subject: string; body: string }): Promise<void> {
  const emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://localhost:8083';
  await fetch(`${emailServiceUrl}/api/email/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...payload }),
  });
}

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

  // Trigger re-engagement notification based on user preferences
  try {
    const userPrefs = await getUserNotificationPreferences(userId);
    if (userPrefs.push) {
      await sendPushNotification(userId, {
        title: 'We miss you!',
        body: `It's been a while since your last visit. Here's 10% off your favorite ${category}!`,
        data: { type: 're_engagement', category, merchantId, discount: '10%' },
      });
    }
    if (userPrefs.email) {
      await sendEmailNotification(userId, {
        subject: 'We miss you!',
        body: `It's been a while. Here's 10% off your next order.`,
      });
    }
  } catch (error) {
    logger.error('[IntentSubscriber] Re-engagement notification failed', { userId, error });
  }
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

  // Trigger promotional notification with urgency
  try {
    const userPrefs = await getUserNotificationPreferences(userId);
    const urgencyMessage = `⏰ Prices going up tomorrow! Complete your ${category || 'purchase'} now.`;

    if (userPrefs.push) {
      await sendPushNotification(userId, {
        title: '⏰ Limited Time Offer!',
        body: urgencyMessage,
        data: { type: 'promo_urgency', category, merchantId, confidence },
      });
    }
    if (userPrefs.sms) {
      // Send SMS for high-intent users
      const smsServiceUrl = process.env.SMS_SERVICE_URL || 'http://localhost:8084';
      await fetch(`${smsServiceUrl}/api/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: data.metadata?.phone, message: urgencyMessage }),
      });
    }
  } catch (error) {
    logger.error('[IntentSubscriber] Promotional notification failed', { userId, error });
  }
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

  // Trigger cart recovery notification
  try {
    const userPrefs = await getUserNotificationPreferences(userId);
    const cartValue = metadata?.cartValue as number | undefined;
    const cartValueStr = cartValue ? `₹${cartValue.toLocaleString('en-IN')}` : '';

    if (userPrefs.push) {
      await sendPushNotification(userId, {
        title: '🛒 You left something behind!',
        body: `Complete your order${cartValueStr ? ` of ${cartValueStr}` : ''} before items run out.`,
        data: { type: 'cart_recovery', merchantId, cartId: metadata?.cartId },
      });
    }
    if (userPrefs.email && cartValue && cartValue > 500) {
      // Send email for high-value carts
      await sendEmailNotification(userId, {
        subject: 'Complete your order - items waiting for you!',
        body: `Your cart total is ${cartValueStr}. Complete your purchase now!`,
      });
    }
  } catch (error) {
    logger.error('[IntentSubscriber] Cart recovery notification failed', { userId, error });
  }
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

  // Trigger win-back campaign for dormant users
  try {
    const userPrefs = await getUserNotificationPreferences(userId);
    const daysSinceActive = metadata?.daysSinceActive as number | undefined;
    const daysStr = daysSinceActive ? `${daysSinceActive} days` : 'a while';

    const winBackOffers = [
      '15% off your next order',
      'Free delivery on your next order',
      '₹100 cashback on orders above ₹500',
    ];
    const offer = winBackOffers[Math.floor(Math.random() * winBackOffers.length)];

    if (userPrefs.push) {
      await sendPushNotification(userId, {
        title: `Welcome back! 🎉`,
        body: `We miss you! It's been ${daysStr}. Here's ${offer}!`,
        data: { type: 'win_back', merchantId, offerId: metadata?.offerId },
      });
    }
    if (userPrefs.email) {
      await sendEmailNotification(userId, {
        subject: `We miss you! Here's ${offer}`,
        body: `It's been ${daysStr}. Come back and enjoy ${offer} on your next order.`,
      });
    }
    if (userPrefs.sms) {
      const smsServiceUrl = process.env.SMS_SERVICE_URL || 'http://localhost:8084';
      await fetch(`${smsServiceUrl}/api/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: metadata?.phone,
          message: `ReZ miss you! ${offer}. Order now: https://rez.app/comeback`,
        }),
      });
    }
  } catch (error) {
    logger.error('[IntentSubscriber] Win-back campaign failed', { userId, error });
  }
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
