import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import mongoose from 'mongoose';
import { createClient, RedisClientType } from 'redis';

import { logger, logAudit, logSecurity } from './utils/logger';
import fraudRoutes from './routes/fraud.routes';
import alertRoutes from './routes/alert.routes';
import { FRAUD_AGENT_SYSTEM_PROMPT } from './config/systemPrompt';

// Configuration from environment
const PORT = parseInt(process.env.PORT || '3007', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_fraud_agent';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Redis client
let redisClient: RedisClientType | null = null;

// Express app
const app: Application = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-User-Id', 'X-Request-Id'],
  credentials: true,
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
    });
  });

  next();
});

// Health check endpoints (no auth required)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-fraud-agent',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

app.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check MongoDB
    const mongoState = mongoose.connection.readyState;
    const mongoConnected = mongoState === 1;

    // Check Redis
    let redisConnected = false;
    if (redisClient) {
      try {
        await redisClient.ping();
        redisConnected = true;
      } catch {
        redisConnected = false;
      }
    }

    if (mongoConnected && redisConnected) {
      res.json({
        status: 'ready',
        checks: {
          mongodb: mongoConnected ? 'connected' : 'disconnected',
          redis: redisConnected ? 'connected' : 'disconnected',
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        checks: {
          mongodb: mongoConnected ? 'connected' : 'disconnected',
          redis: redisConnected ? 'connected' : 'disconnected',
        },
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// System prompt endpoint
app.get('/system-prompt', (req: Request, res: Response) => {
  res.json({
    systemPrompt: FRAUD_AGENT_SYSTEM_PROMPT,
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/fraud', fraudRoutes);
app.use('/api/alerts', alertRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method,
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  logSecurity('Unhandled error in request', {
    path: req.path,
    method: req.method,
    error: err.message,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
});

// Database connection
async function connectMongoDB(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('MongoDB connected', {
      host: mongoose.connection.host,
      database: mongoose.connection.name,
    });

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error', { error: error.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// Redis connection
async function connectRedis(): Promise<void> {
  try {
    redisClient = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis max reconnection attempts reached');
            return new Error('Redis max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    redisClient.on('error', (error) => {
      logger.error('Redis error', { error: error.message });
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected', { url: REDIS_URL });
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting');
    });

    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw - Redis is optional but recommended
  }
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  logAudit('Service shutdown initiated', { signal });

  // Stop accepting new connections
  const server = app.listen();

  server.close(async () => {
    logger.info('HTTP server closed');

    // Close Redis
    if (redisClient) {
      try {
        await redisClient.quit();
        logger.info('Redis connection closed');
      } catch (error) {
        logger.error('Error closing Redis', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Close MongoDB
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    } catch (error) {
      logger.error('Error closing MongoDB', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 30000);
}

// Start server
async function startServer(): Promise<void> {
  try {
    // Connect to databases
    await connectMongoDB();
    await connectRedis();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info('REZ Fraud Agent started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
      });

      logAudit('Fraud agent service started', {
        port: PORT,
        environment: process.env.NODE_ENV,
      });
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
        process.exit(1);
      }
      throw error;
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Unhandled rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        promise: String(promise),
      });
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Start
startServer();

export { app, redisClient };
