import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  salesAgent,
  SalesContext,
  CustomerSegment,
  Customer,
  Lead,
  SalesResponse
} from '../services/salesAgent';
import {
  getRecommendations,
  getComplementaryProducts,
  getTrendingProducts,
  getPersonalizedDeals
} from '../services/productRecommendation';
import {
  calculateDynamicPrice,
  getDiscountEligibility,
  calculateBundlePrice,
  calculatePriceWithPromoCode,
  estimateTaxesAndFees,
  generatePriceValidUntil
} from '../services/pricingService';
import { logger } from '../services/salesAgent';

const router = Router();

const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          }
        });
      }
      next(error);
    }
  };
};

const chatSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1).max(5000),
  context: z.object({
    customerId: z.string().optional(),
    customer: z.object({
      id: z.string(),
      email: z.string().email(),
      name: z.string(),
      segment: z.nativeEnum(CustomerSegment),
      lifetimeValue: z.number().min(0),
      totalOrders: z.number().int().min(0),
      averageOrderValue: z.number().min(0),
      lastPurchaseDate: z.string().datetime().nullable().optional(),
      preferences: z.record(z.unknown()).optional()
    }).nullable().optional(),
    cart: z.array(z.object({
      productId: z.string(),
      name: z.string(),
      quantity: z.number().int().min(1),
      unitPrice: z.number().min(0),
      totalPrice: z.number().min(0)
    })).optional(),
    recentProducts: z.array(z.string()).optional(),
    browsingHistory: z.array(z.string()).optional()
  }).optional()
});

const leadSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.string().optional(),
  customerId: z.string().optional()
});

const priceCalculationSchema = z.object({
  basePrice: z.number().min(0),
  segment: z.nativeEnum(CustomerSegment),
  quantity: z.number().int().min(1).optional().default(1),
  timeToTravel: z.number().min(0).optional().default(14),
  inventoryLevel: z.number().int().min(0).optional().default(10),
  demandScore: z.number().min(0).max(1).optional().default(0.5),
  bookingDay: z.enum(['weekday', 'weekend']).optional(),
  specialOccasion: z.boolean().optional(),
  repeatCustomer: z.boolean().optional()
});

const bundleSchema = z.object({
  items: z.array(z.object({
    basePrice: z.number().min(0),
    quantity: z.number().int().min(1)
  })).min(2)
});

const promoCodeSchema = z.object({
  basePrice: z.number().min(0),
  promoCode: z.string().min(1),
  customerSegment: z.nativeEnum(CustomerSegment)
});

const taxSchema = z.object({
  basePrice: z.number().min(0),
  countryCode: z.string().length(2).optional().default('US')
});

router.post('/chat', validateRequest(chatSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId: providedSessionId, message, context } = req.body;
    const sessionId = providedSessionId || uuidv4();

    logger.info('Chat request received', { sessionId, messageLength: message.length });

    const salesContext: SalesContext = {
      customer: context?.customer || null,
      lead: null,
      conversation: null,
      recentProducts: context?.recentProducts || [],
      browsingHistory: context?.browsingHistory || [],
      cart: context?.cart || [],
      preferences: context?.customer?.preferences || {}
    };

    const response: SalesResponse = await salesAgent.processCustomerIntent(
      salesContext,
      message,
      sessionId
    );

    logger.info('Chat response generated', {
      sessionId,
      success: response.success,
      processingTime: response.processingTime
    });

    res.json({
      success: true,
      data: {
        response: response.message,
        actions: response.actions,
        data: response.data
      },
      meta: {
        sessionId,
        processingTimeMs: response.processingTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Chat endpoint error', { error });
    next(error);
  }
});

router.post('/leads', validateRequest(leadSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leadData = req.body;

    logger.info('Creating new lead', { email: leadData.email });

    const lead: Lead = await salesAgent.createLead({
      email: leadData.email,
      name: leadData.name,
      phone: leadData.phone,
      company: leadData.company,
      source: leadData.source,
      customerId: leadData.customerId
    });

    res.status(201).json({
      success: true,
      data: { lead },
      meta: {
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Lead creation error', { error });
    next(error);
  }
});

router.get('/leads/:leadId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId } = req.params;
    const lead = salesAgent.getLead(leadId);

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Lead with ID ${leadId} not found`
        }
      });
    }

    res.json({
      success: true,
      data: { lead }
    });

  } catch (error) {
    next(error);
  }
});

router.get('/leads', async (req: Request, res: Response) => {
  const leads = salesAgent.getAllLeads();

  res.json({
    success: true,
    data: {
      leads,
      count: leads.length
    }
  });
});

router.patch('/leads/:leadId/score', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId } = req.params;
    const { scoreDelta } = req.body;

    if (typeof scoreDelta !== 'number' || scoreDelta < -100 || scoreDelta > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'scoreDelta must be a number between -100 and 100'
        }
      });
    }

    const lead = await salesAgent.updateLeadScore(leadId, scoreDelta);

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Lead with ID ${leadId} not found`
        }
      });
    }

    res.json({
      success: true,
      data: { lead }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/recommendations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId, customer, cart, recentProducts, browsingHistory } = req.body;

    const context = {
      customer: customer || null,
      recentProducts: recentProducts || [],
      browsingHistory: browsingHistory || [],
      cart: cart || [],
      preferences: customer?.preferences || {}
    };

    const recommendations = await getRecommendations(context);

    res.json({
      success: true,
      data: {
        recommendations,
        count: recommendations.length
      }
    });

  } catch (error) {
    next(error);
  }
});

