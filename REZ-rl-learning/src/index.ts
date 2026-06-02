/**
 * REZ RL Learning Service - Main Entry Point
 * Reinforcement Learning for self-improving recommendations
 * Port: 4136
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import { createRlRoutes } from './routes/rlRoutes.js';
import { getBanditModel } from './models/banditModel.js';
import { getRewardTracker } from './services/rewardTracker.js';
import { getPolicyManager } from './services/policyManager.js';
import { getBanditEngine } from './services/banditEngine.js';
import { getExplorationEngine } from './services/explorationEngine.js';
import { getModelUpdater } from './services/modelUpdater.js';
import { ServiceConfig } from './types/index.js';

// Configuration
const config: ServiceConfig = {
  port: parseInt(process.env.PORT || '4136', 10),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  logLevel: process.env.LOG_LEVEL || 'info',
  enableMetrics: process.env.ENABLE_METRICS !== 'false',
  cacheTtl: parseInt(process.env.CACHE_TTL || '86400', 10),
  maxRewardsPerArm: parseInt(process.env.MAX_REWARDS_PER_ARM || '1000', 10),
};

// Logger setup
const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(JSON.stringify({
      level: 'info',
      service: 'REZ-rl-learning',
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    }));
  },
  error: (message: string, error?: Error, meta?: Record<string, unknown>) => {
    console.error(JSON.stringify({
      level: 'error',
      service: 'REZ-rl-learning',
      message,
      timestamp: new Date().toISOString(),
      error: error?.message,
      stack: error?.stack,
      ...meta,
    }));
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(JSON.stringify({
      level: 'warn',
      service: 'REZ-rl-learning',
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    }));
  },
};

// Redis client for health checks
let redisClient: Redis;

// Initialize Express app
const app: Express = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:4000'],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token'],
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT || '100', 10), // 100 requests per minute
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    timestamp: Date.now(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Health check endpoint (no rate limiting)
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const redisHealthy = await redisClient.ping() === 'PONG';

    res.json({
      status: redisHealthy ? 'healthy' : 'degraded',
      service: 'REZ-rl-learning',
      version: '1.0.0',
      port: config.port,
      redis: redisHealthy ? 'connected' : 'disconnected',
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'REZ-rl-learning',
      error: 'Redis connection failed',
      timestamp: Date.now(),
    });
  }
});

// Readiness check
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    const banditModel = getBanditModel();
    const ready = await banditModel.ping();

    if (ready) {
      res.json({ ready: true, timestamp: Date.now() });
    } else {
      res.status(503).json({ ready: false, error: 'Not ready', timestamp: Date.now() });
    }
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    });
  }
});

// Mount API routes
app.use('/api', createRlRoutes());

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    timestamp: Date.now(),
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', err, {
    path: _req.path,
  });

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    timestamp: Date.now(),
  });
});

// Initialize services
async function initializeServices(): Promise<void> {
  logger.info('Initializing RL Learning Service', { config });

  try {
    // Initialize Redis connection
    redisClient = new Redis(config.redisUrl, {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected', { url: config.redisUrl });
    });

    // Verify Redis connection
    const pingResult = await redisClient.ping();
    if (pingResult !== 'PONG') {
      throw new Error('Redis ping failed');
    }

    // Initialize singleton services
    getBanditModel(redisClient);
    getRewardTracker(redisClient);
    getPolicyManager();
    getBanditEngine();
    getExplorationEngine(redisClient);
    getModelUpdater(redisClient);

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services', error as Error);
    throw error;
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down RL Learning Service...');

  try {
    // Close Redis connections
    await redisClient.quit();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Error during shutdown', error as Error);
  }

  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function start(): Promise<void> {
  try {
    await initializeServices();

    app.listen(config.port, () => {
      logger.info(`REZ RL Learning Service started`, {
        port: config.port,
        environment: process.env.NODE_ENV || 'development',
        redisUrl: config.redisUrl,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Export for testing
export { app, config, initializeServices };

// Start if run directly
start();
