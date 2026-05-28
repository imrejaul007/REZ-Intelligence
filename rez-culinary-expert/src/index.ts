/**
 * REZ Culinary Expert Agent
 * Main entry point for the Express server
 */

import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { MongoClient } from 'mongodb';
import Redis from 'ioredis';
import { logger, logRequest, logAudit } from './utils/logger';
import culinaryRoutes from './routes/culinary.routes';
import { getCulinaryExpertiseService } from './services/expertise';
import { getMenuService } from './services/menuService';
import { getDietaryService } from './services/dietaryService';
import { getRecommendationsService } from './services/recommendations';
import { getOrderFlowHandler } from './intents/orderFlow';
import { getCoreBrainClient, CoreBrainClient } from './services/coreBrainIntegration';

// ============================================================================
// CONFIGURATION
// ============================================================================

interface Config {
  port: number;
  nodeEnv: string;
  mongodbUri: string;
  mongodbDbName: string;
  redisUrl: string;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  internalServiceTokens: Map<string, string>;
}

function loadConfig(): Config {
  const internalServiceTokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
  let internalServiceTokens: Map<string, string> = new Map();

  try {
    const parsed = JSON.parse(internalServiceTokensJson);
    internalServiceTokens = new Map(Object.entries(parsed));
  } catch {
    logger.warn('Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
  }

  return {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    mongodbDbName: process.env.MONGODB_DB_NAME || 'rez_culinary',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    internalServiceTokens,
  };
}

const config = loadConfig();

// ============================================================================
// DATABASE CONNECTIONS
// ============================================================================

let mongoClient: MongoClient | null = null;
let redis: Redis | null = null;

async function connectDatabases(): Promise<void> {
  // Connect to MongoDB
  try {
    mongoClient = new MongoClient(config.mongodbUri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
    });

    await mongoClient.connect();
    logger.info('Connected to MongoDB', { uri: config.mongodbUri.replace(/\/\/.*@/, '//***@') });

    // Initialize collections and indexes
    const db = mongoClient.db(config.mongodbDbName);

    // Create collections if they don't exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    const requiredCollections = [
      'menu_items',
      'menus',
      'orders',
      'order_flow_states',
      'dietary_profiles',
      'recommendations',
    ];

    for (const name of requiredCollections) {
      if (!collectionNames.includes(name)) {
        await db.createCollection(name);
        logger.info(`Created collection: ${name}`);
      }
    }
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }

  // Connect to Redis
  try {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError(err) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
    });

    redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    redis.on('connect', () => {
      logger.info('Connected to Redis', { url: config.redisUrl.replace(/\/\/.*@/, '//***@') });
    });

    // Wait for Redis to be ready
    await new Promise<void>((resolve, reject) => {
      if (redis!.status === 'ready') {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, 10000);

      redis!.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      redis!.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // CORS
  app.use(cors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-Request-ID'],
    credentials: true,
    maxAge: 86400,
  }));

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests,
    message: {
      success: false,
      error: 'Too many requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // Request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      logRequest(req.method, req.path, res.statusCode, duration, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    });

    next();
  });

  // Health check endpoint
  app.get('/health', async (req: Request, res: Response) => {
    const healthcheck = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        mongodb: mongoClient ? 'connected' : 'disconnected',
        redis: redis?.status === 'ready' ? 'connected' : 'disconnected',
      },
    };

    const isHealthy = healthcheck.services.mongodb === 'connected' &&
                     healthcheck.services.redis === 'connected';

    res.status(isHealthy ? 200 : 503).json(healthcheck);
  });

  // Detailed health check with dependencies
  app.get('/health/detailed', async (req: Request, res: Response) => {
    const memoryUsage = process.memoryUsage();

    const healthData = {
      status: 'healthy',
      service: 'rez-culinary-expert',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      dependencies: {
        mongodb: mongoClient ? 'connected' : 'disconnected',
        redis: redis?.status === 'ready' ? 'connected' : 'disconnected',
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
    };

    const isHealthy = healthData.dependencies.mongodb === 'connected' &&
                     healthData.dependencies.redis === 'connected';

    res.status(isHealthy ? 200 : 503).json(healthData);
  });

  // Kubernetes readiness probe
  app.get('/health/ready', (req: Request, res: Response) => {
    const checks = {
      mongodb: mongoClient !== undefined,
      redis: redis?.status === 'ready' || false,
    };

    const isReady = checks.mongodb && checks.redis;

    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      checks,
      timestamp: new Date().toISOString(),
    });
  });

  // Internal authentication middleware
  app.use('/api/internal', (req: Request, res: Response, next: NextFunction) => {
    const token = req.get('X-Internal-Token');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Missing X-Internal-Token header',
      });
    }

    const validToken = config.internalServiceTokens.get(token);
    if (!validToken) {
      logAudit('AUTH_FAILURE', 'unknown', {
        reason: 'invalid_token',
        path: req.path,
        ip: req.ip,
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid X-Internal-Token',
      });
    }

    // Attach service name to request
    (req as Request & { serviceName: string }).serviceName = validToken;
    next();
  });

  // Mount routes
  app.use('/api/culinary', culinaryRoutes);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      path: req.path,
    });
  });

  // Error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });

    res.status(500).json({
      success: false,
      error: config.nodeEnv === 'production'
        ? 'Internal server error'
        : err.message,
    });
  });

  return app;
}

