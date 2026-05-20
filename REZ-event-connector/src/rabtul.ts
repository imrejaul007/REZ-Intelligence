/**
 * Event Bus Connector - RABTUL Event Bus Integration
 */

import axios from 'axios';

const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'https://rez-event-bus.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * Publish event to event bus
 */
export async function publishEvent(event: {
  type: string;
  source: string;
  data: Record<string, any>;
  userId?: string;
  sessionId?: string;
  timestamp?: string;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const res = await axios.post(`${EVENT_BUS_URL}/api/events/publish`, {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
      source: event.source || 'rez-intelligence',
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true, eventId: res.data.eventId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// INTELLIGENCE EVENTS
// ============================================

export const intelligenceEvents = {
  /**
   * Publish intent signal
   */
  intentSignal: (userId: string, intent: string, confidence: number, context: Record<string, any>) =>
    publishEvent({ type: 'intelligence.intent', data: { userId, intent, confidence, context } }),

  /**
   * Publish churn prediction
   */
  churnPrediction: (userId: string, probability: number, factors: string[]) =>
    publishEvent({ type: 'intelligence.churn', data: { userId, probability, factors } }),

  /**
   * Publish LTV update
   */
  ltvUpdate: (userId: string, ltv: number, tier: string) =>
    publishEvent({ type: 'intelligence.ltv', data: { userId, ltv, tier } }),

  /**
   * Publish segment change
   */
  segmentChange: (userId: string, segment: string, action: 'entered' | 'exited') =>
    publishEvent({ type: 'commerce.segment', data: { userId, segment, action } }),

  /**
   * Publish recommendation event
   */
  recommendation: (userId: string, type: string, items: string[]) =>
    publishEvent({ type: 'commerce.recommendation', data: { userId, type, items } }),
};

// ============================================
// COMMERCE EVENTS
// ============================================

export const commerceEvents = {
  /**
   * Publish order completed
   */
  orderCompleted: (orderId: string, userId: string, total: number) =>
    publishEvent({ type: 'commerce.order_completed', data: { orderId, userId, total } }),

  /**
   * Publish cart abandoned
   */
  cartAbandoned: (userId: string, cartValue: number, items: string[]) =>
    publishEvent({ type: 'commerce.cart_abandoned', data: { userId, cartValue, items } }),

  /**
   * Publish checkout started
   */
  checkoutStarted: (userId: string, cartValue: number) =>
    publishEvent({ type: 'commerce.checkout_started', data: { userId, cartValue } }),

  /**
   * Publish product viewed
   */
  productViewed: (userId: string, productId: string, category: string) =>
    publishEvent({ type: 'commerce.product_viewed', data: { userId, productId, category } }),

  /**
   * Publish search event
   */
  searchPerformed: (userId: string, query: string, resultsCount: number) =>
    publishEvent({ type: 'commerce.search', data: { userId, query, resultsCount } }),
};

// ============================================
// ENGAGEMENT EVENTS
// ============================================

export const engagementEvents = {
  /**
   * Publish page view
   */
  pageView: (userId: string, page: string, duration?: number) =>
    publishEvent({ type: 'engagement.page_view', data: { userId, page, duration } }),

  /**
   * Publish notification sent
   */
  notificationSent: (userId: string, channel: string, type: string) =>
    publishEvent({ type: 'engagement.notification_sent', data: { userId, channel, type } }),

  /**
   * Publish notification opened
   */
  notificationOpened: (userId: string, notificationId: string) =>
    publishEvent({ type: 'engagement.notification_opened', data: { userId, notificationId } }),

  /**
   * Publish QR scan
   */
  qrScanned: (userId: string, qrId: string, source: string) =>
    publishEvent({ type: 'engagement.qr_scan', data: { userId, qrId, source } }),
};

// ============================================
// SUPPORT EVENTS
// ============================================

export const supportEvents = {
  /**
   * Publish ticket created
   */
  ticketCreated: (ticketId: string, userId: string, category: string, priority: string) =>
    publishEvent({ type: 'support.ticket_created', data: { ticketId, userId, category, priority } }),

  /**
   * Publish ticket resolved
   */
  ticketResolved: (ticketId: string, resolutionTime: number) =>
    publishEvent({ type: 'support.ticket_resolved', data: { ticketId, resolutionTime } }),

  /**
   * Publish CSAT submitted
   */
  csatSubmitted: (ticketId: string, userId: string, score: number) =>
    publishEvent({ type: 'support.csat', data: { ticketId, userId, score } }),
};

// ============================================
// IDENTITY EVENTS
// ============================================

export const identityEvents = {
  /**
   * Publish user registered
   */
  userRegistered: (userId: string, source: string) =>
    publishEvent({ type: 'identity.registered', data: { userId, source } }),

  /**
   * Publish user logged in
   */
  userLoggedIn: (userId: string, deviceId?: string) =>
    publishEvent({ type: 'identity.logged_in', data: { userId, deviceId } }),

  /**
   * Publish identities linked
   */
  identitiesLinked: (userId: string, identities: string[]) =>
    publishEvent({ type: 'identity.linked', data: { userId, identities } }),
};

export const eventBusRABTUL = {
  publishEvent,
  intelligence: intelligenceEvents,
  commerce: commerceEvents,
  engagement: engagementEvents,
  support: supportEvents,
  identity: identityEvents,
};

export default eventBusRABTUL;
