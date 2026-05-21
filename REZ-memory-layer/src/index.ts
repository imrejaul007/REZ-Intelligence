/**
 * REZ Memory Layer - Main Entry Point
 * Unified Customer Timeline Service
 */

import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

// Import configurations
import { logger, createContextLogger } from './config/logger';
import { connectMongoDB, checkMongoHealth, disconnectMongoDB } from './config/database';
import { connectRedis, disconnectRedis, checkRedisHealth } from './config/redis';

// Import routes
import timelineRoutes from './routes/timeline.routes';
import eventRoutes from './routes/event.routes';

// Import middleware
import { authMiddleware, requestLogger, errorHandler } from './middleware/auth';

// Import services
import { eventConsumer } from './services/eventConsumer';
import { cacheService } from './services/cacheService';

// Types
import { HealthStatus } from './types/timeline';

// Initialize app
const app: Express = express();
const PORT = parseInt(process.env.PORT || '4201', 10);
const SERVICE_NAME = 'REZ-memory-layer';

// Context logger
const contextLogger = createContextLogger('Main');

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Rate limit store (in-memory, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
app.locals.rateLimitStore = rateLimitStore;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:']
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-API-Key', 'X-Request-ID']
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use service token or IP as key
    const token = req.headers['x-internal-token'] as string;
    return token || req.ip || 'unknown';
  }
});

app.use(limiter);

// Health endpoints (before auth)
app.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now();

  const [mongoHealth, redisHealth] = await Promise.all([
    checkMongoHealth(),
    checkRedisHealth()
  ]);

  const eventBusHealth = {
    status: eventConsumer.isHealthy() ? 'up' : 'unknown' as const,
    subscriptions: eventConsumer.isHealthy() ? eventConsumer.getStatus().subscriptions : 0
  };

  const overallStatus: HealthStatus['status'] =
    mongoHealth.status === 'up' && redisHealth.status === 'up'
      ? 'healthy'
      : mongoHealth.status === 'down' || redisHealth.status === 'down'
        ? 'unhealthy'
        : 'degraded';

  const health: HealthStatus = {
    status: overallStatus,
    timestamp: new Date(),
    services: {
      mongodb: mongoHealth,
      redis: redisHealth,
      eventBus: eventBusHealth
    },
    uptime: process.uptime(),
    version: '1.0.0'
  };

  const latency = Date.now() - startTime;
  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  res.status(statusCode).json(health);
});

// Liveness probe
app.get('/live', (req: Request, res: Response) => {
  res.json({ status: 'alive', timestamp: new Date() });
});

// Readiness probe
app.get('/ready', async (req: Request, res: Response) => {
  const mongoHealth = await checkMongoHealth();
  const redisHealth = await checkRedisHealth();

  if (mongoHealth.status === 'up' && redisHealth.status === 'up') {
    res.json({ status: 'ready', timestamp: new Date() });
  } else {
    res.status(503).json({
      status: 'not ready',
      mongodb: mongoHealth.status,
      redis: redisHealth.status
    });
  }
});

// Authenticated routes
app.use('/api/timeline', authMiddleware, timelineRoutes);
app.use('/api/events', authMiddleware, eventRoutes);

