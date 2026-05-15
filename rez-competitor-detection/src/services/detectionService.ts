import {
  SwitchSignal,
  DetectionInput,
  Severity,
  SignalType,
  Channel,
  Timing
} from '../types/index';

/**
 * Detection Service - Identifies competitor switching signals
 */

// Signal thresholds
const THRESHOLDS = {
  priceAlert: {
    competitorPriceViews: 5,
    highSeverity: 10
  },
  reviewDrop: {
    mild: -0.3,
    medium: -0.5,
    severe: -1.0
  },
  loyaltyScore: {
    loyal: 70,
    atRisk: 40,
    critical: 20
  },
  competitorShare: {
    low: 20,
    medium: 50,
    high: 70
  }
};

/**
 * Detect competitor switcher signals from user profile
 */
export function detectCompetitorSwitcher(input: DetectionInput): SwitchSignal[] {
  const signals: SwitchSignal[] = [];

  // Price sensitivity signal
  if (input.viewedCompetitorPrices > 0) {
    const severity: Severity = input.viewedCompetitorPrices >= THRESHOLDS.priceAlert.highSeverity
      ? 'high'
      : input.viewedCompetitorPrices >= THRESHOLDS.priceAlert.competitorPriceViews
        ? 'medium'
        : 'low';

    signals.push({
      type: 'price_alert',
      severity,
      timestamp: new Date(),
      description: `User viewed ${input.viewedCompetitorPrices} competitor prices`
    });
  }

  // Review drop signal
  if (input.ratingTrend < THRESHOLDS.reviewDrop.mild) {
    const severity: Severity = input.ratingTrend < THRESHOLDS.reviewDrop.severe
      ? 'high'
      : input.ratingTrend < THRESHOLDS.reviewDrop.medium
        ? 'medium'
        : 'low';

    signals.push({
      type: 'review_drop',
      severity,
      timestamp: new Date(),
      description: `User rating trend dropped by ${input.ratingTrend} stars`
    });
  }

  // New competitor signal
  if (input.visitsToNewCompetitor > 0) {
    signals.push({
      type: 'new_competitor',
      severity: 'high',
      timestamp: new Date(),
      description: `User visited ${input.visitsToNewCompetitor} new competitor(s)`
    });
  }

  // Competitor share analysis
  const competitorShare = input.totalSpending > 0
    ? (input.competitorSpending / input.totalSpending) * 100
    : 0;

  if (competitorShare > THRESHOLDS.competitorShare.high) {
    signals.push({
      type: 'offer_expired',
      severity: 'high',
      timestamp: new Date(),
      description: `High competitor spending: ${competitorShare.toFixed(1)}% of total spend`
    });
  } else if (competitorShare > THRESHOLDS.competitorShare.medium) {
    signals.push({
      type: 'offer_expired',
      severity: 'medium',
      timestamp: new Date(),
      description: `Moderate competitor spending: ${competitorShare.toFixed(1)}% of total spend`
    });
  }

  // Inactivity signal - user hasn't ordered recently
  const daysSinceLastOrder = input.lastOrderDate
    ? Math.floor((Date.now() - new Date(input.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  if (daysSinceLastOrder > 14) {
    signals.push({
      type: 'poor_experience',
      severity: daysSinceLastOrder > 30 ? 'high' : 'medium',
      timestamp: new Date(),
      description: `No orders in ${daysSinceLastOrder} days - potential churn`
    });
  }

  return signals;
}

/**
 * Calculate loyalty score based on various factors
 */
export function calculateLoyaltyScore(input: DetectionInput): number {
  let score = 50; // Base score

  // Positive factors
  const orderFrequencyScore = Math.min(20, input.orderFrequency * 2);
  const averageOrderScore = input.averageOrderValue > 500 ? 15 : input.averageOrderValue > 200 ? 10 : 5;
  const recentOrderScore = input.lastOrderDate &&
    (Date.now() - new Date(input.lastOrderDate).getTime()) < 7 * 24 * 60 * 60 * 1000 ? 15 : 0;

  // Negative factors
  const competitorShare = input.totalSpending > 0
    ? (input.competitorSpending / input.totalSpending) * 100
    : 0;
  const competitorPenalty = Math.min(30, competitorShare * 0.5);
  const priceAlertPenalty = Math.min(15, input.viewedCompetitorPrices * 1.5);
  const newCompetitorPenalty = input.visitsToNewCompetitor * 10;
  const ratingPenalty = input.ratingTrend < 0 ? Math.min(10, Math.abs(input.ratingTrend) * 5) : 0;

  score += orderFrequencyScore + averageOrderScore + recentOrderScore;
  score -= competitorPenalty + priceAlertPenalty + newCompetitorPenalty + ratingPenalty;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate win-back potential score and recommendations
 */
export function calculateWinBackPotential(
  loyaltyScore: number,
  competitorShare: number,
  competitorSpending: number,
  lastCompetitorVisit: Date | null,
  preferredCompetitors: string[]
): {
  score: number;
  tier: 'hot' | 'warm' | 'cold';
  topTrigger: string;
  optimalChannel: Channel;
  optimalTiming: Timing;
  competitorsTargeting: string[];
  estimatedValue: number;
  recommendedOffer: string;
} {
  // Base score calculation
  const baseScore = 100 - loyaltyScore;

  // Recency bonus
  const daysSinceCompetitorVisit = lastCompetitorVisit
    ? Math.floor((Date.now() - new Date(lastCompetitorVisit).getTime()) / (1000 * 60 * 60 * 24))
    : 999;
  const recencyBonus = daysSinceCompetitorVisit < 7 ? 20 : daysSinceCompetitorVisit < 14 ? 10 : 0;

  // Spending bonus
  const spendingBonus = competitorSpending > 1000 ? 15 : competitorSpending > 500 ? 10 : 0;

  // Competitor share bonus
  const shareBonus = competitorShare > 50 ? 10 : competitorShare > 30 ? 5 : 0;

  const totalScore = Math.min(100, baseScore + recencyBonus + spendingBonus + shareBonus);

  // Determine tier
  const tier: 'hot' | 'warm' | 'cold' =
    totalScore >= 70 ? 'hot' : totalScore >= 40 ? 'warm' : 'cold';

  // Determine best offer trigger
  const topTrigger = determineBestOffer(
    loyaltyScore,
    competitorShare,
    competitorSpending,
    preferredCompetitors
  );

  // Determine best channel
  const optimalChannel = determineBestChannel(competitorSpending, competitorShare);

  // Determine best timing
  const optimalTiming = determineBestTiming(daysSinceCompetitorVisit, loyaltyScore);

  // Determine competitors targeting this user
  const competitorsTargeting = preferredCompetitors.length > 0
    ? preferredCompetitors
    : ['swiggy', 'zomato'];

  // Estimate value
  const estimatedValue = competitorSpending * 4; // Assume 4x LTV potential

  // Generate offer recommendation
  const recommendedOffer = generateOfferRecommendation(tier, competitorSpending);

  return {
    score: Math.round(totalScore),
    tier,
    topTrigger,
    optimalChannel,
    optimalTiming,
    competitorsTargeting,
    estimatedValue: Math.round(estimatedValue),
    recommendedOffer
  };
}

/**
 * Determine the best offer to win back the user
 */
function determineBestOffer(
  loyaltyScore: number,
  competitorShare: number,
  competitorSpending: number,
  preferredCompetitors: string[]
): string {
  if (loyaltyScore < 20) {
    return 'heavy_discount'; // 30-50% off to regain attention
  }

  if (competitorShare > 50) {
    return 'price_match'; // Match competitor pricing
  }

  if (competitorSpending > 500) {
    return 'free_delivery'; // Free delivery for high spenders
  }

  if (preferredCompetitors.length > 0) {
    return 'loyalty_bonus'; // Bonus points/rewards
  }

  return 'welcome_back'; // Standard welcome back offer
}

/**
 * Determine the best channel to reach the user
 */
function determineBestChannel(competitorSpending: number, competitorShare: number): Channel {
  if (competitorShare > 50 || competitorSpending > 1000) {
    return 'whatsapp'; // Personal outreach for high-value at-risk users
  }

  if (competitorSpending > 500) {
    return 'push'; // Push notifications for medium spenders
  }

  return 'sms'; // SMS for others
}

/**
 * Determine the best timing to reach out
 */
function determineBestTiming(daysSinceCompetitorVisit: number, loyaltyScore: number): Timing {
  if (daysSinceCompetitorVisit < 3) {
    return 'immediate'; // Reach out immediately when they're still with competitor
  }

  if (loyaltyScore < 30) {
    return 'weekend'; // Weekends for disengaged users
  }

  return 'evening'; // Evening for moderate risk users
}

/**
 * Generate a specific offer recommendation
 */
function generateOfferRecommendation(tier: 'hot' | 'warm' | 'cold', competitorSpending: number): string {
  const offers = {
    hot: competitorSpending > 500
      ? '50% off your next 3 orders + free delivery'
      : '40% off your next order',
    warm: competitorSpending > 300
      ? '3 months of free delivery subscription + 25% off'
      : '25% off your next 3 orders',
    cold: competitorSpending > 200
      ? 'Welcome back offer: 20% off + 500 bonus points'
      : 'Welcome back: 15% off your next order'
  };

  return offers[tier];
}

/**
 * Calculate risk level based on various signals
 */
export function calculateRiskLevel(
  loyaltyScore: number,
  competitorShare: number,
  signalCount: number,
  daysSinceLastCompetitorVisit: number | null
): 'low' | 'medium' | 'high' | 'critical' {
  let riskScore = 0;

  // Loyalty contribution
  if (loyaltyScore < THRESHOLDS.loyaltyScore.critical) riskScore += 4;
  else if (loyaltyScore < THRESHOLDS.loyaltyScore.atRisk) riskScore += 3;
  else if (loyaltyScore < THRESHOLDS.loyaltyScore.loyal) riskScore += 1;

  // Competitor share contribution
  if (competitorShare > THRESHOLDS.competitorShare.high) riskScore += 3;
  else if (competitorShare > THRESHOLDS.competitorShare.medium) riskScore += 2;
  else if (competitorShare > THRESHOLDS.competitorShare.low) riskScore += 1;

  // Signal count contribution
  if (signalCount > 5) riskScore += 3;
  else if (signalCount > 3) riskScore += 2;
  else if (signalCount > 1) riskScore += 1;

  // Recent competitor activity
  if (daysSinceLastCompetitorVisit !== null && daysSinceLastCompetitorVisit < 7) {
    riskScore += 2;
  }

  // Determine risk level
  if (riskScore >= 8) return 'critical';
  if (riskScore >= 6) return 'high';
  if (riskScore >= 3) return 'medium';
  return 'low';
}

/**
 * Get days since last competitor visit
 */
export function getDaysSinceCompetitorVisit(lastVisit: Date | null): number {
  if (!lastVisit) return 999;
  return Math.floor((Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24));
}
