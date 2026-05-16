// ML-based prediction models
// These models provide advanced ML-based predictions using weighted feature engineering
// Replace with actual XGBoost/Prophet models in production

import { IUserProfile } from '../models/userProfile';
import { ChurnRisk, CustomerTier } from '../types';
import logger from '../utils/logger';

/**
 * User features extracted for ML predictions
 */
export interface UserFeatures {
  // RFM features
  daysSinceOrder: number;
  orderFrequency: number;
  avgOrderValue: number;
  totalSpend: number;

  // Engagement features
  engagementScore: number;
  loginFrequency: number;
  emailOpenRate?: number;
  cartAbandonmentRate?: number;

  // Account features
  tenureDays: number;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;

  // Behavioral signals
  preferredCategories: string[];
  loyaltyScore: number;
  competitorRisk: number;

  // Advanced signals (from intent graph)
  signals?: {
    behavioral?: {
      urgencyResponsiveness: number;
      luxuryAffinity: number;
    };
    social?: {
      influenceScore: number;
      sharingRate: number;
    };
  };
}

/**
 * LTV prediction result with multiple timeframes
 */
export interface LTVPrediction {
  ltv30: number;
  ltv90: number;
  ltv365: number;
  confidence: number;
}

/**
 * Next purchase prediction result
 */
export interface NextPurchasePrediction {
  daysUntilNextPurchase: number;
  predictedCategories: string[];
  estimatedOrderValue: number;
  confidence: number;
  bestTimeWindow: {
    hours: number[];
  };
  optimalChannel: string;
}

/**
 * Propensity score for an action
 */
export interface PropensityScore {
  action: string;
  score: number;
  factors: Factor[];
  recommendations: string[];
}

/**
 * Factor contributing to a prediction
 */
export interface Factor {
  name: string;
  impact: number;
  value: string;
}

/**
 * Historical user data for training
 */
export interface HistoricalUser {
  userId: string;
  features: UserFeatures;
  outcome: {
    churned: boolean;
    ltv365?: number;
    nextPurchaseDays?: number;
  };
}

/**
 * Base ML Model interface
 */
interface MLModel {
  name: string;
  predict(user: UserFeatures, ...args: any[]): number | object | PropensityScore;
  train?(data: HistoricalUser[]): void;
}

/**
 * Convert IUserProfile to UserFeatures
 */
export function userToFeatures(user: IUserProfile): UserFeatures {
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
    preferredCategories: user.preferredCategories,
    loyaltyScore: user.loyaltyPoints ? Math.min(100, user.loyaltyPoints / 100) : 50,
    competitorRisk: 30 // Default, would come from intent graph in production
  };
}

/**
 * Churn Prediction Model using weighted feature engineering
 * Simulates XGBoost-style gradient boosting with calibrated weights
 */
class ChurnPredictionModel implements MLModel {
  name = 'churn-xgboost';

  // Feature weights calibrated for e-commerce churn prediction
  private readonly weights = {
    recency: 0.30,
    frequency: 0.20,
    monetary: 0.15,
    engagement: 0.20,
    competitorRisk: 0.10,
    verification: 0.05
  };

  predict(user: UserFeatures): number {
    // Normalize recency (0-30 days -> 0-1, higher = worse)
    const recencyScore = Math.min(user.daysSinceOrder / 30, 1);

    // Normalize frequency (0-10 orders -> 0-1, higher = better)
    const frequencyScore = Math.min(user.orderFrequency / 10, 1);

    // Invert monetary (higher AOV = lower churn risk)
    const monetaryScore = 1 - Math.min(user.avgOrderValue / 2000, 1);

    // Invert engagement (lower engagement = higher churn risk)
    const engagementScore = 1 - user.engagementScore / 100;

    // Normalize competitor risk
    const competitorScore = user.competitorRisk / 100;

    // Verification bonus (verified = lower churn)
    const verificationBonus = (user.isEmailVerified ? 0.5 : 0) +
                              (user.isPhoneVerified ? 0.5 : 0);

    // Calculate weighted churn score
    const churnScore =
      recencyScore * this.weights.recency +
      frequencyScore * this.weights.frequency +
      monetaryScore * this.weights.monetary +
      engagementScore * this.weights.engagement +
      competitorScore * this.weights.competitorRisk -
      (1 - verificationBonus) * this.weights.verification;

    // Scale to 0-100 and clamp
    return Math.min(100, Math.max(0, churnScore * 100));
  }

