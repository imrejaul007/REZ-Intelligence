import { Router, Request, Response } from 'express';
import styleMatcherService from '../services/styleMatcher';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { styleMatchRequestSchema } from '../middleware/validation';
import { aiLimiter, readLimiter } from '../middleware/rateLimit';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.post('/match', aiLimiter, validate(styleMatchRequestSchema), asyncHandler(async (req: Request, res: Response) => {
  const { customerId, merchantId, styleProfile, limit } = req.body;
  const result = await styleMatcherService.matchStyle(customerId, merchantId, styleProfile, limit);
  res.json({ success: true, data: result });
}));

router.get('/segments', readLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.query as any;
  const result = await styleMatcherService.getCustomerSegments(merchantId);
  res.json({ success: true, data: result });
}));

export default router;