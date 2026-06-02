/**
 * Merchant Intelligence Routes
 *
 * Dashboard endpoints for merchants to view customer insights
 */

import { Router, Request, Response } from 'express';
import { RezMindIntegration } from '../services/rezMindIntegration';
import { UnifiedProfile } from '../models/UnifiedProfile';

const router = Router();
const mindIntegration = new RezMindIntegration();

// ============================================================================
// MERCHANT DASHBOARD
// ============================================================================

/**
 * GET /api/v1/merchant/:merchantId/dashboard
 * Get complete merchant dashboard data
 */
router.get('/:merchantId/dashboard', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;

    // Get merchant intelligence from REZ Mind
    const merchantIntel = await mindIntegration.getMerchantIntelligence(merchantId);

    // Get aggregate stats from profiles (mock data for now)
    const stats = await getMerchantStats(merchantId);

    res.json({
      success: true,
      data: {
        overview: {
          totalCustomers: merchantIntel?.totalCustomers || 0,
          activeCustomers: stats.activeCustomers,
          atRiskCustomers: merchantIntel?.atRiskCustomers || 0,
          highValueCustomers: merchantIntel?.highValueCustomers || 0,
        },
        health: {
          avgSatisfaction: merchantIntel?.avgSatisfaction || 75,
          avgReZScore: stats.avgReZScore,
          avgStreak: stats.avgStreak,
          avgLoyaltyPoints: stats.avgLoyaltyPoints,
        },
        recommendations: merchantIntel?.recommendedActions || getDefaultRecommendations(),
      },
    });
  } catch (error) {
    console.error('Error getting merchant dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard',
    });
  }
});

/**
 * GET /api/v1/merchant/:merchantId/customers
 * Get customer list with intelligence
 */
router.get('/:merchantId/customers', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const { status, sort, limit = '50' } = req.query;

    // In production, this would query by merchantId
    // For now, return mock data structure
    const customers = await getMerchantCustomers(merchantId, {
      status: status as string,
      sort: sort as string,
      limit: parseInt(limit as string),
    });

    res.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    console.error('Error getting customers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get customers',
    });
  }
});

/**
 * GET /api/v1/merchant/:merchantId/customers/:customerId
 * Get detailed customer intelligence
 */
router.get('/:merchantId/customers/:customerId', async (req: Request, res: Response) => {
  try {
    const { merchantId, customerId } = req.params;

    // Get unified profile
    const profile = await UnifiedProfile.findOne({ userId: customerId });

    // Get REZ Mind analytics
    const analytics = await mindIntegration.getUserAnalytics(customerId);

    // Get satisfaction prediction
    const satisfaction = await mindIntegration.getSatisfactionPrediction(customerId);

    // Build customer profile
    const customerProfile = {
      userId: customerId,
      loyalty: profile?.loyalty || null,
      reZScore: profile?.reZScore || null,
      karma: profile?.karma || null,
      aiInsights: {
        preferences: analytics?.preferences || null,
        intelligence: analytics?.intelligence || null,
        risk: analytics?.risk || null,
      },
      satisfaction,
      customerHealth: calculateHealth(profile, analytics),
      engagementScore: analytics?.intelligence?.engagementScore || 50,
      lifetimeValue: calculateLTV(profile, analytics),
      churnRisk: analytics?.risk?.churnRisk || 0,
      bestContactTime: analytics?.risk?.riskFactors?.includes('timing') ? 'Evenings' : 'Anytime',
      preferredChannel: profile?.behavior?.preferredChannel || 'push',
    };

    res.json({
      success: true,
      data: customerProfile,
    });
  } catch (error) {
    console.error('Error getting customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get customer',
    });
  }
});

/**
 * GET /api/v1/merchant/:merchantId/at-risk
 * Get at-risk customers needing attention
 */
router.get('/:merchantId/at-risk', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;

    // In production, query customers with high churn risk
    const atRiskCustomers = await getAtRiskCustomers(merchantId);

    res.json({
      success: true,
      data: atRiskCustomers,
    });
  } catch (error) {
    console.error('Error getting at-risk customers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get at-risk customers',
    });
  }
});

/**
 * GET /api/v1/merchant/:merchantId/vip
 * Get VIP/high-value customers
 */
router.get('/:merchantId/vip', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;

    const vipCustomers = await getVIPCustomers(merchantId);

    res.json({
      success: true,
      data: vipCustomers,
    });
  } catch (error) {
    console.error('Error getting VIP customers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get VIP customers',
    });
  }
});

/**
 * GET /api/v1/merchant/:merchantId/actions
 * Get recommended actions for merchant
 */
router.get('/:merchantId/actions', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;

    const actions = await getRecommendedActions(merchantId);

    res.json({
      success: true,
      data: actions,
    });
  } catch (error) {
    console.error('Error getting actions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get actions',
    });
  }
});

