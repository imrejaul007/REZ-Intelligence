/**
 * REZ Unified Ad Decision Service
 * PRODUCTION: Now calls real ML services for predictions
 * INPUT VALIDATION: All request bodies validated with Zod schemas
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import axios from 'axios';
import { z } from 'zod';
import logger from './utils/logger.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '4180', 10);

// External service URLs
const PREDICTIVE_ENGINE_URL = process.env.PREDICTIVE_ENGINE_URL || 'http://localhost:4123';
const MOMENT_ENGINE_URL = process.env.MOMENT_ENGINE_URL || 'http://localhost:4118';
const CROSS_SELL_URL = process.env.CROSS_SELL_URL || 'http://localhost:4109';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
const REQUEST_TIMEOUT = 5000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============================================
// ZOD VALIDATION SCHEMAS
// ============================================

/**
 * ISO 8601 datetime string validator
 */
const isoDateTimeString = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'timestamp must be a valid ISO 8601 datetime string' }
);

/**
 * Location schema for geo-based targeting
 */
const LocationSchema = z.object({
  lat: z.number().min(-90, 'Latitude must be at least -90').max(90, 'Latitude must be at most 90'),
  lng: z.number().min(-180, 'Longitude must be at least -180').max(180, 'Longitude must be at most 180')
});

/**
 * Ad context types
 */
const AdContextSchema = z.enum(['feed', 'nearby', 'checkout', 'notification', 'retargeting']);

/**
 * Main ad decision request
 */
export const AdDecisionRequestSchema = z.object({
  userId: z.string().min(1, 'userId is required and cannot be empty'),
  location: LocationSchema.optional(),
  context: AdContextSchema,
  slots: z.number().int().min(1, 'slots must be at least 1').max(20, 'slots must be at most 20').optional().default(3),
  excludeCampaigns: z.array(z.string()).max(50, 'Maximum 50 campaigns can be excluded').optional().default([])
});

/**
 * Slot request body
 */
export const SlotRequestSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  location: LocationSchema.optional(),
  slotType: AdContextSchema.optional().default('feed')
});

/**
 * Ad impression request
 */
export const AdImpressionRequestSchema = z.object({
  adId: z.string().min(1, 'adId is required'),
  campaignId: z.string().min(1, 'campaignId is required'),
  userId: z.string().min(1, 'userId is required'),
  location: LocationSchema.optional(),
  timestamp: isoDateTimeString.optional()
});

/**
 * Ad click request
 */
export const AdClickRequestSchema = z.object({
  adId: z.string().min(1, 'adId is required'),
  campaignId: z.string().min(1, 'campaignId is required'),
  userId: z.string().min(1, 'userId is required'),
  timestamp: isoDateTimeString.optional()
});

/**
 * Ad conversion request
 */
export const AdConversionRequestSchema = z.object({
  adId: z.string().min(1, 'adId is required'),
  campaignId: z.string().min(1, 'campaignId is required'),
  userId: z.string().min(1, 'userId is required'),
  orderId: z.string().min(1, 'orderId is required'),
  revenue: z.number().positive('revenue must be a positive number'),
  timestamp: isoDateTimeString.optional()
});

// ============================================
// TYPE EXPORTS FROM ZOD SCHEMAS
// ============================================

export type AdDecisionRequestInput = z.infer<typeof AdDecisionRequestSchema>;
export type SlotRequestInput = z.infer<typeof SlotRequestSchema>;
export type AdImpressionRequestInput = z.infer<typeof AdImpressionRequestSchema>;
export type AdClickRequestInput = z.infer<typeof AdClickRequestSchema>;
export type AdConversionRequestInput = z.infer<typeof AdConversionRequestSchema>;
export type LocationInput = z.infer<typeof LocationSchema>;

// ============================================
// VALIDATION HELPER
// ============================================

/**
 * Safely parse and validate request body against a Zod schema
 */
function validateBody<T>(schema: z.ZodType<T>, body: unknown, context: string): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const errorMessages = result.error.issues
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    logger.warn(`[AdDecision] ${context} validation failed: ${errorMessages}`);
    throw new ValidationError(`[AdDecision] ${context} validation failed: ${errorMessages}`);
  }
  return result.data;
}

/**
 * Custom error class for validation failures
 */
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ============================================
// TYPES
// ============================================

