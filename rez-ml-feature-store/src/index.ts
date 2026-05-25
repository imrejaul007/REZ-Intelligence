/**
 * ML Feature Store - Express Application Entry Point
 * REST API for serving machine learning features in the ReZ platform
 */

import express, { Application, Request, Response, NextFunction } import logger from './utils/logger';
import from 'express';
import mongoose, { ConnectOptions } from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from 'dotenv';

// Load environment variables
config();

// Import routes
import featureRoutes from './routes/feature.routes';

// Import configuration
import { FEATURE_STORE_CONFIG } from './config/features';

// Types
interface AppError extends Error {
  statusCode?: number;
  status?: string;
}

interface AppConfig {
  port: string | number;
  mongoUri: string;
  nodeEnv: string;
}

// Configuration
const appConfig: AppConfig = {
  port: process.env.PORT || 3005,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-feature-store',
  nodeEnv: process.env.NODE_ENV || 'development',
};

// Create Express app
const app: Application = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check endpoint (before routes)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'rez-ml-feature-store',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Readiness check endpoint
app.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check MongoDB connection
    const mongoState = mongoose.connection.readyState;
    const mongoReady = mongoState === 1;

    if (!mongoReady) {
      res.status(503).json({
        status: 'not ready',
        mongodb: mongoState === 1 ? 'connected' : 'disconnected',
      });
      return;
    }

    res.json({
      status: 'ready',
      mongodb: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: (error as Error).message,
    });
  }
});

// API Routes
app.use('/api/features', featureRoutes);

// Feature serving endpoint (optimized for ML serving)
app.post('/api/serve', async (req: Request, res: Response) => {
  try {
    const { features } = req.body;

    if (!features || !Array.isArray(features) || features.length === 0) {
      res.status(400).json({ error: 'features array is required' });
      return;
    }

    if (features.length > FEATURE_STORE_CONFIG.maxFeaturesPerRequest) {
      res.status(400).json({
        error: `Too many features. Maximum: ${FEATURE_STORE_CONFIG.maxFeaturesPerRequest}`,
      });
      return;
    }

    // Batch fetch all requested features
    const { featureService } = await import('./services/feature.service');

    // Group by entity
    const groupedByEntity = new Map<string, string[]>();
    for (const f of features) {
      if (!f.entityId || !f.entityValue || !f.featureName) {
        continue;
      }
      const key = `${f.entityId}:${f.entityValue}`;
      const existing = groupedByEntity.get(key) || [];
      existing.push(f.featureName);
      groupedByEntity.set(key, existing);
    }

    // Fetch all features
    const results: Record<string, unknown>[] = [];
    for (const [key, featureNames] of groupedByEntity) {
      const [entityId, entityValue] = key.split(':');
      const result = await featureService.getFeatures({
        entityId,
        entityValues: [entityValue],
        featureNames,
      });

      if (result.features.length > 0) {
        results.push({
          entityId,
          entityValue,
          features: result.features[0].features,
          lastUpdated: result.features[0].lastUpdated,
        });
      }
    }

    res.json({
      features: results,
      metadata: {
        requested: features.length,
        returned: results.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Feature serving error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Streaming endpoint for real-time feature serving
app.post('/api/stream', async (req: Request, res: Response) => {
  try {
    const { entityId, entityValues } = req.body;

    if (!entityId || !entityValues || !Array.isArray(entityValues)) {
      res.status(400).json({ error: 'entityId and entityValues array are required' });
      return;
    }

    const { featureService } = await import('./services/feature.service');

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const result = await featureService.getFeatures({
      entityId,
      entityValues,
    });

    // Send initial data
    res.write(`data: ${JSON.stringify(result)}\n\n`);

    // Keep connection alive with heartbeats
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30000);

    // Close on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
    });

    // Send completion
    res.write(`event: complete\ndata: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
    method: req.method,
  });
});

// Global error handler
app.use((err: AppError, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

  res.status(statusCode).json({
    status,
    message: err.message || 'Internal server error',
    ...(appConfig.nodeEnv === 'development' && { stack: err.stack }),
  });
});

// Database connection
const connectDatabase = async (): Promise<void> => {
  try {
    const options: ConnectOptions = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(appConfig.mongoUri, options);
    logger.info('Connected to MongoDB');

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  try {
    // Close MongoDB connection
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');

    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    await connectDatabase();

    // Start Express server
    app.listen(appConfig.port, () => {
      logger.info(`
╔══════════════════════════════════════════════════════════════╗
║                    ML Feature Store Server                     ║
╠══════════════════════════════════════════════════════════════╣
║  Environment: ${appConfig.nodeEnv.padEnd(47)}║
║  Port:        ${String(appConfig.port).padEnd(47)}║
║  MongoDB:     ${appConfig.mongoUri.substring(0, 47).padEnd(47)}║
╠══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                  ║
║    GET  /health              - Health check                   ║
║    GET  /ready               - Readiness check                ║
║    GET  /api/features/...    - Feature definitions           ║
║    GET  /api/features/:id   - Get entity features            ║
║    POST /api/features/...   - Create/update features         ║
║    POST /api/features/batch - Batch operations               ║
║    POST /api/serve           - ML feature serving            ║
║    POST /api/stream          - Streaming features (SSE)       ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Export app for testing
export { app, appConfig };

// Start if running directly
if (require.main === module) {
  startServer();
}

export default app;
