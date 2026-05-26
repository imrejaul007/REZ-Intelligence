import { UserProfile, IUserProfile } from '../models/userProfile';
import {
  Factor,
  RevisitPrediction,
  RevisitPredictionResult
} from '../types';
import logger from '../utils/logger.js';

// Optimal engagement window in hours
const ENGAGEMENT_WINDOW = {
  BEFORE_VISIT_HOURS: 24,  // Start engaging 24 hours before predicted visit
  AFTER_VISIT_HOURS: 48     // Continue for 48 hours after predicted visit
};

// Recency factors
const RECENCY_WEIGHTS = {
  VERY_RECENT: 7,     // Within 7 days - expect return in 5-10 days
  RECENT: 14,         // Within 14 days - expect return in 7-14 days
  MEDIUM: 30,         // Within 30 days - expect return in 14-21 days
  OLD: 60,            // Within 60 days - expect return in 21-30 days
  INACTIVE: 999       // No recent orders
};

// Frequency to probability mapping
const FREQUENCY_PROBABILITY = {
  HIGH: { min: 4, probability: 0.85 },
  MEDIUM: { min: 2, probability: 0.65 },
  LOW: { min: 1, probability: 0.40 },
  NONE: { min: 0, probability: 0.20 }
};

/**
 * Calculate days since last order
 */
