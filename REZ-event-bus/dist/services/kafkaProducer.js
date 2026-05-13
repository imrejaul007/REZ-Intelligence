"use strict";
/**
 * Kafka Producer Service
 * Handles event publishing to Kafka topics for durable event streaming
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.kafkaProducerService = exports.KafkaProducerService = void 0;
const kafkajs_1 = require("kafkajs");
const config_1 = require("../config");
const logger_1 = require("./logger");
/**
 * Kafka Producer Service
 */
class KafkaProducerService {
    kafka;
    producer;
    isConnected;
    pendingMessages;
    constructor() {
        this.kafka = new kafkajs_1.Kafka({
            clientId: config_1.config.kafka.clientId,
            brokers: config_1.config.kafka.brokers,
            retry: {
                initialRetryTime: 100,
                retries: 8,
            },
            logLevel: 2, // WARN
        });
        this.producer = this.kafka.producer({
            createPartitioner: kafkajs_1.Partitioners.DefaultPartitioner,
            allowAutoTopicCreation: config_1.config.kafka.producer.allowAutoTopicCreation,
            transactionTimeout: config_1.config.kafka.producer.transactionTimeout,
        });
        this.isConnected = false;
        this.pendingMessages = new Map();
    }
    /**
     * Connect to Kafka
     */
    async connect() {
        try {
            await this.producer.connect();
            this.isConnected = true;
            logger_1.kafkaLogger.info('Kafka producer connected', {
                brokers: config_1.config.kafka.brokers,
                clientId: config_1.config.kafka.clientId,
            });
        }
        catch (error) {
            logger_1.kafkaLogger.error('Failed to connect Kafka producer', { error });
            throw error;
        }
    }
    /**
     * Disconnect from Kafka
     */
    async disconnect() {
        try {
            await this.producer.disconnect();
            this.isConnected = false;
            logger_1.kafkaLogger.info('Kafka producer disconnected');
        }
        catch (error) {
            logger_1.kafkaLogger.error('Error disconnecting Kafka producer', { error });
        }
    }
    /**
     * Publish event to Kafka topic
     */
    async publish(event, topic) {
        const targetTopic = topic || config_1.config.kafka.topic;
        const record = {
            topic: targetTopic,
            messages: [
                {
                    key: event.eventId,
                    value: JSON.stringify(event),
                    headers: {
                        eventType: event.eventType,
                        source: event.metadata.source,
                        correlationId: event.metadata.correlationId || '',
                        priority: event.metadata.priority || 'normal',
                        timestamp: event.metadata.timestamp,
                    },
                    timestamp: new Date(event.metadata.timestamp).getTime().toString(),
                },
            ],
            compression: kafkajs_1.CompressionTypes.GZIP,
        };
        try {
            const result = await this.producer.send(record);
            logger_1.kafkaLogger.debug('Event published to Kafka', {
                eventId: event.eventId,
                eventType: event.eventType,
                topic: targetTopic,
                partition: result[0].partition,
                offset: result[0].baseOffset,
            });
            // Remove from pending if it was there
            this.pendingMessages.delete(event.eventId);
        }
        catch (error) {
            logger_1.kafkaLogger.error('Failed to publish to Kafka', {
                eventId: event.eventId,
                error,
            });
            // Store for retry
            this.pendingMessages.set(event.eventId, event);
            throw error;
        }
    }
    /**
     * Publish batch of events
     */
    async publishBatch(events, topic) {
        const targetTopic = topic || config_1.config.kafka.topic;
        const messages = events.map((event) => ({
            key: event.eventId,
            value: JSON.stringify(event),
            headers: {
                eventType: event.eventType,
                source: event.metadata.source,
                correlationId: event.metadata.correlationId || '',
                priority: event.metadata.priority || 'normal',
                timestamp: event.metadata.timestamp,
            },
            timestamp: new Date(event.metadata.timestamp).getTime().toString(),
        }));
        const record = {
            topic: targetTopic,
            messages,
            compression: kafkajs_1.CompressionTypes.GZIP,
        };
        try {
            const result = await this.producer.send(record);
            logger_1.kafkaLogger.info('Batch published to Kafka', {
                count: events.length,
                topic: targetTopic,
                partitions: result.map((r) => r.partition),
            });
        }
        catch (error) {
            logger_1.kafkaLogger.error('Failed to publish batch to Kafka', { error, count: events.length });
            throw error;
        }
    }
    /**
     * Publish with transaction support using producer transaction
     */
    async publishTransactional(events, transactionId) {
        try {
            const transaction = await this.producer.transaction();
            for (const event of events) {
                await transaction.send({
                    topic: config_1.config.kafka.topic,
                    messages: [
                        {
                            key: event.eventId,
                            value: JSON.stringify(event),
                            headers: {
                                transactionId,
                                eventType: event.eventType,
                                source: event.metadata.source,
                            },
                        },
                    ],
                });
            }
            await transaction.commit();
            logger_1.kafkaLogger.info('Transactional publish completed', { transactionId, count: events.length });
        }
        catch (error) {
            logger_1.kafkaLogger.error('Transactional publish failed', { transactionId, error });
            throw error;
        }
    }
    /**
     * Create topic if not exists
     */
    async ensureTopic(topic) {
        const admin = this.kafka.admin();
        try {
            await admin.connect();
            const topics = await admin.listTopics();
            if (!topics.includes(topic)) {
                await admin.createTopics({
                    topics: [
                        {
                            topic,
                            numPartitions: 3,
                            replicationFactor: 1, // Adjust for production
                            configEntries: [
                                { name: 'retention.ms', value: String(config_1.config.eventBus.retentionHours * 60 * 60 * 1000) },
                                { name: 'cleanup.policy', value: 'delete' },
                            ],
                        },
                    ],
                });
                logger_1.kafkaLogger.info('Created Kafka topic', { topic });
            }
        }
        finally {
            await admin.disconnect();
        }
    }
    /**
     * Retry pending messages
     */
    async retryPending() {
        const pending = Array.from(this.pendingMessages.values());
        let retried = 0;
        for (const event of pending) {
            try {
                await this.publish(event);
                retried++;
            }
            catch {
                // Will retry again later
            }
        }
        return retried;
    }
    /**
     * Get pending message count
     */
    getPendingCount() {
        return this.pendingMessages.size;
    }
    /**
     * Check connection health
     */
    async healthCheck() {
        try {
            const admin = this.kafka.admin();
            await admin.connect();
            await admin.listTopics();
            await admin.disconnect();
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get connection status
     */
    getStatus() {
        return {
            connected: this.isConnected,
        };
    }
}
exports.KafkaProducerService = KafkaProducerService;
// Singleton instance
exports.kafkaProducerService = new KafkaProducerService();
exports.default = exports.kafkaProducerService;
//# sourceMappingURL=kafkaProducer.js.map