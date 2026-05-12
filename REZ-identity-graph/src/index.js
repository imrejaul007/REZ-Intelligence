'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const logger = require('../shared/logger');
const { errorHandler, asyncHandler } = require('../shared/errorHandler');

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

// Environment validation
const REQUIRED_ENV = ['MONGODB_URI', 'REDIS_URL', 'INTERNAL_SERVICE_TOKEN'];
for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    console.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// REZ Apps in the ecosystem
const APP_SOURCES = {
  REZ: 'rez',
  WASIL: 'wasil',
  HABIXO: 'habixo',
  KARMA: 'karma',
  RTMN_FINANCE: 'rtmn_finance',
  MERCHANT_OS: 'merchant_os',
  QR_SYSTEM: 'qr_system'
};

// Identity types for matching
const IDENTITY_TYPES = {
  PHONE: 'phone',
  EMAIL: 'email',
  DEVICE_FP: 'device_fingerprint',
  DEVICE_ID: 'device_id',
  WALLET_ID: 'wallet_id',
  USER_ID: 'user_id', // Native user ID from each app
  BANK_ACCOUNT: 'bank_account',
  UPI: 'upi'
};

// Confidence levels for identity matching
const CONFIDENCE_LEVELS = {
  EXACT: 1.0, // Direct match (same phone, same email)
  HIGH: 0.9, // Strong correlation (same device + similar behavior)
  MEDIUM: 0.7, // Probable match (shared attributes)
  LOW: 0.4, // Possible match (heuristics)
  INFERRED: 0.2 // Inferred but unconfirmed
};

// MongoDB Schemas
const identitySchema = new mongoose.Schema({
  // The unified ID (canonical identity)
  unifiedId: { type: String, required: true, unique: true, index: true },

  // All linked identities from various sources
  identities: [{
    source: { type: String, enum: Object.values(APP_SOURCES), required: true },
    type: { type: String, enum: Object.values(IDENTITY_TYPES), required: true },
    value: { type: String, required: true },
    confidence: { type: Number, default: 1.0 },
    verified: { type: Boolean, default: false },
    linkedAt: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now }
  }],

  // Identity graph
  linkedTo: [{
    unifiedId: { type: String, required: true },
    confidence: { type: Number, required: true },
    reason: String, // 'same_device', 'same_behavior', 'manual_link', 'family_account'
    linkedAt: { type: Date, default: Date.now }
  }],

  // Profile data (aggregated)
  profile: {
    primarySource: String,
    name: String,
    phone: String,
    email: String,
    avatar: String,
    kycStatus: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' }
  },

  // Behavior fingerprint (for device matching)
  behaviorFingerprint: {
    ipPatterns: [String],
    userAgents: [String],
    typicalHours: [Number],
    avgSessionDuration: Number,
    preferredLocations: [{
      lat: Number,
      lng: Number,
      weight: Number
    }]
  },

  // Stats
  stats: {
    totalSources: { type: Number, default: 0 },
    firstActivity: Date,
    lastActivity: Date,
    totalTransactions: { type: Number, default: 0 },
    totalSpend: { type: Number, default: 0 },
    avgOrderValue: { type: Number, default: 0 }
  },

  // Flags
  flags: {
    isTestUser: { type: Boolean, default: false },
    isBot: { type: Boolean, default: false },
    isFamilyAccount: { type: Boolean, default: false },
    mergedInto: String // If this identity was merged into another
  }
}, { timestamps: true });

identitySchema.index({ 'identities.source': 1, 'identities.value': 1 });
identitySchema.index({ 'identities.type': 1, 'identities.value': 1 });
identitySchema.index({ 'profile.phone': 1 });
identitySchema.index({ 'profile.email': 1 });
identitySchema.index({ 'linkedTo.unifiedId': 1 });

const Identity = mongoose.model('Identity', identitySchema);

// Identity resolution engine
class IdentityResolver {
  // Find existing identity by identifier
  async findByIdentifier(source, type, value) {
    return Identity.findOne({
      'identities.source': source,
      'identities.type': type,
      'identities.value': value
    });
  }

  // Find by any identifier value
  async findByValue(type, value) {
    return Identity.findOne({
      'identities.type': type,
      'identities.value': value
    });
  }

  // Find by phone (across all sources)
  async findByPhone(phone) {
    const normalized = this.normalizePhone(phone);
    return Identity.findOne({
      'identities.type': IDENTITY_TYPES.PHONE,
      'identities.value': normalized
    });
  }

