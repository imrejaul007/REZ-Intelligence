/**
 * DOOH Intelligence - Types
 * Connects DOOH screen inventory to user intelligence for targeted ads
 */

// ============================================================================
// SCREEN TYPES & CAPTIVITY
// ============================================================================

/**
 * Screen location categories based on captiveness
 */
export type CaptivityLevel = 'personal' | 'captive_private' | 'semi_captive' | 'public';

/**
 * Screen type classification
 */
export type DOOHScreenType =
  // L1: Personal Device (User's own)
  | 'app_feed'
  | 'app_banner'
  | 'app_search'
  | 'website'

  // L2: Captive Private (User stuck, profile data available)
  | 'hotel_tv'
  | 'cab_screen'
  | 'flight_seat'
  | 'bus_seat'
  | 'train_seat'
  | 'rental_car_screen'
  | 'ev_charger_screen'
  | 'cruise_ship'

  // L3: Semi-Captive (Context + some profile)
  | 'mall_kiosk'
  | 'office_lobby'
  | 'university_display'
  | 'gym_screen'
  | 'cinema_screen'
  | 'restaurant_tv'
  | 'salon_display'
  | 'hospital_display'

  // L4: Public (Context only)
  | 'billboard_led'
  | 'bus_shelter'
  | 'street_pole'
  | 'atm_screen'
  | 'public_park';

/**
 * Mapping screen types to captivity levels
 */
export const SCREEN_CAPTIVITY_MAP: Record<DOOHScreenType, CaptivityLevel> = {
  // L1: Personal
  app_feed: 'personal',
  app_banner: 'personal',
  app_search: 'personal',
  website: 'personal',

  // L2: Captive Private
  hotel_tv: 'captive_private',
  cab_screen: 'captive_private',
  flight_seat: 'captive_private',
  bus_seat: 'captive_private',
  train_seat: 'captive_private',
  rental_car_screen: 'captive_private',
  ev_charger_screen: 'captive_private',
  cruise_ship: 'captive_private',

  // L3: Semi-Captive
  mall_kiosk: 'semi_captive',
  office_lobby: 'semi_captive',
  university_display: 'semi_captive',
  gym_screen: 'semi_captive',
  cinema_screen: 'semi_captive',
  restaurant_tv: 'semi_captive',
  salon_display: 'semi_captive',
  hospital_display: 'semi_captive',

  // L4: Public
  billboard_led: 'public',
  bus_shelter: 'public',
  street_pole: 'public',
  atm_screen: 'public',
  public_park: 'public',
};

// ============================================================================
// BASE PRICING
// ============================================================================

/**
 * Base CPM by screen type (in INR)
 */
export const BASE_CPM_BY_SCREEN: Record<DOOHScreenType, { base: number; max: number }> = {
  // L1: Personal
  app_feed: { base: 100, max: 400 },
  app_banner: { base: 80, max: 300 },
  app_search: { base: 250, max: 500 },
  website: { base: 60, max: 200 },

  // L2: Captive Private
  hotel_tv: { base: 180, max: 400 },
  cab_screen: { base: 150, max: 300 },
  flight_seat: { base: 200, max: 400 },
  bus_seat: { base: 100, max: 200 },
  train_seat: { base: 120, max: 250 },
  rental_car_screen: { base: 80, max: 180 },
  ev_charger_screen: { base: 100, max: 200 },
  cruise_ship: { base: 300, max: 600 },

  // L3: Semi-Captive
  mall_kiosk: { base: 80, max: 150 },
  office_lobby: { base: 100, max: 180 },
  university_display: { base: 80, max: 140 },
  gym_screen: { base: 70, max: 120 },
  cinema_screen: { base: 90, max: 160 },
  restaurant_tv: { base: 60, max: 100 },
  salon_display: { base: 60, max: 100 },
  hospital_display: { base: 60, max: 100 },

  // L4: Public
  billboard_led: { base: 40, max: 100 },
  bus_shelter: { base: 20, max: 50 },
  street_pole: { base: 15, max: 35 },
  atm_screen: { base: 30, max: 60 },
  public_park: { base: 10, max: 25 },
};

// ============================================================================
// MULTIPLIERS
// ============================================================================

/**
 * City tier multipliers
 */
export const CITY_TIER_MULTIPLIERS: Record<string, number> = {
  metro: 2.5,        // Mumbai, Delhi, Bangalore, Chennai
  tier1: 2.0,        // Pune, Hyderabad, Kolkata
  tier2: 1.3,        // Jaipur, Lucknow, Chandigarh
  tier3: 1.0,        // Smaller cities
};

/**
 * Time multipliers
 */
export const TIME_MULTIPLIERS: Record<string, number> = {
  peak_morning: 2.0,      // 7-9am
  peak_evening: 2.0,      // 6-9pm
  business_hours: 1.5,     // 9am-6pm
  weekend: 1.3,
  off_peak: 0.5,          // Late night
  late_night: 0.4,
};

