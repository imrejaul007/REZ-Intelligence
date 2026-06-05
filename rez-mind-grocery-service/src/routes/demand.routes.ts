import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { DemandForecast } from '../models';
import { GroceryIntelligence } from '../services/groceryIntelligence';
import { validateRequest } from '../middleware/validation';
import { errorHandler } from '../middleware/errorHandler';
import { GroceryCategory } from '../types';
import { logger } from '../utils/logger';

const router = Router();
const groceryIntelligence = new GroceryIntelligence();

// Zod schemas for validation
const adjustRequestSchema = z.object({
  merchantId: z.string().min(1),
  productId: z.string().min(1),
  adjustmentType: z.enum(['event', 'promotion', 'seasonal', 'supply_issue', 'weather']),
  adjustmentValue: z.number(),
  reason: z.string().min(1),
});

const forecastRequestSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().optional(),
  category: z.nativeEnum(GroceryCategory).optional(),
  daysAhead: z.number().int().positive().default(7),
  includeHistorical: z.boolean().default(true),
});

// GET /api/demand/forecast/:merchantId - Get demand forecasts
router.get(
  '/forecast/:merchantId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId } = req.params;
      const { category, trend, daysAhead } = req.query;

      logger.info('Fetching demand forecasts', { merchantId, category, trend });

      let query: Record<string, unknown> = { merchantId };

      if (category) {
        query.category = category;
      }

      if (trend) {
        query.trend = trend;
      }

      // Filter by date range if specified
      if (daysAhead) {
        const fromDate = new Date();
        const toDate = new Date();
        toDate.setDate(toDate.getDate() + parseInt(daysAhead as string, 10));
        query.dateRange = { $gte: fromDate, $lte: toDate };
      }

      const forecasts = await DemandForecast.find(query)
        .sort({ predictedQuantity: -1 })
        .limit(100)
        .exec();

      // Group by trend direction
      const summary = {
        trendingUp: forecasts.filter(f => f.trend === 'trending_up').length,
        trendingDown: forecasts.filter(f => f.trend === 'trending_down').length,
        stable: forecasts.filter(f => f.trend === 'stable').length,
        total: forecasts.length,
      };

      logger.info('Demand forecasts retrieved', {
        merchantId,
        total: forecasts.length,
        summary,
      });

      res.status(200).json({
        success: true,
        data: {
          forecasts: forecasts.map(f => ({
            forecastId: f.forecastId,
            productId: f.productId,
            productName: f.productName,
            category: f.category,
            predictedQuantity: f.predictedQuantity,
            confidence: f.confidence,
            dateRange: f.dateRange,
            confidenceInterval: f.confidenceInterval,
            trend: f.trend,
            seasonality: f.seasonality,
            influencingFactors: f.influencingFactors,
            accuracy: f.accuracy,
          })),
          summary,
          trendBreakdown: await DemandForecast.getMerchantTrendSummary(merchantId),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/demand/forecast/:merchantId/product/:productId - Get specific product forecast
router.get(
  '/forecast/:merchantId/product/:productId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId, productId } = req.params;

      logger.info('Fetching product demand forecast', { merchantId, productId });

      const forecasts = await DemandForecast.find({ merchantId, productId })
        .sort({ dateRange: 1 })
        .limit(30)
        .exec();

      if (forecasts.length === 0) {
        res.status(404).json({
          success: false,
          error: {
            code: 'FORECASTS_NOT_FOUND',
            message: 'No demand forecasts found for this product',
          },
        });
        return;
      }

      // Calculate statistics
      const avgPredicted = forecasts.reduce((sum, f) => sum + f.predictedQuantity, 0) / forecasts.length;
      const avgConfidence = forecasts.reduce((sum, f) => sum + f.confidence, 0) / forecasts.length;

      // Determine overall trend
      const recentForecasts = forecasts.slice(-5);
      const trendDirection =
        recentForecasts[recentForecasts.length - 1].predictedQuantity >
        recentForecasts[0].predictedQuantity
          ? 'trending_up'
          : recentForecasts[recentForecasts.length - 1].predictedQuantity <
            recentForecasts[0].predictedQuantity
          ? 'trending_down'
          : 'stable';

      res.status(200).json({
        success: true,
        data: {
          productId,
          summary: {
            avgPredictedQuantity: Math.round(avgPredicted * 10) / 10,
            avgConfidence: Math.round(avgConfidence * 100) / 100,
            forecastCount: forecasts.length,
            trendDirection,
          },
          forecasts: forecasts.map(f => ({
            forecastId: f.forecastId,
            predictedQuantity: f.predictedQuantity,
            dateRange: f.dateRange,
            confidence: f.confidence,
            confidenceInterval: f.confidenceInterval,
            actualQuantity: f.actualQuantity,
            accuracy: f.accuracy,
            trend: f.trend,
            createdAt: f.createdAt,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/demand/adjust - Adjust forecast based on events/promotions
router.post(
  '/adjust',
  validateRequest(adjustRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId, productId, adjustmentType, adjustmentValue, reason } = req.body;

      logger.info('Adjusting demand forecast', {
        merchantId,
        productId,
        adjustmentType,
        adjustmentValue,
      });

      // Find current forecast
      const currentForecast = await DemandForecast.findOne({
        merchantId,
        productId,
        dateRange: { $gte: new Date() },
      }).sort({ dateRange: 1 });

      if (!currentForecast) {
        res.status(404).json({
          success: false,
          error: {
            code: 'FORECAST_NOT_FOUND',
            message: 'No active forecast found for this product',
          },
        });
        return;
      }

      // Calculate adjustment
      const adjustmentMultiplier =
        adjustmentType === 'supply_issue'
          ? 1 - adjustmentValue / 100
          : 1 + adjustmentValue / 100;

      const adjustedQuantity = Math.round(
        currentForecast.predictedQuantity * adjustmentMultiplier
      );

      const adjustedConfidence = Math.max(
        0.5,
        currentForecast.confidence - Math.abs(adjustmentValue) / 200
      );

      // Update forecast
      await DemandForecast.findByIdAndUpdate(currentForecast._id, {
        predictedQuantity: adjustedQuantity,
        confidence: adjustedConfidence,
        $push: {
          influencingFactors: `${adjustmentType}: ${reason} (${adjustmentValue}%)`,
        },
      });

      res.status(200).json({
        success: true,
        data: {
          forecastId: currentForecast.forecastId,
          productId,
          adjustment: {
            type: adjustmentType,
            value: adjustmentValue,
            reason,
            multiplier: adjustmentMultiplier,
          },
          previousForecast: {
            predictedQuantity: currentForecast.predictedQuantity,
            confidence: currentForecast.confidence,
          },
          adjustedForecast: {
            predictedQuantity: adjustedQuantity,
            confidence: adjustedConfidence,
          },
          projectedImpact: {
            unitsDifference: adjustedQuantity - currentForecast.predictedQuantity,
            confidenceImpact: -(currentForecast.confidence - adjustedConfidence),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/demand/forecast/:merchantId/generate - Generate new forecast
router.post(
  '/forecast/:merchantId/generate',
  validateRequest(forecastRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId } = req.params;
      const { productId, productName, category, daysAhead = 7 } = req.body;

      logger.info('Generating demand forecast', { merchantId, productId, daysAhead });

      const forecast = await groceryIntelligence.forecastDemand(
        merchantId,
        productId,
        daysAhead
      );

      // Save to database
      const demandForecast = new DemandForecast({
        forecastId: forecast.forecastId,
        merchantId,
        productId,
        productName: productName || `Product ${productId}`,
        category: category || 'essentials',
        predictedQuantity: forecast.predictedQuantity,
        confidence: forecast.confidence,
        dateRange: forecast.dateRange,
        confidenceInterval: forecast.confidenceInterval,
        trend: forecast.trend,
        seasonality: forecast.seasonality,
        influencingFactors: forecast.influencingFactors,
      });

      await demandForecast.save();

      res.status(201).json({
        success: true,
        data: forecast,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Apply error handler
router.use(errorHandler);

export default router;