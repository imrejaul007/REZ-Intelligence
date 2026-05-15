/**
 * REZ Location Intelligence Service
 * Main entry point
 */

import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import mongoose from 'mongoose';
import logger from './utils/logger.js';
import { locationRoutes, segmentRoutes, analyticsRoutes } from './routes/index.js';
import { optionalAuthMiddleware, errorHandler, notFoundHandler } from './middleware/index.js';

// Configuration
const PORT = parseInt(process.env.PORT || '4040');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-location-intelligence';
const SERVICE_NAME = process.env.SERVICE_NAME || 'rez-location-intelligence';

// Create Express app
const app: Express = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, _res: Response, next) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query
  });
  next();
});

// Health check (no auth required)
app.get('/health', optionalAuthMiddleware, (_req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.json({
    status: 'healthy',
    service: SERVICE_NAME,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    mongodb: mongoStatus
  });
});

// Readiness check
app.get('/ready', optionalAuthMiddleware, (_req: Request, res: Response) => {
  const isReady = mongoose.connection.readyState === 1;

  if (isReady) {
    res.json({
      status: 'ready',
      service: SERVICE_NAME
    });
  } else {
    res.status(503).json({
      status: 'not ready',
      service: SERVICE_NAME,
      reason: 'Database connection not established'
    });
  }
});

// API routes
app.use('/api/location', locationRoutes);
app.use('/api/location', segmentRoutes);
app.use('/api/location', analyticsRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Database connection
async function connectToDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB', { uri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@') });

    // Create indexes
    await createIndexes();
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    throw error;
  }
}

// Create database indexes
async function createIndexes(): Promise<void> {
  try {
    const { LocationVisitModel, UserLocationProfileModel, LocationZoneModel } = await import('./models/index.js');

    // LocationVisit indexes
    await LocationVisitModel.collection.createIndex({ userId: 1, timestamp: -1 });
    await LocationVisitModel.collection.createIndex({ locationId: 1, timestamp: -1 });
    await LocationVisitModel.collection.createIndex({ zone: 1, timestamp: -1 });
    await LocationVisitModel.collection.createIndex({ timestamp: 1 }, { expireAfterSeconds: 63072000 }); // 2 years TTL

    // UserLocationProfile indexes
    await UserLocationProfileModel.collection.createIndex({ segments: 1 });
    await UserLocationProfileModel.collection.createIndex({ totalVisits: -1 });
    await UserLocationProfileModel.collection.createIndex({ lastVisit: -1 });

    // LocationZone indexes
    await LocationZoneModel.collection.createIndex({ 'attributes.premium': 1 });
    await LocationZoneModel.collection.createIndex({ type: 1, 'attributes.premium': 1 });

    logger.info('Database indexes created');
  } catch (error) {
    logger.warn('Index creation warning', { error });
  }
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully`);

  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
async function startServer(): Promise<void> {
  try {
    await connectToDatabase();

    app.listen(PORT, () => {
      logger.info(`REZ Location Intelligence Service started`, {
        port: PORT,
        service: SERVICE_NAME,
        environment: process.env.NODE_ENV || 'development'
      });
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API base: http://localhost:${PORT}/api/location`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();

export { app };
