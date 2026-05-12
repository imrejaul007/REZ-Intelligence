/**
 * REZ Hospitality Expert Agent
 * Main entry point for the Express server
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config, serviceConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler, requestLogger } from './middleware/validation.js';
import hospitalityRoutes from './routes/hospitality.routes.js';
import { getCoreBrainClient, CoreBrainClient } from './services/coreBrainIntegration.js';

// ============================================
// APP INITIALIZATION
// ============================================

const app: Application = express();

// ============================================
// MIDDLEWARE
// ============================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      styleSrc: ['\'self\'', '\'unsafe-inline\''],
      scriptSrc: ['\'self\''],
      imgSrc: ['\'self\'', 'data:', 'https:'],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: config.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://rez.com']
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token'],
  credentials: true,
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: serviceConfig.rateLimitWindow,
  max: serviceConfig.rateLimitMax,
  message: {
    error: 'Too Many Requests',
    message: 'You have exceeded the rate limit. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return (req.body as { sessionId?: string })?.sessionId || req.ip || 'unknown';
  },
});
app.use('/api/', limiter);

// ============================================
// ROUTES
// ============================================

// Health check (no rate limiting)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-hospitality-expert',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
  });
});

// API routes
app.use('/api/v1/hospitality', hospitalityRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'REZ Hospitality Expert Agent',
    version: '1.0.0',
    description: 'AI-powered hospitality concierge for hotels, stays, and resorts',
    documentation: '/api/v1/hospitality/health',
    endpoints: {
      chat: 'POST /api/v1/hospitality/chat',
      session: 'POST /api/v1/hospitality/session',
      sessionInfo: 'GET /api/v1/hospitality/session/:sessionId',
      workflow: 'POST /api/v1/hospitality/workflow',
      amenities: 'GET /api/v1/hospitality/amenities',
      recommendations: 'GET /api/v1/hospitality/recommendations',
      intents: 'GET /api/v1/hospitality/intents',
      health: 'GET /api/v1/hospitality/health',
    },
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  errorHandler(err, req, res, next);
});

// ============================================
// SERVER STARTUP
// ============================================

async function startServer() {
  try {
    const port = serviceConfig.port;
    const host = '0.0.0.0';

    // Initialize Core Brain client
    const coreBrain: CoreBrainClient = getCoreBrainClient();
    const coreBrainHealthy = await coreBrain.healthCheck().catch(() => false);
    if (coreBrainHealthy) {
      logger.info('Core Brain connection established', {
        baseUrl: process.env.CORE_BRAIN_URL || 'http://localhost:4072',
      });
    } else {
      logger.warn('Core Brain not available - running in degraded mode');
    }

    app.listen(port, host, () => {
      logger.info(`REZ Hospitality Expert Agent started`, {
        port,
        host,
        environment: config.NODE_ENV,
        serviceName: serviceConfig.serviceName,
      });

      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🏨  REZ HOSPITALITY EXPERT AGENT                          ║
║                                                              ║
║   Server running at: http://${host}:${port}                    ║
║   Environment: ${config.NODE_ENV.padEnd(42)}║
║   Log Level: ${(config.LOG_LEVEL || 'info').padEnd(42)}║
║                                                              ║
║   Endpoints:                                                 ║
║   • POST /api/v1/hospitality/chat      - Chat with agent    ║
║   • POST /api/v1/hospitality/session   - Start session      ║
║   • GET  /api/v1/hospitality/health    - Health check       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received. Shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received. Shutting down gracefully...');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
  process.exit(1);
});

// Start the server
startServer();

export default app;
