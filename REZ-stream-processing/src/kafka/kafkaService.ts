/**
 * REZ Stream Processing - Kafka Service
 * Kafka producer and consumer management
 */

import { Kafka, Producer, Consumer, Admin, logLevel } from 'kafkajs';
import { logger } from '../utils/logger.js';

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'rez-stream-processing';
const KAFKA_GROUP_ID = process.env.KAFKA_GROUP_ID || 'rez-stream-consumer';

export interface KafkaConnectionConfig {
  brokers: string[];
  clientId: string;
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
}

export class KafkaService {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private admin: Admin | null = null;
  private connected = false;
  private messageHandlers: Map<string, (message: unknown) => Promise<void>> = new Map();

  constructor() {
    this.kafka = new Kafka({
      clientId: KAFKA_CLIENT_ID,
      brokers: KAFKA_BROKERS,
      logLevel: logLevel.WARN,
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      // Initialize producer
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: true,
        transactionTimeout: 30000,
      });

      await this.producer.connect();
      logger.info('Kafka producer connected', { brokers: KAFKA_BROKERS });

      // Initialize admin for topic management
      this.admin = this.kafka.admin();
      await this.admin.connect();
      logger.info('Kafka admin connected');

      this.connected = true;
    } catch (error) {
      logger.error('Kafka connection failed', { error });
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    try {
      if (this.producer) {
        await this.producer.disconnect();
        this.producer = null;
      }
      if (this.consumer) {
        await this.consumer.disconnect();
        this.consumer = null;
      }
      if (this.admin) {
        await this.admin.disconnect();
        this.admin = null;
      }
      this.connected = false;
      logger.info('Kafka disconnected');
    } catch (error) {
      logger.error('Kafka disconnect error', { error });
    }
  }

  /**
   * Check if Kafka is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  // ============================================
  // TOPIC MANAGEMENT
  // ============================================

  /**
   * Create topics if they don't exist
   */
  async createTopics(topics: string[]): Promise<void> {
    if (!this.admin) throw new Error('Kafka admin not connected');

    try {
      const existingTopics = await this.admin.listTopics();
      const topicsToCreate = topics.filter(t => !existingTopics.includes(t));

      if (topicsToCreate.length > 0) {
        await this.admin.createTopics({
          topics: topicsToCreate.map(topic => ({
            topic,
            numPartitions: 3,
            replicationFactor: 1,
            configEntries: [
              { name: 'retention.ms', value: '604800000' }, // 7 days
              { name: 'cleanup.policy', value: 'delete' }
            ]
          }))
        });
        logger.info('Topics created', { topics: topicsToCreate });
      }
    } catch (error) {
      logger.error('Topic creation failed', { error });
    }
  }

  /**
   * List all topics
   */
  async listTopics(): Promise<string[]> {
    if (!this.admin) throw new Error('Kafka admin not connected');
    return this.admin.listTopics();
  }

  // ============================================
  // PRODUCER OPERATIONS
  // ============================================

  /**
   * Send message to topic
   */
  async send(topic: string, message: {
    key?: string;
    value: Record<string, unknown>;
    headers?: Record<string, string>;
  }): Promise<void> {
    if (!this.producer) throw new Error('Kafka producer not connected');

    try {
      await this.producer.send({
        topic,
        messages: [{
          key: message.key || null,
          value: JSON.stringify({
            ...message.value,
            _timestamp: new Date().toISOString(),
            _source: KAFKA_CLIENT_ID
          }),
          headers: message.headers
        }]
      });

      logger.debug('Message sent', { topic, key: message.key });
    } catch (error) {
      logger.error('Message send failed', { topic, error });
      throw error;
    }
  }

  /**
   * Send batch messages
   */
  async sendBatch(topic: string, messages: Array<{
    key?: string;
    value: Record<string, unknown>;
  }>): Promise<void> {
    if (!this.producer) throw new Error('Kafka producer not connected');

    try {
      await this.producer.send({
        topic,
        messages: messages.map(msg => ({
          key: msg.key || null,
          value: JSON.stringify({
            ...msg.value,
            _timestamp: new Date().toISOString(),
            _source: KAFKA_CLIENT_ID
          })
        }))
      });

      logger.debug('Batch sent', { topic, count: messages.length });
    } catch (error) {
      logger.error('Batch send failed', { topic, error });
      throw error;
    }
  }

  // ============================================
  // CONSUMER OPERATIONS
  // ============================================

  /**
   * Create and start a consumer
   */
  async createConsumer(groupId: string, topics: string[]): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect();
    }

    this.consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    await this.consumer.connect();
    logger.info('Consumer connected', { groupId, topics });

    // Subscribe to topics
    for (const topic of topics) {
      await this.consumer.subscribe({ topic, fromBeginning: false });
    }
  }

  /**
   * Start consuming messages
   */
  async startConsumer(handler: (topic: string, message: Record<string, unknown>) => Promise<void>): Promise<void> {
    if (!this.consumer) throw new Error('Consumer not created');

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = message.value?.toString();
          if (!value) return;

          const data = JSON.parse(value);
          await handler(topic, data);

          logger.debug('Message consumed', {
            topic,
            partition,
            offset: message.offset
          });
        } catch (error) {
          logger.error('Message processing failed', {
            topic,
            partition,
            offset: message.offset,
            error
          });
        }
      }
    });

    logger.info('Consumer started');
  }

  /**
   * Stop consumer
   */
  async stopConsumer(): Promise<void> {
    if (this.consumer) {
      await this.consumer.stop();
      logger.info('Consumer stopped');
    }
  }
}

export const kafkaService = new KafkaService();
