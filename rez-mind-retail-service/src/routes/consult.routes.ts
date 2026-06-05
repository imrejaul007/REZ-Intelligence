import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { RetailMindSession } from '../models';
import { RetailIntelligence } from '../services/retailIntelligence';
import { validateRequest } from '../middleware/validation';
import { errorHandler } from '../middleware/errorHandler';
import {
  CustomerSegment,
  ProductCategory,
  ConsultResponse,
  CartItem,
} from '../types';
import { logger } from '../utils/logger';
import { getCustomerIntent, trackRecommendationConversion } from '../integrations/rabtul';

const router = Router();
const retailIntelligence = new RetailIntelligence();

// Zod schemas for validation
const cartItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  category: z.nativeEnum(ProductCategory),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
  imageUrl: z.string().optional(),
});

const browseEventSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  category: z.nativeEnum(ProductCategory),
  viewedAt: z.string().datetime().or(z.date()),
  duration: z.number().nonnegative().optional(),
  addedToCart: z.boolean().optional(),
});

const consultRequestSchema = z.object({
  merchantId: z.string().min(1, 'Merchant ID is required'),
  customerId: z.string().optional(),
  cartItems: z.array(cartItemSchema).optional(),
  preferences: z.array(z.string()).optional(),
  browseHistory: z.array(browseEventSchema).optional(),
});

// POST /api/consult - AI retail consultation
router.post(
  '/',
  validateRequest(consultRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { merchantId, customerId, cartItems, preferences, browseHistory } = req.body;

      logger.info('Processing retail consultation', {
        merchantId,
        customerId,
        hasCartItems: !!cartItems?.length,
        hasBrowseHistory: !!browseHistory?.length,
      });

      // Analyze cart if provided
      let cartAnalysis = null;
      if (cartItems?.length) {
        cartAnalysis = await retailIntelligence.analyzeCart(cartItems);
        logger.debug('Cart analysis completed', { cartAnalysis });
      }

      // Get customer intent from RABTUL Intent Graph for personalization
      let customerIntent = null;
      if (customerId) {
        try {
          const intentResult = await getCustomerIntent(customerId, { merchantId, category: 'retail' });
          if (intentResult.success && intentResult.intent) {
            customerIntent = intentResult.intent;
            logger.info('Customer intent retrieved for personalization', {
              customerId,
              hasPreferences: customerIntent.preferences?.length > 0,
            });
          }
        } catch (intentError) {
          logger.warn('Failed to get customer intent', { error: intentError, customerId });
        }
      }

      // Determine customer segment
      const customerSegment = await retailIntelligence.segmentCustomer({
        customerId,
        orders: [],
        totalSpent: 0,
        orderCount: 0,
        avgOrderValue: 0,
        lastPurchaseDate: new Date(),
        favoriteCategories: [],
      });

      // Get product recommendations
      const recommendations = await retailIntelligence.recommendProducts(
        cartItems?.[0]?.category || ProductCategory.ELECTRONICS,
        preferences || []
      );

      // Generate next best action
      const nextBestAction = retailIntelligence.generateNextBestAction({
        customerSegment,
        cartAnalysis,
        hasBrowseHistory: !!browseHistory?.length,
      });

      // Calculate confidence score
      const confidence = retailIntelligence.calculateConfidence({
        hasCart: !!cartItems?.length,
        hasHistory: !!browseHistory?.length,
        segmentConfidence: 0.75,
      });

      // Build response
      const sessionId = uuidv4();
      const response: ConsultResponse = {
        sessionId,
        recommendations: recommendations.slice(0, 10),
        upsellOpportunities: cartAnalysis?.crossSellProducts || [],
        pricingSuggestions: [],
        inventoryAlerts: [],
        customerSegment,
        nextBestAction,
        confidence,
      };

      // Track recommendation event via RABTUL SDK
      try {
        await trackRecommendationConversion({
          customerId: customerId || 'anonymous',
          merchantId,
          sessionId,
          recommendations: response.recommendations.map(r => ({
            productId: r.productId,
            productName: r.productName,
            score: r.matchScore,
            price: r.price,
          })),
          conversionType: 'shown',
        });
      } catch (trackError) {
        logger.warn('Failed to track recommendation event', { error: trackError, sessionId });
      }

      // Save session to database
      try {
        const session = new RetailMindSession({
          sessionId,
          merchantId,
          customerId,
          customerProfile: {
            segment: customerSegment,
            preferences: preferences || [],
            avgOrderValue: 0,
            purchaseFrequency: 'unknown',
            preferredCategories: cartItems?.map(c => c.category) || [],
            priceSensitivity: 0.5,
          },
          cartItems,
          analysis: {
            recommendedProducts: response.recommendations,
            upsellOpportunities: response.upsellOpportunities,
            pricingSuggestions: response.pricingSuggestions,
            inventoryAlerts: response.inventoryAlerts,
          },
          nextBestAction,
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

      const session = await RetailMindSession.findOne({ sessionId });

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
          customerProfile: session.customerProfile,
          cartItems: session.cartItems,
          analysis: session.analysis,
          sentimentScore: session.sentimentScore,
          nextBestAction: session.nextBestAction,
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
