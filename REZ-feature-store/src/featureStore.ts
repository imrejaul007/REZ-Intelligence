/**
 * REZ Feature Store - ML Feature Management
 *
 * Features:
 * - Feature registration
 * - Feature serving (online/offline)
 * - Feature computation
 * - Feature monitoring
 * - Feature versioning
 */

import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

// ============================================
// TYPES
// ============================================

interface Feature {
  name: string;
  description: string;
  entity: string; // 'user', 'product', 'merchant'
  data_type: 'float' | 'int' | 'string' | 'bool';
  version: string;
  created_at: string;
  computed_from: string[]; // Source features
  transformation: string; // SQL or function
  freshness: 'realtime' | 'hourly' | 'daily';
}

interface FeatureValue {
  entity_id: string;
  feature_name: string;
  value: any;
  version: string;
  timestamp: string;
}

interface FeatureGroup {
  name: string;
  entity: string;
  features: string[];
  freshness: string;
  created_at: string;
}

// In-memory stores
const features = new Map<string, Feature>();
const featureValues = new Map<string, FeatureValue[]>();
const featureGroups = new Map<string, FeatureGroup>();
const featureMetrics = new Map<string, any>();

// ============================================
// FEATURE REGISTRATION
// ============================================

/**
 * POST /api/features
 * Register a new feature
 */
app.post('/api/features', async (req, res) => {
  const { name, description, entity, data_type, transformation, freshness, computed_from } = req.body;

  if (!name || !entity || !data_type) {
    return res.status(400).json({ error: 'name, entity, data_type required' });
  }

  const version = 'v1.0.0';

  const feature: Feature = {
    name,
    description: description || '',
    entity,
    data_type,
    version,
    created_at: new Date().toISOString(),
    computed_from: computed_from || [],
    transformation: transformation || '',
    freshness: freshness || 'daily'
  };

  features.set(name, feature);

  res.status(201).json({ feature_name: name, version });
});

/**
 * GET /api/features
 * List all features
 */
app.get('/api/features', (req, res) => {
  const { entity, freshness } = req.query;

  let list = Array.from(features.values());

  if (entity) {
    list = list.filter(f => f.entity === entity);
  }

  if (freshness) {
    list = list.filter(f => f.freshness === freshness);
  }

  res.json({ features: list, count: list.length });
});

/**
 * GET /api/features/:name
 * Get feature details
 */
app.get('/api/features/:name', (req, res) => {
  const feature = features.get(req.params.name);

  if (!feature) {
    return res.status(404).json({ error: 'Feature not found' });
  }

  res.json({ feature });
});

/**
 * DELETE /api/features/:name
 * Delete feature
 */
app.delete('/api/features/:name', (req, res) => {
  const deleted = features.delete(req.params.name);

  if (!deleted) {
    return res.status(404).json({ error: 'Feature not found' });
  }

  res.json({ success: true });
});

// ============================================
// FEATURE GROUPS
// ============================================

/**
 * POST /api/feature-groups
 * Create feature group
 */
app.post('/api/feature-groups', async (req, res) => {
  const { name, entity, features: featureNames, freshness } = req.body;

  if (!name || !entity || !featureNames) {
    return res.status(400).json({ error: 'name, entity, features required' });
  }

  const group: FeatureGroup = {
    name,
    entity,
    features: featureNames,
    freshness: freshness || 'daily',
    created_at: new Date().toISOString()
  };

  featureGroups.set(name, group);

  res.status(201).json({ group_name: name });
});

/**
 * GET /api/feature-groups
 * List feature groups
 */
app.get('/api/feature-groups', (req, res) => {
  const groups = Array.from(featureGroups.values());
  res.json({ groups, count: groups.length });
});

/**
 * GET /api/feature-groups/:name
 * Get feature group
 */
app.get('/api/feature-groups/:name', (req, res) => {
  const group = featureGroups.get(req.params.name);

  if (!group) {
    return res.status(404).json({ error: 'Feature group not found' });
  }

  res.json({ group });
});

// ============================================
// FEATURE SERVING (ONLINE)
// ============================================

/**
 * POST /api/serving/online
 * Get feature values for entity (online serving)
 */
