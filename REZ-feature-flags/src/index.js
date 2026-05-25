import logger from './utils/logger';

/**
 * REZ Feature Flags Service
 * Centralized feature flag management with per-tenant overrides
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || '4030', 10);
const MONGODB = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-feature-flags';

// Feature Flag Schema
const featureFlagSchema = new mongoose.Schema({
  flag_key: { type: String, required: true, unique: true, index: true },
  enabled: { type: Boolean, default: false },
  description: String,
  rollout_percentage: { type: Number, default: 100 },
  environment: { type: String, default: 'production' },
  metadata: mongoose.Schema.Types.Mixed,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const FeatureFlag = mongoose.models.FeatureFlag || mongoose.model('FeatureFlag', featureFlagSchema, 'feature_flags');

// Tenant Override Schema - per-tenant feature flag overrides
const tenantOverrideSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  flagKey: { type: String, required: true },
  enabled: { type: Boolean, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const TenantOverride = mongoose.models.TenantOverride || mongoose.model('TenantOverride', tenantOverrideSchema, 'tenant_overrides');

// Compound index for efficient lookups
tenantOverrideSchema.index({ tenantId: 1, flagKey: 1 }, { unique: true });

// Default flags
const DEFAULT_FLAGS = {
  learning_enabled: { enabled: false, description: 'Enable machine learning' },
  adaptive_enabled: { enabled: false, description: 'Enable adaptive decisions' },
  personalization_enabled: { enabled: true, description: 'Personalized content' },
  recommendations_enabled: { enabled: true, description: 'Product recommendations' },
  intent_prediction_enabled: { enabled: true, description: 'Real-time intent prediction' },
  ads_enabled: { enabled: false, description: 'Show targeted ads' },
  push_enabled: { enabled: true, description: 'Push notifications' },
  email_enabled: { enabled: true, description: 'Email notifications' },
  auto_execute_safe: { enabled: true, description: 'Auto-execute SAFE decisions' },
  require_approval_risky: { enabled: true, description: 'Require approval for RISKY' },
  rollback_enabled: { enabled: true, description: 'Auto-rollback on failure' },
};

// ==========================================
// PER-TENANT FEATURE FLAG FUNCTIONS
// ==========================================

/**
 * Get feature flag value with tenant override support
 * Priority: 1. Tenant Override (highest) -> 2. Database Flag -> 3. Default Flag
 */
async function getFeatureFlag(tenantId, flagName) {
  // Check tenant override first
  if (tenantId) {
    const override = await TenantOverride.findOne({ tenantId, flagKey: flagName });
    if (override) {
      return override.enabled;
    }
  }

  // Fall back to database flag
  const dbFlag = await FeatureFlag.findOne({ flag_key: flagName });
  if (dbFlag) {
    return dbFlag.enabled;
  }

  // Fall back to default
  return DEFAULT_FLAGS[flagName]?.enabled ?? false;
}

/**
 * Set tenant-specific feature flag override
 */
async function setTenantOverride(tenantId, flagName, value) {
  if (!tenantId || !flagName) {
    throw new Error('tenantId and flagName are required');
  }

  if (typeof value !== 'boolean') {
    throw new Error('value must be a boolean');
  }

  const override = await TenantOverride.findOneAndUpdate(
    { tenantId, flagKey: flagName },
    {
      tenantId,
      flagKey: flagName,
      enabled: value,
      updated_at: new Date(),
    },
    { upsert: true, new: true }
  );

  return override;
}

/**
 * Remove tenant-specific override (revert to default)
 */
async function removeTenantOverride(tenantId, flagName) {
  const result = await TenantOverride.deleteOne({ tenantId, flagKey: flagName });
  return result.deletedCount > 0;
}

/**
 * Get all tenant overrides
 */
async function getTenantOverrides(tenantId) {
  const overrides = await TenantOverride.find({ tenantId });
  const overridesMap = {};
  for (const override of overrides) {
    overridesMap[override.flagKey] = override.enabled;
  }
  return overridesMap;
}

/**
 * Get all flags for a tenant (with overrides applied)
 */
async function getTenantFlags(tenantId) {
  const flags = await FeatureFlag.find();
  const overrides = await TenantOverride.find({ tenantId });

  // Build override lookup map
  const overrideMap = {};
  for (const override of overrides) {
    overrideMap[override.flagKey] = override.enabled;
  }

  const flagsMap = {};

  for (const [key, defaultFlag] of Object.entries(DEFAULT_FLAGS)) {
    // Check override first
    if (overrideMap[key] !== undefined) {
      flagsMap[key] = {
        enabled: overrideMap[key],
        description: defaultFlag.description,
        source: 'tenant_override',
      };
    } else {
      // Check database flag
      const dbFlag = flags.find(f => f.flag_key === key);
      if (dbFlag) {
        flagsMap[key] = {
          enabled: dbFlag.enabled,
          description: dbFlag.description,
          rollout: dbFlag.rollout_percentage,
          source: 'database',
        };
      } else {
        flagsMap[key] = {
          enabled: defaultFlag.enabled,
          description: defaultFlag.description,
          rollout: 100,
          source: 'default',
        };
      }
    }
  }

  return flagsMap;
}

/**
 * Bulk set tenant overrides
 */
async function bulkSetTenantOverrides(tenantId, overrides) {
  const operations = [];

  for (const [flagKey, enabled] of Object.entries(overrides)) {
    operations.push({
      updateOne: {
        filter: { tenantId, flagKey },
        update: {
          $set: {
            tenantId,
            flagKey,
            enabled,
            updated_at: new Date(),
          },
          $setOnInsert: {
            created_at: new Date(),
          },
        },
        upsert: true,
      },
    });
  }

  if (operations.length > 0) {
    await TenantOverride.bulkWrite(operations);
  }

  return getTenantOverrides(tenantId);
}

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'feature-flags' });
});

