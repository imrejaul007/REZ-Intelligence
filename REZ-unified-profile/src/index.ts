import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDatabase, isDatabaseConnected } from './config/database.js';
import { logger } from './config/logger.js';
import {
  corsMiddleware,
  requestLogger,
  rateLimitHeaders,
  errorHandler,
  notFoundHandler
} from './middleware/auth.js';
import profileRoutes from './routes/profileRoutes.js';
import { checkSignalServicesHealth } from './services/signalAggregator.js';

// Initialize Express app
const app: Express = express();
const PORT = parseInt(process.env.PORT || '4060', 10);

// Trust proxy for correct IP detection
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable for API
}));

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Internal-Token', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Rate limit headers
app.use(rateLimitHeaders);

// Health check endpoint (no auth required)
app.get('/health', async (req: Request, res: Response) => {
  const dbConnected = isDatabaseConnected();

  // Check signal services
  const signalServices = await checkSignalServicesHealth();

  const healthy = dbConnected;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    service: 'rez-unified-profile',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    checks: {
      database: dbConnected ? 'connected' : 'disconnected',
      signalServices
    }
  });
});

// Ready check endpoint
app.get('/ready', (req: Request, res: Response) => {
  const dbConnected = isDatabaseConnected();

  if (dbConnected) {
    res.status(200).json({
      ready: true,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      ready: false,
      reason: 'Database not connected',
      timestamp: new Date().toISOString()
    });
  }
});

// Service info endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'REZ Unified Profile Service',
    version: '1.0.0',
    description: 'Single source of truth for user profiles',
    endpoints: {
      health: 'GET /health',
      ready: 'GET /ready',
      profile: {
        get: 'GET /profile/:userId',
        signals: 'GET /profile/:userId/signals',
        segments: 'GET /profile/:userId/segments',
        activity: 'GET /profile/:userId/activity',
        enrich: 'POST /profile/:userId/enrich',
        delete: 'DELETE /profile/:userId'
      },
      merge: 'POST /profile/merge',
      search: 'GET /profiles/search',
      lookup: 'POST /profiles/lookup',
      segments: {
        members: 'GET /segments/:segment/members',
        stats: 'GET /segments/stats'
      }
    },
    documentation: 'https://docs.rezapp.com/unified-profile'
  });
});

// API routes
app.use('/api', profileRoutes);
app.use('/', profileRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown handler
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Close database connection
  try {
    const { disconnectDatabase } = await import('./config/database.js');
    await disconnectDatabase();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database', { error: error.message });
  }

  logger.info('Graceful shutdown complete');
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    promise: String(promise)
  });
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// Start server
async function startServer(): Promise<void> {
  try {
    // Connect to database
    await connectDatabase();

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`REZ Unified Profile Service started`, {
        port: PORT,
        nodeEnv: process.env.NODE_ENV || 'development',
        pid: process.pid
      });
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API base: http://localhost:${PORT}/api`);
    });

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Start if this is the main module
startServer();

// Export for testing
export { app };
