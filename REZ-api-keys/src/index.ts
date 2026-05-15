import express, { Express, Request, Response, NextFunction } from 'express';
import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import crypto from 'crypto';
import helmet from 'helmet';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { createLogger } from '../../shared';

// ============================================
// TYPE DEFINITIONS
// ============================================

type ApiKeyStatus = 'active' | 'suspended' | 'revoked';

interface IRateLimit {
  requestsPerMinute: number;
  requestsPerDay: number;
}

interface IUsage {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
}

interface IApiKey extends Document {
  keyId: string;
  keyHash: string;
  keyPrefix: string;
  appId: string;
  appName?: string;
  permissions: string[];
  status: ApiKeyStatus;
  rateLimit: IRateLimit;
  metadata?: Types.Mixed;
  lastUsed?: Date;
  lastUsedIp?: string;
  usage: IUsage;
  expiresAt?: Date;
  createdAt: Date;
  createdBy?: string;
}

interface ApiKeyResult {
  key: string;
  keyId: string;
  appId: string;
  permissions: string[];
  expiresAt?: Date;
}

interface ValidateKeyResult {
  valid: boolean;
  error?: string;
  keyId?: string;
  appId?: string;
  permissions?: string[];
}

// ============================================
// ZOD VALIDATION SCHEMAS
// ============================================

const CreateApiKeySchema = z.object({
  appId: z.string().min(1).max(100),
  appName: z.string().min(1).max(200),
  permissions: z.array(z.string().min(1)).min(1).optional(),
  rateLimit: z.object({
    requestsPerMinute: z.number().int().positive().max(10000).optional(),
    requestsPerDay: z.number().int().positive().max(1000000).optional()
  }).optional(),
  expiresAt: z.string().datetime().optional(),
  createdBy: z.string().optional()
});

const UpdateRateLimitSchema = z.object({
  requestsPerMinute: z.number().int().positive().max(10000).optional(),
  requestsPerDay: z.number().int().positive().max(1000000).optional()
});

type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;

// ============================================
// MONGOOSE SCHEMA
// ============================================

const apiKeySchema = new Schema<IApiKey>({
  keyId: { type: String, required: true, unique: true, index: true },
  keyHash: { type: String, required: true },
  keyPrefix: { type: String, required: true },
  appId: { type: String, required: true, index: true },
  appName: { type: String },
  permissions: [String],
  status: { type: String, enum: ['active', 'suspended', 'revoked'], default: 'active' },
  rateLimit: {
    requestsPerMinute: { type: Number, default: 100 },
    requestsPerDay: { type: Number, default: 10000 }
  },
  metadata: { type: Schema.Types.Mixed },
  lastUsed: { type: Date },
  lastUsedIp: { type: String },
  usage: {
    totalRequests: { type: Number, default: 0 },
    successfulRequests: { type: Number, default: 0 },
    failedRequests: { type: Number, default: 0 }
  },
  expiresAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: String }
});

apiKeySchema.index({ appId: 1, status: 1 });
apiKeySchema.index({ keyPrefix: 1 });

const ApiKey: Model<IApiKey> = mongoose.model<IApiKey>('ApiKey', apiKeySchema);

// ============================================
// LOGGER
// ============================================

const logger = createLogger('api-keys');

// ============================================
// API KEY SERVICE
// ============================================

interface CreateKeyOptions {
  permissions?: string[];
  rateLimit?: IRateLimit;
  expiresAt?: Date;
  createdBy?: string;
}

class ApiKeyService {
  static generateKey(): { key: string; keyId: string; keyHash: string; keyPrefix: string } {
    const keyId = uuidv4().replace(/-/g, '').substring(0, 12);
    const keySecret = crypto.randomBytes(32).toString('hex');
    const key = `rez_${keyId}_${keySecret}`;
    const keyPrefix = key.substring(0, 16);
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    return { key, keyId, keyHash, keyPrefix };
  }

