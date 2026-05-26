import express, { json, urlencoded } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import apiRoutes from './routes/apiRoutes.js';
import { logger } from './utils/logger.js';
import { createAuthMiddleware } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '4175', 10);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rezops-ai';

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
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,https://rez.money').split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-internal-token'],
}));

// Rate limiting
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Body parsing with size limits
app.use(json({ limit: '1mb' }));
app.use(urlencoded({ extended: true, limit: '1mb' }));

// Auth middleware
const apiKeys = (process.env.API_KEYS || '').split(',').filter(Boolean);
const internalTokens = (process.env.INTERNAL_TOKENS || '').split(',').filter(Boolean);
app.use(createAuthMiddleware({
  apiKeys,
  internalTokens,
  bypassPaths: ['/health', '/ready', '/webhook/whatsapp'],
}));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'rezops-ai',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', (_req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ status: 'ready', mongodb: mongoStatus, timestamp: new Date().toISOString() });
});

app.use('/api', apiRoutes);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// MongoDB connection
async function connectToMongoDB(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB', { uri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@') });
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
      logger.info(`RezOps AI running on port ${PORT}`);
      logger.info(`Health: http://localhost:${PORT}/health`);
      logger.info(`API: http://localhost:${PORT}/api`);
      logger.info('');
      logger.info('=== RezOps AI Features ===');
      logger.info('• WhatsApp AI Assistant');
      logger.info('• Customer Memory');
      logger.info('• Workflow Automation');
      logger.info('• Booking Management');
      logger.info('• Human Approval System');
      logger.info('• Merchant Dashboard');
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