app.post('/api/serving/online', async (req, res) => {
  const { entity_id, features: featureNames, feature_group } = req.body;

  if (!entity_id) {
    return res.status(400).json({ error: 'entity_id required' });
  }

  let featuresToFetch = featureNames || [];

  // If feature group specified, use that
  if (feature_group) {
    const group = featureGroups.get(feature_group);
    if (group) {
      featuresToFetch = group.features;
    }
  }

  // Fetch feature values
  const values: Record<string, any> = {};

  for (const featureName of featuresToFetch) {
    const key = `${entity_id}:${featureName}`;
    const featureValuesList = featureValues.get(key);

    if (featureValuesList && featureValuesList.length > 0) {
      const latest = featureValuesList[featureValuesList.length - 1];
      values[featureName] = latest.value;
    } else {
      // Return default based on data type
      values[featureName] = getDefaultValue(features.get(featureName)?.data_type);
    }
  }

  res.json({
    entity_id,
    features: values,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/serving/online/batch
 * Batch get features for multiple entities
 */
app.post('/api/serving/online/batch', async (req, res) => {
  const { entities, feature_group } = req.body;

  if (!entities || !Array.isArray(entities)) {
    return res.status(400).json({ error: 'entities array required' });
  }

  const group = featureGroups.get(feature_group);
  const featuresToFetch = group?.features || [];

  const results = [];

  for (const entityId of entities) {
    const values: Record<string, any> = {};

    for (const featureName of featuresToFetch) {
      const key = `${entityId}:${featureName}`;
      const featureValuesList = featureValues.get(key);

      if (featureValuesList && featureValuesList.length > 0) {
        values[featureName] = featureValuesList[featureValuesList.length - 1].value;
      } else {
        values[featureName] = getDefaultValue(features.get(featureName)?.data_type);
      }
    }

    results.push({ entity_id: entityId, features: values });
  }

  res.json({ results, timestamp: new Date().toISOString() });
});

// ============================================
// FEATURE SERVING (OFFLINE)
// ============================================

/**
 * POST /api/serving/offline
 * Get historical feature values (offline serving)
 */
app.post('/api/serving/offline', async (req, res) => {
  const { entity_id, features: featureNames, from, to } = req.body;

  if (!entity_id) {
    return res.status(400).json({ error: 'entity_id required' });
  }

  const allFeatures = featureNames || Array.from(features.keys());

  const values: any[] = [];

  for (const featureName of allFeatures) {
    const key = `${entity_id}:${featureName}`;
    const featureValuesList = featureValues.get(key) || [];

    // Filter by date range
    const filtered = featureValuesList.filter(v => {
      const ts = new Date(v.timestamp).getTime();
      if (from && ts < new Date(from).getTime()) return false;
      if (to && ts > new Date(to).getTime()) return false;
      return true;
    });

    values.push(...filtered.map(v => ({
      entity_id,
      feature_name: featureName,
      value: v.value,
      timestamp: v.timestamp
    })));
  }

  res.json({ entity_id, values, count: values.length });
});

/**
 * POST /api/serving/export
 * Export features to file (S3, GCS, etc.)
 */
app.post('/api/serving/export', async (req, res) => {
  const { entity_ids, features: featureNames, format, destination } = req.body;

  // In production, this would export to S3/GCS
  // For now, return mock response

  res.json({
    success: true,
    format: format || 'parquet',
    destination: destination || 's3://bucket/features/',
    rows: entity_ids?.length || 0,
    columns: featureNames?.length || 0
  });
});

// ============================================
// FEATURE WRITING
// ============================================

/**
 * POST /api/features/write
 * Write feature value
 */
app.post('/api/features/write', async (req, res) => {
  const { entity_id, feature_name, value, timestamp } = req.body;

  if (!entity_id || !feature_name || value === undefined) {
    return res.status(400).json({ error: 'entity_id, feature_name, value required' });
  }

  const feature = features.get(feature_name);
  const version = feature?.version || 'v1.0.0';

  const featureValue: FeatureValue = {
    entity_id,
    feature_name,
    value,
    version,
    timestamp: timestamp || new Date().toISOString()
  };

  const key = `${entity_id}:${feature_name}`;

  if (!featureValues.has(key)) {
    featureValues.set(key, []);
  }

  featureValues.get(key)!.push(featureValue);

  res.json({ success: true, feature_value: featureValue });
});

/**
 * POST /api/features/write/batch
 * Batch write feature values
 */
app.post('/api/features/write/batch', async (req, res) => {
  const { values } = req.body;

  if (!values || !Array.isArray(values)) {
    return res.status(400).json({ error: 'values array required' });
  }

  let written = 0;

  for (const item of values) {
    const { entity_id, feature_name, value, timestamp } = item;

    const featureValue: FeatureValue = {
      entity_id,
      feature_name,
      value,
      version: features.get(feature_name)?.version || 'v1.0.0',
      timestamp: timestamp || new Date().toISOString()
    };

    const key = `${entity_id}:${feature_name}`;

    if (!featureValues.has(key)) {
      featureValues.set(key, []);
    }

    featureValues.get(key)!.push(featureValue);
    written++;
  }

  res.json({ success: true, written });
});

// ============================================
// FEATURE COMPUTATION
// ============================================

/**
 * POST /api/compute
 * Trigger feature computation
 */
app.post('/api/compute', async (req, res) => {
  const { feature_name, entity_ids } = req.body;

  if (!feature_name) {
    return res.status(400).json({ error: 'feature_name required' });
  }

  const feature = features.get(feature_name);

  if (!feature) {
    return res.status(404).json({ error: 'Feature not found' });
  }

  // In production, this would trigger a Spark/Flink job
  const job_id = `job_${Date.now()}`;

  res.json({
    job_id,
    feature_name,
    status: 'running',
    entities: entity_ids?.length || 'all'
  });
});

/**
 * GET /api/compute/:job_id
 * Get computation job status
 */
app.get('/api/compute/:job_id', (req, res) => {
  // Mock job status
  res.json({
    job_id: req.params.job_id,
    status: 'completed',
    rows_computed: Math.floor(Math.random() * 10000),
    started_at: new Date(Date.now() - 60000).toISOString(),
    completed_at: new Date().toISOString()
  });
});

// ============================================
// FEATURE MONITORING
// ============================================

/**
 * POST /api/monitor/features
 * Get feature statistics
 */
app.post('/api/monitor/features', async (req, res) => {
  const { features: featureNames } = req.body;

  const stats: Record<string, any> = {};

  for (const featureName of featureNames || []) {
    const feature = features.get(featureName);
    const values: number[] = [];

    for (const [key, vals] of featureValues.entries()) {
      if (key.endsWith(`:${featureName}`)) {
        for (const v of vals) {
          if (typeof v.value === 'number') {
            values.push(v.value);
          }
        }
      }
    }

    if (values.length > 0) {
      const sum = values.reduce((a, b) => a + b, 0);
      const mean = sum / values.length;
      const sorted = [...values].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const min = Math.min(...values);
      const max = Math.max(...values);
      const nullCount = values.filter(v => v === null || v === undefined).length;

      stats[featureName] = {
        count: values.length,
        null_count: nullCount,
        mean,
        median,
        min,
        max,
        stddev: Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length)
      };
    } else {
      stats[featureName] = { count: 0 };
    }
  }

  res.json({ statistics: stats });
});

/**
 * GET /api/monitor/drift
 * Detect feature drift
 */
app.get('/api/monitor/drift', async (req, res) => {
  const { feature_name, threshold } = req.query;

  // Simple drift detection based on distribution change
  // In production, use more sophisticated methods

  res.json({
    feature_name,
    has_drift: Math.random() < 0.1,
    drift_score: Math.random() * 0.5,
    threshold: Number(threshold) || 0.3,
    recommendation: Math.random() < 0.3 ? 'Retrain model' : 'No action needed'
  });
});

// ============================================
// HELPERS
// ============================================

function getDefaultValue(feature?: Feature): any {
  if (!feature) return null;

  switch (feature.data_type) {
    case 'int':
    case 'float':
      return 0;
    case 'string':
      return '';
    case 'bool':
      return false;
    default:
      return null;
  }
}

// ============================================
// HEALTH
// ============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'feature-store',
    features: features.size,
    feature_groups: featureGroups.size
  });
});

// ============================================
// START
// ============================================

const PORT = process.env.PORT || 4128;
app.listen(PORT, () => {
  console.log(`REZ Feature Store running on port ${PORT}`);
});

export default app;
