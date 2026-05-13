/**
 * Publisher Service
 * High-level event publishing service combining Redis and Kafka
 */
import { EventCreatePayload } from '../models/Event';
import { EventTypeValue } from './eventSchema';
import { RedisPubSubService } from './redisPubSub';
import { KafkaProducerService } from './kafkaProducer';
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
export declare class PublisherService {
    private redisPubSub;
    private kafkaProducer;
    private publishedEvents;
    private failedEvents;
    constructor(redisPubSub: RedisPubSubService, kafkaProducer: KafkaProducerService);
    /**
     * Publish a single event
     */
    publish(payload: EventCreatePayload): Promise<PublishResult>;
    /**
     * Publish batch of events
     */
    publishBatch(payloads: EventCreatePayload[], atomic?: boolean): Promise<{
        results: PublishResult[];
        success: boolean;
    }>;
    /**
     * Publish high-priority event
     */
    publishUrgent(eventType: EventTypeValue, payload: Record<string, unknown>, source: string, correlationId?: string): Promise<PublishResult>;
    /**
     * Get publisher statistics
     */
    getStats(): {
        publishedEvents: number;
        failedEvents: number;
        successRate: number;
    };
    /**
     * Reset statistics
     */
    resetStats(): void;
}
export declare function initPublisherService(redisPubSub: RedisPubSubService, kafkaProducer: KafkaProducerService): PublisherService;
export declare function getPublisherService(): PublisherService;
export default PublisherService;
//# sourceMappingURL=publisher.d.ts.map