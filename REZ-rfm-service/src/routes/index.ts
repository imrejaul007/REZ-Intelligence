import { Router, Request, Response, NextFunction } from 'express';
import { scoringService } from '../services/scoringService.js';
import { segmentService } from '../services/segmentService.js';
import { analyticsService } from '../services/analyticsService.js';
import {
  CalculateAllSchema,
  CalculateSingleSchema,
  CustomerIdParamSchema,
  SegmentParamSchema,
  SEGMENTS,
} from '../types/index.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import logger from '../utils/logger.js';

const internalAuth = createAuthMiddleware({
  internalTokens: process.env['INTERNAL_SERVICE_TOKEN'] ? [process.env['INTERNAL_SERVICE_TOKEN']] : [],
});

const rateLimitMiddleware = createRateLimiter({ windowMs: 60000, max: 100 });

const router = Router();

// Apply rate limiting and auth to all routes
router.use(rateLimitMiddleware);
router.use(internalAuth);

/**
 * Validation error handler
 */
function handleValidationError(error: unknown, res: Response): void {
  if (error instanceof Error) {
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: error.message,
    });
  } else {
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Invalid request data',
    });
  }
}

/**
 * POST /api/rfm/calculate
 * Calculate RFM scores for all customers (expects customer data in body)
 */
router.post('/calculate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = CalculateAllSchema.safeParse(req.body);
    if (!parsed.success) {
      handleValidationError(parsed.error, res);
      return;
    }

    const { customerData } = req.body as {
      customerData: Array<{
        customerId: string;
        orders: Array<{ orderId: string; orderDate: string; totalAmount: number }>;
      }>;
    };

    if (!customerData || !Array.isArray(customerData)) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'customerData array is required',
      });
      return;
    }

    const result = await scoringService.calculateAll(customerData, {
      onProgress: (processed, total) => {
        logger.info(`RFM calculation progress: ${processed}/${total}`);
      },
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rfm/calculate/:customerId
 * Calculate RFM score for a single customer
 */
router.post('/calculate/:customerId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const paramResult = CustomerIdParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      handleValidationError(paramResult.error, res);
      return;
    }

    const bodyResult = CalculateSingleSchema.safeParse(req.body);
    if (!bodyResult.success) {
      handleValidationError(bodyResult.error, res);
      return;
    }

    const { customerId } = paramResult.data;
    const { orders } = bodyResult.data;

    if (!orders || orders.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Orders array is required',
      });
      return;
    }

    const parsedOrders = orders.map((o) => ({
      orderId: o.orderId,
      orderDate: new Date(o.orderDate),
      totalAmount: o.totalAmount,
    }));

    const score = await scoringService.calculateAndSave(customerId, parsedOrders);

    res.json({
      success: true,
      data: {
        customerId: score.customerId,
        recency: score.recency,
        frequency: score.frequency,
        monetary: score.monetary,
        rfmCode: score.rfmCode,
        segment: score.segment,
        metadata: score.metadata,
        lastCalculatedAt: score.lastCalculatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rfm/scores/:customerId
 * Get RFM score for a customer
 */
router.get('/scores/:customerId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = CustomerIdParamSchema.safeParse(req.params);
    if (!result.success) {
      handleValidationError(result.error, res);
      return;
    }

    const { customerId } = result.data;
    const score = await scoringService.getScore(customerId);

    if (!score) {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `RFM score not found for customer: ${customerId}`,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        customerId: score.customerId,
        recency: score.recency,
        frequency: score.frequency,
        monetary: score.monetary,
        rfmCode: score.rfmCode,
        segment: score.segment,
        metadata: score.metadata,
        lastCalculatedAt: score.lastCalculatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rfm/segments
 * List all segments
 */
router.get('/segments', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const segments = await segmentService.getAllSegmentsWithCounts();

    res.json({
      success: true,
      data: segments,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rfm/segments/:segment
 * Get segment details
 */
router.get('/segments/:segment', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = SegmentParamSchema.safeParse(req.params);
    if (!result.success) {
      handleValidationError(result.error, res);
      return;
    }

    const { segment } = result.data;
    const segmentData = await segmentService.getSegmentByCode(segment);

    if (!segmentData) {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Segment not found: ${segment}`,
      });
      return;
    }

    const stats = await segmentService.getSegmentStats(segment);

    res.json({
      success: true,
      data: {
        ...segmentData,
        stats,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rfm/segments/:segment/customers
 * List customers in a segment
 */
router.get('/segments/:segment/customers', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const paramResult = SegmentParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      handleValidationError(paramResult.error, res);
      return;
    }

    const { segment } = paramResult.data;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    // Check if segment is valid
    if (!segmentService.isValidSegment(segment)) {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Segment not found: ${segment}`,
      });
      return;
    }

    const result = await segmentService.getCustomersInSegment(segment, { page, limit });

    res.json({
      success: true,
      data: {
        customers: result.customers.map((c) => ({
          customerId: c.customerId,
          rfmCode: c.rfmCode,
          recency: c.recency,
          frequency: c.frequency,
          monetary: c.monetary,
          metadata: c.metadata,
          lastCalculatedAt: c.lastCalculatedAt,
        })),
        pagination: {
          page: result.page,
          totalPages: result.totalPages,
          total: result.total,
          limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rfm/analytics
 * Get segment analytics
 */
router.get('/analytics', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const analytics = await analyticsService.getAnalytics();

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rfm/thresholds
 * Get RFM scoring thresholds
 */
router.get('/thresholds', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Use the scoring thresholds directly since response is hardcoded
    scoringService.getThresholds();

    res.json({
      success: true,
      data: {
        recency: {
          description: 'Days since last order',
          ranges: [
            { score: 5, range: '0-30 days', label: 'Most recent' },
            { score: 4, range: '31-60 days', label: 'Recent' },
            { score: 3, range: '61-90 days', label: 'Moderate' },
            { score: 2, range: '91-180 days', label: 'Dormant' },
            { score: 1, range: '180+ days', label: 'Inactive' },
          ],
        },
        frequency: {
          description: 'Number of orders',
          ranges: [
            { score: 5, range: '10+ orders', label: 'Very frequent' },
            { score: 4, range: '7-9 orders', label: 'Frequent' },
            { score: 3, range: '4-6 orders', label: 'Regular' },
            { score: 2, range: '2-3 orders', label: 'Occasional' },
            { score: 1, range: '1 order', label: 'One-time' },
          ],
        },
        monetary: {
          description: 'Total amount spent (INR)',
          ranges: [
            { score: 5, range: '₹10,000+', label: 'Premium' },
            { score: 4, range: '₹5,000-9,999', label: 'High value' },
            { score: 3, range: '₹2,000-4,999', label: 'Medium value' },
            { score: 2, range: '₹500-1,999', label: 'Low value' },
            { score: 1, range: '₹0-499', label: 'Minimal' },
          ],
        },
        segments: SEGMENTS,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rfm/health
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'rez-rfm-service',
    timestamp: new Date().toISOString(),
  });
});

export default router;
