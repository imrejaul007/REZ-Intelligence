/**
 * Attribution Listener Service
 * Listens for attribution events and triggers loyalty rewards
 *
 * Features:
 * - Webhook endpoint for attribution service
 * - Polling-based fallback for attribution service
 * - Event filtering and validation
 * - Idempotent processing
 * - Graceful degradation
 */

import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { BridgeRecord } from '../models/BridgeRecord.js';
import { cashbackEngine } from './cashbackEngine.js';
import { loyaltyTriggerService } from './loyaltyTrigger.js';
import { attributionLogger as logger } from './logger.js';
import { AttributionWebhook, ChannelType } from '../types/schemas.js';

// ============================================
// TYPES
// ============================================

export interface AttributionEvent {
  eventId: string;
  eventType: string;
  conversionId: string;
  customerId: string;
  merchantId: string;
  orderId?: string;
  status: string;
  type: string;
  value: {
    amount: number;
    currency: string;
  };
  channels: ChannelType[];
  attributionModel: string;
  attributedRevenue?: Record<string, number>;
  campaignId?: string;
  timestamp: string;
}

export interface ListenerConfig {
  attributionServiceUrl: string;
  pollIntervalMs: number;
  batchSize: number;
  redisUrl?: string;
}

// ============================================
// ATTRIBUTION LISTENER CLASS
// ============================================

export class AttributionListener {
  private attributionServiceUrl: string;
  private httpClient: AxiosInstance;
  private redis?: Redis;
  private pollIntervalMs: number;
  private batchSize: number;
  private isPolling: boolean;
  private pollTimer?: NodeJS.Timeout;
  private webhookSecret: string;

