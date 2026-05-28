import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

import { MessageBridge, MessageBridgeConfig } from './services/messageBridge';
import { ResponseBridge, ResponseBridgeConfig } from './services/responseBridge';
import { createWebhookRoutes } from './routes/webhook.routes';
import { logger } from './services/logger';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Environment validation
const REQUIRED_ENV = [
  'REDIS_URL',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
];

for (const envVar of REQUIRED_ENV) {
  if (!process.env[envVar]) {
    logger.error(`FATAL: ${envVar} is required`);
    process.exit(1);
  }
}

// Configuration
const CONFIG = {
  port: parseInt(process.env.PORT || '4010', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  redis: {
    url: process.env.REDIS_URL!,
  },

  orchestrator: {
    url: process.env.ORCHESTRATOR_URL || 'http://localhost:4015',
    internalToken: process.env.INTERNAL_SERVICE_TOKEN || '',
  },

  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
    verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN!,
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
  },

  bridge: {
    sessionTtlSeconds: parseInt(process.env.SESSION_TTL_SECONDS || '86400', 10), // 24 hours
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000', 10),
  },

  responseBridge: {
    processingIntervalMs: parseInt(process.env.PROCESSING_INTERVAL_MS || '500', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '5000', 10),
    maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE || '1000', 10),
  },

  cors: {
    origins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
};

// Initialize Express app
const app: Express = express();

// Initialize Redis
let redis: Redis;
let messageBridge: MessageBridge;
let responseBridge: ResponseBridge;

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

  // Initialize Message Bridge
  const messageBridgeConfig: MessageBridgeConfig = {
    redis,
    orchestratorUrl: CONFIG.orchestrator.url,
    internalServiceToken: CONFIG.orchestrator.internalToken,
    whatsappApiUrl: CONFIG.whatsapp.apiUrl,
    whatsappAccessToken: CONFIG.whatsapp.accessToken,
    phoneNumberId: CONFIG.whatsapp.phoneNumberId,
    verifyToken: CONFIG.whatsapp.verifyToken,
    sessionTtlSeconds: CONFIG.bridge.sessionTtlSeconds,
    maxRetries: CONFIG.bridge.maxRetries,
    retryDelayMs: CONFIG.bridge.retryDelayMs,
  };

  messageBridge = new MessageBridge(messageBridgeConfig);
  await messageBridge.start();

  // Initialize Response Bridge
  const responseBridgeConfig: ResponseBridgeConfig = {
    messageBridge,
    maxRetries: CONFIG.responseBridge.maxRetries,
    retryDelayMs: CONFIG.responseBridge.retryDelayMs,
    processingIntervalMs: CONFIG.responseBridge.processingIntervalMs,
    maxQueueSize: CONFIG.responseBridge.maxQueueSize,
  };

  responseBridge = new ResponseBridge(responseBridgeConfig);
  responseBridge.start();

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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-Request-Id', 'X-API-Key'],
  }));

  // Compression
  app.use(compression());

  // Request logging
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Trust proxy for correct IP detection
  app.set('trust proxy', 1);

  // Request ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    (req as Request & { requestId: string }).requestId = requestId;
    res.setHeader('x-request-id', requestId);
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
      const bridgeHealth = await messageBridge.healthCheck();
      const queueStatus = responseBridge.getQueueStatus();

      res.json({
        status: bridgeHealth.healthy ? 'healthy' : 'degraded',
        service: 'rez-whatsapp-orchestrator-bridge',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        dependencies: bridgeHealth.details,
        queue: queueStatus,
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        service: 'rez-whatsapp-orchestrator-bridge',
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

  // WhatsApp webhook routes
  app.use('/webhook', createWebhookRoutes({
    messageBridge,
    responseBridge,
    verifyToken: CONFIG.whatsapp.verifyToken,
    appSecret: CONFIG.whatsapp.appSecret,
  }));

  // API routes (with auth)
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const publicPaths = ['/health', '/ready'];
    if (publicPaths.some(p => req.path.startsWith(p))) return next();

    const token = req.headers['x-internal-token'];
    if (token !== CONFIG.orchestrator.internalToken && CONFIG.orchestrator.internalToken) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  });

  // Get queue status
  app.get('/api/queue/status', (req: Request, res: Response) => {
    const status = responseBridge.getQueueStatus();
    res.json({ success: true, queue: status });
  });

  // Send message API (for internal use)
  app.post('/api/send', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { phoneNumber, message, type = 'text', mediaUrl } = req.body;

      if (!phoneNumber || !message) {
        res.status(400).json({ error: 'phoneNumber and message are required' });
        return;
      }

      let messageId: string;

      if (type === 'text') {
        messageId = await messageBridge.sendWhatsAppText(phoneNumber, message);
      } else if (type === 'image' && mediaUrl) {
        messageId = await messageBridge.sendWhatsAppImage(phoneNumber, mediaUrl, message);
      } else {
        res.status(400).json({ error: 'Invalid message type or missing mediaUrl' });
        return;
      }

      res.json({ success: true, messageId });
    } catch (error) {
      next(error);
    }
  });

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

  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    const reqWithId = req as Request & { requestId?: string };
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      requestId: reqWithId.requestId,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId: reqWithId.requestId,
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
      logger.info(`REZ WhatsApp Orchestrator Bridge started`, {
        port: CONFIG.port,
        nodeEnv: CONFIG.nodeEnv,
        redisUrl: CONFIG.redis.url,
        orchestratorUrl: CONFIG.orchestrator.url,
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await responseBridge.stop();
          await messageBridge.stop();
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
