import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler, requestId, requestLogger } from './middleware/errorHandler';
import { globalLimiter, aiConsultationLimiter, readLimiter, pricingLimiter } from './middleware/rateLimit';
import { auth, internalAuth } from './middleware/auth';
import { rezIntelligence } from './integrations/rezIntelligence';
import { rabtulPlatform } from './integrations/rabtulPlatform';

// Routes
import consultRoutes from './routes/consult.routes';
import recommendationsRoutes from './routes/recommendations.routes';
import pricingRoutes from './routes/pricing.routes';
import inventoryRoutes from './routes/inventory.routes';

const app: Express = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-Request-Id'],
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request ID and logging
app.use(requestId);
app.use(requestLogger);

// Health check routes (no auth required)
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'rez-mind-retail-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/health/ready', async (req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'up' : 'down';
  const [rezHubStatus, rabtulStatus] = await Promise.all([
    rezIntelligence.healthCheck().then(r => r.status),
    rabtulPlatform.healthCheck().then(r => r.status),
  ]);

  const isReady = mongoStatus === 'up';

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    service: 'rez-mind-retail-service',
    timestamp: new Date().toISOString(),
    dependencies: {
      mongodb: mongoStatus,
      rezIntelligenceHub: rezHubStatus,
      rabtulPlatform: rabtulStatus,
    },
  });
});

app.get('/health/detailed', async (req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'up' : 'down';
  const [rezHubHealth, rabtulHealth] = await Promise.all([
    rezIntelligence.healthCheck(),
    rabtulPlatform.healthCheck(),
  ]);

  const memoryUsage = process.memoryUsage();

  res.status(200).json({
    status: 'healthy',
    service: 'rez-mind-retail-service',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dependencies: {
      mongodb: {
        status: mongoStatus,
        readyState: mongoose.connection.readyState,
      },
      rezIntelligenceHub: rezHubHealth,
      rabtulPlatform: rabtulHealth,
    },
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
    },
    environment: config.nodeEnv,
  });
});

// Global rate limiting
app.use(globalLimiter);

// API Routes with authentication and rate limiting
app.use('/api/consult', internalAuth, aiConsultationLimiter, consultRoutes);
app.use('/api/recommendations', internalAuth, readLimiter, recommendationsRoutes);
app.use('/api/pricing', internalAuth, pricingLimiter, pricingRoutes);
app.use('/api/inventory', internalAuth, readLimiter, inventoryRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Graceful shutdown handling
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  try {
    // Close MongoDB connection
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error closing MongoDB connection', { error });
  }

  // Give time for ongoing requests to complete
  logger.info('Waiting for ongoing requests to complete...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  logger.info('Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});

// Database connection
async function connectToDatabase(): Promise<void> {
  const { mongodbUri } = config;

  try {
    logger.info('Connecting to MongoDB...', { uri: mongodbUri.replace(/\/\/.*@/, '//<credentials>@') });

    await mongoose.connect(mongodbUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('MongoDB connected successfully');

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error', { error });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    throw error;
  }
}

// Start server
let server: ReturnType<Express['listen']> | undefined;

async function startServer(): Promise<void> {
  try {
    // Connect to database
    await connectToDatabase();

    // Start listening
    const { port } = config;
    server = app.listen(port, () => {
      logger.info(`ReZ Mind Retail Service started successfully`, {
        port,
        env: config.nodeEnv,
        nodeVersion: process.version,
        pid: process.pid,
      });

      logger.info('Available endpoints:', {
        health: `GET http://localhost:${port}/health`,
        healthDetailed: `GET http://localhost:${port}/health/detailed`,
        healthReady: `GET http://localhost:${port}/health/ready`,
        consult: `POST http://localhost:${port}/api/consult`,
        recommendations: {
          product: `GET http://localhost:${port}/api/recommendations/product/:productId`,
          bundle: `GET http://localhost:${port}/api/recommendations/bundle/:merchantId`,
          upsell: `GET http://localhost:${port}/api/recommendations/upsell/:merchantId`,
          personalized: `POST http://localhost:${port}/api/recommendations/personalized`,
        },
        pricing: {
          optimize: `POST http://localhost:${port}/api/pricing/optimize`,
          strategies: `GET/POST http://localhost:${port}/api/pricing/strategies/:merchantId`,
        },
        inventory: {
          forecast: `GET http://localhost:${port}/api/inventory/forecast/:merchantId`,
          reorder: `GET http://localhost:${port}/api/inventory/reorder/:merchantId`,
          trending: `GET http://localhost:${port}/api/inventory/trending/:merchantId`,
        },
      });
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${port} is already in use`);
        process.exit(1);
      }
      throw error;
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the application
startServer();

export default app;