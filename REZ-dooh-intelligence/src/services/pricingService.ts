/**
 * DOOH Intelligence - Pricing Service
 * Dynamic pricing for DOOH based on captivity, audience, and demand
 */

import {
  DOOHPricingRequest,
  DOOHPricingResponse,
  DOOHScreenType,
  DOOHTargetingRequest,
  DOOHTargetedUser,
  BASE_CPM_BY_SCREEN,
  CITY_TIER_MULTIPLIERS,
  TIME_MULTIPLIERS,
  SEASONAL_MULTIPLIERS,
  calculateAudienceMatch,
  calculateDemandMultiplier,
  getCaptivityIndex,
  DemandSignal,
  UserIntelligence,
  ScreenAudience,
} from '../types';

// ============================================================================
// TIME SLOT MULTIPLIER
// ============================================================================

function getTimeMultiplier(date: Date): number {
  const hour = date.getHours();
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Peak morning
  if (hour >= 7 && hour < 9) {
    return TIME_MULTIPLIERS.peak_morning;
  }

  // Peak evening
  if (hour >= 18 && hour < 21) {
    return TIME_MULTIPLIERS.peak_evening;
  }

  // Business hours
  if (hour >= 9 && hour < 18) {
    return isWeekend
      ? TIME_MULTIPLIERS.weekend
      : TIME_MULTIPLIERS.business_hours;
  }

  // Late night
  if (hour >= 0 && hour < 6) {
    return TIME_MULTIPLIERS.late_night;
  }

  // Normal hours
  return isWeekend
    ? TIME_MULTIPLIERS.weekend
    : 1.0;
}

// ============================================================================
// SEASONAL MULTIPLIER
// ============================================================================

function getSeasonalMultiplier(date: Date): number {
  const month = date.getMonth();
  const day = date.getDate();

  // January slump
  if (month === 0) {
    return SEASONAL_MULTIPLIERS.january;
  }

  // Festival seasons
  if (month === 9 || month === 10) { // Oct-Nov (Diwali)
    return SEASONAL_MULTIPLIERS.festival;
  }

  // December holidays
  if (month === 11 && day >= 20) {
    return SEASONAL_MULTIPLIERS.holiday;
  }

  // Summer vacation
  if (month >= 4 && month <= 5) { // May-June
    return SEASONAL_MULTIPLIERS.holiday;
  }

  return SEASONAL_MULTIPLIERS.normal;
}

// ============================================================================
// COMPETITION MULTIPLIER
// ============================================================================

function getCompetitionMultiplier(level?: 'low' | 'medium' | 'high'): number {
  switch (level) {
    case 'high':
      return 1.5;
    case 'medium':
      return 1.2;
    case 'low':
    default:
      return 1.0;
  }
}

// ============================================================================
// QUALITY SCORE
// ============================================================================

function calculateQualityMultiplier(
  request: DOOHPricingRequest
): number {
  let quality = 1.0;

  // Objective-based quality
  switch (request.campaignObjective) {
    case 'awareness':
      quality *= 0.8; // Lower quality for awareness
      break;
    case 'traffic':
      quality *= 1.0;
      break;
    case 'conversions':
      quality *= 1.2; // Higher quality for conversions
      break;
    case 'footfall':
      quality *= 1.1;
      break;
  }

  // User targeting bonus
  if (request.user) {
    quality *= 1.15;
  }

  // Clamp between 0.5 and 1.5
  return Math.max(0.5, Math.min(1.5, quality));
}

// ============================================================================
// CAPTIVITY MULTIPLIER
// ============================================================================

function getCaptivityMultiplier(screenType: DOOHScreenType): number {
  const index = getCaptivityIndex(screenType);

  // Base multiplier by level
  switch (index.level) {
    case 'personal':
      return 2.0;
    case 'captive_private':
      return 1.5;
    case 'semi_captive':
      return 1.2;
    case 'public':
      return 1.0;
  }
}

// ============================================================================
// CPC/CPA CONVERSION
// ============================================================================

function cpmToCpc(cpm: number, estimatedCTR: number): number {
  // CPM to CPC: CPC = CPM / (1000 * CTR)
  // Assume 2% CTR for DOOH
  const ctr = estimatedCTR || 0.02;
  return (cpm / 1000) * ctr;
}

function cpmToCpa(cpm: number, estimatedCVR: number): number {
  // CPM to CPA: CPA = CPM / (1000 * CVR)
  // Assume 1% conversion rate
  const cvr = estimatedCVR || 0.01;
  return (cpm / 1000) * cvr;
}

// ============================================================================
// MAIN PRICING FUNCTION
// ============================================================================

