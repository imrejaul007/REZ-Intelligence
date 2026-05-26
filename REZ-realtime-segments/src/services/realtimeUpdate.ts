import { logger } from '../utils/logger.js';

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { SegmentDefinition, SegmentEvaluationResult } from '../types/index.js';

// Subscriber types
export interface SegmentSubscriber {
  subscriberId: string;
  userId?: string;
  segmentIds: string[];
  callback: (event: SegmentChangeEvent) => void;
  subscribedAt: string;
  expiresAt: string;
  filter?: (event: SegmentChangeEvent) => boolean;
}

export interface SegmentChangeEvent {
  eventId: string;
  eventType: 'ENTER' | 'EXIT' | 'REFRESH' | 'UPDATE';
  userId: string;
  segmentId: string;
  segmentName: string;
  timestamp: string;
  previousMembership: boolean;
  currentMembership: boolean;
  metadata?: Record<string, unknown>;
}

export interface SubscriptionRequest {
  userId?: string;
  segmentIds?: string[];
  allSegments?: boolean;
  ttl?: number;
  filter?: (event: SegmentChangeEvent) => boolean;
}

export interface SubscriptionResponse {
  subscriberId: string;
  subscribedAt: string;
  expiresAt: string;
  segmentIds: string[];
}

export interface RealtimeUpdateConfig {
  maxSubscribers: number;
  defaultTtlSeconds: number;
  maxEventsPerSecond: number;
  eventRetentionSeconds: number;
  enableWebhooks: boolean;
  webhookBatchSize: number;
  webhookBatchIntervalMs: number;
}

// Default configuration
const DEFAULT_CONFIG: RealtimeUpdateConfig = {
  maxSubscribers: 10000,
  defaultTtlSeconds: 3600, // 1 hour
  maxEventsPerSecond: 1000,
  eventRetentionSeconds: 300, // 5 minutes
  enableWebhooks: true,
  webhookBatchSize: 100,
  webhookBatchIntervalMs: 1000,
};

// Segment change event emitter
class SegmentEventEmitter extends EventEmitter {
  private eventCount = 0;
  private lastResetTime = Date.now();

  emitSegmentEvent(event: SegmentChangeEvent): boolean {
    // Rate limiting
    const now = Date.now();
    if (now - this.lastResetTime > 1000) {
      this.eventCount = 0;
      this.lastResetTime = now;
    }

    if (this.eventCount >= DEFAULT_CONFIG.maxEventsPerSecond) {
      logger.warn('Realtime update rate limit exceeded, dropping event');
      return false;
    }

    this.eventCount++;
    this.emit('segmentChange', event);
    return true;
  }
}

// Singleton event emitter
const segmentEmitter = new SegmentEventEmitter();

// Subscription store
const subscribers = new Map<string, SegmentSubscriber>();
const userSubscriptions = new Map<string, Set<string>>(); // userId -> Set<subscriberId>
const segmentSubscriptions = new Map<string, Set<string>>(); // segmentId -> Set<subscriberId>

// Event history for late subscribers
const eventHistory: SegmentChangeEvent[] = [];
const MAX_HISTORY_SIZE = 1000;

// Configuration
let config: RealtimeUpdateConfig = { ...DEFAULT_CONFIG };

// Cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Configure realtime update settings
 */
export function configureRealtimeUpdates(newConfig: Partial<RealtimeUpdateConfig>): void {
  config = { ...config, ...newConfig };
  console.log('Realtime updates configured:', config);
}

/**
 * Start the realtime update service
 */
export function startRealtimeService(): void {
  if (cleanupInterval) {
    return; // Already running
  }

  // Clean up expired subscribers every 5 minutes
  cleanupInterval = setInterval(() => {
    cleanupExpiredSubscribers();
  }, 5 * 60 * 1000);

  logger.info('Realtime update service started');
}

/**
 * Stop the realtime update service
 */