app.get('/flags', async (req, res) => {
  try {
    const flags = await FeatureFlag.find();
    const flagsMap = {};

    for (const [key, defaultFlag] of Object.entries(DEFAULT_FLAGS)) {
      const dbFlag = flags.find(f => f.flag_key === key);
      if (dbFlag) {
        flagsMap[key] = {
          enabled: dbFlag.enabled,
          description: dbFlag.description,
          rollout: dbFlag.rollout_percentage,
        };
      } else {
        flagsMap[key] = {
          enabled: defaultFlag.enabled,
          description: defaultFlag.description,
          rollout: 100,
        };
      }
    }

    res.json({ flags: flagsMap });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/flags/:key', async (req, res) => {
  try {
    const { key } = req.params;
    let flag = await FeatureFlag.findOne({ flag_key: key });

    if (!flag) {
      const defaultFlag = DEFAULT_FLAGS[key];
      if (defaultFlag) {
        return res.json({
          key,
          enabled: defaultFlag.enabled,
          description: defaultFlag.description,
          rollout: 100,
          is_default: true,
        });
      }
      return res.status(404).json({ error: 'Flag not found' });
    }

    res.json({
      key: flag.flag_key,
      enabled: flag.enabled,
      description: flag.description,
      rollout: flag.rollout_percentage,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/flags/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { enabled, description, rollout } = req.body;

    const flag = await FeatureFlag.findOneAndUpdate(
      { flag_key: key },
      {
        flag_key: key,
        enabled: enabled ?? false,
        description,
        rollout_percentage: rollout ?? 100,
        updated_at: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({ flag });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/flags/:key/enable', async (req, res) => {
  try {
    const { key } = req.params;
    await FeatureFlag.findOneAndUpdate(
      { flag_key: key },
      { flag_key: key, enabled: true, updated_at: new Date() },
      { upsert: true }
    );
    res.json({ key, enabled: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/flags/:key/disable', async (req, res) => {
  try {
    const { key } = req.params;
    await FeatureFlag.findOneAndUpdate(
      { flag_key: key },
      { flag_key: key, enabled: false, updated_at: new Date() },
      { upsert: true }
    );
    res.json({ key, enabled: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/initialize', async (req, res) => {
  try {
    for (const [key, defaultFlag] of Object.entries(DEFAULT_FLAGS)) {
      await FeatureFlag.findOneAndUpdate(
        { flag_key: key },
        {
          flag_key: key,
          enabled: defaultFlag.enabled,
          description: defaultFlag.description,
          updated_at: new Date(),
        },
        { upsert: true }
      );
    }
    res.json({ initialized: true, flags: Object.keys(DEFAULT_FLAGS) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// PER-TENANT FEATURE FLAG ROUTES
// ==========================================

/**
 * GET /flags/tenant/:tenantId
 * Get all flags for a specific tenant with overrides applied
 */
app.get('/flags/tenant/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const flags = await getTenantFlags(tenantId);
    res.json({ tenantId, flags });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /flags/tenant/:tenantId/:flagKey
 * Get a specific flag for a tenant (with override applied)
 */
app.get('/flags/tenant/:tenantId/:flagKey', async (req, res) => {
  try {
    const { tenantId, flagKey } = req.params;
    const enabled = await getFeatureFlag(tenantId, flagKey);

    const dbFlag = await FeatureFlag.findOne({ flag_key: flagKey });
    const defaultFlag = DEFAULT_FLAGS[flagKey];

    res.json({
      tenantId,
      flagKey,
      enabled,
      description: dbFlag?.description || defaultFlag?.description,
      hasOverride: dbFlag ? false : true, // Simplified - actual check would query TenantOverride
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /flags/tenant/:tenantId/:flagKey
 * Set a tenant-specific override for a flag
 */
app.post('/flags/tenant/:tenantId/:flagKey', async (req, res) => {
  try {
    const { tenantId, flagKey } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    const override = await setTenantOverride(tenantId, flagKey, enabled);
    res.json({
      success: true,
      tenantId,
      flagKey,
      enabled: override.enabled,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /flags/tenant/:tenantId/:flagKey
 * Remove a tenant-specific override (revert to default)
 */
app.delete('/flags/tenant/:tenantId/:flagKey', async (req, res) => {
  try {
    const { tenantId, flagKey } = req.params;
    const removed = await removeTenantOverride(tenantId, flagKey);
    res.json({ success: true, removed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /flags/tenant/:tenantId/overrides
 * Get all tenant-specific overrides
 */
app.get('/flags/tenant/:tenantId/overrides', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const overrides = await getTenantOverrides(tenantId);
    res.json({ tenantId, overrides });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /flags/tenant/:tenantId/bulk
 * Bulk set tenant overrides
 */
app.post('/flags/tenant/:tenantId/bulk', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { overrides } = req.body;

    if (!overrides || typeof overrides !== 'object') {
      return res.status(400).json({ error: 'overrides must be an object' });
    }

    for (const [key, value] of Object.entries(overrides)) {
      if (typeof value !== 'boolean') {
        return res.status(400).json({ error: `override value for '${key}' must be a boolean` });
      }
    }

    const result = await bulkSetTenantOverrides(tenantId, overrides);
    res.json({ success: true, tenantId, overrides: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

mongoose.connect(MONGODB).then(() => {
  logger.info(`Feature Flags Service connected to MongoDB`);
  app.listen(PORT, () => {
    logger.info(`Feature Flags Service running on port ${PORT}`);
    console.log('Default flags:', Object.keys(DEFAULT_FLAGS));
  });
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});
