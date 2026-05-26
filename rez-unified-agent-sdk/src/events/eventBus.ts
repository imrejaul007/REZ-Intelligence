import EventEmitter from 'eventemitter3';
import { randomUUID } from 'crypto';
import type { Logger, EventPayload } from '../types';
import { DEFAULT_TIMEOUT, DEFAULT_RETRY, DEFAULT_CIRCUIT_BREAKER } from '../config';
import type { SDKConfig } from '../types';

// ============================================================================
// Event Types
// ============================================================================

export type EventHandler = (payload: EventPayload) => void | Promise<void>;

export interface Subscription {
  id: string;
  eventType: string;
  handler: EventHandler;
  pattern?: string;
}

export interface EventBusConfig {
  logger?: Logger;
  timeout?: number;
}

// ============================================================================
// In-Memory Event Bus
// ============================================================================

export class EventBus {
  private emitter: EventEmitter;
  private subscriptions: Map<string, Subscription> = new Map();
  private logger: Logger;
  private eventHistory: EventPayload[] = [];
  private maxHistorySize: number;
  private config: EventBusConfig;

  constructor(config: EventBusConfig = {}) {
    this.emitter = new EventEmitter();
    this.logger = config.logger || {
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.log.bind(console),
      debug: console.debug.bind(console),
    };
    this.maxHistorySize = 1000;
    this.config = config;
  }

  /**
   * Subscribe to an event type
   */
  on(eventType: string, handler: EventHandler): () => void {
    const id = `${eventType}:${Date.now()}:${randomUUID().replace(/-/g, '').slice(0, 12)}`;

    const subscription: Subscription = {
      id,
      eventType,
      handler,
    };

    this.subscriptions.set(id, subscription);
    this.emitter.on(eventType, this.createHandlerWrapper(eventType, handler));

    this.logger.debug(`Subscribed to event: ${eventType}`, { subscriptionId: id });

    // Return unsubscribe function
    return () => this.off(id);
  }

  /**
   * Subscribe to an event type only once
   */
  once(eventType: string, handler: EventHandler): () => void {
    const id = `${eventType}:once:${Date.now()}:${randomUUID().replace(/-/g, '').slice(0, 12)}`;

    const subscription: Subscription = {
      id,
      eventType,
      handler,
    };

    this.subscriptions.set(id, subscription);
    this.emitter.once(eventType, this.createHandlerWrapper(eventType, handler));

    this.logger.debug(`Subscribed once to event: ${eventType}`, { subscriptionId: id });

    return () => this.off(id);
  }

  /**
   * Subscribe to event pattern (e.g., 'agent.*')
   */
  onPattern(pattern: string, handler: EventHandler): () => void {
    const id = `pattern:${pattern}:${Date.now()}:${randomUUID().replace(/-/g, '').slice(0, 12)}`;

    const subscription: Subscription = {
      id,
      eventType: pattern,
      handler,
      pattern,
    };

    this.subscriptions.set(id, subscription);
    // For pattern matching, we need to handle this differently
    this.emitter.on(pattern, this.createHandlerWrapper(pattern, handler));

    this.logger.debug(`Subscribed to pattern: ${pattern}`, { subscriptionId: id });

    return () => this.off(id);
  }

  /**
   * Unsubscribe by subscription ID
   */
  off(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    this.emitter.off(subscription.eventType, this.createHandlerWrapper(subscription.eventType, subscription.handler));
    this.subscriptions.delete(subscriptionId);

    this.logger.debug(`Unsubscribed: ${subscription.eventType}`, { subscriptionId });

    return true;
  }

  /**
   * Publish an event
   */
  async emit(eventType: string, payload: unknown, metadata?: Record<string, unknown>): Promise<void> {
    const event: EventPayload = {
      type: eventType,
      payload,
      timestamp: new Date().toISOString(),
      metadata,
    };

    // Store in history
    this.addToHistory(event);

    this.logger.debug(`Emitting event: ${eventType}`, {
      timestamp: event.timestamp,
      payloadSize: JSON.stringify(payload).length,
    });

    try {
      this.emitter.emit(eventType, event);
    } catch (error) {
      this.logger.error(`Error emitting event ${eventType}`, { error });
      throw error;
    }
  }

  /**
   * Get event history
   */
  getHistory(limit?: number): EventPayload[] {
    if (limit) {
      return this.eventHistory.slice(-limit);
    }
    return [...this.eventHistory];
  }

  /**
   * Get subscriptions count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get subscriptions for an event type
   */
  getSubscriptions(eventType?: string): Subscription[] {
    const all = Array.from(this.subscriptions.values());
    if (eventType) {
      return all.filter((s) => s.eventType === eventType);
    }
    return all;
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.emitter.removeAllListeners();
    this.subscriptions.clear();
    this.logger.info('Event bus cleared');
  }

