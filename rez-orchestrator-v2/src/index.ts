import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import Redis from 'ioredis';

import { appConfig } from './config';
import { logger } from './utils/logger.js';

// Services
import { AgentRegistry, createAgentRegistry } from './services/agentRegistry';
import { ExpertSelector, createExpertSelector } from './services/expertSelector';
import { AgentSwitcher, createAgentSwitcher } from './services/agentSwitcher';
import { CollaborationManager, createCollaborationManager } from './services/collaborationManager';
import { EscalationService, createEscalationService } from './services/escalationService';
import { ResponseGenerator, createResponseGenerator } from './services/responseGenerator';
import { MessageProcessor, createMessageProcessor } from './services/messageProcessor';
import {
  CircuitBreakerRegistry,
  CircuitState,
  getCircuitBreakerRegistry,
} from './services/circuitBreaker';

// Routes
import { createMessageRoutes } from './routes/message.routes';
import { createRoutingRoutes } from './routes/routing.routes';
import { createCollaborationRoutes } from './routes/collaboration.routes';

// Middleware
import { authMiddleware } from './middleware/auth.middleware';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { RateLimiter, createRateLimiter } from './middleware/rateLimit.middleware';

// Initialize Express app
const app: Express = express();

// Initialize Redis
let redis: Redis;
let agentRegistry: AgentRegistry;
let expertSelector: ExpertSelector;
let agentSwitcher: AgentSwitcher;
let collaborationManager: CollaborationManager;
let escalationService: EscalationService;
let responseGenerator: ResponseGenerator;
let messageProcessor: MessageProcessor;
let rateLimiter: RateLimiter;
let circuitRegistry: CircuitBreakerRegistry;

async function initializeServices(): Promise<void> {
  logger.info('Initializing services...');

  // Initialize Redis
  redis = new Redis(appConfig.redis.url, {
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
    logger.info('Redis connected', { url: appConfig.redis.url });
  });

  // Initialize services
  agentRegistry = createAgentRegistry(redis);
  expertSelector = createExpertSelector();
  agentSwitcher = createAgentSwitcher();
  collaborationManager = createCollaborationManager(agentSwitcher);
  escalationService = createEscalationService();
  responseGenerator = createResponseGenerator();

  // Set up circular dependencies
  expertSelector.setAgentRegistry(agentRegistry);
  collaborationManager.setAgentRegistry(agentRegistry);

  // Initialize message processor
  messageProcessor = createMessageProcessor(
    agentRegistry,
    expertSelector,
    agentSwitcher,
    collaborationManager,
    escalationService,
    responseGenerator
  );

  // Initialize rate limiter
  rateLimiter = createRateLimiter(redis);

  // Initialize circuit breaker registry
  circuitRegistry = getCircuitBreakerRegistry();

  logger.info('Services initialized successfully');
}

function configureMiddleware(): void {
  // Security middleware
  app.use(helmet());

  // CORS
  app.use(cors({
    origin: appConfig.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
  app.use(express.json({ limit: appConfig.requestValidation.maxRequestSize }));
  app.use(express.urlencoded({ extended: true, limit: appConfig.requestValidation.maxRequestSize }));

  // Rate limiting (apply to all routes)
  app.use(rateLimiter.middleware.bind(rateLimiter));

  // Trust proxy for correct IP detection
  app.set('trust proxy', 1);
}

function configureRoutes(): void {
  // Health check (no auth required)
  app.get(appConfig.healthCheck.route, async (_req: Request, res: Response) => {
    try {
      const redisOk = redis.status === 'ready';
      const metrics = agentRegistry.getMetrics();

      res.json({
        status: redisOk ? 'healthy' : 'degraded',
        service: 'rez-orchestrator-v2',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        dependencies: {
          redis: redisOk ? 'healthy' : 'unhealthy',
        },
        metrics,
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        service: 'rez-orchestrator-v2',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Readiness check
  app.get('/ready', async (_req: Request, res: Response) => {
    const redisOk = redis.status === 'ready';

    if (redisOk) {
      res.json({ ready: true });
    } else {
      res.status(503).json({ ready: false, reason: 'Redis not connected' });
    }
  });

  // Circuit breaker endpoints (no auth required for internal monitoring)
  app.get('/circuits', (_req: Request, res: Response) => {
    const stats = circuitRegistry.getAllStats();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...stats,
    });
  });

  app.get('/circuits/:agentId', (req: Request, res: Response) => {
    const { agentId } = req.params;
    const circuit = circuitRegistry.getCircuit(agentId);
    res.json({
      success: true,
      ...circuit.getStats(),
    });
  });

  app.post('/circuits/:agentId/reset', (req: Request, res: Response) => {
    const { agentId } = req.params;
    const circuit = circuitRegistry.getCircuit(agentId);
    circuit.reset();
    res.json({
      success: true,
      message: `Circuit breaker for ${agentId} has been reset`,
      ...circuit.getStats(),
    });
  });

  app.post('/circuits/:agentId/state', (req: Request, res: Response) => {
    const { agentId } = req.params;
    const { state } = req.body;

    if (!Object.values(CircuitState).includes(state)) {
      return res.status(400).json({
        success: false,
        error: `Invalid state. Must be one of: ${Object.values(CircuitState).join(', ')}`,
      });
    }

    const circuit = circuitRegistry.getCircuit(agentId);
    circuit.forceState(state);
    res.json({
      success: true,
      message: `Circuit breaker for ${agentId} forced to ${state}`,
      ...circuit.getStats(),
    });
    return;
  });

  app.post('/circuits/reset-all', (_req: Request, res: Response) => {
    circuitRegistry.resetAll();
    res.json({
      success: true,
      message: 'All circuit breakers have been reset',
    });
  });

  // API routes (auth required)
  app.use('/api/v2/message', authMiddleware, createMessageRoutes({ processor: messageProcessor }));
  app.use('/api/v2/routing', authMiddleware, createRoutingRoutes({
    agentRegistry,
    expertSelector,
    agentSwitcher,
  }));
  app.use('/api/v2/collaboration', authMiddleware, createCollaborationRoutes({
    collaborationManager,
  }));

  // Error handling
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);
}

async function startServer(): Promise<void> {
  try {
    await initializeServices();
    configureMiddleware();
    configureRoutes();

    const server = app.listen(appConfig.port, () => {
      logger.info(`REZ Orchestrator v2 started`, {
        port: appConfig.port,
        nodeEnv: appConfig.nodeEnv,
        redisUrl: appConfig.redis.url,
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await agentRegistry.shutdown();
          await escalationService.shutdown();
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
