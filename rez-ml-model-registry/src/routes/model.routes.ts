import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { registryService, CreateModelDTO, UpdateModelDTO, SearchModelsDTO } from '../services/registry.service';

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const createModelSchema = Joi.object({
  name: Joi.string()
    .pattern(/^[a-z0-9-_]+$/)
    .min(1)
    .max(128)
    .required()
    .messages({
      'string.pattern.base': 'Name must contain only lowercase letters, numbers, hyphens, and underscores',
    }),
  namespace: Joi.string().pattern(/^[a-z0-9-_]+$/).max(64).default('default'),
  description: Joi.string().max(1000),
  metadata: Joi.object({
    task: Joi.string().required(),
    algorithm: Joi.string().required(),
    inputSchema: Joi.object().required(),
    outputSchema: Joi.object().required(),
    trainingDataInfo: Joi.object({
      datasetName: Joi.string(),
      datasetVersion: Joi.string(),
      size: Joi.number().min(0),
      splitRatio: Joi.object({
        train: Joi.number().min(0).max(1),
        validation: Joi.number().min(0).max(1),
        test: Joi.number().min(0).max(1),
      }),
    }),
    owner: Joi.string().required(),
    tags: Joi.array().items(Joi.string().max(64)).max(20),
    description: Joi.string().max(1000),
  }).required(),
});

const updateModelSchema = Joi.object({
  description: Joi.string().max(1000),
  tags: Joi.array().items(Joi.string().max(64)).max(20),
  stage: Joi.string().valid('development', 'staging', 'production', 'archived'),
});

const searchModelsSchema = Joi.object({
  query: Joi.string().max(256),
  task: Joi.string(),
  tags: Joi.array().items(Joi.string()),
  owner: Joi.string(),
  stage: Joi.string().valid('development', 'staging', 'production', 'archived'),
  framework: Joi.string(),
  minAccuracy: Joi.number().min(0).max(1),
  isArchived: Joi.boolean(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
});

const nameParamsSchema = Joi.object({
  namespace: Joi.string().pattern(/^[a-z0-9-_]+$/).default('default'),
  name: Joi.string().pattern(/^[a-z0-9-_]+$/).required(),
});

// ============================================
// Validation Middleware
// ============================================

const validate = (schema: Joi.Schema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
    const { error, value } = schema.validate(data, { abortEarly: false });

    if (error) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
        })),
      });
      return;
    }

    if (source === 'body') req.body = value;
    else if (source === 'query') req.query = value;
    else req.params = value;

    next();
  };
};

// ============================================
// Routes
// ============================================

/**
 * @route POST /api/v1/models
 * @description Register a new model
 */
router.post(
  '/',
  validate(createModelSchema, 'body'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const dto: CreateModelDTO = req.body;
      const model = await registryService.createModel(dto);

      res.status(201).json({
        message: 'Model registered successfully',
        model: {
          name: model.name,
          namespace: model.namespace,
          fullName: model.fullName,
          description: model.description,
          metadata: model.metadata,
          stage: model.stage,
          createdAt: model.createdAt,
          updatedAt: model.updatedAt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('already exists')) {
        res.status(409).json({ error: message });
      } else {
        res.status(500).json({ error: 'Failed to register model', details: message });
      }
    }
  }
);

/**
 * @route GET /api/v1/models
 * @description Search models with filters
 */
router.get(
  '/',
  validate(searchModelsSchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const dto: SearchModelsDTO = {
        query: req.query.query as string,
        task: req.query.task as string,
        tags: req.query.tags as string[],
        owner: req.query.owner as string,
        stage: req.query.stage as SearchModelsDTO['stage'],
        framework: req.query.framework as string,
        minAccuracy: req.query.minAccuracy ? parseFloat(req.query.minAccuracy as string) : undefined,
        isArchived: req.query.isArchived === 'true' ? true : req.query.isArchived === 'false' ? false : undefined,
        limit: parseInt(req.query.limit as string) || 20,
        offset: parseInt(req.query.offset as string) || 0,
      };

      const result = await registryService.searchModels(dto);

      res.json({
        models: result.models.map((m) => ({
          name: m.name,
          namespace: m.namespace,
          fullName: m.fullName,
          description: m.description,
          metadata: m.metadata,
          stage: m.stage,
          latestVersion: m.latestVersion,
          versionCount: m.versionCount,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })),
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.offset + result.models.length < result.total,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to search models', details: message });
    }
  }
);

/**
 * @route GET /api/v1/models/stats
 * @description Get registry statistics
 */
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await registryService.getModelStats();
    res.json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to get stats', details: message });
  }
});