// ============================================================================
// SERVICE INITIALIZATION
// ============================================================================

async function initializeServices(): Promise<void> {
  if (!mongoClient || !redis) {
    throw new Error('Databases not connected');
  }

  const db = mongoClient.db(config.mongodbDbName);

  // Initialize services
  const expertiseService = getCulinaryExpertiseService();
  await expertiseService.initialize(mongoClient, redis);
  logger.info('CulinaryExpertiseService initialized');

  const menuService = getMenuService();
  await menuService.initialize(db, redis);
  logger.info('MenuService initialized');

  const dietaryService = getDietaryService();
  await dietaryService.initialize(db, redis);
  logger.info('DietaryService initialized');

  const recommendationsService = getRecommendationsService();
  await recommendationsService.initialize(db, redis);
  logger.info('RecommendationsService initialized');

  const orderFlowHandler = getOrderFlowHandler();
  await orderFlowHandler.initialize(mongoClient, redis);
  logger.info('OrderFlowHandler initialized');
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  // Close database connections
  try {
    if (mongoClient) {
      await mongoClient.close();
      logger.info('MongoDB connection closed');
    }

    if (redis) {
      await redis.quit();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }

  process.exit(0);
}

// ============================================================================
// MAIN
// ============================================================================

let server: ReturnType<Express['listen']> | null = null;

async function main(): Promise<void> {
  try {
    // Connect to databases
    logger.info('Connecting to databases...');
    await connectDatabases();

    // Initialize Core Brain client
    logger.info('Connecting to Core Brain...');
    const coreBrain: CoreBrainClient = getCoreBrainClient();
    const coreBrainHealthy = await coreBrain.healthCheck().catch(() => false);
    if (coreBrainHealthy) {
      logger.info('Core Brain connection established', {
        baseUrl: process.env.CORE_BRAIN_URL || 'http://localhost:4072',
      });
    } else {
      logger.warn('Core Brain not available - running in degraded mode');
    }

    // Initialize services
    logger.info('Initializing services...');
    await initializeServices();

    // Create and start Express app
    const app = createApp();

    server = app.listen(config.port, () => {
      logger.info(`
╔═══════════════════════════════════════════════════════════════╗
║                    REZ Culinary Expert Agent                  ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:     Running                                         ║
║  Port:       ${String(config.port).padEnd(53)}║
║  Environment: ${config.nodeEnv.padEnd(45)}║
║  MongoDB:    ${config.mongodbDbName.padEnd(45)}║
╚═══════════════════════════════════════════════════════════════╝
      `);

      logger.info('API Endpoints:');
      logger.info('  POST /api/culinary/chat         - Chat with culinary expert');
      logger.info('  GET  /api/culinary/menu/:id     - Get restaurant menu');
      logger.info('  POST /api/culinary/recommendations - Get recommendations');
      logger.info('  POST /api/culinary/dietary/*    - Dietary management');
      logger.info('  POST /api/culinary/orders/*     - Order management');
      logger.info('  GET  /health                    - Health check');
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Unhandled rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection:', { reason, promise });
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
