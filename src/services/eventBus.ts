import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';

/**
 * REZ Agent Orchestrator - Real-Time Event Bus
 *
 * The nervous system of REZ - enables real-time event-driven architecture
 */

export type EventType =
  // Commerce Events
  | 'order.created'
  | 'order.updated'
  | 'order.completed'
  | 'order.cancelled'
  | 'payment.received'
  | 'payment.failed'
  | 'inventory.low'
  | 'inventory.depleted'
  | 'inventory.restocked'
  // Customer Events
  | 'customer.registered'
  | 'customer.active'
  | 'customer.inactive'
  | 'customer.churn_risk'
  | 'customer.retained'
  | 'customer.ltv_changed'
  // Engagement Events
  | 'campaign.launched'
  | 'campaign.performed_poorly'
  | 'campaign.converted'
  | 'offer.redeemed'
  | 'offer.expired'
  | 'loyalty.points_earned'
  | 'loyalty.points_redeemed'
  // Market Events
  | 'weather.changed'
  | 'weather.rain_detected'
  | 'event.detected'
  | 'event.upcoming'
  | 'competitor.discount_detected'
  | 'competitor.pricing_changed'
  | 'demand.spike'
  | 'demand.drop'
  // System Events
  | 'agent.heartbeat'
  | 'agent.error'
  | 'goal.achieved'
  | 'goal.at_risk'
  | 'risk.detected'
  | 'anomaly.detected';

export interface Event<T = unknown> {
  id: string;
  type: EventType;
  source: string;
  target?: string[];
  payload: T;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export type EventHandler<T = unknown> = (event: Event<T>) => Promise<void> | void;

interface Subscription {
  id: string;
  eventType: EventType | '*';
  handler: EventHandler;
  filters?: Record<string, unknown>;
  priority: number;
}

interface EventStore {
  [eventType: string]: Event[];
}

export class EventBus {
  private subscriptions: Map<string, Subscription[]> = new Map();
  private eventStore: EventStore = {};
  private handlers: Map<string, EventHandler[]> = new Map();

  constructor() {
    // Initialize default subscriptions
    this.initializeDefaultSubscriptions();
  }

  /**
   * Initialize default event subscriptions
   */
  private initializeDefaultSubscriptions() {
    // Agent heartbeat monitoring
    this.subscribe('agent.heartbeat', async (event) => {
      logger.info(`Agent heartbeat: ${event.source}`);
    });

    // Anomaly detection
    this.subscribe('anomaly.detected', async (event) => {
      logger.info(`Anomaly detected: ${JSON.stringify(event.payload)}`);
    });

    // Inventory alerts
    this.subscribe('inventory.low', async (event) => {
      logger.info(`Low inventory alert: ${event.source}`);
    });

    // Customer churn risk
    this.subscribe('customer.churn_risk', async (event) => {
      logger.info(`Churn risk for customer: ${event.source}`);
    });
  }

  /**
   * Publish an event
   */
  async publish<T>(event: Omit<Event<T>, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: Event<T> = {
      ...event,
      id: `evt-${randomUUID()}`,
      timestamp: new Date(),
    };

    // Store event
    this.storeEvent(fullEvent);

    // Get matching subscriptions
    const subs = this.getSubscriptions(fullEvent.type);

    // Execute handlers
    const promises = subs.map(async (sub) => {
      if (this.matchesFilters(fullEvent, sub.filters)) {
        try {
          await sub.handler(fullEvent);
        } catch (error) {
          console.error(`Event handler error for ${fullEvent.type}:`, error);
        }
      }
    });

    await Promise.allSettled(promises);

    // Publish to global handlers
    const globalHandlers = this.handlers.get(fullEvent.type) || [];
    for (const handler of globalHandlers) {
      try {
        await handler(fullEvent);
      } catch (error) {
        console.error(`Global handler error for ${fullEvent.type}:`, error);
      }
    }
  }

  /**
   * Subscribe to an event type
   */
  subscribe<T>(
    eventType: EventType | '*',
    handler: EventHandler<T>,
    options?: { filters?: Record<string, unknown>; priority?: number }
  ): string {
    const subscriptionId = `sub-${randomUUID()}`;

    const subscription: Subscription = {
      id: subscriptionId,
      eventType,
      handler: handler as EventHandler,
      filters: options?.filters,
      priority: options?.priority || 0,
    };

    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, []);
    }

    this.subscriptions.get(eventType)!.push(subscription);

    // Sort by priority
    this.subscriptions.get(eventType)!.sort((a, b) => b.priority - a.priority);

