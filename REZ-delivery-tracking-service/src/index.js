import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from 'redis';
import deliveryRoutes from './routes/deliveryRoutes.js';
import driverRoutes from './routes/driverRoutes.js';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '4144', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-delivery-tracking';
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
const deliverySchema = new mongoose.Schema({
  deliveryId: { type: String, required: true, unique: true },
  orderId: { type: String, required: true, index: true },
  driverId: { type: String, required: true, index: true },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'failed'],
    default: 'pending'
  },
  pickup: {
    address: String,
    latitude: Number,
    longitude: Number
  },
  dropoff: {
    address: String,
    latitude: Number,
    longitude: Number,
    customerName: String,
    customerPhone: String
  },
  eta: {
    estimatedMinutes: Number,
    calculatedAt: Date,
    distanceMeters: Number
  },
  currentLocation: {
    latitude: Number,
    longitude: Number,
    heading: Number,
    speed: Number,
    updatedAt: Date
  },
  timeline: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    location: {
      latitude: Number,
      longitude: Number
    },
    notes: String
  }],
  metadata: {
    estimatedDeliveryTime: Date,
    actualDeliveryTime: Date,
    proofOfDelivery: String,
    recipientSignature: String,
    photoUrl: String
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

deliverySchema.index({ status: 1, createdAt: -1 });
deliverySchema.index({ 'pickup.latitude': 1, 'pickup.longitude': 1 });
deliverySchema.index({ 'dropoff.latitude': 1, 'dropoff.longitude': 1 });

const Delivery = mongoose.model('Delivery', deliverySchema);

const driverSchema = new mongoose.Schema({
  driverId: { type: String, required: true, unique: true },
  name: String,
  phone: String,
  email: String,
  vehicle: {
    type: { type: String, enum: ['bike', 'scooter', 'car', 'van', 'truck'] },
    plateNumber: String,
    capacity: Number
  },
  status: {
    type: String,
    enum: ['available', 'busy', 'offline', 'on_break'],
    default: 'offline'
  },
  currentLocation: {
    latitude: Number,
    longitude: Number,
    heading: Number,
    speed: Number,
    updatedAt: Date
  },
  locationHistory: [{
    latitude: Number,
    longitude: Number,
    heading: Number,
    speed: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  stats: {
    totalDeliveries: { type: Number, default: 0 },
    completedToday: { type: Number, default: 0 },
    averageRating: { type: Number, default: 5 },
    totalDistanceKm: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

driverSchema.index({ status: 1 });
driverSchema.index({ 'currentLocation.latitude': 1, 'currentLocation.longitude': 1 });
driverSchema.index({ 'locationHistory.timestamp': -1 });

const Driver = mongoose.model('Driver', driverSchema);

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
app.use('/api/delivery', rateLimitMiddleware, internalAuth, deliveryRoutes);
app.use('/api/drivers', rateLimitMiddleware, internalAuth, driverRoutes);

// Health check
app.get('/api/delivery/health', (_req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'rez-delivery-tracking-service',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    service: 'REZ Delivery Tracking Service',
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

// Calculate ETA between two points
function calculateETA(pickupLat, pickupLng, dropoffLat, dropoffLng) {
  // Haversine formula for distance
  const R = 6371000; // Earth's radius in meters
  const dLat = (dropoffLat - pickupLat) * Math.PI / 180;
  const dLng = (dropoffLng - pickupLng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(pickupLat * Math.PI / 180) * Math.cos(dropoffLat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Assume average speed of 30 km/h in urban areas
  const avgSpeedKmH = 30;
  const timeHours = distance / 1000 / avgSpeedKmH;
  const estimatedMinutes = Math.ceil(timeHours * 60);

  return {
    distanceMeters: Math.round(distance),
    estimatedMinutes
  };
}

// Broadcast location update via Redis
async function broadcastLocationUpdate(driverId, location) {
  if (!redisClient) return;

  try {
    await redisClient.publish(`driver:${driverId}:location`, JSON.stringify({
      driverId,
      ...location,
      timestamp: new Date().toISOString()
    }));

    await redisClient.publish('delivery:updates', JSON.stringify({
      type: 'location_update',
      driverId,
      ...location,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    logger.error('Failed to broadcast location', { error: error.message });
  }
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
      logger.info(`REZ Delivery Tracking Service started on port ${PORT}`);
      logger.info(`Environment: ${NODE_ENV}`);
      logger.info(`Health check: http://localhost:${PORT}/api/delivery/health`);
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
export { app, Delivery, Driver, calculateETA };

main();
