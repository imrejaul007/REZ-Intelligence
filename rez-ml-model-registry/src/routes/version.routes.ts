import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { registryService, RegisterVersionDTO, UpdateVersionDTO } from '../services/registry.service';

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const registerVersionSchema = Joi.object({
  version: Joi.string()
    .pattern(/^\d+\.\d+\.\d+$/)
    .required()
    .messages({
      'string.pattern.base': 'Version must be in semver format (e.g., 1.0.0)',
    }),
  modelUri: Joi.string().required(),
  description: Joi.string().max(2000),
  createdBy: Joi.string().required(),
  fileSize: Joi.number().integer().min(0).required(),
  framework: Joi.string().required(),
  frameworkVersion: Joi.string().required(),
  metrics: Joi.object({
    accuracy: Joi.number().min(0).max(1),
    precision: Joi.number().min(0).max(1),
    recall: Joi.number().min(0).max(1),
    f1Score: Joi.number().min(0).max(1),
    auc: Joi.number().min(0).max(1),
    rmse: Joi.number().min(0),
    mae: Joi.number().min(0),
    custom: Joi.object().pattern(Joi.string(), Joi.number()),
  }),
  artifacts: Joi.array().items(
    Joi.object({
      path: Joi.string().required(),
      size: Joi.number().integer().min(0).required(),
      type: Joi.string().required(),
    })
  ),
  environment: Joi.object({
    pythonVersion: Joi.string(),
    dependencies: Joi.object().pattern(Joi.string(), Joi.string()),
    hardware: Joi.string(),
  }),
});

const updateVersionSchema = Joi.object({
  description: Joi.string().max(2000),
  metrics: Joi.object({
    accuracy: Joi.number().min(0).max(1),
    precision: Joi.number().min(0).max(1),
    recall: Joi.number().min(0).max(1),
    f1Score: Joi.number().min(0).max(1),
    auc: Joi.number().min(0).max(1),
    rmse: Joi.number().min(0),
    mae: Joi.number().min(0),
    custom: Joi.object().pattern(Joi.string(), Joi.number()),
  }),
  status: Joi.string().valid('pending', 'validated', 'staged', 'production', 'archived'),
  validationResult: Joi.object({
    passed: Joi.boolean().required(),
    checksRun: Joi.array().items(Joi.string()).required(),
    errors: Joi.array().items(Joi.string()),
  }),
});

const transitionStatusSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'validated', 'staged', 'production', 'archived')
    .required(),
});

const nameParamsSchema = Joi.object({
  namespace: Joi.string().pattern(/^[a-z0-9-_]+$/).default('default'),
  name: Joi.string().pattern(/^[a-z0-9-_]+$/).required(),
});

const versionParamsSchema = Joi.object({
  namespace: Joi.string().pattern(/^[a-z0-9-_]+$/).default('default'),
  name: Joi.string().pattern(/^[a-z0-9-_]+$/).required(),
  version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).required(),
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
 * @route POST /api/v1/models/:namespace/:name/versions
 * @description Register a new version for a model
 */
router.post(
  '/:namespace/:name/versions',
  validate(nameParamsSchema, 'params'),
  validate(registerVersionSchema, 'body'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, name } = req.params;
      const dto: RegisterVersionDTO = {
        ...req.body,
        modelName: name,
        namespace,
      };

      const result = await registryService.registerVersion(dto);

      res.status(201).json({
        message: 'Version registered successfully',
        version: {
          modelName: result.model.name,
          namespace: result.model.namespace,
          version: result.version.version,
          modelUri: result.version.modelUri,
          description: result.version.description,
          createdBy: result.version.createdBy,
          fileSize: result.version.fileSize,
          checksum: result.version.checksum,
          framework: result.version.framework,
          frameworkVersion: result.version.frameworkVersion,
          metrics: result.version.metrics,
          status: result.version.status,
          createdAt: result.version.createdAt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        res.status(404).json({ error: message });
      } else if (message.includes('already exists') || message.includes('semver')) {
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Failed to register version', details: message });
      }
    }
  }
);

/**
 * @route GET /api/v1/models/:namespace/:name/versions/:version
 * @description Get a specific version
 */
router.get(
  '/:namespace/:name/versions/:version',
  validate(versionParamsSchema, 'params'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, name, version } = req.params;
      const { model, version: versionData } = await registryService.getModelVersion(namespace, name, version);

      if (!model || !versionData) {
        res.status(404).json({ error: 'Model or version not found' });
        return;
      }

      res.json({
        modelName: model.name,
        namespace: model.namespace,
        fullName: model.fullName,
        version: {
          version: versionData.version,
          modelUri: versionData.modelUri,
          description: versionData.description,
          createdAt: versionData.createdAt,
          createdBy: versionData.createdBy,
          fileSize: versionData.fileSize,
          checksum: versionData.checksum,
          framework: versionData.framework,
          frameworkVersion: versionData.frameworkVersion,
          metrics: versionData.metrics,
          artifacts: versionData.artifacts,
          environment: versionData.environment,
          status: versionData.status,
          validationResult: versionData.validationResult,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to get version', details: message });
    }
  }
);

/**
 * @route PATCH /api/v1/models/:namespace/:name/versions/:version
 * @description Update version metadata
 */
router.patch(
  '/:namespace/:name/versions/:version',
  validate(versionParamsSchema, 'params'),
  validate(updateVersionSchema, 'body'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, name, version } = req.params;
      const dto: UpdateVersionDTO = req.body;

      const updatedVersion = await registryService.updateVersion(namespace, name, version, dto);

      if (!updatedVersion) {
        res.status(404).json({ error: 'Model or version not found' });
        return;
      }

      res.json({
        message: 'Version updated successfully',
        version: {
          modelName: name,
          namespace,
          version: updatedVersion.version,
          metrics: updatedVersion.metrics,
          status: updatedVersion.status,
          description: updatedVersion.description,
          validationResult: updatedVersion.validationResult,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to update version', details: message });
    }
  }
);

/**
 * @route POST /api/v1/models/:namespace/:name/versions/:version/transition
 * @description Transition version to a new stage
 */
router.post(
  '/:namespace/:name/versions/:version/transition',
  validate(versionParamsSchema, 'params'),
  validate(transitionStatusSchema, 'body'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, name, version } = req.params;
      const { status } = req.body;

      const updatedVersion = await registryService.transitionVersionStage(
        namespace,
        name,
        version,
        status
      );

      if (!updatedVersion) {
        res.status(404).json({ error: 'Model or version not found' });
        return;
      }

      res.json({
        message: `Version transitioned to '${status}' successfully`,
        version: {
          modelName: name,
          namespace,
          version: updatedVersion.version,
          previousStatus: updatedVersion.status,
          newStatus: status,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('Invalid status transition')) {
        res.status(400).json({ error: message });
      } else if (message.includes('not found')) {
        res.status(404).json({ error: message });
      } else {
        res.status(500).json({ error: 'Failed to transition version', details: message });
      }
    }
  }
);

/**
 * @route DELETE /api/v1/models/:namespace/:name/versions/:version
 * @description Delete a specific version
 */
router.delete(
  '/:namespace/:name/versions/:version',
  validate(versionParamsSchema, 'params'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, name, version } = req.params;
      const deleted = await registryService.deleteVersion(namespace, name, version);

      if (!deleted) {
        res.status(404).json({ error: 'Model or version not found' });
        return;
      }

      res.json({ message: 'Version deleted successfully' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('only version')) {
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: 'Failed to delete version', details: message });
      }
    }
  }
);

