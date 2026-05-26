/**
 * REZ Attribution-Loyalty Bridge Service
 *
 * Main entry point for the service that connects REZ-unified-attribution
 * to REZ-unified-loyalty, converting attributed conversions into cashback
 * and loyalty rewards.
 *
 * Features:
 * - Real-time conversion-to-reward bridging
 * - Channel-specific reward multipliers
 * - DOOH bonus (1.5x coins for digital out-of-home)
 * - Campaign-based bonus multipliers
 * - Idempotent processing
 * - Retry with exponential backoff
 * - Real-time notifications
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from 'dotenv';

import { logger } from './services/logger.js';
import { bridgeRouter } from './routes/bridge.js';
import { attributionListener } from './services/attributionListener.js';
import { cashbackEngine } from './services/cashbackEngine.js';
import { CampaignConfig } from './models/CampaignConfig.js';

// Load environment variables
config();

// ============================================
// CONFIGURATION
// ============================================

const PORT = parseInt(process.env.PORT || '4155', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-attribution-loyalty-bridge';
const SERVICE_NAME = process.env.SERVICE_NAME || 'rez-attribution-loyalty-bridge';

// ============================================
// EXPRESS APP
// ============================================

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    requestId: req.headers['x-request-id'],
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  next();
});

// Health check endpoint (before auth)
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: SERVICE_NAME,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Readiness check (includes DB connection)
app.get('/ready', async (_req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  const dbStatus = dbStatusMap[dbState] || 'unknown';

  if (dbState === 1) {
    res.json({
      status: 'ready',
      database: dbStatus,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      status: 'not ready',
      database: dbStatus,
      timestamp: new Date().toISOString()
    });
  }
});

// API routes
app.use('/api/v1', bridgeRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}, starting graceful shutdown`);

  try {
    // Stop accepting new requests
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Stop polling
    await attributionListener.shutdown();

    // Close database connection
    await mongoose.connection.close();
    logger.info('Database connection closed');

    // Exit
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});

// ============================================
// STARTUP
// ============================================

let server: ReturnType<typeof app.listen>;

async function start(): Promise<void> {
  try {
    // Connect to MongoDB
    logger.info('Connecting to MongoDB...', { uri: MONGODB_URI });
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Initialize Redis (optional)
    await attributionListener.initialize();

    // Load channel rewards from environment
    cashbackEngine.loadFromEnv();

    // Start HTTP server
    server = app.listen(PORT, () => {
      logger.info(`${SERVICE_NAME} started`, {
        port: PORT,
        nodeEnv: process.env.NODE_ENV || 'development',
        mongodb: MONGODB_URI.split('@')[1] || 'localhost'
      });

      logger.info('Service endpoints:', {
        health: `http://localhost:${PORT}/health`,
        ready: `http://localhost:${PORT}/ready`,
        api: `http://localhost:${PORT}/api/v1`
      });

      logger.info('Feature flags:', {
        doohBonus: process.env.DOOH_BONUS_MULTIPLIER || 1.5,
        maxCashback: process.env.MAX_CASHBACK_PERCENT || 10,
        conversionWindow: `${process.env.CONVERSION_WINDOW_HOURS || 168} hours`
      });
    });

    // Start polling for attribution events (if configured)
    if (process.env.POLL_ATTRIBUTION === 'true') {
      logger.info('Starting attribution polling...');
      attributionListener.startPolling();
    }

    // Update expired campaigns periodically
    setInterval(async () => {
      try {
        const updated = await CampaignConfig.updateExpiredCampaigns();
        if (updated > 0) {
          logger.info(`Updated ${updated} expired campaigns`);
        }
      } catch (error) {
        logger.error('Failed to update expired campaigns', { error });
      }
    }, 60 * 60 * 1000); // Every hour

  } catch (error) {
    logger.error('Failed to start service', { error });
    process.exit(1);
  }
}

start();

export { app };
