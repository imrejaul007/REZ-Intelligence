/**
 * Subscriber Service
 * Manages event subscriptions and delivery
 */

import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import {
  ISubscription,
  SubscriptionCreatePayload,
  SubscriptionUpdatePayload,
  SubscriptionStatus,
  DeliveryStrategy,
  DeliveryResult,
  createSubscription,
  shouldRetry,
  calculateRetryDelay,
} from '../models/Subscription';
import { IEvent } from '../models/Event';
import { config } from '../config';
import { logger, subscriptionLogger } from './logger';

/**
 * Delivery Handler Function
 */
export type DeliveryHandler = (
  event: IEvent,
  subscription: ISubscription
) => Promise<DeliveryResult>;

/**
 * Subscriber Service
 */
export class SubscriberService {
  private subscriptions: Map<string, ISubscription>;
  private eventTypeSubscriptions: Map<string, Set<string>>;
  private subscriberRedis: Redis;
  private deliveryHandlers: Map<string, DeliveryHandler>;
  private isRunning: boolean;

  constructor() {
    this.subscriptions = new Map();
    this.eventTypeSubscriptions = new Map();
    this.deliveryHandlers = new Map();
    this.isRunning = false;

    // Create dedicated subscriber Redis client
    this.subscriberRedis = new Redis(config.redis.url, {
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      retryStrategy: config.redis.retryStrategy,
      keyPrefix: config.redis.keyPrefix,
      name: 'subscriber',
    });
  }

  /**
   * Initialize the subscriber service
   */
  async initialize(): Promise<void> {
    await this.loadSubscriptions();
    this.isRunning = true;
    subscriptionLogger.info('Subscriber service initialized');
  }

  /**
   * Load subscriptions from Redis
   */
  private async loadSubscriptions(): Promise<void> {
    const pattern = `subscriptions:*`;
    let cursor = '0';

    do {
      const [newCursor, keys] = await this.subscriberRedis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = newCursor;

      for (const key of keys) {
        const data = await this.subscriberRedis.get(key);
        if (data) {
          const subscription = JSON.parse(data) as ISubscription;
          this.addSubscriptionToMaps(subscription);
        }
      }
    } while (cursor !== '0');

    subscriptionLogger.info('Loaded subscriptions', { count: this.subscriptions.size });
  }

  /**
   * Add subscription to internal maps
   */
  private addSubscriptionToMaps(subscription: ISubscription): void {
    this.subscriptions.set(subscription.subscriptionId, subscription);

    for (const eventType of subscription.eventTypes) {
      if (!this.eventTypeSubscriptions.has(eventType)) {
        this.eventTypeSubscriptions.set(eventType, new Set());
      }
      this.eventTypeSubscriptions.get(eventType)!.add(subscription.subscriptionId);
    }
  }