interface AdDecision {
  adId: string;
  campaignId: string;
  merchantId: string;
  merchantName: string;
  type: AdType;
  targetingReason: string;
  bidAmount: number;
  floorPrice: number;
  cashback: number;
  coins: number;
  discount: number;
  content: AdContent;
  momentContext?: MomentContext;
  crossSellContext?: CrossSellContext;
  priority: number;
  expiresAt: Date;
}

type AdType =
  | 'cross_sell'
  | 'retention'
  | 'churn_prevention'
  | 'lifecycle'
  | 'location'
  | 'personalized'
  | 'competitor'
  | 'upsell';

interface AdContent {
  headline: string;
  description: string;
  image?: string;
  cta: string;
  ctaUrl?: string;
}

interface MomentContext {
  momentType: string;
  momentData: Record<string, unknown>;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

interface CrossSellContext {
  fromCategory: string;
  toCategory: string;
  fromMerchant?: string;
  reason: string;
  confidence: number;
}

interface AdDecisionRequest {
  userId: string;
  location?: { lat: number; lng: number };
  context: 'feed' | 'nearby' | 'checkout' | 'notification' | 'retargeting';
  slots?: number; // Number of ad slots to fill
  excludeCampaigns?: string[];
}

interface AdDecisionResponse {
  requestId: string;
  timestamp: Date;
  decisions: AdDecision[];
  userContext: {
    tier: string;
    lifetimeValue: number;
    churnRisk: number;
    spendProbability: number;
    activeMoments: string[];
  };
}

// ============================================
// AD DECISION ENGINE
// ============================================

class AdDecisionEngine {
  private readonly FLOOR_PRICES = {
    cross_sell: 0.50,
    retention: 0.30,
    churn_prevention: 0.75,
    lifecycle: 0.40,
    location: 0.25,
    personalized: 0.35,
    competitor: 0.60,
    upsell: 0.45,
  };

  private readonly PRIORITY_WEIGHTS = {
    critical: 100,
    high: 75,
    medium: 50,
    low: 25,
  };

