/**
 * DOOH Attribution - Attribution Service
 * Track and attribute conversions to DOOH touchpoints
 */

import { v4 as uuidv4 } from 'uuid';
import {
  DOOHTouchpoint,
  ConversionEvent,
  AttributionCredit,
  AttributionResult,
  AttributionModel,
  DOOHMetrics,
  ATTRIBUTION_WINDOWS,
} from '../types';

// ============================================================================
// TIME WINDOW FILTERING
// ============================================================================

/**
 * Filter touchpoints within attribution window
 */
function filterByWindow(
  touchpoints: DOOHTouchpoint[],
  conversionTime: Date,
  windowHours: number
): DOOHTouchpoint[] {
  const windowMs = windowHours * 60 * 60 * 1000;
  const windowStart = new Date(conversionTime.getTime() - windowMs);

  return touchpoints.filter(
    (tp) => tp.timestamp >= windowStart && tp.timestamp <= conversionTime
  );
}

// ============================================================================
// ATTRIBUTION MODELS
// ============================================================================

/**
 * First Touch Attribution
 * All credit to first touchpoint
 */
function firstTouch(
  touchpoints: DOOHTouchpoint[],
  conversion: ConversionEvent
): AttributionCredit[] {
  if (touchpoints.length === 0) return [];

  // Sort by timestamp ascending
  const sorted = [...touchpoints].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const first = sorted[0];
  return [
    {
      touchpointId: first.touchpointId,
      screenId: first.screenId,
      screenType: first.screenType,
      credit: 1.0,
      model: 'first_touch',
      isInfluential: true,
      reasons: ['First touchpoint in customer journey'],
    },
  ];
}

/**
 * Last Touch Attribution
 * All credit to last touchpoint
 */
function lastTouch(
  touchpoints: DOOHTouchpoint[],
  conversion: ConversionEvent
): AttributionCredit[] {
  if (touchpoints.length === 0) return [];

  // Sort by timestamp descending
  const sorted = [...touchpoints].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );

  const last = sorted[0];
  return [
    {
      touchpointId: last.touchpointId,
      screenId: last.screenId,
      screenType: last.screenType,
      credit: 1.0,
      model: 'last_touch',
      isInfluential: true,
      reasons: ['Last touchpoint before conversion'],
    },
  ];
}

/**
 * Linear Attribution
 * Equal credit to all touchpoints
 */
function linear(
  touchpoints: DOOHTouchpoint[],
  conversion: ConversionEvent
): AttributionCredit[] {
  if (touchpoints.length === 0) return [];

  const credit = 1 / touchpoints.length;

  return touchpoints.map((tp) => ({
    touchpointId: tp.touchpointId,
    screenId: tp.screenId,
    screenType: tp.screenType,
    credit,
    model: 'linear' as AttributionModel,
    isInfluential: true,
    reasons: ['Equal credit across all touchpoints'],
  }));
}

/**
 * Time Decay Attribution
 * More credit to recent touchpoints
 */
function timeDecay(
  touchpoints: DOOHTouchpoint[],
  conversion: ConversionEvent
): AttributionCredit[] {
  if (touchpoints.length === 0) return [];

  // Sort by timestamp
  const sorted = [...touchpoints].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  // Calculate decay weights (half-life of 7 days)
  const halfLifeHours = 7 * 24;
  const conversionTime = conversion.timestamp.getTime();

  let totalWeight = 0;
  const weights = sorted.map((tp) => {
    const hoursFromConversion =
      (conversionTime - tp.timestamp.getTime()) / (1000 * 60 * 60);
    const weight = Math.pow(0.5, hoursFromConversion / halfLifeHours);
    totalWeight += weight;
    return { touchpoint: tp, weight };
  });

  return weights.map(({ touchpoint, weight }) => ({
    touchpointId: touchpoint.touchpointId,
    screenId: touchpoint.screenId,
    screenType: touchpoint.screenType,
    credit: weight / totalWeight,
    model: 'time_decay' as AttributionModel,
    isInfluential: weight / totalWeight > 0.2,
    reasons: [
      `Decay weight: ${(weight / totalWeight * 100).toFixed(1)}% based on recency`,
    ],
  }));
}

/**
 * Position Based Attribution
 * 40% first, 40% last, 20% distributed among middle
 */