    return subscriptionId;
  }

  /**
   * Subscribe to multiple event types
   */
  subscribeMany(
    eventTypes: EventType[],
    handler: EventHandler,
    options?: { filters?: Record<string, unknown>; priority?: number }
  ): string[] {
    return eventTypes.map((type) => this.subscribe(type, handler, options));
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe(subscriptionId: string): boolean {
    for (const [eventType, subs] of this.subscriptions) {
      const index = subs.findIndex((s) => s.id === subscriptionId);
      if (index !== -1) {
        subs.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Add global event handler
   */
  on(eventType: EventType, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  /**
   * Get event history
   */
  getHistory(eventType?: EventType, limit = 100): Event[] {
    if (eventType) {
      return this.eventStore[eventType]?.slice(-limit) || [];
    }

    const allEvents: Event[] = [];
    for (const events of Object.values(this.eventStore)) {
      allEvents.push(...events);
    }

    return allEvents
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Query events
   */
  query(filter: {
    type?: EventType;
    source?: string;
    startTime?: Date;
    endTime?: Date;
    payloadContains?: Record<string, unknown>;
  }): Event[] {
    let events = this.getHistory();

    if (filter.type) {
      events = events.filter((e) => e.type === filter.type);
    }

    if (filter.source) {
      events = events.filter((e) => e.source === filter.source);
    }

    if (filter.startTime) {
      events = events.filter((e) => e.timestamp >= filter.startTime!);
    }

    if (filter.endTime) {
      events = events.filter((e) => e.timestamp <= filter.endTime!);
    }

    if (filter.payloadContains) {
      events = events.filter((e) => {
        const payload = e.payload as Record<string, unknown>;
        return Object.entries(filter.payloadContains!).every(
          ([key, value]) => payload[key] === value
        );
      });
    }

    return events;
  }

  /**
   * Store event
   */
  private storeEvent<T>(event: Event<T>): void {
    if (!this.eventStore[event.type]) {
      this.eventStore[event.type] = [];
    }

    this.eventStore[event.type].push(event);

    // Keep only last 1000 events per type
    if (this.eventStore[event.type].length > 1000) {
      this.eventStore[event.type] = this.eventStore[event.type].slice(-1000);
    }
  }

  /**
   * Get subscriptions for event type
   */
  private getSubscriptions(eventType: EventType): Subscription[] {
    const subs: Subscription[] = [];

    // Exact match
    const exactSubs = this.subscriptions.get(eventType);
    if (exactSubs) {
      subs.push(...exactSubs);
    }

    // Wildcard subscriptions
    const wildcardSubs = this.subscriptions.get('*');
    if (wildcardSubs) {
      subs.push(...wildcardSubs);
    }

    return subs;
  }

  /**
   * Check if event matches filters
   */
  private matchesFilters(event: Event, filters?: Record<string, unknown>): boolean {
    if (!filters) return true;

    for (const [key, value] of Object.entries(filters)) {
      const eventValue = (event as unknown as Record<string, unknown>)[key];
      if (eventValue !== value) return false;
    }

    return true;
  }

  /**
   * Clear event history
   */
  clearHistory(eventType?: EventType): void {
    if (eventType) {
      delete this.eventStore[eventType];
    } else {
      this.eventStore = {};
    }
  }

  /**
   * Get event statistics
   */
  getStats(): {
    totalEvents: number;
    byType: Record<string, number>;
    last24Hours: number;
  } {
    const byType: Record<string, number> = {};
    let totalEvents = 0;
    let last24Hours = 0;

    const cutoff = Date.now() - 24 * 60 * 60 * 1000;

    for (const [type, events] of Object.entries(this.eventStore)) {
      byType[type] = events.length;
      totalEvents += events.length;
      last24Hours += events.filter((e) => e.timestamp.getTime() > cutoff).length;
    }

    return { totalEvents, byType, last24Hours };
  }
}

export const eventBus = new EventBus();

// Pre-defined event creators for common events
export const events = {
  // Commerce
  orderCreated: (merchantId: string, orderId: string, amount: number) =>
    eventBus.publish({
      type: 'order.created',
      source: 'merchant-service',
      target: ['attribution-agent', 'inventory-agent'],
      payload: { merchantId, orderId, amount },
    }),

  inventoryLow: (merchantId: string, productId: string, quantity: number) =>
    eventBus.publish({
      type: 'inventory.low',
      source: 'inventory-service',
      target: ['inventory-agent', 'retention-agent'],
      payload: { merchantId, productId, quantity },
    }),

  // Customer
  customerChurnRisk: (merchantId: string, customerId: string, riskScore: number) =>
    eventBus.publish({
      type: 'customer.churn_risk',
      source: 'churn-agent',
      target: ['retention-agent'],
      payload: { merchantId, customerId, riskScore },
    }),

  // Market
  weatherChanged: (location: string, condition: string, temperature: number) =>
    eventBus.publish({
      type: 'weather.changed',
      source: 'weather-service',
      target: ['demand-signal-agent', 'business-ai'],
      payload: { location, condition, temperature },
    }),

  rainDetected: (location: string) =>
    eventBus.publish({
      type: 'weather.rain_detected',
      source: 'weather-service',
      target: ['demand-signal-agent', 'business-ai'],
      payload: { location },
    }),

  eventDetected: (eventName: string, eventType: string, date: Date) =>
    eventBus.publish({
      type: 'event.detected',
      source: 'event-service',
      target: ['demand-signal-agent', 'business-ai', 'campaign-agent'],
      payload: { eventName, eventType, date },
    }),

  competitorDiscount: (merchantId: string, competitorName: string, discount: number) =>
    eventBus.publish({
      type: 'competitor.discount_detected',
      source: 'competitor-service',
      target: ['competitor-agent', 'business-ai'],
      payload: { merchantId, competitorName, discount },
    }),

  // Demand
  demandSpike: (merchantId: string, location: string, intensity: number) =>
    eventBus.publish({
      type: 'demand.spike',
      source: 'demand-service',
      target: ['demand-signal-agent', 'business-ai'],
      payload: { merchantId, location, intensity },
    }),

  demandDrop: (merchantId: string, location: string, intensity: number) =>
    eventBus.publish({
      type: 'demand.drop',
      source: 'demand-service',
      target: ['demand-signal-agent', 'business-ai', 'campaign-agent'],
      payload: { merchantId, location, intensity },
    }),

  // System
  anomalyDetected: (source: string, type: string, details: unknown) =>
    eventBus.publish({
      type: 'anomaly.detected',
      source,
      payload: { type, details },
    }),

  goalAchieved: (goalId: string, target: number, actual: number) =>
    eventBus.publish({
      type: 'goal.achieved',
      source: 'orchestrator',
      payload: { goalId, target, actual },
    }),
};
