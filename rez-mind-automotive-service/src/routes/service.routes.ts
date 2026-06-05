import { Router, Request, Response } from 'express';
import servicePredictorService from '../services/servicePredictor';
import { asyncHandler } from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import { servicePredictionRequestSchema } from '../middleware/validation';
import { aiLimiter, readLimiter } from '../middleware/rateLimit';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

/**
 * POST /api/v1/service/predict
 * Predict next service
 */
router.post(
  '/predict',
  aiLimiter,
  validate(servicePredictionRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { vehicleId, currentKilometerReading, serviceHistory } = req.body;
    const merchantId = req.user?.merchantId || 'default';

    const result = await servicePredictorService.predictService(
      vehicleId,
      merchantId,
      currentKilometerReading || 0,
      serviceHistory || []
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/service/schedule
 * Get optimal scheduling recommendations
 */
router.post(
  '/schedule',
  aiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.body;
    const merchantId = req.user?.merchantId || 'default';

    const result = await servicePredictorService.getOptimalSchedule(
      merchantId,
      {
        start: new Date(startDate),
        end: new Date(endDate),
      }
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * GET /api/v1/service/history/:vehicleId
 * Get service history analysis
 */
router.get(
  '/history/:vehicleId',
  readLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { vehicleId } = req.params;
    const { limit = 10 } = req.query;

    // In production, this would fetch from the automotive merchant service
    const mockHistory = {
      vehicleId,
      predictions: [
        {
          predictionId: 'SPP-sample-1',
          predictedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          actualDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
          accuracy: 0.85,
        },
      ],
      recommendations: [
        'Regular service due in next 2 weeks',
        'Brake inspection recommended at next service',
      ],
    };

    res.json({
      success: true,
      data: mockHistory,
    });
  })
);

/**
 * GET /api/v1/service/pending
 * Get pending service predictions
 */
router.get(
  '/pending',
  readLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const merchantId = req.user?.merchantId || 'default';

    // In production, this would query the database
    const pendingService = {
      count: 0,
      items: [],
      message: 'Connect to merchant service for actual data',
    };

    res.json({
      success: true,
      data: pendingService,
    });
  })
);

export default router;