function positionBased(
  touchpoints: DOOHTouchpoint[],
  conversion: ConversionEvent
): AttributionCredit[] {
  if (touchpoints.length === 0) return [];

  const sorted = [...touchpoints].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  if (sorted.length === 1) {
    return [
      {
        touchpointId: sorted[0].touchpointId,
        screenId: sorted[0].screenId,
        screenType: sorted[0].screenType,
        credit: 1.0,
        model: 'position_based' as AttributionModel,
        isInfluential: true,
        reasons: ['Only touchpoint - full credit'],
      },
    ];
  }

  if (sorted.length === 2) {
    return [
      {
        touchpointId: sorted[0].touchpointId,
        screenId: sorted[0].screenId,
        screenType: sorted[0].screenType,
        credit: 0.5,
        model: 'position_based' as AttributionModel,
        isInfluential: true,
        reasons: ['First touchpoint - 50% credit'],
      },
      {
        touchpointId: sorted[1].touchpointId,
        screenId: sorted[1].screenId,
        screenType: sorted[1].screenType,
        credit: 0.5,
        model: 'position_based' as AttributionModel,
        isInfluential: true,
        reasons: ['Last touchpoint - 50% credit'],
      },
    ];
  }

  // 3+ touchpoints: 40% first, 40% last, 20% middle
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const middle = sorted.slice(1, -1);
  const middleCredit = 0.2 / middle.length;

  const credits: AttributionCredit[] = [
    {
      touchpointId: first.touchpointId,
      screenId: first.screenId,
      screenType: first.screenType,
      credit: 0.4,
      model: 'position_based' as AttributionModel,
      isInfluential: true,
      reasons: ['First touchpoint - 40% credit'],
    },
    ...middle.map((tp) => ({
      touchpointId: tp.touchpointId,
      screenId: tp.screenId,
      screenType: tp.screenType,
      credit: middleCredit,
      model: 'position_based' as AttributionModel,
      isInfluential: false,
      reasons: ['Middle touchpoint - distributed 20%'],
    })),
    {
      touchpointId: last.touchpointId,
      screenId: last.screenId,
      screenType: last.screenType,
      credit: 0.4,
      model: 'position_based' as AttributionModel,
      isInfluential: true,
      reasons: ['Last touchpoint - 40% credit'],
    },
  ];

  return credits;
}

/**
 * Data-Driven Attribution (simplified ML)
 * Uses heuristic: weight by recency + engagement
 */
function dataDriven(
  touchpoints: DOOHTouchpoint[],
  conversion: ConversionEvent
): AttributionCredit[] {
  if (touchpoints.length === 0) return [];

  // Sort by timestamp
  const sorted = [...touchpoints].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  // Calculate weights based on multiple signals
  let totalWeight = 0;
  const weights = sorted.map((tp, index) => {
    let weight = 0;

    // Recency (40% weight)
    const hoursFromConversion =
      (conversion.timestamp.getTime() - tp.timestamp.getTime()) / (1000 * 60 * 60);
    const recencyScore = Math.pow(0.5, hoursFromConversion / 24); // 24hr half-life
    weight += recencyScore * 0.4;

    // Position (30% weight)
    const positionScore = index === 0 || index === sorted.length - 1 ? 1 : 0.5;
    weight += positionScore * 0.3;

    // Engagement (30% weight) - if available
    if (tp.metadata?.duration) {
      const durationScore = Math.min((tp.metadata.duration as number) / 30, 1); // Max 30 sec
      weight += durationScore * 0.3;
    } else {
      weight += 0.15; // Default middle score
    }

    totalWeight += weight;
    return { touchpoint: tp, weight };
  });

  return weights.map(({ touchpoint, weight }) => ({
    touchpointId: touchpoint.touchpointId,
    screenId: touchpoint.screenId,
    screenType: touchpoint.screenType,
    credit: weight / totalWeight,
    model: 'data_driven' as AttributionModel,
    isInfluential: weight / totalWeight > 0.25,
    reasons: [
      `ML weight: ${(weight / totalWeight * 100).toFixed(1)}%`,
      weight / totalWeight > 0.25 ? 'Key touchpoint' : 'Supporting touchpoint',
    ],
  }));
}

// ============================================================================
// MAIN ATTRIBUTION FUNCTION
// ============================================================================

/**
 * Attribute a conversion to DOOH touchpoints
 */
