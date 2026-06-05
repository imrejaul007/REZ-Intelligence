import { Router, Request, Response } from 'express';
import trendAnalyzerService from '../services/trendAnalyzer';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { trendRequestSchema } from '../middleware/validation';
import { aiLimiter, readLimiter } from '../middleware/rateLimit';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.post('/analyze', aiLimiter, validate(trendRequestSchema), asyncHandler(async (req: Request, res: Response) => {
  const { category, season } = req.body;
  const result = await trendAnalyzerService.analyzeTrends(category, season);
  res.json({ success: true, data: result });
}));

router.post('/predict', aiLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { category, forecastMonths } = req.body;
  const result = await trendAnalyzerService.predictTrends(category, forecastMonths);
  res.json({ success: true, data: result });
}));

router.get('/seasonal', readLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { category } = req.query as any;
  const result = await trendAnalyzerService.analyzeTrends(category, undefined);
  res.json({ success: true, data: { seasonalRecommendation: result.seasonalRecommendation } });
}));

export default router;