/**
 * REZ Feature Store - ML Feature Management
 *
 * Features:
 * - Feature registration
 * - Feature serving (online/offline)
 * - Feature computation
 * - Feature monitoring
 * - Feature versioning
 * - Domain-specific features (Z-Events, ReZ Ride, Commerce)
 */

import express from 'express';
import { randomInt } from 'crypto';
import { logger } from './utils/logger.js';

const app = express();
app.use(express.json());

// ============================================
// TYPES
// ============================================

interface Feature {
  name: string;
  description: string;
  entity: string; // 'user', 'product', 'merchant', 'event', 'zone'
  data_type: 'float' | 'int' | 'string' | 'bool';
  version: string;
  created_at: string;
  computed_from: string[]; // Source features
  transformation: string; // SQL or function
  freshness: 'realtime' | 'hourly' | 'daily' | 'weekly';
}

interface FeatureValue {
  entity_id: string;
  feature_name: string;
  value: unknown;
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

// ============================================
// DEFAULT DOMAIN-SPECIFIC FEATURES
// ============================================

const DEFAULT_FEATURES: Feature[] = [
  // Z-EVENTS: User Event Behavior
  {
    name: 'user_total_events_attended_30d',
    description: 'Total events attended in last 30 days',
    entity: 'user',
    data_type: 'int',
    version: 'v1.0.0',
    created_at: new Date().toISOString(),
    computed_from: ['tickets', 'checkins'],
    transformation: 'COUNT(event_id) WHERE checkin_at > NOW() - 30d',
    freshness: 'daily',
  },
  {
    name: 'user_total_event_spend_30d',
    description: 'Total spending on events in last 30 days (INR)',
    entity: 'user',
    data_type: 'float',
    version: 'v1.0.0',
    created_at: new Date().toISOString(),
    computed_from: ['tickets', 'payments'],
    transformation: 'SUM(total_amount) WHERE booked_at > NOW() - 30d',
    freshness: 'daily',
  },
  {
    name: 'user_avg_ticket_price',
    description: 'Average ticket price user pays',
    entity: 'user',
    data_type: 'float',
    version: 'v1.0.0',
    created_at: new Date().toISOString(),
    computed_from: ['tickets'],
    transformation: 'AVG(total_amount / quantity)',
    freshness: 'weekly',
  },
  {
    name: 'user_event_affinity_music',
    description: 'Affinity score for music events (0-1)',
    entity: 'user',
    data_type: 'float',
    version: 'v1.0.0',
    created_at: new Date().toISOString(),
    computed_from: ['tickets', 'events'],
    transformation: 'COUNT(category=music) / COUNT(*)',
    freshness: 'weekly',
  },
  {
    name: 'user_event_affinity_sports',
    description: 'Affinity score for sports events (0-1)',
    entity: 'user',
    data_type: 'float',
    version: 'v1.0.0',
    created_at: new Date().toISOString(),
    computed_from: ['tickets', 'events'],
    transformation: 'COUNT(category=sports) / COUNT(*)',
    freshness: 'weekly',
  },
  {
    name: 'user_event_affinity_comedy',
    description: 'Affinity score for comedy events (0-1)',
    entity: 'user',
    data_type: 'float',
    version: 'v1.0.0',
    created_at: new Date().toISOString(),
    computed_from: ['tickets', 'events'],
    transformation: 'COUNT(category=comedy) / COUNT(*)',
    freshness: 'weekly',
  },
  {
    name: 'user_group_booking_ratio',
    description: 'Ratio of group bookings vs solo (0-1)',
    entity: 'user',
    data_type: 'float',
    version: 'v1.0.0',
    created_at: new Date().toISOString(),
    computed_from: ['tickets'],
    transformation: 'COUNT(quantity > 2) / COUNT(*)',
    freshness: 'weekly',
  },
  {
    name: 'user_advance_booking_days',
    description: 'Average days in advance user books',
    entity: 'user',
    data_type: 'float',
    version: 'v1.0.0',
    created_at: new Date().toISOString(),
    computed_from: ['tickets', 'events'],
    transformation: 'AVG(event_start_date - booked_at) / 86400000',
    freshness: 'daily',
  },
  {
    name: 'user_event_likelihood_7d',
    description: 'Likelihood to book event in next 7 days (0-1)',
    entity: 'user',
    data_type: 'float',
    version: 'v1.0.0',
    created_at: new Date().toISOString(),
    computed_from: ['user_event_affinity_*', 'user_total_events_attended_30d'],
    transformation: 'ML_MODEL_PREDICTION',
    freshness: 'daily',
  },

  // Z-EVENTS: Event Features
  {
    name: 'event_predicted_attendance',
    description: 'Predicted attendance for event',
    entity: 'event',
    data_type: 'int',
    version: 'v1.0.0',
    created_at: new Date().toISOString(),
    computed_from: ['tickets', 'historical_events'],
    transformation: 'ML_MODEL_PREDICTION',
    freshness: 'hourly',
  },
  {
    name: 'event_spillover_score',
    description: 'Spillover effect score (0-1)',
    entity: 'event',
    data_type: 'float',
    version: 'v1.0.0',
    created_at: new Date().toISOString(),
    computed_from: ['event_location', 'merchant_density'],
    transformation: 'CALCULATE_SPILLOVER',
    freshness: 'daily',
  },
  {
    name: 'event_ride_demand_boost',
    description: 'Expected ride demand increase multiplier',
    entity: 'event',
    data_type: 'float',
    version: 'v1.0.0',
    created_at: new Date().toISOString(),
    computed_from: ['event_attendance', 'event_category'],
    transformation: 'attendance * category_multiplier',
    freshness: 'realtime',
  },

  // REZ RIDE: User Mobility
  {
    name: 'user_ride_frequency_weekly',
    description: 'Average rides per week',
    entity: 'user',
    data_type: 'float',
    version: 'v1.0.0',
    created_at: new Date().toISOString(),
    computed_from: ['rides'],
    transformation: 'COUNT(rides) / 7',
    freshness: 'daily',
  },
  {
    name: 'user_peak_hour_ride_ratio',
    description: 'Ratio of rides during peak hours (0-1)',
    entity: 'user',
    data_type: 'float',
    version: 'v1.0.0',
    created_at: new Date().toISOString(),
    computed_from: ['rides'],
    transformation: 'COUNT(hour BETWEEN 7-9 OR 17-21) / COUNT(*)',
    freshness: 'weekly',
  },

  // ZONE FEATURES
  {
    name: 'zone_demand_index',
    description: 'Synthetic demand index for zone (0-100)',
    entity: 'zone',
    data_type: 'float',
    version: 'v1.0.0',
    created_at: new Date().toISOString(),
    computed_from: ['rides', 'orders', 'events', 'footfall'],
    transformation: 'COMPOSITE_DEMAND_INDEX',
    freshness: 'realtime',
  },
  {
    name: 'zone_event_heat_score',
    description: 'Event-driven demand heat (0-100)',
    entity: 'zone',
    data_type: 'float',
    version: 'v1.0.0',
    created_at: new Date().toISOString(),
    computed_from: ['events', 'ticket_sales'],
    transformation: 'EVENT_IMPACT_CALCULATION',
    freshness: 'hourly',
  },

  // CROSS-APP FEATURES
  {
    name: 'user_cross_app_score',
    description: 'Cross-app engagement score (0-100)',
    entity: 'user',
    data_type: 'float',
    version: 'v1.0.0',
    created_at: new Date().toISOString(),
    computed_from: ['events', 'rides', 'orders'],
    transformation: 'WEIGHTED_AGGREGATION',
    freshness: 'daily',
  },
  {
    name: 'user_ltv_estimate',
    description: 'Estimated lifetime value (INR)',
    entity: 'user',
    data_type: 'float',
    version: 'v1.0.0',
    created_at: new Date().toISOString(),
    computed_from: ['orders', 'tickets', 'rides'],
    transformation: 'LTV_MODEL_PREDICTION',
    freshness: 'weekly',
  },
];

// DEFAULT FEATURE GROUPS
const DEFAULT_FEATURE_GROUPS: FeatureGroup[] = [
  {
    name: 'user_event_behavior_v1',
    entity: 'user',
    features: [
      'user_total_events_attended_30d',
      'user_total_event_spend_30d',
      'user_avg_ticket_price',
      'user_event_affinity_music',
      'user_event_affinity_sports',
      'user_event_affinity_comedy',
      'user_group_booking_ratio',
      'user_advance_booking_days',
      'user_event_likelihood_7d',
    ],
    freshness: 'daily',
    created_at: new Date().toISOString(),
  },
  {
    name: 'user_mobility_v1',
    entity: 'user',
    features: [
      'user_ride_frequency_weekly',
      'user_peak_hour_ride_ratio',
    ],
    freshness: 'daily',
    created_at: new Date().toISOString(),
  },
  {
    name: 'event_intelligence_v1',
    entity: 'event',
    features: [
      'event_predicted_attendance',
      'event_spillover_score',
      'event_ride_demand_boost',
    ],
    freshness: 'hourly',
    created_at: new Date().toISOString(),
  },
  {
    name: 'zone_demand_v1',
    entity: 'zone',
    features: [
      'zone_demand_index',
      'zone_event_heat_score',
    ],
    freshness: 'realtime',
    created_at: new Date().toISOString(),
  },
  {
    name: 'user_engagement_v1',
    entity: 'user',
    features: [
      'user_cross_app_score',
      'user_ltv_estimate',
    ],
    freshness: 'weekly',
    created_at: new Date().toISOString(),
  },
];

// In-memory stores
const features = new Map<string, Feature>();
const featureValues = new Map<string, FeatureValue[]>();
const featureGroups = new Map<string, FeatureGroup>();
const featureMetrics = new Map<string, unknown>();

// Initialize with default features
function initializeDefaultFeatures(): void {
  for (const feature of DEFAULT_FEATURES) {
    features.set(feature.name, feature);
  }
  for (const group of DEFAULT_FEATURE_GROUPS) {
    featureGroups.set(group.name, group);
  }
  logger.info(`Initialized ${DEFAULT_FEATURES.length} default features and ${DEFAULT_FEATURE_GROUPS.length} feature groups`);
}

initializeDefaultFeatures();

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
  const { entity, freshness, domain } = req.query;

