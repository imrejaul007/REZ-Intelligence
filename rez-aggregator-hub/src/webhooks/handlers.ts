/**
 * Webhook Handlers
 * Handles incoming webhooks from Swiggy, Zomato, and Magicpin
 */

import {
  WebhookPayload,
  WebhookEventType,
  WebhookHandlerResult,
  Order,
  OrderStatus,
} from '../types';
import { Logger } from '../utils/logger.js';
import { OrderNormalizer } from '../utils/normalizer';

// ============================================
// Webhook Event Types
// ============================================

export interface WebhookEventHandlers {
  onOrderNew?: (order: Order) => Promise<void>;
  onOrderAccepted?: (order: Order) => Promise<void>;
  onOrderPreparing?: (order: Order) => Promise<void>;
  onOrderReady?: (order: Order) => Promise<void>;
  onOrderPickedUp?: (order: Order) => Promise<void>;
  onOrderDelivered?: (order: Order) => Promise<void>;
  onOrderCancelled?: (order: Order, reason?: string) => Promise<void>;
  onOrderRejected?: (order: Order, reason?: string) => Promise<void>;
  onOrderUpdated?: (order: Order) => Promise<void>;
  onMenuUpdated?: (storeId: string) => Promise<void>;
  onItemUpdated?: (storeId: string, itemId: string) => Promise<void>;
  onStoreUpdated?: (storeId: string) => Promise<void>;
}

// ============================================
// Base Webhook Handler
// ============================================

export abstract class BaseWebhookHandler {
  protected logger: Logger;
  protected normalizer: OrderNormalizer;
  protected handlers: WebhookEventHandlers;

  constructor(handlers: WebhookEventHandlers, logger?: Logger) {
    this.handlers = handlers;
    this.logger = logger || new Logger();
    this.normalizer = new OrderNormalizer(this.logger);
  }

  /**
   * Process incoming webhook
   */
  abstract processWebhook(payload: unknown): Promise<WebhookHandlerResult>;

  /**
   * Verify webhook signature
   */
  abstract verifySignature(payload: string, signature: string): boolean;

  /**
   * Parse webhook payload to typed format
   */
  protected abstract parsePayload(payload: unknown): WebhookPayload | null;

  /**
   * Handle webhook event
   */
  protected async handleEvent(payload: WebhookPayload): Promise<void> {
    const eventType = payload.eventType;

    this.logger.info(`Processing webhook event: ${eventType}`, {
      aggregator: payload.aggregator,
      eventType,
      timestamp: payload.timestamp,
    });

    try {
      switch (eventType) {
        case 'order.new':
          if (this.handlers.onOrderNew) {
            await this.handlers.onOrderNew(payload.data as Order);
          }
          break;

        case 'order.accepted':
          if (this.handlers.onOrderAccepted) {
            await this.handlers.onOrderAccepted(payload.data as Order);
          }
          break;

        case 'order.preparing':
          if (this.handlers.onOrderPreparing) {
            await this.handlers.onOrderPreparing(payload.data as Order);
          }
          break;

        case 'order.ready':
          if (this.handlers.onOrderReady) {
            await this.handlers.onOrderReady(payload.data as Order);
          }
          break;

        case 'order.picked_up':
          if (this.handlers.onOrderPickedUp) {
            await this.handlers.onOrderPickedUp(payload.data as Order);
          }
          break;

        case 'order.delivered':
          if (this.handlers.onOrderDelivered) {
            await this.handlers.onOrderDelivered(payload.data as Order);
          }
          break;

        case 'order.cancelled':
          if (this.handlers.onOrderCancelled) {
            const data = payload.data as { order: Order; reason?: string };
            await this.handlers.onOrderCancelled(data.order, data.reason);
          }
          break;

        case 'order.rejected':
          if (this.handlers.onOrderRejected) {
            const data = payload.data as { order: Order; reason?: string };
            await this.handlers.onOrderRejected(data.order, data.reason);
          }
          break;

        case 'order.updated':
          if (this.handlers.onOrderUpdated) {
            await this.handlers.onOrderUpdated(payload.data as Order);
          }
          break;

        case 'menu.updated':
          if (this.handlers.onMenuUpdated) {
            const data = payload.data as { storeId: string };
            await this.handlers.onMenuUpdated(data.storeId);
          }
          break;

        case 'item.updated':
          if (this.handlers.onItemUpdated) {
            const data = payload.data as { storeId: string; itemId: string };
            await this.handlers.onItemUpdated(data.storeId, data.itemId);
          }
          break;

        case 'store.updated':
          if (this.handlers.onStoreUpdated) {
            const data = payload.data as { storeId: string };
            await this.handlers.onStoreUpdated(data.storeId);
          }
          break;

        default:
          this.logger.warn(`Unknown webhook event type: ${eventType}`);
      }
    } catch (error) {
      this.logger.error(`Error handling webhook event: ${eventType}`, error as Error);
      throw error;
    }
  }
}