  // Find by email (across all sources)
  async findByEmail(email) {
    const normalized = email.toLowerCase().trim();
    return Identity.findOne({
      'identities.type': IDENTITY_TYPES.EMAIL,
      'identities.value': normalized
    });
  }

  // Link new identity to existing unified ID
  async linkIdentity(unifiedId, source, type, value, confidence = 1.0) {
    const identity = await Identity.findOne({ unifiedId });
    if (!identity) {
      throw new Error('Unified identity not found');
    }

    // Check if already linked
    const existing = identity.identities.find(
      i => i.source === source && i.type === type && i.value === value
    );
    if (existing) {
      existing.lastSeen = new Date();
      existing.confidence = Math.max(existing.confidence, confidence);
    } else {
      identity.identities.push({
        source,
        type,
        value,
        confidence,
        linkedAt: new Date()
      });
      identity.stats.totalSources = identity.identities.length;
    }

    await identity.save();
    return identity;
  }

  // Create new unified identity
  async createIdentity(source, type, value, profile = {}) {
    const unifiedId = `uid_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

    const identity = new Identity({
      unifiedId,
      identities: [{
        source,
        type,
        value,
        confidence: 1.0,
        verified: type === IDENTITY_TYPES.PHONE || type === IDENTITY_TYPES.EMAIL
      }],
      profile: {
        primarySource: source,
        ...profile
      },
      stats: {
        totalSources: 1,
        firstActivity: new Date(),
        lastActivity: new Date()
      }
    });

    await identity.save();
    return identity;
  }

  // Resolve identity (main entry point)
  async resolve(source, type, value, options = {}) {
    const { createIfNotFound = true, profile = {}, confidence = 1.0 } = options;

    // Try to find existing
    let identity = await this.findByIdentifier(source, type, value);

    if (identity) {
      // Update last seen
      const id = identity.identities.find(
        i => i.source === source && i.type === type && i.value === value
      );
      if (id) id.lastSeen = new Date();
      await identity.save();
      return { identity, isNew: false };
    }

    // Check for probable matches based on other identifiers
    const probableMatch = await this.findProbableMatch(source, type, value);
    if (probableMatch) {
      // Link to existing identity
      await this.linkIdentity(probableMatch.unifiedId, source, type, value, confidence);
      identity = await Identity.findOne({ unifiedId: probableMatch.unifiedId });
      return { identity, isNew: false, linkedTo: probableMatch.unifiedId };
    }

    // Create new if allowed
    if (createIfNotFound) {
      identity = await this.createIdentity(source, type, value, profile);
      return { identity, isNew: true };
    }

    return { identity: null, isNew: false };
  }

  // Find probable matches using heuristics
  async findProbableMatch(source, type, value) {
    // For demo, return null. In production, implement:
    // - Device fingerprint matching
    // - IP address clustering
    // - Behavioral pattern matching
    // - Family/household linking
    return null;
  }

  // Merge two identities
  async merge(sourceId, targetId) {
    const [source, target] = await Promise.all([
      Identity.findOne({ unifiedId: sourceId }),
      Identity.findOne({ unifiedId: targetId })
    ]);

    if (!source || !target) {
      throw new Error('One or both identities not found');
    }

    // Merge identities
    for (const id of source.identities) {
      const exists = target.identities.find(
        t => t.source === id.source && t.type === id.type && t.value === id.value
      );
      if (!exists) {
        target.identities.push(id);
      }
    }

    // Merge linkedTo
    for (const link of source.linkedTo) {
      if (!target.linkedTo.find(t => t.unifiedId === link.unifiedId)) {
        target.linkedTo.push(link);
      }
    }

    // Aggregate profile (prefer verified, prefer more recent)
    if (source.profile.name && !target.profile.name) {
      target.profile.name = source.profile.name;
    }

    // Aggregate stats
    target.stats.totalTransactions += source.stats.totalTransactions;
    target.stats.totalSpend += source.stats.totalSpend;
    if (target.stats.totalTransactions > 0) {
      target.stats.avgOrderValue = target.stats.totalSpend / target.stats.totalTransactions;
    }
    if (source.stats.lastActivity > target.stats.lastActivity) {
      target.stats.lastActivity = source.stats.lastActivity;
    }

    // Mark source as merged
    source.flags.mergedInto = targetId;
    source.unifiedId = `${source.unifiedId}_MERGED`;

    await Promise.all([source.save(), target.save()]);

    return target;
  }

  normalizePhone(phone) {
    // Remove all non-digits, ensure 10 digits
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 ? `91${digits}` : digits;
  }
}

const resolver = new IdentityResolver();

// Express app
const app = express();

app.use(helmet());

// CORS - restrictive configuration
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || [];

if (isProduction && allowedOrigins.length === 0) {
  console.error('FATAL: ALLOWED_ORIGINS environment variable is required in production');
  process.exit(1);
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

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  logger.info(`${req.method} ${req.path}`, { requestId: req.requestId });
  next();
});

app.use((req, res, next) => {
  const publicPaths = ['/health', '/ready'];
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
  res.json({
    status: 'ok',
    service: 'identity-graph',
    sources: Object.values(APP_SOURCES),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready' });
  }
});

// Resolve identity - main endpoint
app.post('/api/identity/resolve', asyncHandler(async (req, res) => {
  const { source, type, value, profile, confidence } = req.body;

  if (!source || !type || !value) {
    return res.status(400).json({ error: 'source, type, and value required' });
  }

  const result = await resolver.resolve(source, type, value, {
    profile,
    confidence: confidence || 1.0
  });

  logger.info('Identity resolved', {
    requestId: req.requestId,
    source,
    type,
    isNew: result.isNew,
    unifiedId: result.identity?.unifiedId
  });

  res.json({
    success: true,
    unifiedId: result.identity?.unifiedId,
    isNew: result.isNew,
    linkedTo: result.linkedTo
  });
}));

// Get unified identity
app.get('/api/identity/:unifiedId', asyncHandler(async (req, res) => {
  const { unifiedId } = req.params;
  const { includeLinked = false } = req.query;

  const identity = await Identity.findOne({ unifiedId });

  if (!identity) {
    return res.status(404).json({ error: 'Identity not found' });
  }

  const response = {
    unifiedId: identity.unifiedId,
    identities: identity.identities.map(i => ({
      source: i.source,
      type: i.type,
      value: maskIdentifier(i.type, i.value),
      verified: i.verified,
      lastSeen: i.lastSeen
    })),
    profile: {
      name: identity.profile.name,
      phone: identity.profile.phone ? maskIdentifier('phone', identity.profile.phone) : null,
      email: identity.profile.email ? maskIdentifier('email', identity.profile.email) : null,
      kycStatus: identity.profile.kycStatus,
      riskLevel: identity.profile.riskLevel
    },
    stats: identity.stats
  };

  if (includeLinked === 'true') {
    response.linkedTo = identity.linkedTo;
  }

  res.json({ success: true, identity: response });
}));

// Find by any identifier
app.get('/api/identity/find/:type/:value', asyncHandler(async (req, res) => {
  const { type, value } = req.params;

  let identity;
  switch (type) {
    case 'phone':
      identity = await resolver.findByPhone(value);
      break;
    case 'email':
      identity = await resolver.findByEmail(value);
      break;
    default:
      identity = await resolver.findByValue(type, value);
  }

  if (!identity) {
    return res.status(404).json({ error: 'Identity not found' });
  }

  res.json({
    success: true,
    unifiedId: identity.unifiedId,
    source: identity.profile.primarySource
  });
}));

// Link new identity to existing unified ID
app.post('/api/identity/:unifiedId/link', asyncHandler(async (req, res) => {
  const { unifiedId } = req.params;
  const { source, type, value, confidence } = req.body;

  if (!source || !type || !value) {
    return res.status(400).json({ error: 'source, type, and value required' });
  }

  const identity = await resolver.linkIdentity(unifiedId, source, type, value, confidence || 0.8);

  logger.info('Identity linked', {
    requestId: req.requestId,
    unifiedId,
    source,
    type
  });

  res.json({
    success: true,
    unifiedId: identity.unifiedId,
    totalIdentities: identity.identities.length
  });
}));

// Merge two identities
app.post('/api/identity/:targetId/merge', asyncHandler(async (req, res) => {
  const { targetId } = req.params;
  const { sourceId } = req.body;

  if (!sourceId) {
    return res.status(400).json({ error: 'sourceId required' });
  }

  const merged = await resolver.merge(sourceId, targetId);

  logger.info('Identities merged', {
    requestId: req.requestId,
    sourceId,
    targetId
  });

  res.json({
    success: true,
    unifiedId: merged.unifiedId,
    totalIdentities: merged.identities.length
  });
}));

// Update profile
app.patch('/api/identity/:unifiedId/profile', asyncHandler(async (req, res) => {
  const { unifiedId } = req.params;
  const { name, phone, email, kycStatus, riskLevel } = req.body;

  const identity = await Identity.findOneAndUpdate(
    { unifiedId },
    {
      $set: {
        ...(name && { 'profile.name': name }),
        ...(phone && { 'profile.phone': phone }),
        ...(email && { 'profile.email': email }),
        ...(kycStatus && { 'profile.kycStatus': kycStatus }),
        ...(riskLevel && { 'profile.riskLevel': riskLevel })
      }
    },
    { new: true }
  );

  if (!identity) {
    return res.status(404).json({ error: 'Identity not found' });
  }

  res.json({ success: true, profile: identity.profile });
}));

// Update stats (called by other services)
app.post('/api/identity/:unifiedId/stats', asyncHandler(async (req, res) => {
  const { unifiedId } = req.params;
  const { transactionAmount, activity } = req.body;

  const update = { $set: { 'stats.lastActivity': new Date() } };

  if (transactionAmount) {
    update.$inc = { 'stats.totalTransactions': 1, 'stats.totalSpend': transactionAmount };
  }

  const identity = await Identity.findOneAndUpdate(
    { unifiedId },
    update,
    { new: true }
  );

  if (!identity) {
    return res.status(404).json({ error: 'Identity not found' });
  }

  // Recalculate avg
  if (identity.stats.totalTransactions > 0) {
    identity.stats.avgOrderValue = identity.stats.totalSpend / identity.stats.totalTransactions;
    await identity.save();
  }

  res.json({ success: true, stats: identity.stats });
}));

// Get identity graph (who is linked to whom)
app.get('/api/identity/:unifiedId/graph', asyncHandler(async (req, res) => {
  const { unifiedId } = req.params;

  const identity = await Identity.findOne({ unifiedId });

  if (!identity) {
    return res.status(404).json({ error: 'Identity not found' });
  }

  // Find all identities linked to this one
  const linked = await Identity.find({
    'linkedTo.unifiedId': unifiedId
  }).lean();

  // Find who this identity links to
  const linksTo = await Identity.find({
    unifiedId: { $in: identity.linkedTo.map(l => l.unifiedId) }
  }).lean();

  res.json({
    success: true,
    graph: {
      unifiedId: identity.unifiedId,
      totalLinked: identity.linkedTo.length,
      linkedToMe: linked.length,
      nodes: [
        { unifiedId: identity.unifiedId, type: 'self', identities: identity.identities.length },
        ...identity.linkedTo.map(l => ({
          unifiedId: l.unifiedId,
          type: 'linked_to',
          confidence: l.confidence,
          reason: l.reason
        })),
        ...linked.map(l => ({
          unifiedId: l.unifiedId,
          type: 'links_to_me',
          confidence: l.linkedTo.find(lt => lt.unifiedId === unifiedId)?.confidence
        }))
      ]
    }
  });
}));

// Analytics
app.get('/api/identity/stats', asyncHandler(async (req, res) => {
  const stats = await Identity.aggregate([
    {
      $group: {
        _id: null,
        totalIdentities: { $sum: 1 },
        avgSourcesPerIdentity: { $avg: '$stats.totalSources' },
        totalLinked: { $sum: { $size: '$linkedTo' } },
        kycVerified: {
          $sum: { $cond: [{ $eq: ['$profile.kycStatus', 'verified'] }, 1, 0] }
        }
      }
    }
  ]);

  const bySource = await Identity.aggregate([
    { $unwind: '$identities' },
    { $group: { _id: '$identities.source', count: { $sum: 1 } } }
  ]);

  res.json({
    success: true,
    stats: stats[0] || { totalIdentities: 0 },
    bySource
  });
}));

// Helper to mask sensitive identifiers
function maskIdentifier(type, value) {
  if (!value) return null;
  switch (type) {
    case 'phone':
      return value.slice(0, 2) + '****' + value.slice(-4);
    case 'email':
      const [local, domain] = value.split('@');
      return local.slice(0, 2) + '***@' + domain;
    default:
      return value.slice(0, 3) + '***';
  }
}

app.use(errorHandler);

const PORT = process.env.PORT || 4050;

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
      logger.info(`Identity Graph Service started on port ${PORT}`);
      logger.info(`Sources: ${Object.values(APP_SOURCES).join(', ')}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();
