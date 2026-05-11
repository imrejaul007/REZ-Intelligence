import { v4 as uuidv4 } from 'uuid';
import { schemaRegistry, BaseEvent, Event, EventType, logger } from './schema-registry';
import { config } from '../config';
import { trackEventEmission } from '../middleware/eventTracking';

// Correlation ID storage for request tracing
const correlationContext = new Map<string, string>();

export interface PublishOptions {
  correlationId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  validate?: boolean;
  skipStore?: boolean;
}

export interface PublishResult {
  success: boolean;
  eventId?: string;
  correlationId?: string;
  error?: string;
  validationErrors?: Array<{ path: string; message: string }>;
}

export class EventEmitter {
  private static instance: EventEmitter;

  private constructor() {}

  static getInstance(): EventEmitter {
    if (!EventEmitter.instance) {
      EventEmitter.instance = new EventEmitter();
    }
    return EventEmitter.instance;
  }

  /**
   * Set correlation ID for the current context
   */
  setCorrelationId(id: string): void {
    correlationContext.set('current', id);
  }

  /**
   * Get current correlation ID
   */
  getCorrelationId(): string | undefined {
    return correlationContext.get('current');
  }

  /**
   * Clear correlation ID context
   */
  clearCorrelationId(): void {
    correlationContext.delete('current');
  }

  /**
   * Generate a new correlation ID
   */
  generateCorrelationId(): string {
    return uuidv4();
  }

  /**
   * Enrich event with metadata
   */
  private enrichEvent<T extends BaseEvent>(event: T, options: PublishOptions): T {
    const enriched = {
      ...event,
      id: event.id || uuidv4(),
      timestamp: event.timestamp || new Date().toISOString(),
      version: event.version || config.events.schemaVersion,
      source: options.source || config.service.name,
      correlationId: options.correlationId || this.getCorrelationId(),
    };

    if (options.metadata) {
      enriched.metadata = {
        ...(enriched.metadata || {}),
        ...options.metadata,
      };
    }

    return enriched;
  }

  /**
   * Validate event against schema
   */
  private validateEvent(event: unknown): { valid: boolean; errors?: Array<{ path: string; message: string }> } {
    const result = schemaRegistry.validate((event as BaseEvent).type, event);

    if (!result.success) {
      return {
        valid: false,
        errors: result.error?.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      };
    }

    return { valid: true };
  }