export function calculateDOOHPricing(
  request: DOOHPricingRequest
): DOOHPricingResponse {
  const { screenType, location, scheduledTime, user, campaignObjective, competitionLevel } = request;

  // Get base pricing
  const base = BASE_CPM_BY_SCREEN[screenType];

  // Get multipliers
  const captivityMultiplier = getCaptivityMultiplier(screenType);
  const cityTierMultiplier = CITY_TIER_MULTIPLIERS[location.tier] || 1.0;
  const timeMultiplier = getTimeMultiplier(new Date(scheduledTime.start));
  const seasonalMultiplier = getSeasonalMultiplier(new Date(scheduledTime.start));
  const competitionMultiplier = getCompetitionMultiplier(competitionLevel);
  const qualityMultiplier = calculateQualityMultiplier(request);

  // Calculate demand multiplier (mock - would come from real-time data)
  const demandSignal: DemandSignal = {
    screenType,
    location: location.city,
    timestamp: new Date(),
    inventoryAvailable: 70, // Would come from real-time
    activeCampaigns: 5,     // Would come from real-time
    historicalFillRate: 75, // Would come from historical
  };
  const demandMultiplier = calculateDemandMultiplier(demandSignal);

  // Calculate audience match if user provided
  let audienceMatchResult;
  let audienceMultiplier = 1.0;

  if (user) {
    // Mock screen audience for matching
    const screenAudience: ScreenAudience = {
      screenId: request.screenId || 'unknown',
      screenType,
      typicalDemographics: {
        ageRange: ['25-34', '35-44'],
        income: ['medium', 'high'],
      },
      typicalContext: ['shopping', 'food', 'entertainment'],
      footTraffic: { daily: 1000, peak: 'evening' },
      purchaseIntent: 'medium',
    };

    audienceMatchResult = calculateAudienceMatch(user, screenAudience);
    audienceMultiplier = audienceMatchResult.priceAdjustment;
  }

  // Calculate final CPM
  const multipliers = {
    captivity: captivityMultiplier,
    cityTier: cityTierMultiplier,
    timeSlot: timeMultiplier,
    seasonal: seasonalMultiplier,
    demand: demandMultiplier,
    audienceMatch: audienceMultiplier,
    quality: qualityMultiplier,
  };

  const totalMultiplier =
    captivityMultiplier *
    cityTierMultiplier *
    timeMultiplier *
    seasonalMultiplier *
    demandMultiplier *
    audienceMultiplier *
    qualityMultiplier *
    competitionMultiplier;

  const finalCPM = Math.round(base.base * totalMultiplier * 100) / 100;

  // Calculate CPC and CPA
  const finalCPC = Math.round(cpmToCpc(finalCPM, 0.02) * 100) / 100;
  const finalCPA = Math.round(cpmToCpa(finalCPM, 0.01) * 100) / 100;

  // Get captivity index
  const captivityIndex = getCaptivityIndex(screenType);

  // Build confidence factors
  const confidenceFactors: string[] = [];
  let confidence = 0.8; // Base confidence

  if (user) {
    confidenceFactors.push('User profile available');
    confidence += 0.1;
  } else {
    confidenceFactors.push('Contextual targeting only');
    confidence -= 0.1;
  }

  if (demandSignal.activeCampaigns > 10) {
    confidenceFactors.push('High competition - price may fluctuate');
    confidence -= 0.05;
  }

  if (seasonalMultiplier > 1.5) {
    confidenceFactors.push('Seasonal demand applied');
  }

  confidence = Math.max(0.5, Math.min(1.0, confidence));

  return {
    finalCPM,
    finalCPC,
    finalCPA,
    unit: 'CPM',
    baseCPM: base.base,
    multipliers,
    captivityIndex,
    audienceMatch: audienceMatchResult,
    floorCPM: base.base,
    ceilingCPM: base.max,
    confidence,
    confidenceFactors,
  };
}

// ============================================================================
// PRICE WITH DURATION
// ============================================================================

export interface DurationPricing {
  totalCost: number;
  impressions: number;
  costPerImpression: number;
  duration: string;
  breakdown: {
    totalMinutes: number;
    ratePerMinute: number;
    multiplier: number;
  };
}

export function calculateDurationPricing(
  request: DOOHPricingRequest,
  durationMinutes: number
): DurationPricing {
  const pricing = calculateDOOHPricing(request);

  // CPM = cost per 1000 impressions
  // Assume 30 impressions per minute for a screen
  const impressionsPerMinute = 30;
  const totalImpressions = durationMinutes * impressionsPerMinute;

  // Total cost at CPM rate
  const totalCost = (pricing.finalCPM * totalImpressions) / 1000;

  // Duration multiplier (longer = slightly cheaper)
  let durationMultiplier = 1.0;
  if (durationMinutes >= 60) durationMultiplier = 0.95; // 1+ hour = 5% off
  if (durationMinutes >= 240) durationMultiplier = 0.9;   // 4+ hours = 10% off
  if (durationMinutes >= 1440) durationMultiplier = 0.8; // 24+ hours = 20% off

  const adjustedCost = totalCost * durationMultiplier;
  const ratePerMinute = adjustedCost / durationMinutes;

  // Format duration
  let duration: string;
  if (durationMinutes < 60) {
    duration = `${durationMinutes} minutes`;
  } else if (durationMinutes < 1440) {
    const hours = Math.floor(durationMinutes / 60);
    duration = `${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    const days = Math.floor(durationMinutes / 1440);
    duration = `${days} day${days > 1 ? 's' : ''}`;
  }

  return {
    totalCost: Math.round(adjustedCost * 100) / 100,
    impressions: totalImpressions,
    costPerImpression: Math.round((adjustedCost / totalImpressions) * 10000) / 10000,
    duration,
    breakdown: {
      totalMinutes: durationMinutes,
      ratePerMinute: Math.round(ratePerMinute * 100) / 100,
      multiplier: durationMultiplier,
    },
  };
}

// ============================================================================
// EXPORT SERVICE
// ============================================================================

export const doohPricingService = {
  calculateDOOHPricing,
  calculateDurationPricing,
  getCaptivityIndex,
  getTimeMultiplier,
  getSeasonalMultiplier,
  calculateAudienceMatch,
};

export default doohPricingService;
