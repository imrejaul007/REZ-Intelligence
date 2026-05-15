import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import axios from 'axios';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { createLogger, requestIdMiddleware } from '../../shared';

// ============================================
// TYPE DEFINITIONS
// ============================================

type PrimaryIdentifier = 'phone' | 'email';
type IdentityStatus = 'active' | 'merged' | 'flagged';

interface ILinkedAccount {
  appId: string;
  userId: string;
  identifiers: Types.Mixed;
  linkedAt: Date;
  confidence: number;
}

interface IProfile {
  phone?: string;
  email?: string;
  name?: string;
  devices: string[];
  preferences?: Types.Mixed;
}

interface IStats {
  totalApps: number;
  totalOrders: number;
  totalSpend: number;
  firstSeen?: Date;
  lastSeen?: Date;
}

interface IUnifiedIdentity extends Document {
  unifiedId: string;
  primaryIdentifier: PrimaryIdentifier;
  primaryValue?: string;
  linkedAccounts: ILinkedAccount[];
  profile: IProfile;
  stats: IStats;
  status: IdentityStatus;
  createdAt: Date;
  updatedAt?: Date;
}

// ============================================
// ZOD VALIDATION SCHEMAS
// ============================================

const ResolveIdentitySchema = z.object({
  phone: z.string().regex(/^\d{5,15}$/, 'Phone must be 5-15 digits').optional(),
  email: z.string().email('Invalid email format').optional(),
  deviceId: z.string().optional(),
  appId: z.string().max(50).optional(),
  sourceUserId: z.string().optional()
});

const LinkAccountSchema = z.object({
  appId: z.string().min(1).max(50),
  userId: z.string().min(1),
  identifiers: z.record(z.any()).optional()
});

const ListIdentitiesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100)
});

type ResolveIdentityInput = z.infer<typeof ResolveIdentitySchema>;
type LinkAccountInput = z.infer<typeof LinkAccountSchema>;

// ============================================
// MONGOOSE SCHEMA
// ============================================

const unifiedIdentitySchema = new Schema<IUnifiedIdentity>({
  unifiedId: { type: String, required: true, unique: true, index: true },
  primaryIdentifier: { type: String, enum: ['phone', 'email'], required: true },
  primaryValue: { type: String },
  linkedAccounts: [{
    appId: String,
    userId: String,
    identifiers: { type: Schema.Types.Mixed },
    linkedAt: { type: Date, default: Date.now },
    confidence: { type: Number, default: 1 }
  }],
  profile: {
    phone: { type: String },
    email: { type: String },
    name: { type: String },
    devices: [String],
    preferences: { type: Schema.Types.Mixed }
  },
  stats: {
    totalApps: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    totalSpend: { type: Number, default: 0 },
    firstSeen: { type: Date },
    lastSeen: { type: Date }
  },
  status: { type: String, enum: ['active', 'merged', 'flagged'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

unifiedIdentitySchema.index({ 'linkedAccounts.appId': 1, 'linkedAccounts.userId': 1 });
unifiedIdentitySchema.index({ 'profile.phone': 1 });
unifiedIdentitySchema.index({ 'profile.email': 1 });

const UnifiedIdentity: Model<IUnifiedIdentity> = mongoose.model<IUnifiedIdentity>('UnifiedIdentity', unifiedIdentitySchema);

// ============================================
// LOGGER
// ============================================

const logger = createLogger('identity-bridge');

// ============================================
// ENVIRONMENT CONFIGURATION
// ============================================

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// Identity services configuration
const IDENTITY_SERVICES: Record<string, string | undefined> = {
  'identity-graph': process.env.IDENTITY_GRAPH_URL,
  'consumer-graph': process.env.CONSUMER_GRAPH_URL,
  'cdp': process.env.CDP_URL
};

// ============================================
// SECURITY UTILITIES
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
// EXPRESS APP SETUP
// ============================================

const app: Express = express();

// Security headers
app.use(helmet());

// CORS configuration
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

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    error: 'Too Many Requests',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Rate limit exceeded. Please try again later.'
  },
  skip: (req) => ['/health', '/ready'].some(p => req.path.startsWith(p))
});
app.use(limiter);

app.use(express.json({ limit: '100kb' }));

// Request ID middleware
app.use(requestIdMiddleware);

// Authentication middleware
const PUBLIC_PATHS = ['/health', '/ready', '/resolve'];

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (PUBLIC_PATHS.some(p => req.path.startsWith(p))) {
    return next();
  }

  const token = req.headers['x-internal-token'] as string | undefined;
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;

  if (!token || !expectedToken || !timingSafeEqual(token, expectedToken)) {
    logger.warn('Unauthorized access attempt', { path: req.path, ip: req.ip });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

app.use(authMiddleware);

// ============================================
// HELPER FUNCTIONS
// ============================================

interface ServiceResponse {
  userId?: string;
  unifiedId?: string;
  profile?: Partial<IProfile>;
  [key: string]: unknown;
}

async function queryService(name: string, path: string, data: Record<string, unknown>): Promise<ServiceResponse | null> {
  const baseUrl = IDENTITY_SERVICES[name];
  if (!baseUrl) return null;

  try {
    const response = await axios.post(`${baseUrl}${path}`, data, {
      timeout: 3000,
      headers: { 'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN }
    });
    return response.data as ServiceResponse;
  } catch (err) {
    const error = err as Error;
    logger.warn(`Service ${name} query failed`, { error: error.message });
    return null;
  }
}

// ============================================
// ROUTES
// ============================================

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'identity-bridge', timestamp: new Date().toISOString() });
});

