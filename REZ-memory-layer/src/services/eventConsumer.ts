/**
 * REZ Memory Layer - Event Consumer
 * Consume events from REZ Event Bus via WebSocket
 */

import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { normalizeEvent, toTimelineEvent } from '../utils/eventNormalizer';
import { cacheService } from './cacheService';
import { timelineAggregator } from './timelineAggregator';
import { TimelineEvent } from '../types/timeline';
import { TimelineEvent as TimelineEventModel } from '../models/TimelineEvent';
import { logger } from '../config/logger';

const REZ_EVENT_BUS_URL = process.env.REZ_EVENT_BUS_URL || 'http://localhost:4025';
const REZ_EVENT_BUS_API_KEY = process.env.REZ_EVENT_BUS_API_KEY || '';

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
  type: string;
  id?: string;
  channel?: string;
  channels?: string[];
  timestamp?: string;
  data?: unknown;
  metadata?: {
    correlationId?: string;
    source?: string;
  };
  error?: string;
}

interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'event' | 'ack' | 'error' | 'ping' | 'pong';
  channels?: string[];
  channel?: string;
  id?: string;
  data?: unknown;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export class EventConsumer {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, EventBusSubscription> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly logger = logger;
  private processingQueue: Promise<void> = Promise.resolve();
  private batchBuffer: Map<string, TimelineEvent[]> = new Map();
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 50;
  private readonly BATCH_TIMEOUT_MS = 1000;
  private wsUrl: string;
  private pendingSubscriptions: Set<string> = new Set();

  constructor() {
    // Convert HTTP URL to WebSocket URL
    this.wsUrl = REZ_EVENT_BUS_URL.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws';
  }

  /**
   * Start consuming events from the event bus via WebSocket
   */
  async start(): Promise<void> {
    if (this.isConnected) {
      this.logger.info('Event consumer already connected');
      return;
    }

    try {
      await this.connect();
      this.logger.info('Event consumer started successfully');
    } catch (error) {
      this.logger.error('Failed to start event consumer:', error);
      throw error;
    }
  }

  /**
   * Connect to Event Bus via WebSocket
   */
  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.info(`Connecting to Event Bus at ${this.wsUrl}`);

      const headers: Record<string, string> = {
        'X-Internal-Token': REZ_EVENT_BUS_API_KEY
      };

      this.ws = new WebSocket(this.wsUrl, {
        headers,
        handshakeTimeout: 10000,
        timeout: 10000
      });

      this.ws.on('open', () => {
        this.logger.info('Connected to Event Bus via WebSocket');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Start heartbeat ping
        this.startHeartbeat();

        // Subscribe to all channels
        this.subscribe(EVENT_CHANNELS);

        resolve();
      });

      this.ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          await this.handleMessage(message);
        } catch (error) {
          this.logger.error('Failed to parse Event Bus message', { error });
        }
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        this.logger.warn(`Event Bus WebSocket disconnected: ${code} - ${reason.toString()}`);
        this.isConnected = false;
        this.stopHeartbeat();
        this.scheduleReconnect();
      });

      this.ws.on('error', (error: Error) => {
        this.logger.error('Event Bus WebSocket error', { error: error.message });
        // Only reject if we haven't connected yet
        if (this.reconnectAttempts === 0) {
          reject(error);
        }
      });

      this.ws.on('unexpected-response', (req, res) => {
        this.logger.error('Unexpected WebSocket response', {
          statusCode: res.statusCode,
          statusMessage: res.statusMessage
        });
      });
    });
  }

  /**
   * Subscribe to channels
   */
  private subscribe(channels: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn('Cannot subscribe: WebSocket not connected');
      return;
    }

    // Track pending subscriptions
    channels.forEach(ch => this.pendingSubscriptions.add(ch));

    const message: WebSocketMessage = {
      type: 'subscribe',
      channels
    };

    this.ws.send(JSON.stringify(message));
    this.logger.info(`Subscribed to channels`, { channels });
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(message: WebSocketMessage): Promise<void> {
    switch (message.type) {
      case 'event':
        // Handle incoming event
        if (message.data) {
          const eventMessage: EventBusMessage = {
            type: 'event',
            id: message.id,
            channel: message.channel,
            timestamp: message.timestamp,
            data: message.data,
            metadata: message.metadata as EventBusMessage['metadata']
          };
          await this.processEvent(eventMessage);
        }
        break;

      case 'ack':
        // Subscription acknowledged
        if (message.channels) {
          message.channels.forEach(ch => this.pendingSubscriptions.delete(ch));
        }
        this.logger.debug('Subscription acknowledged', { channels: message.channels });
        break;

      case 'error':
        this.logger.error('Event Bus error message', { error: message.error });
        break;

      case 'pong':
        // Heartbeat response received
        this.logger.debug('Pong received from Event Bus');
        break;

      case 'ping':
        // Respond to server ping
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'pong' }));
        }
        break;

      default:
        this.logger.debug('Unknown message type', { type: message.type });
    }
  }

  /**
   * Start heartbeat ping to keep connection alive
   */
  private startHeartbeat(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          this.logger.warn('Failed to send ping', { error });
        }
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Reconnect with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnect attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.logger.info(`Reconnecting to Event Bus in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch((error) => {
        this.logger.error('Reconnection failed', { error: error.message });
      });
    }, delay);
  }

  /**
   * Stop consuming events
   */
  async stop(): Promise<void> {
    this.stopHeartbeat();

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    // Flush remaining batches
    await this.flushAllBatches();

    // Unsubscribe from channels
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const channels = Array.from(this.subscriptions.keys());
      if (channels.length > 0) {
        this.ws.send(JSON.stringify({
          type: 'unsubscribe',
          channels
        }));
      }
      this.ws.close(1000, 'Client stopping');
    }

    this.subscriptions.clear();
    this.isConnected = false;
    this.logger.info('Event consumer stopped');
  }

  /**
   * Process a single event
   */
  private async processEvent(message: EventBusMessage): Promise<void> {
    // Add to processing queue to maintain order
    this.processingQueue = this.processingQueue.then(async () => {
      try {
        if (!message.data) {
          this.logger.debug('Skipping event with no data', { id: message.id });
          return;
        }

        // Normalize the event
        const normalized = normalizeEvent(message.data);
        const timelineEvent = toTimelineEvent(normalized);

        // Add correlation ID if present
        if (message.metadata?.correlationId) {
          timelineEvent.metadata.correlationId = message.metadata.correlationId;
        }

        // Add source if present
        if (message.metadata?.source) {
          timelineEvent.metadata.source = message.metadata.source as string;
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

    if (!userId) {
      this.logger.debug('Skipping event without userId', { eventId: event.id });
      return;
    }

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
    return this.isConnected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get consumer status
   */
  getStatus(): {
    connected: boolean;
    websocketState: string;
    subscriptions: number;
    pendingSubscriptions: number;
    batchBufferSize: number;
    reconnectAttempts: number;
  } {
    let batchBufferSize = 0;
    for (const events of this.batchBuffer.values()) {
      batchBufferSize += events.length;
    }

    const stateMap: Record<number, string> = {
      [WebSocket.CONNECTING]: 'connecting',
      [WebSocket.OPEN]: 'open',
      [WebSocket.CLOSING]: 'closing',
      [WebSocket.CLOSED]: 'closed'
    };

    return {
      connected: this.isConnected,
      websocketState: this.ws ? stateMap[this.ws.readyState] || 'unknown' : 'not_initialized',
      subscriptions: this.subscriptions.size,
      pendingSubscriptions: this.pendingSubscriptions.size,
      batchBufferSize,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

export const eventConsumer = new EventConsumer();
