/**
 * REZ Action Engine - Observer Mode
 *
 * LISTENS to events and CREATES decisions (no execution)
 *
 * Flow:
 * inventory.low → RECEIVED → DECISION LOGGED
 */

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { logger } from './config/logger';

const app: Application = express();
const PORT = parseInt(process.env.PORT || '4009', 10);
const EVENT_PLATFORM_URL = process.env.EVENT_PLATFORM_URL || 'http://localhost:4008';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://work_db_user:ZAFYAYH1zK0C74Ap@rez-intent-graph.a8ilqgi.mongodb.net/rez-actions?retryWrites=true&w=majority';

// Decision schema
const decisionSchema = new mongoose.Schema({
  correlationId: String,
  eventType: String,
  decision: String,
  confidence: Number,
  actionLevel: String,
  payload: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
});

const Decision = mongoose.models.Decision || mongoose.model('Decision', decisionSchema, 'decisions');

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request logging
app.use((req: Request, res: Response, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('HTTP', { method: req.method, path: req.path, status: res.statusCode, duration: Date.now() - start });
  });
  next();
});

// Health
app.get('/health', async (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-action-engine',
    mode: 'observer',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.get('/live', (req: Request, res: Response) => {
  res.json({ alive: true });
});

// Stats
app.get('/stats', async (req: Request, res: Response) => {
  try {
    const total = await Decision.countDocuments();
    const byDecision = await Decision.aggregate([
      { $group: { _id: '$decision', count: { $sum: 1 } } }
    ]);
    res.json({ total, byDecision });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Decisions list
app.get('/decisions', async (req: Request, res: Response) => {
  try {
    const decisions = await Decision.find().sort({ createdAt: -1 }).limit(50);
    res.json({ decisions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Root
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'rez-action-engine',
    version: '1.0.0',
    mode: 'observer',
    description: 'Decision engine - observes events, creates decisions (no execution)',
    endpoints: {
      health: '/health',
      stats: '/stats',
      decisions: '/decisions',
    },
  });
});

// Event webhook receiver (Observer Mode)
// This endpoint receives events from Event Platform
app.post('/webhook/events', async (req: Request, res: Response) => {
  const event = req.body;
  const eventType = event.event || event.type;

  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', {});
  logger.info('[EVENT RECEIVED]', { eventType, correlationId: event.correlation_id });
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', {});

  try {
    // Create decision based on event type
    const decision = createDecision(eventType, event);

    // Store decision
    const doc = new Decision({
      correlationId: event.correlation_id,
      eventType: eventType,
      decision: decision.type,
      confidence: decision.confidence,
      actionLevel: decision.actionLevel,
      payload: event,
    });
    await doc.save();

    logger.info('[DECISION CREATED]', {
      correlationId: event.correlation_id,
      decision: decision.type,
      confidence: decision.confidence,
      actionLevel: decision.actionLevel,
    });
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', {});

    res.json({
      success: true,
      decision: decision,
      decisionId: doc._id,
    });
  } catch (error: any) {
    logger.error('[DECISION ERROR]', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create decision based on event type (Observer Mode)
 * NO execution - just decision logic
 */
function createDecision(eventType: string, event: any) {
  switch (eventType) {
    case 'inventory.low':
      return {
        type: 'draft_po_suggested',
        confidence: 0.82,
        actionLevel: 'SEMI_SAFE',
        reason: 'Low inventory detected, draft PO recommended',
        data: {
          item_id: event.data?.item_id,
          current_stock: event.data?.current_stock,
          threshold: event.data?.threshold,
          suggested_quantity: Math.max(10, (event.data?.threshold || 5) * 2),
        },
      };

    case 'order.completed':
      return {
        type: 'loyalty_reward',
        confidence: 0.95,
        actionLevel: 'SAFE',
        reason: 'Order completed, reward points credited',
        data: {
          order_id: event.data?.order_id,
          coins_earned: event.data?.coins_earned,
        },
      };

    case 'payment.success':
      return {
        type: 'payment_confirmed',
        confidence: 0.99,
        actionLevel: 'SAFE',
        reason: 'Payment successful, order can proceed',
        data: {
          transaction_id: event.data?.transaction_id,
          amount: event.data?.amount,
        },
      };

    default:
      return {
        type: 'unknown_event',
        confidence: 0.0,
        actionLevel: 'RISKY',
        reason: 'Unknown event type, manual review required',
        data: {},
      };
  }
}

// Polling worker (Observer Mode - polls Event Platform)
async function pollEvents() {
  logger.info('[POLLER] Starting event polling...');

  setInterval(async () => {
    try {
      // In real implementation, this would poll Event Platform
      // For now, events are pushed via webhook
    } catch (error: any) {
      logger.error('[POLLER ERROR]', { error: error.message });
    }
  }, 5000);
}

// Startup
async function start() {
  try {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', {});
    logger.info('Starting REZ Action Engine (OBSERVER MODE)', {});
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', {});

    // Connect to MongoDB
    logger.info('Connecting to MongoDB...', { uri: MONGODB_URI.substring(0, 50) + '...' });
    await mongoose.connect(MONGODB_URI);
    logger.info('MongoDB connected successfully');

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, {});
      logger.info(`REZ Action Engine started (Observer Mode)`, { port: PORT });
      logger.info(`Health: http://localhost:${PORT}/health`);
      logger.info(`Webhook: POST http://localhost:${PORT}/webhook/events`);
      logger.info(`Decisions: GET http://localhost:${PORT}/decisions`);
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, {});
    });

    // Start polling
    await pollEvents();

  } catch (error: any) {
    logger.error('Failed to start', { error: error.message });
    process.exit(1);
  }
}

start();
