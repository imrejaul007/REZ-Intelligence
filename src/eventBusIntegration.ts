import { logger } from './utils/logger';

/**
 * Event Bus Integration for REZ Intelligence Services
 *
 * This module provides easy Event Bus integration for all intelligence services.
 * Import and use in unknown service to emit events.
 */

import axios from 'axios';

// ============================================================================
// Configuration
// ============================================================================

const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'http://localhost:4025';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'your-internal-token';

// ============================================================================
// Types
// ============================================================================

export interface REZEvent {
  type: string;
  userId?: string;
  merchantId?: string;
  correlationId?: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

export interface EventResponse {
  id: string;
  status: 'published' | 'failed';
}

// ============================================================================
// Event Emitter Class
// ============================================================================

export class EventEmitter {
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  /**
   * Emit an event to the Event Bus
   */
  async emit(event: Omit<REZEvent, 'timestamp'>): Promise<EventResponse | null> {
    const fullEvent: REZEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };

    try {
      const response = await axios.post(
        `${EVENT_BUS_URL}/api/events`,
        fullEvent,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN,
            'X-Service-Name': this.serviceName
          },
          timeout: 5000
        }
      );

      logger.info(`[${this.serviceName}] Event emitted: ${event.type}`);
      return response.data;
    } catch (error) {
      console.error(`[${this.serviceName}] Failed to emit event ${event.type}:`, error.message);
      return null;
    }
  }

  // ============================================
  // Commerce Events
  // ============================================

  async orderCreated(orderId: string, userId: string, merchantId: string, total: number): Promise<void> {
    await this.emit({
      type: 'commerce.order.created',
      userId,
      merchantId,
      data: { orderId, total }
    });
  }

  async orderCompleted(orderId: string, userId: string, merchantId: string, total: number): Promise<void> {
    await this.emit({
      type: 'commerce.order.completed',
      userId,
      merchantId,
      data: { orderId, total }
    });
  }

  async paymentCompleted(paymentId: string, orderId: string, amount: number): Promise<void> {
    await this.emit({
      type: 'commerce.payment.completed',
      data: { paymentId, orderId, amount }
    });
  }

  // ============================================
  // Engagement Events
  // ============================================

  async searchPerformed(userId: string, query: string, resultsCount: number): Promise<void> {
    await this.emit({
      type: 'engagement.search.performed',
      userId,
      data: { query, resultsCount }
    });
  }

  async productViewed(userId: string, productId: string, category: string): Promise<void> {
    await this.emit({
      type: 'engagement.product.viewed',
      userId,
      data: { productId, category }
    });
  }

  async pageViewed(userId: string, page: string): Promise<void> {
    await this.emit({
      type: 'engagement.page.viewed',
      userId,
      data: { page }
    });
  }

  // ============================================
  // Intelligence Events
  // ============================================

  async churnRiskCalculated(userId: string, riskScore: number): Promise<void> {
    await this.emit({
      type: 'intelligence.churn.risk_calculated',
      userId,
      data: { riskScore }
    });
  }

  async ltvCalculated(userId: string, ltv: number): Promise<void> {
    await this.emit({
      type: 'intelligence.customer.ltv_calculated',
      userId,
      data: { ltv }
    });
  }

  async segmentUpdated(userId: string, segments: string[]): Promise<void> {
    await this.emit({
      type: 'intelligence.segment.updated',
      userId,
      data: { segments }
    });
  }

  // ============================================
  // Support Events
  // ============================================

  async ticketCreated(ticketId: string, userId: string, type: string): Promise<void> {
    await this.emit({
      type: 'support.ticket.created',
      userId,
      data: { ticketId, type }
    });
  }

  async ticketResolved(ticketId: string, userId: string): Promise<void> {
    await this.emit({
      type: 'support.ticket.resolved',
      userId,
      data: { ticketId }
    });
  }

  // ============================================
  // Loyalty Events
  // ============================================

  async pointsEarned(userId: string, points: number, source: string): Promise<void> {
    await this.emit({
      type: 'loyalty.points.earned',
      userId,
      data: { points, source }
    });
  }

  async pointsRedeemed(userId: string, points: number, reward: string): Promise<void> {
    await this.emit({
      type: 'loyalty.points.redeemed',
      userId,
      data: { points, reward }
    });
  }

  // ============================================
  // Identity Events
  // ============================================

  async userRegistered(userId: string, source: string): Promise<void> {
    await this.emit({
      type: 'identity.user.registered',
      userId,
      data: { source }
    });
  }

  async userLoggedIn(userId: string, deviceId: string): Promise<void> {
    await this.emit({
      type: 'identity.user.logged_in',
      userId,
      data: { deviceId }
    });
  }
}

// ============================================================================
// Singleton Factory
// ============================================================================

const emitters = new Map<string, EventEmitter>();

export function getEventEmitter(serviceName: string): EventEmitter {
  if (!emitters.has(serviceName)) {
    emitters.set(serviceName, new EventEmitter(serviceName));
  }
  return emitters.get(serviceName)!;
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  EventEmitter,
  getEventEmitter
};
