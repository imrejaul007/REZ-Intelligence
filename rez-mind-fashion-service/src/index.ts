import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import config from './config';
import logger from './utils/logger';
import { authenticateInternal } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { rabtul } from './integrations/rabtul';

import consultRoutes from './routes/consult.routes';
import trendsRoutes from './routes/trends.routes';
import styleRoutes from './routes/style.routes';
import inventoryRoutes from './routes/inventory.routes';

const app: Application = express();

app.use(helmet());
app.use(cors({ origin: config.isProduction ? process.env.CORS_ORIGIN?.split(',') : '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req: Request, _res: Response, next: NextFunction) => { logger.debug('Request', { method: req.method, path: req.path }); next(); });

app.use(authenticateInternal);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'rez-mind-fashion-service', version: '1.0.0', timestamp: new Date().toISOString() });
});

app.get('/health/ready', async (_req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const rabtulHealth = await rabtul.healthCheck();
  res.status(mongoStatus === 'connected' ? 200 : 503).json({
    status: mongoStatus === 'connected' ? 'ready' : 'not_ready',
    dependencies: { mongodb: mongoStatus, rabtul: rabtulHealth.connected ? 'connected' : 'not_configured' },
  });
});

app.use('/api/v1/consult', consultRoutes);
app.use('/api/v1/trends', trendsRoutes);
app.use('/api/v1/style', styleRoutes);
app.use('/api/v1/inventory', inventoryRoutes);

app.get('/api', (_req: Request, res: Response) => {
  res.json({
    name: 'ReZ Fashion Mind Service', version: '1.0.0', description: 'AI intelligence for fashion businesses',
    endpoints: {
      health: ['GET /health', 'GET /health/ready'],
      consultation: ['POST /api/v1/consult', 'GET /api/v1/consult/history/:sessionId'],
      trends: ['POST /api/v1/trends/analyze', 'POST /api/v1/trends/predict', 'GET /api/v1/trends/seasonal'],
      style: ['POST /api/v1/style/match', 'GET /api/v1/style/segments'],
      inventory: ['POST /api/v1/inventory/optimize', 'POST /api/v1/inventory/forecast', 'GET /api/v1/inventory/dead-stock'],
    },
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

let server: ReturnType<Application['listen']>;
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Shutting down...`);
  server.close(async () => {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  });
};

const startServer = async () => {
  try {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(config.mongodb.uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 5000 });
    logger.info('MongoDB connected');

    server = app.listen(config.port, () => {
      logger.info(`ReZ Fashion Mind Service started on port ${config.port}`);
    });

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', { error: error instanceof Error ? error.message : 'Unknown' });
    process.exit(1);
  }
};

startServer();
export default app;