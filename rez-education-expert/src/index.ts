import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createClient } from 'redis';
import mongoose from 'mongoose';
import winston from 'winston';
import educationRoutes from './routes/education.routes';
import { SYSTEM_PROMPT, AGENT_CONFIG } from './config/systemPrompt';

// Load environment variables
dotenv.config();

// Initialize Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'rez-education-expert' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Redis client
let redisClient: ReturnType<typeof createClient> | null = null;

// MongoDB connection
let mongoConnection: typeof mongoose | null = null;

// Initialize Redis connection
async function initializeRedis(): Promise<void> {
  if (!process.env.REDIS_URL) {
    logger.warn('REDIS_URL not configured, running without Redis cache');
    return;
  }

  try {
    redisClient = createClient({
      url: process.env.REDIS_URL
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Connected to Redis');
    });

    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
  }
}

// Initialize MongoDB connection
async function initializeMongoDB(): Promise<void> {
  if (!process.env.MONGODB_URI) {
    logger.warn('MONGODB_URI not configured, running without MongoDB');
    return;
  }

  try {
    mongoConnection = await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
  }
}

// Create Express application
const app: Express = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info({
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip
  });
  next();
});

// Request ID middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] ||
    `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-education-expert',
    version: AGENT_CONFIG.version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redis: redisClient?.isOpen ? 'connected' : 'disconnected',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Detailed health check with dependencies
app.get('/health/detailed', (_req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();

  res.json({
    status: 'healthy',
    service: 'rez-education-expert',
    version: AGENT_CONFIG.version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    dependencies: {
      redis: redisClient?.isOpen ? 'connected' : 'disconnected',
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    },
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
    },
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      platform: process.platform,
      nodeVersion: process.version,
    },
  });
});

// Kubernetes readiness probe
app.get('/health/ready', (_req: Request, res: Response) => {
  const checks = {
    redis: redisClient?.isOpen ?? false,
    mongodb: mongoose.connection.readyState === 1,
  };

  const isReady = checks.redis && checks.mongodb;

  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    checks,
    timestamp: new Date().toISOString(),
  });
});

// Agent info endpoint
app.get('/agent', (_req: Request, res: Response) => {
  res.json({
    name: AGENT_CONFIG.name,
    version: AGENT_CONFIG.version,
    description: AGENT_CONFIG.description,
    capabilities: AGENT_CONFIG.capabilities,
    systemPrompt: SYSTEM_PROMPT,
    endpoints: {
      health: '/health',
      agent: '/agent',
      courses: '/api/v1/courses',
      recommendations: '/api/v1/recommendations',
      'learning-paths': '/api/v1/learning-paths',
      progress: '/api/v1/progress',
      achievements: '/api/v1/achievements',
      chat: '/api/v1/chat',
      domains: '/api/v1/domains',
      intents: '/api/v1/intents'
    }
  });
});

// API routes
app.use('/api/v1', educationRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found'
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: _req.headers['x-request-id'] as string || 'unknown'
    }
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An internal error occurred'
        : err.message
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: _req.headers['x-request-id'] as string || 'unknown'
    }
  });
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }

    if (mongoConnection) {
      await mongoose.disconnect();
      logger.info('MongoDB connection closed');
    }

    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
const PORT = parseInt(process.env.PORT || '3006', 10);

async function startServer(): Promise<void> {
  try {
    // Initialize connections
    await Promise.all([
      initializeRedis(),
      initializeMongoDB()
    ]);

    // Start listening
    app.listen(PORT, () => {
      logger.info(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   REZ Education Expert Agent                             ║
║   Version: ${AGENT_CONFIG.version.padEnd(40)}║
║   Port: ${PORT.toString().padEnd(48)}║
║                                                          ║
║   Endpoints:                                             ║
║   - Health: http://localhost:${PORT}/health                 ║
║   - Agent:  http://localhost:${PORT}/agent                 ║
║   - API:    http://localhost:${PORT}/api/v1                ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app, logger };
