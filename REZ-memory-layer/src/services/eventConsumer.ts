/**
 * REZ Memory Layer - Event Consumer
 * Consume events from REZ Event Bus and store in timeline
 */

import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { normalizeEvent, toTimelineEvent } from '../utils/eventNormalizer';
import { cacheService } from './cacheService';
import { timelineAggregator } from './timelineAggregator';
import { TimelineEvent } from '../types/timeline';
import { TimelineEvent as TimelineEventModel } from '../models/TimelineEvent';
import { UserProfile } from '../models/UserProfile';
import { logger } from '../config/logger';

const REZ_EVENT_BUS_URL = process.env.REZ_EVENT_BUS_URL || 'http://localhost:4025';
const EVENT_BUS_API_KEY = process.env.REZ_EVENT_BUS_API_KEY || '';

// Supported event channels
const EVENT_CHANNELS = [
  'commerce.*',
  'identity.*',
  'loyalty.*',
  'engagement.*',
  'intelligence.*',
  'support.*',
  'marketing.*',
  'notification.*'
];

interface EventBusSubscription {
  id: string;
  channel: string;
  callback: (event: unknown) => Promise<void>;
}

interface EventBusMessage {
  id: string;
  channel: string;
  timestamp: string;
  data: unknown;
  metadata?: {
    correlationId?: string;
    source?: string;
  };
}

export class EventConsumer {
  private client: AxiosInstance;
  private subscriptions: Map<string, EventBusSubscription> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly logger = logger;
  private processingQueue: Promise<void> = Promise.resolve();
  private batchBuffer: Map<string, unknown[]> = new Map();
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 50;
  private readonly BATCH_TIMEOUT_MS = 1000;

