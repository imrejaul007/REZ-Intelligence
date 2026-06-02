// ReZ Score Service Types

export enum ScoreTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
  DIAMOND = 'DIAMOND',
  REZ_ELITE = 'REZ_ELITE',
}

export interface TierThresholds {
  min: number;
  max: number;
  tier: ScoreTier;
}

export const TIER_THRESHOLDS: TierThresholds[] = [
  { min: 0, max: 199, tier: ScoreTier.BRONZE },
  { min: 200, max: 399, tier: ScoreTier.SILVER },
  { min: 400, max: 599, tier: ScoreTier.GOLD },
  { min: 600, max: 799, tier: ScoreTier.PLATINUM },
  { min: 800, max: 899, tier: ScoreTier.DIAMOND },
  { min: 900, max: Infinity, tier: ScoreTier.REZ_ELITE },
];

export interface EngagementMetrics {
  visits: number;
  frequency: number; // visits per week
  featuresUsed: string[];
  sessions: number;
  lastActiveAt: Date;
}

export interface SpendingMetrics {
  averageOrderValue: number;
  monthlySpending: number;
  lifetimeValue: number;
  redemptions: number;
  lastPurchaseAt: Date;
}

export interface KarmaMetrics {
  karmaScore: number;
  karmaLevel: number;
  hoursContributed: number;
  impactScore: number;
}

export interface SocialMetrics {
  referrals: number;
  shares: number;
  rendeZCount: number;
  socialScore: number;
}

export interface ScoreBreakdown {
  engagement: {
    score: number;
    weight: number;
    maxScore: number;
    metrics: EngagementMetrics;
  };
  spending: {
    score: number;
    weight: number;
    maxScore: number;
    metrics: SpendingMetrics;
  };
  karma: {
    score: number;
    weight: number;
    maxScore: number;
    metrics: KarmaMetrics;
  };
  social: {
    score: number;
    weight: number;
    maxScore: number;
    metrics: SocialMetrics;
  };
  streakBonus: number;
  totalScore: number;
  tier: ScoreTier;
  tierProgress: {
    currentMin: number;
    nextTier: ScoreTier | null;
    pointsToNextTier: number;
  };
}

export interface UserScoreData {
  userId: string;
  city?: string;
  cityId?: string;
  engagement: EngagementMetrics;
  spending: SpendingMetrics;
  karma: KarmaMetrics;
  social: SocialMetrics;
  streakDays: number;
  currentStreak: number;
  longestStreak: number;
  lastScoreUpdate?: Date;
}

export interface ScoreJobData {
  userId: string;
  eventType: string;
  eventData?: Record<string, unknown>;
  timestamp: Date;
}

export type LeaderboardType = 'city' | 'weekly' | 'monthly';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  score: number;
  tier: ScoreTier;
  city?: string;
}

export interface ScoreHistoryEntry {
  date: Date;
  totalScore: number;
  breakdown: {
    engagement: number;
    spending: number;
    karma: number;
    social: number;
    streakBonus: number;
  };
  tier: ScoreTier;
  event?: string;
}
