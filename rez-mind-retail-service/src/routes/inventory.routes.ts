import { Router, Request, Response, NextFunction } from 'express';
import { RetailIntelligence } from '../services/retailIntelligence';
import { errorHandler } from '../middleware/errorHandler';
import { ProductCategory } from '../types';
import { logger } from '../utils/logger';

const router = Router();
const retailIntelligence = new RetailIntelligence();

// GET /api/inventory/forecast/:merchantId - Demand forecast
router.get(
  '/forecast/:merchantId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId } = req.params;
      const category = req.query.category as ProductCategory;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!merchantId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_MERCHANT_ID',
            message: 'Merchant ID is required',
          },
        });
        return;
      }

      logger.info('Generating demand forecast', { merchantId, category });

      const forecast = await retailIntelligence.generateDemandForecast(merchantId, category, limit);

      res.status(200).json({
        success: true,
        data: {
          forecasts: forecast,
          count: forecast.length,
          generatedAt: new Date().toISOString(),
        },
        meta: {
          merchantId,
          category: category || 'all',
          count: forecast.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/inventory/reorder/:merchantId - Reorder recommendations
router.get(
  '/reorder/:merchantId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId } = req.params;
      const urgency = req.query.urgency as string;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!merchantId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_MERCHANT_ID',
            message: 'Merchant ID is required',
          },
        });
        return;
      }

      logger.info('Generating reorder recommendations', { merchantId, urgency });

      const reorderItems = await retailIntelligence.getReorderRecommendations(merchantId, urgency, limit);

      res.status(200).json({
        success: true,
        data: {
          reorderRecommendations: reorderItems,
          count: reorderItems.length,
        },
        meta: {
          merchantId,
          urgency: urgency || 'all',
          count: reorderItems.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/inventory/trending/:merchantId - Trending products
router.get(
  '/trending/:merchantId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId } = req.params;
      const category = req.query.category as ProductCategory;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!merchantId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_MERCHANT_ID',
            message: 'Merchant ID is required',
          },
        });
        return;
      }

      logger.info('Fetching trending products', { merchantId, category });

      const trendingProducts = await retailIntelligence.detectTrends(merchantId, category, limit);

      res.status(200).json({
        success: true,
        data: {
          trendingProducts,
          count: trendingProducts.length,
        },
        meta: {
          merchantId,
          category: category || 'all',
          count: trendingProducts.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/inventory/slow-moving/:merchantId - Slow moving products
router.get(
  '/slow-moving/:merchantId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!merchantId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_MERCHANT_ID',
            message: 'Merchant ID is required',
          },
        });
        return;
      }

      logger.info('Analyzing slow-moving products', { merchantId });

      const slowMoving = await retailIntelligence.analyzeSlowMovingProducts(merchantId, limit);

      res.status(200).json({
        success: true,
        data: {
          slowMovingProducts: slowMoving,
          count: slowMoving.length,
        },
        meta: {
          merchantId,
          count: slowMoving.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/inventory/seasonal/:merchantId - Seasonal inventory planning
router.get(
  '/seasonal/:merchantId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId } = req.params;
      const months = parseInt(req.query.months as string) || 3;

      if (!merchantId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_MERCHANT_ID',
            message: 'Merchant ID is required',
          },
        });
        return;
      }

      logger.info('Generating seasonal inventory plan', { merchantId, months });

      const seasonalPlan = await retailIntelligence.generateSeasonalPlan(merchantId, months);

      res.status(200).json({
        success: true,
        data: seasonalPlan,
        meta: {
          merchantId,
          planningHorizon: `${months} months`,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/inventory/health/:merchantId - Inventory health check
router.get(
  '/health/:merchantId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId } = req.params;

      if (!merchantId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_MERCHANT_ID',
            message: 'Merchant ID is required',
          },
        });
        return;
      }

      logger.info('Checking inventory health', { merchantId });

      const healthReport = await retailIntelligence.getInventoryHealth(merchantId);

      res.status(200).json({
        success: true,
        data: healthReport,
        meta: {
          merchantId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Apply error handler
router.use(errorHandler);

export default router;