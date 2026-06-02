/**
 * REZ Mind Integration Routes
 *
 * Endpoints for AI-powered insights
 */

import { Router, Request, Response } from 'express';
import { RezMindIntegration } from '../services/rezMindIntegration';

const router = Router();
const mindIntegration = new RezMindIntegration();

// ============================================================================
// USER ANALYTICS
// ============================================================================

/**
 * GET /api/v1/mind/user/:userId
 * Get enhanced user analytics from REZ Mind
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const analytics = await mindIntegration.getUserAnalytics(userId);

    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'No analytics found for user',
      });
    }

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Error getting user analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user analytics',
    });
  }
});

/**
 * GET /api/v1/mind/user/:userId/satisfaction
 * Get satisfaction prediction
 */
router.get('/user/:userId/satisfaction', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const prediction = await mindIntegration.getSatisfactionPrediction(userId);

    res.json({
      success: true,
      data: prediction || { score: 50, atRisk: false },
    });
  } catch (error) {
    console.error('Error getting satisfaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get satisfaction prediction',
    });
  }
});

/**
 * GET /api/v1/mind/user/:userId/churn
 * Get churn intervention strategy
 */
router.get('/user/:userId/churn', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const intervention = await mindIntegration.getChurnIntervention(userId);

    if (!intervention) {
      return res.status(404).json({
        success: false,
        error: 'No intervention available',
      });
    }

    res.json({
      success: true,
      data: intervention,
    });
  } catch (error) {
    console.error('Error getting churn intervention:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get churn intervention',
    });
  }
});

/**
 * GET /api/v1/mind/user/:userId/offers
 * Get personalized offers based on REZ Mind insights
 */
router.get('/user/:userId/offers', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const offers = await mindIntegration.getPersonalizedOffers(userId);

    res.json({
      success: true,
      data: offers,
    });
  } catch (error) {
    console.error('Error getting offers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get offers',
    });
  }
});

// ============================================================================
// SIGNAL PUBLISHING
// ============================================================================

/**
 * POST /api/v1/mind/signal
 * Publish a loyalty signal to REZ Mind
 */
router.post('/signal', async (req: Request, res: Response) => {
  try {
    const { userId, type, action, data } = req.body;

    if (!userId || !type || !action) {
      return res.status(400).json({
        success: false,
        error: 'userId, type, and action are required',
      });
    }

    const published = await mindIntegration.publishLoyaltySignal({
      userId,
      type,
      action,
      data: data || {},
    });

    res.json({
      success: published,
      message: published ? 'Signal published' : 'Failed to publish signal',
    });
  } catch (error) {
    console.error('Error publishing signal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to publish signal',
    });
  }
});

// ============================================================================
// ENHANCED PROFILE
// ============================================================================

/**
 * GET /api/v1/mind/profile/:userId
 * Get unified profile enriched with REZ Mind data
 */
router.get('/profile/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Get base profile from Profile Aggregator
    const { ProfileAggregator } = await import('../services/ProfileAggregator');
    const aggregator = new ProfileAggregator();
    const profile = await aggregator.getProfile(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found',
      });
    }

    // Get REZ Mind analytics
    const analytics = await mindIntegration.getUserAnalytics(userId);

    // Combine into enhanced profile
    const enhancedProfile = {
      // From Profile Aggregator
      userId: profile.userId,
      wallet: profile.wallet,
      loyalty: profile.loyalty,
      karma: profile.karma,
      gamification: profile.gamification,
      reZScore: profile.reZScore,
      behavior: profile.behavior,
      activity: profile.activity,

      // From REZ Mind (AI layer)
      aiInsights: {
        preferences: analytics?.preferences || null,
        intelligence: analytics?.intelligence || null,
        risk: analytics?.risk || null,
      },

      // Calculated fields
      customerHealth: calculateCustomerHealth(profile, analytics),
      recommendedActions: getRecommendedActions(profile, analytics),
    };

    res.json({
      success: true,
      data: enhancedProfile,
    });
  } catch (error) {
    console.error('Error getting enhanced profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get enhanced profile',
    });
  }
});

// Helper functions
function calculateCustomerHealth(profile: any, analytics: any): {
  score: number;
  level: 'critical' | 'at_risk' | 'stable' | 'healthy' | 'champion';
  factors: string[];
} {
  let score = 50;

  // ReZ Score contribution
  score += (profile.reZScore?.composite || 0) / 20; // Up to +50

  // Streak contribution
  if (profile.loyalty?.streak?.current > 0) {
    score += Math.min(profile.loyalty.streak.current, 10); // Up to +10
  }

  // AI satisfaction
  if (analytics?.intelligence?.satisfactionScore) {
    score += analytics.intelligence.satisfactionScore / 2; // Up to +50
  }

  // Risk penalty
  if (analytics?.risk?.atRisk) {
    score -= 30;
  }

  score = Math.max(0, Math.min(100, score));

  let level: 'critical' | 'at_risk' | 'stable' | 'healthy' | 'champion';
  if (score < 20) level = 'critical';
  else if (score < 40) level = 'at_risk';
  else if (score < 60) level = 'stable';
  else if (score < 80) level = 'healthy';
  else level = 'champion';

  const factors: string[] = [];
  if (profile.loyalty?.streak?.current > 30) factors.push('Long streak');
  if (profile.reZScore?.tier === 'platinum' || profile.reZScore?.tier === 'diamond') factors.push('High tier');
  if (analytics?.risk?.atRisk) factors.push('At risk');
  if (analytics?.intelligence?.satisfactionScore > 80) factors.push('High satisfaction');

  return { score, level, factors };
}

function getRecommendedActions(profile: any, analytics: any): string[] {
  const actions: string[] = [];

  // Streak recovery
  if (profile.loyalty?.streak?.current === 0) {
    actions.push('Send streak recovery offer');
  }

  // Tier upgrade opportunity
  if (profile.reZScore?.composite > 50 && profile.reZScore?.composite < 80) {
    actions.push('Offer bonus points for tier upgrade');
  }

  // At-risk intervention
  if (analytics?.risk?.atRisk) {
    actions.push('Send retention campaign');
    actions.push('Offer personalized discount');
  }

  // High-value retention
  if (analytics?.intelligence?.satisfactionScore > 90) {
    actions.push('Offer VIP experience');
    actions.push('Invite to exclusive event');
  }

  return actions;
}

export { router as mindRoutes };
