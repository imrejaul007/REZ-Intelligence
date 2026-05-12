import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

import { Registry, RegistryConfig } from './services/registry';
import { HealthMonitor, HealthMonitorConfig } from './services/healthMonitor';
import { createRegistryRoutes } from './routes/registry.routes';
import { logger } from './services/logger';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Environment validation
const REQUIRED_ENV = ['REDIS_URL'];

for (const envVar of REQUIRED_ENV) {
  if (!process.env[envVar]) {
    logger.error(`FATAL: ${envVar} is required`);
    process.exit(1);
  }
}

// Configuration
const CONFIG = {
  port: parseInt(process.env.PORT || '4011', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  redis: {
    url: process.env.REDIS_URL!,
  },

  registry: {
    heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL_MS || '30000', 10),
    heartbeatTtlSeconds: parseInt(process.env.HEARTBEAT_TTL_SECONDS || '300', 10),
    staleThresholdMs: parseInt(process.env.STALE_THRESHOLD_MS || '120000', 10),
  },

  healthMonitor: {
    healthCheckIntervalSeconds: parseInt(process.env.HEALTH_CHECK_INTERVAL_SECONDS || '60', 10),
    timeoutMs: parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || '5000', 10),
    maxConsecutiveFailures: parseInt(process.env.MAX_CONSECUTIVE_FAILURES || '3', 10),
    enableCronSchedule: process.env.ENABLE_CRON_SCHEDULE === 'true',
    cronSchedule: process.env.CRON_SCHEDULE || '*/5 * * * *',
  },

  cors: {
    origins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
};

// Initialize Express app
const app: Express = express();

// Initialize services
let redis: Redis;
let registry: Registry;
let healthMonitor: HealthMonitor;

/**
 * Initialize all services
 */
async function initializeServices(): Promise<void> {
  logger.info('Initializing services...');

  // Initialize Redis
  redis = new Redis(CONFIG.redis.url, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
  });

  redis.on('error', (err) => {
    logger.error('Redis connection error', { error: err.message });
  });

  redis.on('connect', () => {
    logger.info('Redis connected', { url: CONFIG.redis.url });
  });

  // Initialize Registry
  const registryConfig: RegistryConfig = {
    redis,
    heartbeatIntervalMs: CONFIG.registry.heartbeatIntervalMs,
    heartbeatTtlSeconds: CONFIG.registry.heartbeatTtlSeconds,
    staleThresholdMs: CONFIG.registry.staleThresholdMs,
  };

  registry = new Registry(registryConfig);

  // Initialize Health Monitor
  const healthMonitorConfig: HealthMonitorConfig = {
    registry,
    healthCheckIntervalSeconds: CONFIG.healthMonitor.healthCheckIntervalSeconds,
    timeoutMs: CONFIG.healthMonitor.timeoutMs,
    maxConsecutiveFailures: CONFIG.healthMonitor.maxConsecutiveFailures,
    enableCronSchedule: CONFIG.healthMonitor.enableCronSchedule,
    cronSchedule: CONFIG.healthMonitor.cronSchedule,
  };

  healthMonitor = new HealthMonitor(healthMonitorConfig);

  logger.info('Services initialized successfully');
}

/**
 * Configure middleware
 */
function configureMiddleware(): void {
  // Security headers
  app.use(helmet());

  // CORS
  app.use(cors({
    origin: CONFIG.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-Request-Id', 'X-API-Key'],
  }));

  // Compression
  app.use(compression());

  // Request logging
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Trust proxy for correct IP detection
  app.set('trust proxy', 1);

  // Request ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
    res.setHeader('x-request-id', req.requestId);
    next();
  });
}

/**
 * Configure routes
 */
function configureRoutes(): void {
  // Health check (no auth required)
  app.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await registry.healthCheck();
      const overallHealth = await healthMonitor.getOverallHealth();

      res.json({
        status: health.healthy ? 'healthy' : 'degraded',
        service: 'rez-agent-registry',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        registry: health.details,
        health: overallHealth,
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        service: 'rez-agent-registry',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Readiness check
  app.get('/ready', async (req: Request, res: Response) => {
    try {
      await redis.ping();
      res.json({ ready: true });
    } catch (error) {
      res.status(503).json({ ready: false, reason: 'Redis not connected' });
    }
  });

  // Registry routes
  app.use('/registry', createRegistryRoutes({
    registry,
    healthMonitor,
  }));

  // Error handling
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
      },
    });
  });

  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      requestId: req.requestId,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId: req.requestId,
      },
    });
  });
}

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    await initializeServices();
    configureMiddleware();
    configureRoutes();

    const server = app.listen(CONFIG.port, () => {
      logger.info(`REZ Agent Registry started`, {
        port: CONFIG.port,
        nodeEnv: CONFIG.nodeEnv,
        redisUrl: CONFIG.redis.url,
      });
    });

    // Start health monitor
    healthMonitor.start();

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      // Stop health monitor
      healthMonitor.stop();

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await registry.shutdown();
          await redis.quit();

          logger.info('All services shut down successfully');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', {
            error: error instanceof Error ? error.message : 'Unknown',
          });
          process.exit(1);
        }
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    process.exit(1);
  }
}

// Export for testing
export { app, initializeServices };

// Start the server
startServer();
