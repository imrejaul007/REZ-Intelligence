import { InfluenceScore, CommunityRoleData, ShareChannel, IShareEvent, IReferralEvent } from '../types';

/**
 * Influence Calculator Service
 * Calculates influence scores based on social signals
 */

export interface InfluenceCalculationInput {
  totalImpressions: number;
  clickCount: number;
  shareCount: number;
  conversionCount: number;
  revenue: number;
  uniqueRecipients: number;
  avgCTR?: number;
  recentShares?: IShareEvent[];
  timeWindowDays?: number;
}

export interface CommunityRoleInput {
  eventsOrganized: number;
  groupsCreated: number;
  groupsJoined: number;
  postsCount: number;
  commentsCount: number;
  reactionsCount: number;
  isModerator: boolean;
  moderatorCommunities?: string[];
}

/**
 * Calculate influence score (0-100) based on social signals
 * Uses weighted combination of reach, engagement, and conversion
 */
export function calculateInfluenceScore(input: InfluenceCalculationInput): InfluenceScore {
  const {
    totalImpressions,
    clickCount,
    shareCount,
    conversionCount,
    revenue,
    uniqueRecipients,
    recentShares = [],
    timeWindowDays = 30
  } = input;

  // Reach Score (30% weight) - based on total impressions
  // Normalized to 100 based on benchmark: 10k impressions = 50 score
  const reachScore = Math.min(100, (totalImpressions / 10000) * 50 + (uniqueRecipients / 1000) * 10);

  // Engagement Score (30% weight) - based on click-through rate
  // CTR = clicks / impressions
  const ctr = totalImpressions > 0 ? (clickCount / totalImpressions) * 100 : 0;
  const engagementScore = Math.min(100, ctr * 10); // 10% CTR = 100 score

  // Conversion Score (40% weight) - based on attributed conversions and revenue
  const conversionRate = uniqueRecipients > 0 ? (conversionCount / uniqueRecipients) * 100 : 0;
  const avgRevenuePerConversion = conversionCount > 0 ? revenue / conversionCount : 0;

  // Revenue normalization: $100 avg = good conversion
  const revenueFactor = Math.min(100, (avgRevenuePerConversion / 100) * 50);
  const conversionScore = Math.min(100, conversionRate * 5 + revenueFactor * 0.5);

  // Calculate trending score based on recent activity
  const trendingScore = calculateTrendingScore(recentShares, timeWindowDays);

  // Weighted total
  const total = (reachScore * 0.30) + (engagementScore * 0.30) + (conversionScore * 0.40);

  // Determine tier based on total score and absolute metrics
  const tier = determineInfluenceTier(total, totalImpressions, conversionCount, revenue);

  return {
    total: Math.round(Math.min(100, total)),
    reachScore: Math.round(reachScore),
    engagementScore: Math.round(engagementScore),
    conversionScore: Math.round(conversionScore),
    tier,
    trendingScore: Math.round(trendingScore)
  };
}

/**
 * Determine influence tier based on score and absolute metrics
 */
function determineInfluenceTier(
  score: number,
  impressions: number,
  conversions: number,
  revenue: number
): InfluenceScore['tier'] {
  // Macro: Top performers with high absolute numbers
  if (score >= 80 || (impressions >= 100000 && conversions >= 100 && revenue >= 10000)) {
    return 'macro';
  }
  // Mid-tier: Good performance
  if (score >= 50 || (impressions >= 10000 && conversions >= 20 && revenue >= 2000)) {
    return 'mid';
  }
  // Micro: Active but smaller scale
  if (score >= 20 || (impressions >= 1000 && conversions >= 5)) {
    return 'micro';
  }
  // Nano: Minimal but detectable influence
  if (score >= 5 || impressions >= 100) {
    return 'nano';
  }
  // None: No significant influence detected
  return 'none';
}

/**
 * Calculate trending score based on recent share velocity
 */
