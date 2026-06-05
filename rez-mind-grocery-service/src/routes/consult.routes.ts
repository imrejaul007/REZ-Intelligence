import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { GroceryMindSession } from '../models';
import { GroceryIntelligence } from '../services/groceryIntelligence';
import { BasketAnalyzer } from '../services/basketAnalyzer';
import { validateRequest } from '../middleware/validation';
import { errorHandler } from '../middleware/errorHandler';
import {
  GroceryCategory,
  ConsultResponse,
  GroceryBasketItem,
} from '../types';
import { logger } from '../utils/logger';

const router = Router();
const groceryIntelligence = new GroceryIntelligence();
const basketAnalyzer = new BasketAnalyzer();

// Zod schemas for validation
const basketItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  category: z.nativeEnum(GroceryCategory),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
  batchDate: z.string().datetime().or(z.date()).optional(),
  expiryDate: z.string().datetime().or(z.date()).optional(),
  imageUrl: z.string().optional(),
});

const consultRequestSchema = z.object({
  merchantId: z.string().min(1, 'Merchant ID is required'),
  customerId: z.string().optional(),
  basketItems: z.array(basketItemSchema).optional(),
  preferences: z.array(z.string()).optional(),
});

// POST /api/consult - AI grocery consultation
router.post(
  '/',
  validateRequest(consultRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { merchantId, customerId, basketItems, preferences } = req.body;

      logger.info('Processing grocery consultation', {
        merchantId,
        customerId,
        hasBasketItems: !!basketItems?.length,
        hasPreferences: !!preferences?.length,
      });

      // Analyze basket if provided
      let basketAnalysis = null;
      if (basketItems?.length) {
        basketAnalysis = basketAnalyzer.analyzeBasket(basketItems);
        logger.debug('Basket analysis completed', {
          crossSells: basketAnalysis.crossSellProducts.length,
          savingsTips: basketAnalysis.savingsTips.length,
        });
      }

      // Get product recommendations
      const recommendations = await groceryIntelligence.recommendProducts(
        customerId,
        preferences || []
      );

      // Get expiry alerts
      const expiryAlerts = await groceryIntelligence.generateExpiryAlerts(merchantId);

      // Get demand signals
      const demandSignals = await groceryIntelligence.getDemandSignals(merchantId);

      // Get supplier suggestions
      const supplierSuggestions = await groceryIntelligence.scoreSuppliers(merchantId);

      // Calculate savings opportunities
      const savingsOpportunities = basketAnalysis?.savingsTips.map(tip => ({
        type: tip.type,
        description: tip.description,
        potentialSavings: tip.potentialSavings,
        products: tip.applicableProducts,
        confidence: 0.85,
      })) || [];

      // Calculate confidence score
      const confidence = groceryIntelligence.calculateConfidence({
        hasBasket: !!basketItems?.length,
        hasHistory: !!customerId,
        preferencesCount: preferences?.length || 0,
      });

      // Build response
      const sessionId = uuidv4();
      const response: ConsultResponse = {
        sessionId,
        recommendations: recommendations.slice(0, 10),
        expiryAlerts: expiryAlerts.slice(0, 10),
        demandSignals: demandSignals.slice(0, 10),
        supplierSuggestions: supplierSuggestions.slice(0, 5),
        savingsOpportunities: savingsOpportunities.slice(0, 5),
        confidence,
      };

      // Save session to database
      try {
        const session = new GroceryMindSession({
          sessionId,
          merchantId,
          customerId,
          intent: 'grocery_consultation',
          context: {
            recentProducts: basketItems?.map(i => i.productId) || [],
            avgBasketValue: basketItems?.reduce((sum, i) => sum + i.totalPrice, 0) / Math.max(1, basketItems.length),
            preferredCategories: basketItems?.map(i => i.category) || [],
          },
          analysis: {
            recommendedProducts: response.recommendations,
            expiryAlerts: response.expiryAlerts,
            demandSignals: response.demandSignals,
            supplierSuggestions: response.supplierSuggestions,
            savingsOpportunities: response.savingsOpportunities,
          },
          sentiment: 0.5,
        });

        await session.save();
        logger.info('Consultation session saved', { sessionId, merchantId });
      } catch (dbError) {
        logger.warn('Failed to save session, continuing with response', {
          sessionId,
          error: dbError,
        });
      }

      const duration = Date.now() - startTime;
      logger.info('Consultation completed', {
        sessionId,
        duration,
        recommendationCount: response.recommendations.length,
      });

      res.status(200).json({
        success: true,
        data: response,
        meta: {
          sessionId,
          duration,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/consult/:sessionId - Retrieve session analysis
router.get(
  '/:sessionId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SESSION_ID',
            message: 'Session ID is required',
          },
        });
        return;
      }

      const session = await GroceryMindSession.findOne({ sessionId });

      if (!session) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Consultation session not found',
          },
        });
        return;
      }

      logger.info('Session retrieved', { sessionId });

      res.status(200).json({
        success: true,
        data: {
          sessionId: session.sessionId,
          merchantId: session.merchantId,
          customerId: session.customerId,
          intent: session.intent,
          context: session.context,
          analysis: session.analysis,
          sentiment: session.sentiment,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
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