  /**
   * Make ad decisions for a user
   */
  async decide(request: AdDecisionRequest): Promise<AdDecisionResponse> {
    const { userId, location, context, slots = 3, excludeCampaigns = [] } = request;

    // 1. Get user predictions
    const predictions = await this.getPredictions(userId);

    // 2. Get active moments
    const moments = await this.getActiveMoments(userId, location);

    // 3. Get cross-sell opportunities
    const crossSells = await this.getCrossSellOpportunities(userId, predictions);

    // 4. Generate candidates
    const candidates: AdDecision[] = [];

    // Add moment-based ads
    for (const moment of moments) {
      const momentAd = this.createMomentAd(moment, predictions);
      candidates.push(momentAd);
    }

    // Add cross-sell ads
    for (const crossSell of crossSells) {
      const crossSellAd = this.createCrossSellAd(crossSell, predictions);
      candidates.push(crossSellAd);
    }

    // Add contextual ads based on context
    const contextualAds = await this.getContextualAds(userId, context, predictions);
    candidates.push(...contextualAds);

    // 5. Filter and score
    const filtered = candidates.filter(
      (c) => !excludeCampaigns.includes(c.campaignId)
    );

    // 6. Auction - select best ads
    const auctioned = this.runAuction(filtered, slots);

    // 7. Format response
    return {
      requestId: `${crypto.randomUUID()}`,
      timestamp: new Date(),
      decisions: auctioned,
      userContext: {
        tier: predictions.tier || 'bronze',
        lifetimeValue: predictions.lifetimeValue || 0,
        churnRisk: predictions.churnRisk || 0,
        spendProbability: predictions.spendProbability || 0,
        activeMoments: moments.map((m) => m.type),
      },
    };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  // PRODUCTION: Call real ML services
  private async getPredictions(userId: string): Promise<{
    tier?: string;
    lifetimeValue?: number;
    churnRisk?: number;
    spendProbability?: number;
    avgBill?: number;
  }> {
    try {
      const response = await axios.get(`${PREDICTIVE_ENGINE_URL}/api/predict/user/${userId}`, {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
        timeout: REQUEST_TIMEOUT
      });
      if (response.data?.success && response.data.data) {
        const d = response.data.data;
        return {
          tier: d.tier || 'bronze',
          lifetimeValue: d.ltv || 0,
          churnRisk: d.churnRisk || 0,
          spendProbability: d.spendProbability || 0,
          avgBill: d.avgOrderValue || 0
        };
      }
    } catch (error) {
      logger.warn('[AdDecision] Failed to fetch predictions:', error);
    }
    // Fallback with warning - DO NOT use in production
    logger.warn(`[AdDecision] Using fallback predictions for user ${userId}`);
    return { tier: 'unknown', lifetimeValue: 0, churnRisk: 0, spendProbability: 0, avgBill: 0 };
  }

  private async getActiveMoments(
    userId: string,
    location?: { lat: number; lng: number }
  ): Promise<Array<{ type: string; priority: string; data: Record<string, unknown> }>> {
    try {
      const response = await axios.post(`${MOMENT_ENGINE_URL}/api/moments/active`, {
        userId,
        location
      }, {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
        timeout: REQUEST_TIMEOUT
      });
      if (response.data?.success && response.data.moments) {
        return response.data.moments;
      }
    } catch (error) {
      logger.warn('[AdDecision] Failed to fetch moments:', error);
    }
    return [];
  }

  private async getCrossSellOpportunities(
    userId: string,
    predictions: Record<string, unknown>
  ): Promise<Array<{
    fromCategory: string;
    toCategory: string;
    reason: string;
    confidence: number;
  }>> {
    try {
      const response = await axios.get(`${CROSS_SELL_URL}/api/cross-sell/${userId}`, {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
        timeout: REQUEST_TIMEOUT
      });
      if (response.data?.success && response.data.opportunities) {
        return response.data.opportunities;
      }
    } catch (error) {
      logger.warn('[AdDecision] Failed to fetch cross-sell opportunities:', error);
    }
    return [];
  }

  private createMomentAd(
    moment: { type: string; priority: string; data: Record<string, unknown> },
    predictions: Record<string, unknown>
  ): AdDecision {
    const templates: Record<string, { headline: string; description: string; cta: string }> = {
      coin_expiry: {
        headline: 'Coins Expiring Soon!',
        description: `Use your ${moment.data['expiringCoins'] || 0} expiring coins before they expire!`,
        cta: 'Claim Now',
      },
      streak_risk: {
        headline: "Don't Lose Your Streak!",
        description: `Your ${moment.data['streak'] || 0}-day streak is at risk. Visit now!`,
        cta: 'Keep Streak',
      },
      birthday: {
        headline: 'Happy Birthday! 🎂',
        description: "Claim your special birthday rewards today!",
        cta: 'Claim Birthday Offer',
      },
      churn_risk: {
        headline: 'We Miss You!',
        description: "It's been a while. Here's a special offer to welcome you back!",
        cta: 'Come Back',
      },
    };

    const template = templates[moment.type] || {
      headline: 'Special Offer!',
      description: 'Check out this exclusive deal!',
      cta: 'Learn More',
    };

    return {
      adId: `ad_moment_${moment.type}_${Date.now()}`,
      campaignId: `camp_moment_${moment.type}`,
      merchantId: 'unknown',
      merchantName: 'REZ Partners',
      type: 'retention',
      targetingReason: `Moment trigger: ${moment.type}`,
      bidAmount: this.calculateBid('retention', predictions),
      floorPrice: this.FLOOR_PRICES.retention,
      cashback: 15,
      coins: moment.type === 'coin_expiry' ? (moment.data['expiringCoins'] as number || 0) * 0.5 : 20,
      discount: moment.type === 'birthday' ? 10 : 0,
      content: {
        headline: template.headline,
        description: template.description,
        cta: template.cta,
      },
      momentContext: {
        momentType: moment.type,
        momentData: moment.data,
        urgency: moment.priority as 'low' | 'medium' | 'high' | 'critical',
      },
      priority: this.PRIORITY_WEIGHTS[moment.priority as keyof typeof this.PRIORITY_WEIGHTS] || 25,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  private createCrossSellAd(
    crossSell: { fromCategory: string; toCategory: string; reason: string; confidence: number },
    predictions: Record<string, unknown>
  ): AdDecision {
    const avgBill = (predictions['avgBill'] as number) || 300;

    return {
      adId: `ad_crosssell_${crossSell.toCategory}_${Date.now()}`,
      campaignId: `camp_crosssell_${crossSell.toCategory}`,
      merchantId: `${crossSell.toCategory}_partner`,
      merchantName: `${crossSell.toCategory} Partners`,
      type: 'cross_sell',
      targetingReason: crossSell.reason,
      bidAmount: this.calculateBid('cross_sell', predictions) * crossSell.confidence,
      floorPrice: this.FLOOR_PRICES.cross_sell,
      cashback: Math.round(avgBill * 0.1 * 100) / 100,
      coins: Math.round(avgBill * 0.05),
      discount: crossSell.confidence > 0.8 ? 5 : 0,
      content: {
        headline: `Try ${crossSell.toCategory} Today!`,
        description: crossSell.reason,
        cta: 'Get Offer',
      },
      crossSellContext: {
        fromCategory: crossSell.fromCategory,
        toCategory: crossSell.toCategory,
        reason: crossSell.reason,
        confidence: crossSell.confidence,
      },
      priority: Math.round(crossSell.confidence * 75),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
  }

  private async getContextualAds(
    userId: string,
    context: string,
    predictions: Record<string, unknown>
  ): Promise<AdDecision[]> {
    const ads: AdDecision[] = [];

    switch (context) {
      case 'nearby':
        // Location-based ads
        ads.push({
          adId: `ad_location_${Date.now()}`,
          campaignId: 'camp_location',
          merchantId: 'nearby_partner',
          merchantName: 'Nearby Restaurant',
          type: 'location',
          targetingReason: 'User is nearby',
          bidAmount: this.calculateBid('location', predictions),
          floorPrice: this.FLOOR_PRICES.location,
          cashback: 10,
          coins: 15,
          discount: 0,
          content: {
            headline: '10% Cashback at Nearby Restaurant!',
            description: 'You\'re near this restaurant. Claim your offer!',
            cta: 'Get Offer',
          },
          priority: 30,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });
        break;

      case 'checkout':
        // Upsell ads
        ads.push({
          adId: `ad_upsell_${Date.now()}`,
          campaignId: 'camp_upsell',
          merchantId: 'upsell_partner',
          merchantName: 'Add-on Partners',
          type: 'upsell',
          targetingReason: 'Checkout context - upsell opportunity',
          bidAmount: this.calculateBid('upsell', predictions),
          floorPrice: this.FLOOR_PRICES.upsell,
          cashback: 5,
          coins: 10,
          discount: 10,
          content: {
            headline: 'Add Something Special!',
            description: 'Complete your order with a special add-on.',
            cta: 'Add Now',
          },
          priority: 40,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        });
        break;

      case 'competitor':
        // Competitor conquesting ads
        ads.push({
          adId: `ad_competitor_${Date.now()}`,
          campaignId: 'camp_competitor',
          merchantId: 'competitor_target',
          merchantName: 'Better Option Nearby',
          type: 'competitor',
          targetingReason: 'Competitor location detected',
          bidAmount: this.calculateBid('competitor', predictions),
          floorPrice: this.FLOOR_PRICES.competitor,
          cashback: 15,
          coins: 25,
          discount: 5,
          content: {
            headline: 'Better Deal Nearby!',
            description: 'Switch to our partner and get better rewards!',
            cta: 'Compare',
          },
          priority: 35,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        });
        break;
    }

    return ads;
  }

  private calculateBid(type: string, predictions: Record<string, unknown>): number {
    const baseBid = this.FLOOR_PRICES[type as keyof typeof this.FLOOR_PRICES] || 0.5;

    // Adjust bid based on user value
    const ltv = (predictions['lifetimeValue'] as number) || 0;
    const ltvMultiplier = Math.min(ltv / 10000, 2); // Max 2x for high LTV

    // Adjust bid based on churn risk
    const churnRisk = (predictions['churnRisk'] as number) || 0;
    const churnMultiplier = churnRisk > 0.7 ? 1.5 : churnRisk > 0.4 ? 1.2 : 1;

    return Math.round(baseBid * ltvMultiplier * churnMultiplier * 100) / 100;
  }

  private runAuction(candidates: AdDecision[], slots: number): AdDecision[] {
    // Sort by priority (moment urgency) and bid amount
    const sorted = candidates.sort((a, b) => {
      // First by priority
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // Then by bid amount
      return b.bidAmount - a.bidAmount;
    });

    // Take top slots
    return sorted.slice(0, slots);
  }
}

// ============================================
// API ROUTES
// ============================================

const adEngine = new AdDecisionEngine();

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'REZ-unified-ad-decision',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Main ad decision endpoint
app.post('/api/ads/decide', async (req: Request, res: Response) => {
  try {
    // Validate request body with Zod
    const validatedRequest = validateBody(AdDecisionRequestSchema, req.body, 'POST /api/ads/decide');

    const decision = await adEngine.decide(validatedRequest);

    res.json({
      success: true,
      data: decision,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    logger.error('[AdDecision] POST /api/ads/decide error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// Get ad for specific slot
app.post('/api/ads/slot', async (req: Request, res: Response) => {
  try {
    // Validate request body with Zod
    const validatedRequest = validateBody(SlotRequestSchema, req.body, 'POST /api/ads/slot');

    const decision = await adEngine.decide({
      userId: validatedRequest.userId,
      location: validatedRequest.location,
      context: validatedRequest.slotType,
      slots: 1,
    });

    res.json({
      success: true,
      data: decision.decisions[0] || null,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    logger.error('[AdDecision] POST /api/ads/slot error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// Record ad impression
app.post('/api/ads/impression', async (req: Request, res: Response) => {
  try {
    // Validate request body with Zod
    const { adId, campaignId, userId, location } = validateBody(
      AdImpressionRequestSchema,
      req.body,
      'POST /api/ads/impression'
    );

    // In production, record to analytics
    logger.info('[AdDecision] Ad impression:', { adId, campaignId, userId, location });

    res.json({
      success: true,
      data: { recorded: true, timestamp: new Date() },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    logger.error('[AdDecision] POST /api/ads/impression error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// Record ad click
app.post('/api/ads/click', async (req: Request, res: Response) => {
  try {
    // Validate request body with Zod
    const { adId, campaignId, userId } = validateBody(
      AdClickRequestSchema,
      req.body,
      'POST /api/ads/click'
    );

    // In production, record to analytics and trigger attribution
    logger.info('[AdDecision] Ad click:', { adId, campaignId, userId });

    res.json({
      success: true,
      data: { recorded: true, timestamp: new Date() },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    logger.error('[AdDecision] POST /api/ads/click error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// Record ad conversion
app.post('/api/ads/conversion', async (req: Request, res: Response) => {
  try {
    // Validate request body with Zod
    const { adId, campaignId, userId, orderId, revenue } = validateBody(
      AdConversionRequestSchema,
      req.body,
      'POST /api/ads/conversion'
    );

    // In production:
    // 1. Record conversion to analytics
    // 2. Update campaign metrics
    // 3. Trigger attribution
    // 4. Update user predictions

    logger.info('[AdDecision] Ad conversion:', { adId, campaignId, userId, orderId, revenue });

    res.json({
      success: true,
      data: {
        recorded: true,
        attribution: {
          channel: 'ad',
          campaignId,
          attributedRevenue: revenue * 0.1, // Assume 10% attribution
        },
        timestamp: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    logger.error('[AdDecision] POST /api/ads/conversion error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// ============================================
// START
// ============================================

app.listen(PORT, () => {
  logger.info(`
╔═══════════════════════════════════════════════════════════╗
║         REZ UNIFIED AD DECISION SERVICE                    ║
╠═══════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                              ║
║                                                           ║
║  Endpoints:                                              ║
║  POST /api/ads/decide - Main ad decision endpoint         ║
║  POST /api/ads/slot     - Get ad for specific slot       ║
║  POST /api/ads/impression - Record impression             ║
║  POST /api/ads/click     - Record click                  ║
║  POST /api/ads/conversion - Record conversion              ║
║                                                           ║
║  Ad Types:                                                ║
║  - cross_sell     - Cross-merchant recommendations        ║
║  - retention      - User retention moments                 ║
║  - churn_prevention - At-risk users                      ║
║  - lifecycle     - Birthday, anniversary                   ║
║  - location      - Nearby merchants                       ║
║  - personalized - User preferences                      ║
║  - competitor    - Conquesting ads                        ║
║  - upsell       - Checkout upsells                      ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
