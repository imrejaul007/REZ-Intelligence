'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const logger = {
  info: (msg, data) => console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', msg, ...data })),
  error: (msg, data) => console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', msg, ...data }))
};

// Timing-safe string comparison to prevent timing attacks
function timingSafeEqual(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// Identity services to query
const IDENTITY_SERVICES = {
  'identity-graph': process.env.IDENTITY_GRAPH_URL || 'http://localhost:4050',
  'consumer-graph': process.env.CONSUMER_GRAPH_URL || 'http://localhost:3006',
  'cdp': process.env.CDP_URL || 'http://localhost:3005'
};

// MongoDB Schema
const unifiedIdentitySchema = new mongoose.Schema({
  unifiedId: { type: String, required: true, unique: true, index: true },
  primaryIdentifier: { type: String, enum: ['phone', 'email'], required: true },
  primaryValue: String,

  // Linked accounts
  linkedAccounts: [{
    appId: String,
    userId: String,
    identifiers: mongoose.Schema.Types.Mixed,
    linkedAt: { type: Date, default: Date.now },
    confidence: { type: Number, default: 1 }
  }],

  // Aggregated profile
  profile: {
    phone: String,
    email: String,
    name: String,
    devices: [String],
    preferences: mongoose.Schema.Types.Mixed
  },

  // Stats
  stats: {
    totalApps: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    totalSpend: { type: Number, default: 0 },
    firstSeen: Date,
    lastSeen: Date
  },

  // Status
  status: { type: String, enum: ['active', 'merged', 'flagged'], default: 'active' },

  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

unifiedIdentitySchema.index({ 'linkedAccounts.appId': 1, 'linkedAccounts.userId': 1 });
unifiedIdentitySchema.index({ 'profile.phone': 1 });
unifiedIdentitySchema.index({ 'profile.email': 1 });

const UnifiedIdentity = mongoose.model('UnifiedIdentity', unifiedIdentitySchema);

// Express app
const app = express();
app.use(helmet());

// CORS - restrictive configuration
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || [];

if (isProduction && allowedOrigins.length === 0) {
  throw new Error('ALLOWED_ORIGINS environment variable is required in production');
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (!isProduction && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Origin not allowed by CORS policy'));
  },
  credentials: true
}));

app.use(express.json({ limit: '100kb' }));

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  next();
});

app.use((req, res, next) => {
  const publicPaths = ['/health', '/ready', '/resolve'];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();
  const token = req.headers['x-internal-token'];
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;

  // Use timing-safe comparison to prevent timing attacks
  if (!token || !expectedToken || !timingSafeEqual(token, expectedToken)) {
    logger.warn('Unauthorized access attempt', { path: req.path, ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'identity-bridge', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ error: 'Not ready' });
  }
});

