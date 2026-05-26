import { UserProfile, IUserProfile } from '../models/userProfile';
import {
  Factor,
  ConversionPrediction,
  ConversionPredictionResult
} from '../types';
import logger from '../utils/logger.js';

// Funnel stages
type FunnelStage = 'awareness' | 'interest' | 'consideration' | 'intent' | 'purchase';

// Stage score thresholds
const STAGE_THRESHOLDS = {
  awareness: 20,
  interest: 35,
  consideration: 50,
  intent: 70,
  purchase: 85
};

// Time to conversion estimates (days) by engagement level
const TIME_TO_CONVERSION = {
  very_high: 3,   // Already highly engaged
  high: 7,        // High engagement
  medium: 14,     // Moderate engagement
  low: 30,        // Low engagement
  very_low: 60    // Minimal engagement
};

/**
 * Determine funnel stage based on score
 */
function determineFunnelStage(score: number): FunnelStage {
  if (score >= STAGE_THRESHOLDS.purchase) return 'purchase';
  if (score >= STAGE_THRESHOLDS.intent) return 'intent';
  if (score >= STAGE_THRESHOLDS.consideration) return 'consideration';
  if (score >= STAGE_THRESHOLDS.interest) return 'interest';
  return 'awareness';
}

/**
 * Calculate conversion probability based on user behavior
 */
function calculateConversionProbability(user: IUserProfile): number {
  let probability = 0.3; // Base probability for any user

  // Adjust based on account engagement
  if (user.engagementScore >= 80) {
    probability += 0.35;
  } else if (user.engagementScore >= 60) {
    probability += 0.20;
  } else if (user.engagementScore >= 40) {
    probability += 0.10;
  } else if (user.engagementScore < 20) {
    probability -= 0.15;
  }

  // Adjust based on login frequency
  if (user.loginFrequency >= 10) {
    probability += 0.15;
  } else if (user.loginFrequency >= 5) {
    probability += 0.08;
  } else if (user.loginFrequency >= 2) {
    probability += 0.03;
  } else if (user.loginFrequency === 0) {
    probability -= 0.10;
  }

  // Adjust based on cart abandonment (potential purchase intent)
  if (user.cartAbandonmentRate !== undefined) {
    if (user.cartAbandonmentRate > 0) {
      // Has abandoned carts - shows intent
      probability += 0.15;
    }
  }

  // Adjust based on email engagement
  if (user.emailOpenRate !== undefined) {
    if (user.emailOpenRate >= 0.6) {
      probability += 0.10;
    } else if (user.emailOpenRate >= 0.3) {
      probability += 0.05;
    } else if (user.emailOpenRate < 0.1) {
      probability -= 0.05;
    }
  }

  // Adjust based on push notification engagement
  if (user.pushNotificationClickRate !== undefined) {
    if (user.pushNotificationClickRate >= 0.3) {
      probability += 0.08;
    } else if (user.pushNotificationClickRate >= 0.1) {
      probability += 0.03;
    }
  }

  // Adjust based on account verification
  if (user.isEmailVerified && user.isPhoneVerified) {
    probability += 0.08;
  } else if (user.isEmailVerified || user.isPhoneVerified) {
    probability += 0.03;
  }

  // Adjust based on account age (established users more likely to convert)
  if (user.accountAge >= 90) {
    probability += 0.05;
  } else if (user.accountAge < 7) {
    probability -= 0.05;
  }

  // Adjust based on previous purchase history
  if (user.totalOrders > 0) {
    probability += 0.10;
  }

  return Math.min(0.95, Math.max(0.05, probability));
}

/**
 * Estimate time to conversion
 */
function estimateTimeToConversion(user: IUserProfile): number {
  let baseTime: number;

  if (user.engagementScore >= 70) {
    baseTime = TIME_TO_CONVERSION.very_high;
  } else if (user.engagementScore >= 50) {
    baseTime = TIME_TO_CONVERSION.high;
  } else if (user.engagementScore >= 30) {
    baseTime = TIME_TO_CONVERSION.medium;
  } else if (user.engagementScore >= 10) {
    baseTime = TIME_TO_CONVERSION.low;
  } else {
    baseTime = TIME_TO_CONVERSION.very_low;
  }

  // Adjust based on cart abandonment
  if (user.cartAbandonmentRate !== undefined && user.cartAbandonmentRate > 0) {
    baseTime = Math.min(baseTime, 3); // Cart abandonment suggests imminent intent
  }

  // Adjust based on engagement frequency
  if (user.loginFrequency >= 10) {
    baseTime = Math.min(baseTime, 3);
  } else if (user.loginFrequency >= 5) {
    baseTime = Math.min(baseTime, 7);
  }

  return baseTime;
}

/**
 * Identify barriers to conversion
 */
