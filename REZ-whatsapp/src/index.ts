import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import twilio from 'twilio';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { logger } from './utils/logger';
import { createWhatsAppRoutes } from './routes/whatsapp.routes';
import { createWebhookRoutes } from './routes/webhook.routes';
import { createTemplateRoutes } from './routes/template.routes';
import { createBroadcastRoutes } from './routes/broadcast.routes';
import { SessionManager } from './services/sessionManager';
import { TemplateManager } from './services/templateManager';
import { ConversationEngine } from './services/conversationEngine';
import { CartService } from './services/cartService';
import { OrderService } from './services/orderService';
import { BroadcastService } from './services/broadcastService';

// ============================================
// Configuration
// ============================================

const CONFIG = {
  PORT: parseInt(process.env.PORT || '4202'),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // MongoDB
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-whatsapp',

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // Twilio
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  WHATSAPP_PHONE_NUMBER: process.env.WHATSAPP_PHONE_NUMBER || '',
  WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',

  // Security
  INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN || '',
  TWILIO_VERIFY_TOKEN: process.env.TWILIO_VERIFY_TOKEN || 'my_verify_token',

  // External Services
  PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL || 'http://localhost:4001',
  DELIVERY_SERVICE_URL: process.env.DELIVERY_SERVICE_URL || 'http://localhost:4009',
  USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://localhost:4013',

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100'),
};

// ============================================
// Global Variables
// ============================================

let redis: Redis;
let twilioClient: twilio.Twilio;
let sessionManager: SessionManager;
let templateManager: TemplateManager;
let conversationEngine: ConversationEngine;
let cartService: CartService;
let orderService: OrderService;
let broadcastService: BroadcastService;

// ============================================
// Application Setup
// ============================================

const app: Express = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for WhatsApp webhooks
}));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token'],
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: CONFIG.RATE_LIMIT_WINDOW_MS,
  max: CONFIG.RATE_LIMIT_MAX,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// ============================================
// Initialize Services
// ============================================

async function initializeServices(): Promise<void> {
  // Redis
  redis = new Redis(CONFIG.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  redis.on('error', (error) => {
    logger.error('Redis connection error', { error });
  });

  redis.on('connect', () => {
    logger.info('Redis connected', { url: CONFIG.REDIS_URL });
  });

  await redis.connect();

  // Twilio
  twilioClient = twilio(CONFIG.TWILIO_ACCOUNT_SID, CONFIG.TWILIO_AUTH_TOKEN);
  logger.info('Twilio client initialized');

  // Session Manager
  sessionManager = new SessionManager(redis, 24); // 24 hour sessions

  // Template Manager
  templateManager = new TemplateManager(
    twilioClient,
    CONFIG.WHATSAPP_BUSINESS_ACCOUNT_ID
  );

  // Conversation Engine
  conversationEngine = new ConversationEngine();

  // Cart Service
  cartService = new CartService();

  // Order Service
  orderService = new OrderService({
    paymentServiceUrl: CONFIG.PAYMENT_SERVICE_URL,
    deliveryServiceUrl: CONFIG.DELIVERY_SERVICE_URL,
  });

  // Broadcast Service
  broadcastService = new BroadcastService(
    twilioClient,
    CONFIG.WHATSAPP_PHONE_NUMBER,
    {
      userServiceUrl: CONFIG.USER_SERVICE_URL,
    }
  );

  logger.info('All services initialized');
}

// ============================================
// Database Connection
// ============================================

async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(CONFIG.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('MongoDB connected', { uri: CONFIG.MONGODB_URI.replace(/\/\/.*@/, '//***@') });

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error', { error });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    throw error;
  }
}

// ============================================
// Routes Setup
// ============================================

function setupRoutes(): void {
  // Health check
  app.get('/health', async (req: Request, res: Response) => {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const redisStatus = redis.status === 'ready' ? 'connected' : 'disconnected';

    res.status(200).json({
      status: 'ok',
      service: 'rez-whatsapp-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        mongodb: mongoStatus,
        redis: redisStatus,
      },
    });
  });

  // Ready check
  app.get('/ready', async (req: Request, res: Response) => {
    const isReady =
      mongoose.connection.readyState === 1 &&
      redis.status === 'ready';

    if (isReady) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not ready' });
    }
  });

  // WhatsApp API routes
  app.use(
    '/api/whatsapp',
    createWhatsAppRoutes(
      sessionManager,
      cartService,
      orderService,
      conversationEngine,
      twilioClient,
      CONFIG.WHATSAPP_PHONE_NUMBER
    )
  );

  // Webhook routes
  app.use(
    '/webhook',
    createWebhookRoutes(
      sessionManager,
      cartService,
      conversationEngine,
      orderService,
      twilioClient,
      CONFIG.WHATSAPP_PHONE_NUMBER
    )
  );

  // Template routes
  app.use('/api/templates', createTemplateRoutes(templateManager));

  // Broadcast routes
  app.use('/api/broadcast', createBroadcastRoutes(broadcastService));

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
      },
    });
  });

  // Error handler
  app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          process.env.NODE_ENV === 'production'
            ? 'An internal error occurred'
            : error.message,
      },
    });
  });

  logger.info('Routes configured');
}

// ============================================
// Scheduled Jobs
// ============================================

let scheduledJobsInterval: NodeJS.Timeout;

function startScheduledJobs(): void {
  // Process scheduled broadcasts every minute
  scheduledJobsInterval = setInterval(async () => {
    try {
      await broadcastService.processScheduledBroadcasts();
    } catch (error) {
      logger.error('Scheduled broadcast processing failed', { error });
    }
  }, 60000);

  logger.info('Scheduled jobs started');
}

// ============================================
// Graceful Shutdown
// ============================================

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new requests
  if (scheduledJobsInterval) {
    clearInterval(scheduledJobsInterval);
  }

  // Close database connections
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error closing MongoDB connection', { error });
  }

  try {
    await redis.quit();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Error closing Redis connection', { error });
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================
// Start Server
// ============================================

async function startServer(): Promise<void> {
  try {
    logger.info('Starting REZ WhatsApp Service...');
    logger.info(`Environment: ${CONFIG.NODE_ENV}`);
    logger.info(`Port: ${CONFIG.PORT}`);

    // Initialize all services
    await initializeServices();

    // Connect to database
    await connectDatabase();

    // Setup routes
    setupRoutes();

    // Start scheduled jobs
    startScheduledJobs();

    // Start HTTP server
    app.listen(CONFIG.PORT, () => {
      logger.info(`Server started on port ${CONFIG.PORT}`);
      logger.info(`Health check: http://localhost:${CONFIG.PORT}/health`);
      logger.info(`API: http://localhost:${CONFIG.PORT}/api/whatsapp`);
      logger.info(`Webhooks: http://localhost:${CONFIG.PORT}/webhook/whatsapp`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the application
startServer();

export { app };
