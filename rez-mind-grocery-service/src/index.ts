import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler, requestId, requestLogger } from './middleware/errorHandler';
import { globalLimiter, aiConsultationLimiter, readLimiter } from './middleware/rateLimit';
import { auth, internalAuth } from './middleware/auth';
import { rabtulPlatform } from './integrations/rabtul';

// Routes
import consultRoutes from './routes/consult.routes';
import expiryRoutes from './routes/expiry.routes';
import demandRoutes from './routes/demand.routes';
import supplierRoutes from './routes/supplier.routes';

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
    service: 'rez-mind-grocery-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/health/ready', async (req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'up' : 'down';
  const rabtulStatus = await rabtulPlatform.healthCheck().then(r => r.status);

  const isReady = mongoStatus === 'up';

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    service: 'rez-mind-grocery-service',
    timestamp: new Date().toISOString(),
    dependencies: {
      mongodb: mongoStatus,
      rabtulPlatform: rabtulStatus,
    },
  });
});

app.get('/health/detailed', async (req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'up' : 'down';
  const rabtulHealth = await rabtulPlatform.healthCheck();

  const memoryUsage = process.memoryUsage();

  res.status(200).json({
    status: 'healthy',
    service: 'rez-mind-grocery-service',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dependencies: {
      mongodb: {
        status: mongoStatus,
        readyState: mongoose.connection.readyState,
      },
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
app.use('/api/expiry', internalAuth, readLimiter, expiryRoutes);
app.use('/api/demand', internalAuth, readLimiter, demandRoutes);
app.use('/api/supplier', internalAuth, readLimiter, supplierRoutes);

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

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error closing MongoDB connection', { error });
  }

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
    await connectToDatabase();

    const { port } = config;
    server = app.listen(port, () => {
      logger.info(`ReZ Mind Grocery Service started successfully`, {
        port,
        env: config.nodeEnv,
        nodeVersion: process.version,
        pid: process.pid,
      });

      logger.info('Available endpoints:', {
        health: `GET http://localhost:${port}/health`,
        healthDetailed: `GET http://localhost:${port}/health/detailed`,
        healthReady: `GET http://localhost:${port}/health/ready`,
        consult: {
          post: `POST http://localhost:${port}/api/consult`,
          get: `GET http://localhost:${port}/api/consult/:sessionId`,
        },
        expiry: {
          predictions: `GET http://localhost:${port}/api/expiry/predictions/:merchantId`,
          product: `GET http://localhost:${port}/api/expiry/predictions/:merchantId/product/:productId`,
          simulate: `POST http://localhost:${port}/api/expiry/predictions/:merchantId/simulate`,
        },
        demand: {
          forecast: `GET http://localhost:${port}/api/demand/forecast/:merchantId`,
          product: `GET http://localhost:${port}/api/demand/forecast/:merchantId/product/:productId`,
          adjust: `POST http://localhost:${port}/api/demand/adjust`,
        },
        supplier: {
          optimize: `GET http://localhost:${port}/api/supplier/optimize/:merchantId`,
          performance: `GET http://localhost:${port}/api/supplier/performance/:merchantId`,
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

startServer();

export default app;