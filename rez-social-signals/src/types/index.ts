// Social Signal Types for REZ Social Signals Service

export type ShareChannel = 'whatsapp' | 'instagram' | 'facebook' | 'twitter' | 'link' | 'sms' | 'email';
export type InfluenceTier = 'macro' | 'mid' | 'micro' | 'nano' | 'none';
export type CommunityRole = 'organizer' | 'active_member' | 'lurker' | 'none';
export type ContentType = 'offer' | 'deal' | 'product' | 'campaign' | 'store';
export type ReferralStatus = 'pending' | 'converted' | 'expired' | 'cancelled';

export interface SharingBehavior {
  frequency: number;           // Shares per month
  avgReach: number;            // Average impressions per share
  shareRate: number;           // % of offers shared (0-1)
  preferredChannels: ShareChannel[];
  viralCoefficient: number;    // How often shares lead to conversions (0-1)
  topSharedCategories: string[];
  lastShareTimestamp?: Date;
}

export interface InfluenceScore {
  total: number;               // 0-100
  reachScore: number;          // Based on impressions
  engagementScore: number;     // Based on click-through rate
  conversionScore: number;     // Based on attributed purchases
  tier: InfluenceTier;
  followers?: number;
  audienceDemographics?: string[];
  trendingScore?: number;      // How viral recent shares are
}

export interface CommunityRoleData {
  role: CommunityRole;
  groupsJoined: number;
  groupsCreated: number;
  eventsOrganized: number;
  eventsAttended: number;
  communityEngagement: number;  // Comments, reactions, posts (0-100)
  moderatorOf?: string[];      // Community IDs where user is moderator
}

export interface SocialReach {
  totalImpressions: number;
  uniqueRecipients: number;
  whatsappReach: number;
  instagramReach: number;
  facebookReach: number;
  twitterReach: number;
  linkReach: number;
  estimatedAudience: number;
  reachByCategory: Record<string, number>;
  reachGrowthRate?: number;    // MoM growth percentage
}

export interface ReferralMetrics {
  totalReferrals: number;
  pendingReferrals: number;
  successfulReferrals: number;
  conversionRate: number;
  avgOrderValueFromReferrals: number;
  referralRevenue: number;
  referralLTV: number;
  avgTimeToConversion?: number; // Hours
  topReferralCategories?: string[];
}

export interface UserSocialProfile {
  userId: string;
  sharingBehavior: SharingBehavior;
  influenceScore: InfluenceScore;
  communityRole: CommunityRoleData;
  socialReach: SocialReach;
  referralMetrics: ReferralMetrics;
  lastUpdated: Date;
  createdAt: Date;
}

// Event Types
export interface ShareEvent {
  shareId: string;
  userId: string;
  contentType: ContentType;
  contentId: string;
  contentTitle?: string;
  channel: ShareChannel;
  recipientCount: number;
  clickCount: number;
  conversionCount: number;
  revenue: number;
  timestamp: Date;
  metadata?: {
    deviceType?: string;
    location?: string;
    campaignId?: string;
  };
}

export interface ReferralEvent {
  referralId: string;
  referrerId: string;
  refereeId?: string;
  referralCode: string;
  source: ShareChannel;
  status: ReferralStatus;
  conversionValue?: number;
  conversionTimestamp?: Date;
  expiresAt?: Date;
  timestamp: Date;
}

// Analytics Types
export interface InfluencerSummary {
  userId: string;
  influenceScore: InfluenceScore;
  totalRevenue: number;
  totalConversions: number;
  topChannel: ShareChannel;
  rank: number;
}

export interface SocialSegment {
  segmentId: string;
  segmentType: 'influencer' | 'referrer' | 'community_organizer' | 'viral_sharer' | 'engaged_user';
  userCount: number;
  avgMetrics: {
    avgInfluenceScore?: number;
    avgConversionRate?: number;
    avgReach?: number;
    avgReferralRevenue?: number;
  };
  topUsers: string[];
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Input Validation Schemas
export interface TrackShareInput {
  userId: string;
  contentType: ContentType;
  contentId: string;
  channel: ShareChannel;
  recipientCount?: number;
  clickCount?: number;
  conversionCount?: number;
  revenue?: number;
  metadata?: ShareEvent['metadata'];
}

export interface TrackReferralInput {
  referrerId: string;
  refereeId?: string;
  referralCode: string;
  source: ShareChannel;
  conversionValue?: number;
}
