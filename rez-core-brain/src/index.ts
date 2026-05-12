import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { config, getMongoUri, getCorsOrigins, isProduction } from './config';
import { logger } from './utils/logger';

// Import routes
import memoryRoutes from './routes/memory.routes';
import sessionRoutes from './routes/session.routes';
import personalizationRoutes from './routes/personalization.routes';

// Import middleware
import { requestId, authenticate, internalAuth, authenticateAny } from './middleware/auth';

// Import services
import { memoryService } from './services/memoryService';
import { sessionService } from './services/sessionService';
import { contextService } from './services/contextService';

// Create Express app
const app: Express = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: getCorsOrigins() }));
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW,
  max: config.RATE_LIMIT_MAX,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Request ID middleware
app.use(requestId);

// Health check endpoint (no auth required)
app.get('/health', async (req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.json({
    success: true,
    data: {
      service: config.SERVICE_NAME,
      status: 'healthy',
      timestamp: new Date(),
      dependencies: {
        mongodb: mongoStatus,
      },
    },
    meta: {
      timestamp: new Date(),
      requestId: req.requestId,
    },
  });
});

// Readiness check endpoint
app.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check MongoDB connection
    await mongoose.connection.db?.admin().ping();

    res.json({
      success: true,
      data: {
        ready: true,
        timestamp: new Date(),
      },
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: {
        code: 'NOT_READY',
        message: 'Service dependencies not ready',
      },
    });
  }
});

// API routes
app.use('/api/memory', memoryRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/personalization', personalizationRoutes);

// Internal API routes (for service-to-service communication)
app.use('/internal/memory', internalAuth, memoryRoutes);
app.use('/internal/session', internalAuth, sessionRoutes);
app.use('/internal/personalization', internalAuth, personalizationRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    requestId: req.requestId,
    path: req.path,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'An unexpected error occurred' : err.message,
    },
    meta: {
      timestamp: new Date(),
      requestId: req.requestId,
    },
  });
});

// Database connection
async function connectToMongoDB(): Promise<void> {
  const mongoUri = getMongoUri();

  try {
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('Connected to MongoDB', { uri: mongoUri.replace(/\/\/.*@/, '//<credentials>@') });

    // Create indexes
    await createIndexes();
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    throw error;
  }
}

// Create database indexes
async function createIndexes(): Promise<void> {
  try {
    // MongoDB indexes are defined in the schemas
    // This is a placeholder for any additional index creation
    logger.info('Database indexes ready');
  } catch (error) {
    logger.error('Failed to create indexes', { error });
  }
}

// Start server
async function startServer(): Promise<void> {
  try {
    // Connect to MongoDB
    await connectToMongoDB();

    // Start Express server
    const server = app.listen(config.PORT, () => {
      logger.info(`Server started`, {
        port: config.PORT,
        env: config.NODE_ENV,
        service: config.SERVICE_NAME,
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);

      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          // Close service connections
          await sessionService.close();
          await contextService.close();

          // Close MongoDB connection
          await mongoose.connection.close();
          logger.info('MongoDB connection closed');

          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', { error });
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

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Scheduled tasks
function startScheduledTasks(): void {
  // Clean up expired memories every hour
  setInterval(async () => {
    try {
      await memoryService.cleanupExpired();
    } catch (error) {
      logger.error('Failed to cleanup expired memories', { error });
    }
  }, 60 * 60 * 1000); // 1 hour

  // Clean up stale sessions every 15 minutes
  setInterval(async () => {
    try {
      await sessionService.cleanupStaleSessions();
    } catch (error) {
      logger.error('Failed to cleanup stale sessions', { error });
    }
  }, 15 * 60 * 1000); // 15 minutes

  logger.info('Scheduled tasks started');
}

// Export app for testing
export { app };

// Start the server
if (require.main === module) {
  startServer();
  startScheduledTasks();
}

export default app;
