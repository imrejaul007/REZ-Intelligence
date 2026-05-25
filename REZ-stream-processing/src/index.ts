/**
 * REZ Stream Processing - Main Entry Point
 *
 * Real-time event streaming and processing service
 * - Kafka producer/consumer for event bus
 * - Stream transformations (filter, map, enrich, aggregate)
 * - Real-time analytics
 * - Event storage and querying
 *
 * Port: 4142
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';

import logger from './utils/logger.js';
import { kafkaService } from './kafka/kafkaService.js';
import { eventProcessor } from './streaming/eventProcessor.js';

const PORT = parseInt(process.env.PORT || '4142', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-stream-processing';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

// Default topics to listen to
const DEFAULT_TOPICS = [
  'commerce.orders',
  'commerce.payments',
  'identity.events',
  'engagement.events',
  'intelligence.signals',
  'geo.events',
  'notification.events',
  'zevents.bookings',
  'zevents.checkins'
];

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`, { query: req.query });
  next();
});

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'rez-stream-processing',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    kafka: kafkaService.isConnected() ? 'connected' : 'disconnected',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Readiness check
app.get('/ready', async (_req, res) => {
  const ready = kafkaService.isConnected() && mongoose.connection.readyState === 1;
  if (ready) {
    res.json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready' });
  }
});

// API info
app.get('/', (_req, res) => {
  res.json({
    service: 'REZ Stream Processing',
    version: '1.0.0',
    port: PORT,
    description: 'Real-time event streaming and processing',
    kafka: {
      brokers: KAFKA_BROKERS,
      topics: DEFAULT_TOPICS
    },
    endpoints: {
      events: '/api/events',
      publish: '/api/publish',
      aggregates: '/api/aggregates/:windowId',
      stats: '/api/stats',
    },
  });
});

// ============================================
// EVENT QUERYING
// ============================================

app.get('/api/events', async (req, res) => {
  try {
    const { type, limit = '100', offset = '0' } = req.query;

    const events = await eventProcessor.getRecentEvents(
      type as string | undefined,
      parseInt(limit as string, 10)
    );

    res.json({
      events,
      count: events.length,
      pagination: {
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10)
      }
    });
  } catch (error) {
    logger.error('Events query error', { error });
    res.status(500).json({ error: 'Failed to get events' });
  }
});

app.get('/api/events/counts', async (req, res) => {
  try {
    const { since = '3600000', groupBy = 'eventType' } = req.query; // Default: last hour

    const sinceDate = new Date(Date.now() - parseInt(since as string, 10));
    const counts = await eventProcessor.getEventCounts(sinceDate, groupBy as 'eventType' | 'source');

    res.json({ counts, since: sinceDate.toISOString(), groupBy });
  } catch (error) {
    logger.error('Counts query error', { error });
    res.status(500).json({ error: 'Failed to get counts' });
  }
});

// ============================================
// EVENT PUBLISHING
// ============================================

app.post('/api/publish', async (req, res) => {
  try {
    const { topic, event } = req.body;

    if (!topic || !event) {
      res.status(400).json({ error: 'Topic and event required' });
      return;
    }

    await kafkaService.send(topic, {
      value: {
        eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...event,
        _publishedAt: new Date().toISOString(),
        _publisher: 'api'
      }
    });

    res.json({ success: true, topic, eventId: event.eventId });
  } catch (error) {
    logger.error('Publish error', { error });
    res.status(500).json({ error: 'Failed to publish event' });
  }
});

app.post('/api/publish/batch', async (req, res) => {
  try {
    const { topic, events } = req.body;

    if (!topic || !events || !Array.isArray(events)) {
      res.status(400).json({ error: 'Topic and events array required' });
      return;
    }

    const messages = events.map(event => ({
      key: event.key,
      value: {
        eventId: event.eventId || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...event,
        _publishedAt: new Date().toISOString()
      }
    }));

    await kafkaService.sendBatch(topic, messages);

    res.json({ success: true, topic, count: events.length });
  } catch (error) {
    logger.error('Batch publish error', { error });
    res.status(500).json({ error: 'Failed to publish events' });
  }
});

// ============================================
// AGGREGATION
// ============================================

app.get('/api/aggregates/:windowId', (req, res) => {
  try {
    const { windowId } = req.params;
    const { windowKey } = req.query;

    if (!windowKey) {
      res.status(400).json({ error: 'windowKey query parameter required' });
      return;
    }

    const result = eventProcessor.getAggregation(windowId, windowKey as string);

    if (!result) {
      res.status(404).json({ error: 'Aggregation not found' });
      return;
    }

    res.json(result);
  } catch (error) {
    logger.error('Aggregation query error', { error });
    res.status(500).json({ error: 'Failed to get aggregation' });
  }
});

// ============================================
// STATISTICS
// ============================================

app.get('/api/stats', async (req, res) => {
  try {
    const topics = await kafkaService.listTopics();

    res.json({
      kafka: {
        brokers: KAFKA_BROKERS,
        connected: kafkaService.isConnected(),
        topics: topics.length
      },
      mongodb: {
        uri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@'),
        connected: mongoose.connection.readyState === 1
      },
      uptime: process.uptime()
    });
  } catch (error) {
    logger.error('Stats error', { error });
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ============================================
// TOPIC MANAGEMENT
// ============================================

app.get('/api/topics', async (req, res) => {
  try {
    const topics = await kafkaService.listTopics();
    res.json({ topics });
  } catch (error) {
    logger.error('Topics error', { error });
    res.status(500).json({ error: 'Failed to list topics' });
  }
});

app.post('/api/topics', async (req, res) => {
  try {
    const { topics } = req.body;

    if (!topics || !Array.isArray(topics)) {
      res.status(400).json({ error: 'Topics array required' });
      return;
    }

    await kafkaService.createTopics(topics);
    res.json({ success: true, topics });
  } catch (error) {
    logger.error('Topic creation error', { error });
    res.status(500).json({ error: 'Failed to create topics' });
  }
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err });
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down...');

  try {
    await kafkaService.stopConsumer();
    await kafkaService.disconnect();
    await mongoose.connection.close();
  } catch (error) {
    logger.error('Shutdown error', { error });
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Initialize stream processors
function initializeProcessors(): void {
  // Commerce order processor
  eventProcessor.registerProcessor({
    name: 'commerce-orders',
    inputTopics: ['commerce.orders'],
    outputTopic: 'commerce.orders.processed',
    transformations: ['filter', 'map', 'enrich']
  });

  // Payment processor
  eventProcessor.registerProcessor({
    name: 'commerce-payments',
    inputTopics: ['commerce.payments'],
    outputTopic: 'commerce.payments.processed',
    transformations: ['filter', 'map', 'enrich', 'aggregate']
  });

  // Z-Events booking processor
  eventProcessor.registerProcessor({
    name: 'zevents-bookings',
    inputTopics: ['zevents.bookings'],
    outputTopic: 'zevents.bookings.enriched',
    transformations: ['filter', 'map', 'enrich']
  });

  // Z-Events checkin processor
  eventProcessor.registerProcessor({
    name: 'zevents-checkins',
    inputTopics: ['zevents.checkins'],
    outputTopic: 'zevents.checkins.enriched',
    transformations: ['filter', 'map', 'enrich', 'aggregate']
  });

  // Intelligence signals processor
  eventProcessor.registerProcessor({
    name: 'intelligence-signals',
    inputTopics: ['intelligence.signals'],
    outputTopic: 'intelligence.signals.processed',
    transformations: ['filter', 'map', 'enrich', 'fanout']
  });

  // Define aggregation windows
  eventProcessor.defineWindow('payment-tumbling-1min', {
    type: 'tumbling',
    sizeMs: 60000 // 1 minute
  });

  eventProcessor.defineWindow('checkin-tumbling-5min', {
    type: 'tumbling',
    sizeMs: 300000 // 5 minutes
  });

  logger.info('Stream processors initialized', {
    processorCount: 5,
    windowCount: 2
  });
}

// Start server
async function start(): Promise<void> {
  try {
    // Connect to Kafka
    await kafkaService.connect();

    // Create default topics
    await kafkaService.createTopics(DEFAULT_TOPICS);

    // Connect to MongoDB
    await eventProcessor.connectToMongo(MONGODB_URI);

    // Initialize processors
    initializeProcessors();

    // Start processing
    await eventProcessor.startProcessing();

    app.listen(PORT, () => {
      logger.info(`REZ Stream Processing started on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API base: http://localhost:${PORT}/api`);
      logger.info(`Kafka brokers: ${KAFKA_BROKERS.join(', ')}`);
      logger.info(`Listening to topics: ${DEFAULT_TOPICS.join(', ')}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

start();

export { app };
