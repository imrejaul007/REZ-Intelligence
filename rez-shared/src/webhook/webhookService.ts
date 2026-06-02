/**
 * Webhook Service
 *
 * Manages outgoing webhooks to external systems.
 * Supports signing, retries, delivery tracking.
 *
 * Usage:
 * ```typescript
 * const webhookService = new WebhookService(redis, mongoose, jobQueue);
 * await webhookService.register(merchantId, 'https://example.com/webhooks', 'order.created');
 * await webhookService.trigger('order.created', { orderId: '123' });
 * ```
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import axios, { AxiosError } from 'axios';
import type Redis from 'ioredis';
import mongoose, { Schema, Document } from 'mongoose';
import { Job } from 'bullmq';
import { JobQueue } from '../queue/jobQueue';
import { createServiceLogger } from '../config/logger';

const logger = createServiceLogger('WebhookService');

export enum WebhookEventType {
  // Order events
  ORDER_CREATED = 'order.created',
  ORDER_CONFIRMED = 'order.confirmed',
  ORDER_STATUS_UPDATED = 'order.status_updated',
  ORDER_CANCELLED = 'order.cancelled',
  ORDER_DELIVERED = 'order.delivered',

  // Payment events
  PAYMENT_RECEIVED = 'payment.received',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',

  // Offer events
  OFFER_CREATED = 'offer.created',
  OFFER_UPDATED = 'offer.updated',
  OFFER_COMPLETED = 'offer.completed',

  // KDS events
  KDS_ORDER_READY = 'kds.order_ready',
  KDS_ORDER_STARTED = 'kds.order_started',
}

/**
 * Webhook subscription model
 */
export interface IWebhook extends Document {
  merchant: mongoose.Types.ObjectId;
  targetUrl: string;
  events: WebhookEventType[];
  secret: string;
  isActive: boolean;
  maxRetries: number;
  retryPolicy: 'exponential' | 'fixed';
  headers?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const webhookSchema = new Schema<IWebhook>({
  merchant: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true },
  targetUrl: { type: String, required: true },
  events: [String],
  secret: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  maxRetries: { type: Number, default: 5 },
  retryPolicy: { type: String, enum: ['exponential', 'fixed'], default: 'exponential' },
  headers: Schema.Types.Mixed,
}, { timestamps: true });

export const Webhook = mongoose.model<IWebhook>('Webhook', webhookSchema);

/**
 * Webhook delivery log
 */
export interface IWebhookDelivery extends Document {
  webhook: mongoose.Types.ObjectId;
  event: string;
  payload: any;
  statusCode?: number;
  response?: string;
  error?: string;
  attempt: number;
  nextRetryAt?: Date;
  delivered: boolean;
  createdAt: Date;
}

const deliverySchema = new Schema<IWebhookDelivery>({
  webhook: { type: Schema.Types.ObjectId, ref: 'Webhook', required: true },
  event: { type: String, required: true },
  payload: Schema.Types.Mixed,
  statusCode: Number,
  response: String,
  error: String,
  attempt: { type: Number, default: 1 },
  nextRetryAt: Date,
  delivered: { type: Boolean, default: false },
}, { timestamps: true });

export const WebhookDelivery = mongoose.model<IWebhookDelivery>('WebhookDelivery', deliverySchema);

/**
 * Webhook service
 */
export class WebhookService {
  constructor(
    private redis: Redis,
    private jobQueue: JobQueue
  ) {}

  /**
   * Register webhook for merchant
   */
  async register(
    merchantId: string,
    targetUrl: string,
    events: WebhookEventType[],
    options?: { headers?: Record<string, string>; maxRetries?: number }
  ): Promise<IWebhook> {
    const secret = this.generateSecret();

    const webhook = await Webhook.create({
      merchant: merchantId,
      targetUrl,
      events,
      secret,
      headers: options?.headers,
      maxRetries: options?.maxRetries || 5,
    });

    return webhook;
  }

  /**
   * Deregister webhook
   */
  async deregister(webhookId: string): Promise<void> {
    await Webhook.findByIdAndDelete(webhookId);
  }

  /**
   * Trigger webhook event
   */
  async trigger(event: WebhookEventType, data: any, merchantId?: string): Promise<void> {
    // Find all webhooks subscribed to this event
    let query: any = { events: event, isActive: true };
    if (merchantId) {
      query.merchant = merchantId;
    }

    const webhooks = await Webhook.find(query);

    if (webhooks.length === 0) {
      return; // No subscriptions
    }

    // Queue delivery for each webhook
    for (const webhook of webhooks) {
      await this.jobQueue.add({
        type: 'send-webhook',
        webhookId: webhook._id.toString(),
        event,
        payload: data,
      });
    }
  }

