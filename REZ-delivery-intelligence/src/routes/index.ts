import { Router, Request, Response } from 'express';
import { deliveryService } from '../services/deliveryService.js';
import logger from '../utils/logger.js';
import { ZodError } from 'zod';

const router = Router();

/**
 * GET /delivery/:orderId
 * Get delivery insight for an order
 */
router.get('/delivery/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Order ID is required',
      });
      return;
    }

    logger.info(`Fetching delivery insight for order ${orderId}`);

    const insight = await deliveryService.getDeliveryInsight(orderId);

    res.json({
      success: true,
      data: insight,
    });
  } catch (error) {
    logger.error('Failed to fetch delivery insight', { error, orderId: req.params.orderId });

    if (error instanceof ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: error.errors,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch delivery insight',
    });
  }
});

/**
 * GET /delivery/:orderId/prediction
 * Get delivery prediction for an order
 */
router.get('/delivery/:orderId/prediction', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    logger.info(`Fetching delivery prediction for order ${orderId}`);

    const prediction = await deliveryService.getDeliveryPrediction(orderId);

    res.json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    logger.error('Failed to fetch delivery prediction', { error, orderId: req.params.orderId });

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch delivery prediction',
    });
  }
});

/**
 * GET /delivery/optimize/:merchantId
 * Get optimized delivery routes for a merchant
 */
router.get('/delivery/optimize/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    logger.info(`Optimizing routes for merchant ${merchantId}`);

    const optimization = await deliveryService.optimizeRoutes(merchantId, date);

    res.json({
      success: true,
      data: optimization,
    });
  } catch (error) {
    logger.error('Failed to optimize routes', { error, merchantId: req.params.merchantId });

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to optimize routes',
    });
  }
});

/**
 * GET /delivery/merchant/:merchantId/active
 * Get active deliveries for a merchant
 */
router.get('/delivery/merchant/:merchantId/active', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    logger.info(`Fetching active deliveries for merchant ${merchantId}`);

    const result = await deliveryService.getActiveDeliveries(merchantId, { limit, offset });

    res.json({
      success: true,
      data: {
        deliveries: result.deliveries,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: offset + result.deliveries.length < result.total,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to fetch active deliveries', { error, merchantId: req.params.merchantId });

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch active deliveries',
    });
  }
});

/**
 * GET /delivery/analytics/:merchantId
 * Get delivery analytics for a merchant
 */
router.get('/delivery/analytics/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const startDate = (req.query.startDate as string) ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = (req.query.endDate as string) || new Date().toISOString();

    logger.info(`Fetching delivery analytics for merchant ${merchantId}`);

    const analytics = await deliveryService.getDeliveryAnalytics(merchantId, startDate, endDate);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error('Failed to fetch delivery analytics', { error, merchantId: req.params.merchantId });

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch delivery analytics',
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'delivery-intelligence',
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
