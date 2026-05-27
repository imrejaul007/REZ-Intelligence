import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer, Server as HTTPServer } from 'http';
import { config } from 'dotenv';
import { logger } from './utils/logger.js';
import { initializeFirebase } from './config/firebase';
import { webSocketService } from './services/websocketService';
import appRoutes from './routes/app.routes';
import { requestLogger } from './middleware/auth.js';

// Load environment variables
config();

// Initialize Express app
const app: Express = express();
const httpServer: HTTPServer = createServer(app);

// Get port from environment
const PORT = parseInt(process.env.PORT || '4089', 10);

// Trust proxy for accurate IP addresses behind load balancers
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API-only service
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Internal-Token', 'X-Service-Name'],
  credentials: true,
}));

// Compression middleware
app.use(compression());

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging
app.use(requestLogger);

// Routes
app.use('/', appRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'REZ App Bridge',
    version: '1.0.0',
    description: 'Connect REZ Consumer App to Orchestrator',
    endpoints: {
      health: 'GET /health',
      message: 'POST /api/message',
      push: 'POST /api/push',
      deviceRegister: 'POST /api/device/register',
      deviceUnregister: 'DELETE /api/device/unregister',
      notification: 'POST /api/notification',
      topicSubscribe: 'POST /api/topic/subscribe',
      topicUnsubscribe: 'POST /api/topic/unsubscribe',
      context: 'GET /api/context/:userId',
      websocket: '/socket.io',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
});

// Initialize services
async function initializeServices(): Promise<void> {
  try {
    // Initialize Firebase Admin SDK
    logger.info('Initializing Firebase Admin SDK...');
    initializeFirebase();
  } catch (error) {
    logger.warn('Firebase initialization failed, push notifications will be disabled', { error });
  }

  // Initialize WebSocket server
  logger.info('Initializing WebSocket server...');
  webSocketService.initialize(httpServer);
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  // Close WebSocket connections
  const io = webSocketService.getIO();
  if (io) {
    io.close(() => {
      logger.info('WebSocket server closed');
    });
  }

  // Give time for cleanup
  await new Promise(resolve => setTimeout(resolve, 5000));

  logger.info('Graceful shutdown complete');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});

// Start server
async function start(): Promise<void> {
  try {
    await initializeServices();

    httpServer.listen(PORT, () => {
      logger.info(`REZ App Bridge started successfully`);
      logger.info(`Server listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Orchestrator URL: ${process.env.ORCHESTRATOR_URL}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

start();

export { app, httpServer };
