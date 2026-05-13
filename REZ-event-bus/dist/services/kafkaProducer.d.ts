/**
 * Kafka Producer Service
 * Handles event publishing to Kafka topics for durable event streaming
 */
import { IEvent } from '../models/Event';
/**
 * Kafka Producer Service
 */
export declare class KafkaProducerService {
    private kafka;
    private producer;
    private isConnected;
    private pendingMessages;
    constructor();
    /**
     * Connect to Kafka
     */
    connect(): Promise<void>;
    /**
     * Disconnect from Kafka
     */
    disconnect(): Promise<void>;
    /**
     * Publish event to Kafka topic
     */
    publish(event: IEvent, topic?: string): Promise<void>;
    /**
     * Publish batch of events
     */
    publishBatch(events: IEvent[], topic?: string): Promise<void>;
    /**
     * Publish with transaction support using producer transaction
     */
    publishTransactional(events: IEvent[], transactionId: string): Promise<void>;
    /**
     * Create topic if not exists
     */
    ensureTopic(topic: string): Promise<void>;
    /**
     * Retry pending messages
     */
    retryPending(): Promise<number>;
    /**
     * Get pending message count
     */
    getPendingCount(): number;
    /**
     * Check connection health
     */
    healthCheck(): Promise<boolean>;
    /**
     * Get connection status
     */
    getStatus(): {
        connected: boolean;
    };
}
export declare const kafkaProducerService: KafkaProducerService;
export default kafkaProducerService;
//# sourceMappingURL=kafkaProducer.d.ts.map