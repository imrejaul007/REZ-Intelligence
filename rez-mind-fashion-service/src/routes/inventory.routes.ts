import { Router, Request, Response } from 'express';
import inventoryOptimizerService from '../services/inventoryOptimizer';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { inventoryOptimizationRequestSchema } from '../middleware/validation';
import { aiLimiter, readLimiter } from '../middleware/rateLimit';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.post('/optimize', aiLimiter, validate(inventoryOptimizationRequestSchema), asyncHandler(async (req: Request, res: Response) => {
  const { merchantId, category, forecastPeriod } = req.body;
  const result = await inventoryOptimizerService.optimizeInventory(merchantId, category);
  res.json({ success: true, data: result });
}));

router.post('/forecast', aiLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { merchantId, category, period } = req.body;
  const result = await inventoryOptimizerService.forecastDemand(merchantId, category, period);
  res.json({ success: true, data: result });
}));

router.get('/dead-stock', readLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.query as any;
  const result = await inventoryOptimizerService.getDeadStock(merchantId);
  res.json({ success: true, data: result });
}));

router.get('/size-forecast', readLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { category } = req.query as any;
  const result = await inventoryOptimizerService.getSizeForecast(category);
  res.json({ success: true, data: result });
}));

export default router;