app.get('/ready', async (_req: Request, res: Response) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ error: 'Not ready' });
  }
});

// Resolve identity - query all services and consolidate
app.post('/resolve', async (req: Request, res: Response) => {
  try {
    const validation = ResolveIdentitySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Bad Request',
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: validation.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
      return;
    }

    const { phone, email, deviceId, appId, sourceUserId } = validation.data;

    // At least one identifier required
    if (!phone && !email && !deviceId) {
      res.status(400).json({
        error: 'Bad Request',
        code: 'MISSING_IDENTIFIER',
        message: 'At least one of phone, email, or deviceId is required'
      });
      return;
    }

    // Query all identity services in parallel
    const results = await Promise.allSettled([
      queryService('identity-graph', '/api/identity/resolve', { phone, email }),
      queryService('consumer-graph', '/api/resolve', { phone, email, deviceId }),
      queryService('cdp', '/api/identity/resolve', { phone, email })
    ]);

    // Extract successful results
    const identities = results
      .filter((r): r is PromiseFulfilledResult<ServiceResponse> => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value)
      .filter(r => r && (r.userId || r.unifiedId || r.profile));

    if (identities.length === 0) {
      // Create new unified identity
      const unifiedId = `uid_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
      const primaryIdentifier: PrimaryIdentifier = phone ? 'phone' : 'email';
      const primaryValue = phone || email || '';

      const identity = new UnifiedIdentity({
        unifiedId,
        primaryIdentifier,
        primaryValue,
        profile: {
          phone,
          email,
          devices: deviceId ? [deviceId] : []
        },
        stats: { firstSeen: new Date(), lastSeen: new Date(), totalApps: 0, totalOrders: 0, totalSpend: 0 }
      });

      // Link the source account
      if (appId && sourceUserId) {
        identity.linkedAccounts.push({
          appId,
          userId: sourceUserId,
          identifiers: { phone, email, deviceId },
          linkedAt: new Date(),
          confidence: 1
        });
        identity.stats.totalApps = 1;
      }

      await identity.save();

      logger.info('New identity created', { unifiedId, appId, sourceUserId });

      res.json({
        unifiedId: identity.unifiedId,
        confidence: 1,
        source: 'new',
        linkedAccounts: identity.linkedAccounts,
        profile: identity.profile
      });
      return;
    }

    // Merge existing identities
    const primary = identities[0]!;
    const unifiedId = primary.unifiedId || primary.userId || `uid_${uuidv4().substring(0, 12)}`;

    // Check if we have this in our database
    let identity = await UnifiedIdentity.findOne({ unifiedId });

    if (!identity) {
      identity = new UnifiedIdentity({
        unifiedId,
        primaryIdentifier: phone ? 'phone' : 'email',
        primaryValue: phone || email,
        profile: primary.profile || { phone, email, devices: deviceId ? [deviceId] : [] },
        linkedAccounts: [],
        stats: { firstSeen: new Date(), lastSeen: new Date(), totalApps: 0, totalOrders: 0, totalSpend: 0 }
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
          linkedAt: new Date(),
          confidence: 0.9
        });
        identity.stats.totalApps = identity.linkedAccounts.length;
      }
    }

    // Update profile with latest data
    if (primary.profile) {
      identity.profile = { ...identity.profile, ...primary.profile } as IProfile;
    }
    identity.stats.lastSeen = new Date();
    identity.updatedAt = new Date();
    await identity.save();

    logger.info('Identity resolved', { unifiedId, source: 'resolved' });

    res.json({
      unifiedId: identity.unifiedId,
      confidence: 0.95,
      source: 'resolved',
      linkedAccounts: identity.linkedAccounts,
      profile: identity.profile
    });
  } catch (err) {
    const error = err as Error;
    logger.error('Resolve failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get unified profile
app.get('/:unifiedId', async (req: Request, res: Response) => {
  try {
    const { unifiedId } = req.params;

    const identity = await UnifiedIdentity.findOne({ unifiedId });

    if (!identity) {
      res.status(404).json({ error: 'Identity not found' });
      return;
    }

    res.json({
      unifiedId: identity.unifiedId,
      profile: identity.profile,
      linkedAccounts: identity.linkedAccounts,
      stats: identity.stats,
      status: identity.status
    });
  } catch (err) {
    const error = err as Error;
    logger.error('Get identity failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Link accounts
app.post('/:unifiedId/link', async (req: Request, res: Response) => {
  try {
    const validation = LinkAccountSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Bad Request',
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: validation.error.errors
      });
      return;
    }

    const { unifiedId } = req.params;
    const { appId, userId, identifiers } = validation.data;

    const identity = await UnifiedIdentity.findOne({ unifiedId });

    if (!identity) {
      res.status(404).json({ error: 'Identity not found' });
      return;
    }

    const exists = identity.linkedAccounts.some(a => a.appId === appId && a.userId === userId);
    if (!exists) {
      identity.linkedAccounts.push({
        appId,
        userId,
        identifiers: identifiers || {},
        linkedAt: new Date(),
        confidence: 1
      });
      identity.stats.totalApps = identity.linkedAccounts.length;
      identity.updatedAt = new Date();
      await identity.save();
    }

    logger.info('Account linked', { unifiedId, appId, userId });

    res.json({ success: true, linkedAccounts: identity.linkedAccounts });
  } catch (err) {
    const error = err as Error;
    logger.error('Link account failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get all identities (for debugging/admin)
app.get('/', async (req: Request, res: Response) => {
  try {
    const validation = ListIdentitiesSchema.safeParse(req.query);
    const limit = validation.success ? validation.data.limit : 100;

    const identities = await UnifiedIdentity.find()
      .sort({ 'stats.lastSeen': -1 })
      .limit(limit)
      .lean();

    res.json({
      count: identities.length,
      identities: identities.map(i => ({
        unifiedId: i.unifiedId,
        apps: i.linkedAccounts.length,
        profile: { phone: i.profile.phone, email: i.profile.email }
      }))
    });
  } catch (err) {
    const error = err as Error;
    logger.error('List identities failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ERROR HANDLER
// ============================================

function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: err.message });
}

app.use(errorHandler);

// ============================================
// STARTUP
// ============================================

const PORT = process.env.PORT || 4092;

async function start(): Promise<void> {
  try {
    // Validate required environment variables
    const requiredEnvVars = ['IDENTITY_GRAPH_URL', 'CONSUMER_GRAPH_URL', 'CDP_URL'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        const error = `[FATAL] ${envVar} environment variable is required`;
        if (isProduction) {
          console.error(error);
          process.exit(1);
        } else {
          console.warn(`[WARN] ${error} - using fallback (development only)`);
        }
      }
    }

    if (!process.env.MONGODB_URI) {
      logger.error('FATAL: MONGODB_URI is required');
      process.exit(1);
    }

    // Connect with write concern and retry settings for production durability
    await mongoose.connect(process.env.MONGODB_URI, {
      w: 'majority',
      journal: true,
      retryWrites: true,
      retryReads: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    logger.info('Connected to MongoDB with write concern: majority');

    app.listen(PORT, () => {
      console.log(`Identity Bridge running on port ${PORT}`);
    });
  } catch (err) {
    const error = err as Error;
    logger.error('Startup failed', { error: error.message });
    process.exit(1);
  }
}

start();

export { app };
