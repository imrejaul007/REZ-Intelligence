import express, { Application, Request, Response, NextFunction } import logger from './utils/logger.js';
import from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Routes
import modelRoutes from './routes/model.routes';
import versionRoutes from './routes/version.routes';

// Load environment variables
dotenv.config();

// ============================================
// Configuration
// ============================================

const PORT = parseInt(process.env.PORT || '3001', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-ml-model-registry';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================
// Express App Setup
// ============================================

const app: Application = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Compression
app.use(compression());

// Request logging
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// Health Check Endpoints
// ============================================

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-ml-model-registry',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    const mongoState = mongoose.connection.readyState;
    const mongoStatus = mongoState === 1 ? 'connected' : mongoState === 0 ? 'disconnected' : 'connecting';

    const isReady = mongoState === 1;

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not ready',
      checks: {
        mongodb: mongoStatus,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// API Routes
// ============================================

// Mount routes
app.use('/api/v1/models', modelRoutes);
app.use('/api/v1/models', versionRoutes);

// API Documentation endpoint
app.get('/api/v1', (_req: Request, res: Response) => {
  res.json({
    name: 'ReZ ML Model Registry API',
    version: '1.0.0',
    description: 'ML Model Registry Service for ReZ platform',
    endpoints: {
      models: {
        'POST /api/v1/models': 'Register a new model',
        'GET /api/v1/models': 'Search models with filters',
        'GET /api/v1/models/stats': 'Get registry statistics',
        'GET /api/v1/models/:namespace/:name': 'Get model by name',
        'PATCH /api/v1/models/:namespace/:name': 'Update model metadata',
        'DELETE /api/v1/models/:namespace/:name': 'Delete a model',
        'POST /api/v1/models/:namespace/:name/archive': 'Archive a model',
        'POST /api/v1/models/:namespace/:name/restore': 'Restore an archived model',
        'GET /api/v1/models/:namespace/:name/lineage': 'Get model version lineage',
        'POST /api/v1/models/:namespace/:name/compare': 'Compare multiple versions',
      },
      versions: {
        'POST /api/v1/models/:namespace/:name/versions': 'Register a new version',
        'GET /api/v1/models/:namespace/:name/versions': 'List all versions',
        'GET /api/v1/models/:namespace/:name/versions/:version': 'Get specific version',
        'PATCH /api/v1/models/:namespace/:name/versions/:version': 'Update version',
        'DELETE /api/v1/models/:namespace/:name/versions/:version': 'Delete version',
        'POST /api/v1/models/:namespace/:name/versions/:version/transition': 'Transition version stage',
        'GET /api/v1/models/:namespace/:name/versions/:version/download': 'Get download URL',
        'POST /api/v1/models/:namespace/:name/versions/:version/validate': 'Record validation results',
      },
      health: {
        'GET /health': 'Basic health check',
        'GET /health/ready': 'Readiness check with dependencies',
      },
    },
    documentation: {
      version_format: 'Semver format required (e.g., 1.0.0)',
      model_name_format: 'Lowercase letters, numbers, hyphens, and underscores only',
      version_stages: ['pending', 'validated', 'staged', 'production', 'archived'],
      model_stages: ['development', 'staging', 'production', 'archived'],
    },
  });
});

// ============================================
// Error Handling
// ============================================

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist',
    path: _req.path,
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);

  const statusCode = (err as unknown).statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: NODE_ENV === 'production' ? 'Internal Server Error' : err.name,
    message: NODE_ENV === 'production' ? 'An unexpected error occurred' : message,
    ...(NODE_ENV !== 'production' && { stack: err.stack }),
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// Database Connection
// ============================================

async function connectToDatabase(): Promise<void> {
  try {
    logger.info('Connecting to MongoDB...');
    logger.info(`URI: ${MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@')}`);

    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('MongoDB connected successfully');

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// ============================================
// Graceful Shutdown
// ============================================

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`\n${signal} received. Shutting down gracefully...`);

  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// Start Server
// ============================================

async function startServer(): Promise<void> {
  await connectToDatabase();

  app.listen(PORT, () => {
    logger.info('========================================');
    logger.info('ReZ ML Model Registry Service');
    logger.info('========================================');
    logger.info(`Environment: ${NODE_ENV}`);
    logger.info(`Port: ${PORT}`);
    logger.info(`MongoDB: ${MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@')}`);
    logger.info(`Health: http://localhost:${PORT}/health`);
    logger.info(`API: http://localhost:${PORT}/api/v1`);
    logger.info('========================================');
  });
}

// Start the application
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default app;
