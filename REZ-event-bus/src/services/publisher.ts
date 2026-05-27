/**
 * Publisher Service
 * High-level event publishing service combining Redis and Kafka
 */

import { v4 as uuidv4 } from 'uuid';
import { IEvent, EventCreatePayload, EventStatus, EventPriority, createEvent } from '../models/Event';
import { EventTypeValue, getEventTypeInfo } from './eventSchema';
import { EventValidator } from './eventValidator';
import { RedisPubSubService } from './redisPubSub';
import { KafkaProducerService } from './kafkaProducer';
import { logger, eventLogger } from './logger';
import { config } from '../config';

/**
 * Publish Result
 */
export interface PublishResult {
  success: boolean;
  eventId: string;
  eventType: string;
  channels: string[];
  subscriberCount: number;
  timestamp: string;
  error?: string;
}

/**
 * Publisher Service
 */
export class PublisherService {
  private redisPubSub: RedisPubSubService;
  private kafkaProducer: KafkaProducerService;
  private publishedEvents: number;
  private failedEvents: number;

  constructor(
    redisPubSub: RedisPubSubService,
    kafkaProducer: KafkaProducerService
  ) {
    this.redisPubSub = redisPubSub;
    this.kafkaProducer = kafkaProducer;
    this.publishedEvents = 0;
    this.failedEvents = 0;
  }

  /**
   * Publish a single event
   */
  async publish(payload: EventCreatePayload): Promise<PublishResult> {
    const startTime = Date.now();
    const eventId = uuidv4();
    const channels: string[] = [];

    try {
      // Validate event type
      EventValidator.validateEventType(payload.eventType);

      // Validate payload size
      EventValidator.validatePayloadSize(payload.payload);

      // Create event object
      const event = createEvent({
        eventType: payload.eventType,
        payload: payload.payload,
        source: payload.source,
        correlationId: payload.correlationId || uuidv4(),
        causationId: payload.causationId,
        priority: payload.priority,
        tags: payload.tags,
      });

      event.status = EventStatus.PUBLISHED;

      // Build channel list
      channels.push(`events.${payload.eventType}`);

      // Add category channel
      const eventInfo = getEventTypeInfo(payload.eventType as EventTypeValue);
      channels.push(`events.category.${eventInfo.category.toLowerCase()}`);

      // Add source channel
      channels.push(`events.source.${payload.source}`);

      // Add user-specific channel if userId is in payload
      const userId = payload.payload['userId'] as string | undefined;
      if (userId) {
        channels.push(`events.user.${userId}`);
      }

      // Publish to Redis for real-time subscribers
      const subscriberCounts = await this.redisPubSub.publishToChannels(channels, event);
      const subscriberCount = subscriberCounts.reduce((sum, count) => sum + count, 0);

      // Store in Redis for replay
      await this.redisPubSub.storeEvent(event);

      // Publish to Kafka for durable streaming
      try {
        await this.kafkaProducer.publish(event);
      } catch (kafkaError) {
        // Log but don't fail - Redis is primary for real-time
        eventLogger.warn('Kafka publish failed, event stored in Redis only', {
          eventId,
          error: kafkaError instanceof Error ? kafkaError.message : String(kafkaError),
        });
      }

      this.publishedEvents++;

      const duration = Date.now() - startTime;

      eventLogger.info('Event published', {
        eventId,
        eventType: payload.eventType,
        channels,
        subscriberCount,
        durationMs: duration,
      });

      return {
        success: true,
        eventId,
        eventType: payload.eventType,
        channels,
        subscriberCount,
        timestamp: event.metadata.timestamp,
      };
    } catch (error) {
      this.failedEvents++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      eventLogger.error('Event publish failed', {
        eventType: payload.eventType,
        error: errorMessage,
      });

      return {
        success: false,
        eventId,
        eventType: payload.eventType,
        channels,
        subscriberCount: 0,
        timestamp: new Date().toISOString(),
        error: errorMessage,
      };
    }
  }

  /**
   * Publish batch of events
   */
  async publishBatch(
    payloads: EventCreatePayload[],
    atomic: boolean = false
  ): Promise<{ results: PublishResult[]; success: boolean }> {
    const results: PublishResult[] = [];
    let allSuccess = true;

    for (const payload of payloads) {
      const result = await this.publish(payload);

      results.push(result);

      if (atomic && !result.success) {
        // Stop processing if atomic and one fails
        allSuccess = false;
        break;
      }

      if (!result.success) {
        allSuccess = false;
      }
    }

    return { results, success: allSuccess };
  }

  /**
   * Publish high-priority event
   */
  async publishUrgent(
    eventType: EventTypeValue,
    payload: Record<string, unknown>,
    source: string,
    correlationId?: string
  ): Promise<PublishResult> {
    return this.publish({
      eventType,
      payload,
      source,
      correlationId,
      priority: (payload['priority' as keyof typeof payload] as EventPriority) || EventPriority.NORMAL,
    });
  }

  /**
   * Get publisher statistics
   */
  getStats(): {
    publishedEvents: number;
    failedEvents: number;
    successRate: number;
  } {
    const total = this.publishedEvents + this.failedEvents;
    return {
      publishedEvents: this.publishedEvents,
      failedEvents: this.failedEvents,
      successRate: total > 0 ? this.publishedEvents / total : 1,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.publishedEvents = 0;
    this.failedEvents = 0;
  }
}

// Will be initialized in index.ts
let publisherService: PublisherService | null = null;

export function initPublisherService(
  redisPubSub: RedisPubSubService,
  kafkaProducer: KafkaProducerService
): PublisherService {
  publisherService = new PublisherService(redisPubSub, kafkaProducer);
  return publisherService;
}

export function getPublisherService(): PublisherService {
  if (!publisherService) {
    throw new Error('PublisherService not initialized');
  }
  return publisherService;
}

export default PublisherService;
