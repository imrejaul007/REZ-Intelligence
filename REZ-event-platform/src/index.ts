import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config, connectMongoDB, connectRedis, disconnectAll } from './config';
import { logger } from './utils/logger.js';
import { initializeQueues, initializeWorkers, shutdownWorkers } from './events/consumer';
import { schemaRegistry, EventType, getSchemaDocumentation } from './events/schema-registry';
import { eventEmitter, publish } from './events/emitter';
import {
  healthCheckHandler,
  readinessCheckHandler,
  livenessCheckHandler,
  statsHandler,
} from './health';
import { Event } from './events/schema-registry';
import { trackingRouter, startAlertChecker, stopAlertChecker } from './middleware/eventTracking';
import { verifyWebhookSignature, captureRawBody, RawBodyRequest } from './middleware/webhookVerification';

// Initialize Express app
const app: Express = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Raw body capture for webhook signature verification (must be before json parser)
app.use(express.json({
  limit: '10mb',
  verify: (req: Request, res: Response, buf: Buffer) => {
    // Attach raw body to request for signature verification
    (req as RawBodyRequest).rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    });
  });

  next();
});

// ============================================
// Health & Monitoring Routes
// ============================================
app.get('/health', healthCheckHandler);
app.get('/ready', readinessCheckHandler);
app.get('/live', livenessCheckHandler);
app.get('/stats', statsHandler);

// ============================================
// Event Tracking Routes
// ============================================
app.use('/tracking', trackingRouter);

// ============================================
// Webhook Router (with signature verification)
// All webhook routes require valid HMAC-SHA256 signature
// ============================================
const webhookRouter = express.Router();

// Apply webhook signature verification to all webhook routes
webhookRouter.use(verifyWebhookSignature);

