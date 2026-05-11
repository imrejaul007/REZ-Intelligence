/**
 * Feature Routes - REST API endpoints for ML Feature Store
 * Implements CRUD operations for feature management and serving
 */

import { Router, Request, Response, NextFunction } from 'express';
import { featureService, GetFeaturesRequest, SetFeaturesRequest } from '../services/feature.service';
import { FeatureCategory, FEATURE_BY_NAME, VALID_CATEGORIES } from '../config/features';

const router = Router();

// Error handling wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation helpers
const validateEntityId = (entityId: string): boolean => {
  const validEntityIds = ['userId', 'merchantId', 'transactionId'];
  return validEntityIds.includes(entityId);
};

const validateCategory = (category: string): boolean => {
  return VALID_CATEGORIES.includes(category as FeatureCategory);
};

/**
 * GET /api/features/health
 * Health check endpoint
 */
router.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    const health = await featureService.healthCheck();
    const status = health.status === 'healthy' ? 200 : 503;
    res.status(status).json(health);
  })
);

/**
 * GET /api/features/stats
 * Get feature store statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await featureService.getFeatureStats();
    res.json(stats);
  })
);

/**
 * GET /api/features/definitions
 * Get feature definitions
 */
router.get(
  '/definitions',
  asyncHandler(async (req: Request, res: Response) => {
    const { category, entityId, tags } = req.query;

    const definitions = featureService.getFeatureDefinitions({
      category: category as FeatureCategory | undefined,
      entityId: entityId as string | undefined,
      tags: tags ? (tags as string).split(',') : undefined,
    });

    res.json({
      definitions,
      total: definitions.length,
    });
  })
);

/**
 * GET /api/features/definitions/:name
 * Get a specific feature definition
 */
router.get(
  '/definitions/:name',
  asyncHandler(async (req: Request, res: Response) => {
    const definition = FEATURE_BY_NAME.get(req.params.name);

    if (!definition) {
      res.status(404).json({ error: `Feature not found: ${req.params.name}` });
      return;
    }

    res.json(definition);
  })
);

/**
 * GET /api/features/:entityId/:entityValue
 * Get features for a single entity
 */
router.get(
  '/:entityId/:entityValue',
  asyncHandler(async (req: Request, res: Response) => {
    const { entityId, entityValue } = req.params;
    const { features: featureNames } = req.query;

    if (!validateEntityId(entityId)) {
      res.status(400).json({
        error: `Invalid entityId: ${entityId}`,
        validEntityIds: ['userId', 'merchantId', 'transactionId'],
      });
      return;
    }

    const request: GetFeaturesRequest = {
      entityId,
      entityValues: [entityValue],
      featureNames: featureNames
        ? (featureNames as string).split(',')
        : undefined,
    };

    const result = await featureService.getFeatures(request);
    res.json(result);
  })
);

/**
 * POST /api/features/batch-get
 * Get features for multiple entities
 */
router.post(
  '/batch-get',
  asyncHandler(async (req: Request, res: Response) => {
    const { entityId, entityValues, featureNames } = req.body;

    // Validation
    if (!entityId) {
      res.status(400).json({ error: 'entityId is required' });
      return;
    }

    if (!Array.isArray(entityValues) || entityValues.length === 0) {
      res.status(400).json({ error: 'entityValues must be a non-empty array' });
      return;
    }

    if (!validateEntityId(entityId)) {
      res.status(400).json({
        error: `Invalid entityId: ${entityId}`,
        validEntityIds: ['userId', 'merchantId', 'transactionId'],
      });
      return;
    }

    const request: GetFeaturesRequest = {
      entityId,
      entityValues,
      featureNames,
    };

    const result = await featureService.getFeatures(request);
    res.json(result);
  })
);

/**
 * POST /api/features
 * Create or update features for an entity
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { entityId, entityValue, features, category, source, tags } = req.body;

    // Validation
    if (!entityId || !entityValue) {
      res.status(400).json({ error: 'entityId and entityValue are required' });
      return;
    }

    if (!features || typeof features !== 'object' || Object.keys(features).length === 0) {
      res.status(400).json({ error: 'features must be a non-empty object' });
      return;
    }

    if (!validateEntityId(entityId)) {
      res.status(400).json({
        error: `Invalid entityId: ${entityId}`,
        validEntityIds: ['userId', 'merchantId', 'transactionId'],
      });
      return;
    }

    if (category && !validateCategory(category)) {
      res.status(400).json({
        error: `Invalid category: ${category}`,
        validCategories: VALID_CATEGORIES,
      });
      return;
    }

    const request: SetFeaturesRequest = {
      entityId,
      entityValue,
      features,
      category: category as FeatureCategory | undefined,
      source,
      tags,
    };

    const result = await featureService.setFeatures(request);
    res.status(201).json(result.toFeaturePoint());
  })
);

/**
 * POST /api/features/batch
 * Batch create or update features for multiple entities
 */