function calculateTrendingScore(shares: IShareEvent[], timeWindowDays: number): number {
  if (shares.length === 0) return 0;

  const now = new Date();
  const windowStart = new Date(now.getTime() - timeWindowDays * 24 * 60 * 60 * 1000);

  const recentShares = shares.filter(s => s.timestamp >= windowStart);

  // Velocity factor: shares per day
  const sharesPerDay = recentShares.length / timeWindowDays;

  // Viral factor: avg conversions per share
  const avgConversionsPerShare = recentShares.length > 0
    ? recentShares.reduce((sum, s) => sum + s.conversionCount, 0) / recentShares.length
    : 0;

  // Trend factor: comparing recent to overall
  const growthFactor = recentShares.length > 0 ? 1.5 : 1;

  // Combine factors into 0-100 score
  const velocityScore = Math.min(100, sharesPerDay * 20);
  const viralScore = Math.min(100, avgConversionsPerShare * 50);
  const trendingScore = (velocityScore + viralScore) * growthFactor;

  return Math.min(100, trendingScore);
}

/**
 * Detect community organizer based on activity patterns
 */
export function detectCommunityOrganizer(input: CommunityRoleInput): CommunityRoleData {
  const {
    eventsOrganized,
    groupsCreated,
    groupsJoined,
    postsCount,
    commentsCount,
    reactionsCount,
    isModerator,
    moderatorCommunities = []
  } = input;

  // Calculate organizer score
  const score = (
    eventsOrganized * 5 +        // 5 points per event organized
    groupsCreated * 3 +          // 3 points per group created
    groupsJoined * 0.5 +          // 0.5 points per group joined
    postsCount * 0.3 +            // 0.3 points per post
    commentsCount * 0.2 +        // 0.2 points per comment
    reactionsCount * 0.1 +       // 0.1 points per reaction
    (isModerator ? 20 : 0)       // 20 bonus for moderator status
  );

  // Calculate community engagement (0-100)
  const totalActivity = postsCount + commentsCount + reactionsCount;
  const engagementScore = Math.min(100, totalActivity / 10); // 1000+ interactions = 100 score

  // Determine role based on score
  let role: CommunityRoleData['role'];
  if (score > 50 || isModerator) {
    role = 'organizer';
  } else if (score > 20 || totalActivity > 50) {
    role = 'active_member';
  } else if (score > 5 || totalActivity > 10) {
    role = 'lurker';
  } else {
    role = 'none';
  }

  return {
    role,
    groupsJoined,
    groupsCreated,
    eventsOrganized,
    eventsAttended: 0, // Would be populated from events service
    communityEngagement: Math.round(engagementScore),
    moderatorOf: isModerator ? moderatorCommunities : undefined
  };
}

/**
 * Calculate sharing behavior metrics
 */
export interface SharingBehaviorInput {
  shareEvents: IShareEvent[];
  totalOffers: number;
  timeWindowDays?: number;
}

export interface SharingBehaviorOutput {
  frequency: number;           // Shares per month
  avgReach: number;             // Average impressions per share
  shareRate: number;           // % of offers shared (0-1)
  preferredChannels: ShareChannel[];
  viralCoefficient: number;    // Conversions per share (0-1)
  topSharedCategories: string[];
}

export function calculateSharingBehavior(input: SharingBehaviorInput): SharingBehaviorOutput {
  const { shareEvents, totalOffers, timeWindowDays = 30 } = input;

  const now = new Date();
  const windowStart = new Date(now.getTime() - timeWindowDays * 24 * 60 * 60 * 1000);

  const recentShares = shareEvents.filter(s => s.timestamp >= windowStart);

  // Frequency: shares per month
  const daysInPeriod = timeWindowDays;
  const frequency = (recentShares.length / daysInPeriod) * 30;

  // Average reach per share
  const avgReach = recentShares.length > 0
    ? recentShares.reduce((sum, s) => sum + s.recipientCount, 0) / recentShares.length
    : 0;

  // Share rate: % of offers shared
  const shareRate = totalOffers > 0 ? recentShares.length / totalOffers : 0;

  // Preferred channels based on frequency
  const channelCounts: Record<string, number> = {};
  recentShares.forEach(share => {
    channelCounts[share.channel] = (channelCounts[share.channel] || 0) + 1;
  });

  const preferredChannels = Object.entries(channelCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([channel]) => channel as ShareChannel);

  // Viral coefficient: conversions per share
  const totalConversions = recentShares.reduce((sum, s) => sum + s.conversionCount, 0);
  const viralCoefficient = recentShares.length > 0
    ? totalConversions / recentShares.length
    : 0;

  // Top shared categories
  const categoryCounts: Record<string, number> = {};
  recentShares.forEach(share => {
    const category = share.contentType;
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  });

  const topSharedCategories = Object.entries(categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category]) => category);

  return {
    frequency: Math.round(frequency * 10) / 10,
    avgReach: Math.round(avgReach),
    shareRate: Math.min(1, shareRate),
    preferredChannels: preferredChannels.length > 0 ? preferredChannels : ['link'],
    viralCoefficient: Math.min(1, viralCoefficient),
    topSharedCategories
  };
}

