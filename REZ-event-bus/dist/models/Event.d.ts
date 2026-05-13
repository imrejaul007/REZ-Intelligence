/**
 * Event Model
 * Standardized event structure for the REZ Event Bus
 */
import { z } from 'zod';
import { EventTypeValue } from '../services/eventSchema';
/**
 * Event Priority Levels
 */
export declare enum EventPriority {
    HIGH = "high",
    NORMAL = "normal",
    LOW = "low"
}
/**
 * Event Status
 */
export declare enum EventStatus {
    PENDING = "pending",
    PUBLISHED = "published",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed",
    DEAD_LETTER = "dead_letter"
}
/**
 * Event Schema using Zod
 * Validates incoming event payloads
 */
export declare const EventSchema: z.ZodObject<{
    eventId: z.ZodOptional<z.ZodString>;
    eventType: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    metadata: z.ZodObject<{
        source: z.ZodString;
        timestamp: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodDate]>, string, string | Date>;
        correlationId: z.ZodOptional<z.ZodString>;
        causationId: z.ZodOptional<z.ZodString>;
        replyTo: z.ZodOptional<z.ZodString>;
        priority: z.ZodDefault<z.ZodNativeEnum<typeof EventPriority>>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        source: string;
        priority: EventPriority;
        correlationId?: string | undefined;
        causationId?: string | undefined;
        replyTo?: string | undefined;
        tags?: string[] | undefined;
    }, {
        timestamp: string | Date;
        source: string;
        correlationId?: string | undefined;
        causationId?: string | undefined;
        replyTo?: string | undefined;
        priority?: EventPriority | undefined;
        tags?: string[] | undefined;
    }>;
    version: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    metadata: {
        timestamp: string;
        source: string;
        priority: EventPriority;
        correlationId?: string | undefined;
        causationId?: string | undefined;
        replyTo?: string | undefined;
        tags?: string[] | undefined;
    };
    eventType: string;
    payload: Record<string, unknown>;
    version: string;
    eventId?: string | undefined;
}, {
    metadata: {
        timestamp: string | Date;
        source: string;
        correlationId?: string | undefined;
        causationId?: string | undefined;
        replyTo?: string | undefined;
        priority?: EventPriority | undefined;
        tags?: string[] | undefined;
    };
    eventType: string;
    payload: Record<string, unknown>;
    eventId?: string | undefined;
    version?: string | undefined;
}>;
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
    atomic: boolean;
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
export declare function createEvent(payload: EventCreatePayload): IEvent;
/**
 * Validate event type is in allowed list
 */
export declare function isValidEventType(eventType: string): eventType is EventTypeValue;
export default EventSchema;
//# sourceMappingURL=Event.d.ts.map