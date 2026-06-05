import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { ExpiryPrediction } from '../models';
import { ExpiryOptimizer } from '../services/expiryOptimizer';
import { validateRequest } from '../middleware/validation';
import { errorHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const expiryOptimizer = new ExpiryOptimizer();

// Zod schemas for validation
const simulateRequestSchema = z.object({
  productId: z.string().min(1),
  discountPercentage: z.number().min(0).max(100),
  currentStock: z.number().int().positive(),
  currentPrice: z.number().nonnegative(),
});

const predictRequestSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  category: z.string().min(1),
  batchDate: z.string().datetime().or(z.date()),
  storageConditions: z.object({
    temperature: z.number(),
    humidity: z.number().optional(),
    refrigerated: z.boolean().optional(),
  }).optional(),
});

// GET /api/expiry/predictions/:merchantId - Get expiry predictions for all products
router.get(
  '/predictions/:merchantId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId } = req.params;
      const { daysThreshold, category, action } = req.query;

      logger.info('Fetching expiry predictions', { merchantId, daysThreshold, category });

      let query: Record<string, unknown> = { merchantId };

      if (daysThreshold) {
        query.daysRemaining = { $lte: parseInt(daysThreshold as string, 10) };
      }

      if (category) {
        query.category = category;
      }

      if (action) {
        query.suggestedAction = action;
      }

      const predictions = await ExpiryPrediction.find(query)
        .sort({ daysRemaining: 1 })
        .limit(100)
        .exec();

      // Group by urgency level
      const grouped = {
        critical: predictions.filter(p => p.daysRemaining <= 1),
        high: predictions.filter(p => p.daysRemaining > 1 && p.daysRemaining <= 3),
        medium: predictions.filter(p => p.daysRemaining > 3 && p.daysRemaining <= 7),
        low: predictions.filter(p => p.daysRemaining > 7),
      };

      logger.info('Expiry predictions retrieved', {
        merchantId,
        total: predictions.length,
        critical: grouped.critical.length,
      });

      res.status(200).json({
        success: true,
        data: {
          predictions: predictions.map(p => ({
            predictionId: p.predictionId,
            productId: p.productId,
            productName: p.productName,
            category: p.category,
            predictedExpiryDate: p.predictedExpiryDate,
            daysRemaining: p.daysRemaining,
            confidence: p.confidence,
            suggestedAction: p.suggestedAction,
            suggestedDiscount: p.suggestedDiscount,
            reasoning: `Predicted to expire in ${p.daysRemaining} days with ${Math.round(p.confidence * 100)}% confidence`,
          })),
          summary: {
            total: predictions.length,
            critical: grouped.critical.length,
            high: grouped.high.length,
            medium: grouped.medium.length,
            low: grouped.low.length,
          },
          categoryBreakdown: await ExpiryPrediction.getCategoryBreakdown(merchantId),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/expiry/predictions/:merchantId/product/:productId - Get specific product expiry prediction
router.get(
  '/predictions/:merchantId/product/:productId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId, productId } = req.params;

      logger.info('Fetching product expiry prediction', { merchantId, productId });

      const predictions = await ExpiryPrediction.find({ merchantId, productId })
        .sort({ createdAt: -1 })
        .limit(10)
        .exec();

      if (predictions.length === 0) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PREDICTIONS_NOT_FOUND',
            message: 'No expiry predictions found for this product',
          },
        });
        return;
      }

      const latest = predictions[0];

      res.status(200).json({
        success: true,
        data: {
          predictionId: latest.predictionId,
          productId: latest.productId,
          productName: latest.productName,
          category: latest.category,
          predictedExpiryDate: latest.predictedExpiryDate,
          daysRemaining: latest.daysRemaining,
          confidence: latest.confidence,
          suggestedAction: latest.suggestedAction,
          suggestedDiscount: latest.suggestedDiscount,
          batchDate: latest.batchDate,
          storageConditions: latest.storageConditions,
          history: predictions.map(p => ({
            predictionId: p.predictionId,
            predictedExpiryDate: p.predictedExpiryDate,
            actualExpiryDate: p.actualExpiryDate,
            daysRemaining: p.daysRemaining,
            confidence: p.confidence,
            createdAt: p.createdAt,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/expiry/predictions/:merchantId/simulate - Simulate discount impact
router.post(
  '/predictions/:merchantId/simulate',
  validateRequest(simulateRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId } = req.params;
      const { productId, discountPercentage, currentStock, currentPrice } = req.body;

      logger.info('Simulating discount impact', {
        merchantId,
        productId,
        discountPercentage,
        currentStock,
      });

      const simulation = await expiryOptimizer.simulateDiscountImpact({
        productId,
        currentStock,
        currentPrice,
        discountPercentage,
      });

      // Generate alternative discount scenarios
      const scenarios = [25, 50, 75].map(discount => {
        const newPrice = currentPrice * (1 - discount / 100);
        const expectedSellThrough = Math.min(100, 30 + discount * 1.2);
        const expectedSold = Math.floor(currentStock * (expectedSellThrough / 100));
        const revenue = expectedSold * newPrice;
        const waste = currentStock - expectedSold;
        const wasteValue = waste * currentPrice;

        return {
          discountPercentage: discount,
          newPrice: Math.round(newPrice * 100) / 100,
          expectedSellThrough: Math.round(expectedSellThrough),
          expectedSold,
          projectedRevenue: Math.round(revenue * 100) / 100,
          projectedWasteUnits: waste,
          projectedWasteValue: Math.round(wasteValue * 100) / 100,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          simulation,
          alternativeScenarios: scenarios,
          recommendation: expiryOptimizer.generateDiscountRecommendation(
            currentStock,
            scenarios
          ),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/expiry/predictions/:merchantId/predict - Create new expiry prediction
router.post(
  '/predictions/:merchantId/predict',
  validateRequest(predictRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { merchantId } = req.params;
      const { productId, productName, category, batchDate, storageConditions } = req.body;

      logger.info('Creating expiry prediction', { merchantId, productId });

      const prediction = await expiryOptimizer.predictExpiry({
        productId,
        productName,
        category,
        batchDate: new Date(batchDate),
        storageConditions,
      });

      // Save to database
      const expiryPrediction = new ExpiryPrediction({
        predictionId: prediction.predictionId,
        merchantId,
        productId,
        productName,
        category,
        predictedExpiryDate: prediction.predictedExpiryDate,
        confidence: prediction.confidence,
        suggestedAction: prediction.suggestedAction,
        suggestedDiscount: prediction.suggestedDiscount,
        daysRemaining: prediction.daysRemaining,
        batchDate: new Date(batchDate),
        storageConditions,
      });

      await expiryPrediction.save();

      res.status(201).json({
        success: true,
        data: prediction,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Apply error handler
router.use(errorHandler);

export default router;