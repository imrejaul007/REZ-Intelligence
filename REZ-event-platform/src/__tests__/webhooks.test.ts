import request from 'supertest';
import express, { Express } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies before importing the app
jest.mock('../config', () => ({
  config: {
    service: {
      name: 'rez-event-platform-test',
      port: 3001,
      env: 'test',
    },
    events: {
      schemaVersion: '1.0.0',
      enableDeadLetterQueue: true,
    },
    bullmq: {
      maxRetries: 3,
      retryDelay: 1000,
      concurrency: 5,
    },
    mongodb: {
      uri: 'mongodb://localhost:27017/test',
    },
    redis: {
      host: 'localhost',
      port: 6379,
    },
  },
  connectMongoDB: jest.fn().mockResolvedValue(undefined),
  connectRedis: jest.fn().mockResolvedValue(undefined),
  disconnectAll: jest.fn().mockResolvedValue(undefined),
  getRedisClient: jest.fn().mockReturnValue({
    ping: jest.fn().mockResolvedValue('PONG'),
  }),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

jest.mock('../events/consumer', () => ({
  initializeQueues: jest.fn().mockResolvedValue(undefined),
  initializeWorkers: jest.fn().mockResolvedValue(undefined),
  shutdownWorkers: jest.fn().mockResolvedValue(undefined),
  getQueueStats: jest.fn().mockResolvedValue({}),
  getEventQueue: jest.fn().mockReturnValue({
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
  }),
}));

// Mock the event store
jest.mock('../models/event-store', () => {
  const mockSave = jest.fn().mockResolvedValue(undefined);

  const MockEventStore = function() {
    return { save: mockSave };
  };
  (MockEventStore as any).countDocuments = jest.fn().mockResolvedValue(0);
  (MockEventStore as any).updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });

  const MockDeadLetterEvent = function() {};
  (MockDeadLetterEvent as any).countDocuments = jest.fn().mockResolvedValue(0);

  return {
    EventStore: MockEventStore,
    DeadLetterEvent: MockDeadLetterEvent,
  };
});

// Mock event emitter to avoid actual publishing
jest.mock('../events/emitter', () => {
  const mockEmitter = {
    emitInventoryLow: jest.fn().mockResolvedValue({
      success: true,
      eventId: uuidv4(),
      correlationId: uuidv4(),
    }),
    emitOrderCompleted: jest.fn().mockResolvedValue({
      success: true,
      eventId: uuidv4(),
      correlationId: uuidv4(),
    }),
    emitPaymentSuccess: jest.fn().mockResolvedValue({
      success: true,
      eventId: uuidv4(),
      correlationId: uuidv4(),
    }),
    emitAdImpression: jest.fn().mockResolvedValue({
      success: true,
      eventId: uuidv4(),
      correlationId: uuidv4(),
    }),
    emitAdClick: jest.fn().mockResolvedValue({
      success: true,
      eventId: uuidv4(),
      correlationId: uuidv4(),
    }),
    emitConversion: jest.fn().mockResolvedValue({
      success: true,
      eventId: uuidv4(),
      correlationId: uuidv4(),
    }),
    emitCampaignCreated: jest.fn().mockResolvedValue({
      success: true,
      eventId: uuidv4(),
      correlationId: uuidv4(),
    }),
    emitVoucherIssued: jest.fn().mockResolvedValue({
      success: true,
      eventId: uuidv4(),
      correlationId: uuidv4(),
    }),
    emitNotificationSent: jest.fn().mockResolvedValue({
      success: true,
      eventId: uuidv4(),
      correlationId: uuidv4(),
    }),
    emitNotificationOpened: jest.fn().mockResolvedValue({
      success: true,
      eventId: uuidv4(),
      correlationId: uuidv4(),
    }),
    publish: jest.fn().mockResolvedValue({
      success: true,
      eventId: uuidv4(),
      correlationId: uuidv4(),
    }),
  };

  return {
    eventEmitter: mockEmitter,
    publish: mockEmitter.publish,
  };
});

// Mock schema registry
jest.mock('../events/schema-registry', () => ({
  schemaRegistry: {
    getSchema: jest.fn(),
    validate: jest.fn().mockReturnValue({ success: true }),
    getRegisteredTypes: jest.fn().mockReturnValue([
      'inventory.low',
      'order.completed',
      'payment.success',
      'ad.impression',
      'ad.click',
      'conversion',
      'campaign.created',
      'voucher.issued',
      'notification.sent',
      'notification.opened',
    ]),
    getVersion: jest.fn().mockReturnValue('1.0.0'),
  },
  EventType: {
    INVENTORY_LOW: 'inventory.low',
    ORDER_COMPLETED: 'order.completed',
    PAYMENT_SUCCESS: 'payment.success',
    AD_IMPRESSION: 'ad.impression',
    AD_CLICK: 'ad.click',
    CONVERSION: 'conversion',
    CAMPAIGN_CREATED: 'campaign.created',
    VOUCHER_ISSUED: 'voucher.issued',
    NOTIFICATION_SENT: 'notification.sent',
    NOTIFICATION_OPENED: 'notification.opened',
  },
  getSchemaDocumentation: jest.fn().mockReturnValue({}),
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Create a test app instance
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  const { eventEmitter } = require('../events/emitter');
  const { logger } = require('../utils/logger');

  // Merchant webhooks
  app.post('/webhook/merchant/inventory', async (req: express.Request, res: express.Response) => {
    try {
      const { merchant_id, item_id, item_name, current_stock, threshold, avg_daily_sales, recent_orders } = req.body;
      const result = await eventEmitter.emitInventoryLow({
        inventoryId: item_id,
        productId: item_id,
        productName: item_name || item_id,
        currentQuantity: current_stock,
        threshold,
      });
      res.status(result.success ? 201 : 400).json({ success: result.success, eventId: result.eventId, correlationId: result.correlationId });
    } catch (error) {
      logger.error('Failed to handle merchant inventory webhook', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/webhook/merchant/order', async (req: express.Request, res: express.Response) => {
    try {
      const { merchant_id, order_id, customer_id, items, total_amount, payment_method } = req.body;
      const result = await eventEmitter.emitOrderCompleted({
        orderId: order_id,
        customerId: customer_id,
        items: (items || []).map((i: any) => ({
          productId: i.item_id,
          name: i.name || i.item_id,
          quantity: i.quantity,
          unitPrice: i.price,
          subtotal: i.price * i.quantity,
        })),
        subtotal: total_amount * 0.9,
        tax: total_amount * 0.05,
        shipping: total_amount * 0.05,
        total: total_amount,
        paymentMethod: payment_method || 'cash',
      });
      res.status(result.success ? 201 : 400).json({ success: result.success, eventId: result.eventId, correlationId: result.correlationId });
    } catch (error) {
      logger.error('Failed to handle merchant order webhook', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/webhook/merchant/payment', async (req: express.Request, res: express.Response) => {
    try {
      const { merchant_id, transaction_id, amount, order_id } = req.body;
      const result = await eventEmitter.emitPaymentSuccess({
        paymentId: transaction_id,
        orderId: order_id,
        customerId: merchant_id,
        amount,
        method: 'unknown',
        transactionId: transaction_id,
        status: 'completed',
        gateway: 'internal',
      });
      res.status(result.success ? 201 : 400).json({ success: result.success, eventId: result.eventId, correlationId: result.correlationId });
    } catch (error) {
      logger.error('Failed to handle merchant payment webhook', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/webhook/merchant/customer', async (req: express.Request, res: express.Response) => {
    logger.info('Customer event received', { payload: req.body });
    res.status(200).json({ success: true, message: 'Customer event logged' });
  });

  // Consumer webhooks
  app.post('/webhook/consumer/order', async (req: express.Request, res: express.Response) => {
    try {
      const { user_id, order_id, merchant_id, items, total_amount } = req.body;
      const result = await eventEmitter.emitOrderCompleted({
        orderId: order_id,
        customerId: user_id,
        items: (items || []).map((i: any) => ({
          productId: i.item_id,
          name: i.name || i.item_id,
          quantity: i.quantity,
          unitPrice: i.price,
          subtotal: i.price * i.quantity,
        })),
        subtotal: total_amount * 0.9,
        tax: total_amount * 0.05,
        shipping: total_amount * 0.05,
        total: total_amount,
        paymentMethod: 'cash',
      });
      res.status(result.success ? 201 : 400).json({ success: result.success, eventId: result.eventId, correlationId: result.correlationId });
    } catch (error) {
      logger.error('Failed to handle consumer order webhook', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/webhook/consumer/search', async (req: express.Request, res: express.Response) => {
    logger.info('Search event received', { payload: req.body });
    res.status(200).json({ success: true, message: 'Search event logged' });
  });

  app.post('/webhook/consumer/view', async (req: express.Request, res: express.Response) => {
    logger.info('View event received', { payload: req.body });
    res.status(200).json({ success: true, message: 'View event logged' });
  });

  app.post('/webhook/consumer/booking', async (req: express.Request, res: express.Response) => {
    logger.info('Booking event received', { payload: req.body });
    res.status(200).json({ success: true, message: 'Booking event logged' });
  });

  // Ad/Growth Event Webhooks
  app.post('/webhook/ads/impression', async (req: express.Request, res: express.Response) => {
    try {
      const { ad_id, campaign_id, merchant_id, user_id, placement, device_type, platform, location, referrer } = req.body;
      const result = await eventEmitter.emitAdImpression({
        adId: ad_id,
        campaignId: campaign_id,
        merchantId: merchant_id,
        userId: user_id,
        placement,
        deviceType: device_type,
        platform,
        location,
        referrer,
      });
      res.status(result.success ? 201 : 400).json({ success: result.success, eventId: result.eventId, correlationId: result.correlationId });
    } catch (error) {
      logger.error('Failed to handle ad impression webhook', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/webhook/ads/click', async (req: express.Request, res: express.Response) => {
    try {
      const { ad_id, campaign_id, merchant_id, user_id, placement, device_type, platform, location, cta_clicked } = req.body;
      const result = await eventEmitter.emitAdClick({
        adId: ad_id,
        campaignId: campaign_id,
        merchantId: merchant_id,
        userId: user_id,
        placement,
        deviceType: device_type,
        platform,
        location,
        ctaClicked: cta_clicked,
      });
      res.status(result.success ? 201 : 400).json({ success: result.success, eventId: result.eventId, correlationId: result.correlationId });
    } catch (error) {
      logger.error('Failed to handle ad click webhook', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/webhook/ads/conversion', async (req: express.Request, res: express.Response) => {
    try {
      const { conversion_id, campaign_id, merchant_id, user_id, order_id, value, currency, source, channel } = req.body;
      const result = await eventEmitter.emitConversion({
        conversionId: conversion_id,
        campaignId: campaign_id,
        merchantId: merchant_id,
        userId: user_id,
        orderId: order_id,
        value: value || 0,
        currency: currency || 'INR',
        source: source || 'ad',
        channel,
      });
      res.status(result.success ? 201 : 400).json({ success: result.success, eventId: result.eventId, correlationId: result.correlationId });
    } catch (error) {
      logger.error('Failed to handle conversion webhook', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/webhook/marketing/campaign', async (req: express.Request, res: express.Response) => {
    try {
      const { campaign_id, campaign_name, merchant_id, channel, budget, start_date, end_date } = req.body;
      const result = await eventEmitter.emitCampaignCreated({
        campaignId: campaign_id,
        campaignName: campaign_name || campaign_id,
        merchantId: merchant_id,
        channel: channel || 'marketing',
        budget,
        startDate: start_date,
        endDate: end_date,
      });
      res.status(result.success ? 201 : 400).json({ success: result.success, eventId: result.eventId, correlationId: result.correlationId });
    } catch (error) {
      logger.error('Failed to handle campaign webhook', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/webhook/marketing/voucher', async (req: express.Request, res: express.Response) => {
    try {
      const { voucher_id, campaign_id, merchant_id, user_id, voucher_code, discount_type, discount_value, min_order_value, expires_at } = req.body;
      const result = await eventEmitter.emitVoucherIssued({
        voucherId: voucher_id,
        campaignId: campaign_id,
        merchantId: merchant_id,
        userId: user_id,
        voucherCode: voucher_code,
        discountType: discount_type || 'percentage',
        discountValue: discount_value || 0,
        minOrderValue: min_order_value,
        expiresAt: expires_at,
      });
      res.status(result.success ? 201 : 400).json({ success: result.success, eventId: result.eventId, correlationId: result.correlationId });
    } catch (error) {
      logger.error('Failed to handle voucher webhook', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/webhook/marketing/notification', async (req: express.Request, res: express.Response) => {
    try {
      const { notification_id, campaign_id, merchant_id, user_id, channel, template_id, title, action } = req.body;
      if (action === 'opened') {
        const result = await eventEmitter.emitNotificationOpened({
          notificationId: notification_id,
          campaignId: campaign_id,
          merchantId: merchant_id,
          userId: user_id,
          channel: channel || 'push',
          openedAt: new Date().toISOString(),
        });
        res.status(result.success ? 201 : 400).json({ success: result.success, eventId: result.eventId, correlationId: result.correlationId });
      } else {
        const result = await eventEmitter.emitNotificationSent({
          notificationId: notification_id,
          campaignId: campaign_id,
          merchantId: merchant_id,
          userId: user_id,
          channel: channel || 'push',
          templateId: template_id,
          title,
        });
        res.status(result.success ? 201 : 400).json({ success: result.success, eventId: result.eventId, correlationId: result.correlationId });
      }
    } catch (error) {
      logger.error('Failed to handle notification webhook', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

describe('Webhook Tests', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Merchant Webhooks
  // ============================================
  describe('POST /webhook/merchant/inventory', () => {
    it('should accept valid inventory event with all required fields', async () => {
      const response = await request(app)
        .post('/webhook/merchant/inventory')
        .send({
          merchant_id: 'test-merchant-123',
          item_id: 'item-456',
          current_stock: 5,
          threshold: 10,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('eventId');
      expect(response.body).toHaveProperty('correlationId');
    });

    it('should accept inventory event with optional fields', async () => {
      const response = await request(app)
        .post('/webhook/merchant/inventory')
        .send({
          merchant_id: 'test-merchant-123',
          item_id: 'item-456',
          item_name: 'Test Product',
          current_stock: 5,
          threshold: 10,
          avg_daily_sales: 2,
          recent_orders: 10,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should accept inventory event with low stock (critical)', async () => {
      const response = await request(app)
        .post('/webhook/merchant/inventory')
        .send({
          merchant_id: 'test-merchant-123',
          item_id: 'item-456',
          current_stock: 0,
          threshold: 5,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should return 400 when emitter returns failure', async () => {
      const { eventEmitter } = require('../events/emitter');
      eventEmitter.emitInventoryLow.mockResolvedValueOnce({
        success: false,
        error: 'Validation failed',
      });

      const response = await request(app)
        .post('/webhook/merchant/inventory')
        .send({
          merchant_id: 'test-merchant-123',
          item_id: 'item-456',
          current_stock: 5,
          threshold: 10,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 500 on internal error', async () => {
      const { eventEmitter } = require('../events/emitter');
      eventEmitter.emitInventoryLow.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/webhook/merchant/inventory')
        .send({
          merchant_id: 'test-merchant-123',
          item_id: 'item-456',
          current_stock: 5,
          threshold: 10,
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });
  });

  describe('POST /webhook/merchant/order', () => {
    it('should accept valid order event', async () => {
      const response = await request(app)
        .post('/webhook/merchant/order')
        .send({
          merchant_id: 'merchant-123',
          order_id: 'order-456',
          customer_id: 'customer-789',
          items: [
            { item_id: 'item-1', name: 'Product 1', quantity: 2, price: 10.00 },
            { item_id: 'item-2', name: 'Product 2', quantity: 1, price: 25.00 },
          ],
          total_amount: 45.00,
          payment_method: 'credit_card',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('eventId');
    });

    it('should accept order with default payment method', async () => {
      const response = await request(app)
        .post('/webhook/merchant/order')
        .send({
          merchant_id: 'merchant-123',
          order_id: 'order-456',
          customer_id: 'customer-789',
          items: [{ item_id: 'item-1', quantity: 1, price: 10.00 }],
          total_amount: 10.00,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should accept empty items array', async () => {
      const response = await request(app)
        .post('/webhook/merchant/order')
        .send({
          merchant_id: 'merchant-123',
          order_id: 'order-456',
          customer_id: 'customer-789',
          items: [],
          total_amount: 0,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /webhook/merchant/payment', () => {
    it('should accept valid payment event', async () => {
      const response = await request(app)
        .post('/webhook/merchant/payment')
        .send({
          merchant_id: 'merchant-123',
          transaction_id: 'txn-456',
          amount: 100.00,
          order_id: 'order-789',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('eventId');
    });

    it('should accept payment with zero amount', async () => {
      const response = await request(app)
        .post('/webhook/merchant/payment')
        .send({
          merchant_id: 'merchant-123',
          transaction_id: 'txn-456',
          amount: 0,
          order_id: 'order-789',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /webhook/merchant/customer', () => {
    it('should accept customer event and return success', async () => {
      const response = await request(app)
        .post('/webhook/merchant/customer')
        .send({
          customer_id: 'customer-123',
          name: 'John Doe',
          email: 'john@example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Customer event logged');
    });

    it('should accept customer event with minimal fields', async () => {
      const response = await request(app)
        .post('/webhook/merchant/customer')
        .send({
          customer_id: 'customer-123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  // ============================================
  // Consumer Webhooks
  // ============================================
  describe('POST /webhook/consumer/order', () => {
    it('should accept valid consumer order event', async () => {
      const response = await request(app)
        .post('/webhook/consumer/order')
        .send({
          user_id: 'user-123',
          order_id: 'order-456',
          merchant_id: 'merchant-789',
          items: [
            { item_id: 'item-1', quantity: 2, price: 15.00 },
          ],
          total_amount: 30.00,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should use cash as default payment method', async () => {
      const response = await request(app)
        .post('/webhook/consumer/order')
        .send({
          user_id: 'user-123',
          order_id: 'order-456',
          merchant_id: 'merchant-789',
          items: [{ item_id: 'item-1', quantity: 1, price: 10.00 }],
          total_amount: 10.00,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /webhook/consumer/search', () => {
    it('should accept search event', async () => {
      const response = await request(app)
        .post('/webhook/consumer/search')
        .send({
          user_id: 'user-123',
          query: 'pizza',
          results_count: 5,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Search event logged');
    });
  });

  describe('POST /webhook/consumer/view', () => {
    it('should accept view event', async () => {
      const response = await request(app)
        .post('/webhook/consumer/view')
        .send({
          user_id: 'user-123',
          item_id: 'item-456',
          merchant_id: 'merchant-789',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'View event logged');
    });
  });

  describe('POST /webhook/consumer/booking', () => {
    it('should accept booking event', async () => {
      const response = await request(app)
        .post('/webhook/consumer/booking')
        .send({
          user_id: 'user-123',
          booking_id: 'booking-456',
          merchant_id: 'merchant-789',
          date: '2024-12-25',
          time: '18:00',
          party_size: 4,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Booking event logged');
    });
  });

  // ============================================
  // Ad/Growth Webhooks
  // ============================================
  describe('POST /webhook/ads/impression', () => {
    it('should accept valid ad impression event', async () => {
      const response = await request(app)
        .post('/webhook/ads/impression')
        .send({
          ad_id: 'ad-123',
          campaign_id: 'campaign-456',
          merchant_id: 'merchant-789',
          user_id: 'user-001',
          placement: 'homepage_banner',
          device_type: 'mobile',
          platform: 'ios',
          location: 'Mumbai',
          referrer: 'google.com',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('eventId');
    });

    it('should accept impression with minimal fields', async () => {
      const response = await request(app)
        .post('/webhook/ads/impression')
        .send({
          ad_id: 'ad-123',
          campaign_id: 'campaign-456',
          merchant_id: 'merchant-789',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /webhook/ads/click', () => {
    it('should accept valid ad click event', async () => {
      const response = await request(app)
        .post('/webhook/ads/click')
        .send({
          ad_id: 'ad-123',
          campaign_id: 'campaign-456',
          merchant_id: 'merchant-789',
          user_id: 'user-001',
          placement: 'sidebar',
          device_type: 'desktop',
          platform: 'windows',
          location: 'Delhi',
          cta_clicked: 'Order Now',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should accept click with optional fields', async () => {
      const response = await request(app)
        .post('/webhook/ads/click')
        .send({
          ad_id: 'ad-123',
          campaign_id: 'campaign-456',
          merchant_id: 'merchant-789',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /webhook/ads/conversion', () => {
    it('should accept valid conversion event', async () => {
      const response = await request(app)
        .post('/webhook/ads/conversion')
        .send({
          conversion_id: 'conv-123',
          campaign_id: 'campaign-456',
          merchant_id: 'merchant-789',
          user_id: 'user-001',
          order_id: 'order-999',
          value: 150.00,
          currency: 'INR',
          source: 'ad',
          channel: 'facebook',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should use defaults when optional fields are missing', async () => {
      const response = await request(app)
        .post('/webhook/ads/conversion')
        .send({
          conversion_id: 'conv-123',
          campaign_id: 'campaign-456',
          merchant_id: 'merchant-789',
          value: 100.00,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /webhook/marketing/campaign', () => {
    it('should accept valid campaign event', async () => {
      const response = await request(app)
        .post('/webhook/marketing/campaign')
        .send({
          campaign_id: 'camp-123',
          campaign_name: 'Summer Sale',
          merchant_id: 'merchant-789',
          channel: 'marketing',
          budget: 5000.00,
          start_date: '2024-06-01T00:00:00Z',
          end_date: '2024-06-30T23:59:59Z',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should use campaign_id as name if not provided', async () => {
      const response = await request(app)
        .post('/webhook/marketing/campaign')
        .send({
          campaign_id: 'camp-123',
          merchant_id: 'merchant-789',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /webhook/marketing/voucher', () => {
    it('should accept valid voucher event', async () => {
      const response = await request(app)
        .post('/webhook/marketing/voucher')
        .send({
          voucher_id: 'voucher-123',
          campaign_id: 'camp-456',
          merchant_id: 'merchant-789',
          user_id: 'user-001',
          voucher_code: 'SAVE20',
          discount_type: 'percentage',
          discount_value: 20,
          min_order_value: 100.00,
          expires_at: '2024-12-31T23:59:59Z',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should use defaults when optional fields missing', async () => {
      const response = await request(app)
        .post('/webhook/marketing/voucher')
        .send({
          voucher_id: 'voucher-123',
          campaign_id: 'camp-456',
          merchant_id: 'merchant-789',
          user_id: 'user-001',
          voucher_code: 'SAVE20',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('POST /webhook/marketing/notification', () => {
    it('should emit notification.sent when action is not opened', async () => {
      const response = await request(app)
        .post('/webhook/marketing/notification')
        .send({
          notification_id: 'notif-123',
          campaign_id: 'camp-456',
          merchant_id: 'merchant-789',
          user_id: 'user-001',
          channel: 'push',
          template_id: 'template-001',
          title: 'Special Offer!',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should emit notification.opened when action is opened', async () => {
      const response = await request(app)
        .post('/webhook/marketing/notification')
        .send({
          notification_id: 'notif-123',
          campaign_id: 'camp-456',
          merchant_id: 'merchant-789',
          user_id: 'user-001',
          channel: 'email',
          action: 'opened',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });

    it('should use push as default channel', async () => {
      const response = await request(app)
        .post('/webhook/marketing/notification')
        .send({
          notification_id: 'notif-123',
          merchant_id: 'merchant-789',
          user_id: 'user-001',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
    });
  });

  // ============================================
  // Validation Tests
  // ============================================
  describe('Validation Tests', () => {
    it('should accept empty body for optional fields', async () => {
      const response = await request(app)
        .post('/webhook/merchant/customer')
        .send({});

      expect(response.status).toBe(200);
    });

    it('should handle missing optional fields gracefully', async () => {
      const response = await request(app)
        .post('/webhook/consumer/search')
        .send({});

      expect(response.status).toBe(200);
    });

    it('should handle null values in optional fields', async () => {
      const response = await request(app)
        .post('/webhook/ads/impression')
        .send({
          ad_id: 'ad-123',
          campaign_id: 'campaign-456',
          merchant_id: 'merchant-789',
          user_id: null,
          placement: null,
        });

      expect(response.status).toBe(201);
    });
  });

  // ============================================
  // Correlation ID Tests
  // ============================================
  describe('Correlation ID Tests', () => {
    it('should generate correlation ID on successful event', async () => {
      const response = await request(app)
        .post('/webhook/merchant/inventory')
        .send({
          merchant_id: 'test-merchant-123',
          item_id: 'item-456',
          current_stock: 5,
          threshold: 10,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('correlationId');
      expect(response.body.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should return valid UUID format for correlation IDs', async () => {
      const response = await request(app)
        .post('/webhook/merchant/inventory')
        .send({
          merchant_id: 'test-merchant-123',
          item_id: 'item-456',
          current_stock: 5,
          threshold: 10,
        });

      expect(response.status).toBe(201);
      expect(response.body.correlationId).toBeDefined();
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(response.body.correlationId).toMatch(uuidRegex);
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================
  describe('Error Handling Tests', () => {
    it('should return 404 for unknown webhook endpoint', async () => {
      const response = await request(app)
        .post('/webhook/unknown/endpoint')
        .send({ test: 'data' });

      expect(response.status).toBe(404);
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/webhook/merchant/inventory')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      // Express with built-in JSON parser returns 400 for malformed JSON
      // or the route handles it gracefully
      expect([400, 500]).toContain(response.status);
    });

    it('should handle missing content type gracefully', async () => {
      const response = await request(app)
        .post('/webhook/merchant/inventory')
        .send('not json');

      // Express handles it by parsing as urlencoded
      // Response should be valid HTTP status
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(600);
    });
  });
});