// Resolve identity - query all services and consolidate
app.post('/resolve', async (req, res) => {
  try {
    const { phone, email, deviceId, appId, sourceUserId } = req.body;

    // Validate input - at least one identifier required
    if (!phone && !email && !deviceId) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'MISSING_IDENTIFIER',
        message: 'At least one of phone, email, or deviceId is required'
      });
    }

    // Validate phone format (5-15 digits)
    if (phone && !/^\d{5,15}$/.test(phone)) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'INVALID_PHONE',
        message: 'Phone must be 5-15 digits'
      });
    }

    // Validate email format
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'INVALID_EMAIL',
        message: 'Invalid email format'
      });
    }

    // Validate appId if provided
    if (appId && (typeof appId !== 'string' || appId.length > 50)) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'INVALID_APP_ID',
        message: 'Invalid appId'
      });
    }

    // Query all identity services
    const results = await Promise.allSettled([
      queryService('identity-graph', '/api/identity/resolve', { phone, email }),
      queryService('consumer-graph', '/api/resolve', { phone, email, deviceId }),
      queryService('cdp', '/api/identity/resolve', { phone, email })
    ]);

    // Extract successful results
    const identities = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
      .filter(r => r && (r.userId || r.unifiedId || r.profile));

    if (identities.length === 0) {
      // Create new unified identity
      const unifiedId = `uid_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
      const primaryIdentifier = phone ? 'phone' : 'email';
      const primaryValue = phone || email;

      const identity = await UnifiedIdentity.create({
        unifiedId,
        primaryIdentifier,
        primaryValue,
        profile: { phone, email, devices: deviceId ? [deviceId] : [] },
        stats: { firstSeen: new Date(), lastSeen: new Date() }
      });

      // Link the source account
      if (appId && sourceUserId) {
        identity.linkedAccounts.push({
          appId,
          userId: sourceUserId,
          identifiers: { phone, email, deviceId },
          confidence: 1
        });
        identity.stats.totalApps = 1;
        await identity.save();
      }

      return res.json({
        unifiedId: identity.unifiedId,
        confidence: 1,
        source: 'new',
        linkedAccounts: identity.linkedAccounts,
        profile: identity.profile
      });
    }

    // Merge existing identities
    const primary = identities[0];
    const unifiedId = primary.unifiedId || primary.userId || `uid_${uuidv4().substring(0, 12)}`;

    // Check if we have this in our database
    let identity = await UnifiedIdentity.findOne({ unifiedId });

    if (!identity) {
      identity = await UnifiedIdentity.create({
        unifiedId,
        primaryIdentifier: phone ? 'phone' : 'email',
        primaryValue: phone || email,
        profile: primary.profile || { phone, email },
        linkedAccounts: [],
        stats: { firstSeen: new Date(), lastSeen: new Date() }
      });
    }

    // Link new account
    if (appId && sourceUserId) {
      const exists = identity.linkedAccounts.some(a => a.appId === appId && a.userId === sourceUserId);
      if (!exists) {
        identity.linkedAccounts.push({
          appId,
          userId: sourceUserId,
          identifiers: { phone, email, deviceId },
          confidence: 0.9
        });
        identity.stats.totalApps = identity.linkedAccounts.length;
      }
    }

    // Update profile with latest data
    if (primary.profile) {
      identity.profile = { ...identity.profile.toObject(), ...primary.profile };
    }
    identity.stats.lastSeen = new Date();
    await identity.save();

    res.json({
      unifiedId: identity.unifiedId,
      confidence: 0.95,
      source: 'resolved',
      linkedAccounts: identity.linkedAccounts,
      profile: identity.profile
    });
  } catch (err) {
    logger.error('Resolve failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Get unified profile
app.get('/:unifiedId', async (req, res) => {
  try {
    const { unifiedId } = req.params;

    const identity = await UnifiedIdentity.findOne({ unifiedId });

    if (!identity) {
      return res.status(404).json({ error: 'Identity not found' });
    }

    res.json({
      unifiedId: identity.unifiedId,
      profile: identity.profile,
      linkedAccounts: identity.linkedAccounts,
      stats: identity.stats,
      status: identity.status
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Link accounts
app.post('/:unifiedId/link', async (req, res) => {
  try {
    const { unifiedId } = req.params;
    const { appId, userId, identifiers = {} } = req.body;

    const identity = await UnifiedIdentity.findOne({ unifiedId });

    if (!identity) {
      return res.status(404).json({ error: 'Identity not found' });
    }

    const exists = identity.linkedAccounts.some(a => a.appId === appId && a.userId === userId);
    if (!exists) {
      identity.linkedAccounts.push({
        appId,
        userId,
        identifiers,
        confidence: 1
      });
      identity.stats.totalApps = identity.linkedAccounts.length;
      await identity.save();
    }

    res.json({ success: true, linkedAccounts: identity.linkedAccounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all identities (for debugging)
app.get('/', async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const identities = await UnifiedIdentity.find()
      .sort({ 'stats.lastSeen': -1 })
      .limit(parseInt(limit));

    res.json({
      count: identities.length,
      identities: identities.map(i => ({
        unifiedId: i.unifiedId,
        apps: i.linkedAccounts.length,
        profile: { phone: i.profile.phone, email: i.profile.email }
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Query external identity service
async function queryService(name, path, data) {
  const baseUrl = IDENTITY_SERVICES[name];
  if (!baseUrl) return null;

  try {
    const response = await axios.post(`${baseUrl}${path}`, data, {
      timeout: 3000,
      headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN }
    });
    return response.data;
  } catch (err) {
    logger.warn(`Service ${name} query failed`, { error: err.message });
    return null;
  }
}

const PORT = process.env.PORT || 4092;

async function start() {
  try {
    // Connect with write concern and retry settings for production durability
    await mongoose.connect(process.env.MONGODB_URI, {
      w: 'majority',              // Wait for majority acknowledgment
      journal: true,              // Ensure journal is written
      retryWrites: true,          // Retry failed writes
      retryReads: true,           // Retry failed reads
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info('Connected to MongoDB with write concern: majority');
    app.listen(PORT, () => {
      console.log(`Identity Bridge running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();
