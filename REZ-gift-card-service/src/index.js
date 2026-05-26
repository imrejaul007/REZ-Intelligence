import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { randomInt, randomUUID } from 'crypto';
import { createClient } from 'redis';
import giftCardRoutes from './routes/giftCardRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import walletRoutes from './routes/walletRoutes.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 4061;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-gift-card-service';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Logger setup
const logger = {
  info: (message, meta = {}) => {
    console.log(`[${new Date().toISOString()}] INFO: ${message}`, JSON.stringify(meta));
  },
  error: (message, meta = {}) => {
    console.error(`[${new Date().toISOString()}] ERROR: ${message}`, JSON.stringify(meta));
  },
  warn: (message, meta = {}) => {
    console.warn(`[${new Date().toISOString()}] WARN: ${message}`, JSON.stringify(meta));
  }
};

// Redis client
let redisClient;

async function connectRedis() {
  try {
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => logger.error('Redis error', { error: err.message }));
    await redisClient.connect();
    logger.info('Connected to Redis');
  } catch (error) {
    logger.warn('Redis connection failed, continuing without cache', { error: error.message });
  }
}

// MongoDB Schemas
const giftCardSchema = new mongoose.Schema({
  cardId: { type: String, required: true, unique: true },
  cardNumber: { type: String, required: true, unique: true },
  pin: { type: String, required: true },
  balance: { type: Number, required: true, default: 0 },
  originalValue: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: {
    type: String,
    enum: ['active', 'redeemed', 'expired', 'cancelled', 'frozen'],
    default: 'active'
  },
  type: {
    type: String,
    enum: ['physical', 'digital'],
    default: 'digital'
  },
  issuedTo: {
    customerId: String,
    email: String,
    name: String
  },
  purchasedBy: {
    customerId: String,
    email: String,
    name: String
  },
  validFrom: { type: Date, default: Date.now },
  validUntil: { type: Date },
  redeemedAt: Date,
  redemptionStore: String,
  metadata: {
    occasion: String,
    message: String,
    design: String
  },
  transactionHistory: [{
    type: { type: String, enum: ['load', 'redeem', 'refund', 'expire', 'cancel'] },
    amount: Number,
    balanceAfter: Number,
    transactionId: String,
    timestamp: { type: Date, default: Date.now },
    notes: String
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

giftCardSchema.index({ status: 1, validUntil: 1 });
giftCardSchema.index({ 'issuedTo.customerId': 1 });
giftCardSchema.index({ 'purchasedBy.customerId': 1 });
giftCardSchema.index({ cardNumber: 1 }, { unique: true });

const GiftCard = mongoose.model('GiftCard', giftCardSchema);

const walletSchema = new mongoose.Schema({
  walletId: { type: String, required: true, unique: true },
  customerId: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
  currency: { type: String, default: 'INR' },
  giftCardBalances: {
    type: Map,
    of: Number,
    default: {}
  },
  totalGiftCards: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['active', 'suspended', 'closed'],
    default: 'active'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

walletSchema.index({ customerId: 1 }, { unique: true });

const Wallet = mongoose.model('Wallet', walletSchema);

const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  type: {
    type: String,
    enum: ['purchase', 'redeem', 'refund', 'transfer', 'load', 'expire'],
    required: true
  },
  giftCardId: String,
  walletId: String,
  amount: { type: Number, required: true },
  balanceBefore: { type: Number },
  balanceAfter: { type: Number },
  currency: { type: String, default: 'INR' },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'completed'
  },
  paymentMethod: {
    type: { type: String, enum: ['card', 'upi', 'netbanking', 'wallet', 'cash'] },
    transactionRef: String
  },
  metadata: {
    orderId: String,
    storeId: String,
    storeName: String,
    customerId: String,
    recipientEmail: String,
    message: String
  },
  createdAt: { type: Date, default: Date.now }
});

transactionSchema.index({ giftCardId: 1 });
transactionSchema.index({ walletId: 1 });
transactionSchema.index({ customerId: 1 });
transactionSchema.index({ createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

// Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// Auth middleware
function internalAuth(req, res, next) {
  const token = req.headers['x-internal-token'];

  if (!token) {
    logger.warn('Missing internal token', { path: req.path });
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Missing X-Internal-Token header'
    });
  }

  if (token === process.env.INTERNAL_SERVICE_TOKEN) {
    next();
  } else {
    logger.warn('Invalid internal token', { path: req.path });
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid X-Internal-Token'
    });
  }
}

// Rate limiting
const rateLimitMap = new Map();
function rateLimitMiddleware(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const windowMs = 60000;
  const maxRequests = 100;

  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    next();
    return;
  }

  const record = rateLimitMap.get(key);

  if (now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    next();
    return;
  }

  if (record.count >= maxRequests) {
    return res.status(429).json({
      success: false,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded'
    });
  }

  record.count++;
  next();
}

// API routes
app.use('/api/gift-cards', rateLimitMiddleware, internalAuth, giftCardRoutes);
app.use('/api/transactions', rateLimitMiddleware, internalAuth, transactionRoutes);
app.use('/api/wallets', rateLimitMiddleware, internalAuth, walletRoutes);

// Health check
app.get('/api/gift-cards/health', (_req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'rez-gift-card-service',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    service: 'REZ Gift Card Service',
    version: '1.0.0',
    status: 'running',
    port: PORT
  });
});

// Error handler
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });

  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
});

// Generate gift card number
function generateCardNumber() {
  const prefix = process.env.GIFT_CARD_PREFIX || 'GC';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`.substring(0, 16);
}

// Generate PIN
function generatePIN() {
  return randomInt(1000, 9999).toString();
}

// Graceful shutdown
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');

    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }

    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
}

// Start server
async function main() {
  try {
    logger.info('Connecting to MongoDB...', { uri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@') });

    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    logger.info('Connected to MongoDB successfully');

    await connectRedis();

    app.listen(PORT, () => {
      logger.info(`REZ Gift Card Service started on port ${PORT}`);
      logger.info(`Environment: ${NODE_ENV}`);
      logger.info(`Health check: http://localhost:${PORT}/api/gift-cards/health`);
    });

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Export for testing
export { app, GiftCard, Wallet, Transaction };

main();
