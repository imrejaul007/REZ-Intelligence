import express, { Request, Response, NextFunction } from 'express';
import { config } from './config';
import smsRoutes from './routes/sms.routes';
import winston from 'winston';
import mongoose from 'mongoose';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Initialize Express app
const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Routes
app.use('/', smsRoutes);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'REZ SMS Bridge',
    version: '1.0.0',
    description: 'Connects SMS to Orchestrator',
    endpoints: {
      health: 'GET /health',
      webhook: 'POST /webhook/sms',
      sendSms: 'POST /api/sms/send',
      sendTemplate: 'POST /api/sms/send-template',
      sendBulk: 'POST /api/sms/send-bulk',
    },
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource does not exist',
  });
});

// Database connection (optional - for audit logging)
async function connectDatabase(): Promise<void> {
  if (!config.mongodb.uri) {
    logger.info('MongoDB URI not configured, skipping database connection');
    return;
  }

  try {
    await mongoose.connect(config.mongodb.uri);
    logger.info('Connected to MongoDB');

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down gracefully...');

  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error during shutdown', { error });
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function start(): Promise<void> {
  try {
    await connectDatabase();

    app.listen(config.port, () => {
      logger.info(`REZ SMS Bridge started`, {
        port: config.port,
        environment: process.env.NODE_ENV || 'development',
        twilioConfigured: !!(config.twilio.accountSid && config.twilio.authToken),
        msg91Configured: !!config.msg91.apiKey,
        orchestratorUrl: config.orchestrator.url,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

start().catch((error) => {
  logger.error('Fatal error during startup', { error });
  process.exit(1);
});

export default app;
