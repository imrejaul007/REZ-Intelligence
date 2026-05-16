import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  mlModels,
  userToFeatures,
  scoreToRiskLevel,
  ltvToTier,
  UserFeatures
} from '../services/mlModels';
import { UserProfile } from '../models/userProfile';
import { NotFoundError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router = Router();

// Validation schemas
const userIdSchema = z.string().min(1, 'User ID is required');
const actionSchema = z.enum(['reorder', 'upsell', 'referral', 'subscription']);

// Batch request schemas
const batchChurnSchema = z.object({
  userIds: z.array(z.string()).min(1).max(1000)
});

const batchLTVSchema = z.object({
  userIds: z.array(z.string()).min(1).max(1000)
});

const batchPropensitySchema = z.object({
  userIds: z.array(z.string()).min(1).max(1000),
  actions: z.array(actionSchema).min(1)
});

const segmentSchema = z.enum(['at-risk', 'champion', 'loyal', 'new', 'standard']);

// Helper function to convert user profile to features
function convertToFeatures(user: any): UserFeatures {
  return {
    daysSinceOrder: user.lastOrderDate
      ? Math.floor((Date.now() - new Date(user.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24))
      : user.accountAge || 999,
    orderFrequency: user.totalOrders,
    avgOrderValue: user.avgOrderValue,
    totalSpend: user.totalSpend,
    engagementScore: user.engagementScore,
    loginFrequency: user.loginFrequency,
    emailOpenRate: user.emailOpenRate,
    cartAbandonmentRate: user.cartAbandonmentRate,
    tenureDays: user.accountAge,
    isEmailVerified: user.isEmailVerified,
    isPhoneVerified: user.isPhoneVerified,
    preferredCategories: user.preferredCategories || [],
    loyaltyScore: user.loyaltyPoints ? Math.min(100, user.loyaltyPoints / 100) : 50,
    competitorRisk: 30,
    signals: user.signals
  };
}

/**
 * GET /ml/:userId/churn
 * ML-based churn prediction for a single user
 */
router.get('/:userId/churn', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = userIdSchema.parse(req.params.userId);

    logger.info('ML churn prediction requested', { userId });

    const user = await UserProfile.findOne({ userId });
    if (!user) {
      throw new NotFoundError('User');
    }

    const features = convertToFeatures(user);
    const churnScore = mlModels.churn.predict(features);
    const riskLevel = scoreToRiskLevel(churnScore);

    res.json({
      success: true,
      data: {
        userId,
        model: mlModels.churn.name,
        score: Math.round(churnScore),
        risk: riskLevel,
        confidence: 0.82,
        factors: [
          { name: 'Days Since Order', impact: 0.3, value: `${features.daysSinceOrder} days` },
          { name: 'Order Frequency', impact: 0.25, value: `${features.orderFrequency} orders` },
          { name: 'Engagement', impact: 0.2, value: `${features.engagementScore}/100` }
        ],
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /ml/:userId/ltv
 * ML-based LTV prediction for a single user
 */
router.get('/:userId/ltv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = userIdSchema.parse(req.params.userId);

    logger.info('ML LTV prediction requested', { userId });

    const user = await UserProfile.findOne({ userId });
    if (!user) {
      throw new NotFoundError('User');
    }

    const features = convertToFeatures(user);
    const ltvPrediction = mlModels.ltv.predict(features);
    const tier = ltvToTier(ltvPrediction.ltv365);

    res.json({
      success: true,
      data: {
        userId,
        model: mlModels.ltv.name,
        ltv: ltvPrediction,
        tier,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /ml/:userId/next-purchase
 * ML-based next purchase prediction
 */
router.get('/:userId/next-purchase', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = userIdSchema.parse(req.params.userId);

    logger.info('ML next purchase prediction requested', { userId });

    const user = await UserProfile.findOne({ userId });
    if (!user) {
      throw new NotFoundError('User');
    }

    const features = convertToFeatures(user);
    const prediction = mlModels.nextPurchase.predict(features);

    res.json({
      success: true,
      data: {
        userId,
        model: mlModels.nextPurchase.name,
        prediction,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /ml/:userId/propensity/:action
 * ML-based propensity prediction for specific action
 */
router.get('/:userId/propensity/:action', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = userIdSchema.parse(req.params.userId);
    const action = actionSchema.parse(req.params.action);

    logger.info('ML propensity prediction requested', { userId, action });

    const user = await UserProfile.findOne({ userId });
    if (!user) {
      throw new NotFoundError('User');
    }

    const features = convertToFeatures(user);
    const propensity = mlModels.propensity.predict(features, action);

    res.json({
      success: true,
      data: {
        userId,
        model: mlModels.propensity.name,
        propensity,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /ml/:userId/propensity
 * Get all propensity scores for a user
 */
router.get('/:userId/propensity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = userIdSchema.parse(req.params.userId);

    logger.info('ML all propensities requested', { userId });

    const user = await UserProfile.findOne({ userId });
    if (!user) {
      throw new NotFoundError('User');
    }

    const features = convertToFeatures(user);
    const allPropensities = mlModels.propensity.predictAll(features);

    res.json({
      success: true,
      data: {
        userId,
        model: mlModels.propensity.name,
        propensities: allPropensities,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /ml/:userId/segment
 * Get segment and tier classification
 */
router.get('/:userId/segment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = userIdSchema.parse(req.params.userId);

    logger.info('ML segment prediction requested', { userId });

    const user = await UserProfile.findOne({ userId });
    if (!user) {
      throw new NotFoundError('User');
    }

    const features = convertToFeatures(user);
    const { segment, tier } = mlModels.segment.predict(features);

    res.json({
      success: true,
      data: {
        userId,
        model: mlModels.segment.name,
        segment,
        tier,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /ml/batch/churn
 * Batch churn predictions for multiple users
 */
router.post('/batch/churn', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userIds } = batchChurnSchema.parse(req.body);

    logger.info('ML batch churn prediction requested', { userCount: userIds.length });

    const jobId = uuidv4();
    const results: Array<{ userId: string; score: number; risk: string; error?: string }> = [];

    for (const userId of userIds) {
      try {
        const user = await UserProfile.findOne({ userId });
        if (!user) {
          results.push({ userId, score: 50, risk: 'MEDIUM', error: 'User not found' });
          continue;
        }

        const features = convertToFeatures(user);
        const score = mlModels.churn.predict(features);
        const risk = scoreToRiskLevel(score);
        results.push({ userId, score: Math.round(score), risk });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.push({ userId, score: 50, risk: 'MEDIUM', error: errorMsg });
      }
    }

    res.json({
      success: true,
      data: {
        jobId,
        model: mlModels.churn.name,
        total: userIds.length,
        completed: results.filter(r => !r.error).length,
        failed: results.filter(r => r.error).length,
        results,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /ml/batch/ltv
 * Batch LTV predictions for multiple users
 */
router.post('/batch/ltv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userIds } = batchLTVSchema.parse(req.body);

    logger.info('ML batch LTV prediction requested', { userCount: userIds.length });

    const jobId = uuidv4();
    const results: Array<{ userId: string; ltv365: number; tier: string; error?: string }> = [];

    for (const userId of userIds) {
      try {
        const user = await UserProfile.findOne({ userId });
        if (!user) {
          results.push({ userId, ltv365: 0, tier: 'BRONZE', error: 'User not found' });
          continue;
        }

        const features = convertToFeatures(user);
        const prediction = mlModels.ltv.predict(features);
        const tier = ltvToTier(prediction.ltv365);
        results.push({ userId, ltv365: Math.round(prediction.ltv365), tier });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.push({ userId, ltv365: 0, tier: 'BRONZE', error: errorMsg });
      }
    }

    res.json({
      success: true,
      data: {
        jobId,
        model: mlModels.ltv.name,
        total: userIds.length,
        completed: results.filter(r => !r.error).length,
        failed: results.filter(r => r.error).length,
        results,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /ml/batch/propensity
 * Batch propensity predictions for multiple users
 */
router.post('/batch/propensity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userIds, actions } = batchPropensitySchema.parse(req.body);

    logger.info('ML batch propensity prediction requested', {
      userCount: userIds.length,
      actions
    });

    const jobId = uuidv4();
    const results: Array<{
      userId: string;
      propensities: Record<string, number>;
      error?: string;
    }> = [];

    for (const userId of userIds) {
      try {
        const user = await UserProfile.findOne({ userId });
        if (!user) {
          results.push({
            userId,
            propensities: {},
            error: 'User not found'
          });
          continue;
        }

        const features = convertToFeatures(user);
        const allPropensities = mlModels.propensity.predictAll(features);
        const requestedPropensities: Record<string, number> = {};
        for (const action of actions) {
          requestedPropensities[action] = allPropensities[action];
        }
        results.push({ userId, propensities: requestedPropensities });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.push({ userId, propensities: {}, error: errorMsg });
      }
    }

    res.json({
      success: true,
      data: {
        jobId,
        model: mlModels.propensity.name,
        actions,
        total: userIds.length,
        completed: results.filter(r => !r.error).length,
        failed: results.filter(r => r.error).length,
        results,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /ml/segments/:segment
 * Get users by segment classification
 */
router.get('/segments/:segment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const segment = segmentSchema.parse(req.params.segment);
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);

    logger.info('ML segment query requested', { segment, limit });

    // Get users and classify them
    const users = await UserProfile.find().limit(limit * 3).lean();

    const classifiedUsers: Array<{
      userId: string;
      segment: string;
      tier: string;
    }> = [];

    for (const user of users) {
      const features = convertToFeatures(user);
      const { segment: userSegment, tier } = mlModels.segment.predict(features);

      if (userSegment === segment) {
        classifiedUsers.push({
          userId: user.userId,
          segment: userSegment,
          tier
        });
      }

      if (classifiedUsers.length >= limit) break;
    }

    res.json({
      success: true,
      data: {
        segment,
        count: classifiedUsers.length,
        users: classifiedUsers,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /ml/models
 * Get available ML models and their capabilities
 */
router.get('/models', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      models: [
        {
          name: mlModels.churn.name,
          type: 'churn',
          description: 'Predicts customer churn probability using gradient boosting',
          input: ['daysSinceOrder', 'orderFrequency', 'avgOrderValue', 'engagementScore', 'competitorRisk'],
          output: { score: '0-100', risk: 'LOW|MEDIUM|HIGH|CRITICAL' }
        },
        {
          name: mlModels.ltv.name,
          type: 'ltv',
          description: 'Predicts customer lifetime value using time-series forecasting',
          input: ['avgOrderValue', 'orderFrequency', 'engagementScore', 'tenureDays'],
          output: { ltv30: 'INR', ltv90: 'INR', ltv365: 'INR', confidence: '0-1' }
        },
        {
          name: mlModels.nextPurchase.name,
          type: 'nextPurchase',
          description: 'Predicts next purchase timing and categories',
          input: ['daysSinceOrder', 'orderFrequency', 'preferredCategories', 'engagementScore'],
          output: {
            daysUntilNextPurchase: 'number',
            predictedCategories: 'string[]',
            estimatedOrderValue: 'INR',
            optimalChannel: 'push|email|whatsapp|social'
          }
        },
        {
          name: mlModels.propensity.name,
          type: 'propensity',
          description: 'Predicts propensity for reorder, upsell, referral, subscription',
          actions: ['reorder', 'upsell', 'referral', 'subscription'],
          output: { score: '0-100', factors: 'Factor[]', recommendations: 'string[]' }
        },
        {
          name: mlModels.segment.name,
          type: 'segment',
          description: 'Classifies customers into segments and tiers',
          segments: ['at-risk', 'champion', 'loyal', 'new', 'standard'],
          tiers: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']
        }
      ],
      timestamp: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  });
});

export default router;