  constructor(config?: Partial<ListenerConfig>) {
    this.attributionServiceUrl = config?.attributionServiceUrl ||
      process.env.ATTRIBUTION_SERVICE_URL ||
      'http://localhost:4090';
    this.pollIntervalMs = config?.pollIntervalMs || 30000; // 30 seconds
    this.batchSize = config?.batchSize || 100;
    this.isPolling = false;
    this.webhookSecret = process.env.INTERNAL_SERVICE_TOKEN || '';

    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || ''
      }
    });

    // Initialize Redis if URL provided
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 100, 3000)
      });

      this.redis.on('error', (error) => {
        logger.error('Redis connection error', { error: error.message });
      });
    }
  }

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.ping();
        logger.info('Redis connection established');
      } catch (error) {
        logger.warn('Redis not available, proceeding without caching', { error });
        this.redis = undefined;
      }
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      logger.warn('No webhook secret configured');
      return true; // Allow in development
    }

    // In production, implement HMAC verification
    // For now, simple comparison (replace with crypto.timingSafeEqual)
    return signature === this.webhookSecret;
  }

  /**
   * Check for duplicate event (idempotency)
   */
  private async isEventProcessed(eventId: string): Promise<boolean> {
    if (!this.redis) return false;

    const key = `bridge:event:${eventId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * Mark event as processed
   */
  private async markEventProcessed(eventId: string, ttlSeconds: number = 86400): Promise<void> {
    if (!this.redis) return;

    const key = `bridge:event:${eventId}`;
    await this.redis.setex(key, ttlSeconds, '1');
  }

  /**
   * Process a conversion event from attribution service
   */
  async processConversionEvent(event: AttributionEvent): Promise<{
    success: boolean;
    bridgeId?: string;
    error?: string;
  }> {
    const { conversionId, customerId, merchantId, status } = event;

    logger.info('Processing conversion event', {
      eventId: event.eventId,
      conversionId,
      status
    });

    // Only process completed conversions
    if (status !== 'completed') {
      logger.info('Skipping non-completed conversion', { conversionId, status });
      return { success: true };
    }

    // Check for duplicate
    const isDuplicate = await this.isEventProcessed(event.eventId);
    if (isDuplicate) {
      logger.info('Duplicate event skipped', { eventId: event.eventId });
      return { success: true };
    }

    // Check if already bridged
    const existingRecords = await BridgeRecord.findByConversion(conversionId);
    const completedRecord = existingRecords.find(r => r.status === 'completed');
    if (completedRecord) {
      logger.info('Conversion already bridged', { conversionId, bridgeId: completedRecord.bridgeId });
      await this.markEventProcessed(event.eventId);
      return { success: true, bridgeId: completedRecord.bridgeId };
    }

    try {
      // Calculate cashback
      const calculation = await cashbackEngine.calculate({
        conversionId,
        customerId,
        merchantId,
        orderValue: event.value.amount,
        currency: event.value.currency,
        channels: event.channels,
        campaignId: event.campaignId,
        attributionModel: event.attributionModel as any,
        attributedRevenue: event.attributedRevenue
      });

      // Create bridge record
      const bridgeId = await cashbackEngine.createBridgeRecord(calculation);

      // Mark event as processed
      await this.markEventProcessed(event.eventId);

      // Trigger loyalty reward asynchronously
      this.triggerRewardAsync(bridgeId);

      logger.info('Conversion event processed', {
        eventId: event.eventId,
        bridgeId,
        conversionId
      });

      return { success: true, bridgeId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to process conversion event', {
        eventId: event.eventId,
        conversionId,
        error: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Trigger reward asynchronously (fire and forget)
   */
  private triggerRewardAsync(bridgeId: string): void {
    setImmediate(async () => {
      try {
        await loyaltyTriggerService.syncBridgeRecord(bridgeId);
      } catch (error) {
        logger.error('Async reward trigger failed', { bridgeId, error });
      }
    });
  }

  /**
   * Handle incoming webhook from attribution service
   */
  async handleWebhook(
    payload: AttributionWebhook,
    signature?: string
  ): Promise<{
    accepted: boolean;
    processed: boolean;
    bridgeId?: string;
    error?: string;
  }> {
    // Verify signature if provided
    if (signature && !this.verifyWebhookSignature(JSON.stringify(payload), signature)) {
      logger.warn('Invalid webhook signature');
      return { accepted: false, processed: false, error: 'Invalid signature' };
    }

    // Validate payload
    const validationResult = AttributionWebhook.safeParse(payload);
    if (!validationResult.success) {
      logger.warn('Invalid webhook payload', { errors: validationResult.error.errors });
      return { accepted: false, processed: false, error: 'Invalid payload' };
    }

    const event: AttributionEvent = {
      eventId: uuidv4(),
      eventType: payload.event,
      conversionId: payload.data.conversionId,
      customerId: payload.data.customerId,
      merchantId: payload.data.merchantId,
      orderId: payload.data.orderId,
      status: payload.data.status,
      type: payload.data.type,
      value: payload.data.value,
      channels: payload.data.channels,
      attributionModel: payload.data.attributionModel,
      attributedRevenue: payload.data.attributedRevenue,
      campaignId: payload.data.campaignId,
      timestamp: payload.timestamp
    };

    const result = await this.processConversionEvent(event);

    return {
      accepted: true,
      processed: result.success,
      bridgeId: result.bridgeId,
      error: result.error
    };
  }

  /**
   * Poll attribution service for new conversions
   */
  async pollAttributionService(): Promise<{
    polled: number;
    processed: number;
    errors: number;
  }> {
    if (this.isPolling) {
      logger.debug('Poll already in progress, skipping');
      return { polled: 0, processed: 0, errors: 0 };
    }

    this.isPolling = true;

    try {
      // Fetch recent conversions from attribution service
      const response = await this.httpClient.get(
        `${this.attributionServiceUrl}/api/v1/conversions/recent`,
        {
          params: {
            limit: this.batchSize,
            status: 'completed'
          }
        }
      );

      const conversions = response.data.conversions || [];
      let processed = 0;
      let errors = 0;

      for (const conversion of conversions) {
        const event: AttributionEvent = {
          eventId: uuidv4(),
          eventType: 'conversion.completed',
          conversionId: conversion.conversionId,
          customerId: conversion.customerId,
          merchantId: conversion.merchantId,
          orderId: conversion.orderId,
          status: conversion.status,
          type: conversion.type,
          value: conversion.value,
          channels: conversion.attributedChannels || [],
          attributionModel: conversion.attributionModel,
          attributedRevenue: conversion.channelRevenue,
          campaignId: conversion.campaignId,
          timestamp: conversion.timestamp
        };

        const result = await this.processConversionEvent(event);
        if (result.success) {
          processed++;
        } else {
          errors++;
        }
      }

      logger.info('Poll complete', { polled: conversions.length, processed, errors });

      return { polled: conversions.length, processed, errors };
    } catch (error) {
      logger.error('Failed to poll attribution service', { error });
      return { polled: 0, processed: 0, errors: 0 };
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Start polling for attribution events
   */
  startPolling(): void {
    if (this.pollTimer) {
      logger.warn('Polling already started');
      return;
    }

    logger.info('Starting attribution polling', {
      intervalMs: this.pollIntervalMs,
      batchSize: this.batchSize
    });

    // Initial poll
    this.pollAttributionService();

    // Set up interval
    this.pollTimer = setInterval(() => {
      this.pollAttributionService();
    }, this.pollIntervalMs);
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
      logger.info('Attribution polling stopped');
    }
  }

  /**
   * Fetch conversion from attribution service by ID
   */
  async fetchConversion(conversionId: string): Promise<AttributionEvent | null> {
    try {
      const response = await this.httpClient.get(
        `${this.attributionServiceUrl}/api/v1/conversions/${conversionId}`
      );

      const conversion = response.data;
      return {
        eventId: uuidv4(),
        eventType: 'conversion.completed',
        conversionId: conversion.conversionId,
        customerId: conversion.customerId,
        merchantId: conversion.merchantId,
        orderId: conversion.orderId,
        status: conversion.status,
        type: conversion.type,
        value: conversion.value,
        channels: conversion.attributedChannels || [],
        attributionModel: conversion.attributionModel,
        attributedRevenue: conversion.channelRevenue,
        campaignId: conversion.campaignId,
        timestamp: conversion.timestamp
      };
    } catch (error) {
      logger.error('Failed to fetch conversion', { conversionId, error });
      return null;
    }
  }

  /**
   * Reprocess a specific conversion
   */
  async reprocessConversion(conversionId: string): Promise<{
    success: boolean;
    bridgeId?: string;
    error?: string;
  }> {
    const event = await this.fetchConversion(conversionId);

    if (!event) {
      return { success: false, error: 'Conversion not found' };
    }

    // Force reprocessing by generating new event ID
    event.eventId = uuidv4();

    return this.processConversionEvent(event);
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    this.stopPolling();

    if (this.redis) {
      await this.redis.quit();
      logger.info('Redis connection closed');
    }
  }
}

// ============================================
// EXPORT SINGLETON INSTANCE
// ============================================

export const attributionListener = new AttributionListener();
