import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  generatePrediction,
  generateAllPredictions,
  processBatchPrediction,
  getBatchJobStatus,
  getAtRiskSegment,
  getHighValueSegment,
  getPredictionStats
} from '../services/predictionEngine';
import {
  asyncHandler,
  ValidationError,
  NotFoundError
} from '../middleware/errorHandler';
import { PredictionType, ChurnRisk } from '../types';
import logger from '../utils/logger';

const router = Router();

// Validation schemas
const userIdSchema = z.string().min(1, 'User ID is required');
const predictionTypeSchema = z.enum(['churn', 'ltv', 'revisit', 'conversion']);
const riskLevelSchema = z.array(z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])).optional();
const tierSchema = z.array(z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'])).optional();

const batchPredictionSchema = z.object({
  userIds: z.array(z.string()).min(1, 'At least one user ID required').max(1000, 'Max 1000 users per batch'),
  types: z.array(predictionTypeSchema).min(1, 'At least one prediction type required'),
  options: z.object({
    useCache: z.boolean().optional().default(true),
    forceRefresh: z.boolean().optional().default(false)
  }).optional()
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
});

/**
 * GET /predict/:userId/churn
 * Get churn prediction for a user
 */
router.get('/:userId/churn',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = userIdSchema.parse(req.params.userId);
    const useCache = req.query.cache !== 'false';

    logger.info('Churn prediction requested', { userId });

    const prediction = await generatePrediction(userId, 'churn', useCache);

    res.json({
      success: true,
      data: prediction,
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  })
);

/**
 * GET /predict/:userId/ltv
 * Get LTV prediction for a user
 */
router.get('/:userId/ltv',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = userIdSchema.parse(req.params.userId);
    const useCache = req.query.cache !== 'false';

    logger.info('LTV prediction requested', { userId });

    const prediction = await generatePrediction(userId, 'ltv', useCache);

    res.json({
      success: true,
      data: prediction,
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  })
);

/**
 * GET /predict/:userId/revisit
 * Get revisit prediction for a user
 */
router.get('/:userId/revisit',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = userIdSchema.parse(req.params.userId);
    const useCache = req.query.cache !== 'false';

    logger.info('Revisit prediction requested', { userId });

    const prediction = await generatePrediction(userId, 'revisit', useCache);

    res.json({
      success: true,
      data: prediction,
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  })
);

/**
 * GET /predict/:userId/conversion
 * Get conversion prediction for a user
 */
router.get('/:userId/conversion',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = userIdSchema.parse(req.params.userId);
    const useCache = req.query.cache !== 'false';

    logger.info('Conversion prediction requested', { userId });

    const prediction = await generatePrediction(userId, 'conversion', useCache);

    res.json({
      success: true,
      data: prediction,
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  })
);

/**
 * GET /predict/:userId/all
 * Get all predictions for a user
 */
router.get('/:userId/all',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = userIdSchema.parse(req.params.userId);
    const useCache = req.query.cache !== 'false';

    logger.info('All predictions requested', { userId });

    const predictions = await generateAllPredictions(userId, useCache);

    res.json({
      success: true,
      data: predictions,
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  })
);

/**
 * POST /predict/batch
 * Batch predictions for multiple users
 */
router.post('/batch',
  asyncHandler(async (req: Request, res: Response) => {
    const body = batchPredictionSchema.parse(req.body);
    const { userIds, types, options } = body;

    logger.info('Batch prediction requested', {
      userCount: userIds.length,
      types
    });

    const result = await processBatchPrediction({
      userIds,
      types: types as PredictionType[],
      options
    });

    res.status(202).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  })
);

/**
 * GET /predict/batch/:jobId
 * Get batch prediction job status
 */
router.get('/batch/:jobId',
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;

    const job = await getBatchJobStatus(jobId);

    if (!job) {
      throw new NotFoundError('Batch job');
    }

    res.json({
      success: true,
      data: job,
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  })
);

/**
 * GET /predict/segments/at-risk
 * Get at-risk users segment
 */
router.get('/segments/at-risk',
  asyncHandler(async (req: Request, res: Response) => {
    const query = paginationSchema.parse(req.query);

    const riskLevelsRaw = req.query.riskLevels
      ? (JSON.parse(req.query.riskLevels as string) as string[])
      : ['CRITICAL', 'HIGH'];
    const riskLevels: ChurnRisk[] = riskLevelsRaw as ChurnRisk[];

    const limit = Math.min(query.limit, 100);

    const segment = await getAtRiskSegment(riskLevels, limit);

    res.json({
      success: true,
      data: segment,
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  })
);

/**
 * GET /predict/segments/high-value
 * Get high-value customers segment
 */
router.get('/segments/high-value',
  asyncHandler(async (req: Request, res: Response) => {
    const query = paginationSchema.parse(req.query);

    const tiers = req.query.tiers
      ? (JSON.parse(req.query.tiers as string) as string[])
      : ['PLATINUM', 'GOLD'];

    const limit = Math.min(query.limit, 100);

    const segment = await getHighValueSegment(tiers, limit);

    res.json({
      success: true,
      data: segment,
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  })
);

/**
 * GET /predict/stats
 * Get prediction service statistics
 */
router.get('/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await getPredictionStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  })
);

export default router;
