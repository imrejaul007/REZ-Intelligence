import { Router, Request, Response } from 'express';
import pricingEngineService from '../services/pricingEngine';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { pricingRequestSchema } from '../middleware/validation';
import { aiLimiter, readLimiter } from '../middleware/rateLimit';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

/**
 * POST /api/v1/pricing/recommend
 * Get pricing recommendation
 */
router.post(
  '/recommend',
  aiLimiter,
  validate(pricingRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { vehicleData, strategy } = req.body;
    const merchantId = req.user?.merchantId || 'default';

    const result = await pricingEngineService.recommendPricing(
      vehicleData,
      merchantId,
      strategy || 'balanced'
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/pricing/analyze
 * Analyze market positioning
 */
router.post(
  '/analyze',
  aiLimiter,
  validate(pricingRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { vehicleData } = req.body;
    const merchantId = req.user?.merchantId || 'default';

    const [pricingResult, marketAnalysis] = await Promise.all([
      pricingEngineService.recommendPricing(vehicleData, merchantId),
      pricingEngineService.analyzeMarketPositioning(merchantId, vehicleData),
    ]);

    res.json({
      success: true,
      data: {
        recommendation: pricingResult,
        marketPositioning: marketAnalysis,
      },
    });
  })
);

/**
 * GET /api/v1/pricing/history
 * Get pricing history
 */
router.get(
  '/history',
  readLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const merchantId = req.user?.merchantId || 'default';
    const { limit = 50 } = req.query;

    const history = await pricingEngineService.getPricingHistory(
      merchantId,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  })
);

/**
 * GET /api/v1/pricing/competitors
 * Get competitor analysis (simulated)
 */
router.get(
  '/competitors',
  readLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { make, model, year } = req.query;

    // Simulated competitor data
    const competitorData = {
      make: make || 'Unknown',
      model: model || 'Unknown',
      year: year || new Date().getFullYear(),
      competitors: [
        { name: 'Competitor A', avgPrice: 450000, listings: 15 },
        { name: 'Competitor B', avgPrice: 480000, listings: 8 },
        { name: 'Competitor C', avgPrice: 520000, listings: 12 },
      ],
      marketInsights: {
        totalListings: 35,
        avgPrice: 483333,
        priceRange: { min: 380000, max: 580000 },
      },
    };

    res.json({
      success: true,
      data: competitorData,
    });
  })
);

export default router;