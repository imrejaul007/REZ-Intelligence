import 'dotenv/config';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { logger, logInfo, logError } from './services/logger.js';
import { connectDatabase, disconnectDatabase } from './services/database.js';
import { connectRedis, disconnectRedis } from './services/redis.js';
import { rateLimitMiddleware, requestLoggingMiddleware, errorHandler, notFoundHandler } from './middleware/index.js';
import { createAuthMiddleware } from '@rez/security-middleware';

import giftCardRoutes from './routes/giftCardRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import walletRoutes from './routes/walletRoutes.js';

const PORT = parseInt(process.env.PORT || '4061', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create Express app
const app: Express = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLoggingMiddleware);

// Health check endpoint (public)
app.get('/api/gift-cards/health', (_req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'rez-gift-card-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    service: 'REZ Gift Card Service',
    version: '1.0.0',
    status: 'running',
    port: PORT,
    documentation: '/api/gift-cards/health',
  });
});

// Internal authentication middleware
const internalAuth = createAuthMiddleware();

// Rate limiting
app.use(rateLimitMiddleware);

// API routes (protected)
app.use('/api/gift-cards', internalAuth, giftCardRoutes);
app.use('/api/transactions', internalAuth, transactionRoutes);
app.use('/api/wallets', internalAuth, walletRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logInfo(`Received ${signal}, shutting down gracefully...`);

  try {
    await disconnectDatabase();
    await disconnectRedis();
    logInfo('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logError('Error during shutdown', { error: (error as Error).message });
    process.exit(1);
  }
}

// Start server
async function main(): Promise<void> {
  try {
    logInfo('Starting REZ Gift Card Service...', {
      port: PORT,
      environment: NODE_ENV,
    });

    // Connect to MongoDB
    await connectDatabase();

    // Connect to Redis (optional)
    await connectRedis();

    // Start listening
    const server = app.listen(PORT, () => {
      logInfo(`REZ Gift Card Service started on port ${PORT}`);
      logInfo(`Environment: ${NODE_ENV}`);
      logInfo(`Health check: http://localhost:${PORT}/api/gift-cards/health`);
    });

    // Handle server errors
    server.on('error', (error: Error) => {
      logError('Server error', { error: error.message });
      process.exit(1);
    });

    // Signal handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Unhandled rejection handler
    process.on('unhandledRejection', (reason: unknown) => {
      logError('Unhandled Rejection', { reason });
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error: Error) => {
      logError('Uncaught Exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });
  } catch (error) {
    logError('Failed to start server', { error: (error as Error).message });
    process.exit(1);
  }
}

// Run the server
main();

// Export for testing
export { app };
