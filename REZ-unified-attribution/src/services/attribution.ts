/**
 * Unified Attribution Service
 *
 * Implements all attribution models for consolidated tracking:
 * - First Touch
 * - Last Touch
 * - Last Non-Direct Touch
 * - Linear
 * - Time Decay
 * - Position Based (U-shaped)
 * - Data Driven (placeholder for ML)
 */

import { Touchpoint, Conversion, Channel, Spend, IConversion, ITouchpoint } from '../models/attribution.js';
import { logger } from './logger.js';
import { AttributionModel, ChannelType } from '../models/attribution.js';

interface AttributionResult {
  channel: ChannelType;
  weight: number;
  revenue: number;
}

interface ChannelAttribution {
  channel: ChannelType;
  conversions: number;
  revenue: number;
  weight: number;
}

/**
 * Calculate attribution based on model
 */
export async function calculateAttribution(
  customerId: string,
  conversionId: string,
  model: AttributionModel = AttributionModel.LAST_TOUCH
): Promise<AttributionResult[]> {
  try {
    // Get all touchpoints for this customer within conversion window
    const conversion = await Conversion.findOne({ conversionId });
    if (!conversion) {
      logger.warn('Conversion not found', { conversionId });
      return [];
    }

    const windowStart = new Date(conversion.timestamp.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days
    const touchpoints = await Touchpoint.find({
      customerId,
      merchantId: conversion.merchantId,
      timestamp: { $gte: windowStart, $lte: conversion.timestamp }
    }).sort({ timestamp: 1 });

    if (touchpoints.length === 0) {
      // No touchpoints - attribute to direct
      return [{ channel: ChannelType.DIRECT, weight: 1, revenue: conversion.value.amount }];
    }

    switch (model) {
      case AttributionModel.FIRST_TOUCH:
        return firstTouchAttribution(touchpoints, conversion);
      case AttributionModel.LAST_TOUCH:
        return lastTouchAttribution(touchpoints, conversion);
      case AttributionModel.LAST_NON_DIRECT:
        return lastNonDirectAttribution(touchpoints, conversion);
      case AttributionModel.LINEAR:
        return linearAttribution(touchpoints, conversion);
      case AttributionModel.TIME_DECAY:
        return timeDecayAttribution(touchpoints, conversion);
      case AttributionModel.POSITION_BASED:
        return positionBasedAttribution(touchpoints, conversion);
      case AttributionModel.DATA_DRIVEN:
        return dataDrivenAttribution(touchpoints, conversion);
      default:
        return lastTouchAttribution(touchpoints, conversion);
    }
  } catch (error) {
    logger.error('Attribution calculation failed', { error, conversionId });
    throw error;
  }
}

/**
 * First Touch Attribution
 * 100% credit to the first touchpoint
 */
function firstTouchAttribution(
  touchpoints: ITouchpoint[],
  conversion: IConversion
): AttributionResult[] {
  const first = touchpoints[0];
  return [{
    channel: first.channel as ChannelType,
    weight: 1,
    revenue: conversion.value.amount
  }];
}

/**
 * Last Touch Attribution
 * 100% credit to the last touchpoint
 */
function lastTouchAttribution(
  touchpoints: ITouchpoint[],
  conversion: IConversion
): AttributionResult[] {
  const last = touchpoints[touchpoints.length - 1];
  return [{
    channel: last.channel as ChannelType,
    weight: 1,
    revenue: conversion.value.amount
  }];
}

/**
 * Last Non-Direct Touch Attribution
 * 100% credit to last non-DIRECT channel
 */
function lastNonDirectAttribution(
  touchpoints: ITouchpoint[],
  conversion: IConversion
): AttributionResult[] {
  const nonDirect = [...touchpoints].reverse().find(t =>
    t.channel !== ChannelType.DIRECT && t.channel !== ChannelType.UNKNOWN
  );
  return [{
    channel: (nonDirect?.channel as ChannelType) || ChannelType.DIRECT,
    weight: 1,
    revenue: conversion.value.amount
  }];
}

/**
 * Linear Attribution
 * Equal credit to all touchpoints
 */
function linearAttribution(
  touchpoints: ITouchpoint[],
  conversion: IConversion
): AttributionResult[] {
  const weight = 1 / touchpoints.length;
  const channelWeights = new Map<ChannelType, number>();

  for (const tp of touchpoints) {
    const channel = tp.channel as ChannelType;
    channelWeights.set(channel, (channelWeights.get(channel) || 0) + weight);
  }

  return Array.from(channelWeights.entries()).map(([channel, w]) => ({
    channel,
    weight: w,
    revenue: conversion.value.amount * w
  }));
}

/**
 * Time Decay Attribution
 * More credit to recent touchpoints (exponential decay)
 */
function timeDecayAttribution(
  touchpoints: ITouchpoint[],
  conversion: IConversion
): AttributionResult[] {
  const decayFactor = 0.5; // Half-life of 1 day
  const conversionTime = conversion.timestamp.getTime();

  let totalWeight = 0;
  const channelWeights = new Map<ChannelType, number>();

  for (const tp of touchpoints) {
    const daysSinceTouch = (conversionTime - tp.timestamp.getTime()) / (24 * 60 * 60 * 1000);
    const weight = Math.pow(decayFactor, daysSinceTouch);

    totalWeight += weight;
    const channel = tp.channel as ChannelType;
    channelWeights.set(channel, (channelWeights.get(channel) || 0) + weight);
  }

  return Array.from(channelWeights.entries()).map(([channel, w]) => ({
    channel,
    weight: w / totalWeight,
    revenue: conversion.value.amount * (w / totalWeight)
  }));
}

/**
 * Position Based Attribution (U-shaped)
 * 40% to first, 40% to last, 20% distributed among middle
 */
function positionBasedAttribution(
  touchpoints: ITouchpoint[],
  conversion: IConversion
): AttributionResult[] {
  if (touchpoints.length === 1) {
    return [{
      channel: touchpoints[0].channel as ChannelType,
      weight: 1,
      revenue: conversion.value.amount
    }];
  }

  const firstWeight = 0.4;
  const lastWeight = 0.4;
  const middleWeight = 0.2 / (touchpoints.length - 2);

  const channelWeights = new Map<ChannelType, number>();

  // First touch
  const first = touchpoints[0];
  const firstChannel = first.channel as ChannelType;
  channelWeights.set(firstChannel, (channelWeights.get(firstChannel) || 0) + firstWeight);

  // Middle touchpoints
  for (let i = 1; i < touchpoints.length - 1; i++) {
    const channel = touchpoints[i].channel as ChannelType;
    channelWeights.set(channel, (channelWeights.get(channel) || 0) + middleWeight);
  }

  // Last touch
  const last = touchpoints[touchpoints.length - 1];
  const lastChannel = last.channel as ChannelType;
  channelWeights.set(lastChannel, (channelWeights.get(lastChannel) || 0) + lastWeight);

  return Array.from(channelWeights.entries()).map(([channel, w]) => ({
    channel,
    weight: w,
    revenue: conversion.value.amount * w
  }));
}

/**
 * Data Driven Attribution
 * Placeholder for ML-based attribution
 * In production, this would use ML model trained on historical data
 */
function dataDrivenAttribution(
  touchpoints: ITouchpoint[],
  conversion: IConversion
): AttributionResult[] {
  // For now, use position-based as proxy
  // In production, train ML model and use Shapley values
  return positionBasedAttribution(touchpoints, conversion);
}

/**
 * Get channel attribution summary for a merchant
 *
 * PERFORMANCE ISSUE: N+1 Query Problem (Lines 262-275)
 * ------------------------------------------
 * This function executes one query per conversion in the result set.
 *
 * Problem:
 *   1. First query fetches all conversions for merchant/date range
 *   2. Loop then calls calculateAttribution() for EACH conversion
 *   3. Each calculateAttribution() executes additional DB queries
 *   4. For 1000 conversions = 1 + 1000*3 = 3001 queries
 *
 * Fix Approach (Batch Refactoring):
 *   Option A: Aggregate touchpoints in a single pipeline
 *     - Use $lookup to join touchpoints with conversions
 *     - Calculate attribution in MongoDB aggregation
 *
 *   Option B: Batch fetch touchpoints
 *     - Collect all customerIds from conversions
 *     - Single query: Touchpoint.find({ customerId: { $in: [...] } })
 *     - Group touchpoints by customerId in memory
 *     - Calculate attribution using grouped data
 *
 *   Option C: Pre-aggregate attribution data
 *     - Store attribution results on conversion creation
 *     - Query pre-computed results directly
 */
export async function getChannelAttributionSummary(
  merchantId: string,
  startDate: Date,
  endDate: Date,
  model: AttributionModel = AttributionModel.LAST_TOUCH
): Promise<ChannelAttribution[]> {
  /**
   * PERFORMANCE ISSUE: Unbounded Memory Loading (Lines 254-258)
   * ------------------------------------------
   * Conversion.find() loads ALL matching conversions into memory.
   *
   * Problem:
   *   - Merchants with high volume can have millions of conversions
   *   - All data loaded at once = potential OOM for large date ranges
   *   - No pagination or streaming
   *
   * Fix Approach (Pagination Required):
   *   Use cursor-based pagination with batch processing:
   *
   *   ```typescript
   *   const batchSize = 1000;
   *   let lastId = null;
   *   let hasMore = true;
   *
   *   while (hasMore) {
   *     const conversions = await Conversion.find({
   *       merchantId,
   *       timestamp: { $gte: startDate, $lte: endDate },
   *       status: 'completed',
   *       ...(lastId && { _id: { $gt: lastId } })
   *     }).sort({ _id: 1 }).limit(batchSize);
   *
   *     if (conversions.length === 0) break;
   *     lastId = conversions[conversions.length - 1]._id;
   *
   *     // Process batch...
   *     hasMore = conversions.length === batchSize;
   *   }
   *   ```
   *
   * Alternative: Use MongoDB Aggregation with $out or $merge
   *   - Process in database, write results to temp collection
   *   - Stream results back
   */
  const conversions = await Conversion.find({
    merchantId,
    timestamp: { $gte: startDate, $lte: endDate },
    status: 'completed'
  });

  const channelData = new Map<ChannelType, { conversions: number; revenue: number }>();

  for (const conversion of conversions) {
    const attribution = await calculateAttribution(
      conversion.customerId,
      conversion.conversionId,
      model
    );

    for (const attr of attribution) {
      const current = channelData.get(attr.channel) || { conversions: 0, revenue: 0 };
      current.conversions += 1 * attr.weight;
      current.revenue += attr.revenue;
      channelData.set(attr.channel, current);
    }
  }

  const totalRevenue = conversions.reduce((sum, c) => sum + c.value.amount, 0);

  return Array.from(channelData.entries())
    .map(([channel, data]) => ({
      channel,
      conversions: Math.round(data.conversions * 100) / 100,
      revenue: Math.round(data.revenue * 100) / 100,
      weight: totalRevenue > 0 ? data.revenue / totalRevenue : 0
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

/**
 * Get ROI by channel
 */
export async function getChannelROI(
  merchantId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{
  channel: ChannelType;
  spend: number;
  revenue: number;
  roi: number;
  conversions: number;
}>> {
  const [spendData, attribution] = await Promise.all([
    Spend.aggregate([
      { $match: { merchantId, date: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$channel', totalSpend: { $sum: '$amount' } } }
    ]),
    getChannelAttributionSummary(merchantId, startDate, endDate)
  ]);

  const spendMap = new Map(spendData.map(s => [s._id as ChannelType, s.totalSpend]));

  return attribution.map(a => {
    const spend = spendMap.get(a.channel) || 0;
    const roi = spend > 0 ? ((a.revenue - spend) / spend) * 100 : 0;
    return {
      channel: a.channel,
      spend,
      revenue: a.revenue,
      roi: Math.round(roi * 100) / 100,
      conversions: Math.round(a.conversions)
    };
  }).sort((a, b) => b.roi - a.roi);
}

/**
 * Track DOOH attribution
 */
export async function trackDOOHAttribution(
  merchantId: string,
  screenId: string,
  customerId: string,
  dwellTime: number,
  converted: boolean = false
): Promise<void> {
  await Touchpoint.create({
    touchpointId: `dooh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    merchantId,
    customerId,
    channel: ChannelType.DOOH,
    dooh: {
      screenId,
      screenType: 'unknown',
      impressionCount: 1,
      dwellTime,
      visited: converted
    },
    timestamp: new Date()
  });
}

/**
 * Track QR attribution
 */
export async function trackQRAttribution(
  merchantId: string,
  qrId: string,
  customerId: string,
  context: 'menu' | 'order' | 'payment' | 'feedback' | 'general',
  converted: boolean = false
): Promise<void> {
  await Touchpoint.create({
    touchpointId: `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    merchantId,
    customerId,
    channel: ChannelType.QR,
    qr: {
      qrId,
      context,
      orderAttributed: converted
    },
    timestamp: new Date()
  });
}

/**
 * Track Creator attribution
 */
export async function trackCreatorAttribution(
  merchantId: string,
  creatorId: string,
  platform: 'instagram' | 'youtube' | 'tiktok' | 'twitter',
  customerId: string,
  couponUsed: boolean = false
): Promise<void> {
  await Touchpoint.create({
    touchpointId: `creator_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    merchantId,
    customerId,
    channel: ChannelType.CREATOR,
    creator: {
      creatorId,
      platform,
      contentType: 'post',
      engagement: 0,
      couponUsed
    },
    timestamp: new Date()
  });
}

/**
 * Track Aggregator attribution
 */
export async function trackAggregatorAttribution(
  merchantId: string,
  platform: 'swiggy' | 'zomato' | 'dunzo',
  customerId: string,
  orderPlaced: boolean = false
): Promise<void> {
  await Touchpoint.create({
    touchpointId: `agg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    merchantId,
    customerId,
    channel: ChannelType.AGGREGATOR,
    aggregator: {
      platform,
      listingVisits: 1,
      orderPlaced
    },
    timestamp: new Date()
  });
}
