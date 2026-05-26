/**
 * REZ Feedback Collector - Kafka Integration
 * Real-time feedback processing via Kafka
 */

import { Kafka, logLevel } from 'kafkajs';
import { logger } from './utils/logger.js';

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'rez-feedback-collector';
const KAFKA_GROUP_ID = process.env.KAFKA_GROUP_ID || 'rez-feedback-consumer';

export interface FeedbackEvent {
  eventId: string;
  eventType: 'conversion' | 'recommendation' | 'model' | 'nudge';
  timestamp: string;
  data: Record<string, unknown>;
}

export class KafkaIntegration {
  private kafka: Kafka;
  private producer: ReturnType<Kafka['producer']> | null = null;
  private consumer: ReturnType<Kafka['consumer']> | null = null;
  private connected = false;

  // Topic names
  readonly TOPICS = {
    CONVERSION: 'commerce.conversions',
    RECOMMENDATION_FEEDBACK: 'intelligence.recommendation-feedback',
    MODEL_FEEDBACK: 'intelligence.model-feedback',
    NUDGE_FEEDBACK: 'engagement.nudge-feedback',
    FEEDBACK_PROCESSED: 'intelligence.feedback-processed'
  };

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
      });

      await this.producer.connect();
      logger.info('Kafka producer connected', { brokers: KAFKA_BROKERS });

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
      this.connected = false;
      logger.info('Kafka disconnected');
    } catch (error) {
      logger.error('Kafka disconnect error', { error });
    }
  }

  /**
   * Publish feedback event
   */
  async publishFeedback(event: FeedbackEvent): Promise<void> {
    if (!this.producer) throw new Error('Kafka producer not connected');

    const topic = this.getTopicForEvent(event.eventType);

    try {
      await this.producer.send({
        topic,
        messages: [{
          key: event.eventId,
          value: JSON.stringify({
            ...event,
            _publishedAt: new Date().toISOString(),
            _source: KAFKA_CLIENT_ID
          })
        }]
      });

      logger.debug('Feedback published', { topic, eventType: event.eventType });
    } catch (error) {
      logger.error('Feedback publish failed', { error });
      throw error;
    }
  }

  /**
   * Publish conversion feedback
   */
  async publishConversion(conversion: {
    conversionId: string;
    nudgeId?: string;
    userId?: string;
    converted: boolean;
    orderId?: string;
    amount?: number;
    attribution?: Record<string, unknown>;
  }): Promise<void> {
    await this.publishFeedback({
      eventId: conversion.conversionId,
      eventType: 'conversion',
      timestamp: new Date().toISOString(),
      data: conversion
    });
  }

  /**
   * Publish recommendation feedback
   */
  async publishRecommendationFeedback(feedback: {
    feedbackId: string;
    recommendationId: string;
    userId?: string;
    action: 'click' | 'view' | 'purchase' | 'dismiss' | 'save';
    itemId?: string;
    itemCategory?: string;
    position?: number;
    revenue?: number;
  }): Promise<void> {
    await this.publishFeedback({
      eventId: feedback.feedbackId,
      eventType: 'recommendation',
      timestamp: new Date().toISOString(),
      data: feedback
    });
  }

  /**
   * Publish model feedback
   */
  async publishModelFeedback(feedback: {
    feedbackId: string;
    modelId: string;
    modelType: string;
    userId?: string;
    prediction: unknown;
    actual?: unknown;
    correct?: boolean;
    error?: number;
  }): Promise<void> {
    await this.publishFeedback({
      eventId: feedback.feedbackId,
      eventType: 'model',
      timestamp: new Date().toISOString(),
      data: feedback
    });
  }

  /**
   * Publish nudge feedback
   */
  async publishNudgeFeedback(feedback: {
    feedbackId: string;
    nudgeId: string;
    userId?: string;
    event: 'sent' | 'delivered' | 'clicked' | 'converted' | 'dismissed';
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.publishFeedback({
      eventId: feedback.feedbackId,
      eventType: 'nudge',
      timestamp: new Date().toISOString(),
      data: feedback
    });
  }

  /**
   * Subscribe to feedback events for processing
   */
  async subscribe(handler: (event: FeedbackEvent) => Promise<void>): Promise<void> {
    const topics = Object.values(this.TOPICS);

    this.consumer = this.kafka.consumer({
      groupId: KAFKA_GROUP_ID,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    await this.consumer.connect();
    logger.info('Consumer connected', { groupId: KAFKA_GROUP_ID });

    for (const topic of topics) {
      await this.consumer.subscribe({ topic, fromBeginning: false });
    }

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = message.value?.toString();
          if (!value) return;

          const event = JSON.parse(value) as FeedbackEvent;
          await handler(event);

          logger.debug('Feedback consumed', {
            topic,
            partition,
            eventType: event.eventType
          });
        } catch (error) {
          logger.error('Feedback processing failed', { topic, error });
        }
      }
    });

    logger.info('Consumer subscribed to feedback topics', { topics });
  }

  /**
   * Get topic for event type
   */
  private getTopicForEvent(eventType: FeedbackEvent['eventType']): string {
    switch (eventType) {
      case 'conversion': return this.TOPICS.CONVERSION;
      case 'recommendation': return this.TOPICS.RECOMMENDATION_FEEDBACK;
      case 'model': return this.TOPICS.MODEL_FEEDBACK;
      case 'nudge': return this.TOPICS.NUDGE_FEEDBACK;
      default: return this.TOPICS.FEEDBACK_PROCESSED;
    }
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.connected;
  }
}

export const kafkaIntegration = new KafkaIntegration();
