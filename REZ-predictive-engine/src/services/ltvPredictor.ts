import { UserProfile, IUserProfile } from '../models/userProfile';
import {
  Prediction,
  Factor,
  LTVPrediction,
  LTVPredictionResult,
  CustomerTier
} from '../types';
import logger from '../utils/logger.js';

// Tier thresholds (annual LTV)
const TIER_THRESHOLDS = {
  PLATINUM: 50000,
  GOLD: 20000,
  SILVER: 5000
};

// Engagement adjustments
const ENGAGEMENT_MULTIPLIERS = {
  VERY_HIGH: 1.5,  // Engagement > 80
  HIGH: 1.2,      // Engagement 60-80
  MEDIUM: 1.0,    // Engagement 40-60
  LOW: 0.8,       // Engagement 20-40
  VERY_LOW: 0.5   // Engagement < 20
};

// Retention rate estimation factors
const RETENTION_FACTORS = {
  EMAIL_VERIFIED: 0.05,
  PHONE_VERIFIED: 0.05,
  HIGH_ENGAGEMENT: 0.1,
  LOYALTY_PROGRAM: 0.08,
  MULTIPLE_PAYMENT_METHODS: 0.03
};

/**
 * Calculate base monthly value
 */
function calculateBaseMonthlyValue(user: IUserProfile): number {
  return user.avgOrderValue * user.ordersPerMonth;
}

/**
 * Calculate estimated retention rate (0-1)
 */
function calculateRetentionRate(user: IUserProfile): number {
  let retentionRate = 0.7; // Base retention rate

  // Adjust for account age (longer = more likely to retain)
  if (user.accountAge >= 365) {
    retentionRate += 0.15;
  } else if (user.accountAge >= 180) {
    retentionRate += 0.1;
  } else if (user.accountAge >= 90) {
    retentionRate += 0.05;
  }

  // Adjust for verification
  if (user.isEmailVerified) {
    retentionRate += RETENTION_FACTORS.EMAIL_VERIFIED;
  }
  if (user.isPhoneVerified) {
    retentionRate += RETENTION_FACTORS.PHONE_VERIFIED;
  }

  // Adjust for engagement
  if (user.engagementScore >= 80) {
    retentionRate += RETENTION_FACTORS.HIGH_ENGAGEMENT;
  } else if (user.engagementScore >= 60) {
    retentionRate += 0.05;
  } else if (user.engagementScore < 30) {
    retentionRate -= 0.1;
  }

  // Adjust for loyalty
  if (user.loyaltyPoints && user.loyaltyPoints > 1000) {
    retentionRate += RETENTION_FACTORS.LOYALTY_PROGRAM;
  }

  // Adjust for payment methods
  if (user.preferredPaymentMethods && user.preferredPaymentMethods.length > 1) {
    retentionRate += RETENTION_FACTORS.MULTIPLE_PAYMENT_METHODS;
  }

  // Adjust for email engagement
  if (user.emailOpenRate !== undefined) {
    if (user.emailOpenRate > 0.5) {
      retentionRate += 0.05;
    } else if (user.emailOpenRate < 0.1) {
      retentionRate -= 0.05;
    }
  }

  // Adjust for order frequency
  if (user.totalOrders >= 10) {
    retentionRate += 0.05;
  } else if (user.totalOrders < 3) {
    retentionRate -= 0.1;
  }

  return Math.min(0.95, Math.max(0.3, retentionRate));
}

/**
 * Get engagement multiplier
 */
function getEngagementMultiplier(engagementScore: number): number {
  if (engagementScore > 80) return ENGAGEMENT_MULTIPLIERS.VERY_HIGH;
  if (engagementScore >= 60) return ENGAGEMENT_MULTIPLIERS.HIGH;
  if (engagementScore >= 40) return ENGAGEMENT_MULTIPLIERS.MEDIUM;
  if (engagementScore >= 20) return ENGAGEMENT_MULTIPLIERS.LOW;
  return ENGAGEMENT_MULTIPLIERS.VERY_LOW;
}

/**
 * Calculate predicted LTV values
 */
function calculateLTV(
  baseMonthlyValue: number,
  retentionRate: number,
  engagementMultiplier: number
): { ltv30: number; ltv90: number; ltv365: number } {
  const adjustedMonthlyValue = baseMonthlyValue * engagementMultiplier;

  return {
    ltv30: Math.round(adjustedMonthlyValue),
    ltv90: Math.round(adjustedMonthlyValue * 3 * retentionRate),
    ltv365: Math.round(adjustedMonthlyValue * 12 * Math.pow(retentionRate, 12))
  };
}

