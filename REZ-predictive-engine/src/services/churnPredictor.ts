import { UserProfile, IUserProfile } from '../models/userProfile';
import {
  Prediction,
  Factor,
  ChurnPrediction,
  ChurnPredictionResult,
  ChurnRisk,
  RetentionOffer
} from '../types';
import logger from '../utils/logger';

// Configuration constants
const RECENCY_THRESHOLDS = {
  LOW_RISK: 7,      // Within 7 days - low risk
  MEDIUM_RISK: 14,   // 8-14 days - medium risk
  HIGH_RISK: 30,     // 15-30 days - high risk
  CRITICAL_RISK: 60  // 60+ days - critical risk
};

const FREQUENCY_THRESHOLDS = {
  LOW: 1,   // Only 1 order - high churn risk
  MEDIUM: 3, // 2-3 orders - medium
  HIGH: 5    // 4+ orders - low churn risk
};

const MONETARY_THRESHOLDS = {
  LOW: 500,   // Low AOV
  MEDIUM: 2000,
  HIGH: 5000
};

const ENGAGEMENT_THRESHOLDS = {
  LOW: 30,
  MEDIUM: 60,
  HIGH: 80
};

/**
 * Calculate days since last order
 */
function getDaysSinceLastOrder(user: IUserProfile): number {
  if (!user.lastOrderDate) {
    return user.accountAge || 999; // New users with no orders
  }
  const now = new Date();
  const diffTime = now.getTime() - new Date(user.lastOrderDate).getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate RFM score components
 */
function calculateRFMScore(user: IUserProfile): { recency: number; frequency: number; monetary: number } {
  const daysSinceLastOrder = getDaysSinceLastOrder(user);

  // Recency score (lower days = higher score)
  let recency = 0;
  if (daysSinceLastOrder <= RECENCY_THRESHOLDS.LOW_RISK) {
    recency = 10;
  } else if (daysSinceLastOrder <= RECENCY_THRESHOLDS.MEDIUM_RISK) {
    recency = 20;
  } else if (daysSinceLastOrder <= RECENCY_THRESHOLDS.HIGH_RISK) {
    recency = 40;
  } else if (daysSinceLastOrder <= RECENCY_THRESHOLDS.CRITICAL_RISK) {
    recency = 70;
  } else {
    recency = 100;
  }

  // Frequency score (more orders = higher score)
  let frequency = 0;
  if (user.totalOrders >= FREQUENCY_THRESHOLDS.HIGH) {
    frequency = 10;
  } else if (user.totalOrders >= FREQUENCY_THRESHOLDS.MEDIUM) {
    frequency = 25;
  } else if (user.totalOrders >= FREQUENCY_THRESHOLDS.LOW) {
    frequency = 50;
  } else {
    frequency = 80;
  }

  // Monetary score (higher AOV = lower churn risk)
  let monetary = 0;
  if (user.avgOrderValue >= MONETARY_THRESHOLDS.HIGH) {
    monetary = 10;
  } else if (user.avgOrderValue >= MONETARY_THRESHOLDS.MEDIUM) {
    monetary = 20;
  } else if (user.avgOrderValue >= MONETARY_THRESHOLDS.LOW) {
    monetary = 40;
  } else {
    monetary = 60;
  }

  return { recency, frequency, monetary };
}

/**
 * Calculate overall churn score (0-100, higher = more likely to churn)
 */
function calculateChurnScore(user: IUserProfile): number {
  const rfm = calculateRFMScore(user);

  // Weighted churn score
  const churnScore =
    rfm.recency * 0.5 +        // Recency is most important (50%)
    rfm.frequency * 0.25 +     // Frequency (25%)
    rfm.monetary * 0.15 +      // Monetary (15%)
    (100 - user.engagementScore) * 0.1; // Engagement (10%)

  return Math.min(100, Math.max(0, churnScore));
}

/**
 * Determine churn risk level
 */
function getRiskLevel(score: number): ChurnRisk {
  if (score >= 70) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

/**
 * Identify top factors contributing to churn risk
 */
function identifyTopFactors(user: IUserProfile, churnScore: number): string[] {
  const factors: string[] = [];
  const daysSinceLastOrder = getDaysSinceLastOrder(user);

  // Check recency
  if (daysSinceLastOrder > 30) {
    factors.push(`No order in ${daysSinceLastOrder} days`);
  } else if (daysSinceLastOrder > 14) {
    factors.push(`Last order ${daysSinceLastOrder} days ago`);
  }

  // Check frequency
  if (user.totalOrders < 2) {
    factors.push('New customer with single order');
  } else if (user.totalOrders < 4) {
    factors.push('Low order frequency');
  }

  // Check monetary
  if (user.avgOrderValue < 500) {
    factors.push('Low average order value');
  }

  // Check engagement
  if (user.engagementScore < ENGAGEMENT_THRESHOLDS.LOW) {
    factors.push('Very low engagement score');
  } else if (user.engagementScore < ENGAGEMENT_THRESHOLDS.MEDIUM) {
    factors.push('Declining engagement');
  }

  // Check email/push engagement
  if (user.emailOpenRate !== undefined && user.emailOpenRate < 0.2) {
    factors.push('Low email engagement');
  }

  // Check cart abandonment
  if (user.cartAbandonmentRate !== undefined && user.cartAbandonmentRate > 0.7) {
    factors.push('High cart abandonment rate');
  }

  // Check login frequency
  if (user.loginFrequency < 2) {
    factors.push('Rare login activity');
  }

  // Check verification status
  if (!user.isEmailVerified || !user.isPhoneVerified) {
    factors.push('Incomplete account verification');
  }

  return factors.length > 0 ? factors : ['General inactivity'];
}

/**
 * Generate retention offers based on churn risk
 */
function suggestOffers(churnScore: number): string[] {
  if (churnScore >= 70) {
    // Critical - aggressive offers
    return [
      '25% off next order + free delivery',
      'Double loyalty points on next 3 orders',
      'Exclusive early access to sales',
      'Personal shopping consultation'
    ];
  } else if (churnScore >= 50) {
    // High risk
    return [
      '20% off next order',
      'Free delivery on next purchase',
      'Loyalty points bonus (2x)',
      'Personalized product recommendations'
    ];
  } else if (churnScore >= 30) {
    // Medium risk
    return [
      '15% off next order',
      'Free delivery for orders over 500',
      'Loyalty points bonus',
      'Wishlist price drop notifications'
    ];
  } else {
    // Low risk - gentle nudge
    return [
      '10% off your next order',
      'Free delivery for new arrivals',
      'Exclusive member preview'
    ];
  }
}

/**
 * Generate retention offers with full details
 */
function generateRetentionOffers(churnScore: number): RetentionOffer[] {
  const baseOffers: RetentionOffer[] = [
    {
      type: 'discount',
      value: churnScore >= 70 ? 25 : churnScore >= 50 ? 20 : 15,
      title: 'Special Discount',
      description: 'Exclusive discount on your next order',
      validDays: 7
    },
    {
      type: 'free_delivery',
      value: 0,
      title: 'Free Delivery',
      description: 'Complimentary delivery on your next order',
      validDays: 5
    },
    {
      type: 'loyalty_points',
      value: churnScore >= 50 ? 200 : 100,
      title: 'Bonus Points',
      description: 'Extra loyalty points on your next purchase',
      validDays: 14
    }
  ];

  return baseOffers;
}

/**
 * Calculate days until predicted churn
 */
function calculateDaysUntilChurn(churnScore: number, daysSinceLastOrder: number): number {
  if (churnScore >= 70) {
    return Math.max(3, Math.min(7, daysSinceLastOrder - 30));
  } else if (churnScore >= 50) {
    return Math.max(7, Math.min(14, daysSinceLastOrder - 14));
  } else if (churnScore >= 30) {
    return Math.max(14, Math.min(30, daysSinceLastOrder));
  }
  return 30 + (30 - churnScore); // Low risk: longer timeframe
}

/**
 * Generate detailed factors array for prediction response
 */
function generateFactors(user: IUserProfile): Factor[] {
  const factors: Factor[] = [];
  const daysSinceLastOrder = getDaysSinceLastOrder(user);

  // Recency factor
  factors.push({
    name: 'Days Since Last Order',
    impact: daysSinceLastOrder > 30 ? 0.8 : daysSinceLastOrder > 14 ? 0.4 : 0.1,
    value: daysSinceLastOrder,
    description: `Last order was ${daysSinceLastOrder} days ago`
  });

  // Frequency factor
  factors.push({
    name: 'Order Frequency',
    impact: user.totalOrders < 2 ? 0.6 : user.totalOrders < 4 ? 0.3 : -0.2,
    value: user.totalOrders,
    description: `Total of ${user.totalOrders} orders placed`
  });

  // Monetary factor
  factors.push({
    name: 'Average Order Value',
    impact: user.avgOrderValue < 500 ? 0.5 : user.avgOrderValue < 2000 ? 0.2 : -0.1,
    value: user.avgOrderValue,
    description: `Average order value: ${user.avgOrderValue.toFixed(2)}`
  });

  // Engagement factor
  factors.push({
    name: 'Engagement Score',
    impact: (100 - user.engagementScore) / 100,
    value: user.engagementScore,
    description: `Engagement score: ${user.engagementScore}/100`
  });

  // Email engagement
  if (user.emailOpenRate !== undefined) {
    factors.push({
      name: 'Email Open Rate',
      impact: user.emailOpenRate < 0.2 ? 0.4 : user.emailOpenRate < 0.5 ? 0.1 : -0.1,
      value: `${(user.emailOpenRate * 100).toFixed(1)}%`,
      description: `Email open rate: ${(user.emailOpenRate * 100).toFixed(1)}%`
    });
  }

  // Cart abandonment
  if (user.cartAbandonmentRate !== undefined) {
    factors.push({
      name: 'Cart Abandonment Rate',
      impact: user.cartAbandonmentRate > 0.7 ? 0.5 : user.cartAbandonmentRate > 0.5 ? 0.2 : 0,
      value: `${(user.cartAbandonmentRate * 100).toFixed(1)}%`,
      description: `Cart abandonment rate: ${(user.cartAbandonmentRate * 100).toFixed(1)}%`
    });
  }

  return factors;
}

/**
 * Generate recommendation based on churn risk
 */
function generateRecommendation(churnScore: number, risk: ChurnRisk): string {
  switch (risk) {
    case 'CRITICAL':
      return 'Immediate intervention required. Deploy urgent retention campaign with aggressive offers and personal outreach.';
    case 'HIGH':
      return 'High priority retention action needed. Send personalized offers within 24 hours.';
    case 'MEDIUM':
      return 'Schedule targeted re-engagement campaign. Monitor closely over next 7 days.';
    case 'LOW':
      return 'Continue standard engagement. Send gentle reminders and highlight new products.';
    default:
      return 'Monitor user activity and adjust engagement strategy as needed.';
  }
}

/**
 * Main churn prediction function
 */
export async function predictChurn(userId: string): Promise<ChurnPrediction> {
  const startTime = Date.now();

  try {
    // Fetch user profile
    const user = await UserProfile.findOne({ userId });

    if (!user) {
      // Create a default prediction for unknown users
      return createDefaultChurnPrediction(userId);
    }

    // Calculate churn score
    const churnScore = calculateChurnScore(user);
    const risk = getRiskLevel(churnScore);
    const daysSinceLastOrder = getDaysSinceLastOrder(user);

    // Build prediction result
    const result: ChurnPredictionResult = {
      risk,
      daysUntilChurn: calculateDaysUntilChurn(churnScore, daysSinceLastOrder),
      topFactors: identifyTopFactors(user, churnScore),
      retentionOffers: suggestOffers(churnScore)
    };

    // Build prediction object
    const prediction: ChurnPrediction = {
      userId,
      type: 'churn',
      score: Math.round(churnScore),
      probability: churnScore / 100,
      confidence: calculateConfidence(user),
      factors: generateFactors(user),
      recommendation: generateRecommendation(churnScore, risk),
      timestamp: new Date(),
      result
    };

    const durationMs = Date.now() - startTime;
    logger.logPrediction(userId, 'churn', prediction.score, prediction.confidence, durationMs);

    return prediction;
  } catch (error) {
    logger.logError('predictChurn', error, { userId });
    throw error;
  }
}

/**
 * Create default churn prediction for unknown users
 */
function createDefaultChurnPrediction(userId: string): ChurnPrediction {
  return {
    userId,
    type: 'churn',
    score: 50, // Neutral score
    probability: 0.5,
    confidence: 0.3, // Low confidence for unknown users
    factors: [
      {
        name: 'Unknown User',
        impact: 0,
        value: 'User not found in database',
        description: 'No historical data available'
      }
    ],
    recommendation: 'Collect more user data to generate accurate predictions.',
    timestamp: new Date(),
    result: {
      risk: 'MEDIUM',
      daysUntilChurn: 30,
      topFactors: ['Insufficient data for accurate prediction'],
      retentionOffers: ['Welcome offer to encourage first order']
    }
  };
}

/**
 * Calculate prediction confidence based on data availability
 */
function calculateConfidence(user: IUserProfile): number {
  let confidence = 0.5; // Base confidence

  // More orders = more confidence
  if (user.totalOrders >= 10) {
    confidence += 0.2;
  } else if (user.totalOrders >= 5) {
    confidence += 0.1;
  }

  // Longer account age = more confidence
  if (user.accountAge >= 180) {
    confidence += 0.15;
  } else if (user.accountAge >= 90) {
    confidence += 0.1;
  }

  // Verified accounts = more confidence
  if (user.isEmailVerified && user.isPhoneVerified) {
    confidence += 0.1;
  }

  // Email engagement data available
  if (user.emailOpenRate !== undefined) {
    confidence += 0.05;
  }

  // Cart abandonment data available
  if (user.cartAbandonmentRate !== undefined) {
    confidence += 0.05;
  }

  return Math.min(0.95, Math.max(0.4, confidence));
}

/**
 * Get at-risk users segment
 */
export async function getAtRiskUsers(
  riskLevels: ChurnRisk[] = ['CRITICAL', 'HIGH'],
  limit: number = 100
): Promise<Array<{ userId: string; score: number; risk: ChurnRisk }>> {
  // This would typically query cached predictions
  // For now, return a placeholder that can be implemented with actual caching
  return [];
}

/**
 * Predict churn for a user profile object (without database lookup)
 */
export function predictChurnFromProfile(user: IUserProfile): ChurnPrediction {
  const churnScore = calculateChurnScore(user);
  const risk = getRiskLevel(churnScore);
  const daysSinceLastOrder = getDaysSinceLastOrder(user);

  const result: ChurnPredictionResult = {
    risk,
    daysUntilChurn: calculateDaysUntilChurn(churnScore, daysSinceLastOrder),
    topFactors: identifyTopFactors(user, churnScore),
    retentionOffers: suggestOffers(churnScore)
  };

  return {
    userId: user.userId,
    type: 'churn',
    score: Math.round(churnScore),
    probability: churnScore / 100,
    confidence: calculateConfidence(user),
    factors: generateFactors(user),
    recommendation: generateRecommendation(churnScore, risk),
    timestamp: new Date(),
    result
  };
}
