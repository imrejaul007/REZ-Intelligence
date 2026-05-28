import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { logInfo, logError } from './services/logger.js';
import { connectDatabase, disconnectDatabase } from './services/database.js';
import { requestLoggingMiddleware, errorHandler, notFoundHandler } from './middleware/index.js';
import { createAuthMiddleware } from '@rez/security-middleware';

import staffRoutes from './routes/staffRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import shiftRoutes from './routes/shiftRoutes.js';

const PORT = parseInt(process.env.PORT || '4067', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create Express app
const app: Express = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Body parsing
app.use(express.json());

// Request logging
app.use(requestLoggingMiddleware);

// Internal authentication middleware
const internalAuth = createAuthMiddleware() as unknown as express.RequestHandler;

// Health check endpoint (public)
app.get('/api/staff/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'rez-staff-scheduling-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'REZ Staff Scheduling Service',
    version: '1.0.0',
    status: 'running',
    port: PORT,
    documentation: '/api/staff/health',
  });
});

// API routes (protected)
app.use('/api/staff', internalAuth, staffRoutes);
app.use('/api/schedules', internalAuth, scheduleRoutes);
app.use('/api/shifts', internalAuth, shiftRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logInfo(`Received ${signal}, shutting down gracefully...`);

  try {
    await disconnectDatabase();
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
    logInfo('Starting REZ Staff Scheduling Service...', {
      port: PORT,
      environment: NODE_ENV,
    });

    // Connect to MongoDB
    await connectDatabase();

    // Start listening
    const server = app.listen(PORT, () => {
      logInfo(`REZ Staff Scheduling Service started on port ${PORT}`);
      logInfo(`Environment: ${NODE_ENV}`);
      logInfo(`Health check: http://localhost:${PORT}/api/staff/health`);
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
