import express, { Express } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

import logger from './utils/logger';
import predictRoutes from './routes/predict';
import healthRoutes from './routes/health';
import mlRoutes from './routes/ml';
import { authMiddleware, requestIdMiddleware, corsMiddleware } from './middleware/auth';
import { errorHandler, notFoundHandler, rateLimitMiddleware } from './middleware/errorHandler';

// Load environment variables
dotenv.config();

// Initialize Express app
const app: Express = express();

// Configuration
const PORT = parseInt(process.env.PORT || '4141', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-predictive-engine';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy for accurate IP detection
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(corsMiddleware);

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID
app.use(requestIdMiddleware);

// Rate limiting
const rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);
app.use(rateLimitMiddleware(rateLimitWindow, rateLimitMax));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel](`${req.method} ${req.path}`, {
      requestId: (req as any).requestId,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });

  next();
});

// Authentication (applied to API routes)
app.use('/predict', authMiddleware);

// Health routes (no auth required)
app.use('/health', healthRoutes);

// API routes
app.use('/predict', predictRoutes);
app.use('/ml', authMiddleware, mlRoutes);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    service: 'REZ Predictive Engine',
    version: process.env.npm_package_version || '1.0.0',
    description: 'AI predictions for churn, LTV, revisit, conversion, and ML-based predictions',
    endpoints: {
      health: {
        base: '/health',
        ready: '/health/ready',
        live: '/health/live',
        detailed: '/health/detailed'
      },
      predictions: {
        churn: 'GET /predict/:userId/churn',
        ltv: 'GET /predict/:userId/ltv',
        revisit: 'GET /predict/:userId/revisit',
        conversion: 'GET /predict/:userId/conversion',
        all: 'GET /predict/:userId/all',
        batch: 'POST /predict/batch',
        batchStatus: 'GET /predict/batch/:jobId',
        atRisk: 'GET /predict/segments/at-risk',
        highValue: 'GET /predict/segments/high-value',
        stats: 'GET /predict/stats'
      },
      ml: {
        base: '/ml',
        churn: 'GET /ml/:userId/churn',
        ltv: 'GET /ml/:userId/ltv',
        nextPurchase: 'GET /ml/:userId/next-purchase',
        propensity: 'GET /ml/:userId/propensity',
        propensityAction: 'GET /ml/:userId/propensity/:action',
        segment: 'GET /ml/:userId/segment',
        batchChurn: 'POST /ml/batch/churn',
        batchLtv: 'POST /ml/batch/ltv',
        batchPropensity: 'POST /ml/batch/propensity',
        segments: 'GET /ml/segments/:segment',
        models: 'GET /ml/models'
      }
    },
    documentation: '/docs',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Database connection
async function connectToDatabase(): Promise<void> {
  const retryInterval = 5000;
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      logger.info('Connecting to MongoDB...', { uri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@') });

      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 2
      });

      logger.info('Connected to MongoDB successfully');

      // Set up connection event handlers
      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error', err);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
      });

      return;
    } catch (error) {
      retries++;
      logger.error(`MongoDB connection attempt ${retries} failed`, error as Error);

      if (retries >= maxRetries) {
        logger.error('Max MongoDB connection retries reached');
        throw error;
      }

      logger.info(`Retrying MongoDB connection in ${retryInterval / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  // Close database connection
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error closing MongoDB connection', error as Error);
  }

  // Exit process
  process.exit(0);
}

// Start server
let server: ReturnType<Express['listen']> | undefined;

async function startServer(): Promise<void> {
  try {
    // Connect to database
    await connectToDatabase();

    // Start HTTP server
    server = app.listen(PORT, () => {
      logger.info(`REZ Predictive Engine started`, {
        port: PORT,
        environment: NODE_ENV,
        nodeVersion: process.version,
        pid: process.pid
      });

      logger.info(`Server running at http://localhost:${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API docs: http://localhost:${PORT}/`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', reason as Error, { promise });
    });

  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Start the application
startServer();

export default app;
