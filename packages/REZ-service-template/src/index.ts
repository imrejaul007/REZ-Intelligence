import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { createLogger, getLogger } from '@rez/logger';
import { createAuthMiddleware } from '@rez/security-middleware';

// Initialize logger
const logger = getLogger('service-name');

export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));

  // Request ID middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req.headers as Record<string, string>)['x-request-id'] = uuidv4();
    next();
  });

  // Request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info('Request completed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: Date.now() - start,
        requestId: (req.headers as Record<string, string>)['x-request-id'],
      });
    });
    next();
  });

  // Health check (public)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'service-name',
    });
  });

  // Readiness check (public)
  app.get('/ready', async (_req: Request, res: Response) => {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    res.json({
      ready: mongoStatus === 'connected',
      dependencies: {
        mongodb: mongoStatus,
      },
    });
  });

  // Auth middleware (applied to /api routes)
  app.use('/api', createAuthMiddleware());

  // API routes placeholder
  // app.use('/api/resource', resourceRoutes);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
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
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      },
    });
  });

  return app;
}

async function start(): Promise<void> {
  // Validate required environment variables
  const required = ['MONGODB_URI', 'INTERNAL_SERVICE_TOKEN'];
  const missing = required.filter(env => !process.env[env]);

  if (missing.length > 0) {
    logger.error('Missing required environment variables', { missing });
    process.exit(1);
  }

  // Connect to MongoDB
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    process.exit(1);
  }

  // Create and start Express app
  const app = createApp();
  const port = parseInt(process.env.PORT || '3000', 10);

  const server = app.listen(port, () => {
    logger.info(`Service listening on port ${port}`, {
      env: process.env.NODE_ENV,
      port,
    });
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await mongoose.disconnect();
        logger.info('MongoDB disconnected');
      } catch (error) {
        logger.error('Error disconnecting from MongoDB', { error });
      }

      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Export for testing
export { start };

// Start if running directly
start().catch((error) => {
  console.error('Failed to start service:', error);
  process.exit(1);
});
