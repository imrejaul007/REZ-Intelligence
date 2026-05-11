/**
 * Event Bus Service
 *
 * Central event routing with pub/sub
 */

import { v4 as uuidv4 } from 'uuid';
import { redis, publisher } from '../config/redis';
import { Event } from '../models/Event';
import axios from 'axios';

export interface EventPayload {
  eventType: string;
  userId?: string;
  merchantId?: string;
  data: Record<string, any>;
  correlationId?: string;
  idempotencyKey?: string;
  source: string;
  priority?: 'high' | 'normal' | 'low';
}

export interface Subscription {
  id: string;
  service: string;
  eventType: string;
  url: string;
  active: boolean;
  createdAt: Date;
}

export class EventBusService {
  private subscriptions: Map<string, Subscription[]> = new Map();
  private stats = {
    eventsPublished: 0,
    eventsDelivered: 0,
    eventsFailed: 0,
  };

  async initialize(): Promise<void> {
    console.log('Event Bus Service initialized');

    // Load subscriptions from Redis
    await this.loadSubscriptions();

    // Start consumer loop
    this.startConsumer();
  }

  /**
   * Publish event to all subscribers
   */
  async publish(payload: EventPayload): Promise<string> {
    const eventId = uuidv4();
    const timestamp = new Date().toISOString();

    const event = {
      eventId,
      eventType: payload.eventType,
      userId: payload.userId,
      merchantId: payload.merchantId,
      timestamp,
      version: '1.0',
      source: payload.source,
      correlationId: payload.correlationId || uuidv4(),
      idempotencyKey: payload.idempotencyKey,
      priority: payload.priority || 'normal',
      data: payload.data,
    };

    // Store event in Redis for replay
    await this.storeEvent(event);

    // Publish to Redis channels
    const channel = `events.${payload.eventType}`;
    await publisher.publish(channel, JSON.stringify(event));

    // Also publish to user-specific channel
    if (payload.userId) {
      const userChannel = `events.user.${payload.userId}`;
      await publisher.publish(userChannel, JSON.stringify(event));
    }

    this.stats.eventsPublished++;
    console.log(`Event published: ${event.eventType} [${eventId}]`);

    return eventId;
  }

  /**
   * Subscribe to event type
   */
  async subscribe(subscription: Omit<Subscription, 'id' | 'createdAt'>): Promise<Subscription> {
    const newSubscription: Subscription = {
      ...subscription,
      id: uuidv4(),
      createdAt: new Date(),
    };

    const key = `subscription:${subscription.eventType}`;
    await redis.hset(key, newSubscription.id, JSON.stringify(newSubscription));

    // Also keep in memory for fast access
    const existing = this.subscriptions.get(subscription.eventType) || [];
    existing.push(newSubscription);
    this.subscriptions.set(subscription.eventType, existing);

    console.log(`Subscription created: ${subscription.service} -> ${subscription.eventType}`);

    return newSubscription;
  }

  /**
   * Unsubscribe
   */
  async unsubscribe(eventType: string, service: string): Promise<void> {
    const key = `subscription:${eventType}`;
    const subs = await redis.hgetall(key);

    for (const [id, subJson] of Object.entries(subs)) {
      const sub = JSON.parse(subJson);
      if (sub.service === service) {
        await redis.hdel(key, id);
      }
    }

    // Update memory
    const existing = this.subscriptions.get(eventType) || [];
    this.subscriptions.set(
      eventType,
      existing.filter((s) => s.service !== service)
    );
  }

  /**
   * Get event history
   */
  async getEventHistory(
    options: {
      eventType?: string;
      userId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Event[]> {
    const { eventType, userId, limit = 100, offset = 0 } = options;

    const pattern = eventType ? `events:${eventType}:*` : 'events:*';
    const keys = await redis.keys(pattern);

    const events: Event[] = [];
    for (const key of keys.slice(offset, offset + limit)) {
      const event = await redis.get(key);
      if (event) {
        const parsed = JSON.parse(event);
        if (!userId || parsed.userId === userId) {
          events.push(parsed);
        }
      }
    }

    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Get service stats
   */
  async getStats(): Promise<typeof this.stats & { subscriptions: number }> {
    const subscriptionCount = await redis.keys('subscription:*').then((keys) =>
      Promise.all(keys.map((k) => redis.hlen(k)))
    ).then((counts) => counts.reduce((a, b) => a + b, 0));

    return {
      ...this.stats,
      subscriptions: subscriptionCount,
    };
  }

  // Private methods

  private async storeEvent(event: any): Promise<void> {
    const key = `events:${event.eventType}:${event.eventId}`;
    await redis.set(key, JSON.stringify(event));

    // Keep for 7 days
    await redis.expire(key, 7 * 24 * 60 * 60);
  }

  private async loadSubscriptions(): Promise<void> {
    const keys = await redis.keys('subscription:*');
    for (const key of keys) {
      const eventType = key.replace('subscription:', '');
      const subs = await redis.hgetall(key);

      const subscriptions: Subscription[] = [];
      for (const [, subJson] of Object.entries(subs)) {
        subscriptions.push(JSON.parse(subJson));
      }

      this.subscriptions.set(eventType, subscriptions);
    }
    console.log(`Loaded ${this.subscriptions.size} subscription types`);
  }

  private startConsumer(): void {
    // Subscribe to all event channels
    const subscriber = redis.duplicate();

    subscriber.on('message', async (channel: string, message: string) => {
      try {
        const event = JSON.parse(message);
        const eventType = event.eventType;

        // Get subscribers for this event type
        const subscribers = this.subscriptions.get(eventType) || [];

        // Deliver to all subscribers
        for (const sub of subscribers) {
          if (sub.active) {
            await this.deliverToSubscriber(sub, event);
          }
        }

        this.stats.eventsDelivered += subscribers.length;
      } catch (error) {
        console.error('Error in consumer:', error);
        this.stats.eventsFailed++;
      }
    });

    // Subscribe to pattern
    subscriber.psubscribe('events.*', 'events.user.*');
    console.log('Event consumer started');
  }

  private async deliverToSubscriber(subscriber: Subscription, event: any): Promise<void> {
    try {
      await axios.post(subscriber.url, event, {
        timeout: 5000,
        headers: {
          'X-Event-Id': event.eventId,
          'X-Event-Type': event.eventType,
          'X-Correlation-Id': event.correlationId,
        },
      });
    } catch (error) {
      console.error(`Failed to deliver to ${subscriber.service}:`, error);
    }
  }
}
