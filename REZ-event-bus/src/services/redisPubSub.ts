/**
 * Redis Pub/Sub Service
 * Handles real-time event distribution via Redis pub/sub
 */

import Redis from 'ioredis';
import { config } from '../config';
import { IEvent } from '../models/Event';
import { logger } from './logger';

/**
 * Redis Pub/Sub Service
 */
export class RedisPubSubService {
  private publisher: Redis;
  private subscriber: Redis;
  private subscriptionHandlers: Map<string, Set<(event: IEvent, channel: string) => void>>;
  private patternHandlers: Map<string, Set<(event: IEvent, channel: string) => void>>;
  private isConnected: boolean;

  constructor() {
    this.publisher = this.createRedisClient('publisher');
    this.subscriber = this.createRedisClient('subscriber');
    this.subscriptionHandlers = new Map();
    this.patternHandlers = new Map();
    this.isConnected = false;
  }

  /**
   * Create Redis client with configuration
   */
  private createRedisClient(name: string): Redis {
    const client = new Redis(config.redis.url, {
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      retryStrategy: config.redis.retryStrategy,
      keyPrefix: config.redis.keyPrefix,
      name: name,
      lazyConnect: true,
    });

    client.on('error', (err) => {
      logger.error('Redis client error', { name, error: err.message });
    });

    client.on('connect', () => {
      logger.info('Redis client connected', { name });
    });

    client.on('ready', () => {
      logger.info('Redis client ready', { name });
      this.isConnected = true;
    });

    client.on('close', () => {
      logger.warn('Redis client disconnected', { name });
      this.isConnected = false;
    });

    return client;
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      await Promise.all([
        this.publisher.connect(),
        this.subscriber.connect(),
      ]);
      await this.setupSubscriber();
      logger.info('Redis Pub/Sub service connected');
    } catch (error) {
      logger.error('Failed to connect Redis Pub/Sub', { error });
      throw error;
    }
  }

  /**
   * Setup subscriber with message handlers
   */
  private async setupSubscriber(): Promise<void> {
    this.subscriber.on('message', (channel: string, message: string) => {
      this.handleMessage(channel, message);
    });

    this.subscriber.on('pmessage', (pattern: string, channel: string, message: string) => {
      this.handlePatternMessage(pattern, channel, message);
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(channel: string, message: string): void {
    try {
      const event = JSON.parse(message) as IEvent;
      const handlers = this.subscriptionHandlers.get(channel);

      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(event, channel);
          } catch (error) {
            logger.error('Handler error', { channel, error });
          }
        });
      }
    } catch (error) {
      logger.error('Failed to parse message', { channel, message });
    }
  }

  /**
   * Handle pattern-matched message
   */
  private handlePatternMessage(pattern: string, channel: string, message: string): void {
    try {
      const event = JSON.parse(message) as IEvent;
      const handlers = this.patternHandlers.get(pattern);

      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(event, channel);
          } catch (error) {
            logger.error('Pattern handler error', { pattern, error });
          }
        });
      }
    } catch (error) {
      logger.error('Failed to parse pattern message', { pattern, message });
    }
  }

  /**
   * Publish event to a channel
   */
  async publish(channel: string, event: IEvent): Promise<number> {
    const message = JSON.stringify(event);
    const subscriberCount = await this.publisher.publish(channel, message);

    logger.debug('Event published', {
      channel,
      eventId: event.eventId,
      eventType: event.eventType,
      subscriberCount,
    });

    return subscriberCount;
  }

  /**
   * Publish to multiple channels
   */
  async publishToChannels(channels: string[], event: IEvent): Promise<number[]> {
    const results = await Promise.all(
      channels.map((channel) => this.publish(channel, event))
    );
    return results;
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(
    channel: string,
    handler: (event: IEvent, channel: string) => void
  ): Promise<void> {
    if (!this.subscriptionHandlers.has(channel)) {
      this.subscriptionHandlers.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }

    this.subscriptionHandlers.get(channel)!.add(handler);

    logger.info('Subscribed to channel', { channel });
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channel: string, handler?: (event: IEvent, channel: string) => void): Promise<void> {
    if (handler) {
      const handlers = this.subscriptionHandlers.get(channel);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.subscriptionHandlers.delete(channel);
          await this.subscriber.unsubscribe(channel);
        }
      }
    } else {
      this.subscriptionHandlers.delete(channel);
      await this.subscriber.unsubscribe(channel);
    }

    logger.info('Unsubscribed from channel', { channel });
  }

  /**
   * Subscribe to pattern
   */
  async psubscribe(
    pattern: string,
    handler: (event: IEvent, channel: string) => void
  ): Promise<void> {
    if (!this.patternHandlers.has(pattern)) {
      this.patternHandlers.set(pattern, new Set());
      await this.subscriber.psubscribe(pattern);
    }

    this.patternHandlers.get(pattern)!.add(handler);

    logger.info('Subscribed to pattern', { pattern });
  }

  /**
   * Unsubscribe from pattern
   */
  async punsubscribe(pattern: string, handler?: (event: IEvent, channel: string) => void): Promise<void> {
    if (handler) {
      const handlers = this.patternHandlers.get(pattern);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.patternHandlers.delete(pattern);
          await this.subscriber.punsubscribe(pattern);
        }
      }
    } else {
      this.patternHandlers.delete(pattern);
      await this.subscriber.punsubscribe(pattern);
    }

    logger.info('Unsubscribed from pattern', { pattern });
  }

  /**
   * Get subscriber count for a channel
   */
  async getSubscriberCount(channel: string): Promise<number> {
    // PUBSUB NUMSUB returns count of subscribers per channel
    const result = await this.publisher.pubsub('NUMSUB', channel) as unknown[];
    if (Array.isArray(result)) {
      for (let i = 0; i < result.length; i += 2) {
        if (result[i] === channel) {
          const count = result[i + 1];
          return typeof count === 'number' ? count : 0;
        }
      }
    }
    return 0;
  }

  /**
   * Store event for replay capability
   */
  async storeEvent(event: IEvent): Promise<void> {
    const key = `events:${event.eventType}:${event.eventId}`;
    const ttl = config.eventBus.retentionHours * 60 * 60; // Convert hours to seconds

    await this.publisher.setex(key, ttl, JSON.stringify(event));

    logger.debug('Event stored', { eventId: event.eventId, eventType: event.eventType, ttl });
  }

  /**
   * Retrieve stored event
   */
  async getStoredEvent(eventId: string, eventType: string): Promise<IEvent | null> {
    const key = `events:${eventType}:${eventId}`;
    const data = await this.publisher.get(key);

    if (data) {
      return JSON.parse(data) as IEvent;
    }

    return null;
  }

  /**
   * Get event history
   */
  async getEventHistory(
    eventType?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<IEvent[]> {
    const pattern = eventType ? `events:${eventType}:*` : 'events:*';
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [newCursor, batch] = await this.publisher.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = newCursor;
      keys.push(...batch);

      if (keys.length >= limit + offset) {
        break;
      }
    } while (cursor !== '0');

    const relevantKeys = keys.slice(offset, offset + limit);
    const events: IEvent[] = [];

    for (const key of relevantKeys) {
      const data = await this.publisher.get(key);
      if (data) {
        events.push(JSON.parse(data) as IEvent);
      }
    }

    return events.sort(
      (a, b) =>
        new Date(b.metadata.timestamp).getTime() -
        new Date(a.metadata.timestamp).getTime()
    );
  }

  /**
   * Check connection health
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.publisher.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await Promise.all([
      this.publisher.quit(),
      this.subscriber.quit(),
    ]);
    logger.info('Redis Pub/Sub service disconnected');
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; publisher: boolean; subscriber: boolean } {
    return {
      connected: this.isConnected,
      publisher: this.publisher.status === 'ready',
      subscriber: this.subscriber.status === 'ready',
    };
  }
}

// Singleton instance
export const redisPubSubService = new RedisPubSubService();

export default redisPubSubService;
