import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from 'redis';
import supplierRoutes from './routes/supplierRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 4063;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-supplier-marketplace';
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
const supplierSchema = new mongoose.Schema({
  supplierId: { type: String, required: true, unique: true },
  businessName: { type: String, required: true },
  ownerName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  businessType: {
    type: String,
    enum: ['manufacturer', 'wholesaler', 'distributor', 'importer', 'local_vendor'],
    required: true
  },
  categories: [String],
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: { type: String, default: 'India' }
  },
  certifications: [String],
  minimumOrder: { type: Number, default: 0 },
  paymentTerms: {
    type: String,
    enum: ['prepaid', 'cod', 'net15', 'net30', 'net60'],
    default: 'prepaid'
  },
  deliveryCapabilities: {
    localDelivery: { type: Boolean, default: false },
    regionalDelivery: { type: Boolean, default: false },
    nationalDelivery: { type: Boolean, default: false },
    minDeliveryDays: Number,
    maxDeliveryDays: Number
  },
  rating: {
    average: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 }
  },
  stats: {
    totalOrders: { type: Number, default: 0 },
    completedOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    responseRate: { type: Number, default: 100 },
    onTimeDeliveryRate: { type: Number, default: 100 }
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'active', 'suspended', 'rejected'],
    default: 'pending'
  },
  verifiedAt: Date,
  documents: [{
    type: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

supplierSchema.index({ businessName: 'text', businessType: 1 });
supplierSchema.index({ categories: 1 });
supplierSchema.index({ 'address.city': 1, status: 1 });
supplierSchema.index({ rating: -1 });

const Supplier = mongoose.model('Supplier', supplierSchema);

const productSchema = new mongoose.Schema({
  productId: { type: String, required: true, unique: true },
  supplierId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: String,
  category: { type: String, required: true, index: true },
  subcategory: String,
  sku: String,
  unit: { type: String, default: 'units' },
  moq: { type: Number, default: 1 },
  price: {
    minPrice: { type: Number, required: true },
    maxPrice: Number,
    currency: { type: String, default: 'INR' }
  },
  specifications: mongoose.Schema.Types.Mixed,
  images: [String],
  availability: {
    inStock: { type: Boolean, default: true },
    stockQuantity: { type: Number, default: 0 },
    leadTimeDays: { type: Number, default: 0 }
  },
  rating: {
    average: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'out_of_stock', 'discontinued'],
    default: 'draft'
  },
  tags: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

productSchema.index({ name: 'text', category: 1 });
productSchema.index({ supplierId: 1, status: 1 });
productSchema.index({ price: 1 });

const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  buyerId: { type: String, required: true, index: true },
  supplierId: { type: String, required: true, index: true },
  products: [{
    productId: String,
    name: String,
    quantity: Number,
    unitPrice: Number,
    totalPrice: Number
  }],
  subtotal: { type: Number, required: true },
  tax: { type: Number, default: 0 },
  deliveryFee: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'disputed'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  deliveryAddress: {
    street: String,
    city: String,
    state: String,
    postalCode: String
  },
  expectedDelivery: Date,
  actualDelivery: Date,
  notes: String,
  timeline: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    notes: String
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

orderSchema.index({ buyerId: 1, status: 1 });
orderSchema.index({ supplierId: 1, status: 1 });
orderSchema.index({ createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);

const reviewSchema = new mongoose.Schema({
  reviewId: { type: String, required: true, unique: true },
  orderId: { type: String, required: true },
  supplierId: { type: String, required: true, index: true },
  productId: String,
  buyerId: { type: String, required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: String,
  comment: String,
  pros: [String],
  cons: [String],
  isVerifiedPurchase: { type: Boolean, default: false },
  response: {
    text: String,
    respondedAt: Date
  },
  helpful: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now }
});

reviewSchema.index({ supplierId: 1, rating: -1 });
reviewSchema.index({ productId: 1 });

const Review = mongoose.model('Review', reviewSchema);

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
app.use('/api/suppliers', rateLimitMiddleware, internalAuth, supplierRoutes);
app.use('/api/products', rateLimitMiddleware, internalAuth, productRoutes);
app.use('/api/orders', rateLimitMiddleware, internalAuth, orderRoutes);
app.use('/api/reviews', rateLimitMiddleware, internalAuth, reviewRoutes);

// Health check
app.get('/api/suppliers/health', (_req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'rez-supplier-marketplace',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    service: 'REZ Supplier Marketplace',
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
      logger.info(`REZ Supplier Marketplace started on port ${PORT}`);
      logger.info(`Environment: ${NODE_ENV}`);
      logger.info(`Health check: http://localhost:${PORT}/api/suppliers/health`);
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
export { app, Supplier, Product, Order, Review };

main();