function getDaysSinceLastOrder(user: IUserProfile): number {
  if (!user.lastOrderDate) {
    return user.accountAge || 999;
  }
  const now = new Date();
  const diffTime = now.getTime() - new Date(user.lastOrderDate).getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate visit probability based on user behavior
 */
function calculateVisitProbability(user: IUserProfile): number {
  let probability = 0.5; // Base probability

  // Adjust based on past purchase frequency
  if (user.totalOrders >= FREQUENCY_PROBABILITY.HIGH.min) {
    probability += 0.25;
  } else if (user.totalOrders >= FREQUENCY_PROBABILITY.MEDIUM.min) {
    probability += 0.10;
  } else if (user.totalOrders >= FREQUENCY_PROBABILITY.LOW.min) {
    probability -= 0.05;
  } else {
    probability -= 0.20;
  }

  // Adjust based on orders per month
  if (user.ordersPerMonth >= 4) {
    probability += 0.15;
  } else if (user.ordersPerMonth >= 2) {
    probability += 0.05;
  } else if (user.ordersPerMonth < 1) {
    probability -= 0.10;
  }

  // Adjust based on engagement score
  if (user.engagementScore >= 70) {
    probability += 0.10;
  } else if (user.engagementScore < 30) {
    probability -= 0.15;
  }

  // Adjust based on login frequency
  if (user.loginFrequency >= 7) {
    probability += 0.05;
  } else if (user.loginFrequency < 2) {
    probability -= 0.10;
  }

  // Adjust based on cart abandonment (inversely)
  if (user.cartAbandonmentRate !== undefined) {
    if (user.cartAbandonmentRate < 0.3) {
      probability += 0.10;
    } else if (user.cartAbandonmentRate > 0.7) {
      probability -= 0.15;
    }
  }

  // Adjust based on email engagement
  if (user.emailOpenRate !== undefined) {
    if (user.emailOpenRate > 0.5) {
      probability += 0.05;
    } else if (user.emailOpenRate < 0.1) {
      probability -= 0.05;
    }
  }

  return Math.min(0.95, Math.max(0.1, probability));
}

/**
 * Predict days until next visit
 */
function predictDaysUntilNextVisit(user: IUserProfile): number {
  const daysSinceLastOrder = getDaysSinceLastOrder(user);

  // Base expected interval based on past behavior
  let expectedInterval: number;

  if (user.ordersPerMonth >= 4) {
    expectedInterval = 7;  // Weekly buyers
  } else if (user.ordersPerMonth >= 2) {
    expectedInterval = 14; // Bi-weekly buyers
  } else if (user.ordersPerMonth >= 1) {
    expectedInterval = 21; // Monthly buyers
  } else if (user.totalOrders > 0) {
    expectedInterval = 30; // Occasional buyers
  } else {
    expectedInterval = 45; // One-time or new buyers
  }

  // Adjust based on how overdue they are
  const overdueDays = daysSinceLastOrder - expectedInterval;

  if (overdueDays > expectedInterval) {
    // Significantly overdue - reduce expected days
    return Math.max(3, Math.min(14, expectedInterval * 0.5));
  } else if (overdueDays > 0) {
    // Mildly overdue - expect soon
    return Math.max(1, Math.min(7, expectedInterval - overdueDays));
  } else {
    // Not yet due
    return expectedInterval;
  }
}

/**
 * Calculate confidence in revisit prediction
 */
function calculateConfidence(user: IUserProfile): number {
  let confidence = 0.5;

  // More historical orders = more confidence
  if (user.totalOrders >= 10) {
    confidence += 0.25;
  } else if (user.totalOrders >= 5) {
    confidence += 0.15;
  } else if (user.totalOrders >= 3) {
    confidence += 0.10;
  }

  // Consistent order frequency = more confidence
  if (user.ordersPerMonth > 0) {
    confidence += 0.10;
  }

  // Recent activity = more confidence
  const daysSinceLastOrder = getDaysSinceLastOrder(user);
  if (daysSinceLastOrder <= 30) {
    confidence += 0.10;
  } else if (daysSinceLastOrder <= 90) {
    confidence += 0.05;
  }

  // Engagement data available
  if (user.loginFrequency > 0) {
    confidence += 0.05;
  }

  return Math.min(0.9, Math.max(0.4, confidence));
}

/**
 * Generate suggested actions for engagement
 */
function suggestActions(
  user: IUserProfile,
  daysUntilVisit: number
): string[] {
  const actions: string[] = [];

  // Time-based actions
  if (daysUntilVisit <= 3) {
    actions.push('Send urgent reminder - expected visit imminent');
    actions.push('Offer time-limited discount');
  } else if (daysUntilVisit <= 7) {
    actions.push('Send gentle reminder');
    actions.push('Highlight new products');
  } else if (daysUntilVisit <= 14) {
    actions.push('Send personalized recommendations');
    actions.push('Re-engage with abandoned cart items');
  } else {
    actions.push('Send win-back campaign');
    actions.push('Offer special re-engagement incentive');
  }

  // Category-based actions
  if (user.preferredCategories && user.preferredCategories.length > 0) {
    actions.push(`Show new items in ${user.preferredCategories[0]}`);
  }

  // Engagement-based actions
  if (user.engagementScore < 50) {
    actions.push('Focus on re-engagement content');
  }

  // Loyalty-based actions
  if (user.loyaltyPoints !== undefined && user.loyaltyPoints > 500) {
    actions.push('Remind about expiring loyalty points');
  }

  return actions;
}

/**
 * Generate detailed factors
 */
function generateFactors(user: IUserProfile): Factor[] {
  const factors: Factor[] = [];
  const daysSinceLastOrder = getDaysSinceLastOrder(user);

  factors.push({
    name: 'Days Since Last Order',
    impact: daysSinceLastOrder > 30 ? -0.5 : 0.2,
    value: daysSinceLastOrder,
    description: `Last order ${daysSinceLastOrder} days ago`
  });

  factors.push({
    name: 'Order Frequency',
    impact: user.ordersPerMonth >= 2 ? 0.4 : user.ordersPerMonth >= 1 ? 0.1 : -0.3,
    value: user.ordersPerMonth,
    description: `${user.ordersPerMonth.toFixed(1)} orders/month`
  });

  factors.push({
    name: 'Total Orders',
    impact: user.totalOrders >= 5 ? 0.3 : user.totalOrders >= 2 ? 0 : -0.2,
    value: user.totalOrders,
    description: `${user.totalOrders} lifetime orders`
  });

  factors.push({
    name: 'Engagement Score',
    impact: (user.engagementScore - 50) / 100,
    value: user.engagementScore,
    description: `Engagement: ${user.engagementScore}/100`
  });

  factors.push({
    name: 'Login Frequency',
    impact: user.loginFrequency >= 5 ? 0.2 : user.loginFrequency >= 2 ? 0 : -0.2,
    value: user.loginFrequency,
    description: `${user.loginFrequency} logins/week`
  });

  if (user.cartAbandonmentRate !== undefined) {
    factors.push({
      name: 'Cart Abandonment',
      impact: user.cartAbandonmentRate > 0.5 ? -0.3 : 0.1,
      value: `${(user.cartAbandonmentRate * 100).toFixed(1)}%`,
      description: `${(user.cartAbandonmentRate * 100).toFixed(1)}% cart abandonment rate`
    });
  }

  if (user.emailOpenRate !== undefined) {
    factors.push({
      name: 'Email Engagement',
      impact: user.emailOpenRate > 0.4 ? 0.2 : -0.1,
      value: `${(user.emailOpenRate * 100).toFixed(1)}%`,
      description: `${(user.emailOpenRate * 100).toFixed(1)}% email open rate`
    });
  }

  return factors;
}

/**
 * Generate recommendation
 */
function generateRecommendation(daysUntilVisit: number, visitProbability: number): string {
  if (daysUntilVisit <= 3 && visitProbability >= 0.7) {
    return 'User expected to return very soon. Prepare personalized experience and ensure product availability.';
  } else if (daysUntilVisit <= 7) {
    return 'Send targeted reminder within 24-48 hours to encourage visit.';
  } else if (daysUntilVisit <= 14) {
    return 'Plan re-engagement campaign. Consider offering incentive to accelerate return.';
  } else {
    return 'User at risk of churn. Launch aggressive win-back campaign with strong incentives.';
  }
}

/**
 * Main revisit prediction function
 */
export async function predictRevisit(userId: string): Promise<RevisitPrediction> {
  const startTime = Date.now();

  try {
    const user = await UserProfile.findOne({ userId });

    if (!user) {
      return createDefaultRevisitPrediction(userId);
    }

    const visitProbability = calculateVisitProbability(user);
    const daysUntilVisit = predictDaysUntilNextVisit(user);
    const predictedVisitDate = new Date();
    predictedVisitDate.setDate(predictedVisitDate.getDate() + daysUntilVisit);

    // Calculate engagement window
    const engagementStart = new Date(predictedVisitDate);
    engagementStart.setHours(engagementStart.getHours() - ENGAGEMENT_WINDOW.BEFORE_VISIT_HOURS * 24);
    const engagementEnd = new Date(predictedVisitDate);
    engagementEnd.setHours(engagementEnd.getHours() + ENGAGEMENT_WINDOW.AFTER_VISIT_HOURS * 24);

    const result: RevisitPredictionResult = {
      daysUntilNextVisit: daysUntilVisit,
      predictedVisitDate,
      visitProbability,
      optimalEngagementWindow: {
        start: engagementStart,
        end: engagementEnd
      },
      suggestedActions: suggestActions(user, daysUntilVisit)
    };

    const confidence = calculateConfidence(user);

    const prediction: RevisitPrediction = {
      userId,
      type: 'revisit',
      score: Math.round(visitProbability * 100),
      probability: visitProbability,
      confidence,
      factors: generateFactors(user),
      recommendation: generateRecommendation(daysUntilVisit, visitProbability),
      timestamp: new Date(),
      result
    };

    const durationMs = Date.now() - startTime;
    logger.logPrediction(userId, 'revisit', prediction.score, confidence, durationMs);

    return prediction;
  } catch (error) {
    logger.logError('predictRevisit', error, { userId });
    throw error;
  }
}

/**
 * Create default prediction for unknown users
 */
function createDefaultRevisitPrediction(userId: string): RevisitPrediction {
  return {
    userId,
    type: 'revisit',
    score: 50,
    probability: 0.5,
    confidence: 0.3,
    factors: [
      {
        name: 'Unknown User',
        impact: 0,
        value: 'User not found',
        description: 'No historical data available'
      }
    ],
    recommendation: 'Collect more user data to generate accurate revisit predictions.',
    timestamp: new Date(),
    result: {
      daysUntilNextVisit: 14,
      predictedVisitDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      visitProbability: 0.5,
      optimalEngagementWindow: {
        start: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
        end: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000)
      },
      suggestedActions: ['Welcome campaign for new user']
    }
  };
}

