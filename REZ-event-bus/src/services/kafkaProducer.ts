/**
 * Kafka Producer Service
 * Handles event publishing to Kafka topics for durable event streaming
 */

import { Kafka, Producer, ProducerRecord, CompressionTypes, Partitioners } from 'kafkajs';
import { config } from '../config';
import { IEvent } from '../models/Event';
import { logger, kafkaLogger } from './logger';

/**
 * Kafka Producer Service
 */
export class KafkaProducerService {
  private kafka: Kafka;
  private producer: Producer;
  private isConnected: boolean;
  private pendingMessages: Map<string, IEvent>;

  constructor() {
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
      logLevel: 2, // WARN
    });

    this.producer = this.kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
      allowAutoTopicCreation: config.kafka.producer.allowAutoTopicCreation,
      transactionTimeout: config.kafka.producer.transactionTimeout,
    });

    this.isConnected = false;
    this.pendingMessages = new Map();
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.isConnected = true;
      kafkaLogger.info('Kafka producer connected', {
        brokers: config.kafka.brokers,
        clientId: config.kafka.clientId,
      });
    } catch (error) {
      kafkaLogger.error('Failed to connect Kafka producer', { error });
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      this.isConnected = false;
      kafkaLogger.info('Kafka producer disconnected');
    } catch (error) {
      kafkaLogger.error('Error disconnecting Kafka producer', { error });
    }
  }

  /**
   * Publish event to Kafka topic
   */
  async publish(event: IEvent, topic?: string): Promise<void> {
    const targetTopic = topic || config.kafka.topic;

    const record: ProducerRecord = {
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
      compression: CompressionTypes.GZIP,
    };

    try {
      const result = await this.producer.send(record);

      kafkaLogger.debug('Event published to Kafka', {
        eventId: event.eventId,
        eventType: event.eventType,
        topic: targetTopic,
        partition: result[0].partition,
        offset: result[0].baseOffset,
      });

      // Remove from pending if it was there
      this.pendingMessages.delete(event.eventId);
    } catch (error) {
      kafkaLogger.error('Failed to publish to Kafka', {
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
  async publishBatch(events: IEvent[], topic?: string): Promise<void> {
    const targetTopic = topic || config.kafka.topic;

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

    const record: ProducerRecord = {
      topic: targetTopic,
      messages,
      compression: CompressionTypes.GZIP,
    };

    try {
      const result = await this.producer.send(record);
      kafkaLogger.info('Batch published to Kafka', {
        count: events.length,
        topic: targetTopic,
        partitions: result.map((r) => r.partition),
      });
    } catch (error) {
      kafkaLogger.error('Failed to publish batch to Kafka', { error, count: events.length });
      throw error;
    }
  }

  /**
   * Publish with transaction support using producer transaction
   */
  async publishTransactional(
    events: IEvent[],
    transactionId: string
  ): Promise<void> {
    try {
      const transaction = await this.producer.transaction();

      for (const event of events) {
        await transaction.send({
          topic: config.kafka.topic,
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
      kafkaLogger.info('Transactional publish completed', { transactionId, count: events.length });
    } catch (error) {
      kafkaLogger.error('Transactional publish failed', { transactionId, error });
      throw error;
    }
  }

  /**
   * Create topic if not exists
   */
  async ensureTopic(topic: string): Promise<void> {
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
                { name: 'retention.ms', value: String(config.eventBus.retentionHours * 60 * 60 * 1000) },
                { name: 'cleanup.policy', value: 'delete' },
              ],
            },
          ],
        });
        kafkaLogger.info('Created Kafka topic', { topic });
      }
    } finally {
      await admin.disconnect();
    }
  }

  /**
   * Retry pending messages
   */
  async retryPending(): Promise<number> {
    const pending = Array.from(this.pendingMessages.values());
    let retried = 0;

    for (const event of pending) {
      try {
        await this.publish(event);
        retried++;
      } catch {
        // Will retry again later
      }
    }

    return retried;
  }

  /**
   * Get pending message count
   */
  getPendingCount(): number {
    return this.pendingMessages.size;
  }

  /**
   * Check connection health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const admin = this.kafka.admin();
      await admin.connect();
      await admin.listTopics();
      await admin.disconnect();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean } {
    return {
      connected: this.isConnected,
    };
  }
}

// Singleton instance
export const kafkaProducerService = new KafkaProducerService();

export default kafkaProducerService;
