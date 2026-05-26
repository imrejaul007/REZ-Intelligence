import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { scoringEngineService } from '../services/scoringEngine';
import { ConfidenceScore } from '../models/ConfidenceScore';
import {
  asyncHandler,
  ValidationError,
} from '../middleware/errorHandler';
import { ScoringRequestSchema } from '../types';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/scoring/score
 *
 * Calculate confidence score for a single agent
 */
router.post(
  '/score',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Validate request body
    const validationResult = ScoringRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError(
        'Invalid request body',
        validationResult.error.issues
      );
    }

    const scoringRequest = validationResult.data;

    logger.info('Calculating confidence score', {
      agentId: scoringRequest.agentId,
      intent: scoringRequest.intent,
    });

    const result = await scoringEngineService.calculateScore(scoringRequest);

    res.status(200).json({
      success: true,
      data: result,
      breakdown: scoringEngineService.getScoreBreakdown(result),
    });
  })
);

/**
 * POST /api/v1/scoring/batch
 *
 * Calculate confidence scores for multiple agents
 */
const BatchScoreSchema = z.object({
  agentIds: z.array(z.string().min(1)).min(1).max(100),
  intent: z.string().min(1),
  context: z
    .object({
      domain: z.string().optional(),
      urgency: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      userId: z.string().optional(),
      sessionId: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .optional(),
  taskComplexity: z.number().min(0).max(1).optional().default(0.5),
  requiredCapabilities: z.array(z.string()).optional(),
});

router.post(
  '/batch',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const validationResult = BatchScoreSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError(
        'Invalid request body',
        validationResult.error.issues
      );
    }

    const { agentIds, intent, context, taskComplexity, requiredCapabilities } =
      validationResult.data;

    logger.info('Batch calculating confidence scores', {
      agentCount: agentIds.length,
      intent,
    });

    const results = await scoringEngineService.batchScoreAgents(
      agentIds,
      intent,
      context
    );

    res.status(200).json({
      success: true,
      data: results,
      meta: {
        totalAgents: agentIds.length,
        rankedResults: results.map((r) => ({
          agentId: r.agentId,
          overallScore: r.overallScore,
          rank: r.rank,
        })),
      },
    });
  })
);

/**
 * POST /api/v1/scoring/top-agent
 *
 * Find the best scoring agent for an intent
 */
const TopAgentSchema = z.object({
  intent: z.string().min(1),
  domain: z.string().optional(),
  excludeAgentIds: z.array(z.string()).optional(),
});

router.post(
  '/top-agent',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const validationResult = TopAgentSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError(
        'Invalid request body',
        validationResult.error.issues
      );
    }

    const { intent, domain, excludeAgentIds } = validationResult.data;

    const topAgent = await scoringEngineService.getTopAgent(
      intent,
      domain,
      excludeAgentIds
    );

    if (!topAgent) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NO_AGENT_FOUND',
          message: 'No suitable agent found for the given criteria',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: topAgent,
    });
  })
);

/**
 * POST /api/v1/scoring/record-outcome
 *
 * Record a task outcome for learning
 */
const RecordOutcomeSchema = z.object({
  agentId: z.string().min(1),
  intent: z.string().min(1),
  success: z.boolean(),
  confidenceScore: z.number().min(0).max(1),
  responseTimeMs: z.number().min(0),
});

router.post(
  '/record-outcome',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const validationResult = RecordOutcomeSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError(
        'Invalid request body',
        validationResult.error.issues
      );
    }

    const { agentId, intent, success, confidenceScore, responseTimeMs } =
      validationResult.data;

    await scoringEngineService.recordTaskOutcome(
      agentId,
      intent,
      success,
      confidenceScore,
      responseTimeMs
    );

    res.status(200).json({
      success: true,
      message: 'Outcome recorded successfully',
    });
  })
);

/**
 * GET /api/v1/scoring/history/:agentId
 *
 * Get scoring history for an agent
 */
router.get(
  '/history/:agentId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { agentId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : new Date();

    const scores = await ConfidenceScore.find({
      agentId,
      createdAt: { $gte: startDate, $lte: endDate },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    const totalCount = await ConfidenceScore.countDocuments({
      agentId,
      createdAt: { $gte: startDate, $lte: endDate },
    });

    res.status(200).json({
      success: true,
      data: scores,
      meta: {
        totalCount,
        returnedCount: scores.length,
        limit,
        startDate,
        endDate,
      },
    });
  })
);

/**
 * GET /api/v1/scoring/top-agents/:intent
 *
 * Get top performing agents for an intent
 */
router.get(
  '/top-agents/:intent',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { intent } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const topAgents = await ConfidenceScore.getTopAgentsForIntent(intent, limit);

    res.status(200).json({
      success: true,
      data: topAgents,
      meta: {
        intent,
        limit,
      },
    });
  })
);

/**
 * GET /api/v1/scoring/average/:agentId
 *
 * Get average score for an agent
 */
router.get(
  '/average/:agentId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { agentId } = req.params;
    const hours = Math.min(parseInt(req.query.hours as string) || 24, 168);

    const averageScore = await ConfidenceScore.getAgentAverageScore(agentId, hours);

    res.status(200).json({
      success: true,
      data: {
        agentId,
        averageScore,
        hours,
      },
    });
  })
);

export default router;
