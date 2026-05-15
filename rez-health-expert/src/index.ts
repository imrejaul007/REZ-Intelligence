/**
 * REZ Health Expert Agent
 * Main entry point with TypeScript, Zod validation, and proper error handling
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { configSchema } from './config/index.js';
import { logger } from './services/healthExpert.js';
import { healthRouter } from './routes/health.routes.js';
import {
  errorHandler,
  notFoundHandler,
  requestLogger,
  asyncHandler
} from './middleware/validation.js';
import { ServiceConfig, ServiceError } from './types/index.js';

// ============================================
// CONFIGURATION VALIDATION
// ============================================

function loadConfig(): ServiceConfig {
  const result = configSchema.safeParse({
    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV,
    corsOrigins: process.env.ALLOWED_ORIGINS,
    rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
    logLevel: process.env.LOG_LEVEL
  });

  if (!result.success) {
    console.error('Configuration validation failed:', result.error.format());
    throw new ServiceError('Invalid configuration', 'CONFIG_ERROR', 1);
  }

  const data = result.data;

  return {
    port: data.port ?? 3011,
    nodeEnv: data.nodeEnv ?? 'development',
    corsOrigins: data.corsOrigins ?? ['http://localhost:3000'],
    rateLimitWindowMs: data.rateLimitWindowMs ?? 60000,
    rateLimitMaxRequests: data.rateLimitMaxRequests ?? 100,
    logLevel: data.logLevel ?? 'info',
    serviceName: 'rez-health-expert',
    version: '1.0.0'
  };
}

const config = loadConfig();

// ============================================
// APP INITIALIZATION
// ============================================

const app: Express = express();

// ============================================
// SECURITY MIDDLEWARE
// ============================================

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
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token']
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Compression
app.use(compression());

// Request logging
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return (req.body as { sessionId?: string })?.sessionId || req.ip || 'unknown';
  },
});
app.use('/api/', limiter);

// ============================================
// HEALTH CHECKS
// ============================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: config.serviceName,
    version: config.version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/health/detailed', asyncHandler(async (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();

  const healthData = {
    status: 'healthy',
    service: config.serviceName,
    version: config.version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024)
    },
    process: {
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version
    }
  };

  res.json(healthData);
}));

app.get('/health/ready', (req: Request, res: Response) => {
  const checks = {
    initialized: true,
    memory: process.memoryUsage().heapUsed < 500 * 1024 * 1024
  };

  const isReady = Object.values(checks).every(Boolean);

  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    checks,
    timestamp: new Date().toISOString()
  });
});

// ============================================
// API ROUTES
// ============================================

app.use('/api/v1/health', healthRouter);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: config.serviceName,
    version: config.version,
    description: 'AI-powered health expert for symptom guidance, wellness tips, and appointment booking',
    endpoints: {
      health: 'GET /health',
      healthDetailed: 'GET /health/detailed',
      healthReady: 'GET /health/ready',
      chat: 'POST /api/v1/health/chat',
      symptom: 'POST /api/v1/health/symptom',
      appointment: 'POST /api/v1/health/appointment',
      wellness: 'GET /api/v1/health/wellness',
      glossary: 'GET /api/v1/health/glossary'
    }
  });
});

// ============================================
// ERROR HANDLING
// ============================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

let server: ReturnType<Express['listen']> | null = null;

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  process.exit(0);
}

// ============================================
// SERVER STARTUP
// ============================================

function startServer(): void {
  try {
    server = app.listen(config.port, () => {
      logger.info(`
╔═══════════════════════════════════════════════════════════════╗
║                   REZ Health Expert Agent                     ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:     Running                                         ║
║  Port:       ${String(config.port).padEnd(53)}║
║  Environment: ${config.nodeEnv.padEnd(45)}║
║  Log Level:  ${config.logLevel.padEnd(47)}║
╚═══════════════════════════════════════════════════════════════╝
      `);

      logger.info('API Endpoints:');
      logger.info('  POST /api/v1/health/chat         - Chat with health expert');
      logger.info('  POST /api/v1/health/symptom       - Get symptom guidance');
      logger.info('  POST /api/v1/health/appointment  - Book appointment');
      logger.info('  GET  /api/v1/health/wellness     - Get wellness tips');
      logger.info('  GET  /health                     - Health check');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Unhandled rejection
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', { reason });
    });

    // Uncaught exception
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this is the main module
if (require.main === module || process.argv[1]?.endsWith('index.ts')) {
  startServer();
}

export { app, startServer, config };