export function attributeConversion(
  conversion: ConversionEvent,
  touchpoints: DOOHTouchpoint[],
  models: AttributionModel[] = ['last_touch', 'first_touch', 'linear', 'time_decay', 'position_based', 'data_driven']
): AttributionResult {
  const result: AttributionResult = {
    conversionId: conversion.eventId,
    userId: conversion.userId,
    event: conversion.event,
    value: conversion.value,
    timestamp: conversion.timestamp,
    touchpoints,
    credits: [],
    byScreenType: [],
    byCampaign: [],
  };

  // Filter touchpoints within impression window (24 hours for DOOH)
  const relevantTouchpoints = filterByWindow(
    touchpoints,
    conversion.timestamp,
    ATTRIBUTION_WINDOWS.impression
  );

  // Calculate credits for each model
  for (const model of models) {
    let credits: AttributionCredit[];

    switch (model) {
      case 'first_touch':
        credits = firstTouch(relevantTouchpoints, conversion);
        break;
      case 'last_touch':
        credits = lastTouch(relevantTouchpoints, conversion);
        break;
      case 'linear':
        credits = linear(relevantTouchpoints, conversion);
        break;
      case 'time_decay':
        credits = timeDecay(relevantTouchpoints, conversion);
        break;
      case 'position_based':
        credits = positionBased(relevantTouchpoints, conversion);
        break;
      case 'data_driven':
      default:
        credits = dataDriven(relevantTouchpoints, conversion);
        break;
    }

    // Calculate total DOOH credit
    const totalDOOHCredit = credits.reduce((sum, c) => sum + c.credit, 0);

    result.credits.push({
      model,
      credits,
      totalCreditedToDOOH: totalDOOHCredit,
    });
  }

  // Aggregate by screen type (using last_touch as default)
  const lastTouchCredits = result.credits.find((c) => c.model === 'last_touch');
  if (lastTouchCredits) {
    const byType: Record<string, { impressions: number; credit: number; conversions: number; revenue: number }> = {};

    for (const credit of lastTouchCredits.credits) {
      if (!byType[credit.screenType]) {
        byType[credit.screenType] = {
          impressions: 0,
          credit: 0,
          conversions: 0,
          revenue: 0,
        };
      }
      byType[credit.screenType].credit += credit.credit;
      if (credit.isInfluential) {
        byType[credit.screenType].conversions += 1;
        byType[credit.screenType].revenue += (conversion.value || 0) * credit.credit;
      }
    }

    result.byScreenType = Object.entries(byType).map(([screenType, data]) => ({
      screenType,
      impressions: 0, // Would come from impression data
      credit: data.credit,
      conversions: data.conversions,
      revenue: data.revenue,
      roas: data.revenue > 0 ? data.revenue / 1 : 0, // Spend would come from campaign
    }));
  }

  return result;
}

// ============================================================================
// CALCULATE DOOH METRICS
// ============================================================================

/**
 * Calculate DOOH metrics for a screen
 */
export function calculateDOOHMetrics(
  screenId: string,
  screenType: string,
  period: { start: Date; end: Date },
  impressions: number,
  engagements: number,
  appVisits: number,
  searches: number,
  addToCart: number,
  conversions: number,
  revenue: number,
  spend: number
): DOOHMetrics {
  const viewabilityRate = 0.65; // Would come from measurement
  const viewableImpressions = Math.round(impressions * viewabilityRate);

  return {
    screenId,
    screenType,
    period,
    grossImpressions: impressions,
    viewableImpressions,
    viewabilityRate,
    totalEngagements: engagements,
    engagementRate: impressions > 0 ? engagements / impressions : 0,
    appVisits,
    visitRate: impressions > 0 ? appVisits / impressions : 0,
    searches,
    searchRate: impressions > 0 ? searches / impressions : 0,
    addToCart,
    cartRate: impressions > 0 ? addToCart / impressions : 0,
    conversions,
    conversionRate: impressions > 0 ? conversions / impressions : 0,
    revenue,
    roas: spend > 0 ? revenue / spend : 0,
    attributionModel: 'data_driven',
    attributedRevenue: revenue * 0.3, // Assume 30% attribution to DOOH
    attributionRate: 0.3,
    spend,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
    roasActual: spend > 0 ? revenue / spend : 0,
  };
}

// ============================================================================
// EXPORT SERVICE
// ============================================================================

export const doohAttributionService = {
  attributeConversion,
  calculateDOOHMetrics,
  filterByWindow,
};

export default doohAttributionService;