router.get('/recommendations/trending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const trending = await getTrendingProducts(Math.min(limit, 20));

    res.json({
      success: true,
      data: {
        trending,
        count: trending.length
      }
    });

  } catch (error) {
    next(error);
  }
});

router.get('/recommendations/complementary/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const complementary = await getComplementaryProducts(productId);

    res.json({
      success: true,
      data: {
        complementary,
        count: complementary.length
      }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/recommendations/personalized-deals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId, customer, cart, recentProducts, browsingHistory } = req.body;

    const context = {
      customer: customer || null,
      recentProducts: recentProducts || [],
      browsingHistory: browsingHistory || [],
      cart: cart || [],
      preferences: customer?.preferences || {}
    };

    const deals = await getPersonalizedDeals(context);

    res.json({
      success: true,
      data: {
        deals,
        count: deals.length
      }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/pricing/calculate', validateRequest(priceCalculationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      basePrice,
      segment,
      quantity,
      timeToTravel,
      inventoryLevel,
      demandScore,
      bookingDay,
      specialOccasion,
      repeatCustomer
    } = req.body;

    const dynamicPrice = calculateDynamicPrice(basePrice, {
      segment,
      quantity,
      timeToTravel,
      inventoryLevel,
      demandScore,
      bookingDay,
      specialOccasion,
      repeatCustomer
    });

    const originalPrice = basePrice;
    const discount = originalPrice - dynamicPrice;
    const discountPercent = originalPrice > 0 ? (discount / originalPrice) * 100 : 0;
    const validUntil = generatePriceValidUntil(basePrice);

    res.json({
      success: true,
      data: {
        originalPrice,
        dynamicPrice,
        discount,
        discountPercent: Math.round(discountPercent * 10) / 10,
        segment,
        priceValidUntil: validUntil.toISOString(),
        breakdown: {
          quantity,
          timeToTravel,
          inventoryLevel,
          demandScore
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/pricing/discount-eligibility', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      customerId,
      segment,
      lifetimeValue,
      totalOrders,
      cartValue
    } = req.body;

    const eligibility = getDiscountEligibility({
      customerId: customerId || null,
      segment: segment || CustomerSegment.NEW_CUSTOMER,
      lifetimeValue: lifetimeValue || 0,
      totalOrders: totalOrders || 0,
      cartValue: cartValue || 0
    });

    res.json({
      success: true,
      data: eligibility
    });

  } catch (error) {
    next(error);
  }
});

router.post('/pricing/bundle', validateRequest(bundleSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items } = req.body;

    const bundlePricing = calculateBundlePrice(items);

    res.json({
      success: true,
      data: bundlePricing
    });

  } catch (error) {
    next(error);
  }
});

router.post('/pricing/promo', validateRequest(promoCodeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { basePrice, promoCode, customerSegment } = req.body;

    const result = calculatePriceWithPromoCode(basePrice, promoCode, customerSegment);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    next(error);
  }
});

router.post('/pricing/taxes', validateRequest(taxSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { basePrice, countryCode } = req.body;

    const taxBreakdown = estimateTaxesAndFees(basePrice, countryCode);

    res.json({
      success: true,
      data: taxBreakdown
    });

  } catch (error) {
    next(error);
  }
});

export { router as salesRouter };