function identifyBarriers(user: IUserProfile): string[] {
  const barriers: string[] = [];

  // Low engagement barriers
  if (user.engagementScore < 30) {
    barriers.push('Low engagement with the platform');
  }

  // Rare login barriers
  if (user.loginFrequency < 2) {
    barriers.push('Infrequent platform visits');
  }

  // Cart abandonment barriers
  if (user.cartAbandonmentRate !== undefined) {
    if (user.cartAbandonmentRate > 0.8) {
      barriers.push('High cart abandonment rate');
    }
  }

  // Email engagement barriers
  if (user.emailOpenRate !== undefined) {
    if (user.emailOpenRate < 0.2) {
      barriers.push('Low email engagement');
    }
  }

  // Verification barriers
  if (!user.isEmailVerified) {
    barriers.push('Email not verified');
  }
  if (!user.isPhoneVerified) {
    barriers.push('Phone not verified');
  }

  // Price sensitivity indicators
  if (user.avgOrderValue < 500 && user.totalOrders > 0) {
    barriers.push('Price-sensitive customer');
  }

  // Payment method limitations
  if (!user.preferredPaymentMethods || user.preferredPaymentMethods.length === 0) {
    barriers.push('No saved payment methods');
  }

  return barriers;
}

/**
 * Suggest incentives to overcome barriers
 */
function suggestIncentives(
  user: IUserProfile,
  barriers: string[]
): string[] {
  const incentives: string[] = [];

  // General incentives
  if (barriers.length > 2) {
    incentives.push('First order discount (15% off)');
  } else {
    incentives.push('New user welcome offer (10% off)');
  }

  // For price-sensitive customers
  if (barriers.includes('Price-sensitive customer')) {
    incentives.push('Budget-friendly product recommendations');
    incentives.push('Easy payment plans (EMI options)');
  }

  // For low engagement
  if (barriers.includes('Low engagement with the platform')) {
    incentives.push('Personalized product curation based on browsing');
    incentives.push('Push notification for price drops on wishlist items');
  }

  // For cart abandonment
  if (user.cartAbandonmentRate !== undefined && user.cartAbandonmentRate > 0) {
    incentives.push('Cart abandonment reminder with small incentive');
    incentives.push('Free delivery on cart completion');
  }

  // For unverified accounts
  if (!user.isEmailVerified || !user.isPhoneVerified) {
    incentives.push('Quick signup bonus');
  }

  // For no payment methods
  if (!user.preferredPaymentMethods || user.preferredPaymentMethods.length === 0) {
    incentives.push('Quick checkout setup reward');
    incentives.push('Save card discount');
  }

  // Universal incentive
  incentives.push('Free delivery on first order');

  return [...new Set(incentives)]; // Remove duplicates
}

/**
 * Calculate confidence in conversion prediction
 */
function calculateConfidence(user: IUserProfile): number {
  let confidence = 0.5;

  // Engagement data available
  if (user.loginFrequency > 0) {
    confidence += 0.10;
  }

  // Multiple engagement channels
  let channels = 0;
  if (user.emailOpenRate !== undefined) channels++;
  if (user.pushNotificationClickRate !== undefined) channels++;
  if (user.loginFrequency > 0) channels++;

  if (channels >= 2) {
    confidence += 0.15;
  } else if (channels === 1) {
    confidence += 0.05;
  }

  // Account age
  if (user.accountAge >= 30) {
    confidence += 0.10;
  } else if (user.accountAge >= 7) {
    confidence += 0.05;
  }

  // Verification
  if (user.isEmailVerified && user.isPhoneVerified) {
    confidence += 0.05;
  }

  return Math.min(0.85, Math.max(0.4, confidence));
}

/**
 * Generate detailed factors
 */
function generateFactors(user: IUserProfile): Factor[] {
  const factors: Factor[] = [];

  factors.push({
    name: 'Engagement Score',
    impact: (user.engagementScore - 50) / 100,
    value: user.engagementScore,
    description: `${user.engagementScore}/100`
  });

  factors.push({
    name: 'Login Frequency',
    impact: user.loginFrequency >= 5 ? 0.3 : user.loginFrequency >= 2 ? 0.1 : -0.2,
    value: user.loginFrequency,
    description: `${user.loginFrequency} logins/week`
  });

  factors.push({
    name: 'Account Age',
    impact: user.accountAge >= 30 ? 0.2 : user.accountAge >= 7 ? 0.05 : -0.1,
    value: user.accountAge,
    description: `${user.accountAge} days`
  });

  if (user.cartAbandonmentRate !== undefined) {
    factors.push({
      name: 'Cart Abandonment',
      impact: user.cartAbandonmentRate > 0 ? 0.25 : 0,
      value: `${(user.cartAbandonmentRate * 100).toFixed(1)}%`,
      description: user.cartAbandonmentRate > 0
        ? 'Has abandoned carts (purchase intent)'
        : 'No abandoned carts'
    });
  }

  if (user.emailOpenRate !== undefined) {
    factors.push({
      name: 'Email Open Rate',
      impact: user.emailOpenRate >= 0.3 ? 0.15 : -0.1,
      value: `${(user.emailOpenRate * 100).toFixed(1)}%`,
      description: `${(user.emailOpenRate * 100).toFixed(1)}% open rate`
    });
  }

  factors.push({
    name: 'Account Verification',
    impact: (user.isEmailVerified && user.isPhoneVerified) ? 0.15 :
            (user.isEmailVerified || user.isPhoneVerified) ? 0.05 : -0.1,
    value: user.isEmailVerified && user.isPhoneVerified ? 'Fully Verified' :
           user.isEmailVerified ? 'Email Only' :
           user.isPhoneVerified ? 'Phone Only' : 'Not Verified',
    description: 'Account verification status'
  });

  return factors;
}

