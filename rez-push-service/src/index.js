const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const expressValidator = require('express-validator');

const config = require('./config');
const logger = require('./utils/logger');
const { initializeAllProviders, shutdownAllProviders } = require('./providers');
const { initializeAll, shutdownAll, queueManager, rateLimiter } = require('./queue');
const { pushRoutes, preferencesRoutes, templateRoutes, statsRoutes } = require('./routes');
const webhookRoutes = require('./routes/webhooks');

const app = express();

app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
  },
});

app.use('/api', limiter);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'rez-push-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use('/api/push', pushRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api', statsRoutes);
app.use('/webhooks', webhookRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    path: req.path,
  });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: Object.values(err.errors).map(e => e.message),
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format',
    });
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

async function connectToMongoDB() {
  try {
    const uri = `${config.mongodb.uri}/${config.mongodb.db}`;
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

async function initialize() {
  logger.info('Initializing Push Notification Service...');

  try {
    await connectToMongoDB();

    await initializeAllProviders();
    logger.info('Providers initialized');

    await initializeAll();
    logger.info('Queue system initialized');

    queueManager.processNotifications(config.queue.concurrency);
    queueManager.processBroadcast(1);

    logger.info('Push Notification Service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize service:', error);
    throw error;
  }
}

async function shutdown() {
  logger.info('Shutting down Push Notification Service...');

  try {
    await shutdownAllProviders();
    await shutdownAll();
    await mongoose.disconnect();
    logger.info('Push Notification Service shut down successfully');
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

async function start() {
  await initialize();

  const server = app.listen(config.port, () => {
    logger.info(`Push Notification Service running on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
  });

  const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    server.close(async () => {
      await shutdown();
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

start().catch((error) => {
  logger.error('Failed to start service:', error);
  process.exit(1);
});

module.exports = { app, initialize, shutdown };