/**
 * @route GET /api/v1/models/:namespace/:name
 * @description Get model by name
 */
router.get(
  '/:namespace/:name',
  validate(nameParamsSchema, 'params'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, name } = req.params;
      const model = await registryService.getModel(namespace, name);

      if (!model) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }

      res.json({
        name: model.name,
        namespace: model.namespace,
        fullName: model.fullName,
        description: model.description,
        metadata: model.metadata,
        stage: model.stage,
        isArchived: model.isArchived,
        latestVersion: model.latestVersion,
        versionCount: model.versionCount,
        versions: model.versions.map((v) => ({
          version: v.version,
          modelUri: v.modelUri,
          description: v.description,
          createdAt: v.createdAt,
          createdBy: v.createdBy,
          fileSize: v.fileSize,
          framework: v.framework,
          frameworkVersion: v.frameworkVersion,
          status: v.status,
          metrics: v.metrics,
        })),
        createdAt: model.createdAt,
        updatedAt: model.updatedAt,
        archivedAt: model.archivedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to get model', details: message });
    }
  }
);

/**
 * @route PATCH /api/v1/models/:namespace/:name
 * @description Update model metadata
 */
router.patch(
  '/:namespace/:name',
  validate(nameParamsSchema, 'params'),
  validate(updateModelSchema, 'body'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, name } = req.params;
      const dto: UpdateModelDTO = req.body;

      const model = await registryService.updateModel(namespace, name, dto);

      if (!model) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }

      res.json({
        message: 'Model updated successfully',
        model: {
          name: model.name,
          namespace: model.namespace,
          fullName: model.fullName,
          description: model.description,
          metadata: model.metadata,
          stage: model.stage,
          updatedAt: model.updatedAt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to update model', details: message });
    }
  }
);

/**
 * @route POST /api/v1/models/:namespace/:name/archive
 * @description Archive a model
 */
router.post(
  '/:namespace/:name/archive',
  validate(nameParamsSchema, 'params'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, name } = req.params;
      const model = await registryService.archiveModel(namespace, name);

      if (!model) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }

      res.json({
        message: 'Model archived successfully',
        model: {
          name: model.name,
          namespace: model.namespace,
          fullName: model.fullName,
          isArchived: model.isArchived,
          archivedAt: model.archivedAt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to archive model', details: message });
    }
  }
);

/**
 * @route POST /api/v1/models/:namespace/:name/restore
 * @description Restore an archived model
 */
router.post(
  '/:namespace/:name/restore',
  validate(nameParamsSchema, 'params'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, name } = req.params;
      const model = await registryService.restoreModel(namespace, name);

      if (!model) {
        res.status(404).json({ error: 'Archived model not found' });
        return;
      }

      res.json({
        message: 'Model restored successfully',
        model: {
          name: model.name,
          namespace: model.namespace,
          fullName: model.fullName,
          isArchived: model.isArchived,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to restore model', details: message });
    }
  }
);

/**
 * @route DELETE /api/v1/models/:namespace/:name
 * @description Delete a model (hard delete)
 */
router.delete(
  '/:namespace/:name',
  validate(nameParamsSchema, 'params'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, name } = req.params;
      const deleted = await registryService.deleteModel(namespace, name);

      if (!deleted) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }

      res.json({ message: 'Model deleted successfully' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to delete model', details: message });
    }
  }
);

/**
 * @route GET /api/v1/models/:namespace/:name/lineage
 * @description Get model version lineage
 */
router.get(
  '/:namespace/:name/lineage',
  validate(nameParamsSchema, 'params'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, name } = req.params;
      const model = await registryService.getModelLineage(namespace, name);

      if (!model) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }

      res.json({
        name: model.name,
        namespace: model.namespace,
        fullName: model.fullName,
        lineage: model.versions.map((v) => ({
          version: v.version,
          status: v.status,
          metrics: v.metrics,
          createdAt: v.createdAt,
          createdBy: v.createdBy,
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to get lineage', details: message });
    }
  }
);

/**
 * @route POST /api/v1/models/:namespace/:name/compare
 * @description Compare multiple versions
 */
router.post(
  '/:namespace/:name/compare',
  validate(nameParamsSchema, 'params'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, name } = req.params;
      const { versions } = req.body as { versions: string[] };

      if (!versions || !Array.isArray(versions) || versions.length < 2) {
        res.status(400).json({ error: 'At least two versions are required for comparison' });
        return;
      }

      const comparison = await registryService.compareVersions(namespace, name, versions);

      if (!comparison) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }

      res.json(comparison);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('At least two')) {
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Failed to compare versions', details: message });
      }
    }
  }
);

export default router;