// Metrics endpoint (for Prometheus)
app.get('/metrics', authMiddleware, async (req: Request, res: Response) => {
  try {
    const mongoHealth = await checkMongoHealth();

    // Basic metrics
    const metrics = {
      uptime_seconds: process.uptime(),
      memory_usage_bytes: process.memoryUsage(),
      cpu_usage: process.cpuUsage(),
      mongodb_status: mongoHealth.status,
      mongodb_latency_ms: mongoHealth.latency || 0,
      event_consumer_connected: eventConsumer.isHealthy(),
      event_consumer_subscriptions: eventConsumer.getStatus().subscriptions,
      event_consumer_batch_size: eventConsumer.getStatus().batchBufferSize
    };

    // Prometheus format
    const prometheusMetrics = `
# HELP rez_memory_layer_uptime_seconds Time since service start
# TYPE rez_memory_layer_uptime_seconds gauge
rez_memory_layer_uptime_seconds ${metrics.uptime_seconds}

# HELP rez_memory_heap_used_bytes Memory heap used
# TYPE rez_memory_heap_used_bytes gauge
rez_memory_heap_used_bytes ${metrics.memory_usage_bytes.heapUsed}

# HELP rez_memory_heap_total_bytes Total memory heap
# TYPE rez_memory_heap_total_bytes gauge
rez_memory_heap_total_bytes ${metrics.memory_usage_bytes.heapTotal}

# HELP rez_mongodb_status MongoDB connection status (1=up, 0=down)
# TYPE rez_mongodb_status gauge
rez_mongodb_status ${mongoHealth.status === 'up' ? 1 : 0}

# HELP rez_mongodb_latency_ms MongoDB response latency
# TYPE rez_mongodb_latency_ms gauge
rez_mongodb_latency_ms ${metrics.mongodb_latency_ms}

# HELP rez_event_consumer_connected Event consumer connection status
# TYPE rez_event_consumer_connected gauge
rez_event_consumer_connected ${metrics.event_consumer_connected ? 1 : 0}

# HELP rez_event_consumer_subscriptions Number of event subscriptions
# TYPE rez_event_consumer_subscriptions gauge
rez_event_consumer_subscriptions ${metrics.event_consumer_subscriptions}

# HELP rez_event_consumer_batch_size Current batch buffer size
# TYPE rez_event_consumer_batch_size gauge
rez_event_consumer_batch_size ${metrics.event_consumer_batch_size}
`.trim();

    res.set('Content-Type', 'text/plain');
    res.send(prometheusMetrics);
  } catch (error) {
    contextLogger.error('Failed to generate metrics:', error);
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  contextLogger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new requests
  server.close(() => {
    contextLogger.info('HTTP server closed');
  });

  try {
    // Stop event consumer
    await eventConsumer.stop();
    contextLogger.info('Event consumer stopped');

    // Clear cache
    await cacheService.clearAllCache();
    contextLogger.info('Cache cleared');

    // Disconnect from databases
    await disconnectRedis();
    await disconnectMongoDB();

    contextLogger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    contextLogger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Start server
let server: ReturnType<Express['listen']>;

async function start(): Promise<void> {
  try {
    contextLogger.info('Starting REZ Memory Layer service...');

    // Connect to MongoDB
    await connectMongoDB();

    // Connect to Redis
    await connectRedis();

    // Create indexes
    await createIndexes();

    // Start event consumer
    try {
      await eventConsumer.start();
    } catch (error) {
      contextLogger.warn('Event consumer failed to start, continuing without it:', error);
      // Continue without event bus - service can still receive events via API
    }

    // Start HTTP server
    server = app.listen(PORT, () => {
      contextLogger.info(`REZ Memory Layer started`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
      });
    });

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      contextLogger.error('Uncaught exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      contextLogger.error('Unhandled rejection:', { reason, promise });
    });

  } catch (error) {
    contextLogger.error('Failed to start service:', error);
    process.exit(1);
  }
}

/**
 * Create MongoDB indexes
 */
async function createIndexes(): Promise<void> {
  try {
    contextLogger.info('Creating indexes...');

    // Indexes are created by Mongoose models on startup
    // This is just for explicit index creation if needed

    await mongoose.connection.db?.collection('timeline_events').createIndex(
      { userId: 1, timestamp: -1 },
      { background: true }
    );

    await mongoose.connection.db?.collection('timeline_events').createIndex(
      { userId: 1, category: 1, timestamp: -1 },
      { background: true }
    );

    await mongoose.connection.db?.collection('user_profiles').createIndex(
      { userId: 1 },
      { unique: true, background: true }
    );

    await mongoose.connection.db?.collection('user_profiles').createIndex(
      { lastEventTimestamp: -1 },
      { background: true }
    );

    contextLogger.info('Indexes created successfully');
  } catch (error) {
    contextLogger.warn('Index creation failed (may already exist):', error);
  }
}

// Start the service
start();

export { app };
