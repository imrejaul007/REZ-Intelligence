import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import config from './config';
import logger from './utils/logger';
import { authenticateInternal } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { rabtul } from './integrations/rabtul';

// Import routes
import consultRoutes from './routes/consult.routes';
import pricingRoutes from './routes/pricing.routes';
import serviceRoutes from './routes/service.routes';
import leadsRoutes from './routes/leads.routes';

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.isProduction ? process.env.CORS_ORIGIN?.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token'],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debug('Incoming request', { method: req.method, path: req.path });
  next();
});

// Internal authentication
app.use(authenticateInternal);

// Health check endpoints
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'rez-mind-automotive-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/health/ready', async (_req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const rabtulHealth = await rabtul.healthCheck();
  const isReady = mongoStatus === 'connected';

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    service: 'rez-mind-automotive-service',
    version: '1.0.0',
    dependencies: {
      mongodb: mongoStatus,
      rabtul: rabtulHealth.connected ? 'connected' : 'not_configured',
    },
  });
});

// API routes
app.use('/api/v1/consult', consultRoutes);
app.use('/api/v1/pricing', pricingRoutes);
app.use('/api/v1/service', serviceRoutes);
app.use('/api/v1/leads', leadsRoutes);

// API documentation
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    name: 'ReZ Automotive Mind Service',
    version: '1.0.0',
    description: 'AI intelligence for automotive businesses',
    endpoints: {
      health: {
        'GET /health': 'Health check',
        'GET /health/ready': 'Readiness check',
      },
      consultation: {
        'POST /api/v1/consult': 'AI consultation',
        'GET /api/v1/consult/history/:sessionId': 'Get session history',
      },
      pricing: {
        'POST /api/v1/pricing/recommend': 'Pricing recommendation',
        'POST /api/v1/pricing/analyze': 'Market positioning analysis',
        'GET /api/v1/pricing/history': 'Pricing history',
      },
      service: {
        'POST /api/v1/service/predict': 'Service prediction',
        'POST /api/v1/service/schedule': 'Optimal scheduling',
        'GET /api/v1/service/history/:vehicleId': 'Service history analysis',
      },
      leads: {
        'POST /api/v1/leads/score': 'Score a lead',
        'POST /api/v1/leads/bulk-score': 'Bulk lead scoring',
        'GET /api/v1/leads/priorities': 'Lead priorities',
      },
    },
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Graceful shutdown
let server: ReturnType<Application['listen']>;

const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  server.close(async () => {
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    } catch (error) {
      logger.error('Error closing MongoDB', { error });
    }
    process.exit(0);
  });
};

const startServer = async (): Promise<void> => {
  try {
    logger.info('Connecting to MongoDB...', { uri: config.mongodb.uri.replace(/\/\/.*@/, '//<credentials>@') });
    await mongoose.connect(config.mongodb.uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    logger.info('MongoDB connected');

    server = app.listen(config.port, () => {
      logger.info(`ReZ Automotive Mind Service started on port ${config.port}`, {
        environment: config.env,
        nodeVersion: process.version,
      });
    });

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message });
      gracefulShutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
    });

  } catch (error) {
    logger.error('Failed to start server', { error: error instanceof Error ? error.message : 'Unknown' });
    process.exit(1);
  }
};

startServer();

export default app;