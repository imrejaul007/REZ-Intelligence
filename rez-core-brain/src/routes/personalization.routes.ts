import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { personalizationService } from '../services/personalizationService';
import { contextService } from '../services/contextService';
import intelligenceService from '../services/intelligenceService';
import { authenticate, requestId } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Extend Request type to include custom properties
interface AuthenticatedRequest extends Request {
  userId?: string;
  requestId?: string;
}

// Validation schemas
const updatePreferencesSchema = z.object({
  tone: z.enum(['formal', 'casual', 'friendly', 'professional']).optional(),
  language: z.string().min(2).max(10).optional(),
  timezone: z.string().optional(),
  notificationPreferences: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    sms: z.boolean().optional(),
  }).optional(),
  privacyLevel: z.enum(['strict', 'balanced', 'open']).optional(),
  accessibilityNeeds: z.array(z.string()).optional(),
  preferredContentTypes: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateLoyaltySchema = z.object({
  points: z.number().min(0).optional(),
  addPoints: z.number().positive().optional(),
  deductPoints: z.number().positive().optional(),
  preferences: z.object({
    favoriteCategories: z.array(z.string()).optional(),
    preferredBrands: z.array(z.string()).optional(),
    communicationStyle: z.string().optional(),
  }).optional(),
  history: z.object({
    totalPurchases: z.number().min(0).optional(),
    totalSpent: z.number().min(0).optional(),
    lastPurchaseDate: z.string().datetime().optional(),
    favoriteStore: z.string().optional(),
  }).optional(),
});

const recordPurchaseSchema = z.object({
  amount: z.number().positive(),
  categories: z.array(z.string()).optional(),
});

// ==================== PREFERENCES ====================

/**
 * GET /api/personalization/preferences
 * Get user preferences
 */
router.get('/preferences', requestId, authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const preferences = await personalizationService.getOrCreatePreferences(userId);

    res.json({
      success: true,
      data: preferences,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to get preferences', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get preferences',
      },
    });
  }
});

/**
 * PATCH /api/personalization/preferences
 * Update user preferences
 */
router.patch('/preferences', requestId, authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const validation = updatePreferencesSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: validation.error.flatten(),
        },
      });
      return;
    }

    const preferences = await personalizationService.updatePreferences(userId, validation.data);

    res.json({
      success: true,
      data: preferences,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to update preferences', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update preferences',
      },
    });
  }
});

/**
 * POST /api/personalization/preferences/reset
 * Reset preferences to defaults
 */
router.post('/preferences/reset', requestId, authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const preferences = await personalizationService.resetPreferences(userId);

    if (!preferences) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Preferences not found',
        },
      });
      return;
    }

    logger.info(`Reset preferences for user: ${userId}`);

    res.json({
      success: true,
      data: preferences,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to reset preferences', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to reset preferences',
      },
    });
  }
});

// ==================== LOYALTY ====================

/**
 * GET /api/personalization/loyalty
 * Get loyalty profile
 */
router.get('/loyalty', requestId, authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const profile = await personalizationService.getOrCreateLoyaltyProfile(userId);

    res.json({
      success: true,
      data: profile,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to get loyalty profile', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get loyalty profile',
      },
    });
  }
});

/**
 * PATCH /api/personalization/loyalty
 * Update loyalty profile
 */
router.patch('/loyalty', requestId, authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const validation = updateLoyaltySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: validation.error.flatten(),
        },
      });
      return;
    }

    const profile = await personalizationService.updateLoyaltyProfile(userId, validation.data);

    res.json({
      success: true,
      data: profile,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Insufficient points') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_POINTS',
          message: 'Not enough points to redeem',
        },
      });
      return;
    }

    logger.error('Failed to update loyalty profile', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update loyalty profile',
      },
    });
  }
});

/**
 * GET /api/personalization/loyalty/benefits
 * Get tier benefits
 */
router.get('/loyalty/benefits', requestId, authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const benefits = await personalizationService.getTierBenefits(userId);

    if (!benefits) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Loyalty profile not found',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: benefits,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to get tier benefits', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get tier benefits',
      },
    });
  }
});

/**
 * POST /api/personalization/loyalty/purchase
 * Record a purchase and update loyalty
 */
router.post('/loyalty/purchase', requestId, authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const validation = recordPurchaseSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: validation.error.flatten(),
        },
      });
      return;
    }

    const profile = await personalizationService.recordPurchase(
      userId,
      validation.data.amount,
      validation.data.categories
    );

    logger.info(`Recorded purchase of ${validation.data.amount} for user: ${userId}`);

    res.json({
      success: true,
      data: profile,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to record purchase', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to record purchase',
      },
    });
  }
});

