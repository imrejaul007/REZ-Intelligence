/**
 * REZ Geo Intelligence Core - Main Entry Point
 *
 * Unified geo-intelligence platform connecting:
 * - Consumer Graph (preferences, affinities, behavior)
 * - Merchant Graph (locations, offers, performance)
 * - Event Graph (from Z-Events, demand patterns)
 * - Zone Graph (neighborhoods, demand zones)
 *
 * Port: 4140
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import { Redis } from 'ioredis';
import type { Redis as RedisType } from 'ioredis';

import logger from './utils/logger.js';
import { errorHandler, notFoundHandler, rateLimiter } from './middleware/auth.js';
import routes from './routes/index.js';
import { eventBusIntegration, GEOSUBSCRIBED_EVENTS } from './services/eventBusIntegration.js';

const PORT = parseInt(process.env.PORT || '4140', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-geo-intelligence';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'http://localhost:4082';

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
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`, { query: req.query });
  next();
});

// Rate limiting
app.use(rateLimiter(60000, 1000));

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'rez-geo-intelligence',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Readiness check
app.get('/ready', async (_req, res) => {
  const isReady = mongoose.connection.readyState === 1;
  if (isReady) {
    res.json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready' });
  }
});

// API info
app.get('/', (_req, res) => {
  res.json({
    service: 'REZ Geo Intelligence Core',
    version: '1.0.0',
    port: PORT,
    description: 'Unified geo-intelligence platform',
    endpoints: {
      graph: '/api/graph',
      events: '/api/events',
      demand: '/api/demand',
      recommendations: '/api/recommendations',
      zones: '/api/zones',
    },
    documentation: 'See SPEC.md for full API documentation',
  });
});

// API routes
app.use('/api', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Database connection
async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB', { uri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@') });

    // Create indexes
    await createIndexes();
  } catch (error) {
    logger.error('MongoDB connection failed', { error });
    throw error;
  }
}

async function createIndexes(): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    // Create 2dsphere indexes for geospatial queries
    await db.collection('geoconsumers').createIndex({ homeLocation: '2dsphere' });
    await db.collection('geoconsumers').createIndex({ workLocation: '2dsphere' });
    await db.collection('geoconsumers').createIndex({ lastKnownLocation: '2dsphere' });

    await db.collection('geomerchants').createIndex({ location: '2dsphere' });
    await db.collection('geomerchants').createIndex({ category: 1, location: '2dsphere' });

    await db.collection('geoevents').createIndex({ 'venue.location': '2dsphere' });
    await db.collection('geoevents').createIndex({ category: 1, startDate: 1 });
    await db.collection('geoevents').createIndex({ startDate: 1, endDate: 1 });

    await db.collection('geozones').createIndex({ center: '2dsphere' });
    await db.collection('geozones').createIndex({ boundary: '2dsphere' });
    await db.collection('geozones').createIndex({ city: 1, zoneType: 1 });

    await db.collection('geoedges').createIndex({ source: 1, relationship: 1 });
    await db.collection('geoedges').createIndex({ target: 1, relationship: 1 });

    logger.info('Geo indexes created');
  } catch (error) {
    logger.warn('Index creation failed (may already exist)', { error });
  }
}

// Event Bus Subscriber
let eventBusSubscriber: RedisType | null = null;

async function initEventBusSubscriber(): Promise<void> {
  try {
    eventBusSubscriber = new Redis(REDIS_URL);

    // Subscribe to Geo-related channels
    for (const eventType of GEOSUBSCRIBED_EVENTS) {
      await eventBusSubscriber.subscribe(`events.${eventType}`);
    }

    // Handle messages
    eventBusSubscriber.on('message', async (channel: string, message: string) => {
      try {
        const eventType = channel.replace('events.', '');
        const payload = JSON.parse(message);
        await eventBusIntegration.handleEvent(eventType, payload);
      } catch (error) {
        logger.error('Failed to process event bus message', { channel, error });
      }
    });

    logger.info('Event Bus subscriber initialized', { channels: GEOSUBSCRIBED_EVENTS });
  } catch (error) {
    logger.warn('Event Bus subscription failed (non-critical)', { error });
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('SIGTERM received, shutting down');

  try {
    if (eventBusSubscriber) {
      await eventBusSubscriber.quit();
    }
    await mongoose.connection.close();
  } catch (error) {
    logger.error('Shutdown error', { error });
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function start(): Promise<void> {
  try {
    await connectDatabase();
    await initEventBusSubscriber();

    app.listen(PORT, () => {
      logger.info(`REZ Geo Intelligence Core started on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API base: http://localhost:${PORT}/api`);
      logger.info(`Subscribed to Event Bus channels: ${GEOSUBSCRIBED_EVENTS.join(', ')}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

start();

export { app };
