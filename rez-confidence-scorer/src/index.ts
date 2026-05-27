import express, { Express } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import config from './config';
import { redisClient } from './utils/redis';
import logger from './utils/logger.js';
import { requestLogger, performanceMonitor } from './middleware/requestLogger';
import { internalAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

import scoringRoutes from './routes/scoring.routes';
import agentsRoutes from './routes/agents.routes';

import { HealthCheckResponse } from './types';

/**
 * REZ Confidence Scorer Service
 *
 * Main entry point for the Express server.
 * Runs on port 4081 by default.
 */

const app: Express = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API-only service
}));

// CORS configuration
app.use(cors({
  origin: config.app.corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-Request-ID'],
  credentials: true,
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
    timestamp: new Date(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Request logging and performance monitoring
app.use(requestLogger);
app.use(performanceMonitor);

// Health check endpoint (no auth required)
app.get('/health', async (_req, res) => {
  const mongodbStatus =
    mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const redisStatus = (await redisClient.ping()) ? 'connected' : 'disconnected';

  const isHealthy =
    mongodbStatus === 'connected' && redisStatus === 'connected';

  const response: HealthCheckResponse = {
    status: isHealthy ? 'healthy' : 'degraded',
    version: '1.0.0',
    uptime: process.uptime(),
    dependencies: {
      mongodb: mongodbStatus,
      redis: redisStatus,
    },
  };

  res.status(isHealthy ? 200 : 503).json(response);
});

// Readiness check
app.get('/ready', async (_req, res) => {
  const mongodbStatus =
    mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const redisStatus = (await redisClient.ping()) ? 'connected' : 'disconnected';

  if (mongodbStatus === 'connected' && redisStatus === 'connected') {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({
      ready: false,
      mongodb: mongodbStatus,
      redis: redisStatus,
    });
  }
});

// API routes with internal auth
app.use(`${config.app.apiPrefix}/scoring`, internalAuth, scoringRoutes);
app.use(`${config.app.apiPrefix}/agents`, internalAuth, agentsRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

/**
 * Connect to MongoDB
 */
async function connectMongoDB(): Promise<void> {
  try {
    await mongoose.connect(config.mongodb.uri, {
      maxPoolSize: config.mongodb.options.maxPoolSize,
      minPoolSize: config.mongodb.options.minPoolSize,
      maxIdleTimeMS: config.mongodb.options.maxIdleTimeMS,
      retryWrites: config.mongodb.options.retryWrites,
      retryReads: config.mongodb.options.retryReads,
    });

    logger.info('MongoDB connected', {
      database: config.mongodb.database,
    });

    // Connection event handlers
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error', { error: error.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Connect to Redis
 */
async function connectRedis(): Promise<void> {
  try {
    await redisClient.connect();
    logger.info('Redis connected');
  } catch (error) {
    logger.error('Failed to connect to Redis', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    // Close database connections
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    } catch (error) {
      logger.error('Error closing MongoDB', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    try {
      await redisClient.disconnect();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    logger.info('Graceful shutdown completed');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Server instance
let server: ReturnType<typeof app.listen>;

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    // Connect to databases
    await Promise.all([connectMongoDB(), connectRedis()]);

    // Start HTTP server
    server = app.listen(config.app.port, () => {
      logger.info(`REZ Confidence Scorer started`, {
        port: config.app.port,
        env: config.app.env,
        apiPrefix: config.app.apiPrefix,
      });
      logger.info(`Health check: http://localhost:${config.app.port}/health`);
      logger.info(`API endpoints: http://localhost:${config.app.port}${config.app.apiPrefix}`);
    });

    // Error handling for server
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.app.port} is already in use`);
        process.exit(1);
      }
      throw error;
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Unhandled rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', {
        reason: reason instanceof Error ? reason.message : reason,
        promise: String(promise),
      });
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Start the server
startServer();

// Export app for testing
export { app };
