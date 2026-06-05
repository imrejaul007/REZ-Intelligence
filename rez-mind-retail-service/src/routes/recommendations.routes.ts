import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RecommendationsService } from '../services/recommendations';
import { validateRequest } from '../middleware/validation';
import { errorHandler } from '../middleware/errorHandler';
import { ProductCategory, PersonalizedRecommendationRequest } from '../types';
import { logger } from '../utils/logger';

const router = Router();
const recommendationsService = new RecommendationsService();

// Zod schemas
const personalizedRecommendationSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  merchantId: z.string().min(1, 'Merchant ID is required'),
  limit: z.number().int().positive().max(50).optional().default(10),
  includeCategories: z.array(z.nativeEnum(ProductCategory)).optional(),
  excludeProducts: z.array(z.string()).optional(),
});

// GET /api/recommendations/product/:productId - Similar products
router.get(
  '/product/:productId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { productId } = req.params;
      const limit = parseInt(req.query.limit as string) || 5;

      if (!productId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PRODUCT_ID',
            message: 'Product ID is required',
          },
        });
        return;
      }

      logger.info('Fetching similar products', { productId, limit });

      const similarProducts = await recommendationsService.similarProducts(productId, limit);

      res.status(200).json({
        success: true,
        data: similarProducts,
        meta: {
          productId,
          count: similarProducts.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/recommendations/bundle/:merchantId - Bundle opportunities
router.get(
  '/bundle/:merchantId',
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

      logger.info('Fetching bundle recommendations', { merchantId });

      const bundles = await recommendationsService.bundleRecommendations(merchantId);

      res.status(200).json({
        success: true,
        data: bundles,
        meta: {
          merchantId,
          count: bundles.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/recommendations/upsell/:merchantId - Upsell by category
router.get(
  '/upsell/:merchantId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId } = req.params;
      const category = req.query.category as ProductCategory;

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

      logger.info('Fetching upsell recommendations', { merchantId, category });

      const upsells = await recommendationsService.upsellRecommendations(merchantId, category);

      res.status(200).json({
        success: true,
        data: upsells,
        meta: {
          merchantId,
          category: category || 'all',
          count: upsells.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/recommendations/personalized - Personalized for customer
router.post(
  '/personalized',
  validateRequest(personalizedRecommendationSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { customerId, merchantId, limit, includeCategories, excludeProducts } = req.body as PersonalizedRecommendationRequest;

      logger.info('Generating personalized recommendations', {
        customerId,
        merchantId,
        limit,
      });

      const recommendations = await recommendationsService.personalizedRecommendations(
        customerId,
        merchantId,
        limit || 10,
        includeCategories,
        excludeProducts
      );

      const duration = Date.now() - startTime;

      res.status(200).json({
        success: true,
        data: {
          recommendations,
          count: recommendations.length,
        },
        meta: {
          customerId,
          merchantId,
          duration,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/recommendations/category/:merchantId - Recommendations by category
router.get(
  '/category/:merchantId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId } = req.params;
      const category = req.query.category as ProductCategory;

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

      logger.info('Fetching category recommendations', { merchantId, category });

      const recommendations = await recommendationsService.getCategoryRecommendations(
        merchantId,
        category
      );

      res.status(200).json({
        success: true,
        data: recommendations,
        meta: {
          merchantId,
          category: category || 'all',
          count: recommendations.length,
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