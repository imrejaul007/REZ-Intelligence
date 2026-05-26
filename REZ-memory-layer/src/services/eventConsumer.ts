/**
 * REZ Memory Layer - Event Consumer
 * Consume events from REZ Event Bus via WebSocket
 * PRODUCTION-READY: Version-based cache invalidation, event buffering, graceful degradation
 */

import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { randomInt } from 'crypto';
import { normalizeEvent, toTimelineEvent } from '../utils/eventNormalizer';
import { cacheService } from './cacheService';
import { timelineAggregator } from './timelineAggregator';
import { TimelineEvent as TimelineEventModel } from '../models/TimelineEvent';
import { logger } from '../config/logger';

const REZ_EVENT_BUS_URL = process.env.REZ_EVENT_BUS_URL || 'http://localhost:4025';
const REZ_EVENT_BUS_API_KEY = process.env.REZ_EVENT_BUS_API_KEY || '';

const EVENT_CHANNELS = [
  'commerce.*',
  'loyalty.*',
  'engagement.*',
  'intelligence.*',
  'support.*',
  'marketing.*'
];

const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 1000;
const PROCESSING_TIMEOUT_MS = 5000;
const EVENT_BUFFER_KEY = 'event_buffer';

export class EventConsumer {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private isRunning = false;
  private shouldReconnect = true;

  async connect(): Promise<void> {
    const wsUrl = REZ_EVENT_BUS_URL.replace('http', 'ws') + '/ws';

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl, {
        headers: { 'X-Internal-Token': REZ_EVENT_BUS_API_KEY }
      });

      const connectionTimeout = setTimeout(() => {
        if (this.ws?.readyState === WebSocket.CONNECTING) {
          this.ws.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(connectionTimeout);
        logger.info('Event Bus connected');
        this.reconnectAttempts = 0;
        this.isRunning = true;
        this.subscribe(EVENT_CHANNELS);
        resolve();
      });

      this.ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString());
          await this.processEvent(msg);
        } catch (error) {
          logger.error('Failed to parse event message', { error });
        }
      });

      this.ws.on('close', () => {
        logger.warn('Event Bus disconnected');
        this.isRunning = false;
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (error) => {
        logger.error('Event Bus WebSocket error', { error: error.message });
      });
    });
  }

  private subscribe(channels: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot subscribe: WebSocket not connected');
      return;
    }
    this.ws.send(JSON.stringify({ type: 'subscribe', channels }));
    logger.info('Subscribed to channels', { channels });
  }

  private async processEvent(msg): Promise<void> {
    if (msg.type !== 'event') return;

    try {
      // Process with timeout to prevent blocking
      await Promise.race([
        this.processEventInternal(msg),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Event processing timeout')), PROCESSING_TIMEOUT_MS)
        )
      ]);
    } catch (error) {
      logger.error('Failed to process event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventType: msg.data?.type
      });

      // Buffer failed events for later retry
      await this.bufferEvent(msg);
    }
  }

  /**
   * Internal event processing with version-based cache invalidation
   */
  private async processEventInternal(msg): Promise<void> {
    const normalized = normalizeEvent(msg.data);
    const timelineEvent = toTimelineEvent(normalized);

    // 1. Persist first
    await TimelineEventModel.create(timelineEvent);
    logger.debug('Event persisted', { eventId: timelineEvent.eventId, userId: timelineEvent.userId });

    // 2. Invalidate cache with versioning (prevents race condition)
    await this.invalidateCacheVersioned(timelineEvent.userId);

    // 3. Rebuild timeline with version check
    await timelineAggregator.buildTimeline(timelineEvent.userId, 10);

    logger.info('Event processed successfully', {
      eventId: timelineEvent.eventId,
      userId: timelineEvent.userId,
      eventType: timelineEvent.type
    });
  }

  /**
   * Version-based cache invalidation to prevent race conditions
   * When multiple events arrive, each increments version and rebuilds
   * Readers can check version to detect stale cache
   */
  private async invalidateCacheVersioned(userId: string): Promise<void> {
    const newVersion = await cacheService.incrementEventCount(userId);

    // Invalidate all caches
    await cacheService.invalidateUserCache(userId);

    // Store new version for readers to check
    const { getRedisClient } = await import('../config/redis');
    const redis = getRedisClient();
    await redis.setex(`timeline:version:${userId}`, 86400, newVersion.toString());

    logger.debug('Cache invalidated with version', { userId, version: newVersion });
  }

  /**
   * Buffer failed events to Redis for later processing
   */
  private async bufferEvent(event): Promise<void> {
    const { getRedisClient } = await import('../config/redis');
    const redis = getRedisClient();

    const bufferedEvent = {
      event: event,
      bufferedAt: new Date().toISOString(),
      retryCount: 0
    };

    await redis.lpush(EVENT_BUFFER_KEY, JSON.stringify(bufferedEvent));
    logger.info('Event buffered for retry', { bufferedAt: bufferedEvent.bufferedAt });
  }

  /**
   * Process buffered events (called on recovery)
   */
  async processBufferedEvents(maxEvents: number = 100): Promise<{ processed: number; failed: number }> {
    const { getRedisClient } = await import('../config/redis');
    const redis = getRedisClient();

    let processed = 0;
    let failed = 0;

    for (let i = 0; i < maxEvents; i++) {
      const eventJson = await redis.rpop(EVENT_BUFFER_KEY);
      if (!eventJson) break;

      try {
        const buffered = JSON.parse(eventJson);
        await this.processEventInternal({ type: 'event', data: buffered.event.data });
        processed++;
      } catch (error) {
        // Re-buffer with incremented retry count
        const buffered = JSON.parse(eventJson);
        buffered.retryCount++;

        if (buffered.retryCount < 5) {
          await redis.lpush(EVENT_BUFFER_KEY, JSON.stringify(buffered));
        } else {
          logger.error('Max retries reached for buffered event', {
            retryCount: buffered.retryCount
          });
          failed++;
        }
      }
    }

    return { processed, failed };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error('Max reconnection attempts reached, giving up');
      return;
    }

    this.reconnectAttempts++;
    // Exponential backoff with jitter
    const delay = RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
    const jitter = (randomInt(0, 300) / 1000) * delay;
    const actualDelay = Math.min(delay + jitter, 60000);

    logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`, {
      delay: actualDelay
    });

    setTimeout(async () => {
      if (this.shouldReconnect) {
        try {
          await this.connect();
        } catch (error) {
          logger.error('Reconnection failed', { error });
        }
      }
    }, actualDelay);
  }

  isHealthy(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getStatus(): {
    subscriptions: number;
    isHealthy: boolean;
    reconnectAttempts: number;
    isRunning: boolean;
  } {
    return {
      subscriptions: EVENT_CHANNELS.length,
      isHealthy: this.isHealthy(),
      reconnectAttempts: this.reconnectAttempts,
      isRunning: this.isRunning
    };
  }

  stop(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isRunning = false;
    logger.info('Event consumer stopped');
  }

  start(): void {
    this.shouldReconnect = true;
    this.connect().catch((error) => {
      logger.error('Initial connection failed', { error });
    });
  }

  /**
   * Force reconnect
   */
  async restart(): Promise<void> {
    this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.start();
  }
}

export const eventConsumer = new EventConsumer();
