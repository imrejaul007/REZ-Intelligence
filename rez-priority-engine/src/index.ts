import express, { Express } from 'express';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { logger } from './utils/logger.js';
import { priorityRoutes } from './routes';
import { priorityResolver } from './services/priorityResolver';
import { errorHandler, notFoundHandler, requestIdMiddleware, loggingMiddleware } from './middleware';
import {
  createEmergencyRules,
} from './rules/emergencyRules';
import {
  createPaymentRules,
} from './rules/paymentRules';
import {
  createDomainRules,
} from './rules/domainRules';
import { PriorityRule } from './models';

let redisClient: Redis | null = null;

async function connectToMongoDB(): Promise<void> {
  const mongoUri = config.mongodb.uri;

  logger.info('Connecting to MongoDB...', { uri: mongoUri.replace(/\/\/.*@/, '//<credentials>@') });

  try {
    await mongoose.connect(mongoUri, config.mongodb.options);

    logger.info('MongoDB connected successfully', {
      host: mongoose.connection.host,
      database: mongoose.connection.name,
    });

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error', { error: error.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function connectToRedis(): Promise<Redis> {
  const redisUrl = config.redis.url;

  logger.info('Connecting to Redis...', { url: redisUrl });

  redisClient = new Redis(redisUrl, {
    keyPrefix: config.redis.keyPrefix,
    retryStrategy: (times) => {
      if (times > 3) {
        logger.error('Redis connection failed after 3 retries');
        return null;
      }
      return Math.min(times * 100, 3000);
    },
    maxRetriesPerRequest: 3,
  });

  redisClient.on('connect', () => {
    logger.info('Redis connected successfully');
  });

  redisClient.on('error', (error) => {
    logger.error('Redis connection error', { error: error.message });
  });

  redisClient.on('close', () => {
    logger.warn('Redis connection closed');
  });

  priorityResolver.setRedisClient(redisClient);

  return redisClient;
}

async function seedDefaultRules(): Promise<void> {
  try {
    const existingCount = await PriorityRule.countDocuments();

    if (existingCount > 0) {
      logger.info('Default rules already exist', { count: existingCount });
      return;
    }

    logger.info('Seeding default priority rules...');

    const emergencyRules = createEmergencyRules();
    const paymentRules = createPaymentRules();
    const domainRules = createDomainRules();

    const allRules = [...emergencyRules, ...paymentRules, ...domainRules];

    const insertedRules = await PriorityRule.insertMany(allRules);

    logger.info('Default rules seeded successfully', { count: insertedRules.length });
  } catch (error) {
    logger.error('Failed to seed default rules', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function createApp(): Express {
  const app = express();

  app.use(helmet());

  app.use(
    cors({
      origin: config.nodeEnv === 'production' ? false : '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Internal-Token',
        'X-Service-Id',
        'X-Request-Id',
      ],
      exposedHeaders: ['X-Request-ID'],
    })
  );

  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api', limiter);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(requestIdMiddleware);
  app.use(loggingMiddleware);

  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'priority-engine',
      version: '1.0.0',
      uptime: process.uptime(),
    });
  });

  app.use('/api/v1', priorityRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

async function startServer(): Promise<void> {
  try {
    logger.info('Starting Priority Engine Service...', {
      nodeEnv: config.nodeEnv,
      port: config.port,
    });

    await connectToMongoDB();

    await connectToRedis();

    await seedDefaultRules();

    const app = createApp();

    const server = app.listen(config.port, () => {
      logger.info(`Priority Engine listening on port ${config.port}`, {
        nodeEnv: config.nodeEnv,
        port: config.port,
        nodeVersion: process.version,
        pid: process.pid,
      });
    });

    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          if (redisClient) {
            await redisClient.quit();
            logger.info('Redis connection closed');
          }

          await mongoose.connection.close();
          logger.info('MongoDB connection closed');

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          process.exit(1);
        }
      });

      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        promise: String(promise),
      });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

startServer();

export { createApp, connectToMongoDB, connectToRedis };