  train(data: HistoricalUser[]): void {
    // In production: train XGBoost model with historical data
    logger.info(`Training churn model with ${data.length} samples`);
    // Placeholder for actual XGBoost training:
    // const model = xgboost.train(data.map(d => d.features), data.map(d => d.outcome.churned ? 1 : 0));
  }
}

/**
 * LTV Prediction Model using retention-adjusted revenue projection
 * Simulates Prophet-style time series forecasting
 */
class LTVPredictionModel implements MLModel {
  name = 'ltv-prophet';

  predict(user: UserFeatures): LTVPrediction {
    const baseMonthly = user.avgOrderValue * Math.max(1, user.orderFrequency / 6);
    const retentionRate = this.calculateRetentionRate(user);
    const seasonality = this.getSeasonalityFactor();

    return {
      ltv30: baseMonthly,
      ltv90: baseMonthly * 3 * retentionRate,
      ltv365: baseMonthly * 12 * Math.pow(retentionRate, 12) * seasonality,
      confidence: 0.75 + (user.tenureDays / 365) * 0.15
    };
  }

  private calculateRetentionRate(user: UserFeatures): number {
    // Base retention rate
    let retention = 0.7;

    // Tenure bonus (longer users more likely to stay)
    retention += Math.min(user.tenureDays / 180, 0.2);

    // Engagement bonus
    retention += (user.engagementScore / 500);

    // Order frequency bonus
    retention += Math.min(user.orderFrequency / 50, 0.1);

    // Cart abandonment penalty
    if (user.cartAbandonmentRate !== undefined) {
      retention -= user.cartAbandonmentRate * 0.1;
    }

    return Math.min(0.95, Math.max(0.5, retention));
  }

  private getSeasonalityFactor(): number {
    // Q4 bonus for holiday shopping season
    const month = new Date().getMonth();
    if (month >= 9) {
      // Oct-Dec: holiday season boost
      return 1.2;
    } else if (month >= 5 && month <= 7) {
      // Jun-Aug: summer slowdown
      return 0.9;
    }
    return 1.0;
  }

  train(data: HistoricalUser[]): void {
    logger.info(`Training LTV model with ${data.length} samples`);
  }
}

/**
 * Next Purchase Prediction Model
 * Predicts when user will make next purchase and what they'll buy
 */
class NextPurchaseModel implements MLModel {
  name = 'next-purchase-gradient-boost';

  predict(user: UserFeatures): NextPurchasePrediction {
    // Base prediction: 14 days
    let predictedDays = 14;

    // Recency penalty (longer since last order = longer until next)
    predictedDays += Math.min(user.daysSinceOrder / 6, 1) * 5;

    // Frequency bonus (frequent buyers buy sooner)
    predictedDays -= Math.min(user.orderFrequency / 10, 1) * 3;

    // Engagement bonus
    predictedDays -= user.engagementScore / 200;

    // Engagement penalty (low engagement = longer gap)
    if (user.cartAbandonmentRate !== undefined) {
      predictedDays += user.cartAbandonmentRate * 2;
    }

    const predictedDaysClamped = Math.max(1, Math.round(predictedDays));

    // Predicted categories (top 3)
    const predictedCategories = user.preferredCategories.slice(0, 3);

    // Estimated order value (with variance)
    const variance = 0.1;
    const estimatedValue = user.avgOrderValue * (1 + (Math.random() * variance * 2 - variance));

    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(user);

    // Best hours for engagement
    const bestHours = this.identifyBestHours(user);

    return {
      daysUntilNextPurchase: predictedDaysClamped,
      predictedCategories,
      estimatedOrderValue: Math.round(estimatedValue),
      confidence,
      bestTimeWindow: { hours: bestHours },
      optimalChannel: this.predictChannel(user)
    };
  }

  private calculateConfidence(user: UserFeatures): number {
    let confidence = 0.5;

    // More orders = more confident prediction
    confidence += Math.min(user.orderFrequency / 20, 0.25);

    // Longer tenure = more confident
    confidence += Math.min(user.tenureDays / 180, 0.15);

    // Engagement data available
    if (user.cartAbandonmentRate !== undefined) {
      confidence += 0.1;
    }

    return Math.min(0.95, confidence);
  }

