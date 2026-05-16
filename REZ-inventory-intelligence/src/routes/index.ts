import { Router, Request, Response } from 'express';
import { inventoryService } from '../services/inventoryService.js';
import logger from '../utils/logger.js';
import { ZodError } from 'zod';

const router = Router();

/**
 * GET /inventory/:productId
 * Get inventory insight for a product
 */
router.get('/inventory/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Product ID is required',
      });
      return;
    }

    logger.info(`Fetching inventory insight for product ${productId}`);

    const insight = await inventoryService.getInventoryInsight(productId);

    res.json({
      success: true,
      data: insight,
    });
  } catch (error) {
    logger.error('Failed to fetch inventory insight', { error, productId: req.params.productId });

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
      message: 'Failed to fetch inventory insight',
    });
  }
});

/**
 * GET /inventory/:productId/forecast
 * Get demand forecast for a product
 */
router.get('/inventory/:productId/forecast', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const period = (req.query.period as 'DAILY' | 'WEEKLY' | 'MONTHLY') || 'DAILY';

    logger.info(`Fetching demand forecast for product ${productId}`);

    const forecast = await inventoryService.getProductForecast(productId, period);

    res.json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    logger.error('Failed to fetch demand forecast', { error, productId: req.params.productId });

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch demand forecast',
    });
  }
});

/**
 * GET /inventory/:productId/velocity
 * Get velocity analysis for a product
 */
router.get('/inventory/:productId/velocity', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    logger.info(`Fetching velocity analysis for product ${productId}`);

    const analysis = await inventoryService.getVelocityAnalysis(productId);

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    logger.error('Failed to fetch velocity analysis', { error, productId: req.params.productId });

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch velocity analysis',
    });
  }
});

/**
 * GET /inventory/:productId/movements
 * Get stock movements for a product
 */
router.get('/inventory/:productId/movements', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;

    logger.info(`Fetching stock movements for product ${productId}`);

    const movements = await inventoryService.getStockMovements(productId, {
      startDate,
      endDate,
      limit,
    });

    res.json({
      success: true,
      data: movements,
    });
  } catch (error) {
    logger.error('Failed to fetch stock movements', { error, productId: req.params.productId });

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch stock movements',
    });
  }
});

/**
 * GET /inventory/alerts
 * Get all low stock alerts
 */
router.get('/inventory/alerts', async (req: Request, res: Response) => {
  try {
    const urgency = req.query.urgency as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    logger.info('Fetching low stock alerts');

    const result = await inventoryService.getLowStockAlerts({ urgency, limit, offset });

    res.json({
      success: true,
      data: {
        alerts: result.alerts,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: offset + result.alerts.length < result.total,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to fetch low stock alerts', { error });

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch low stock alerts',
    });
  }
});

/**
 * GET /inventory/bulk/insights
 * Get bulk inventory insights
 */
router.post('/inventory/bulk/insights', async (req: Request, res: Response) => {
  try {
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'productIds array is required',
      });
      return;
    }

    if (productIds.length > 100) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Maximum 100 product IDs allowed per request',
      });
      return;
    }

    logger.info(`Fetching bulk insights for ${productIds.length} products`);

    const insights = await inventoryService.getBulkInsights(productIds);

    res.json({
      success: true,
      data: {
        insights,
        count: insights.length,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch bulk insights', { error });

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch bulk insights',
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
      service: 'inventory-intelligence',
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