/**
 * Generate recommendation
 */
function generateRecommendation(
  stage: FunnelStage,
  probability: number,
  timeToConversion: number
): string {
  switch (stage) {
    case 'purchase':
      return 'User is ready to convert. Send targeted offer with urgency to close.';
    case 'intent':
      return 'High purchase intent. Provide easy path to purchase and address unknown final concerns.';
    case 'consideration':
      return `User is considering. Offer comparison tools and social proof to build confidence.`;
    case 'interest':
      return `User shows interest. Engage with personalized content and product education.`;
    case 'awareness':
      return `User is aware but not engaged. Focus on brand education and value proposition.`;
    default:
      return 'Nurture user through conversion funnel with targeted campaigns.';
  }
}

/**
 * Main conversion prediction function
 */
export async function predictConversion(userId: string): Promise<ConversionPrediction> {
  const startTime = Date.now();

  try {
    const user = await UserProfile.findOne({ userId });

    if (!user) {
      return createDefaultConversionPrediction(userId);
    }

    const conversionProbability = calculateConversionProbability(user);
    const score = Math.round(conversionProbability * 100);
    const stage = determineFunnelStage(score);
    const timeToConversion = estimateTimeToConversion(user);
    const barriers = identifyBarriers(user);
    const incentives = suggestIncentives(user, barriers);

    let predictedConversionDate: Date | undefined;
    if (timeToConversion <= 30) {
      predictedConversionDate = new Date();
      predictedConversionDate.setDate(predictedConversionDate.getDate() + timeToConversion);
    }

    const result: ConversionPredictionResult = {
      conversionProbability,
      predictedConversionDate,
      funnelStage: stage,
      barriers,
      incentives,
      timeToConversion: conversionProbability > 0.5 ? timeToConversion : undefined
    };

    const confidence = calculateConfidence(user);

    const prediction: ConversionPrediction = {
      userId,
      type: 'conversion',
      score,
      probability: conversionProbability,
      confidence,
      factors: generateFactors(user),
      recommendation: generateRecommendation(stage, conversionProbability, timeToConversion),
      timestamp: new Date(),
      result
    };

    const durationMs = Date.now() - startTime;
    logger.logPrediction(userId, 'conversion', score, confidence, durationMs);

    return prediction;
  } catch (error) {
    logger.logError('predictConversion', error, { userId });
    throw error;
  }
}

/**
 * Create default prediction for unknown users
 */
function createDefaultConversionPrediction(userId: string): ConversionPrediction {
  return {
    userId,
    type: 'conversion',
    score: 30,
    probability: 0.3,
    confidence: 0.3,
    factors: [
      {
        name: 'Unknown User',
        impact: 0,
        value: 'User not found',
        description: 'No historical data available'
      }
    ],
    recommendation: 'Treat as new user acquisition opportunity.',
    timestamp: new Date(),
    result: {
      conversionProbability: 0.3,
      funnelStage: 'awareness',
      barriers: ['No user history available'],
      incentives: ['Welcome offer', 'First order discount']
    }
  };
}

/**
 * Predict conversion from user profile
 */
export function predictConversionFromProfile(user: IUserProfile): ConversionPrediction {
  const conversionProbability = calculateConversionProbability(user);
  const score = Math.round(conversionProbability * 100);
  const stage = determineFunnelStage(score);
  const timeToConversion = estimateTimeToConversion(user);
  const barriers = identifyBarriers(user);
  const incentives = suggestIncentives(user, barriers);

  let predictedConversionDate: Date | undefined;
  if (timeToConversion <= 30) {
    predictedConversionDate = new Date();
    predictedConversionDate.setDate(predictedConversionDate.getDate() + timeToConversion);
  }

  const result: ConversionPredictionResult = {
    conversionProbability,
    predictedConversionDate,
    funnelStage: stage,
    barriers,
    incentives,
    timeToConversion: conversionProbability > 0.5 ? timeToConversion : undefined
  };

  const confidence = calculateConfidence(user);

  return {
    userId: user.userId,
    type: 'conversion',
    score,
    probability: conversionProbability,
    confidence,
    factors: generateFactors(user),
    recommendation: generateRecommendation(stage, conversionProbability, timeToConversion),
    timestamp: new Date(),
    result
  };
}