/**
 * Seasonal multipliers
 */
export const SEASONAL_MULTIPLIERS: Record<string, number> = {
  festival: 2.5,           // Diwali, Christmas
  holiday: 1.8,            // Summer vacation, long weekends
  normal: 1.0,
  january: 0.8,           // Post-holiday slump
};

/**
 * Demand multipliers (real-time)
 */
export interface DemandSignal {
  screenType: DOOHScreenType;
  location: string;
  timestamp: Date;
  inventoryAvailable: number;    // 0-100%
  activeCampaigns: number;
  historicalFillRate: number;  // 0-100%
}

/**
 * Calculate demand multiplier based on signals
 */
export function calculateDemandMultiplier(signal: DemandSignal): number {
  // Low inventory + high demand = surge
  const scarcity = (100 - signal.inventoryAvailable) / 50;

  // More campaigns = more competition = higher price
  const competition = Math.min(signal.activeCampaigns / 5, 2);

  // Historical fill rate indicates demand
  const fillRate = signal.historicalFillRate / 100;

  // Combined multiplier
  const multiplier = scarcity * competition * (0.5 + fillRate * 0.5);

  // Clamp between 0.5 and 3.0
  return Math.max(0.5, Math.min(3.0, multiplier));
}

// ============================================================================
// AUDIENCE MATCHING
// ============================================================================

/**
 * User profile from identity graph
 */
export interface UserIntelligence {
  userId: string;
  rfmSegment: 'champions' | 'loyal' | 'potential' | 'at_risk' | 'lost';
  interests: string[];
  demographics: {
    ageRange: string;
    gender?: string;
    income?: 'low' | 'medium' | 'high';
  };
  recentIntents: {
    intent: string;
    confidence: number;
    category: string;
  }[];
  location?: {
    city: string;
    tier: string;
  };
}

/**
 * Screen audience profile
 */
export interface ScreenAudience {
  screenId: string;
  screenType: DOOHScreenType;
  typicalDemographics: {
    ageRange: string[];
    gender?: string[];
    income?: ('low' | 'medium' | 'high')[];
  };
  typicalContext: string[];
  footTraffic: {
    daily: number;
    peak: string;
  };
  purchaseIntent: 'high' | 'medium' | 'low';
}

/**
 * Audience match result
 */
export interface AudienceMatch {
  score: number;                    // 0-100
  matchLevel: 'excellent' | 'good' | 'fair' | 'poor';
  matchedSegments: string[];
  unmatchedSegments: string[];
  priceAdjustment: number;           // 0.5 - 2.0
}

/**
 * Calculate audience match between user and screen
 */
export function calculateAudienceMatch(
  user: UserIntelligence,
  screen: ScreenAudience
): AudienceMatch {
  let score = 50;
  const matched: string[] = [];
  const unmatched: string[] = [];

  // RFM segment match
  if (user.rfmSegment === 'champions' || user.rfmSegment === 'loyal') {
    score += 20;
    matched.push('high_value_user');
  } else if (user.rfmSegment === 'potential') {
    score += 10;
    matched.push('growth_user');
  } else {
    unmatched.push('low_engagement');
  }

  // Interest match
  const interestMatches = user.interests.filter(interest =>
    screen.typicalContext.some(ctx =>
      ctx.toLowerCase().includes(interest.toLowerCase())
    )
  );
  score += interestMatches.length * 10;
  matched.push(...interestMatches);

  // Intent match
  const highConfidenceIntents = user.recentIntents
    .filter(i => i.confidence > 0.7)
    .map(i => i.category);
  const intentMatches = highConfidenceIntents.filter(intent =>
    screen.purchaseIntent !== 'low'
  );
  score += intentMatches.length * 15;
  matched.push(...intentMatches.map(i => `intent:${i}`));

  // Income match
  if (user.demographics.income === 'high' && screen.typicalDemographics.income?.includes('high')) {
    score += 15;
    matched.push('affluent_audience');
  }

  // Age match
  const userAgeRange = user.demographics.ageRange;
  const screenAgeRanges = screen.typicalDemographics.ageRange;
  if (screenAgeRanges.includes(userAgeRange)) {
    score += 10;
    matched.push('age_match');
  } else {
    unmatched.push('age_mismatch');
  }

  // Normalize score to 0-100
  score = Math.min(100, Math.max(0, score));

  // Determine match level
  let matchLevel: AudienceMatch['matchLevel'];
  if (score >= 80) matchLevel = 'excellent';
  else if (score >= 60) matchLevel = 'good';
  else if (score >= 40) matchLevel = 'fair';
  else matchLevel = 'poor';

  // Price adjustment: excellent = premium, poor = discount
  let priceAdjustment: number;
  if (matchLevel === 'excellent') priceAdjustment = 1.5;
  else if (matchLevel === 'good') priceAdjustment = 1.2;
  else if (matchLevel === 'fair') priceAdjustment = 1.0;
  else priceAdjustment = 0.8;

  return {
    score,
    matchLevel,
    matchedSegments: matched,
    unmatchedSegments: unmatched,
    priceAdjustment,
  };
}

