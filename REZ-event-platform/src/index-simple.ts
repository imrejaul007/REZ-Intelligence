/**
 * Simplified Event Platform - With Action Engine Integration
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import axios from 'axios';
import { logger } from './utils/logger.js';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs/promises';
import path from 'path';

// Load OpenAPI spec for Swagger UI
const openApiSpecPath = path.join(__dirname, 'docs', 'openapi.yaml');
let openApiSpec: unknown = null;

async function loadOpenApiSpec(): Promise<void> {
  try {
    await fs.access(openApiSpecPath);
    const specContent = await fs.readFile(openApiSpecPath, 'utf8');
    openApiSpec = require('js-yaml').load(specContent);
    logger.info('OpenAPI spec loaded successfully', { path: openApiSpecPath });
  } catch (error) {
    logger.warn('Failed to load OpenAPI spec', { error: error.message });
  }
}

const app: Express = express();
const PORT = parseInt(process.env.PORT || '4008', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-app';
const ACTION_ENGINE_URL = process.env.ACTION_ENGINE_URL || 'http://localhost:4009';

// Reuse existing schema
const eventLogSchema = new mongoose.Schema({
  type: String,
  correlationId: String,
  source: String,
  payload: mongoose.Schema.Types.Mixed,
  status: { type: String, default: 'received' },
  createdAt: { type: Date, default: Date.now },
});

const EventLog = mongoose.models.EventLog || mongoose.model('EventLog', eventLogSchema, 'event_logs');

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Swagger UI - API Documentation
if (openApiSpec) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'REZ Event Platform API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
    },
  }));
  logger.info('Swagger UI available at /api-docs');
}

// Request logging
app.use((req: Request, res: Response, next) => {
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

// Health check
app.get('/health', async (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-event-platform',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    actionEngine: ACTION_ENGINE_URL,
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', (req: Request, res: Response) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ ready });
});

app.get('/live', (req: Request, res: Response) => {
  res.json({ alive: true });
});

// Root
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'rez-event-platform',
    version: '1.0.0',
    description: 'REZ Mind - Central event bus',
    documentation: {
      swagger_ui: '/api-docs',
      openapi_spec: '/docs/openapi.yaml',
      webhook_status: '/webhook/status',
    },
    endpoints: {
      health: '/health',
      ready: '/ready',
      live: '/live',
      publish: 'POST /events/:type',
      merchant_webhooks: '/webhook/status',
      inventory: 'POST /webhook/merchant/inventory',
      order: 'POST /webhook/merchant/order',
      payment: 'POST /webhook/merchant/payment',
      consumer_order: 'POST /webhook/consumer/order',
      consumer_search: 'POST /webhook/consumer/search',
      consumer_view: 'POST /webhook/consumer/view',
    },
  });
});

// Event publishing endpoint
app.post('/events/:type', async (req: Request, res: Response) => {
  const eventType = req.params.type;
  const event = req.body;

  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', {});
  logger.info('[EVENT RECEIVED]', { eventType, correlationId: event.correlation_id });
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', {});

  try {
    // Check for duplicate using correlation_id
    if (event.correlation_id) {
      const existing = await EventLog.findOne({ correlationId: event.correlation_id });
      if (existing) {
        logger.info('[DUPLICATE DETECTED]', { correlationId: event.correlation_id });
        return res.json({
          success: true,
          eventId: existing._id,
          correlationId: existing.correlationId,
          duplicate: true,
        });
      }
    }

    // Store event
    const log = new EventLog({
      type: eventType,
      correlationId: event.correlation_id || event.correlationId,
      source: event.source,
      payload: event,
      status: 'received',
    });
    await log.save();

    logger.info('[EVENT STORED]', { eventId: log._id, eventType, correlationId: log.correlationId });

    // Forward to Action Engine
    try {
      logger.info('[FORWARDING TO ACTION ENGINE]', { url: `${ACTION_ENGINE_URL}/webhook/events` });
      const aeResponse = await axios.post(`${ACTION_ENGINE_URL}/webhook/events`, event, {
        timeout: 5000,
      });
      logger.info('[ACTION ENGINE RESPONSE]', {
        success: aeResponse.data?.success,
        decision: aeResponse.data?.decision?.type
      });
    } catch (aeError) {
      logger.error('[ACTION ENGINE ERROR]', { error: aeError.message });
      // Don't fail the event - just log the error
    }

    res.json({
      success: true,
      eventId: log._id,
      correlationId: log.correlationId,
    });
  } catch (error) {
    logger.error('[EVENT ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stats endpoint
app.get('/stats', async (req: Request, res: Response) => {
  try {
    const total = await EventLog.countDocuments();
    const byType = await EventLog.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    res.json({ total, byType });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// MERCHANT APP WEBHOOKS - For connecting Merchant OS
// ============================================================

// Merchant inventory event
app.post('/webhook/merchant/inventory', async (req: Request, res: Response) => {
  const { merchant_id, item_id, item_name, current_stock, threshold, avg_daily_sales, recent_orders, source } = req.body;

  const correlation_id = `merchant_${merchant_id}_${Date.now()}`;

  logger.info('[MERCHANT INVENTORY EVENT]', { merchant_id, item_id, correlation_id });

  try {
    const event = {
      event: 'inventory.low',
      correlation_id,
      source: source || 'merchant_app',
      data: {
        merchant_id,
        item_id,
        item_name,
        current_stock: parseInt(current_stock),
        threshold: parseInt(threshold),
        avg_daily_sales: avg_daily_sales ? parseFloat(avg_daily_sales) : undefined,
        recent_orders_last_3_days: recent_orders ? parseInt(recent_orders) : undefined,
      }
    };

    // Store event
    const log = new EventLog({
      type: 'inventory.low',
      correlationId: correlation_id,
      source: source || 'merchant_app',
      payload: event,
      status: 'received',
    });
    await log.save();

    // Forward to Action Engine
    try {
      await axios.post(`${ACTION_ENGINE_URL}/webhook/events`, event, { timeout: 5000 });
    } catch (aeError) {
      logger.error('[ACTION ENGINE ERROR]', { error: (aeError as Error).message });
    }

    res.json({ success: true, correlation_id, event_id: log._id });
  } catch (error) {
    logger.error('[MERCHANT EVENT ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Merchant order completed event
app.post('/webhook/merchant/order', async (req: Request, res: Response) => {
  const { merchant_id, order_id, items, total_amount, customer_id, payment_method, source } = req.body;

  const correlation_id = `merchant_order_${merchant_id}_${Date.now()}`;

  logger.info('[MERCHANT ORDER EVENT]', { merchant_id, order_id, correlation_id });

  try {
    const event = {
      event: 'order.completed',
      correlation_id,
      source: source || 'merchant_app',
      data: {
        order_id,
        merchant_id,
        customer_id,
        items: items || [],
        total_amount: parseFloat(total_amount),
        payment_method,
      }
    };

    const log = new EventLog({
      type: 'order.completed',
      correlationId: correlation_id,
      source: source || 'merchant_app',
      payload: event,
      status: 'received',
    });
    await log.save();

    res.json({ success: true, correlation_id, event_id: log._id });
  } catch (error) {
    logger.error('[MERCHANT ORDER ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Merchant payment success event
app.post('/webhook/merchant/payment', async (req: Request, res: Response) => {
  const { merchant_id, transaction_id, amount, status, source } = req.body;

  const correlation_id = `merchant_payment_${merchant_id}_${Date.now()}`;

  logger.info('[MERCHANT PAYMENT EVENT]', { merchant_id, transaction_id, correlation_id });

  try {
    const event = {
      event: 'payment.success',
      correlation_id,
      source: source || 'merchant_app',
      data: {
        transaction_id,
        merchant_id,
        amount: parseFloat(amount),
        status,
      }
    };

    const log = new EventLog({
      type: 'payment.success',
      correlationId: correlation_id,
      source: source || 'merchant_app',
      payload: event,
      status: 'received',
    });
    await log.save();

    res.json({ success: true, correlation_id, event_id: log._id });
  } catch (error) {
    logger.error('[MERCHANT PAYMENT ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// CONSUMER APP WEBHOOKS - For connecting Consumer Apps
// ============================================================

// Consumer order event
app.post('/webhook/consumer/order', async (req: Request, res: Response) => {
  const { user_id, order_id, items, total_amount, merchant_id, source } = req.body;

  const correlation_id = `consumer_order_${user_id}_${Date.now()}`;

  logger.info('[CONSUMER ORDER EVENT]', { user_id, order_id, correlation_id });

  try {
    const event = {
      event: 'consumer.order',
      correlation_id,
      source: source || 'consumer_app',
      data: {
        order_id,
        user_id,
        merchant_id,
        items: items || [],
        total_amount: parseFloat(total_amount),
      }
    };

    const log = new EventLog({
      type: 'consumer.order',
      correlationId: correlation_id,
      source: source || 'consumer_app',
      payload: event,
      status: 'received',
    });
    await log.save();

    res.json({ success: true, correlation_id, event_id: log._id });
  } catch (error) {
    logger.error('[CONSUMER ORDER ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Consumer search event (for intent tracking)
app.post('/webhook/consumer/search', async (req: Request, res: Response) => {
  const { user_id, query, results_count, clicked_item, source } = req.body;

  const correlation_id = `consumer_search_${user_id}_${Date.now()}`;

  logger.info('[CONSUMER SEARCH EVENT]', { user_id, query, correlation_id });

  try {
    const event = {
      event: 'consumer.search',
      correlation_id,
      source: source || 'consumer_app',
      data: {
        user_id,
        query,
        results_count,
        clicked_item,
      }
    };

    const log = new EventLog({
      type: 'consumer.search',
      correlationId: correlation_id,
      source: source || 'consumer_app',
      payload: event,
      status: 'received',
    });
    await log.save();

    res.json({ success: true, correlation_id, event_id: log._id });
  } catch (error) {
    logger.error('[CONSUMER SEARCH ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Consumer view event
app.post('/webhook/consumer/view', async (req: Request, res: Response) => {
  const { user_id, item_id, item_name, merchant_id, duration_seconds, source } = req.body;

  const correlation_id = `consumer_view_${user_id}_${Date.now()}`;

  logger.info('[CONSUMER VIEW EVENT]', { user_id, item_id, correlation_id });

  try {
    const event = {
      event: 'consumer.view',
      correlation_id,
      source: source || 'consumer_app',
      data: {
        user_id,
        item_id,
        item_name,
        merchant_id,
        duration_seconds: parseInt(duration_seconds) || 0,
      }
    };

    const log = new EventLog({
      type: 'consumer.view',
      correlationId: correlation_id,
      source: source || 'consumer_app',
      payload: event,
      status: 'received',
    });
    await log.save();

    res.json({ success: true, correlation_id, event_id: log._id });
  } catch (error) {
    logger.error('[CONSUMER VIEW ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// AUTH WEBHOOKS - User Authentication Events
// ============================================================

// User signup event
app.post('/webhook/auth/signup', async (req: Request, res: Response) => {
  const { user_id, method, source } = req.body;

  const correlation_id = `auth_signup_${user_id}_${Date.now()}`;

  logger.info('[AUTH SIGNUP EVENT]', { user_id, method, correlation_id });

  try {
    const event = {
      event: 'auth.signup',
      correlation_id,
      source: source || 'auth_service',
      data: {
        user_id,
        method: method || 'email',
      }
    };

    const log = new EventLog({
      type: 'auth.signup',
      correlationId: correlation_id,
      source: source || 'auth_service',
      payload: event,
      status: 'received',
    });
    await log.save();

    res.json({ success: true, correlation_id, event_id: log._id });
  } catch (error) {
    logger.error('[AUTH SIGNUP ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// User login event
app.post('/webhook/auth/login', async (req: Request, res: Response) => {
  const { user_id, method, success, source } = req.body;

  const correlation_id = `auth_login_${user_id}_${Date.now()}`;

  logger.info('[AUTH LOGIN EVENT]', { user_id, method, success, correlation_id });

  try {
    const event = {
      event: 'auth.login',
      correlation_id,
      source: source || 'auth_service',
      data: {
        user_id,
        method: method || 'email',
        success: success !== false,
      }
    };

    const log = new EventLog({
      type: 'auth.login',
      correlationId: correlation_id,
      source: source || 'auth_service',
      payload: event,
      status: 'received',
    });
    await log.save();

    res.json({ success: true, correlation_id, event_id: log._id });
  } catch (error) {
    logger.error('[AUTH LOGIN ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// User logout event
app.post('/webhook/auth/logout', async (req: Request, res: Response) => {
  const { user_id, source } = req.body;

  const correlation_id = `auth_logout_${user_id}_${Date.now()}`;

  logger.info('[AUTH LOGOUT EVENT]', { user_id, correlation_id });

  try {
    const event = {
      event: 'auth.logout',
      correlation_id,
      source: source || 'auth_service',
      data: { user_id }
    };

    const log = new EventLog({
      type: 'auth.logout',
      correlationId: correlation_id,
      source: source || 'auth_service',
      payload: event,
      status: 'received',
    });
    await log.save();

    res.json({ success: true, correlation_id, event_id: log._id });
  } catch (error) {
    logger.error('[AUTH LOGOUT ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// WALLET WEBHOOKS - Wallet Transaction Events
// ============================================================

// Wallet topup event
app.post('/webhook/wallet/topup', async (req: Request, res: Response) => {
  const { user_id, amount, payment_method, balance_after, transaction_id, source } = req.body;

  const correlation_id = `wallet_topup_${transaction_id || user_id}_${Date.now()}`;

  logger.info('[WALLET TOPUP EVENT]', { user_id, amount, correlation_id });

  try {
    const event = {
      event: 'wallet.topup',
      correlation_id,
      source: source || 'wallet_service',
      data: {
        user_id,
        amount: parseFloat(amount),
        payment_method: payment_method || 'unknown',
        balance_after: balance_after ? parseFloat(balance_after) : undefined,
        transaction_id,
      }
    };

    const log = new EventLog({
      type: 'wallet.topup',
      correlationId: correlation_id,
      source: source || 'wallet_service',
      payload: event,
      status: 'received',
    });
    await log.save();

    res.json({ success: true, correlation_id, event_id: log._id });
  } catch (error) {
    logger.error('[WALLET TOPUP ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Wallet withdraw event
app.post('/webhook/wallet/withdraw', async (req: Request, res: Response) => {
  const { user_id, amount, status, transaction_id, source } = req.body;

  const correlation_id = `wallet_withdraw_${transaction_id || user_id}_${Date.now()}`;

  logger.info('[WALLET WITHDRAW EVENT]', { user_id, amount, status, correlation_id });

  try {
    const event = {
      event: 'wallet.withdraw',
      correlation_id,
      source: source || 'wallet_service',
      data: {
        user_id,
        amount: parseFloat(amount),
        status: status || 'pending',
        transaction_id,
      }
    };

    const log = new EventLog({
      type: 'wallet.withdraw',
      correlationId: correlation_id,
      source: source || 'wallet_service',
      payload: event,
      status: 'received',
    });
    await log.save();

    res.json({ success: true, correlation_id, event_id: log._id });
  } catch (error) {
    logger.error('[WALLET WITHDRAW ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// CATALOG WEBHOOKS - Menu/Catalog Events
// ============================================================

// Catalog view event
app.post('/webhook/catalog/view', async (req: Request, res: Response) => {
  const { user_id, merchant_id, item_id, item_name, category, source } = req.body;

  const correlation_id = `catalog_view_${item_id || merchant_id}_${Date.now()}`;

  logger.info('[CATALOG VIEW EVENT]', { user_id, merchant_id, item_id, correlation_id });

  try {
    const event = {
      event: 'catalog.view',
      correlation_id,
      source: source || 'catalog_service',
      data: {
        user_id,
        merchant_id,
        item_id,
        item_name,
        category,
      }
    };

    const log = new EventLog({
      type: 'catalog.view',
      correlationId: correlation_id,
      source: source || 'catalog_service',
      payload: event,
      status: 'received',
    });
    await log.save();

    res.json({ success: true, correlation_id, event_id: log._id });
  } catch (error) {
    logger.error('[CATALOG VIEW ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// GAMIFICATION WEBHOOKS - Points & Loyalty Events
// ============================================================

// Points earned event
app.post('/webhook/gamification/earn', async (req: Request, res: Response) => {
  const { user_id, points, reason, source } = req.body;

  const correlation_id = `gamification_earn_${user_id}_${Date.now()}`;

  logger.info('[GAMIFICATION EARN EVENT]', { user_id, points, reason, correlation_id });

  try {
    const event = {
      event: 'gamification.earn',
      correlation_id,
      source: source || 'gamification_service',
      data: {
        user_id,
        points: parseInt(points),
        reason: reason || 'unknown',
      }
    };

    const log = new EventLog({
      type: 'gamification.earn',
      correlationId: correlation_id,
      source: source || 'gamification_service',
      payload: event,
      status: 'received',
    });
    await log.save();

    res.json({ success: true, correlation_id, event_id: log._id });
  } catch (error) {
    logger.error('[GAMIFICATION EARN ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Points redeemed event
app.post('/webhook/gamification/redeem', async (req: Request, res: Response) => {
  const { user_id, points, reward_id, source } = req.body;

  const correlation_id = `gamification_redeem_${user_id}_${Date.now()}`;

  logger.info('[GAMIFICATION REDEEM EVENT]', { user_id, points, correlation_id });

  try {
    const event = {
      event: 'gamification.redeem',
      correlation_id,
      source: source || 'gamification_service',
      data: {
        user_id,
        points: parseInt(points),
        reward_id,
      }
    };

    const log = new EventLog({
      type: 'gamification.redeem',
      correlationId: correlation_id,
      source: source || 'gamification_service',
      payload: event,
      status: 'received',
    });
    await log.save();

    res.json({ success: true, correlation_id, event_id: log._id });
  } catch (error) {
    logger.error('[GAMIFICATION REDEEM ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// SUPPORT WEBHOOKS - Customer Support Events
// ============================================================

// Support ticket created
app.post('/webhook/support/ticket', async (req: Request, res: Response) => {
  const { ticket_id, user_id, category, priority, source } = req.body;

  const correlation_id = `support_ticket_${ticket_id}_${Date.now()}`;

  logger.info('[SUPPORT TICKET EVENT]', { ticket_id, user_id, category, correlation_id });

  try {
    const event = {
      event: 'support.ticket',
      correlation_id,
      source: source || 'support_service',
      data: {
        ticket_id,
        user_id,
        category: category || 'general',
        priority: priority || 'medium',
      }
    };

    const log = new EventLog({
      type: 'support.ticket',
      correlationId: correlation_id,
      source: source || 'support_service',
      payload: event,
      status: 'received',
    });
    await log.save();

    res.json({ success: true, correlation_id, event_id: log._id });
  } catch (error) {
    logger.error('[SUPPORT TICKET ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// CHAT WEBHOOKS - Messaging Events
// ============================================================

// Chat message sent
app.post('/webhook/chat/message', async (req: Request, res: Response) => {
  const { message_id, conversation_id, sender_id, sender_type, content, context, source } = req.body;

  const correlation_id = `chat_message_${message_id}_${Date.now()}`;

  logger.info('[CHAT MESSAGE EVENT]', { message_id, sender_id, correlation_id });

  try {
    const event = {
      event: 'chat.message',
      correlation_id,
      source: source || 'chat_service',
      data: {
        message_id,
        conversation_id,
        sender_id,
        sender_type: sender_type || 'user',
        content_preview: content ? content.substring(0, 100) : undefined,
        context: context || 'general',
      }
    };

    const log = new EventLog({
      type: 'chat.message',
      correlationId: correlation_id,
      source: source || 'chat_service',
      payload: event,
      status: 'received',
    });
    await log.save();

    res.json({ success: true, correlation_id, event_id: log._id });
  } catch (error) {
    logger.error('[CHAT MESSAGE ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// INTEGRATION STATUS
// ============================================================

app.get('/webhook/status', (req: Request, res: Response) => {
  res.json({
    service: 'rez-event-platform',
    version: '2.0.0',
    webhooks: {
      merchant: {
        'POST /webhook/merchant/inventory': 'Merchant inventory low event',
        'POST /webhook/merchant/order': 'Merchant order completed',
        'POST /webhook/merchant/payment': 'Merchant payment success',
      },
      consumer: {
        'POST /webhook/consumer/order': 'Consumer order placed',
        'POST /webhook/consumer/search': 'Consumer search query',
        'POST /webhook/consumer/view': 'Consumer item view',
      },
      auth: {
        'POST /webhook/auth/signup': 'User signup',
        'POST /webhook/auth/login': 'User login',
        'POST /webhook/auth/logout': 'User logout',
      },
      wallet: {
        'POST /webhook/wallet/topup': 'Wallet top-up',
        'POST /webhook/wallet/withdraw': 'Wallet withdrawal',
      },
      catalog: {
        'POST /webhook/catalog/view': 'Catalog item view',
      },
      gamification: {
        'POST /webhook/gamification/earn': 'Points earned',
        'POST /webhook/gamification/redeem': 'Points redeemed',
      },
      support: {
        'POST /webhook/support/ticket': 'Support ticket created',
      },
      chat: {
        'POST /webhook/chat/message': 'Chat message sent',
      }
    },
    action_engine_url: ACTION_ENGINE_URL,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

// Startup
async function start() {
  try {
    logger.info('Starting REZ Event Platform...');

    // Load OpenAPI spec at startup (async)
    await loadOpenApiSpec();

    logger.info('Connecting to MongoDB...', { uri: MONGODB_URI });
    await mongoose.connect(MONGODB_URI);
    logger.info('MongoDB connected successfully');

    app.listen(PORT, () => {
      logger.info(`REZ Event Platform started`, { port: PORT });
      logger.info(`Action Engine: ${ACTION_ENGINE_URL}`);
      logger.info(`Health: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start', { error: error.message });
    process.exit(1);
  }
}

start();