export function stopRealtimeService(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  // Clear all subscribers
  subscribers.clear();
  userSubscriptions.clear();
  segmentSubscriptions.clear();

  logger.info('Realtime update service stopped');
}

/**
 * Subscribe to segment changes
 */
export function subscribe(
  request: SubscriptionRequest,
  callback: (event: SegmentChangeEvent) => void
): SubscriptionResponse | null {
  if (subscribers.size >= config.maxSubscribers) {
    logger.warn('Max subscribers reached, rejecting new subscription');
    return null;
  }

  const subscriberId = uuidv4();
  const now = new Date();
  const ttl = request.ttl || config.defaultTtlSeconds;
  const expiresAt = new Date(now.getTime() + ttl * 1000);

  // Determine which segments to subscribe to
  let segmentIds: string[];
  if (request.allSegments) {
    segmentIds = ['*']; // Wildcard for all segments
  } else if (request.segmentIds && request.segmentIds.length > 0) {
    segmentIds = request.segmentIds;
  } else {
    segmentIds = ['*'];
  }

  const subscriber: SegmentSubscriber = {
    subscriberId,
    userId: request.userId,
    segmentIds,
    callback,
    subscribedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    filter: request.filter,
  };

  // Store subscriber
  subscribers.set(subscriberId, subscriber);

  // Update user subscriptions
  if (request.userId) {
    if (!userSubscriptions.has(request.userId)) {
      userSubscriptions.set(request.userId, new Set());
    }
    userSubscriptions.get(request.userId)!.add(subscriberId);
  }

  // Update segment subscriptions
  for (const segmentId of segmentIds) {
    if (!segmentSubscriptions.has(segmentId)) {
      segmentSubscriptions.set(segmentId, new Set());
    }
    segmentSubscriptions.get(segmentId)!.add(subscriberId);
  }

  // Listen to events
  const eventHandler = (event: SegmentChangeEvent) => {
    const sub = subscribers.get(subscriberId);
    if (!sub) {
      segmentEmitter.off('segmentChange', eventHandler);
      return;
    }

    // Check if subscriber still valid
    if (new Date() > new Date(sub.expiresAt)) {
      unsubscribe(subscriberId);
      segmentEmitter.off('segmentChange', eventHandler);
      return;
    }

    // Check if subscriber is interested in this segment
    const interested = sub.segmentIds.includes('*') || sub.segmentIds.includes(event.segmentId);
    if (!interested) {
      return;
    }

    // Check user filter if specified
    if (sub.filter && !sub.filter(event)) {
      return;
    }

    // Call the callback
    try {
      sub.callback(event);
    } catch (error) {
      console.error(`Error in subscriber callback for ${subscriberId}:`, error);
    }
  };

  segmentEmitter.on('segmentChange', eventHandler);

  return {
    subscriberId,
    subscribedAt: subscriber.subscribedAt,
    expiresAt: subscriber.expiresAt,
    segmentIds,
  };
}

/**
 * Unsubscribe from segment changes
 */
export function unsubscribe(subscriberId: string): boolean {
  const subscriber = subscribers.get(subscriberId);
  if (!subscriber) {
    return false;
  }

  // Remove from user subscriptions
  if (subscriber.userId) {
    const userSubs = userSubscriptions.get(subscriber.userId);
    if (userSubs) {
      userSubs.delete(subscriberId);
      if (userSubs.size === 0) {
        userSubscriptions.delete(subscriber.userId);
      }
    }
  }

  // Remove from segment subscriptions
  for (const segmentId of subscriber.segmentIds) {
    const segmentSubs = segmentSubscriptions.get(segmentId);
    if (segmentSubs) {
      segmentSubs.delete(subscriberId);
      if (segmentSubs.size === 0) {
        segmentSubscriptions.delete(segmentId);
      }
    }
  }

  // Remove subscriber
  subscribers.delete(subscriberId);

  return true;
}

/**
 * Unsubscribe a user from all segments
 */