/**
 * Calculate social reach metrics
 */
export function calculateSocialReach(shareEvents: IShareEvent[]): {
  totalImpressions: number;
  uniqueRecipients: number;
  whatsappReach: number;
  instagramReach: number;
  facebookReach: number;
  twitterReach: number;
  linkReach: number;
  estimatedAudience: number;
  reachByCategory: Record<string, number>;
} {
  const reach = {
    totalImpressions: 0,
    uniqueRecipients: 0,
    whatsappReach: 0,
    instagramReach: 0,
    facebookReach: 0,
    twitterReach: 0,
    linkReach: 0,
    estimatedAudience: 0,
    reachByCategory: {} as Record<string, number>
  };

  const recipientSets: Map<ShareChannel, Set<string>> = new Map();

  shareEvents.forEach(share => {
    reach.totalImpressions += share.recipientCount;

    // Track unique recipients per channel
    if (!recipientSets.has(share.channel)) {
      recipientSets.set(share.channel, new Set());
    }

    // Increment channel-specific reach
    switch (share.channel) {
      case 'whatsapp':
        reach.whatsappReach += share.recipientCount;
        break;
      case 'instagram':
        reach.instagramReach += share.recipientCount;
        break;
      case 'facebook':
        reach.facebookReach += share.recipientCount;
        break;
      case 'twitter':
        reach.twitterReach += share.recipientCount;
        break;
      case 'link':
        reach.linkReach += share.recipientCount;
        break;
    }

    // Category-based reach
    const category = share.contentType;
    reach.reachByCategory[category] = (reach.reachByCategory[category] || 0) + share.recipientCount;
  });

  // Calculate unique recipients (union of all channels)
  const allRecipients = new Set<string>();
  recipientSets.forEach(set => {
    set.forEach(recipient => allRecipients.add(recipient));
  });
  reach.uniqueRecipients = allRecipients.size || shareEvents.reduce((sum, s) => sum + s.recipientCount, 0);

  // Estimated audience (considering overlaps, roughly 70% of total)
  reach.estimatedAudience = Math.round(reach.totalImpressions * 0.7);

  return reach;
}

/**
 * Calculate referral metrics
 */
export function calculateReferralMetrics(referralEvents: IReferralEvent[]): {
  totalReferrals: number;
  pendingReferrals: number;
  successfulReferrals: number;
  conversionRate: number;
  avgOrderValueFromReferrals: number;
  referralRevenue: number;
  referralLTV: number;
  avgTimeToConversion?: number;
  topReferralCategories?: string[];
} {
  const totalReferrals = referralEvents.length;
  const pendingReferrals = referralEvents.filter(r => r.status === 'pending').length;
  const successfulReferrals = referralEvents.filter(r => r.status === 'converted').length;

  const convertedEvents = referralEvents.filter(r => r.status === 'converted' && r.conversionValue);
  const totalRevenue = convertedEvents.reduce((sum, r) => sum + (r.conversionValue || 0), 0);

  // Calculate average time to conversion
  const eventsWithTime = referralEvents
    .filter(r => r.status === 'converted' && r.timestamp && r.conversionTimestamp)
    .map(r => ({
      time: (r.conversionTimestamp!.getTime() - r.timestamp.getTime()) / (1000 * 60 * 60) // hours
    }));

  const avgTimeToConversion = eventsWithTime.length > 0
    ? eventsWithTime.reduce((sum, e) => sum + e.time, 0) / eventsWithTime.length
    : undefined;

  // Referral LTV: average revenue per successful referral
  const referralLTV = successfulReferrals > 0 ? totalRevenue / successfulReferrals : 0;

  return {
    totalReferrals,
    pendingReferrals,
    successfulReferrals,
    conversionRate: totalReferrals > 0 ? successfulReferrals / totalReferrals : 0,
    avgOrderValueFromReferrals: successfulReferrals > 0 ? totalRevenue / successfulReferrals : 0,
    referralRevenue: totalRevenue,
    referralLTV: Math.round(referralLTV * 100) / 100,
    avgTimeToConversion: avgTimeToConversion ? Math.round(avgTimeToConversion * 10) / 10 : undefined
  };
}
