import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from 'redis';
import locationRoutes from './routes/locationRoutes.js';
import franchiseRoutes from './routes/franchiseRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 4062;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-multi-location';
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
const franchiseSchema = new mongoose.Schema({
  franchiseId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  ownerId: { type: String, required: true, index: true },
  businessType: { type: String, enum: ['restaurant', 'retail', 'hospitality', 'services'], default: 'retail' },
  branding: {
    logo: String,
    primaryColor: String,
    secondaryColor: String,
    tagline: String
  },
  contact: {
    email: String,
    phone: String,
    website: String
  },
  billing: {
    taxId: String,
    paymentTerms: { type: String, enum: ['prepaid', 'postpaid'], default: 'prepaid' }
  },
  settings: {
    timezone: { type: String, default: 'Asia/Kolkata' },
    currency: { type: String, default: 'INR' },
    operatingHours: mongoose.Schema.Types.Mixed,
    features: [String]
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'closed'],
    default: 'active'
  },
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

franchiseSchema.index({ ownerId: 1, status: 1 });
franchiseSchema.index({ businessType: 1 });

const Franchise = mongoose.model('Franchise', franchiseSchema);

const locationSchema = new mongoose.Schema({
  locationId: { type: String, required: true, unique: true },
  franchiseId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  code: { type: String, required: true },
  type: { type: String, enum: ['store', 'warehouse', 'headquarters', 'popup'], default: 'store' },
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: { type: String, default: 'India' },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  contact: {
    managerName: String,
    phone: String,
    email: String
  },
  operatingHours: {
    monday: { open: String, close: String, closed: { type: Boolean, default: false } },
    tuesday: { open: String, close: String, closed: { type: Boolean, default: false } },
    wednesday: { open: String, close: String, closed: { type: Boolean, default: false } },
    thursday: { open: String, close: String, closed: { type: Boolean, default: false } },
    friday: { open: String, close: String, closed: { type: Boolean, default: false } },
    saturday: { open: String, close: String, closed: { type: Boolean, default: false } },
    sunday: { open: String, close: String, closed: { type: Boolean, default: false } }
  },
  capacity: {
    seating: Number,
    staff: Number,
    parking: Number
  },
  amenities: [String],
  status: {
    type: String,
    enum: ['active', 'inactive', 'temporary_closed', 'renovating'],
    default: 'active'
  },
  settings: {
    allowPickup: { type: Boolean, default: true },
    allowDelivery: { type: Boolean, default: true },
    minOrderValue: Number,
    deliveryRadius: Number
  },
  stats: {
    totalOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

locationSchema.index({ franchiseId: 1, status: 1 });
locationSchema.index({ 'address.city': 1 });
locationSchema.index({ 'address.coordinates.latitude': 1, 'address.coordinates.longitude': 1 });

const Location = mongoose.model('Location', locationSchema);

const locationInventorySchema = new mongoose.Schema({
  inventoryId: { type: String, required: true, unique: true },
  locationId: { type: String, required: true, index: true },
  productId: { type: String, required: true, index: true },
  franchiseId: { type: String, required: true, index: true },
  quantity: { type: Number, default: 0 },
  minQuantity: { type: Number, default: 0 },
  maxQuantity: Number,
  reorderPoint: Number,
  reorderQuantity: Number,
  unit: { type: String, default: 'units' },
  status: {
    type: String,
    enum: ['in_stock', 'low_stock', 'out_of_stock', 'discontinued'],
    default: 'in_stock'
  },
  lastRestocked: Date,
  lastSold: Date,
  movementHistory: [{
    type: { type: String, enum: ['restock', 'sale', 'adjustment', 'transfer', 'damaged'] },
    quantity: Number,
    previousQuantity: Number,
    newQuantity: Number,
    reference: String,
    notes: String,
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

locationInventorySchema.index({ locationId: 1, productId: 1 }, { unique: true });
locationInventorySchema.index({ status: 1 });
locationInventorySchema.index({ quantity: 1 });

const LocationInventory = mongoose.model('LocationInventory', locationInventorySchema);

const transferSchema = new mongoose.Schema({
  transferId: { type: String, required: true, unique: true },
  fromLocationId: { type: String, required: true },
  toLocationId: { type: String, required: true },
  franchiseId: { type: String, required: true },
  items: [{
    productId: String,
    productName: String,
    quantity: Number
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'in_transit', 'delivered', 'cancelled'],
    default: 'pending'
  },
  initiatedBy: String,
  approvedBy: String,
  notes: String,
  expectedDelivery: Date,
  actualDelivery: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

transferSchema.index({ fromLocationId: 1, status: 1 });
transferSchema.index({ toLocationId: 1, status: 1 });

const Transfer = mongoose.model('Transfer', transferSchema);

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
app.use('/api/locations', rateLimitMiddleware, internalAuth, locationRoutes);
app.use('/api/franchises', rateLimitMiddleware, internalAuth, franchiseRoutes);
app.use('/api/inventory', rateLimitMiddleware, internalAuth, inventoryRoutes);
app.use('/api/analytics', rateLimitMiddleware, internalAuth, analyticsRoutes);

// Health check
app.get('/api/locations/health', (_req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'rez-multi-location-service',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    service: 'REZ Multi-location Service',
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
      logger.info(`REZ Multi-location Service started on port ${PORT}`);
      logger.info(`Environment: ${NODE_ENV}`);
      logger.info(`Health check: http://localhost:${PORT}/api/locations/health`);
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
export { app, Franchise, Location, LocationInventory, Transfer };

main();