export function unsubscribeUser(userId: string): number {
  const userSubs = userSubscriptions.get(userId);
  if (!userSubs) {
    return 0;
  }

  let count = 0;
  for (const subscriberId of userSubs) {
    if (unsubscribe(subscriberId)) {
      count++;
    }
  }

  return count;
}

/**
 * Emit a segment change event
 */
export function emitSegmentChange(
  userId: string,
  segmentId: string,
  segmentName: string,
  entered: boolean,
  previousMembership: boolean,
  metadata?: Record<string, unknown>
): void {
  const event: SegmentChangeEvent = {
    eventId: uuidv4(),
    eventType: entered ? 'ENTER' : 'EXIT',
    userId,
    segmentId,
    segmentName,
    timestamp: new Date().toISOString(),
    previousMembership,
    currentMembership: entered,
    metadata,
  };

  // Add to history
  eventHistory.push(event);
  if (eventHistory.length > MAX_HISTORY_SIZE) {
    eventHistory.shift();
  }

  // Emit to subscribers
  segmentEmitter.emitSegmentEvent(event);
}

/**
 * Emit a segment refresh event
 */
export function emitSegmentRefresh(
  segmentId: string,
  segmentName: string,
  metadata?: Record<string, unknown>
): void {
  const event: SegmentChangeEvent = {
    eventId: uuidv4(),
    eventType: 'REFRESH',
    userId: '*',
    segmentId,
    segmentName,
    timestamp: new Date().toISOString(),
    previousMembership: false,
    currentMembership: false,
    metadata,
  };

  eventHistory.push(event);
  if (eventHistory.length > MAX_HISTORY_SIZE) {
    eventHistory.shift();
  }

  segmentEmitter.emitSegmentEvent(event);
}

/**
 * Emit a segment update event
 */
export function emitSegmentUpdate(
  segment: SegmentDefinition,
  metadata?: Record<string, unknown>
): void {
  const event: SegmentChangeEvent = {
    eventId: uuidv4(),
    eventType: 'UPDATE',
    userId: '*',
    segmentId: segment.segmentId,
    segmentName: segment.name,
    timestamp: new Date().toISOString(),
    previousMembership: false,
    currentMembership: false,
    metadata,
  };

  eventHistory.push(event);
  if (eventHistory.length > MAX_HISTORY_SIZE) {
    eventHistory.shift();
  }

  segmentEmitter.emitSegmentEvent(event);
}

/**
 * Get recent events for late subscriber catch-up
 */
export function getRecentEvents(
  since?: string,
  segmentId?: string,
  userId?: string
): SegmentChangeEvent[] {
  let sinceTime = 0;
  if (since) {
    sinceTime = new Date(since).getTime();
  }

  return eventHistory.filter((event) => {
    const eventTime = new Date(event.timestamp).getTime();
    if (sinceTime && eventTime <= sinceTime) {
      return false;
    }

    if (segmentId && event.segmentId !== segmentId) {
      return false;
    }

    if (userId && event.userId !== userId) {
      return false;
    }

    return true;
  });
}

/**
 * Get subscription statistics
 */
export function getSubscriptionStats(): {
  totalSubscribers: number;
  bySegment: Record<string, number>;
  byUser: Record<string, number>;
  recentEvents: number;
} {
  const bySegment: Record<string, number> = {};
  const byUser: Record<string, number> = {};

  for (const [segmentId, subs] of segmentSubscriptions) {
    bySegment[segmentId] = subs.size;
  }

  for (const [userId, subs] of userSubscriptions) {
    byUser[userId] = subs.size;
  }

  return {
    totalSubscribers: subscribers.size,
    bySegment,
    byUser,
    recentEvents: eventHistory.length,
  };
}

/**
 * Get subscriber by ID
 */
export function getSubscriber(subscriberId: string): SegmentSubscriber | null {
  return subscribers.get(subscriberId) || null;
}

/**
 * Refresh subscriber TTL
 */
export function refreshSubscription(subscriberId: string, ttlSeconds?: number): boolean {
  const subscriber = subscribers.get(subscriberId);
  if (!subscriber) {
    return false;
  }

  const ttl = ttlSeconds || config.defaultTtlSeconds;
  subscriber.expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  return true;
}

