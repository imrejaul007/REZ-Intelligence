/**
 * REZ API Key Management System
 * Manages API keys for app authentication
 */
const express = require('express');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Schemas
const apiKeySchema = new mongoose.Schema({
  keyId: { type: String, required: true, unique: true, index: true },
  keyHash: { type: String, required: true },
  keyPrefix: { type: String, required: true }, // First 8 chars for display

  appId: { type: String, required: true, index: true },
  appName: String,

  permissions: [String], // ['events:write', 'events:read', 'recommendations:read', etc.]

  status: { type: String, enum: ['active', 'suspended', 'revoked'], default: 'active' },

  rateLimit: {
    requestsPerMinute: { type: Number, default: 100 },
    requestsPerDay: { type: Number, default: 10000 }
  },

  metadata: mongoose.Schema.Types.Mixed,

  lastUsed: Date,
  lastUsedIp: String,

  usage: {
    totalRequests: { type: Number, default: 0 },
    successfulRequests: { type: Number, default: 0 },
    failedRequests: { type: Number, default: 0 }
  },

  expiresAt: Date,

  createdAt: { type: Date, default: Date.now },
  createdBy: String
});

apiKeySchema.index({ appId: 1, status: 1 });
apiKeySchema.index({ keyPrefix: 1 });

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

// API Key Service
class ApiKeyService {
  static generateKey() {
    const keyId = uuidv4().replace(/-/g, '').substring(0, 12);
    const keySecret = crypto.randomBytes(32).toString('hex');
    const key = `rez_${keyId}_${keySecret}`;
    const keyPrefix = key.substring(0, 16);
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    return { key, keyId, keyHash, keyPrefix };
  }

  static async createKey(appId, appName, options = {}) {
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

  static async validateKey(key) {
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

    // Update usage
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

  static async hasPermission(keyId, permission) {
    const apiKey = await ApiKey.findOne({ keyId });
    if (!apiKey) return false;
    return apiKey.permissions.includes(permission) || apiKey.permissions.includes('*');
  }

  static async revokeKey(keyId) {
    const apiKey = await ApiKey.findOneAndUpdate(
      { keyId },
      { status: 'revoked' },
      { new: true }
    );
    return apiKey;
  }

  static async suspendKey(keyId) {
    return ApiKey.findOneAndUpdate(
      { keyId },
      { status: 'suspended' },
      { new: true }
    );
  }

  static async listKeys(appId) {
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
}

// Middleware
async function apiKeyMiddleware(req, res, next) {
  const key = req.headers['x-rez-api-key'] || req.headers['x-api-key'];

  if (!key) {
    return res.status(401).json({ error: 'API key required' });
  }

  const result = await ApiKeyService.validateKey(key);

  if (!result.valid) {
    return res.status(401).json({ error: result.error });
  }

  req.apiKey = result;
  next();
}

function permissionMiddleware(requiredPermission) {
  return async (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const hasPermission = req.apiKey.permissions.includes(requiredPermission) ||
                         req.apiKey.permissions.includes('*');

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

// Routes
app.post('/keys', async (req, res) => {
  try {
    const { appId, appName, permissions, rateLimit, expiresAt, createdBy } = req.body;

    if (!appId || !appName) {
      return res.status(400).json({ error: 'appId and appName required' });
    }

    const result = await ApiKeyService.createKey(appId, appName, {
      permissions,
      rateLimit,
      expiresAt,
      createdBy
    });

    // Return full key only on creation
    res.json({ success: true, apiKey: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/keys', apiKeyMiddleware, async (req, res) => {
  try {
    const keys = await ApiKeyService.listKeys(req.apiKey.appId);
    res.json({ success: true, keys });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/keys/:keyId/validate', async (req, res) => {
  try {
    const { keyId } = req.params;
    const apiKey = await ApiKey.findOne({ keyId });

    if (!apiKey) {
      return res.json({ valid: false, error: 'Key not found' });
    }

    res.json({
      valid: apiKey.status === 'active',
      keyId: apiKey.keyId,
      appId: apiKey.appId,
      permissions: apiKey.permissions,
      status: apiKey.status
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/keys/:keyId', apiKeyMiddleware, async (req, res) => {
  try {
    const { keyId } = req.params;
    await ApiKeyService.revokeKey(keyId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin routes (for managing all keys)
app.post('/admin/keys', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { appId, appName, permissions, rateLimit } = req.body;
    const result = await ApiKeyService.createKey(appId, appName, {
      permissions,
      rateLimit,
      createdBy: 'admin'
    });
    res.json({ success: true, apiKey: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 4096;

async function start() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  app.listen(PORT, () => {
    console.log(`API Key Service running on port ${PORT}`);
  });
}

start();