// ============================================================================
// CAMPAIGN MANAGEMENT
// ============================================================================

/**
 * POST /api/v1/merchant/:merchantId/campaign
 * Create retention campaign
 */
router.post('/:merchantId/campaign', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const { targetType, targetIds, campaignType, message, offer } = req.body;

    if (!campaignType || !message) {
      return res.status(400).json({
        success: false,
        error: 'campaignType and message are required',
      });
    }

    // In production, this would create a campaign in the notification service
    const campaign = {
      id: `campaign_${Date.now()}`,
      merchantId,
      targetType: targetType || 'all',
      targetCount: targetIds?.length || 0,
      campaignType,
      message,
      offer: offer || null,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create campaign',
    });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getMerchantStats(merchantId: string) {
  // In production, aggregate from MongoDB
  return {
    activeCustomers: 150,
    avgReZScore: 450,
    avgStreak: 12,
    avgLoyaltyPoints: 2500,
  };
}

async function getMerchantCustomers(merchantId: string, options: { status?: string; sort?: string; limit: number }) {
  // In production, query by merchantId
  return {
    customers: [],
    total: 0,
    hasMore: false,
  };
}

async function getAtRiskCustomers(merchantId: string) {
  // In production, query customers with churnRisk > 60
  return [
    {
      userId: 'at_risk_001',
      name: 'At Risk Customer 1',
      churnRisk: 85,
      lastVisit: '2026-05-01',
      reason: 'No visit in 30 days',
      recommendedAction: 'Send recovery offer',
      offerType: '20% discount',
    },
    {
      userId: 'at_risk_002',
      name: 'At Risk Customer 2',
      churnRisk: 72,
      lastVisit: '2026-05-03',
      reason: 'Declining engagement',
      recommendedAction: 'Personal check-in',
      offerType: 'Free service',
    },
  ];
}

async function getVIPCustomers(merchantId: string) {
  return [
    {
      userId: 'vip_001',
      name: 'VIP Customer 1',
      reZScore: 920,
      tier: 'ReZ Elite',
      lifetimeValue: 150000,
      visitFrequency: 'Weekly',
      satisfaction: 95,
      engagement: 98,
    },
    {
      userId: 'vip_002',
      name: 'VIP Customer 2',
      reZScore: 850,
      tier: 'Diamond',
      lifetimeValue: 120000,
      visitFrequency: 'Bi-weekly',
      satisfaction: 90,
      engagement: 92,
    },
  ];
}

async function getRecommendedActions(merchantId: string) {
  return [
    {
      priority: 'high',
      type: 'retention',
      title: '3 At-Risk Customers Need Attention',
      description: 'Send personalized recovery offers to prevent churn',
      action: 'View At-Risk',
      potentialImpact: 'Save 3 customers',
    },
    {
      priority: 'medium',
      type: 'engagement',
      title: '2 VIP Customers Due for Visit',
      description: 'Send exclusive offers to drive repeat visits',
      action: 'View VIPs',
      potentialImpact: 'Increase VIP engagement by 20%',
    },
    {
      priority: 'low',
      type: 'acquisition',
      title: 'Cross-Merchant Opportunity',
      description: '3 customers visited similar categories this month',
      action: 'Create Bundle',
      potentialImpact: 'Increase AOV by 15%',
    },
  ];
}

function calculateHealth(profile: any, analytics: any): {
  score: number;
  level: string;
  status: string;
} {
  let score = 75;

  if (profile?.reZScore?.composite) {
    score = Math.min(100, profile.reZScore.composite / 10);
  }

  if (analytics?.risk?.atRisk) {
    score -= 30;
  }

  let level: string;
  let status: string;

  if (score >= 80) {
    level = 'champion';
    status = 'Excellent customer health';
  } else if (score >= 60) {
    level = 'healthy';
    status = 'Good customer health';
  } else if (score >= 40) {
    level = 'stable';
    status = 'Needs attention';
  } else {
    level = 'at_risk';
    status = 'Critical - needs intervention';
  }

  return { score: Math.round(score), level, status };
}

function calculateLTV(profile: any, analytics: any): {
  estimated: number;
  confidence: string;
  trend: 'up' | 'stable' | 'down';
} {
  const base = profile?.loyalty?.lifetimeSpend || 0;
  const frequency = analytics?.behavior?.stayFrequency || 1;
  const satisfaction = analytics?.intelligence?.satisfactionScore || 50;

  // Simple LTV estimation
  const estimated = base * (1 + frequency / 10) * (satisfaction / 50);

  let confidence: string;
  if (satisfaction > 80 && frequency > 2) {
    confidence = 'high';
  } else if (satisfaction > 50) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  const trend = satisfaction > 70 ? 'up' : satisfaction > 40 ? 'stable' : 'down';

  return {
    estimated: Math.round(estimated),
    confidence,
    trend,
  };
}

export { router as merchantRoutes };