/**
 * @route GET /api/v1/models/:namespace/:name/versions/:version/download
 * @description Get download URL for model artifact
 */
router.get(
  '/:namespace/:name/versions/:version/download',
  validate(versionParamsSchema, 'params'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, name, version } = req.params;
      const { model, version: versionData } = await registryService.getModelVersion(namespace, name, version);

      if (!model || !versionData) {
        res.status(404).json({ error: 'Model or version not found' });
        return;
      }

      // Return the model URI for download
      // In production, this would generate a signed URL or redirect
      res.json({
        downloadUrl: versionData.modelUri,
        checksum: versionData.checksum,
        fileSize: versionData.fileSize,
        version: versionData.version,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to get download info', details: message });
    }
  }
);

/**
 * @route POST /api/v1/models/:namespace/:name/versions/:version/validate
 * @description Record validation results for a version
 */
router.post(
  '/:namespace/:name/versions/:version/validate',
  validate(versionParamsSchema, 'params'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, name, version } = req.params;
      const { passed, checksRun, errors } = req.body as {
        passed: boolean;
        checksRun: string[];
        errors?: string[];
      };

      if (typeof passed !== 'boolean' || !Array.isArray(checksRun)) {
        res.status(400).json({
          error: 'Validation failed',
          details: 'Both "passed" (boolean) and "checksRun" (array) are required',
        });
        return;
      }

      const updatedVersion = await registryService.updateVersion(namespace, name, version, {
        validationResult: {
          passed,
          checksRun,
          errors: errors || [],
        },
      });

      if (!updatedVersion) {
        res.status(404).json({ error: 'Model or version not found' });
        return;
      }

      res.json({
        message: 'Validation results recorded',
        validationResult: updatedVersion.validationResult,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to record validation', details: message });
    }
  }
);

/**
 * @route GET /api/v1/models/:namespace/:name/versions
 * @description List all versions for a model
 */
router.get(
  '/:namespace/:name/versions',
  validate(nameParamsSchema, 'params'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { namespace, name } = req.params;
      const model = await registryService.getModel(namespace, name);

      if (!model) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }

      // Sort versions by creation date descending
      const sortedVersions = [...model.versions].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      res.json({
        modelName: model.name,
        namespace: model.namespace,
        fullName: model.fullName,
        latestVersion: model.latestVersion,
        versions: sortedVersions.map((v) => ({
          version: v.version,
          modelUri: v.modelUri,
          description: v.description,
          createdAt: v.createdAt,
          createdBy: v.createdBy,
          fileSize: v.fileSize,
          framework: v.framework,
          frameworkVersion: v.frameworkVersion,
          metrics: v.metrics,
          status: v.status,
          validationResult: v.validationResult,
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: 'Failed to list versions', details: message });
    }
  }
);

export default router;
