import { Router, Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { trainingExporter } from '../services/trainingExporter.js';
import { exportPipeline } from '../pipelines/export.js';
import { ModelVersion } from '../models/index.js';
import { ExportRequestSchema } from '../utils/validators.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { z } from 'zod';
import logger from './utils/logger';

const router = Router();

// Validation middleware
const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        throw new ValidationError('Invalid request body', {
          errors: result.error.issues,
        });
      }
      req.body = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Trigger training data export
router.post(
  '/training-data',
  validateBody(ExportRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const versionId = req.query.versionId as string | undefined;
      const result = await exportPipeline.run(req.body, versionId);

      res.status(202).json({
        success: true,
        data: {
          batchId: result.batchId,
          versionId: result.versionId || versionId,
          status: result.status,
          message: result.message,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get export job status
router.get('/status/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batch = await trainingExporter.getExportStatus(req.params.jobId);

    if (!batch) {
      throw new NotFoundError('Export job', req.params.jobId);
    }

    res.json({
      success: true,
      data: {
        batchId: batch.batchId,
        versionId: batch.versionId,
        status: batch.status,
        format: batch.format,
        sampleCount: batch.sampleCount,
        fileSize: batch.fileSize,
        statistics: batch.statistics,
        error: batch.error,
        createdAt: batch.createdAt,
        completedAt: batch.completedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Download exported data
router.get('/download/:batchId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const download = await trainingExporter.downloadExport(req.params.batchId);

    if (!download) {
      throw new NotFoundError('Export file', req.params.batchId);
    }

    const fileName = path.basename(download.filePath);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', download.fileSize);
    res.setHeader('X-Checksum', download.checksum);

    const fileStream = fs.createReadStream(download.filePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
});

// List recent exports
router.get('/list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const exports = await trainingExporter.listExports(limit);

    res.json({
      success: true,
      data: exports.map((e) => ({
        batchId: e.batchId,
        versionId: e.versionId,
        status: e.status,
        format: e.format,
        sampleCount: e.sampleCount,
        fileSize: e.fileSize,
        createdAt: e.createdAt,
        completedAt: e.completedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Get model versions
router.get('/models', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const versions = await ModelVersion.getVersionHistory(20);

    res.json({
      success: true,
      data: versions.map((v) => ({
        versionId: v.versionId,
        versionNumber: v.versionNumber,
        status: v.status,
        description: v.description,
        trainingData: v.trainingData,
        performance: v.performance,
        createdAt: v.createdAt,
        publishedAt: v.publishedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Get specific model version
router.get('/models/:version', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const version = await ModelVersion.findOne({
      $or: [
        { versionId: req.params.version },
        { versionNumber: req.params.version },
      ],
    });

    if (!version) {
      throw new NotFoundError('Model version', req.params.version);
    }

    res.json({
      success: true,
      data: {
        versionId: version.versionId,
        versionNumber: version.versionNumber,
        status: version.status,
        description: version.description,
        trainingData: version.trainingData,
        performance: version.performance,
        validation: version.validation,
        previousVersionId: version.previousVersionId,
        metadata: version.metadata,
        createdAt: version.createdAt,
        publishedAt: version.publishedAt,
        archivedAt: version.archivedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get latest published model
router.get('/models/latest', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const version = await ModelVersion.findLatest();

    if (!version) {
      return res.json({
        success: true,
        data: null,
        message: 'No published model found',
      });
    }

    res.json({
      success: true,
      data: {
        versionId: version.versionId,
        versionNumber: version.versionNumber,
        status: version.status,
        description: version.description,
        trainingData: version.trainingData,
        performance: version.performance,
        publishedAt: version.publishedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get training data for a model version
router.get('/models/:version/training-data', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const version = await ModelVersion.findOne({
      $or: [
        { versionId: req.params.version },
        { versionNumber: req.params.version },
      ],
    });

    if (!version) {
      throw new NotFoundError('Model version', req.params.version);
    }

    const batches = await trainingExporter.listExports(100);
    const relevantBatches = batches.filter((b) => b.versionId === version.versionId);

    res.json({
      success: true,
      data: {
        version: {
          versionId: version.versionId,
          versionNumber: version.versionNumber,
        },
        batches: relevantBatches.map((b) => ({
          batchId: b.batchId,
          status: b.status,
          sampleCount: b.sampleCount,
          createdAt: b.createdAt,
        })),
        totalSamples: relevantBatches.reduce((sum, b) => sum + b.sampleCount, 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