  static async createKey(appId: string, appName: string, options: CreateKeyOptions = {}): Promise<ApiKeyResult> {
    const { key, keyId, keyHash, keyPrefix } = this.generateKey();

    const apiKey = new ApiKey({
      keyId,
      keyHash,
      keyPrefix,
      appId,
      appName,
      permissions: options.permissions || ['events:write', 'recommendations:read'],
      rateLimit: options.rateLimit || { requestsPerMinute: 100, requestsPerDay: 10000 },
      expiresAt: options.expiresAt,
      createdBy: options.createdBy
    });

    await apiKey.save();

    return {
      key,
      keyId,
      appId,
      permissions: apiKey.permissions,
      expiresAt: apiKey.expiresAt
    };
  }

  static async validateKey(key: string): Promise<ValidateKeyResult> {
    if (!key || !key.startsWith('rez_')) {
      return { valid: false, error: 'Invalid key format' };
    }

    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const apiKey = await ApiKey.findOne({ keyHash });

    if (!apiKey) {
      return { valid: false, error: 'Key not found' };
    }

    if (apiKey.status !== 'active') {
      return { valid: false, error: `Key is ${apiKey.status}` };
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false, error: 'Key expired' };
    }

    // Update usage stats
    apiKey.lastUsed = new Date();
    apiKey.usage.totalRequests += 1;
    await apiKey.save();

    return {
      valid: true,
      keyId: apiKey.keyId,
      appId: apiKey.appId,
      permissions: apiKey.permissions
    };
  }

  static async hasPermission(keyId: string, permission: string): Promise<boolean> {
    const apiKey = await ApiKey.findOne({ keyId });
    if (!apiKey) return false;
    return apiKey.permissions.includes(permission) || apiKey.permissions.includes('*');
  }

  static async revokeKey(keyId: string): Promise<IApiKey | null> {
    return ApiKey.findOneAndUpdate(
      { keyId },
      { status: 'revoked' },
      { new: true }
    );
  }

  static async suspendKey(keyId: string): Promise<IApiKey | null> {
    return ApiKey.findOneAndUpdate(
      { keyId },
      { status: 'suspended' },
      { new: true }
    );
  }

  static async activateKey(keyId: string): Promise<IApiKey | null> {
    return ApiKey.findOneAndUpdate(
      { keyId },
      { status: 'active' },
      { new: true }
    );
  }

  static async listKeys(appId: string): Promise<Array<{
    keyId: string;
    keyPrefix: string;
    status: ApiKeyStatus;
    permissions: string[];
    lastUsed?: Date;
    usage: IUsage;
    createdAt: Date;
    expiresAt?: Date;
  }>> {
    const keys = await ApiKey.find({ appId }).sort({ createdAt: -1 });
    return keys.map(k => ({
      keyId: k.keyId,
      keyPrefix: k.keyPrefix,
      status: k.status,
      permissions: k.permissions,
      lastUsed: k.lastUsed,
      usage: k.usage,
      createdAt: k.createdAt,
      expiresAt: k.expiresAt
    }));
  }

  static async getKeyStats(keyId: string): Promise<IApiKey | null> {
    return ApiKey.findOne({ keyId });
  }
}

// ============================================
// EXPRESS APP SETUP
// ============================================

const app: Express = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// ============================================
// MIDDLEWARE
// ============================================

interface AuthenticatedRequest extends Request {
  apiKey?: ValidateKeyResult;
}

async function apiKeyMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const key = (req.headers['x-rez-api-key'] || req.headers['x-api-key']) as string | undefined;

  if (!key) {
    res.status(401).json({ error: 'API key required' });
    return;
  }

  const result = await ApiKeyService.validateKey(key);

  if (!result.valid) {
    res.status(401).json({ error: result.error });
    return;
  }

  req.apiKey = result;
  next();
}

function permissionMiddleware(requiredPermission: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.apiKey) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const hasPermission = req.apiKey.permissions?.includes(requiredPermission) ||
                         req.apiKey.permissions?.includes('*');

    if (!hasPermission) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

// ============================================
// ROUTES
// ============================================

