import express, { json, urlencoded } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import workflowRoutes from './routes/workflowRoutes.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { createAuthMiddleware, createRateLimiter, errorHandler, notFoundHandler } from './middleware/index.js';

const app = express();
const PORT = config.server.port;

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
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration
app.use(cors({
  origin: config.allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-internal-token'],
}));

// Rate limiting
app.use('/api', createRateLimiter({ windowMs: 60 * 1000, max: 100 }));

// Body parsing with size limits
app.use(json({ limit: '1mb' }));
app.use(urlencoded({ extended: true, limit: '1mb' }));

// Auth middleware
app.use(createAuthMiddleware({
  apiKeys: config.auth.apiKeys,
  internalTokens: config.auth.internalTokens,
  bypassPaths: ['/health', '/ready', '/metrics'],
}));

// Health check endpoints
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'rez-workflow-builder', timestamp: new Date().toISOString() });
});

app.get('/ready', (_req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ status: 'ready', mongodb: mongoStatus, timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', workflowRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Connect to MongoDB
async function connectToMongoDB(): Promise<void> {
  try {
    await mongoose.connect(config.mongodb.uri);
    logger.info('Connected to MongoDB', { uri: config.mongodb.uri.replace(/\/\/.*@/, '//<credentials>@') });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error: error instanceof Error ? error.message : 'Unknown' });
    throw error;
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully`);
  await mongoose.connection.close();
  process.exit(0);
}

async function startServer(): Promise<void> {
  try {
    await connectToMongoDB();

    app.listen(PORT, () => {
      logger.info(`REZ Workflow Builder running on port ${PORT}`);
    });

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', { error: error instanceof Error ? error.message : 'Unknown' });
    process.exit(1);
  }
}

startServer();

export default app;
