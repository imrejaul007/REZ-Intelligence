import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import config, { validateConfig } from './config/index.js';
import logger from './utils/logger.js';
import inventoryRoutes from './routes/index.js';
import { createAuthMiddleware, createRateLimiter, errorHandler } from './middleware/index.js';

/**
 * Initialize Express application
 */
function createApp(): Express {
  const app = express();

  // Trust proxy for rate limiting behind reverse proxy
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  }));
  app.use(cors({
    origin: config.nodeEnv === 'production' ? false : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token'],
  }));

  // Compression
  app.use(compression());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging with timing
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const startTime = Date.now();
    _res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info(`${req.method} ${req.path}`, {
        statusCode: _res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    });
    next();
  });

  // Rate limiting
  app.use('/api', createRateLimiter({ windowMs: 60000, max: 100 }));

  // Auth middleware
  const apiKeys = (process.env.API_KEYS || '').split(',').filter(Boolean);
  const internalTokens = (process.env.INTERNAL_TOKENS || '').split(',').filter(Boolean);
  app.use('/api', createAuthMiddleware({
    apiKeys,
    internalTokens,
    bypassPaths: ['/api/health'],
  }));

  // Health check endpoints
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'healthy', service: 'rez-inventory-intelligence', timestamp: new Date().toISOString() });
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({ status: 'ready', mongodb: mongoStatus, timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api', inventoryRoutes);

  // Root endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      service: 'REZ Inventory Intelligence',
      version: '1.0.0',
      status: 'running',
      port: config.port,
      description: 'Inventory Intelligence Service with Demand Forecasting, Stock Optimization, and Reorder Management for REZ Ecosystem',
      documentation: `/api/v1`,
      health: `/health`,
    });
  });

  // Error handler
  app.use(errorHandler);

  return app;
}

/**
 * Connect to MongoDB with retry logic
 */
async function connectDatabase(maxRetries: number = 5): Promise<void> {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      logger.info('Connecting to MongoDB...', {
        uri: config.mongodb.uri.replace(/\/\/.*@/, '//<credentials>@'),
        attempt: retries + 1,
      });

      await mongoose.connect(config.mongodb.uri, {
        maxPoolSize: config.mongodb.options.maxPoolSize,
        serverSelectionTimeoutMS: config.mongodb.options.serverSelectionTimeoutMS,
        socketTimeoutMS: config.mongodb.options.socketTimeoutMS,
      });

      logger.info('Connected to MongoDB successfully');

      // Set up connection event handlers
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error', { error });
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
      logger.error(`Failed to connect to MongoDB (attempt ${retries}/${maxRetries})`, { error });

      if (retries >= maxRetries) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, retries), 30000);
      logger.info(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    }

    // Allow time for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 1000));

    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

/**
 * Start the server
 */
async function main(): Promise<void> {
  try {
    // Validate configuration
    validateConfig();

    // Connect to database
    await connectDatabase();

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(config.port, () => {
      logger.info('='.repeat(60));
      logger.info('REZ Inventory Intelligence Service');
      logger.info('='.repeat(60));
      logger.info(`Port: ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`MongoDB: ${config.mongodb.uri.replace(/\/\/.*@/, '//<credentials>@')}`);
      logger.info('-'.repeat(60));
      logger.info('Endpoints:');
      logger.info(`  Health:     http://localhost:${config.port}/api/health`);
      logger.info(`  API Base:   http://localhost:${config.port}/api/v1`);
      logger.info(`  Forecast:   http://localhost:${config.port}/api/v1/forecast/:sku`);
      logger.info(`  Reorder:    http://localhost:${config.port}/api/v1/reorder/:sku`);
      logger.info(`  Optimize:   http://localhost:${config.port}/api/v1/optimize/:sku`);
      logger.info(`  ABC:        http://localhost:${config.port}/api/v1/abc-analysis`);
      logger.info('='.repeat(60));
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.port} is already in use`);
        process.exit(1);
      }
      throw error;
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Unhandled rejection handler
    process.on('unhandledRejection', (reason, _promise) => {
      logger.error('Unhandled Rejection', { reason });
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the application
main();

export { createApp, connectDatabase };
