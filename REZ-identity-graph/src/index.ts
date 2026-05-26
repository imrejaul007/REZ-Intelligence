/**
 * REZ Identity Graph Service - TypeScript Migration
 *
 * Service for unified user identity management across all REZ apps.
 * Links user identities from different sources into a single unified profile.
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import mongoose, { Schema, Model } from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

import {
  APP_SOURCES,
  AppSource,
  IDENTITY_TYPES,
  IdentityType,
  IdentityRecord,
  LinkedIdentity,
  UserProfile,
  BehaviorFingerprint,
  IIdentity,
  IdentityResolveResponse,
  IdentityDetailResponse,
  IdentityGraphResponse,
  GraphNode,
  PlatformStats,
  StatsBySource
} from './types.js';
import { AppError, NotFoundError, ValidationError, AuthenticationError } from './utils/errors.js';
import {
  resolveIdentitySchema,
  linkIdentitySchema,
  mergeIdentitySchema,
  updateProfileSchema,
  updateStatsSchema,
  validate
} from './schemas.js';

// ============================================
// LOGGING SETUP
// ============================================

const SERVICE_NAME = process.env['SERVICE_NAME'] || 'rez-identity-graph';
const NODE_ENV = process.env['NODE_ENV'] || 'development';
const LOG_LEVEL = process.env['LOG_LEVEL'] || 'info';

const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const prettyFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} ${level} [${SERVICE_NAME}]: ${message} ${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: NODE_ENV === 'production' ? structuredFormat : prettyFormat,
  defaultMeta: { service: SERVICE_NAME },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    })
  ]
});

// ============================================
// ENVIRONMENT VALIDATION
// ============================================

const REQUIRED_ENV = ['MONGODB_URI', 'REDIS_URL', 'INTERNAL_SERVICE_TOKEN'] as const;

for (const env of REQUIRED_ENV) {
  if (!process.env[env]) {
    logger.error(`FATAL: ${env} is required`);
    process.exit(1);
  }
}

// ============================================
// MONGOOSE SCHEMAS
// ============================================

const identityRecordSchema = new Schema<IdentityRecord>({
  source: { type: String, enum: Object.values(APP_SOURCES), required: true },
  type: { type: String, enum: Object.values(IDENTITY_TYPES), required: true },
  value: { type: String, required: true },
  confidence: { type: Number, default: 1.0 },
  verified: { type: Boolean, default: false },
  linkedAt: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now }
}, { _id: false });

const linkedIdentitySchema = new Schema<LinkedIdentity>({
  unifiedId: { type: String, required: true },
  confidence: { type: Number, required: true },
  reason: String,
  linkedAt: { type: Date, default: Date.now }
}, { _id: false });

const locationWeightSchema = new Schema({
  lat: Number,
  lng: Number,
  weight: Number
}, { _id: false });

const behaviorFingerprintSchema = new Schema<BehaviorFingerprint>({
  ipPatterns: [String],
  userAgents: [String],
  typicalHours: [Number],
  avgSessionDuration: Number,
  preferredLocations: [locationWeightSchema]
}, { _id: false });

const identitySchema = new Schema<IIdentity>({
  unifiedId: { type: String, required: true, unique: true, index: true },

  identities: [identityRecordSchema],

  linkedTo: [linkedIdentitySchema],

  profile: {
    primarySource: String,
    name: String,
    phone: String,
    email: String,
    avatar: String,
    kycStatus: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' }
  },

  behaviorFingerprint: { type: behaviorFingerprintSchema, default: () => ({}) },

  stats: {
    totalSources: { type: Number, default: 0 },
    firstActivity: Date,
    lastActivity: Date,
    totalTransactions: { type: Number, default: 0 },
    totalSpend: { type: Number, default: 0 },
    avgOrderValue: { type: Number, default: 0 }
  },

  flags: {
    isTestUser: { type: Boolean, default: false },
    isBot: { type: Boolean, default: false },
    isFamilyAccount: { type: Boolean, default: false },
    mergedInto: String
  }
}, { timestamps: true });

identitySchema.index({ 'identities.source': 1, 'identities.value': 1 });
identitySchema.index({ 'identities.type': 1, 'identities.value': 1 });
identitySchema.index({ 'profile.phone': 1 });
identitySchema.index({ 'profile.email': 1 });
identitySchema.index({ 'linkedTo.unifiedId': 1 });

const Identity: Model<IIdentity> = mongoose.model<IIdentity>('Identity', identitySchema);

// ============================================
// SECURITY HELPERS
// ============================================

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// ============================================
// IDENTITY RESOLVER CLASS
// ============================================

interface ResolveOptions {
  createIfNotFound?: boolean;
  profile?: Partial<UserProfile>;
  confidence?: number;
}

interface ResolveResult {
  identity: IIdentity | null;
  isNew: boolean;
  linkedTo?: string;
}

class IdentityResolver {
  /**
   * Find existing identity by identifier
   */
  async findByIdentifier(source: AppSource, type: IdentityType, value: string): Promise<IIdentity | null> {
    return Identity.findOne({
      'identities.source': source,
      'identities.type': type,
      'identities.value': value
    });
  }

  /**
   * Find by unknown identifier value
   */
  async findByValue(type: IdentityType, value: string): Promise<IIdentity | null> {
    return Identity.findOne({
      'identities.type': type,
      'identities.value': value
    });
  }

  /**
   * Find by phone (across all sources)
   */
  async findByPhone(phone: string): Promise<IIdentity | null> {
    const normalized = this.normalizePhone(phone);
    return Identity.findOne({
      'identities.type': IDENTITY_TYPES.PHONE,
      'identities.value': normalized
    });
  }

  /**
   * Find by email (across all sources)
   */
  async findByEmail(email: string): Promise<IIdentity | null> {
    const normalized = email.toLowerCase().trim();
    return Identity.findOne({
      'identities.type': IDENTITY_TYPES.EMAIL,
      'identities.value': normalized
    });
  }

  /**
   * Link new identity to existing unified ID
   */
  async linkIdentity(
    unifiedId: string,
    source: AppSource,
    type: IdentityType,
    value: string,
    confidence: number = 1.0
  ): Promise<IIdentity> {
    const identity = await Identity.findOne({ unifiedId });
    if (!identity) {
      throw new NotFoundError();
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
        verified: type === IDENTITY_TYPES.PHONE || type === IDENTITY_TYPES.EMAIL,
        linkedAt: new Date(),
        lastSeen: new Date()
      });
      identity.stats.totalSources = identity.identities.length;
    }

    await identity.save();
    return identity;
  }

  /**
   * Create new unified identity
   */
  async createIdentity(
    source: AppSource,
    type: IdentityType,
    value: string,
    profile: Partial<UserProfile> = {}
  ): Promise<IIdentity> {
    const unifiedId = `uid_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

    const identity = new Identity({
      unifiedId,
      identities: [{
        source,
        type,
        value,
        confidence: 1.0,
        verified: type === IDENTITY_TYPES.PHONE || type === IDENTITY_TYPES.EMAIL,
        linkedAt: new Date(),
        lastSeen: new Date()
      }],
      profile: {
        primarySource: source,
        ...profile,
        kycStatus: profile.kycStatus || 'none',
        riskLevel: profile.riskLevel || 'low'
      },
      stats: {
        totalSources: 1,
        firstActivity: new Date(),
        lastActivity: new Date(),
        totalTransactions: 0,
        totalSpend: 0,
        avgOrderValue: 0
      }
    });

    await identity.save();
    return identity;
  }

  /**
   * Resolve identity (main entry point)
   */
  async resolve(
    source: AppSource,
    type: IdentityType,
    value: string,
    options: ResolveOptions = {}
  ): Promise<ResolveResult> {
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

  /**
   * Find probable matches using heuristics
   */
  async findProbableMatch(
    _source: AppSource,
    _type: IdentityType,
    _value: string
  ): Promise<LinkedIdentity | null> {
    // For demo, return null. In production, implement:
    // - Device fingerprint matching
    // - IP address clustering
    // - Behavioral pattern matching
    // - Family/household linking
    return null;
  }

  /**
   * Merge two identities
   */
  async merge(sourceId: string, targetId: string): Promise<IIdentity> {
    const [source, target] = await Promise.all([
      Identity.findOne({ unifiedId: sourceId }),
      Identity.findOne({ unifiedId: targetId })
    ]);

    if (!source || !target) {
      throw new NotFoundError('Identity');
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
    if (source.stats.lastActivity && target.stats.lastActivity) {
      if (source.stats.lastActivity > target.stats.lastActivity) {
        target.stats.lastActivity = source.stats.lastActivity;
      }
    }

    // Mark source as merged
    source.flags.mergedInto = targetId;
    source.unifiedId = `${source.unifiedId}_MERGED`;

    await Promise.all([source.save(), target.save()]);

    return target;
  }

  /**
   * Normalize phone number
   */
  normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 ? `91${digits}` : digits;
  }
}

const resolver = new IdentityResolver();

// ============================================
// ERROR HANDLING
// ============================================

function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as Request & { requestId?: string }).requestId || 'unknown';

  if (err instanceof AppError) {
    logger.warn('Operational error', {
      requestId,
      code: err.code,
      statusCode: err.statusCode,
      path: req.path
    });

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message
      },
      requestId
    });
    return;
  }

  logger.error('Unhandled error', {
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    },
    requestId
  });
}

function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ============================================
// EXPRESS APP
// ============================================

const app = express();

app.use(helmet());

// CORS - restrictive configuration
const isProduction = process.env['NODE_ENV'] === 'production';
const allowedOrigins = process.env['ALLOWED_ORIGINS']?.split(',').filter(Boolean) || [];

if (isProduction && allowedOrigins.length === 0) {
  logger.error('FATAL: ALLOWED_ORIGINS environment variable is required in production');
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

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  res.setHeader('x-request-id', req.requestId);
  logger.info(`${req.method} ${req.path}`, { requestId: req.requestId });
  next();
});

// Authentication middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  const publicPaths = ['/health', '/ready'];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();

  const token = req.headers['x-internal-token'] as string;
  const expectedToken = process.env['INTERNAL_SERVICE_TOKEN'];

  // Use timing-safe comparison to prevent timing attacks
  if (!token || !expectedToken || !timingSafeEqual(token, expectedToken)) {
    logger.warn('Unauthorized access attempt', { path: req.path, ip: req.ip });
    throw new AuthenticationError();
  }
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'identity-graph',
    sources: Object.values(APP_SOURCES),
    timestamp: new Date().toISOString()
  });
});

// Readiness check
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
    }
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
});

// Resolve identity - main endpoint
app.post('/api/identity/resolve', asyncHandler(async (req: Request, res: Response) => {
  const validation = validate(resolveIdentitySchema, req.body);
  if (!validation.valid) {
    throw new ValidationError('Invalid request body', validation.errors);
  }

  const { source, type, value, profile, confidence } = validation.data;

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

  const response: IdentityResolveResponse = {
    unifiedId: result.identity?.unifiedId || '',
    isNew: result.isNew,
    linkedTo: result.linkedTo
  };

  res.json({
    success: true,
    ...response
  });
}));

// Get unified identity
app.get('/api/identity/:unifiedId', asyncHandler(async (req: Request, res: Response) => {
  const { unifiedId } = req.params;
  const includeLinked = req.query['includeLinked'] === 'true';

  const identity = await Identity.findOne({ unifiedId });

  if (!identity) {
    throw new NotFoundError('Identity not found');
  }

  const response: IdentityDetailResponse = {
    unifiedId: identity.unifiedId,
    identities: identity.identities.map(i => ({
      source: i.source,
      type: i.type,
      value: maskIdentifier(i.type, i.value) ?? i.value,
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

  if (includeLinked) {
    response.linkedTo = identity.linkedTo;
  }

  res.json({ success: true, identity: response });
}));

// Find by any identifier
app.get('/api/identity/find/:type/:value', asyncHandler(async (req: Request, res: Response) => {
  const { type, value } = req.params;

  // Input validation
  const validTypes = ['phone', 'email', 'device_id', 'wallet_id', 'user_id'];
  const sanitizedType = type.toLowerCase().trim();

  if (!validTypes.includes(sanitizedType)) {
    throw new ValidationError('Invalid identifier type', [
      { field: 'type', message: `Must be one of: ${validTypes.join(', ')}` }
    ]);
  }

  // Sanitize value
  const sanitizedValue = value.trim().substring(0, 200);

  if (sanitizedValue.length < 3) {
    throw new ValidationError('Identifier value must be at least 3 characters');
  }

  // Phone validation
  if (sanitizedType === 'phone' && !/^\d{10,15}$/.test(sanitizedValue)) {
    throw new ValidationError('Phone must be 10-15 digits');
  }

  // Email validation
  if (sanitizedType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedValue)) {
    throw new ValidationError('Invalid email format');
  }

  let identity: IIdentity | null = null;
  switch (sanitizedType) {
    case 'phone':
      identity = await resolver.findByPhone(sanitizedValue);
      break;
    case 'email':
      identity = await resolver.findByEmail(sanitizedValue);
      break;
    default:
      identity = await resolver.findByValue(sanitizedType as IdentityType, sanitizedValue);
  }

  if (!identity) {
    throw new NotFoundError('Identity not found');
  }

  res.json({
    success: true,
    unifiedId: identity.unifiedId,
    source: identity.profile.primarySource
  });
}));

// Link new identity to existing unified ID
app.post('/api/identity/:unifiedId/link', asyncHandler(async (req: Request, res: Response) => {
  const validation = validate(linkIdentitySchema, req.body);
  if (!validation.valid) {
    throw new ValidationError('Invalid request body', validation.errors);
  }

  const { unifiedId } = req.params;
  const { source, type, value, confidence } = validation.data;

  const identity = await resolver.linkIdentity(
    unifiedId,
    source,
    type,
    value,
    confidence || 0.8
  );

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
app.post('/api/identity/:targetId/merge', asyncHandler(async (req: Request, res: Response) => {
  const validation = validate(mergeIdentitySchema, req.body);
  if (!validation.valid) {
    throw new ValidationError('Invalid request body', validation.errors);
  }

  const { targetId } = req.params;
  const { sourceId } = validation.data;

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
app.patch('/api/identity/:unifiedId/profile', asyncHandler(async (req: Request, res: Response) => {
  const validation = validate(updateProfileSchema, req.body);
  if (!validation.valid) {
    throw new ValidationError('Invalid request body', validation.errors);
  }

  const { unifiedId } = req.params;
  const { name, phone, email, kycStatus, riskLevel } = validation.data;

  const update: Record<string, unknown> = {};

  if (name !== undefined) update['profile.name'] = name;
  if (phone !== undefined) update['profile.phone'] = phone;
  if (email !== undefined) update['profile.email'] = email;
  if (kycStatus !== undefined) update['profile.kycStatus'] = kycStatus;
  if (riskLevel !== undefined) update['profile.riskLevel'] = riskLevel;

  const identity = await Identity.findOneAndUpdate(
    { unifiedId },
    { $set: update },
    { new: true }
  );

  if (!identity) {
    throw new NotFoundError('Identity not found');
  }

  res.json({ success: true, profile: identity.profile });
}));

// Update stats
app.post('/api/identity/:unifiedId/stats', asyncHandler(async (req: Request, res: Response) => {
  const validation = validate(updateStatsSchema, req.body);
  if (!validation.valid) {
    throw new ValidationError('Invalid request body', validation.errors);
  }

  const { unifiedId } = req.params;
  const { transactionAmount } = validation.data;

  const update: Record<string, unknown> = { $set: { 'stats.lastActivity': new Date() } };

  if (transactionAmount) {
    (update as Record<string, Record<string, number>>)['$inc'] = {
      'stats.totalTransactions': 1,
      'stats.totalSpend': transactionAmount
    };
  }

  const identity = await Identity.findOneAndUpdate(
    { unifiedId },
    update,
    { new: true }
  );

  if (!identity) {
    throw new NotFoundError('Identity not found');
  }

  // Recalculate avg
  if (identity.stats.totalTransactions > 0) {
    identity.stats.avgOrderValue = identity.stats.totalSpend / identity.stats.totalTransactions;
    await identity.save();
  }

  res.json({ success: true, stats: identity.stats });
}));

// Get identity graph
app.get('/api/identity/:unifiedId/graph', asyncHandler(async (req: Request, res: Response) => {
  const { unifiedId } = req.params;

  const identity = await Identity.findOne({ unifiedId });

  if (!identity) {
    throw new NotFoundError('Identity not found');
  }

  // Find all identities linked to this one
  const linked = await Identity.find({
    'linkedTo.unifiedId': unifiedId
  }).lean();

  // Find who this identity links to (used for future expansion)
  await Identity.find({
    unifiedId: { $in: identity.linkedTo.map(l => l.unifiedId) }
  }).lean();

  const nodes: GraphNode[] = [
    { unifiedId: identity.unifiedId, type: 'self', identities: identity.identities.length },
    ...identity.linkedTo.map(l => ({
      unifiedId: l.unifiedId,
      type: 'linked_to' as const,
      confidence: l.confidence,
      reason: l.reason
    })),
    ...linked.map(l => ({
      unifiedId: l.unifiedId,
      type: 'links_to_me' as const,
      confidence: l.linkedTo.find(lt => lt.unifiedId === unifiedId)?.confidence
    }))
  ];

  const response: IdentityGraphResponse = {
    unifiedId: identity.unifiedId,
    totalLinked: identity.linkedTo.length,
    linkedToMe: linked.length,
    nodes
  };

  res.json({
    success: true,
    graph: response
  });
}));

// Analytics
app.get('/api/identity/stats', asyncHandler(async (_req: Request, res: Response) => {
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

  const platformStats: PlatformStats = stats[0] || {
    totalIdentities: 0,
    avgSourcesPerIdentity: 0,
    totalLinked: 0,
    kycVerified: 0
  };

  res.json({
    success: true,
    stats: platformStats,
    bySource: bySource.map(s => ({
      _id: s._id as AppSource,
      count: s.count
    })) as StatsBySource[]
  });
}));

// ============================================
// HELPERS
// ============================================

/**
 * Mask sensitive identifiers
 */
function maskIdentifier(type: string, value: string | undefined): string | null {
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

// Error handler middleware
app.use(errorHandler);

// ============================================
// SERVER STARTUP
// ============================================

const PORT = parseInt(process.env['PORT'] || '4050', 10);

async function start(): Promise<void> {
  try {
    await mongoose.connect(process.env['MONGODB_URI'] || '', {
      w: 'majority',
      journal: true,
      retryWrites: true,
      retryReads: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    logger.info('Connected to MongoDB with write concern: majority');
    app.listen(PORT, () => {
      logger.info(`Identity Graph Service started on port ${PORT}`);
      logger.info(`Sources: ${Object.values(APP_SOURCES).join(', ')}`);
    });
  } catch (err) {
    const error = err as Error;
    logger.error('Startup failed', { error: error.message });
    process.exit(1);
  }
}

start();
