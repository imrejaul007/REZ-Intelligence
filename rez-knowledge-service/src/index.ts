// REZ Knowledge Service - Main Entry Point
// Unified User Knowledge Base Service for All REZ Apps

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import config from './config';
import logger from './utils/logger';
import { connectDatabase, disconnectDatabase } from './utils/database';
import routes from './routes';
import { errorHandler, notFoundHandler, requestLogger, serviceAuth } from './middleware';

const app: Application = express();

// ─── Security Middleware ───────────────────────────────────────────────────

// Set security HTTP headers
app.use(helmet());

// Enable CORS
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Service-Auth', 'X-Service-Secret', 'X-Service-Id', 'X-Service-Name'],
  })
);

// Compress response bodies
app.use(compression());

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ─── Request Logging ───────────────────────────────────────────────────────

app.use(requestLogger);

// ─── Service Authentication ────────────────────────────────────────────────

// Apply service auth to API routes
app.use('/api', serviceAuth);

// ─── API Routes ────────────────────────────────────────────────────────────

app.use('/api', routes);

// ─── Root Route ────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    success: true,
    service: {
      name: config.service.name,
      version: config.service.version,
      description: 'REZ Unified User Knowledge Base Service',
      documentation: '/api/health',
    },
  });
});

// ─── Error Handling ────────────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

// ─── Server Startup ────────────────────────────────────────────────────────

async function startServer(): Promise<void> {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Start HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`
╔══════════════════════════════════════════════════════════════╗
║           REZ Knowledge Service Started Successfully          ║
╠══════════════════════════════════════════════════════════════╣
║  Service:  ${config.service.name.padEnd(43)}║
║  Version:  ${config.service.version.padEnd(43)}║
║  Port:     ${config.port.toString().padEnd(43)}║
║  Env:      ${config.nodeEnv.padEnd(43)}║
║  MongoDB:  ${config.mongodb.uri.replace(/\/\/.*@/, '//<credentials>@').padEnd(40)}║
╚══════════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await disconnectDatabase();
          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Export for testing
export { app };

// Start server if running directly
if (require.main === module) {
  startServer();
}

export default app;
