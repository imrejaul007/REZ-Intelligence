import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config, serviceTokens } from './config/index.js';
import { connectDatabase, connectRedis, disconnectDatabase, healthCheck } from './utils/database.js';
import logger from './utils/logger.js';
import { AppError } from './utils/errors.js';
import {
  loggingRoutes,
  analyticsRoutes,
  exportRoutes,
  feedbackRoutes,
  schedulerRoutes,
} from './routes/index.js';
import { dailyExportScheduler, modelUpdateScheduler } from './schedulers/index.js';

// Create Express app
const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.NODE_ENV === 'production'
    ? ['https://rez.commerce', 'https://*.rez.commerce']
    : '*',
  credentials: true,
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
  },
});
app.use(limiter);

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  const start = Date.now();

  _res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: _res.statusCode,
      duration,
    });
  });

  next();
});

// Internal service authentication middleware
app.use('/api/v1', (req: Request, res: Response, next: NextFunction) => {
  // Skip auth for health checks
  if (req.path === '/health') {
    return next();
  }

  const token = req.headers['x-internal-token'] as string;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Missing internal service token',
    });
  }

  // Check if token is valid
  const isValid = Object.values(serviceTokens).includes(token);
  if (!isValid) {
    logger.warn('Invalid internal token attempt', {
      path: req.path,
      ip: req.ip,
    });
    return res.status(403).json({
      success: false,
      error: 'Invalid internal service token',
    });
  }

  next();
});

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const dbHealth = await healthCheck();

    const isHealthy = dbHealth.mongodb && dbHealth.redis;

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      service: 'rez-conversation-intelligence',
      version: '1.0.0',
      uptime: process.uptime(),
      database: dbHealth,
      schedulers: {
        dailyExport: dailyExportScheduler.isSchedulerRunning(),
        modelUpdate: modelUpdateScheduler.isSchedulerRunning(),
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Health check failed',
    });
  }
});

// Readiness check
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    const dbHealth = await healthCheck();

    if (dbHealth.mongodb && dbHealth.redis) {
      res.status(200).json({ ready: true });
    } else {
      res.status(503).json({ ready: false });
    }
  } catch {
    res.status(503).json({ ready: false });
  }
});

// API Routes
app.use('/api/v1/conversations', loggingRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/export', exportRoutes);
app.use('/api/v1/feedback', feedbackRoutes);
app.use('/api/v1/schedulers', schedulerRoutes);

// API info endpoint
app.get('/api/v1', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'REZ Conversation Intelligence',
    version: '1.0.0',
    endpoints: {
      conversations: '/api/v1/conversations',
      analytics: '/api/v1/analytics',
      export: '/api/v1/export',
      feedback: '/api/v1/feedback',
      schedulers: '/api/v1/schedulers',
    },
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Error handler caught', {
    error: err.message,
    stack: err.stack,
  });

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: err.message,
    });
    return;
  }

  // Handle MongoDB duplicate key errors
  if ((err as Record<string, unknown>).code === 11000) {
    res.status(409).json({
      success: false,
      error: 'Duplicate entry',
    });
    return;
  }

  // Generic error response
  res.status(500).json({
    success: false,
    error: config.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  // Stop schedulers
  try {
    await dailyExportScheduler.stop();
    await modelUpdateScheduler.stop();
  } catch (error) {
    logger.error('Error stopping schedulers', { error: (error as Error).message });
  }

  // Close database connections
  try {
    await disconnectDatabase();
  } catch (error) {
    logger.error('Error disconnecting from database', { error: (error as Error).message });
  }

  logger.info('Graceful shutdown completed');
  process.exit(0);
}

// Start server
async function start(): Promise<void> {
  try {
    // Connect to databases
    await connectDatabase();
    await connectRedis();

    // Start schedulers (only in production/development, not in test)
    if (config.NODE_ENV !== 'test') {
      try {
        await dailyExportScheduler.start();
        await modelUpdateScheduler.start();
        logger.info('Schedulers started');
      } catch (error) {
        logger.warn('Failed to start schedulers', { error: (error as Error).message });
      }
    }

    // Start HTTP server
    const server = app.listen(config.PORT, () => {
      logger.info(`REZ Conversation Intelligence started`, {
        port: config.PORT,
        env: config.NODE_ENV,
        pid: process.pid,
      });
    });

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
      shutdown('unhandledRejection');
    });

  } catch (error) {
    logger.error('Failed to start server', { error: (error as Error).message });
    process.exit(1);
  }
}

// Export for testing
export { app };

// Start the server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

start().catch((error) => {
  logger.error('Startup failed', { error: (error as Error).message });
  process.exit(1);
});