  /**
   * Publish an event
   */
  async publish(event: Event, options: PublishOptions = {}): Promise<PublishResult> {
    const eventLogger = logger.child({
      eventType: event.type,
      eventId: event.id,
      correlationId: options.correlationId,
    });
    const publishStartTime = Date.now();

    try {
      // Enrich the event
      const enrichedEvent = this.enrichEvent(event, options);

      // Validate if enabled
      if (options.validate !== false) {
        const validation = this.validateEvent(enrichedEvent);
        if (!validation.valid) {
          eventLogger.warn('Event validation failed', { errors: validation.errors });

          // Track failed validation
          await trackEventEmission({
            eventId: enrichedEvent.id,
            correlationId: enrichedEvent.correlationId,
            type: enrichedEvent.type,
            version: enrichedEvent.version,
            source: enrichedEvent.source,
            payload: enrichedEvent,
            startTime: publishStartTime,
          }).catch(() => {}); // Don't fail publish if tracking fails

          return {
            success: false,
            error: 'Validation failed',
            validationErrors: validation.errors,
          };
        }
      }

      // Track event emission (async, don't block publish)
      trackEventEmission({
        eventId: enrichedEvent.id,
        correlationId: enrichedEvent.correlationId,
        type: enrichedEvent.type,
        version: enrichedEvent.version,
        source: enrichedEvent.source,
        payload: enrichedEvent,
        startTime: publishStartTime,
      }).catch((err) => {
        logger.error('Failed to track event emission', {
          eventId: enrichedEvent.id,
          error: err instanceof Error ? err.message : 'Unknown',
        });
      });

      // Store event if not skipped
      if (!options.skipStore) {
        await this.storeEvent(enrichedEvent);
      }

      // Publish to appropriate queue
      await this.publishToQueue(enrichedEvent);

      eventLogger.info('Event published successfully', {
        type: enrichedEvent.type,
        timestamp: enrichedEvent.timestamp,
        publishLatencyMs: Date.now() - publishStartTime,
      });

      return {
        success: true,
        eventId: enrichedEvent.id,
        correlationId: enrichedEvent.correlationId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      eventLogger.error('Failed to publish event', {
        error: errorMessage,
        publishLatencyMs: Date.now() - publishStartTime,
      });

      // Track failed publish
      await trackEventEmission({
        eventId: event.id || 'unknown',
        correlationId: options.correlationId,
        type: event.type,
        version: config.events.schemaVersion,
        source: options.source || config.service.name,
        payload: event,
        startTime: publishStartTime,
      }).catch(() => {}); // Don't fail publish if tracking fails

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Store event in MongoDB
   */
  private async storeEvent(event: Event): Promise<void> {
    try {
      const { EventStore } = await import('../models/event-store');
      const store = new EventStore({
        eventId: event.id,
        type: event.type,
        version: event.version,
        payload: event,
        correlationId: event.correlationId,
        source: event.source,
        timestamp: new Date(event.timestamp),
        processed: false,
      });

      await store.save();
      logger.debug('Event stored', { eventId: event.id, type: event.type });
    } catch (error) {
      // Log but don't fail the publish
      logger.error('Failed to store event', {
        eventId: event.id,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Publish to BullMQ queue
   */
  private async publishToQueue(event: Event): Promise<void> {
    const { getEventQueue } = await import('./consumer');
    const queue = getEventQueue(event.type);

    if (!queue) {
      throw new Error(`No queue found for event type: ${event.type}`);
    }

    await queue.add(event.type, {
      event,
      publishedAt: new Date().toISOString(),
    }, {
      jobId: event.id,
      attempts: config.bullmq.maxRetries,
      backoff: {
        type: 'exponential',
        delay: config.bullmq.retryDelay,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  /**
   * Create inventory.low event
   */
  async emitInventoryLow(payload: {
    inventoryId: string;
    productId: string;
    productName: string;
    currentQuantity: number;
    threshold: number;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    warehouseId?: string;
    sku?: string;
    supplierId?: string;
  }): Promise<PublishResult> {
    return this.publish({
      id: uuidv4(),
      type: EventType.INVENTORY_LOW,
      payload,
    } as Event, {});
  }

  /**
   * Create order.completed event
   */
  async emitOrderCompleted(payload: {
    orderId: string;
    customerId: string;
    items: Array<{
      productId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>;
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
    currency?: string;
    paymentMethod: 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer' | 'cash' | 'crypto';
    shippingAddress?: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    notes?: string;
  }): Promise<PublishResult> {
    return this.publish({
      id: uuidv4(),
      type: EventType.ORDER_COMPLETED,
      payload,
    } as Event, {});
  }

  /**
   * Create payment.success event
   */
  async emitPaymentSuccess(payload: {
    paymentId: string;
    orderId: string;
    customerId: string;
    amount: number;
    currency?: string;
    method: string;
    transactionId: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded' | 'partial_refund';
    gateway: 'stripe' | 'paypal' | 'square' | 'braintree' | 'internal';
    gatewayResponse?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<PublishResult> {
    return this.publish({
      id: uuidv4(),
      type: EventType.PAYMENT_SUCCESS,
      payload,
    } as Event, {});
  }

  /**
   * Create ad.impression event
   */
  async emitAdImpression(payload: {
    adId: string;
    campaignId: string;
    merchantId: string;
    userId?: string;
    placement?: string;
    deviceType?: 'mobile' | 'desktop' | 'tablet';
    platform?: string;
    location?: string;
    referrer?: string;
  }): Promise<PublishResult> {
    return this.publish({
      id: uuidv4(),
      type: EventType.AD_IMPRESSION,
      payload,
    } as Event, {});
  }

  /**
   * Create ad.click event
   */
  async emitAdClick(payload: {
    adId: string;
    campaignId: string;
    merchantId: string;
    userId?: string;
    placement?: string;
    deviceType?: 'mobile' | 'desktop' | 'tablet';
    platform?: string;
    location?: string;
    ctaClicked?: string;
  }): Promise<PublishResult> {
    return this.publish({
      id: uuidv4(),
      type: EventType.AD_CLICK,
      payload,
    } as Event, {});
  }

  /**
   * Create conversion event
   */
  async emitConversion(payload: {
    conversionId: string;
    campaignId: string;
    merchantId: string;
    userId?: string;
    orderId?: string;
    value: number;
    currency?: string;
    source: 'ad' | 'marketing' | 'notification' | 'organic';
    channel?: string;
  }): Promise<PublishResult> {
    return this.publish({
      id: uuidv4(),
      type: EventType.CONVERSION,
      payload,
    } as Event, {});
  }

  /**
   * Create campaign.created event
   */
  async emitCampaignCreated(payload: {
    campaignId: string;
    campaignName: string;
    merchantId: string;
    channel: 'ads' | 'marketing' | 'notification' | 'affiliate';
    budget?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<PublishResult> {
    return this.publish({
      id: uuidv4(),
      type: EventType.CAMPAIGN_CREATED,
      payload,
    } as Event, {});
  }

  /**
   * Create voucher.issued event
   */
  async emitVoucherIssued(payload: {
    voucherId: string;
    campaignId: string;
    merchantId: string;
    userId: string;
    voucherCode: string;
    discountType: 'percentage' | 'fixed' | 'bogo';
    discountValue: number;
    minOrderValue?: number;
    expiresAt?: string;
  }): Promise<PublishResult> {
    return this.publish({
      id: uuidv4(),
      type: EventType.VOUCHER_ISSUED,
      payload,
    } as Event, {});
  }

  /**
   * Create notification.sent event
   */
  async emitNotificationSent(payload: {
    notificationId: string;
    campaignId?: string;
    merchantId: string;
    userId: string;
    channel: 'push' | 'email' | 'sms' | 'in_app';
    templateId?: string;
    title?: string;
  }): Promise<PublishResult> {
    return this.publish({
      id: uuidv4(),
      type: EventType.NOTIFICATION_SENT,
      payload,
    } as Event, {});
  }

  /**
   * Create notification.opened event
   */
  async emitNotificationOpened(payload: {
    notificationId: string;
    campaignId?: string;
    merchantId: string;
    userId: string;
    channel: 'push' | 'email' | 'sms' | 'in_app';
    openedAt?: string;
  }): Promise<PublishResult> {
    return this.publish({
      id: uuidv4(),
      type: EventType.NOTIFICATION_OPENED,
      payload,
    } as Event, {});
  }
}

// Singleton instance
export const eventEmitter = EventEmitter.getInstance();

// Convenience functions
export async function publish(event: Event, options?: PublishOptions): Promise<PublishResult> {
  return eventEmitter.publish(event, options);
}

export function setCorrelationId(id: string): void {
  eventEmitter.setCorrelationId(id);
}

export function getCorrelationId(): string | undefined {
  return eventEmitter.getCorrelationId();
}
