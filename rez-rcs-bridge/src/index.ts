import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import { config } from './config';
import { logger } from './utils/logger';
import rcsRoutes from './routes/rcs.routes';

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-rcs-bridge',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Readiness check endpoint (checks DB and Redis)
app.get('/ready', async (_req: Request, res: Response) => {
  const checks = {
    mongodb: false,
    redis: false,
  };

  try {
    checks.mongodb = mongoose.connection.readyState === 1;
  } catch {
    checks.mongodb = false;
  }

  try {
    const redisClient = await getRedisClient();
    await redisClient.ping();
    checks.redis = true;
  } catch {
    checks.redis = false;
  }

  const allHealthy = Object.values(checks).every(Boolean);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});

// Mount RCS routes
app.use('/api/rcs', rcsRoutes);
app.use('/webhook', rcsRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.server.nodeEnv === 'production'
        ? 'Internal server error'
        : err.message,
    },
  });
});

// Redis client singleton
let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedisClient(): Promise<ReturnType<typeof createClient>> {
  if (!redisClient) {
    redisClient = createClient({ url: config.redis.url });
    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
    });
    await redisClient.connect();
  }
  return redisClient;
}

// Database connection
async function connectToMongoDB(): Promise<void> {
  try {
    await mongoose.connect(config.mongodb.uri);
    logger.info('Connected to MongoDB', {
      uri: config.mongodb.uri.replace(/\/\/.*@/, '//<credentials>@'),
    });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  // Close HTTP server
  // server.close(() => { ... });

  // Close Redis connection
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }

  // Close MongoDB connection
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');

  process.exit(0);
}

// Start server
async function startServer(): Promise<void> {
  try {
    // Connect to MongoDB
    await connectToMongoDB();

    // Initialize Redis
    await getRedisClient();
    logger.info('Connected to Redis', { url: config.redis.url });

    // Start HTTP server
    app.listen(config.server.port, () => {
      logger.info('REZ RCS Bridge started', {
        port: config.server.port,
        nodeEnv: config.server.nodeEnv,
        carriers: {
          jio: config.jio.enabled,
          airtel: config.airtel.enabled,
        },
      });
    });

    // Handle graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
      });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Export for testing
export { app };

// Start if running directly
if (require.main === module) {
  startServer();
}
