/**
 * Redis Pub/Sub Service
 * Handles real-time event distribution via Redis pub/sub
 */
import { IEvent } from '../models/Event';
/**
 * Redis Pub/Sub Service
 */
export declare class RedisPubSubService {
    private publisher;
    private subscriber;
    private subscriptionHandlers;
    private patternHandlers;
    private isConnected;
    constructor();
    /**
     * Create Redis client with configuration
     */
    private createRedisClient;
    /**
     * Connect to Redis
     */
    connect(): Promise<void>;
    /**
     * Setup subscriber with message handlers
     */
    private setupSubscriber;
    /**
     * Handle incoming message
     */
    private handleMessage;
    /**
     * Handle pattern-matched message
     */
    private handlePatternMessage;
    /**
     * Publish event to a channel
     */
    publish(channel: string, event: IEvent): Promise<number>;
    /**
     * Publish to multiple channels
     */
    publishToChannels(channels: string[], event: IEvent): Promise<number[]>;
    /**
     * Subscribe to a channel
     */
    subscribe(channel: string, handler: (event: IEvent, channel: string) => void): Promise<void>;
    /**
     * Unsubscribe from a channel
     */
    unsubscribe(channel: string, handler?: (event: IEvent, channel: string) => void): Promise<void>;
    /**
     * Subscribe to pattern
     */
    psubscribe(pattern: string, handler: (event: IEvent, channel: string) => void): Promise<void>;
    /**
     * Unsubscribe from pattern
     */
    punsubscribe(pattern: string, handler?: (event: IEvent, channel: string) => void): Promise<void>;
    /**
     * Get subscriber count for a channel
     */
    getSubscriberCount(channel: string): Promise<number>;
    /**
     * Store event for replay capability
     */
    storeEvent(event: IEvent): Promise<void>;
    /**
     * Retrieve stored event
     */
    getStoredEvent(eventId: string, eventType: string): Promise<IEvent | null>;
    /**
     * Get event history
     */
    getEventHistory(eventType?: string, limit?: number, offset?: number): Promise<IEvent[]>;
    /**
     * Check connection health
     */
    healthCheck(): Promise<boolean>;
    /**
     * Disconnect from Redis
     */
    disconnect(): Promise<void>;
    /**
     * Get connection status
     */
    getStatus(): {
        connected: boolean;
        publisher: boolean;
        subscriber: boolean;
    };
}
export declare const redisPubSubService: RedisPubSubService;
export default redisPubSubService;
//# sourceMappingURL=redisPubSub.d.ts.map