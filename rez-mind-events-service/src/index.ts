import express, { Express, Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler, requestId, requestLogger } from './middleware/errorHandler';
import { globalLimiter, aiConsultationLimiter, readLimiter } from './middleware/rateLimit';
import { internalAuth } from './middleware/auth';
import { rabtulPlatform } from './integrations/rabtul';

import consultRoutes from './routes/consult.routes';
import pricingRoutes from './routes/pricing.routes';
import vendorRoutes from './routes/vendor.routes';
import marketingRoutes from './routes/marketing.routes';

const app: Express = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token', 'X-Request-Id'],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestId);
app.use(requestLogger);

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'rez-mind-events-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/health/ready', async (req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'up' : 'down';
  const rabtulStatus = await rabtulPlatform.healthCheck().then(r => r.status);
  const isReady = mongoStatus === 'up';
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    service: 'rez-mind-events-service',
    timestamp: new Date().toISOString(),
    dependencies: { mongodb: mongoStatus, rabtulPlatform: rabtulStatus },
  });
});

app.get('/health/detailed', async (req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'up' : 'down';
  const rabtulHealth = await rabtulPlatform.healthCheck();
  const memoryUsage = process.memoryUsage();
  res.status(200).json({
    status: 'healthy',
    service: 'rez-mind-events-service',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dependencies: { mongodb: { status: mongoStatus, readyState: mongoose.connection.readyState }, rabtulPlatform: rabtulHealth },
    memory: { heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), rss: Math.round(memoryUsage.rss / 1024 / 1024), external: Math.round(memoryUsage.external / 1024 / 1024) },
    environment: config.nodeEnv,
  });
});

app.use(globalLimiter);
app.use('/api/consult', internalAuth, aiConsultationLimiter, consultRoutes);
app.use('/api/pricing', internalAuth, readLimiter, pricingRoutes);
app.use('/api/vendor', internalAuth, readLimiter, vendorRoutes);
app.use('/api/marketing', internalAuth, readLimiter, marketingRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  if (server) server.close(() => logger.info('HTTP server closed'));
  try { await mongoose.connection.close(); logger.info('MongoDB connection closed'); } catch (error) { logger.error('Error closing MongoDB', { error }); }
  await new Promise(resolve => setTimeout(resolve, 5000));
  logger.info('Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => { logger.error('Uncaught exception', { error }); gracefulShutdown('uncaughtException'); });
process.on('unhandledRejection', (reason, promise) => { logger.error('Unhandled rejection', { reason, promise }); });

async function connectToDatabase(): Promise<void> {
  try {
    logger.info('Connecting to MongoDB...', { uri: config.mongodbUri.replace(/\/\/.*@/, '//<credentials>@') });
    await mongoose.connect(config.mongodbUri, { maxPoolSize: 10, serverSelectionTimeoutMS: 5000, socketTimeoutMS: 45000 });
    logger.info('MongoDB connected successfully');
    mongoose.connection.on('error', (error) => logger.error('MongoDB error', { error }));
    mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
    mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    throw error;
  }
}

let server: ReturnType<Express['listen']> | undefined;

async function startServer(): Promise<void> {
  try {
    await connectToDatabase();
    const { port } = config;
    server = app.listen(port, () => {
      logger.info(`ReZ Mind Events Service started on port ${port}`, { env: config.nodeEnv, nodeVersion: process.version, pid: process.pid });
      logger.info('Endpoints:', {
        health: `GET http://localhost:${port}/health`,
        consult: `POST http://localhost:${port}/api/consult`,
        pricing: `GET/POSTh http://localhost:${port}/api/pricing/:eventId`,
        vendor: `GET http://localhost:${port}/api/vendor/:eventId/matches`,
        marketing: `POST http://localhost:${port}/api/marketing/:eventId/campaign`,
      });
    });
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') { logger.error(`Port ${port} is already in use`); process.exit(1); }
      throw error;
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();
export default app;