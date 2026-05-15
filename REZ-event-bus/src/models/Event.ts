/**
 * Event Model
 * Standardized event structure for the REZ Event Bus
 */

import { z } from 'zod';
import { EventType, EventTypeValue } from '../services/eventSchema';

/**
 * Event Priority Levels
 */
export enum EventPriority {
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
}

/**
 * Event Status
 */
export enum EventStatus {
  PENDING = 'pending',
  PUBLISHED = 'published',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DEAD_LETTER = 'dead_letter',
}

/**
 * Event Schema using Zod
 * Validates incoming event payloads
 */
export const EventSchema = z.object({
  eventId: z.string().uuid().optional(),
  eventType: z.string().min(1).max(100),
  payload: z.record(z.unknown()),
  metadata: z.object({
    source: z.string().min(1),
    timestamp: z.string().datetime().or(z.date()).transform(val => val instanceof Date ? val.toISOString() : val),
    correlationId: z.string().uuid().optional(),
    causationId: z.string().uuid().optional(),
    replyTo: z.string().optional(),
    priority: z.nativeEnum(EventPriority).default(EventPriority.NORMAL),
    tags: z.array(z.string()).optional(),
  }),
  version: z.string().default('1.0'),
});

/**
 * Event Interface
 */
export interface IEvent {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  metadata: EventMetadata;
  version: string;
  status?: EventStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Event Metadata Interface
 */
export interface EventMetadata {
  source: string;
  timestamp: string;
  correlationId?: string;
  causationId?: string;
  replyTo?: string;
  priority?: EventPriority;
  tags?: string[];
}

/**
 * Event Creation Payload
 */
export interface EventCreatePayload {
  eventType: string;
  payload: Record<string, unknown>;
  source: string;
  correlationId?: string;
  causationId?: string;
  priority?: EventPriority;
  tags?: string[];
}

/**
 * Event Response
 */
export interface EventResponse {
  success: boolean;
  eventId: string;
  eventType: string;
  timestamp: string;
  metadata: EventMetadata;
}

/**
 * Event Query Options
 */
export interface EventQueryOptions {
  eventType?: string;
  source?: string;
  correlationId?: string;
  startDate?: Date;
  endDate?: Date;
  status?: EventStatus;
  limit?: number;
  offset?: number;
}

/**
 * In-Memory Event Store (for Redis backup)
 * Events are stored in Redis with TTL for replay capability
 */
export interface StoredEvent {
  key: string;
  event: IEvent;
  ttl: number;
}

/**
 * Event Statistics
 */
export interface EventStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySource: Record<string, number>;
  eventsByStatus: Record<string, number>;
  avgPayloadSize: number;
}

/**
 * Batch Event Publish Payload
 */
export interface BatchEventPayload {
  events: EventCreatePayload[];
  atomic: boolean; // If true, all events succeed or all fail
}

/**
 * Event Subscription Acknowledgment
 */
export interface EventAck {
  eventId: string;
  subscriberId: string;
  status: 'acknowledged' | 'processed' | 'failed';
  timestamp: string;
  error?: string;
}

/**
 * Helper function to create a new event
 */
export function createEvent(payload: EventCreatePayload): IEvent {
  const { v4: uuidv4 } = require('uuid');
  return {
    eventId: uuidv4(),
    eventType: payload.eventType,
    payload: payload.payload,
    metadata: {
      source: payload.source,
      timestamp: new Date().toISOString(),
      correlationId: payload.correlationId,
      causationId: payload.causationId,
      priority: payload.priority || EventPriority.NORMAL,
      tags: payload.tags || [],
    },
    version: '1.0',
    status: EventStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Validate event type is in allowed list
 */
export function isValidEventType(eventType: string): eventType is EventTypeValue {
  const validTypes = [
    // Existing types
    'USER_MESSAGE_RECEIVED',
    'USER_MESSAGE_SENT',
    'INTENT_DETECTED',
    'AGENT_SELECTED',
    'AGENT_SWITCHED',
    'COLLABORATION_STARTED',
    'ORDER_CREATED',
    'ORDER_COMPLETED',
    'PAYMENT_INITIATED',
    'PAYMENT_COMPLETED',
    'SERVICE_HEALTH_CHANGED',
    // New event types
    'offer.shared',
    'offer.opened',
    'referral.clicked',
    'referral.signed_up',
    'referral.purchased',
    'location.visited',
    'location.dwell',
    'search.performed',
    'wishlist.added',
    'wishlist.removed',
    'price.alert_set',
    'price.alert_triggered',
    'review.submitted',
    'review.viewed',
    'profile.updated',
    'feedback.given',
    'subscription.started',
    'subscription.renewed',
    'subscription.cancelled',
    'membership.upgraded',
    'membership.downgraded',
    'loyalty.redeemed',
    'loyalty.earned',
    'competitor.visited',
    'competitor.switched',
    'app.installed',
    'app.opened',
    'content.viewed',
    'content.shared',
    'campaign.started',
    'campaign.completed',
    'survey.started',
    'survey.completed',
  ];
  return validTypes.includes(eventType);
}

export default EventSchema;