  /**
   * Deliver webhook (called by job processor)
   */
  async deliver(webhookId: string, event: string, payload: any, attempt: number = 1): Promise<boolean> {
    const startTime = Date.now();
    const timeoutMs = 15000; // 15 second timeout for entire delivery operation

    try {
      const webhook = await Webhook.findById(webhookId);
      if (!webhook || !webhook.isActive) {
        return false;
      }

      // Check if we've exceeded the total timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new Error('Webhook delivery timeout');
      }

      // Prepare request
      const signature = this.sign(JSON.stringify(payload), webhook.secret);
      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
        'X-Webhook-Delivery': new Date().toISOString(),
        ...webhook.headers,
      };

      // Send request with timeout enforcement
      const remainingTime = timeoutMs - (Date.now() - startTime);
      const response = await axios.post(webhook.targetUrl, payload, {
        headers,
        timeout: Math.min(10000, remainingTime),
      });

      // Log successful delivery
      await WebhookDelivery.create({
        webhook: webhookId,
        event,
        payload,
        statusCode: response.status,
        response: JSON.stringify(response.data),
        attempt,
        delivered: true,
      });

      return true;
    } catch (error) {
      const axiosError = error as AxiosError;

      // Determine if retry is needed (using webhook's configured maxRetries)
      const webhook = await Webhook.findById(webhookId).catch(() => null);
      const maxRetries = webhook?.maxRetries || 5;
      const shouldRetry = this.shouldRetry(axiosError, attempt, maxRetries);

      // Log failed delivery
      await WebhookDelivery.create({
        webhook: webhookId,
        event,
        payload,
        statusCode: axiosError.response?.status,
        error: axiosError.message,
        attempt,
        nextRetryAt: shouldRetry ? this.getNextRetryTime(attempt) : undefined,
        delivered: false,
      });

      // Queue retry if needed
      if (shouldRetry) {
        await this.jobQueue.add(
          {
            type: 'send-webhook',
            webhookId,
            event,
            payload,
            attempt: attempt + 1,
          },
          { delay: this.getRetryDelay(attempt, webhook?.retryPolicy) }
        );
      }

      return false;
    }
  }

  /**
   * Get delivery history
   */
  async getDeliveryHistory(webhookId: string, limit: number = 50) {
    return WebhookDelivery.find({ webhook: webhookId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Get webhook stats
   */
  async getStats(webhookId: string) {
    const total = await WebhookDelivery.countDocuments({ webhook: webhookId });
    const delivered = await WebhookDelivery.countDocuments({ webhook: webhookId, delivered: true });
    const failed = await WebhookDelivery.countDocuments({ webhook: webhookId, delivered: false });
    const pending = await WebhookDelivery.countDocuments({
      webhook: webhookId,
      delivered: false,
      nextRetryAt: { $ne: null },
    });

    return {
      total,
      delivered,
      failed,
      pending,
      successRate: total > 0 ? ((delivered / total) * 100).toFixed(2) : 0,
    };
  }

  /**
   * Generate HMAC signature
   */
  private sign(payload: string, secret: string): string {
    return createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verify webhook signature using constant-time comparison
   * Prevents timing attacks on signature verification
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = this.sign(payload, secret);

      // Use timingSafeEqual to prevent timing attacks
      // Both buffers must be the same length
      if (expectedSignature.length !== signature.length) {
        return false;
      }

      return timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );
    } catch (error) {
      logger.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Generate random secret
   */
  private generateSecret(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Determine if webhook delivery should be retried
   */
  private shouldRetry(error: AxiosError, attempt: number, maxRetries: number = 5): boolean {
    if (attempt >= maxRetries) return false;

    // Retry on network errors
    if (!error.response) return true;

    const status = error.response.status;

    // Retry on 5xx errors and specific 4xx errors
    return status >= 500 || status === 429 || status === 408;
  }

  /**
   * Calculate next retry time
   */
  private getNextRetryTime(attempt: number): Date {
    const delay = this.getRetryDelay(attempt, 'exponential');
    return new Date(Date.now() + delay);
  }

  /**
   * Calculate retry delay in ms
   */
  private getRetryDelay(attempt: number, policy: string = 'exponential'): number {
    if (policy === 'exponential') {
      // 1s, 2s, 4s, 8s, 16s
      return Math.min(1000 * Math.pow(2, attempt - 1), 30000);
    } else {
      // Fixed 5 second delay
      return 5000;
    }
  }
}

/**
 * Setup webhook job processor
 */
export function setupWebhookProcessor(jobQueue: JobQueue, webhookService: WebhookService) {
  jobQueue.process(async (job: Job<any, any, string>) => {
    const { webhookId, event, payload, attempt = 1 } = job.data;

    const success = await webhookService.deliver(webhookId, event, payload, attempt);

    if (!success && attempt < 5) {
      throw new Error(`Webhook delivery failed, will retry`);
    }

    return { delivered: success, attempt };
  }, 5);
}