// Create API key
app.post('/keys', async (req: Request, res: Response) => {
  try {
    const validation = CreateApiKeySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
      return;
    }

    const { appId, appName, permissions, rateLimit, expiresAt, createdBy } = validation.data;

    const result = await ApiKeyService.createKey(appId, appName, {
      permissions,
      rateLimit,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      createdBy
    });

    logger.info('API key created', { appId, keyId: result.keyId });

    // Return full key only on creation
    res.json({ success: true, apiKey: result });
  } catch (err) {
    const error = err as Error;
    logger.error('Create key failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// List keys for an app
app.get('/keys', apiKeyMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.apiKey?.appId) {
      res.status(401).json({ error: 'App ID not found' });
      return;
    }

    const keys = await ApiKeyService.listKeys(req.apiKey.appId);
    res.json({ success: true, keys });
  } catch (err) {
    const error = err as Error;
    logger.error('List keys failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Validate a key
app.get('/keys/:keyId/validate', async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;
    const apiKey = await ApiKey.findOne({ keyId });

    if (!apiKey) {
      res.json({ valid: false, error: 'Key not found' });
      return;
    }

    res.json({
      valid: apiKey.status === 'active',
      keyId: apiKey.keyId,
      appId: apiKey.appId,
      permissions: apiKey.permissions,
      status: apiKey.status
    });
  } catch (err) {
    const error = err as Error;
    logger.error('Validate key failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Delete/revoke a key
app.delete('/keys/:keyId', apiKeyMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { keyId } = req.params;
    const result = await ApiKeyService.revokeKey(keyId);

    if (!result) {
      res.status(404).json({ error: 'Key not found' });
      return;
    }

    logger.info('API key revoked', { keyId });
    res.json({ success: true });
  } catch (err) {
    const error = err as Error;
    logger.error('Revoke key failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Suspend a key
app.patch('/keys/:keyId/suspend', apiKeyMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { keyId } = req.params;
    const result = await ApiKeyService.suspendKey(keyId);

    if (!result) {
      res.status(404).json({ error: 'Key not found' });
      return;
    }

    logger.info('API key suspended', { keyId });
    res.json({ success: true, status: result.status });
  } catch (err) {
    const error = err as Error;
    logger.error('Suspend key failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Activate a key
app.patch('/keys/:keyId/activate', apiKeyMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { keyId } = req.params;
    const result = await ApiKeyService.activateKey(keyId);

    if (!result) {
      res.status(404).json({ error: 'Key not found' });
      return;
    }

    logger.info('API key activated', { keyId });
    res.json({ success: true, status: result.status });
  } catch (err) {
    const error = err as Error;
    logger.error('Activate key failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get key stats
app.get('/keys/:keyId/stats', apiKeyMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { keyId } = req.params;
    const key = await ApiKeyService.getKeyStats(keyId);

    if (!key) {
      res.status(404).json({ error: 'Key not found' });
      return;
    }

    res.json({
      success: true,
      stats: {
        totalRequests: key.usage.totalRequests,
        successfulRequests: key.usage.successfulRequests,
        failedRequests: key.usage.failedRequests,
        lastUsed: key.lastUsed,
        createdAt: key.createdAt
      }
    });
  } catch (err) {
    const error = err as Error;
    logger.error('Get stats failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Admin routes (for managing all keys)
app.post('/admin/keys', async (req: Request, res: Response) => {
  const adminKey = req.headers['x-admin-key'] as string | undefined;
  if (adminKey !== process.env.ADMIN_API_KEY) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  try {
    const validation = CreateApiKeySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors
      });
      return;
    }

    const { appId, appName, permissions, rateLimit } = validation.data;
    const result = await ApiKeyService.createKey(appId, appName, {
      permissions,
      rateLimit,
      createdBy: 'admin'
    });

    logger.info('Admin created API key', { appId, keyId: result.keyId });
    res.json({ success: true, apiKey: result });
  } catch (err) {
    const error = err as Error;
    logger.error('Admin create key failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'api-keys' });
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

const PORT = process.env.PORT || 4096;

async function start(): Promise<void> {
  try {
    if (!process.env.MONGODB_URI) {
      logger.error('FATAL: MONGODB_URI is required');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    app.listen(PORT, () => {
      console.log(`API Key Service running on port ${PORT}`);
    });
  } catch (err) {
    const error = err as Error;
    logger.error('Startup failed', { error: error.message });
    process.exit(1);
  }
}

start();

export { app, ApiKeyService };