  /**
   * Create a new subscription
   */
  async subscribe(payload: SubscriptionCreatePayload): Promise<ISubscription> {
    // Check max subscriptions limit
    const existingCount = Array.from(this.subscriptions.values()).filter(
      (s) => s.subscriberId === payload.subscriberId
    ).length;

    if (existingCount >= config.eventBus.maxSubscriptionsPerClient) {
      throw new Error(`Maximum subscriptions limit (${config.eventBus.maxSubscriptionsPerClient}) reached`);
    }

    const subscription = createSubscription(payload);

    // Store in Redis
    const key = `subscriptions:${subscription.subscriptionId}`;
    await this.subscriberRedis.set(key, JSON.stringify(subscription));

    // Also add to sorted set for time-based queries
    await this.subscriberRedis.zadd(
      'subscriptions:by-date',
      subscription.createdAt.getTime(),
      subscription.subscriptionId
    );

    // Add to maps
    this.addSubscriptionToMaps(subscription);

    subscriptionLogger.info('Subscription created', {
      subscriptionId: subscription.subscriptionId,
      subscriberId: subscription.subscriberId,
      eventTypes: subscription.eventTypes,
    });

    return subscription;
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(
    subscriptionId: string,
    updates: SubscriptionUpdatePayload
  ): Promise<ISubscription> {
    const subscription = this.subscriptions.get(subscriptionId);

    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    // Update fields
    const updatedSubscription: ISubscription = {
      ...subscription,
      ...updates,
      url: updates.url || subscription.url,
      updatedAt: new Date(),
    };

    // Update event type maps if eventTypes changed
    if (updates.eventTypes) {
      // Remove from old event type maps
      for (const eventType of subscription.eventTypes) {
        this.eventTypeSubscriptions.get(eventType)?.delete(subscriptionId);
      }

      // Add to new event type maps
      for (const eventType of updates.eventTypes) {
        if (!this.eventTypeSubscriptions.has(eventType)) {
          this.eventTypeSubscriptions.set(eventType, new Set());
        }
        this.eventTypeSubscriptions.get(eventType)!.add(subscriptionId);
      }
    }

    // Store updated subscription
    const key = `subscriptions:${subscriptionId}`;
    await this.subscriberRedis.set(key, JSON.stringify(updatedSubscription));

    this.subscriptions.set(subscriptionId, updatedSubscription);

    subscriptionLogger.info('Subscription updated', { subscriptionId });

    return updatedSubscription;
  }

  /**
   * Delete a subscription
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);

    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    // Remove from event type maps
    for (const eventType of subscription.eventTypes) {
      this.eventTypeSubscriptions.get(eventType)?.delete(subscriptionId);
    }

    // Remove from Redis
    await this.subscriberRedis.del(`subscriptions:${subscriptionId}`);
    await this.subscriberRedis.zrem('subscriptions:by-date', subscriptionId);

    // Remove from memory
    this.subscriptions.delete(subscriptionId);

    subscriptionLogger.info('Subscription deleted', { subscriptionId });
  }

  /**
   * Get subscription by ID
   */
  getSubscription(subscriptionId: string): ISubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * Get subscriptions by subscriber ID
   */
  getSubscriptionsBySubscriber(subscriberId: string): ISubscription[] {
    return Array.from(this.subscriptions.values()).filter(
      (s) => s.subscriberId === subscriberId
    );
  }

  /**
   * Get subscriptions by event type
   */
  getSubscriptionsByEventType(eventType: string): ISubscription[] {
    const subscriptionIds = this.eventTypeSubscriptions.get(eventType);
    if (!subscriptionIds) return [];

    return Array.from(subscriptionIds)
      .map((id) => this.subscriptions.get(id))
      .filter((s): s is ISubscription => s !== undefined && s.status === SubscriptionStatus.ACTIVE);
  }

  /**
   * Register a delivery handler
   */
  registerDeliveryHandler(name: string, handler: DeliveryHandler): void {
    this.deliveryHandlers.set(name, handler);
    subscriptionLogger.info('Delivery handler registered', { name });
  }

  /**
   * Handle incoming event
   */
  async handleEvent(event: IEvent): Promise<DeliveryResult[]> {
    const subscriptions = this.getSubscriptionsByEventType(event.eventType);
    const results: DeliveryResult[] = [];

    for (const subscription of subscriptions) {
      // Check if event matches subscription filter
      if (subscription.filter && !this.matchesFilter(event, subscription.filter)) {
        continue;
      }

      const result = await this.deliverEvent(event, subscription);
      results.push(result);
    }

    return results;
  }

  /**
   * Deliver event to subscription
   */
  private async deliverEvent(
    event: IEvent,
    subscription: ISubscription
  ): Promise<DeliveryResult> {
    const startTime = Date.now();
    const handler = this.deliveryHandlers.get('default');

    if (!handler || !subscription.url) {
      return {
        success: false,
        subscriptionId: subscription.subscriptionId,
        eventId: event.eventId,
        attempts: 1,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: 'No delivery handler or URL configured',
      };
    }

    try {
      const result = await handler(event, subscription);

      // Update subscription last event time
      if (result.success) {
        subscription.lastSuccessfulDeliveryAt = new Date();
        subscription.failureCount = 0;
      } else {
        subscription.lastFailedDeliveryAt = new Date();
        subscription.failureCount++;

        // Check if should pause subscription
        if (!shouldRetry(subscription, new Error(result.error))) {
          subscription.status = SubscriptionStatus.FAILED;
          subscriptionLogger.warn('Subscription marked as failed', {
            subscriptionId: subscription.subscriptionId,
            failureCount: subscription.failureCount,
          });
        }
      }

      subscription.lastEventAt = new Date();
      await this.updateSubscriptionInRedis(subscription);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      subscriptionLogger.error('Delivery failed', {
        subscriptionId: subscription.subscriptionId,
        eventId: event.eventId,
        error: errorMessage,
      });

      return {
        success: false,
        subscriptionId: subscription.subscriptionId,
        eventId: event.eventId,
        attempts: 1,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: errorMessage,
      };
    }
  }

  /**
   * Check if event matches subscription filter
   */
  private matchesFilter(event: IEvent, filter: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      const eventValue = this.getNestedValue(event, key);
      if (eventValue !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  /**
   * Update subscription in Redis
   */
  private async updateSubscriptionInRedis(subscription: ISubscription): Promise<void> {
    const key = `subscriptions:${subscription.subscriptionId}`;
    await this.subscriberRedis.set(key, JSON.stringify(subscription));
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalSubscriptions: number;
    activeSubscriptions: number;
    pausedSubscriptions: number;
    failedSubscriptions: number;
    subscriptionsByEventType: Record<string, number>;
  } {
    const subscriptions = Array.from(this.subscriptions.values());

    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: subscriptions.filter(
        (s) => s.status === SubscriptionStatus.ACTIVE
      ).length,
      pausedSubscriptions: subscriptions.filter(
        (s) => s.status === SubscriptionStatus.PAUSED
      ).length,
      failedSubscriptions: subscriptions.filter(
        (s) => s.status === SubscriptionStatus.FAILED
      ).length,
      subscriptionsByEventType: Object.fromEntries(
        Array.from(this.eventTypeSubscriptions.entries()).map(([type, ids]) => [
          type,
          ids.size,
        ])
      ),
    };
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    this.isRunning = false;
    await this.subscriberRedis.quit();
    subscriptionLogger.info('Subscriber service shutdown');
  }
}

// Singleton instance
export const subscriberService = new SubscriberService();

export default subscriberService;