// ============================================================================
// CAPTIVITY INDEX
// ============================================================================

/**
 * Captivity metrics for a screen
 */
export interface CaptivityIndex {
  screenType: DOOHScreenType;
  level: CaptivityLevel;

  // Dwell time (minutes)
  avgDwellTime: number;
  minDwellTime: number;
  maxDwellTime: number;

  // Attention metrics
  attentionLevel: number;        // 0-1, how much user pays attention
  distractionLevel: number;       // 0-1, how likely to ignore

  // Data availability
  dataAvailability: 'full' | 'partial' | 'none';

  // Escape difficulty (how hard to avoid)
  escapeDifficulty: number;        // 1-5, 5 = can't escape

  // Premium audience score
  premiumScore: number;           // 0-100, likelihood of premium audience
}

/**
 * Get captivity index for a screen type
 */
export function getCaptivityIndex(screenType: DOOHScreenType): CaptivityIndex {
  const level = SCREEN_CAPTIVITY_MAP[screenType];

  // Default values by level
  const defaults: Record<CaptivityLevel, Omit<CaptivityIndex, 'screenType' | 'level'>> = {
    personal: {
      avgDwellTime: 5,
      minDwellTime: 1,
      maxDwellTime: 30,
      attentionLevel: 0.8,
      distractionLevel: 0.4,
      dataAvailability: 'full',
      escapeDifficulty: 3,
      premiumScore: 50,
    },
    captive_private: {
      avgDwellTime: 30,
      minDwellTime: 5,
      maxDwellTime: 480,
      attentionLevel: 0.9,
      distractionLevel: 0.1,
      dataAvailability: 'full',
      escapeDifficulty: 5,
      premiumScore: 70,
    },
    semi_captive: {
      avgDwellTime: 10,
      minDwellTime: 2,
      maxDwellTime: 60,
      attentionLevel: 0.6,
      distractionLevel: 0.4,
      dataAvailability: 'partial',
      escapeDifficulty: 3,
      premiumScore: 55,
    },
    public: {
      avgDwellTime: 3,
      minDwellTime: 0.5,
      maxDwellTime: 30,
      attentionLevel: 0.3,
      distractionLevel: 0.7,
      dataAvailability: 'none',
      escapeDifficulty: 1,
      premiumScore: 40,
    },
  };

  return {
    screenType,
    level,
    ...defaults[level],
  };
}

// ============================================================================
// DOOH PRICING REQUEST/RESPONSE
// ============================================================================

/**
 * Pricing request for DOOH ad
 */
export interface DOOHPricingRequest {
  screenType: DOOHScreenType;
  screenId?: string;
  location: {
    city: string;
    tier: 'metro' | 'tier1' | 'tier2' | 'tier3';
    coordinates?: { lat: number; lng: number };
  };
  scheduledTime: {
    start: Date;
    end: Date;
  };
  user?: UserIntelligence;
  campaignObjective: 'awareness' | 'traffic' | 'conversions' | 'footfall';
  competitionLevel?: 'low' | 'medium' | 'high';
}

/**
 * Pricing response for DOOH ad
 */
export interface DOOHPricingResponse {
  finalCPM: number;
  finalCPC: number;
  finalCPA: number;
  unit: 'CPM' | 'CPC' | 'CPA';

  // Breakdown
  baseCPM: number;
  multipliers: {
    captivity: number;
    cityTier: number;
    timeSlot: number;
    seasonal: number;
    demand: number;
    audienceMatch: number;
    quality: number;
  };

  // Captivity details
  captivityIndex: CaptivityIndex;

  // Audience match (if user provided)
  audienceMatch?: AudienceMatch;

  // Floor and ceiling
  floorCPM: number;
  ceilingCPM: number;

  // Confidence
  confidence: number;
  confidenceFactors: string[];
}

// ============================================================================
// TARGETING REQUEST
// ============================================================================

/**
 * Get targeted users for a DOOH screen
 */
export interface DOOHTargetingRequest {
  screenType: DOOHScreenType;
  screenId: string;
  location: {
    city: string;
    tier: string;
  };
  audienceCriteria?: {
    rfmSegments?: string[];
    interests?: string[];
    ageRange?: string;
    income?: string[];
  };
  limit?: number;
}

/**
 * Targeted user for DOOH
 */
export interface DOOHTargetedUser {
  userId: string;
  matchScore: number;
  reasons: string[];
  recommendedAdCategories: string[];
  userContext: {
    rfmSegment: string;
    topInterests: string[];
    recentIntents: string[];
  };
}
