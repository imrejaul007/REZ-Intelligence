import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PricingEngine } from '../services/pricingEngine';
import { PricingStrategy } from '../models';
import { validateRequest } from '../middleware/validation';
import { errorHandler } from '../middleware/errorHandler';
import { StrategyType, StrategyStatus, PricingOptimizationRequest } from '../types';
import { logger } from '../utils/logger';

const router = Router();
const pricingEngine = new PricingEngine();

// Zod schemas
const pricingOptimizeSchema = z.object({
  merchantId: z.string().min(1, 'Merchant ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  competitorPrices: z.array(z.object({
    competitorId: z.string(),
    competitorName: z.string(),
    price: z.number().positive(),
    lastUpdated: z.string().datetime().or(z.date()),
  })).optional(),
  demandSignals: z.array(z.object({
    type: z.enum(['search_volume', 'sales_velocity', 'social_trend', 'seasonal', 'promotion']),
    value: z.number(),
    timestamp: z.string().datetime().or(z.date()),
    source: z.string(),
  })).optional(),
  inventoryLevel: z.number().int().nonnegative().optional(),
});

const createStrategySchema = z.object({
  merchantId: z.string().min(1, 'Merchant ID is required'),
  productId: z.string().optional(),
  categoryId: z.string().optional(),
  strategyType: z.nativeEnum(StrategyType),
  currentPrice: z.number().positive(),
  suggestedPrice: z.number().positive(),
  minPrice: z.number().nonnegative(),
  maxPrice: z.number().positive(),
  triggers: z.array(z.object({
    type: z.enum(['competitor_price', 'demand', 'inventory', 'seasonal', 'time']),
    condition: z.string(),
    threshold: z.number().optional(),
    action: z.enum(['increase', 'decrease', 'maintain']),
    amount: z.number().optional(),
  })).optional(),
  status: z.nativeEnum(StrategyStatus).optional().default(StrategyStatus.ACTIVE),
});

// POST /api/pricing/optimize - Pricing optimization
router.post(
  '/optimize',
  validateRequest(pricingOptimizeSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const {
        merchantId,
        productId,
        competitorPrices,
        demandSignals,
        inventoryLevel,
      } = req.body as PricingOptimizationRequest;

      logger.info('Optimizing pricing', { merchantId, productId });

      const optimization = await pricingEngine.optimizePrice(
        productId,
        {
          merchantId,
          competitorPrices,
          demandSignals,
          inventoryLevel,
        }
      );

      const duration = Date.now() - startTime;

      logger.info('Pricing optimization completed', {
        merchantId,
        productId,
        suggestedPrice: optimization.suggestedPrice,
        duration,
      });

      res.status(200).json({
        success: true,
        data: optimization,
        meta: {
          productId,
          duration,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/pricing/strategies/:merchantId - List active strategies
router.get(
  '/strategies/:merchantId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId } = req.params;
      const status = (req.query.status as StrategyStatus) || StrategyStatus.ACTIVE;
      const productId = req.query.productId as string;
      const categoryId = req.query.categoryId as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = parseInt(req.query.skip as string) || 0;

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

      logger.info('Fetching pricing strategies', { merchantId, status });

      const query: Record<string, unknown> = {
        merchantId,
        status,
      };

      if (productId) {
        query.productId = productId;
      }
      if (categoryId) {
        query.categoryId = categoryId;
      }

      const [strategies, total] = await Promise.all([
        PricingStrategy.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        PricingStrategy.countDocuments(query),
      ]);

      res.status(200).json({
        success: true,
        data: strategies,
        meta: {
          merchantId,
          status,
          count: strategies.length,
          total,
          limit,
          skip,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/pricing/strategies - Create strategy
router.post(
  '/strategies',
  validateRequest(createStrategySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        merchantId,
        productId,
        categoryId,
        strategyType,
        currentPrice,
        suggestedPrice,
        minPrice,
        maxPrice,
        triggers,
        status,
      } = req.body;

      logger.info('Creating pricing strategy', { merchantId, strategyType });

      // Validate price constraints
      if (suggestedPrice < minPrice || suggestedPrice > maxPrice) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PRICE_RANGE',
            message: 'Suggested price must be between min and max price',
          },
        });
        return;
      }

      const strategy = new PricingStrategy({
        merchantId,
        productId,
        categoryId,
        strategyType,
        currentPrice,
        suggestedPrice,
        minPrice,
        maxPrice,
        triggers: triggers || [],
        status: status || StrategyStatus.ACTIVE,
      });

      await strategy.save();

      logger.info('Pricing strategy created', {
        strategyId: strategy.strategyId,
        merchantId,
      });

      res.status(201).json({
        success: true,
        data: strategy,
        meta: {
          strategyId: strategy.strategyId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/pricing/strategies/:strategyId - Update strategy
router.patch(
  '/strategies/:strategyId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { strategyId } = req.params;
      const updates = req.body;

      if (!strategyId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STRATEGY_ID',
            message: 'Strategy ID is required',
          },
        });
        return;
      }

      logger.info('Updating pricing strategy', { strategyId });

      const strategy = await PricingStrategy.findOne({ strategyId });

      if (!strategy) {
        res.status(404).json({
          success: false,
          error: {
            code: 'STRATEGY_NOT_FOUND',
            message: 'Pricing strategy not found',
          },
        });
        return;
      }

      // Update allowed fields
      const allowedUpdates = ['suggestedPrice', 'status', 'triggers'];
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          (strategy as any)[field] = updates[field];
        }
      });

      await strategy.save();

      logger.info('Pricing strategy updated', { strategyId });

      res.status(200).json({
        success: true,
        data: strategy,
        meta: {
          strategyId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/pricing/strategies/:strategyId - Archive strategy
router.delete(
  '/strategies/:strategyId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { strategyId } = req.params;

      if (!strategyId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STRATEGY_ID',
            message: 'Strategy ID is required',
          },
        });
        return;
      }

      logger.info('Archiving pricing strategy', { strategyId });

      const strategy = await PricingStrategy.findOneAndUpdate(
        { strategyId },
        { status: StrategyStatus.ARCHIVED },
        { new: true }
      );

      if (!strategy) {
        res.status(404).json({
          success: false,
          error: {
            code: 'STRATEGY_NOT_FOUND',
            message: 'Pricing strategy not found',
          },
        });
        return;
      }

      logger.info('Pricing strategy archived', { strategyId });

      res.status(200).json({
        success: true,
        data: { strategyId, status: StrategyStatus.ARCHIVED },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/pricing/competitive/:merchantId - Competitive analysis
router.get(
  '/competitive/:merchantId',
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

      logger.info('Running competitive analysis', { merchantId });

      const analysis = await pricingEngine.competitiveAnalysis(merchantId);

      res.status(200).json({
        success: true,
        data: analysis,
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