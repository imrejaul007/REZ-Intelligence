/**
 * Canonical Campaign types for the REZ platform.
 *
 * Two clearly separated interfaces:
 *   PromoCampaign — from rezbackend/src/models/Campaign.ts
 *                   (Homepage "Exciting Deals" section, coin/cashback campaigns)
 *   AdCampaign    — from rezbackend/src/models/AdCampaign.ts
 *                   (Merchant-bought ad placements, CPC/CPM bidding)
 *
 * Do NOT redefine these types in frontend apps — import from @rez/shared instead.
 */

// ── PromoCampaign ─────────────────────────────────────────────────────────────

export type PromoCampaignType =
  | 'cashback'
  | 'coins'
  | 'bank'
  | 'bill'
  | 'drop'
  | 'new-user'
  | 'flash'
  | 'general';

export type PromoCampaignTargetSegment =
  | 'all'
  | 'new_users'
  | 'lapsed_users'
  | 'high_value';

export type PromoCampaignRegion =
  | 'bangalore'
  | 'dubai'
  | 'china'
  | 'all';

/** A single deal card within a PromoCampaign */
export interface PromoCampaignDeal {
  store?: string;
  storeId?: string;     // Store ObjectId as string
  image: string;
  cashback?: string;
  coins?: string;
  bonus?: string;
  drop?: string;
  discount?: string;
  endsIn?: string;
  price?: number;
  currency?: 'INR' | 'AED' | 'USD';
  purchaseLimit?: number;
  purchaseCount?: number;
}

/**
 * PromoCampaign — homepage and notification campaigns driven by ops/admin.
 * Drives the "Exciting Deals" section in the consumer app.
 */
export interface PromoCampaign {
  _id: string;
  campaignId: string;       // e.g., 'super-cashback', 'triple-coin-day'
  title: string;
  subtitle: string;
  description?: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;
  gradientColors: string[];
  type: PromoCampaignType;
  deals: PromoCampaignDeal[];
  startTime: string;          // ISO date string
  endTime: string;            // ISO date string
  isActive: boolean;
  priority: number;
  targetSegment: PromoCampaignTargetSegment;
  region?: PromoCampaignRegion;
  eligibleCategories?: string[];
  exclusiveToProgramSlug?: 'student_zone' | 'corporate_perks' | 'rez_prive';
  terms?: string[];
  minOrderValue?: number;
  maxBenefit?: number;
  icon?: string;
  bannerImage?: string;
  createdAt: string;
  updatedAt: string;
}

// ── AdCampaign ────────────────────────────────────────────────────────────────

export type AdPlacement =
  | 'home_banner'
  | 'explore_feed'
  | 'store_listing'
  | 'search_result';

export type AdTargetSegment = 'all' | 'new' | 'loyal' | 'lapsed' | 'nearby';

export type AdBidType = 'CPC' | 'CPM';

export type AdCampaignStatus =
  | 'draft'
  | 'pending_review'
  | 'active'
  | 'paused'
  | 'rejected'
  | 'completed';

/**
 * AdCampaign — paid ad placements purchased by merchants.
 * Managed through rez-ads-service. CPC/CPM bidding model.
 */
export interface AdCampaign {
  _id: string;
  merchantId: string;
  storeId: string;
  title: string;
  headline: string;
  description: string;
  ctaText: string;
  ctaUrl?: string;
  imageUrl: string;
  placement: AdPlacement;

  // Targeting
  targetSegment: AdTargetSegment;
  targetLocation?: {
    city?: string;
    radiusKm?: number;
  };
  targetInterests?: string[];

  // Budget
  bidType: AdBidType;
  bidAmount: number;
  dailyBudget: number;
  totalBudget: number;
  totalSpent: number;

  // Schedule
  startDate: string;    // ISO date string
  endDate?: string;

  // Status
  status: AdCampaignStatus;
  rejectionReason?: string;

  // Metrics
  impressions: number;
  clicks: number;
  /** Computed: clicks / impressions */
  ctr?: number;

  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Type guards ───────────────────────────────────────────────────────────────

export function isAdCampaign(campaign: PromoCampaign | AdCampaign): campaign is AdCampaign {
  return 'merchantId' in campaign && 'bidType' in campaign;
}

export function isPromoCampaign(campaign: PromoCampaign | AdCampaign): campaign is PromoCampaign {
  return 'campaignId' in campaign && 'badge' in campaign;
}