/**
 * Cleanup expired subscribers
 */
function cleanupExpiredSubscribers(): void {
  const now = new Date();
  let cleanedCount = 0;

  for (const [subscriberId, subscriber] of subscribers) {
    if (now > new Date(subscriber.expiresAt)) {
      unsubscribe(subscriberId);
      cleanedCount++;
    }
  }

  // Clean up old events
  const cutoffTime = Date.now() - config.eventRetentionSeconds * 1000;
  while (eventHistory.length > 0 && new Date(eventHistory[0].timestamp).getTime() < cutoffTime) {
    eventHistory.shift();
  }

  if (cleanedCount > 0) {
    logger.info(`Cleaned up ${cleanedCount} expired subscribers`);
  }
}

/**
 * Process segment evaluation results and emit events
 */
export function processSegmentEvaluationResults(
  userId: string,
  segmentId: string,
  segmentName: string,
  previousMembership: boolean,
  currentMembership: boolean,
  evaluationResults: SegmentEvaluationResult[]
): void {
  for (const result of evaluationResults) {
    if (result.segmentId === segmentId || segmentId === '*') {
      emitSegmentChange(
        userId,
        result.segmentId,
        result.segmentName,
        result.matches,
        previousMembership
      );
    }
  }
}

/**
 * Create a webhook-compatible event from a segment change
 */
export function createWebhookPayload(
  event: SegmentChangeEvent,
  webhookId?: string
): Record<string, unknown> {
  return {
    webhookId,
    event: {
      type: `segment.${event.eventType.toLowerCase()}`,
      id: event.eventId,
      timestamp: event.timestamp,
      data: {
        userId: event.userId,
        segmentId: event.segmentId,
        segmentName: event.segmentName,
        membership: {
          previous: event.previousMembership,
          current: event.currentMembership,
        },
        metadata: event.metadata,
      },
    },
  };
}

/**
 * Get events by user
 */
export function getUserEvents(
  userId: string,
  limit = 100,
  since?: string
): SegmentChangeEvent[] {
  let sinceTime = 0;
  if (since) {
    sinceTime = new Date(since).getTime();
  }

  return eventHistory
    .filter((event) => {
      if (event.userId !== userId) return false;
      if (sinceTime && new Date(event.timestamp).getTime() <= sinceTime) return false;
      return true;
    })
    .slice(-limit);
}

/**
 * Batch subscribe for multiple segments
 */
export function batchSubscribe(
  requests: SubscriptionRequest[],
  callback: (event: SegmentChangeEvent) => void
): SubscriptionResponse[] {
  const responses: SubscriptionResponse[] = [];

  for (const request of requests) {
    const response = subscribe(request, callback);
    if (response) {
      responses.push(response);
    }
  }

  return responses;
}

/**
 * Health check for realtime service
 */
export function getRealtimeHealth(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  subscribers: number;
  eventQueue: number;
  uptime: number;
} {
  const subscriberCount = subscribers.size;
  const eventQueueSize = eventHistory.length;

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (subscriberCount >= config.maxSubscribers * 0.9) {
    status = 'degraded';
  }
  if (subscriberCount >= config.maxSubscribers) {
    status = 'unhealthy';
  }

  return {
    status,
    subscribers: subscriberCount,
    eventQueue: eventQueueSize,
    uptime: process.uptime(),
  };
}

export default {
  configureRealtimeUpdates,
  startRealtimeService,
  stopRealtimeService,
  subscribe,
  unsubscribe,
  unsubscribeUser,
  emitSegmentChange,
  emitSegmentRefresh,
  emitSegmentUpdate,
  getRecentEvents,
  getSubscriptionStats,
  getSubscriber,
  refreshSubscription,
  processSegmentEvaluationResults,
  createWebhookPayload,
  getUserEvents,
  batchSubscribe,
  getRealtimeHealth,
};