  private identifyBestHours(user: UserFeatures): number[] {
    // Time-based category preferences
    if (user.preferredCategories.includes('food') || user.preferredCategories.includes('restaurant')) {
      return [12, 19]; // Lunch and dinner times
    }
    if (user.preferredCategories.includes('groceries')) {
      return [10, 17]; // Morning and evening grocery runs
    }
    if (user.preferredCategories.includes('fashion') || user.preferredCategories.includes('electronics')) {
      return [20, 21, 22]; // Evening browsing
    }
    return [19, 20, 21]; // Default evening hours
  }

  private predictChannel(user: UserFeatures): string {
    // Check behavioral signals
    if ((user.signals?.behavioral?.urgencyResponsiveness ?? 0) > 70) {
      return 'push'; // Responsive to urgent notifications
    }
    if ((user.signals?.behavioral?.luxuryAffinity ?? 0) > 60) {
      return 'email'; // Luxury buyers prefer email
    }
    if ((user.signals?.social?.sharingRate ?? 0) > 0.4) {
      return 'social'; // Social sharers respond to social
    }
    return 'whatsapp'; // Default to WhatsApp for general users
  }

  train(data: HistoricalUser[]): void {
    logger.info(`Training next purchase model with ${data.length} samples`);
  }
}

/**
 * Propensity Model for predicting user actions
 * Predicts likelihood of reorder, upsell, referral, subscription
 */
class PropensityModel implements MLModel {
  name = 'propensity-logistic';

  // Available actions
  private readonly actions = ['reorder', 'upsell', 'referral', 'subscription'];

  predict(user: UserFeatures, action: string): PropensityScore {
    const propensities: Record<string, number> = {
      'reorder': this.predictReorderPropensity(user),
      'upsell': this.predictUpsellPropensity(user),
      'referral': this.predictReferralPropensity(user),
      'subscription': this.predictSubscriptionPropensity(user)
    };

    const score = propensities[action] || 50;

    return {
      action,
      score,
      factors: this.getTopFactors(user, action),
      recommendations: this.getRecommendations(action, score)
    };
  }

  predictAll(user: UserFeatures): Record<string, number> {
    return {
      'reorder': this.predictReorderPropensity(user),
      'upsell': this.predictUpsellPropensity(user),
      'referral': this.predictReferralPropensity(user),
      'subscription': this.predictSubscriptionPropensity(user)
    };
  }

  private predictReorderPropensity(user: UserFeatures): number {
    const recencyScore = 1 - Math.min(user.daysSinceOrder / 30, 1);
    const frequencyScore = Math.min(user.orderFrequency / 15, 1);
    const loyaltyBonus = user.loyaltyScore / 100;

    return Math.min(100,
      recencyScore * 40 +
      frequencyScore * 30 +
      loyaltyBonus * 30
    );
  }

  private predictUpsellPropensity(user: UserFeatures): number {
    const monetaryScore = Math.min(user.avgOrderValue / 1000, 1);
    const luxuryAffinity = user.signals?.behavioral?.luxuryAffinity || 50;
    const engagementBonus = user.engagementScore / 100;

    return Math.min(100,
      monetaryScore * 30 +
      (luxuryAffinity / 100) * 40 +
      engagementBonus * 30
    );
  }

  private predictReferralPropensity(user: UserFeatures): number {
    const influenceScore = user.signals?.social?.influenceScore || 50;
    const sharingRate = user.signals?.social?.sharingRate || 0.3;
    const loyaltyBonus = user.loyaltyScore / 100;

    return Math.min(100,
      (influenceScore / 100) * 50 +
      sharingRate * 100 * 0.3 +
      loyaltyBonus * 20
    );
  }

  private predictSubscriptionPropensity(user: UserFeatures): number {
    const frequencyScore = Math.min(user.orderFrequency / 20, 1);
    const loyaltyBonus = user.loyaltyScore / 100;
    const competitorPenalty = 1 - user.competitorRisk / 100;

    return Math.min(100,
      frequencyScore * 40 +
      loyaltyBonus * 30 +
      competitorPenalty * 30
    );
  }

