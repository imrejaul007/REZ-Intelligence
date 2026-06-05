import { Router, Request, Response } from 'express';
import fashionIntelligenceService from '../services/fashionIntelligence';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { consultRequestSchema } from '../middleware/validation';
import { aiLimiter } from '../middleware/rateLimit';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate, aiLimiter);

router.post('/', validate(consultRequestSchema), asyncHandler(async (req: Request, res: Response) => {
  const { message, context } = req.body;
  const userId = req.user?.userId || req.user?.merchantId || 'anonymous';
  const result = await fashionIntelligenceService.consult(userId, message, context);
  res.json({ success: true, data: result });
}));

router.get('/history/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const history = await fashionIntelligenceService.getSessionHistory(req.params.sessionId, req.query.limit ? parseInt(req.query.limit as string) : undefined);
  if (!history) return res.status(404).json({ success: false, error: 'Session not found' });
  res.json({ success: true, data: { sessionId: req.params.sessionId, messages: history } });
}));

router.post('/:sessionId/complete', asyncHandler(async (req: Request, res: Response) => {
  await fashionIntelligenceService.completeSession(req.params.sessionId);
  res.json({ success: true, message: 'Session completed' });
}));

export default router;