/**
 * Predict revisit from user profile
 */
export function predictRevisitFromProfile(user: IUserProfile): RevisitPrediction {
  const visitProbability = calculateVisitProbability(user);
  const daysUntilVisit = predictDaysUntilNextVisit(user);
  const predictedVisitDate = new Date();
  predictedVisitDate.setDate(predictedVisitDate.getDate() + daysUntilVisit);

  const engagementStart = new Date(predictedVisitDate);
  engagementStart.setHours(engagementStart.getHours() - ENGAGEMENT_WINDOW.BEFORE_VISIT_HOURS * 24);
  const engagementEnd = new Date(predictedVisitDate);
  engagementEnd.setHours(engagementEnd.getHours() + ENGAGEMENT_WINDOW.AFTER_VISIT_HOURS * 24);

  const result: RevisitPredictionResult = {
    daysUntilNextVisit: daysUntilVisit,
    predictedVisitDate,
    visitProbability,
    optimalEngagementWindow: {
      start: engagementStart,
      end: engagementEnd
    },
    suggestedActions: suggestActions(user, daysUntilVisit)
  };

  const confidence = calculateConfidence(user);

  return {
    userId: user.userId,
    type: 'revisit',
    score: Math.round(visitProbability * 100),
    probability: visitProbability,
    confidence,
    factors: generateFactors(user),
    recommendation: generateRecommendation(daysUntilVisit, visitProbability),
    timestamp: new Date(),
    result
  };
}