  constructor() {
    this.client = axios.create({
      baseURL: REZ_EVENT_BUS_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(EVENT_BUS_API_KEY ? { 'X-API-Key': EVENT_BUS_API_KEY } : {})
      }
    });
  }

  /**
   * Start consuming events from the event bus
   */
  async start(): Promise<void> {
    if (this.isConnected) {
      this.logger.info('Event consumer already connected');
      return;
    }

    try {
      // Verify event bus connectivity
      await this.verifyConnection();

      // Subscribe to all channels
      await this.subscribeToChannels();

      // Start polling for events
      this.startPolling();

      this.isConnected = true;
      this.logger.info('Event consumer started successfully');
    } catch (error) {
      this.logger.error('Failed to start event consumer:', error);
      throw error;
    }
  }

  /**
   * Stop consuming events
   */
  async stop(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    await this.unsubscribeAll();
    this.isConnected = false;
    this.logger.info('Event consumer stopped');
  }

  /**
   * Verify connection to event bus
   */
  private async verifyConnection(): Promise<void> {
    try {
      const response = await this.client.get('/health');
      this.logger.info('Event bus health check passed', {
        status: response.data.status
      });
    } catch (error) {
      this.logger.warn('Event bus health check failed, will retry on poll');
    }
  }

  /**
   * Subscribe to event channels
   */
  private async subscribeToChannels(): Promise<void> {
    for (const channel of EVENT_CHANNELS) {
      const subscription: EventBusSubscription = {
        id: uuidv4(),
        channel,
        callback: this.handleEvent.bind(this)
      };

      this.subscriptions.set(channel, subscription);
      this.logger.debug(`Subscribed to channel: ${channel}`);
    }

    this.logger.info(`Subscribed to ${EVENT_CHANNELS.length} event channels`);
  }

  /**
   * Unsubscribe from all channels
   */
  private async unsubscribeAll(): Promise<void> {
    this.subscriptions.clear();
    this.logger.debug('Unsubscribed from all channels');
  }

  /**
   * Start polling for events
   */
  private startPolling(): void {
    // Poll every 500ms for new events
    this.pollInterval = setInterval(async () => {
      await this.pollEvents();
    }, 500);
  }

  /**
   * Poll for events from the event bus
   */
  private async pollEvents(): Promise<void> {
    try {
      // Fetch events from the event bus
      const response = await this.client.get('/api/events/poll', {
        params: {
          channels: Array.from(this.subscriptions.keys()).join(','),
          limit: 100,
          timeout: 1000
        }
      });

      const events: EventBusMessage[] = response.data.events || [];

      if (events.length > 0) {
        this.logger.debug(`Polled ${events.length} events`);

        for (const message of events) {
          // Process each event
          await this.processEvent(message);
        }
      }
    } catch (error) {
      // Log but don't throw - polling should continue
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
          this.handleReconnect();
        } else {
          this.logger.debug('Poll request failed:', error.message);
        }
      }
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.logger.info(`Attempting reconnection in ${delay}ms`, {
      attempt: this.reconnectAttempts
    });

    setTimeout(() => {
      this.verifyConnection().then(() => {
        this.reconnectAttempts = 0;
        this.logger.info('Reconnection successful');
      }).catch(() => {
        // Will retry
      });
    }, delay);
  }

  /**
   * Process a single event
   */
  private async processEvent(message: EventBusMessage): Promise<void> {
    // Add to processing queue to maintain order
    this.processingQueue = this.processingQueue.then(async () => {
      try {
        // Normalize the event
        const normalized = normalizeEvent(message.data);
        const timelineEvent = toTimelineEvent(normalized);

        // Add correlation ID if present
        if (message.metadata?.correlationId) {
          timelineEvent.metadata.correlationId = message.metadata.correlationId;
        }

        // Add to batch buffer
        this.addToBatch(timelineEvent);

      } catch (error) {
        this.logger.error('Failed to process event:', {
          messageId: message.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    await this.processingQueue;
  }

  /**
   * Handle event from subscription
   */
  private async handleEvent(event: unknown): Promise<void> {
    try {
      const normalized = normalizeEvent(event);
      const timelineEvent = toTimelineEvent(normalized);

      // Process immediately
      await this.storeEvent(timelineEvent);

    } catch (error) {
      this.logger.error('Failed to handle event:', error);
    }
  }

  /**
   * Add event to batch buffer
   */
  private addToBatch(event: TimelineEvent): void {
    const userId = event.userId;

    if (!this.batchBuffer.has(userId)) {
      this.batchBuffer.set(userId, []);
    }

    this.batchBuffer.get(userId)!.push(event);

    // Flush if batch size reached
    if (this.batchBuffer.get(userId)!.length >= this.BATCH_SIZE) {
      this.flushBatch(userId);
    } else if (!this.batchTimeout) {
      // Set timeout to flush remaining events
      this.batchTimeout = setTimeout(() => {
        this.flushAllBatches();
      }, this.BATCH_TIMEOUT_MS);
    }
  }

  /**
   * Flush a specific user's batch
   */
  private async flushBatch(userId: string): Promise<void> {
    const events = this.batchBuffer.get(userId);
    if (!events || events.length === 0) return;

    this.batchBuffer.delete(userId);

    try {
      await this.storeEvents(events);

      // Update user profile asynchronously
      this.updateUserProfileAsync(userId);

      this.logger.debug(`Flushed batch of ${events.length} events for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to flush batch for user ${userId}:`, error);
    }
  }

  /**
   * Flush all pending batches
   */
  private async flushAllBatches(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    const userIds = Array.from(this.batchBuffer.keys());

    for (const userId of userIds) {
      await this.flushBatch(userId);
    }
  }

  /**
   * Store a single event
   */
  private async storeEvent(event: TimelineEvent): Promise<void> {
    try {
      // Store in MongoDB
      const doc = new TimelineEventModel({
        id: event.id,
        userId: event.userId,
        type: event.type,
        category: event.category,
        source: event.source,
        timestamp: event.timestamp,
        data: event.data,
        metadata: event.metadata
      });

      await doc.save();

      // Update cache
      await cacheService.addToCachedTimeline(event.userId, {
        event,
        enrichments: {},
        tags: []
      });

      // Increment event count
      await cacheService.incrementEventCount(event.userId);

      // Update user activity
      await cacheService.updateUserActivity(event.userId);

      this.logger.debug(`Stored event ${event.id} for user ${event.userId}`);
    } catch (error) {
      // Handle duplicate events gracefully
      if (error instanceof Error && error.message.includes('duplicate key')) {
        this.logger.debug(`Duplicate event ${event.id}, skipping`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Store multiple events
   */
  private async storeEvents(events: TimelineEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
      // Bulk insert into MongoDB
      const docs = events.map(event => ({
        id: event.id,
        userId: event.userId,
        type: event.type,
        category: event.category,
        source: event.source,
        timestamp: event.timestamp,
        data: event.data,
        metadata: event.metadata
      }));

      await TimelineEventModel.insertMany(docs, { ordered: false });

      // Update caches
      for (const event of events) {
        await cacheService.incrementEventCount(event.userId);
        await cacheService.updateUserActivity(event.userId);
      }

      this.logger.debug(`Stored ${events.length} events`);
    } catch (error) {
      // Handle partial failures
      if (error instanceof Error && error.message.includes('duplicate key')) {
        this.logger.debug('Some events were duplicates, continuing...');
      } else {
        throw error;
      }
    }
  }

  /**
   * Update user profile asynchronously
   */
  private updateUserProfileAsync(userId: string): void {
    // Don't await - let it run in background
    timelineAggregator.updateUserProfile(userId)
      .then(profile => {
        this.logger.debug(`Updated profile for user ${userId}`, {
          engagementScore: profile.engagementScore,
          segments: profile.segments.length
        });
      })
      .catch(error => {
        this.logger.error(`Failed to update profile for user ${userId}:`, error);
      });
  }

  /**
   * Check if consumer is connected
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Get consumer status
   */
  getStatus(): {
    connected: boolean;
    subscriptions: number;
    batchBufferSize: number;
  } {
    let batchBufferSize = 0;
    for (const events of this.batchBuffer.values()) {
      batchBufferSize += events.length;
    }

    return {
      connected: this.isConnected,
      subscriptions: this.subscriptions.size,
      batchBufferSize
    };
  }
}

export const eventConsumer = new EventConsumer();
