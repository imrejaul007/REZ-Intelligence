/**
 * REZ Event Bus Service
 * Shared Event Bus for REZ Agent OS v3
 *
 * Port: 4082
 */

import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { config } from './config';
import { logger, httpLogger } from './services/logger';
import { RedisPubSubService } from './services/redisPubSub';
import { KafkaProducerService } from './services/kafkaProducer';
import { initPublisherService, getPublisherService } from './services/publisher';
import { subscriberService } from './services/subscriber';
import { eventRoutes } from './routes/events.routes';
import { subscriptionRoutes } from './routes/subscriptions.routes';
import { AuthenticatedRequest } from './middleware/auth';

// Create Express app
const app = express();

// Services
let redisPubSubService: RedisPubSubService;
let kafkaProducerService: KafkaProducerService;

// Health check data
interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  services: {
    redis: boolean;
    kafka: boolean;
  };
  version: string;
}

const startTime = Date.now();

/**
 * Setup middleware
 */
function setupMiddleware(): void {
  // Security headers
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

  // CORS
  app.use(cors({
    origin: config.server.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-Request-Id'],
  }));

  // Compression
  app.use(compression());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      httpLogger.info('Request completed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    });

    next();
  });

  // Add request ID
  app.use((req: Request, res: Response, next: NextFunction) => {
    const reqId = req.headers['x-request-id'] as string || `${crypto.randomUUID()}`;
    res.setHeader('X-Request-Id', reqId);
    (req as AuthenticatedRequest).requestId = reqId;
    next();
  });
}

/**
 * Setup routes
 */
function setupRoutes(): void {
  // Health check endpoints
  app.get('/health', async (req: Request, res: Response) => {
    try {
      const redisHealthy = await redisPubSubService.healthCheck();
      const kafkaHealthy = await kafkaProducerService.healthCheck();

      const status: HealthStatus = {
        status: redisHealthy && kafkaHealthy ? 'healthy' : redisHealthy ? 'degraded' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000),
        services: {
          redis: redisHealthy,
          kafka: kafkaHealthy,
        },
        version: '1.0.0',
      };

      res.status(status.status === 'healthy' ? 200 : 503).json(status);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      });
    }
  });

  app.get('/health/live', (req: Request, res: Response) => {
    res.json({ status: 'alive', timestamp: new Date().toISOString() });
  });

  app.get('/health/ready', async (req: Request, res: Response) => {
    try {
      const redisHealthy = await redisPubSubService.healthCheck();
      if (redisHealthy) {
        res.json({ status: 'ready', timestamp: new Date().toISOString() });
      } else {
        res.status(503).json({ status: 'not ready', timestamp: new Date().toISOString() });
      }
    } catch {
      res.status(503).json({ status: 'not ready', timestamp: new Date().toISOString() });
    }
  });

  // API routes
  app.use('/events', eventRoutes);
  app.use('/subscriptions', subscriptionRoutes);

  // Stats endpoint
  app.get('/stats', async (req: Request, res: Response) => {
    const publisher = getPublisherService();
    const subscriber = subscriberService;

    res.json({
      publisher: publisher.getStats(),
      subscriber: subscriber.getStats(),
      redis: redisPubSubService.getStatus(),
      kafka: kafkaProducerService.getStatus(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
    });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      code: 'ENDPOINT_NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
      timestamp: new Date().toISOString(),
    });
  });

  // Error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      requestId: (req as AuthenticatedRequest).requestId,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      message: config.server.nodeEnv === 'development' ? err.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Initialize services
 */
async function initializeServices(): Promise<void> {
  logger.info('Initializing services...');

  // Initialize Redis Pub/Sub
  redisPubSubService = new RedisPubSubService();
  await redisPubSubService.connect();
  logger.info('Redis Pub/Sub connected');

  // Initialize Kafka Producer
  kafkaProducerService = new KafkaProducerService();
  await kafkaProducerService.connect();
  logger.info('Kafka producer connected');

  // Ensure Kafka topic exists
  await kafkaProducerService.ensureTopic(config.kafka.topic);
  logger.info('Kafka topic ensured', { topic: config.kafka.topic });

  // Initialize Publisher Service
  initPublisherService(redisPubSubService, kafkaProducerService);
  logger.info('Publisher service initialized');

  // Initialize Subscriber Service
  await subscriberService.initialize();
  logger.info('Subscriber service initialized');

  // Store services on app for route access
  app.set('redisPubSub', redisPubSubService);
  app.set('kafkaProducer', kafkaProducerService);
  app.set('publisher', getPublisherService());
  app.set('subscriber', subscriberService);
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  logger.info('Shutting down...');

  try {
    await subscriberService.shutdown();
    await kafkaProducerService.disconnect();
    await redisPubSubService.disconnect();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Shutdown error', { error });
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});

/**
 * Start server
 */
async function start(): Promise<void> {
  try {
    logger.info('Starting REZ Event Bus Service...', {
      port: config.server.port,
      nodeEnv: config.server.nodeEnv,
    });

    setupMiddleware();
    await initializeServices();
    setupRoutes();

    app.listen(config.server.port, () => {
      logger.info(`REZ Event Bus Service started`, {
        port: config.server.port,
        nodeEnv: config.server.nodeEnv,
        healthCheck: `http://localhost:${config.server.port}/health`,
        apiDocs: `http://localhost:${config.server.port}/events/types`,
      });

      logger.info(`
╔══════════════════════════════════════════════════════════╗
║        REZ Event Bus Service - Started Successfully      ║
╠══════════════════════════════════════════════════════════╣
║  Port:     ${config.server.port.toString().padEnd(43)}║
║  Health:   http://localhost:${config.server.port}/health              ║
║  API:      http://localhost:${config.server.port}/events              ║
║  Version:  1.0.0                                       ║
╚══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Export for testing
export { app };

// Start the server
start();
