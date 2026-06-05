import { Router, Request, Response } from 'express';
import automotiveIntelligenceService from '../services/automotiveIntelligence';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { consultRequestSchema } from '../middleware/validation';
import { aiLimiter } from '../middleware/rateLimit';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(aiLimiter);

/**
 * POST /api/v1/consult
 * AI consultation chat
 */
router.post(
  '/',
  validate(consultRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { message, context } = req.body;
    const userId = req.user?.userId || req.user?.merchantId || 'anonymous';

    const result = await automotiveIntelligenceService.consult(
      userId,
      message,
      context
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * GET /api/v1/consult/history/:sessionId
 * Get conversation history
 */
router.get(
  '/history/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { limit } = req.query;

    const history = await automotiveIntelligenceService.getSessionHistory(
      sessionId,
      limit ? parseInt(limit as string) : undefined
    );

    if (!history) {
      res.status(404).json({
        success: false,
        error: 'Session not found',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        sessionId,
        messages: history,
      },
    });
  })
);

/**
 * POST /api/v1/consult/:sessionId/complete
 * Complete a consultation session
 */
router.post(
  '/:sessionId/complete',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    await automotiveIntelligenceService.completeSession(sessionId);

    res.json({
      success: true,
      message: 'Session completed',
    });
  })
);

export default router;