/**
 * Assign customer tier based on annual LTV
 */
function assignTier(annualLTV: number): CustomerTier {
  if (annualLTV >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
  if (annualLTV >= TIER_THRESHOLDS.GOLD) return 'GOLD';
  if (annualLTV >= TIER_THRESHOLDS.SILVER) return 'SILVER';
  return 'BRONZE';
}

/**
 * Calculate confidence in LTV prediction
 */
function calculateConfidence(user: IUserProfile): number {
  let confidence = 0.6; // Base confidence

  // More orders = more confidence
  if (user.totalOrders >= 20) {
    confidence += 0.2;
  } else if (user.totalOrders >= 10) {
    confidence += 0.15;
  } else if (user.totalOrders >= 5) {
    confidence += 0.1;
  }

  // Longer account age = more confidence
  if (user.accountAge >= 365) {
    confidence += 0.15;
  } else if (user.accountAge >= 180) {
    confidence += 0.1;
  }

  // Known AOV = more confidence
  if (user.avgOrderValue > 0) {
    confidence += 0.1;
  }

  // Consistent orders = more confidence
  if (user.ordersPerMonth >= 2) {
    confidence += 0.05;
  }

  return Math.min(0.9, Math.max(0.5, confidence));
}

/**
 * Identify top factors affecting LTV
 */
function identifyTopFactors(user: IUserProfile): string[] {
  const factors: string[] = [];

  // Monthly value factors
  if (user.avgOrderValue >= 2000) {
    factors.push('High average order value');
  } else if (user.avgOrderValue >= 1000) {
    factors.push('Above average order value');
  } else if (user.avgOrderValue < 500) {
    factors.push('Low average order value');
  }

  // Order frequency factors
  if (user.ordersPerMonth >= 4) {
    factors.push('High purchase frequency');
  } else if (user.ordersPerMonth >= 2) {
    factors.push('Regular purchase pattern');
  } else if (user.ordersPerMonth < 1) {
    factors.push('Infrequent purchases');
  }

  // Engagement factors
  if (user.engagementScore >= 70) {
    factors.push('High customer engagement');
  } else if (user.engagementScore < 40) {
    factors.push('Low customer engagement');
  }

  // Account factors
  if (user.accountAge >= 365) {
    factors.push('Long-term customer relationship');
  } else if (user.accountAge < 90) {
    factors.push('New customer - developing relationship');
  }

  // Loyalty factors
  if (user.loyaltyPoints && user.loyaltyPoints > 5000) {
    factors.push('Highly active loyalty member');
  } else if (user.loyaltyPoints && user.loyaltyPoints > 1000) {
    factors.push('Active loyalty participant');
  }

  // Category diversity
  if (user.preferredCategories && user.preferredCategories.length >= 3) {
    factors.push('Diverse product interests');
  }

  return factors.length > 0 ? factors : ['Standard customer profile'];
}

/**
 * Generate recommendation based on LTV tier
 */
function generateRecommendation(tier: CustomerTier, ltv365: number): string {
  switch (tier) {
    case 'PLATINUM':
      return `VIP treatment required. Priority support, exclusive access, and personalized experiences to maintain relationship.`;
    case 'GOLD':
      return `High-value customer - focus on retention. Personalized recommendations and loyalty rewards.`;
    case 'SILVER':
      return `Growth opportunity. Increase engagement through targeted campaigns and upselling.`;
    case 'BRONZE':
      return `Nurture for growth. Focus on engagement and education to increase purchase frequency.`;
    default:
      return 'Monitor and adjust strategy based on evolving customer behavior.';
  }
}

/**
 * Generate detailed factors array
 */
function generateFactors(user: IUserProfile): Factor[] {
  const factors: Factor[] = [];

  factors.push({
    name: 'Average Order Value',
    impact: user.avgOrderValue >= 1000 ? 0.5 : -0.3,
    value: user.avgOrderValue,
    description: `AOV: ${user.avgOrderValue.toFixed(2)}`
  });

  factors.push({
    name: 'Order Frequency',
    impact: user.ordersPerMonth >= 2 ? 0.4 : -0.4,
    value: user.ordersPerMonth,
    description: `${user.ordersPerMonth.toFixed(1)} orders/month`
  });

  factors.push({
    name: 'Customer Engagement',
    impact: (user.engagementScore - 50) / 100,
    value: user.engagementScore,
    description: `Engagement: ${user.engagementScore}/100`
  });

  factors.push({
    name: 'Account Age',
    impact: user.accountAge >= 180 ? 0.3 : -0.2,
    value: user.accountAge,
    description: `${user.accountAge} days as customer`
  });

  factors.push({
    name: 'Total Lifetime Orders',
    impact: user.totalOrders >= 10 ? 0.3 : user.totalOrders < 3 ? -0.3 : 0,
    value: user.totalOrders,
    description: `${user.totalOrders} total orders`
  });

  if (user.loyaltyPoints !== undefined) {
    factors.push({
      name: 'Loyalty Points Balance',
      impact: user.loyaltyPoints > 1000 ? 0.2 : 0,
      value: user.loyaltyPoints,
      description: `${user.loyaltyPoints} points`
    });
  }

  return factors;
}

/**
 * Main LTV prediction function
 */
export async function predictLTV(userId: string): Promise<LTVPrediction> {
  const startTime = Date.now();

  try {
    const user = await UserProfile.findOne({ userId });

    if (!user) {
      return createDefaultLTVPrediction(userId);
    }

    const baseMonthlyValue = calculateBaseMonthlyValue(user);
    const retentionRate = calculateRetentionRate(user);
    const engagementMultiplier = getEngagementMultiplier(user.engagementScore);
    const ltv = calculateLTV(baseMonthlyValue, retentionRate, engagementMultiplier);
    const tier = assignTier(ltv.ltv365);
    const confidence = calculateConfidence(user);

    const result: LTVPredictionResult = {
      predictedLTV30: ltv.ltv30,
      predictedLTV90: ltv.ltv90,
      predictedLTV365: ltv.ltv365,
      tier,
      confidence,
      monthlyValue: Math.round(baseMonthlyValue),
      retentionRate: Math.round(retentionRate * 100) / 100
    };

    const prediction: LTVPrediction = {
      userId,
      type: 'ltv',
      score: calculateLTVScore(tier),
      probability: confidence,
      confidence,
      factors: generateFactors(user),
      recommendation: generateRecommendation(tier, ltv.ltv365),
      timestamp: new Date(),
      result
    };

    const durationMs = Date.now() - startTime;
    logger.logPrediction(userId, 'ltv', prediction.score, confidence, durationMs);

    return prediction;
  } catch (error) {
    logger.logError('predictLTV', error, { userId });
    throw error;
  }
}

/**
 * Calculate LTV score (0-100) based on tier
 */
function calculateLTVScore(tier: CustomerTier): number {
  switch (tier) {
    case 'PLATINUM': return 95;
    case 'GOLD': return 80;
    case 'SILVER': return 60;
    case 'BRONZE': return 40;
    default: return 50;
  }
}

/**
 * Create default LTV prediction for unknown users
 */
function createDefaultLTVPrediction(userId: string): LTVPrediction {
  return {
    userId,
    type: 'ltv',
    score: 50,
    probability: 0.5,
    confidence: 0.3,
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
      predictedLTV30: 0,
      predictedLTV90: 0,
      predictedLTV365: 0,
      tier: 'BRONZE',
      confidence: 0.3,
      monthlyValue: 0,
      retentionRate: 0.5
    }
  };
}