router.post(
  '/batch',
  asyncHandler(async (req: Request, res: Response) => {
    const { entityId, entities, category, source } = req.body;

    // Validation
    if (!entityId) {
      res.status(400).json({ error: 'entityId is required' });
      return;
    }

    if (!Array.isArray(entities) || entities.length === 0) {
      res.status(400).json({ error: 'entities must be a non-empty array' });
      return;
    }

    if (!validateEntityId(entityId)) {
      res.status(400).json({
        error: `Invalid entityId: ${entityId}`,
        validEntityIds: ['userId', 'merchantId', 'transactionId'],
      });
      return;
    }

    if (category && !validateCategory(category)) {
      res.status(400).json({
        error: `Invalid category: ${category}`,
        validCategories: VALID_CATEGORIES,
      });
      return;
    }

    // Validate each entity has value and features
    for (const entity of entities) {
      if (!entity.value) {
        res.status(400).json({ error: 'Each entity must have a value field' });
        return;
      }
      if (!entity.features || typeof entity.features !== 'object') {
        res.status(400).json({ error: 'Each entity must have a features object' });
        return;
      }
    }

    const result = await featureService.batchSetFeatures({
      entityId,
      entities,
      category: category as FeatureCategory | undefined,
      source,
    });

    res.status(201).json({
      created: result.length,
      features: result.map((doc) => doc.toFeaturePoint()),
    });
  })
);

/**
 * PUT /api/features/:entityId/:entityValue
 * Update features for an entity (merge with existing)
 */
router.put(
  '/:entityId/:entityValue',
  asyncHandler(async (req: Request, res: Response) => {
    const { entityId, entityValue } = req.params;
    const { features, source, tags } = req.body;

    // Validation
    if (!validateEntityId(entityId)) {
      res.status(400).json({
        error: `Invalid entityId: ${entityId}`,
        validEntityIds: ['userId', 'merchantId', 'transactionId'],
      });
      return;
    }

    if (!features || typeof features !== 'object') {
      res.status(400).json({ error: 'features must be an object' });
      return;
    }

    // Get existing features
    const existing = await featureService.getFeatures({
      entityId,
      entityValues: [entityValue],
    });

    // Merge with new features
    const mergedFeatures = {
      ...existing.features[0]?.features,
      ...features,
    };

    const result = await featureService.setFeatures({
      entityId,
      entityValue,
      features: mergedFeatures,
      source,
      tags,
    });

    res.json(result.toFeaturePoint());
  })
);

/**
 * DELETE /api/features/:entityId/:entityValue
 * Delete all features for an entity
 */
router.delete(
  '/:entityId/:entityValue',
  asyncHandler(async (req: Request, res: Response) => {
    const { entityId, entityValue } = req.params;

    if (!validateEntityId(entityId)) {
      res.status(400).json({
        error: `Invalid entityId: ${entityId}`,
        validEntityIds: ['userId', 'merchantId', 'transactionId'],
      });
      return;
    }

    const deleted = await featureService.deleteFeatures(entityId, entityValue);

    if (!deleted) {
      res.status(404).json({ error: 'Entity not found' });
      return;
    }

    res.status(204).send();
  })
);

/**
 * GET /api/features/:entityId/:entityValue/:featureName
 * Get a specific feature value
 */
router.get(
  '/:entityId/:entityValue/:featureName',
  asyncHandler(async (req: Request, res: Response) => {
    const { entityId, entityValue, featureName } = req.params;

    if (!validateEntityId(entityId)) {
      res.status(400).json({
        error: `Invalid entityId: ${entityId}`,
        validEntityIds: ['userId', 'merchantId', 'transactionId'],
      });
      return;
    }

    const result = await featureService.getFeatures({
      entityId,
      entityValues: [entityValue],
      featureNames: [featureName],
    });

    const value = result.features[0]?.features[featureName];

    if (value === undefined) {
      res.status(404).json({ error: 'Feature not found' });
      return;
    }

    const definition = FEATURE_BY_NAME.get(featureName);

    res.json({
      entityId,
      entityValue,
      featureName,
      value,
      type: definition?.type ?? 'unknown',
      lastUpdated: result.features[0]?.lastUpdated,
    });
  })
);

/**
 * POST /api/features/aggregate
 * Compute aggregations over feature values
 */
router.post(
  '/aggregate',
  asyncHandler(async (req: Request, res: Response) => {
    const { entityId, entityValue, featureName, windowStart, windowEnd } = req.body;

    // Validation
    if (!entityId || !entityValue || !featureName) {
      res.status(400).json({
        error: 'entityId, entityValue, and featureName are required',
      });
      return;
    }

    if (!windowStart || !windowEnd) {
      res.status(400).json({ error: 'windowStart and windowEnd are required' });
      return;
    }

    const result = await featureService.computeAggregation({
      entityId,
      entityValue,
      featureName,
      windowStart: new Date(windowStart),
      windowEnd: new Date(windowEnd),
    });

    res.json({
      entityId,
      entityValue,
      featureName,
      aggregation: result,
      windowStart,
      windowEnd,
    });
  })
);

/**
 * GET /api/features/categories
 * List all feature categories
 */
router.get(
  '/categories',
  asyncHandler(async (req: Request, res: Response) => {
    const categories = Object.values(FeatureCategory);
    const result = categories.map((cat) => ({
      name: cat,
      count: featureService.getFeatureDefinitions({ category: cat }).length,
    }));

    res.json(result);
  })
);

export default router;
