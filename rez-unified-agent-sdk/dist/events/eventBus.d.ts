import type { Logger, EventPayload } from '../types';
export type EventHandler = (payload: EventPayload) => void | Promise<void>;
export interface Subscription {
    id: string;
    eventType: string;
    handler: EventHandler;
    pattern?: string;
}
export interface EventBusConfig {
    logger?: Logger;
    timeout?: number;
}
export declare class EventBus {
    private emitter;
    private subscriptions;
    private logger;
    private eventHistory;
    private maxHistorySize;
    private config;
    constructor(config?: EventBusConfig);
    /**
     * Subscribe to an event type
     */
    on(eventType: string, handler: EventHandler): () => void;
    /**
     * Subscribe to an event type only once
     */
    once(eventType: string, handler: EventHandler): () => void;
    /**
     * Subscribe to event pattern (e.g., 'agent.*')
     */
    onPattern(pattern: string, handler: EventHandler): () => void;
    /**
     * Unsubscribe by subscription ID
     */
    off(subscriptionId: string): boolean;
    /**
     * Publish an event
     */
    emit(eventType: string, payload: unknown, metadata?: Record<string, unknown>): Promise<void>;
    /**
     * Get event history
     */
    getHistory(limit?: number): EventPayload[];
    /**
     * Get subscriptions count
     */
    getSubscriptionCount(): number;
    /**
     * Get subscriptions for an event type
     */
    getSubscriptions(eventType?: string): Subscription[];
    /**
     * Clear all subscriptions
     */
    clear(): void;
    /**
     * Remove event from history
     */
    private addToHistory;
    /**
     * Create handler wrapper with error handling
     */
    private createHandlerWrapper;
}
export interface EventPublisherConfig {
    endpoints?: {
        kafka?: string;
        redis?: string;
        nats?: string;
    };
    logger?: Logger;
}
export declare class EventPublisher {
    private eventBus;
    private logger;
    private externalEndpoints?;
    private useExternal;
    constructor(eventBus: EventBus, config?: EventPublisherConfig);
    /**
     * Publish event to both internal bus and external system
     */
    publish(eventType: string, payload: unknown, options?: {
        source?: string;
        correlationId?: string;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
    /**
     * Subscribe to events
     */
    on(eventType: string, handler: EventHandler): () => void;
    /**
     * Subscribe once
     */
    once(eventType: string, handler: EventHandler): () => void;
    /**
     * Subscribe to pattern
     */
    onPattern(pattern: string, handler: EventHandler): () => void;
    /**
     * Get event history
     */
    getHistory(limit?: number): EventPayload[];
    /**
     * Publish to external system (Kafka/Redis/NATS)
     */
    private publishExternal;
}
export declare const AGENT_EVENTS: {
    readonly ACTION_STARTED: "agent.action.started";
    readonly ACTION_COMPLETED: "agent.action.completed";
    readonly ACTION_FAILED: "agent.action.failed";
    readonly INTENT_DETECTED: "agent.intent.detected";
    readonly INTENT_CONFIRMED: "agent.intent.confirmed";
    readonly DECISION_MADE: "agent.decision.made";
    readonly ERROR_OCCURRED: "agent.error.occurred";
};
export declare const PAYMENT_EVENTS: {
    readonly INITIATED: "payment.initiated";
    readonly COMPLETED: "payment.completed";
    readonly FAILED: "payment.failed";
    readonly REFUNDED: "payment.refunded";
};
export declare const ORDER_EVENTS: {
    readonly CREATED: "order.created";
    readonly CONFIRMED: "order.confirmed";
    readonly SHIPPED: "order.shipped";
    readonly DELIVERED: "order.delivered";
    readonly CANCELLED: "order.cancelled";
};
export declare const BOOKING_EVENTS: {
    readonly CREATED: "booking.created";
    readonly CONFIRMED: "booking.confirmed";
    readonly CANCELLED: "booking.cancelled";
    readonly COMPLETED: "booking.completed";
};
export declare const NOTIFICATION_EVENTS: {
    readonly SENT: "notification.sent";
    readonly DELIVERED: "notification.delivered";
    readonly FAILED: "notification.failed";
};
export declare function createEventBus(config?: EventBusConfig): EventBus;
export declare function createEventPublisher(eventBus: EventBus, config?: EventPublisherConfig): EventPublisher;
//# sourceMappingURL=eventBus.d.ts.map