// ============================================
// Swiggy Webhook Handler
// ============================================

export interface SwiggyWebhookData {
  event: string;
  timestamp: string;
  store_id: string;
  order_id: string;
  order?: Record<string, unknown>;
  cancellation_reason?: string;
  rejection_reason?: string;
}

const SWIGGY_EVENT_MAP: Record<string, WebhookEventType> = {
  ORDER_CREATED: 'order.new',
  ORDER_ACCEPTED: 'order.accepted',
  ORDER_PREPARING: 'order.preparing',
  ORDER_READY: 'order.ready',
  ORDER_PICKED_UP: 'order.picked_up',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_REJECTED: 'order.rejected',
  ORDER_UPDATED: 'order.updated',
  MENU_UPDATED: 'menu.updated',
  ITEM_UPDATED: 'item.updated',
  STORE_UPDATED: 'store.updated',
};

export class SwiggyWebhookHandler extends BaseWebhookHandler {
  private webhookSecret: string;

  constructor(webhookSecret: string, handlers: WebhookEventHandlers, logger?: Logger) {
    super(handlers, logger);
    this.webhookSecret = webhookSecret;
  }

  verifySignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('Swiggy webhook secret not configured');
      return true; // Skip verification in development
    }

    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  protected parsePayload(payload: unknown): WebhookPayload | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const data = payload as SwiggyWebhookData;

    if (!data.event || !data.timestamp) {
      return null;
    }

    const eventType = SWIGGY_EVENT_MAP[data.event] || `order.${data.event.toLowerCase()}`;

    return {
      aggregator: 'swiggy',
      eventType,
      timestamp: new Date(data.timestamp),
      data: data,
    };
  }

  async processWebhook(payload: unknown): Promise<WebhookHandlerResult> {
    const startTime = Date.now();

    try {
      const parsedPayload = this.parsePayload(payload);

      if (!parsedPayload) {
        return {
          success: false,
          processedAt: new Date(),
          error: 'Invalid webhook payload',
        };
      }

      await this.handleEvent(parsedPayload);

      this.logger.webhook('swiggy', parsedPayload.eventType, true, {
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        processedAt: new Date(),
      };
    } catch (error) {
      this.logger.webhook('swiggy', 'unknown', false, {
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        processedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// ============================================
// Zomato Webhook Handler
// ============================================

export interface ZomatoWebhookData {
  event_type: string;
  event_time: string;
  restaurant_id: string;
  order_id: string;
  order?: Record<string, unknown>;
  reason?: string;
}

const ZOMATO_EVENT_MAP: Record<string, WebhookEventType> = {
  NEW_ORDER: 'order.new',
  ORDER_ACCEPTED: 'order.accepted',
  ORDER_BEING_PREPARED: 'order.preparing',
  ORDER_READY: 'order.ready',
  ORDER_PICKED_UP: 'order.picked_up',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_REJECTED: 'order.rejected',
  ORDER_UPDATED: 'order.updated',
  MENU_UPDATED: 'menu.updated',
  ITEM_UPDATED: 'item.updated',
  RESTAURANT_UPDATED: 'store.updated',
};

export class ZomatoWebhookHandler extends BaseWebhookHandler {
  private webhookSecret: string;

  constructor(webhookSecret: string, handlers: WebhookEventHandlers, logger?: Logger) {
    super(handlers, logger);
    this.webhookSecret = webhookSecret;
  }

  verifySignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('Zomato webhook secret not configured');
      return true;
    }

    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  protected parsePayload(payload: unknown): WebhookPayload | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const data = payload as ZomatoWebhookData;

    if (!data.event_type || !data.event_time) {
      return null;
    }

    const eventType = ZOMATO_EVENT_MAP[data.event_type] || `order.${data.event_type.toLowerCase()}`;

    return {
      aggregator: 'zomato',
      eventType,
      timestamp: new Date(data.event_time),
      data: data,
    };
  }

  async processWebhook(payload: unknown): Promise<WebhookHandlerResult> {
    const startTime = Date.now();

    try {
      const parsedPayload = this.parsePayload(payload);

      if (!parsedPayload) {
        return {
          success: false,
          processedAt: new Date(),
          error: 'Invalid webhook payload',
        };
      }

      await this.handleEvent(parsedPayload);

      this.logger.webhook('zomato', parsedPayload.eventType, true, {
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        processedAt: new Date(),
      };
    } catch (error) {
      this.logger.webhook('zomato', 'unknown', false, {
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        processedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// ============================================
// Magicpin Webhook Handler
// ============================================

export interface MagicpinWebhookData {
  event: string;
  timestamp: string;
  store_id: string;
  order_id: string;
  order?: Record<string, unknown>;
  cancellation_reason?: string;
  rejection_reason?: string;
}

const MAGICPIN_EVENT_MAP: Record<string, WebhookEventType> = {
  NEW_ORDER: 'order.new',
  ORDER_ACCEPTED: 'order.accepted',
  ORDER_PREPARING: 'order.preparing',
  ORDER_READY: 'order.ready',
  ORDER_PICKED_UP: 'order.picked_up',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_REJECTED: 'order.rejected',
  ORDER_UPDATED: 'order.updated',
  MENU_UPDATED: 'menu.updated',
  ITEM_UPDATED: 'item.updated',
  STORE_UPDATED: 'store.updated',
};

export class MagicpinWebhookHandler extends BaseWebhookHandler {
  private webhookSecret: string;

  constructor(webhookSecret: string, handlers: WebhookEventHandlers, logger?: Logger) {
    super(handlers, logger);
    this.webhookSecret = webhookSecret;
  }

  verifySignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('Magicpin webhook secret not configured');
      return true;
    }

    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  protected parsePayload(payload: unknown): WebhookPayload | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const data = payload as MagicpinWebhookData;

    if (!data.event || !data.timestamp) {
      return null;
    }

    const eventType = MAGICPIN_EVENT_MAP[data.event] || `order.${data.event.toLowerCase()}`;

    return {
      aggregator: 'magicpin',
      eventType,
      timestamp: new Date(data.timestamp),
      data: data,
    };
  }

  async processWebhook(payload: unknown): Promise<WebhookHandlerResult> {
    const startTime = Date.now();

    try {
      const parsedPayload = this.parsePayload(payload);

      if (!parsedPayload) {
        return {
          success: false,
          processedAt: new Date(),
          error: 'Invalid webhook payload',
        };
      }

      await this.handleEvent(parsedPayload);

      this.logger.webhook('magicpin', parsedPayload.eventType, true, {
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        processedAt: new Date(),
      };
    } catch (error) {
      this.logger.webhook('magicpin', 'unknown', false, {
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        processedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// ============================================
// Unified Webhook Router
// ============================================

export class WebhookRouter {
  private swiggyHandler: SwiggyWebhookHandler;
  private zomatoHandler: ZomatoWebhookHandler;
  private magicpinHandler: MagicpinWebhookHandler;
  private logger: Logger;

  constructor(
    configs: {
      swiggySecret: string;
      zomatoSecret: string;
      magicpinSecret: string;
    },
    handlers: WebhookEventHandlers,
    logger?: Logger
  ) {
    this.logger = logger || new Logger();
    this.swiggyHandler = new SwiggyWebhookHandler(configs.swiggySecret, handlers, this.logger);
    this.zomatoHandler = new ZomatoWebhookHandler(configs.zomatoSecret, handlers, this.logger);
    this.magicpinHandler = new MagicpinWebhookHandler(configs.magicpinSecret, handlers, this.logger);
  }

  /**
   * Route webhook to appropriate handler based on aggregator
   */
  async route(aggregator: string, payload: unknown): Promise<WebhookHandlerResult> {
    switch (aggregator.toLowerCase()) {
      case 'swiggy':
        return this.swiggyHandler.processWebhook(payload);

      case 'zomato':
        return this.zomatoHandler.processWebhook(payload);

      case 'magicpin':
        return this.magicpinHandler.processWebhook(payload);

      default:
        this.logger.error(`Unknown aggregator: ${aggregator}`);
        return {
          success: false,
          processedAt: new Date(),
          error: `Unknown aggregator: ${aggregator}`,
        };
    }
  }

  /**
   * Get handler for specific aggregator
   */
  getHandler(aggregator: string): BaseWebhookHandler | null {
    switch (aggregator.toLowerCase()) {
      case 'swiggy':
        return this.swiggyHandler;
      case 'zomato':
        return this.zomatoHandler;
      case 'magicpin':
        return this.magicpinHandler;
      default:
        return null;
    }
  }
}
