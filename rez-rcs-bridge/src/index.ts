import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import { config } from './config';
import { logger } from './utils/logger.js';
import { createAuthMiddleware, createRateLimiter, errorHandler, notFoundHandler } from './middleware/index.js';
import rcsRoutes from './routes/rcs.routes';

// Initialize Express app
const app = express();

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
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,https://rez.money').split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-internal-token'],
}));

// Rate limiting
app.use('/api', createRateLimiter({ windowMs: 60 * 1000, max: 100 }));

// Body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Auth middleware
app.use(createAuthMiddleware({
  apiKeys: [],
  internalTokens: Object.values(config.auth.serviceTokens),
  bypassPaths: ['/health', '/ready', '/webhook'],
}));

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

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

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

  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }

  await mongoose.connection.close();
  logger.info('MongoDB connection closed');

  process.exit(0);
}

// Start server
async function startServer(): Promise<void> {
  try {
    await connectToMongoDB();
    await getRedisClient();
    logger.info('Connected to Redis', { url: config.redis.url });

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

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

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