  /**
   * Remove event from history
   */
  private addToHistory(event: EventPayload): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Create handler wrapper with error handling
   */
  private createHandlerWrapper(eventType: string, handler: EventHandler): EventHandler {
    return async (payload: EventPayload) => {
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        this.logger.error(`Error in event handler for ${eventType}`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    };
  }
}

// ============================================================================
// Event Publisher (for external event systems)
// ============================================================================

export interface EventPublisherConfig {
  endpoints?: {
    kafka?: string;
    redis?: string;
   nats?: string;
  };
  logger?: Logger;
}

export class EventPublisher {
  private eventBus: EventBus;
  private logger: Logger;
  private externalEndpoints?: EventPublisherConfig['endpoints'];
  private useExternal: boolean;

  constructor(eventBus: EventBus, config: EventPublisherConfig = {}) {
    this.eventBus = eventBus;
    this.logger = config.logger || {
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.log.bind(console),
      debug: console.debug.bind(console),
    };
    this.externalEndpoints = config.endpoints;
    this.useExternal = !!(config.endpoints?.kafka || config.endpoints?.redis || config.endpoints?.nats);
  }

  /**
   * Publish event to both internal bus and external system
   */
  async publish(
    eventType: string,
    payload: unknown,
    options: {
      source?: string;
      correlationId?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<void> {
    const fullMetadata = {
      ...options.metadata,
      source: options.source,
      correlationId: options.correlationId,
      publishedAt: new Date().toISOString(),
    };

    // Always publish to internal bus
    await this.eventBus.emit(eventType, payload, fullMetadata);

    // Optionally publish to external system
    if (this.useExternal) {
      await this.publishExternal(eventType, payload, fullMetadata);
    }

    this.logger.debug(`Published event: ${eventType}`, {
      hasExternal: this.useExternal,
      metadata: fullMetadata,
    });
  }

  /**
   * Subscribe to events
   */
  on(eventType: string, handler: EventHandler): () => void {
    return this.eventBus.on(eventType, handler);
  }

  /**
   * Subscribe once
   */
  once(eventType: string, handler: EventHandler): () => void {
    return this.eventBus.once(eventType, handler);
  }

  /**
   * Subscribe to pattern
   */
  onPattern(pattern: string, handler: EventHandler): () => void {
    return this.eventBus.onPattern(pattern, handler);
  }

  /**
   * Get event history
   */
  getHistory(limit?: number): EventPayload[] {
    return this.eventBus.getHistory(limit);
  }

  /**
   * Publish to external system (Kafka/Redis/NATS)
   */
  private async publishExternal(
    _eventType: string,
    _payload: unknown,
    _metadata: Record<string, unknown>,
  ): Promise<void> {
    // This would integrate with external event systems
    // For now, just log that external publishing would happen
    this.logger.debug('External event publishing would occur here', {
      kafka: !!this.externalEndpoints?.kafka,
      redis: !!this.externalEndpoints?.redis,
      nats: !!this.externalEndpoints?.nats,
    });

    // TODO: Implement actual external event publishing
    // await publishToKafka(eventType, payload, metadata);
    // Or: await publishToRedis(eventType, payload, metadata);
    // Or: await publishToNATS(eventType, payload, metadata);
  }
}

// ============================================================================
// Event Types Registry
// ============================================================================

export const AGENT_EVENTS = {
  ACTION_STARTED: 'agent.action.started',
  ACTION_COMPLETED: 'agent.action.completed',
  ACTION_FAILED: 'agent.action.failed',
  INTENT_DETECTED: 'agent.intent.detected',
  INTENT_CONFIRMED: 'agent.intent.confirmed',
  DECISION_MADE: 'agent.decision.made',
  ERROR_OCCURRED: 'agent.error.occurred',
} as const;

export const PAYMENT_EVENTS = {
  INITIATED: 'payment.initiated',
  COMPLETED: 'payment.completed',
  FAILED: 'payment.failed',
  REFUNDED: 'payment.refunded',
} as const;

export const ORDER_EVENTS = {
  CREATED: 'order.created',
  CONFIRMED: 'order.confirmed',
  SHIPPED: 'order.shipped',
  DELIVERED: 'order.delivered',
  CANCELLED: 'order.cancelled',
} as const;

export const BOOKING_EVENTS = {
  CREATED: 'booking.created',
  CONFIRMED: 'booking.confirmed',
  CANCELLED: 'booking.cancelled',
  COMPLETED: 'booking.completed',
} as const;

export const NOTIFICATION_EVENTS = {
  SENT: 'notification.sent',
  DELIVERED: 'notification.delivered',
  FAILED: 'notification.failed',
} as const;

// ============================================================================
// Factory Function
// ============================================================================

export function createEventBus(config?: EventBusConfig): EventBus {
  return new EventBus(config);
}

export function createEventPublisher(
  eventBus: EventBus,
  config?: EventPublisherConfig,
): EventPublisher {
  return new EventPublisher(eventBus, config);
}
