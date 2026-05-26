import { Router, Request, Response } from 'express';
import { customerService } from '../services/customerService.js';
import logger from './utils/logger.js';
import { ZodError } from 'zod';

const router = Router();

/**
 * GET /customer/:userId
 * Get full customer overview
 */
router.get('/customer/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'User ID is required',
      });
      return;
    }

    logger.info(`Fetching customer overview for user ${userId}`);

    const overview = await customerService.getCustomerOverview(userId);

    res.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    logger.error('Failed to fetch customer overview', { error, userId: req.params.userId });

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
      message: 'Failed to fetch customer overview',
    });
  }
});

/**
 * GET /customer/:userId/orders
 * Get order history for a customer
 */
router.get('/customer/:userId/orders', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string | undefined;

    logger.info(`Fetching orders for user ${userId}`);

    const result = await customerService.getOrderHistory(userId, { limit, offset, status });

    res.json({
      success: true,
      data: {
        orders: result.orders,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: offset + result.orders.length < result.total,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to fetch order history', { error, userId: req.params.userId });

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch order history',
    });
  }
});

/**
 * GET /customer/:userId/recommendations
 * Get personalized recommendations for a customer
 */
router.get('/customer/:userId/recommendations', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    logger.info(`Fetching recommendations for user ${userId}`);

    const recommendations = await customerService.getRecommendations(userId, limit);

    res.json({
      success: true,
      data: {
        userId,
        recommendations,
        count: recommendations.length,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch recommendations', { error, userId: req.params.userId });

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch recommendations',
    });
  }
});

/**
 * GET /customer/:userId/profile
 * Get unified profile for a customer
 */
router.get('/customer/:userId/profile', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    logger.info(`Fetching profile for user ${userId}`);

    const profile = await customerService.getProfile(userId);

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    logger.error('Failed to fetch profile', { error, userId: req.params.userId });

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch profile',
    });
  }
});

/**
 * GET /customer/:userId/segments
 * Get segments for a customer
 */
router.get('/customer/:userId/segments', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    logger.info(`Fetching segments for user ${userId}`);

    const segments = await customerService.getSegments(userId);

    res.json({
      success: true,
      data: {
        userId,
        segments,
        count: segments.length,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch segments', { error, userId: req.params.userId });

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch segments',
    });
  }
});

/**
 * GET /customer/:userId/predictions
 * Get predictions for a customer
 */
router.get('/customer/:userId/predictions', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    logger.info(`Fetching predictions for user ${userId}`);

    const predictions = await customerService.getPredictions(userId);

    res.json({
      success: true,
      data: {
        userId,
        predictions,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch predictions', { error, userId: req.params.userId });

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch predictions',
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
      service: 'customer-intelligence-hub',
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