// Merchant webhooks
webhookRouter.post('/merchant/inventory', async (req: Request, res: Response) => {
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

webhookRouter.post('/merchant/order', async (req: Request, res: Response) => {
  try {
    const { merchant_id, order_id, customer_id, items, total_amount, payment_method } = req.body;
    const result = await eventEmitter.emitOrderCompleted({
      orderId: order_id,
      customerId: customer_id,
      items: (items || []).map((i: { item_id: string; name?: string; quantity: number; price: number }) => ({
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

webhookRouter.post('/merchant/payment', async (req: Request, res: Response) => {
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

webhookRouter.post('/merchant/customer', async (req: Request, res: Response) => {
  // Customer events - store in event store for analytics
  logger.info('Customer event received', { payload: req.body });
  res.status(200).json({ success: true, message: 'Customer event logged' });
});

// Consumer webhooks
webhookRouter.post('/consumer/order', async (req: Request, res: Response) => {
  try {
    const { user_id, order_id, merchant_id, items, total_amount } = req.body;
    const result = await eventEmitter.emitOrderCompleted({
      orderId: order_id,
      customerId: user_id,
      items: (items || []).map((i: { item_id: string; name?: string; quantity: number; price: number }) => ({
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

webhookRouter.post('/consumer/search', async (req: Request, res: Response) => {
  logger.info('Search event received', { payload: req.body });
  res.status(200).json({ success: true, message: 'Search event logged' });
});

webhookRouter.post('/consumer/view', async (req: Request, res: Response) => {
  logger.info('View event received', { payload: req.body });
  res.status(200).json({ success: true, message: 'View event logged' });
});

webhookRouter.post('/consumer/booking', async (req: Request, res: Response) => {
  logger.info('Booking event received', { payload: req.body });
  res.status(200).json({ success: true, message: 'Booking event logged' });
});

// Ad/Growth Event Webhooks
webhookRouter.post('/ads/impression', async (req: Request, res: Response) => {
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

webhookRouter.post('/ads/click', async (req: Request, res: Response) => {
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

webhookRouter.post('/ads/conversion', async (req: Request, res: Response) => {
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

webhookRouter.post('/marketing/campaign', async (req: Request, res: Response) => {
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

webhookRouter.post('/marketing/voucher', async (req: Request, res: Response) => {
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

webhookRouter.post('/marketing/notification', async (req: Request, res: Response) => {
  try {
    const { notification_id, campaign_id, merchant_id, user_id, channel, template_id, title, action } = req.body;
    // Handle both sent and opened via action field
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

// Mount the webhook router (with signature verification)
app.use('/webhook', webhookRouter);

// ============================================
// Event Publishing Routes
// ============================================

// Publish any event (raw)
app.post('/events/publish', async (req: Request, res: Response) => {
  try {
    const event = req.body as Event;

    if (!event.type) {
      return res.status(400).json({ error: 'Event type is required' });
    }

    const result = await eventEmitter.publish(event, {
      source: config.service.name,
    });

    if (result.success) {
      res.status(201).json({
        success: true,
        eventId: result.eventId,
        correlationId: result.correlationId,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        validationErrors: result.validationErrors,
      });
    }
  } catch (error) {
    logger.error('Failed to publish event', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Emit inventory.low event
app.post('/events/inventory/low', async (req: Request, res: Response) => {
  try {
    const result = await eventEmitter.emitInventoryLow(req.body);

    if (result.success) {
      res.status(201).json({
        success: true,
        eventId: result.eventId,
        correlationId: result.correlationId,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        validationErrors: result.validationErrors,
      });
    }
  } catch (error) {
    logger.error('Failed to emit inventory.low event', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Emit order.completed event
app.post('/events/order/completed', async (req: Request, res: Response) => {
  try {
    const result = await eventEmitter.emitOrderCompleted(req.body);

    if (result.success) {
      res.status(201).json({
        success: true,
        eventId: result.eventId,
        correlationId: result.correlationId,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        validationErrors: result.validationErrors,
      });
    }
  } catch (error) {
    logger.error('Failed to emit order.completed event', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Emit payment.success event
app.post('/events/payment/success', async (req: Request, res: Response) => {
  try {
    const result = await eventEmitter.emitPaymentSuccess(req.body);

    if (result.success) {
      res.status(201).json({
        success: true,
        eventId: result.eventId,
        correlationId: result.correlationId,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        validationErrors: result.validationErrors,
      });
    }
  } catch (error) {
    logger.error('Failed to emit payment.success event', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Schema Documentation Routes
// ============================================
app.get('/schemas', (req: Request, res: Response) => {
  res.json(getSchemaDocumentation());
});

app.get('/schemas/:type', (req: Request, res: Response) => {
  const { type } = req.params;
  const schema = schemaRegistry.getSchema(type);

  if (!schema) {
    return res.status(404).json({ error: `Schema not found for type: ${type}` });
  }

  res.json({
    type,
    version: schemaRegistry.getVersion(type),
    schema: schema,
  });
});

// ============================================
// Service Info Route
// ============================================
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: config.service.name,
    version: config.events.schemaVersion,
    description: 'REZ Event Platform - Central event bus for the ecosystem',
    endpoints: {
      health: '/health',
      ready: '/ready',
      live: '/live',
      stats: '/stats',
      schemas: '/schemas',
      publish: '/events/publish',
      inventory: {
        low: '/events/inventory/low',
      },
      order: {
        completed: '/events/order/completed',
      },
      payment: {
        success: '/events/payment/success',
      },
    },
    eventTypes: schemaRegistry.getRegisteredTypes(),
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: 'Internal server error',
    message: config.service.env === 'development' ? err.message : undefined,
  });
});

// ============================================
// Server Startup
// ============================================
async function startServer(): Promise<void> {
  try {
    logger.info('Starting REZ Event Platform...', { config: config.service });

    // Connect to MongoDB
    await connectMongoDB();

    // Connect to Redis
    await connectRedis();

    // Initialize event queues
    await initializeQueues();

    // Start BullMQ workers
    await initializeWorkers();

    // Start event tracking alert checker (checks every 60 seconds)
    startAlertChecker(60000);

    // Start HTTP server
    const server = app.listen(config.service.port, () => {
      logger.info(`REZ Event Platform started`, {
        port: config.service.port,
        env: config.service.env,
        schemas: schemaRegistry.getRegisteredTypes(),
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      // Stop alert checker
      stopAlertChecker();

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await shutdownWorkers();
          await disconnectAll();
          logger.info('Shutdown complete');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', { error });
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    process.exit(1);
  }
}

// Start the server
startServer();

export { app };
