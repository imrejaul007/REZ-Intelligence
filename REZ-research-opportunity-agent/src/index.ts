import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import config from './config/index.js';
import { connectDatabase, disconnectDatabase } from './utils/database.js';
import { connectRedis, disconnectRedis } from './utils/redis.js';
import routes from './routes/index.js';
import { dailyWorker, weeklyWorker, realTimeWorker } from './workers/index.js';
import logger from './utils/logger.js';
import { errorHandler, requestLogger } from './middleware/auth.js';

const log = logger.child({ context: 'Main' });

class Application {
  private app: Express;
  private server: ReturnType<Express['listen']> | null = null;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-API-Key'],
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use(requestLogger);
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api', routes);

    // Root endpoint
    this.app.get('/', (_req, res) => {
      res.json({
        service: 'ReZ Research & Opportunity Agent',
        version: '1.0.0',
        description: 'Autonomous AI agent for business research and opportunity identification',
        endpoints: {
          health: '/api/health',
          research: '/api/research/*',
          opportunities: '/api/opportunities/*',
          insights: '/api/insights/*',
          campaigns: '/api/campaigns/*',
          workers: '/api/workers/*',
        },
      });
    });

    // 404 handler
    this.app.use((_req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found',
        },
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  async start(): Promise<void> {
    try {
      log.info('Starting ReZ Research & Opportunity Agent...');

      // Connect to databases
      log.info('Connecting to MongoDB...');
      await connectDatabase();

      log.info('Connecting to Redis...');
      await connectRedis();

      // Start workers
      log.info('Starting workers...');
      await realTimeWorker.start(config.workers.realtimeInterval);
      await dailyWorker.start();
      await weeklyWorker.start();

      // Start HTTP server
      this.server = this.app.listen(config.port, () => {
        log.info(`Server running on port ${config.port}`);
        log.info(`Environment: ${config.env}`);
        log.info(`Health check: http://localhost:${config.port}/api/health`);
      });

      // Graceful shutdown handlers
      this.setupShutdownHandlers();

    } catch (error) {
      log.error('Failed to start application', { error: (error as Error).message });
      process.exit(1);
    }
  }

  private setupShutdownHandlers(): void {
    const gracefulShutdown = async (signal: string): Promise<void> => {
      log.info(`Received ${signal}, starting graceful shutdown...`);

      // Stop accepting new connections
      if (this.server) {
        this.server.close(() => {
          log.info('HTTP server closed');
        });
      }

      try {
        // Stop workers
        log.info('Stopping workers...');
        await realTimeWorker.stop();
        await dailyWorker.stop();
        await weeklyWorker.stop();

        // Disconnect from databases
        log.info('Disconnecting from databases...');
        await disconnectRedis();
        await disconnectDatabase();

        log.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        log.error('Error during shutdown', { error: (error as Error).message });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      log.error('Uncaught exception', { error: error.message, stack: error.stack });
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
      log.error('Unhandled rejection', { reason });
      gracefulShutdown('unhandledRejection');
    });
  }

  getApp(): Express {
    return this.app;
  }
}

// Create and start the application
const app = new Application();
app.start();

export default app;