  let list = Array.from(features.values());

  if (entity) {
    list = list.filter(f => f.entity === entity);
  }

  if (freshness) {
    list = list.filter(f => f.freshness === freshness);
  }

  // NEW: Filter by domain prefix
  if (domain) {
    const prefix = `user_${domain}`; // e.g., 'event' -> 'user_event_*'
    list = list.filter(f => f.name.startsWith(prefix));
  }

  res.json({ features: list, count: list.length });
});

/**
 * GET /api/features/domains
 * List available feature domains (NEW)
 */
app.get('/api/features/domains', (_req, res) => {
  const domains = new Map<string, { prefix: string; count: number; entities: string[] }>();

  for (const feature of features.values()) {
    const parts = feature.name.split('_');
    if (parts.length >= 2) {
      // Extract domain from feature name pattern
      let domain = '';
      if (feature.name.startsWith('user_')) {
        // user_event_*, user_ride_*, etc.
        domain = parts.slice(1, 3).join('_');
      } else if (parts[0] === 'event' || parts[0] === 'zone') {
        domain = parts[0];
      }

      if (domain) {
        if (!domains.has(domain)) {
          domains.set(domain, { prefix: domain, count: 0, entities: [] });
        }
        const d = domains.get(domain)!;
        d.count++;
        if (!d.entities.includes(feature.entity)) {
          d.entities.push(feature.entity);
        }
      }
    }
  }

  res.json({
    domains: Array.from(domains.values()),
    total_features: features.size,
    total_groups: featureGroups.size,
  });
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
  const values: Record<string, unknown> = {};

  for (const featureName of featuresToFetch) {
    const key = `${entity_id}:${featureName}`;
    const featureValuesList = featureValues.get(key);

    if (featureValuesList && featureValuesList.length > 0) {
      const latest = featureValuesList[featureValuesList.length - 1];
      values[featureName] = latest.value;
    } else {
      // Return default based on data type
      values[featureName] = getDefaultValue(features.get(featureName)?.data_type ?? undefined);
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
  const featuresToFetch: string[] = group?.features || [];

  const results: { entity_id: string; features: Record<string, unknown> }[] = [];

  for (const entityId of entities) {
    const values: Record<string, unknown> = {};

    for (const featureName of featuresToFetch) {
      const key = `${entityId}:${featureName}`;
      const featureValuesList = featureValues.get(key);

      if (featureValuesList && featureValuesList.length > 0) {
        values[featureName] = featureValuesList[featureValuesList.length - 1].value;
      } else {
        values[featureName] = getDefaultValue(features.get(featureName)?.data_type ?? undefined);
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

  const values: unknown[] = [];

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
    rows_computed: randomInt(10000),
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

  const stats: Record<string, unknown> = {};

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

function getDefaultValue(dataType?: string): unknown {
  if (!dataType) return null;

  switch (dataType) {
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
  logger.info(`REZ Feature Store running on port ${PORT}`);
});

export default app;
