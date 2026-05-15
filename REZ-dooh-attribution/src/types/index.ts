/**
 * DOOH Attribution - Types
 * Track DOOH impressions to conversions
 */

// ============================================================================
// ATTRIBUTION WINDOWS
// ============================================================================

/**
 * Attribution window for DOOH (in hours)
 */
export const ATTRIBUTION_WINDOWS = {
  // DOOH has longer attribution windows due to delayed effect
  impression: 24,        // View → Action within 24 hours
  engagement: 48,         // View → App visit within 48 hours
  conversion: 72,         // View → Purchase within 72 hours (3 days)
  assisted: 168,          // View → Purchase within 7 days (assisted)
};

// ============================================================================
// DOOH EVENT TYPES
// ============================================================================

export type DOOHEventType =
  | 'impression'
  | 'view_through'
  | 'click'
  | 'app_visit'
  | 'search'
  | 'add_to_cart'
  | 'purchase'
  | 'footfall';

// ============================================================================
// ATTRIBUTION MODEL
// ============================================================================

export type AttributionModel =
  | 'first_touch'      // Credit to first touchpoint
  | 'last_touch'       // Credit to last touchpoint
  | 'linear'           // Equal credit to all
  | 'time_decay'        // More credit to recent
  | 'position_based'    // 40% first, 40% last, 20% middle
  | 'data_driven';      // ML-based attribution

// ============================================================================
// ATTRIBUTION TOUCHPOINT
// ============================================================================

export interface DOOHTouchpoint {
  touchpointId: string;
  screenId: string;
  screenType: string;
  location: {
    city: string;
    tier: string;
  };
  campaignId: string;
  adContentId: string;
  userId?: string;          // If logged in user
  deviceId?: string;        // Anonymous device fingerprint
  timestamp: Date;
  event: DOOHEventType;
  metadata?: {
    duration?: number;      // Seconds viewed
    attention?: number;      // 0-1 attention score
    category?: string;       // Ad category
  };
}

// ============================================================================
// CONVERSION EVENT
// ============================================================================

export interface ConversionEvent {
  eventId: string;
  userId?: string;
  deviceId?: string;
  timestamp: Date;
  event: 'app_visit' | 'search' | 'add_to_cart' | 'purchase' | 'footfall';
  value?: number;            // Revenue
  currency?: string;
  orderId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// ATTRIBUTION CREDIT
// ============================================================================

export interface AttributionCredit {
  touchpointId: string;
  screenId: string;
  screenType: string;
  credit: number;             // 0-1 (percentage)
  model: AttributionModel;
  isInfluential: boolean;     // ML 判断是否是关键触点
  reasons?: string[];         // Why this touchpoint got credit
}

// ============================================================================
// ATTRIBUTION RESULT
// ============================================================================

export interface AttributionResult {
  conversionId: string;
  userId?: string;
  event: string;
  value?: number;
  timestamp: Date;

  // Touchpoints in the journey
  touchpoints: DOOHTouchpoint[];

  // Credits by model
  credits: {
    model: AttributionModel;
    credits: AttributionCredit[];
    totalCreditedToDOOH: number;
  }[];

  // Summary by screen type
  byScreenType: {
    screenType: string;
    impressions: number;
    credit: number;
    conversions: number;
    revenue: number;
    roas: number;
  }[];

  // Summary by campaign
  byCampaign: {
    campaignId: string;
    impressions: number;
    credit: number;
    conversions: number;
    revenue: number;
    cpm: number;
    roas: number;
  }[];
}

// ============================================================================
// DOOH METRICS
// ============================================================================

export interface DOOHMetrics {
  screenId: string;
  screenType: string;
  period: {
    start: Date;
    end: Date;
  };

  // Impressions
  grossImpressions: number;
  viewableImpressions: number;
  viewabilityRate: number;     // Viewable / Gross

  // Engagement
  totalEngagements: number;
  engagementRate: number;     // Engagements / Impressions

  // App Activity
  appVisits: number;
  visitRate: number;           // App Visits / Impressions

  // Search Activity
  searches: number;
  searchRate: number;          // Searches / Impressions

  // Cart Activity
  addToCart: number;
  cartRate: number;            // Add to Cart / Impressions

  // Conversions
  conversions: number;
  conversionRate: number;        // Conversions / Impressions

  // Revenue
  revenue: number;
  roas: number;                // Revenue / Spend

  // Attribution
  attributionModel: AttributionModel;
  attributedRevenue: number;
  attributionRate: number;      // Attributed / Total Revenue

  // Cost
  spend: number;
  cpm: number;                 // Cost / 1000 impressions
  cpa: number;                 // Cost / Conversion
  roasActual: number;           // Revenue / Cost
}

// ============================================================================
// FOOTFALL ATTRIBUTION
// ============================================================================

export interface FootfallAttribution {
  screenId: string;
  campaignId: string;
  date: Date;

  // DOOH Exposure
  impressions: number;
  uniqueDevices: number;

  // Footfall (from geofence or SDK)
  totalFootfall: number;
  attributedFootfall: number;
  attributionRate: number;

  // Attribution by distance
  byDistance: {
    distanceMeters: number;
    footfall: number;
    attributionRate: number;
  }[];

  // Attribution by time window
  byTimeWindow: {
    windowMinutes: number;
    footfall: number;
    attributionRate: number;
  }[];
}