// ==================== CONTEXT ====================

/**
 * GET /api/personalization/context
 * Get contextual data
 */
router.get('/context', requestId, authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const context = await contextService.getOrCreateContextualData(userId);

    res.json({
      success: true,
      data: context,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to get context', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get context',
      },
    });
  }
});

/**
 * PATCH /api/personalization/context
 * Update contextual data
 */
router.patch('/context', requestId, authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const schema = z.object({
      location: z.string().optional(),
      device: z.string().optional(),
      browser: z.string().optional(),
      os: z.string().optional(),
      appVersion: z.string().optional(),
      sessionId: z.string().optional(),
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: validation.error.flatten(),
        },
      });
      return;
    }

    const context = await contextService.updateContextualData(userId, validation.data);

    res.json({
      success: true,
      data: context,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to update context', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update context',
      },
    });
  }
});

/**
 * POST /api/personalization/context/activity
 * Update recent activity
 */
router.post('/context/activity', requestId, authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const schema = z.object({
      action: z.string().min(1),
      agent: z.string().optional(),
      topic: z.string().optional(),
      search: z.string().optional(),
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: validation.error.flatten(),
        },
      });
      return;
    }

    await contextService.updateRecentActivity(
      userId,
      validation.data.action,
      validation.data.agent,
      validation.data.topic,
      validation.data.search
    );

    // Also update intelligence
    await intelligenceService.updateUserIntent(userId, validation.data.action);

    res.json({
      success: true,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to update activity', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update activity',
      },
    });
  }
});

// ==================== INTELLIGENCE ====================

/**
 * GET /api/personalization/intelligence
 * Get comprehensive intelligence data
 */
router.get('/intelligence', requestId, authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const schema = z.object({
      includeMetrics: z.coerce.boolean().optional().default(true),
      includeContext: z.coerce.boolean().optional().default(true),
      includePreferences: z.coerce.boolean().optional().default(false),
      includeRecentMemories: z.coerce.boolean().optional().default(false),
      includeSessionContext: z.coerce.boolean().optional().default(false),
    });

    const validation = schema.safeParse(req.query);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: validation.error.flatten(),
        },
      });
      return;
    }

    const data = await intelligenceService.getIntelligenceData({
      userId,
      ...validation.data,
    });

    res.json({
      success: true,
      data,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to get intelligence data', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get intelligence data',
      },
    });
  }
});

/**
 * POST /api/personalization/recommendations
 * Generate personalized recommendations
 */
router.post('/recommendations', requestId, authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const schema = z.object({
      context: z.string().optional(),
      excludedItems: z.array(z.string()).optional(),
      limit: z.number().min(1).max(20).optional().default(5),
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: validation.error.flatten(),
        },
      });
      return;
    }

    const recommendations = await intelligenceService.generateRecommendations({
      userId,
      context: validation.data.context,
      excludedItems: validation.data.excludedItems,
      limit: validation.data.limit,
    });

    res.json({
      success: true,
      data: recommendations,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to generate recommendations', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate recommendations',
      },
    });
  }
});

/**
 * GET /api/personalization/engagement
 * Get engagement score
 */
router.get('/engagement', requestId, authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const score = await intelligenceService.getEngagementScore(userId);

    res.json({
      success: true,
      data: score,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to get engagement score', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get engagement score',
      },
    });
  }
});

/**
 * GET /api/personalization/behavior
 * Analyze behavior patterns
 */
router.get('/behavior', requestId, authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const analysis = await intelligenceService.analyzeBehaviorPatterns(userId);

    res.json({
      success: true,
      data: analysis,
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to analyze behavior', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to analyze behavior',
      },
    });
  }
});

/**
 * POST /api/personalization/greeting
 * Get personalized greeting
 */
router.post('/greeting', requestId, authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const schema = z.object({
      defaultGreeting: z.string().optional(),
    });

    const validation = schema.safeParse(req.body);
    const greeting = await personalizationService.getPersonalizedGreeting(
      userId,
      validation.data?.defaultGreeting
    );

    res.json({
      success: true,
      data: { greeting },
      meta: {
        timestamp: new Date(),
        requestId: req.requestId,
      },
    });
  } catch (error) {
    logger.error('Failed to get greeting', { error, userId: req.userId });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get greeting',
      },
    });
  }
});

export default router;
