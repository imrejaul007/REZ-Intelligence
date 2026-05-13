import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { salonRouter } from './routes/salon.routes';
import { logger } from './services/salonExpert';
import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const app: Express = express();
const PORT = process.env.PORT || 3005;

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-salon-expert',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
  });
});

// Detailed health check with dependencies
app.get('/health/detailed', async (req: Request, res: Response) => {
  const healthData = {
    status: 'healthy',
    service: 'rez-salon-expert',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    dependencies: {},
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  };

  res.json(healthData);
});

// Kubernetes readiness probe
app.get('/health/ready', (req: Request, res: Response) => {
  const checks = {
    initialized: true,
  };

  const isReady = checks.initialized;

  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    checks,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1/salon', salonRouter);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    }
  });
});

const startServer = async (): Promise<void> => {
  try {
    logger.info('REZ Salon Expert starting...');

    app.listen(PORT, () => {
      logger.info(`REZ Salon Expert started on port ${PORT}`, {
        port: PORT,
        env: process.env.NODE_ENV || 'development'
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

export { app, startServer };