/**
 * Predict LTV from user profile object
 */
export function predictLTVFromProfile(user: IUserProfile): LTVPrediction {
  const baseMonthlyValue = calculateBaseMonthlyValue(user);
  const retentionRate = calculateRetentionRate(user);
  const engagementMultiplier = getEngagementMultiplier(user.engagementScore);
  const ltv = calculateLTV(baseMonthlyValue, retentionRate, engagementMultiplier);
  const tier = assignTier(ltv.ltv365);
  const confidence = calculateConfidence(user);

  const result: LTVPredictionResult = {
    predictedLTV30: ltv.ltv30,
    predictedLTV90: ltv.ltv90,
    predictedLTV365: ltv.ltv365,
    tier,
    confidence,
    monthlyValue: Math.round(baseMonthlyValue),
    retentionRate: Math.round(retentionRate * 100) / 100
  };

  return {
    userId: user.userId,
    type: 'ltv',
    score: calculateLTVScore(tier),
    probability: confidence,
    confidence,
    factors: generateFactors(user),
    recommendation: generateRecommendation(tier, ltv.ltv365),
    timestamp: new Date(),
    result
  };
}

/**
 * Get high-value customers segment
 */
export async function getHighValueCustomers(
  tiers: CustomerTier[] = ['PLATINUM', 'GOLD'],
  limit: number = 100
): Promise<Array<{ userId: string; tier: CustomerTier; ltv365: number }>> {
  // This would typically query cached predictions
  return [];
}