  private getTopFactors(user: UserFeatures, action: string): Factor[] {
    const factors: Factor[] = [];

    switch (action) {
      case 'reorder':
        factors.push(
          { name: 'Days Since Order', impact: 0.3, value: `${user.daysSinceOrder} days` },
          { name: 'Order Frequency', impact: 0.25, value: `${user.orderFrequency} orders` },
          { name: 'Loyalty Score', impact: 0.2, value: `${user.loyaltyScore}/100` }
        );
        break;
      case 'upsell':
        factors.push(
          { name: 'Avg Order Value', impact: 0.35, value: `₹${user.avgOrderValue}` },
          { name: 'Luxury Affinity', impact: 0.3, value: `${user.signals?.behavioral?.luxuryAffinity || 50}%` },
          { name: 'Engagement', impact: 0.2, value: `${user.engagementScore}/100` }
        );
        break;
      case 'referral':
        factors.push(
          { name: 'Influence Score', impact: 0.4, value: `${user.signals?.social?.influenceScore || 50}` },
          { name: 'Sharing Rate', impact: 0.3, value: `${((user.signals?.social?.sharingRate || 0.3) * 100).toFixed(0)}%` },
          { name: 'Loyalty', impact: 0.2, value: `${user.loyaltyScore}/100` }
        );
        break;
      case 'subscription':
        factors.push(
          { name: 'Order Frequency', impact: 0.35, value: `${user.orderFrequency} orders/mo` },
          { name: 'Loyalty Score', impact: 0.3, value: `${user.loyaltyScore}/100` },
          { name: 'Competitor Risk', impact: 0.2, value: `${user.competitorRisk}%` }
        );
        break;
    }

    return factors;
  }

  private getRecommendations(action: string, score: number): string[] {
    if (score > 70) {
      return [
        `High propensity for ${action} - execute now`,
        'Offer premium experience to maximize value',
        'Personal outreach recommended'
      ];
    }
    if (score > 50) {
      return [
        `Moderate propensity for ${action} - nurture needed`,
        'Send educational content',
        'Consider bundled offers'
      ];
    }
    return [
      `Low propensity for ${action} - focus resources elsewhere`,
      'Consider different action for this user',
      'Monitor for behavior changes'
    ];
  }

  train(data: HistoricalUser[]): void {
    logger.info(`Training propensity model with ${data.length} samples`);
  }
}

/**
 * Segment classification model
 */
class SegmentClassificationModel implements MLModel {
  name = 'segment-classifier';

  predict(user: UserFeatures): { segment: string; tier: CustomerTier } {
    // Determine customer segment
    let segment = 'standard';

    if (user.competitorRisk > 70) {
      segment = 'at-risk';
    } else if (user.engagementScore > 80 && user.orderFrequency > 10) {
      segment = 'champion';
    } else if (user.avgOrderValue > 2000 && user.orderFrequency > 5) {
      segment = 'loyal';
    } else if (user.tenureDays < 30) {
      segment = 'new';
    }

    // Determine tier
    let tier: CustomerTier = 'BRONZE';
    const ltvScore = (user.avgOrderValue * user.orderFrequency) +
                     (user.loyaltyScore * 10);

    if (ltvScore > 50000) {
      tier = 'PLATINUM';
    } else if (ltvScore > 20000) {
      tier = 'GOLD';
    } else if (ltvScore > 5000) {
      tier = 'SILVER';
    }

    return { segment, tier };
  }

  train(data: HistoricalUser[]): void {
    logger.info(`Training segment classifier with ${data.length} samples`);
  }
}

// Export singleton instances
export const mlModels = {
  churn: new ChurnPredictionModel(),
  ltv: new LTVPredictionModel(),
  nextPurchase: new NextPurchaseModel(),
  propensity: new PropensityModel(),
  segment: new SegmentClassificationModel()
};

/**
 * Get churn risk level from score
 */
export function scoreToRiskLevel(score: number): ChurnRisk {
  if (score >= 70) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

/**
 * Get customer tier from LTV score
 */
export function ltvToTier(ltv365: number): CustomerTier {
  if (ltv365 >= 50000) return 'PLATINUM';
  if (ltv365 >= 20000) return 'GOLD';
  if (ltv365 >= 5000) return 'SILVER';
  return 'BRONZE';
}
