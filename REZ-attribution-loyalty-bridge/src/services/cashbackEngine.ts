/**
 * Cashback Engine Service
 * Calculates cashback and loyalty rewards based on attribution data
 *
 * Features:
 * - Channel-specific reward rates
 * - DOOH bonus multipliers
 * - Campaign-based multipliers
 * - Attribution model weight distribution
 * - Multi-channel revenue splitting
 */

import { v4 as uuidv4 } from 'uuid';
import { BridgeRecord } from '../models/BridgeRecord.js';
import { CampaignConfig } from '../models/CampaignConfig.js';
import { cashbackLogger as logger } from './logger.js';
import {
  CashbackRequest,
  ChannelType,
  ChannelTypeSchema,
  CreateBridgeRecordSchema
} from '../types/schemas.js';

// ============================================
// TYPES
// ============================================

export interface ChannelRewardRate {
  baseCoinsPerHundred: number;
  bonusMultiplier: number;
  maxCashbackPercent: number;
}

export interface ChannelCalculation {
  channel: ChannelType;
  attributedRevenue: number;
  percentage: number;
  baseCoins: number;
  bonusMultiplier: number;
  finalCoins: number;
  cashbackAmount: number;
}

export interface CashbackCalculationResult {
  bridgeId: string;
  conversionId: string;
  customerId: string;
  merchantId: string;
  orderValue: number;
  currency: string;
  attributedChannels: ChannelType[];
  attributionModel: string;
  channelCalculations: ChannelCalculation[];
  totalCoins: number;
  totalCashback: number;
  campaignId?: string;
  campaignMultiplier: number;
  coinType: 'rez';
}

// ============================================
// DEFAULT CHANNEL REWARD RATES
// ============================================

const DEFAULT_CHANNEL_REWARDS: Record<ChannelType, ChannelRewardRate> = {
  dooh: { baseCoinsPerHundred: 3, bonusMultiplier: 1.5, maxCashbackPercent: 10 },
  qr: { baseCoinsPerHundred: 2, bonusMultiplier: 1.0, maxCashbackPercent: 8 },
  referral: { baseCoinsPerHundred: 3, bonusMultiplier: 1.0, maxCashbackPercent: 10 },
  creator: { baseCoinsPerHundred: 2.5, bonusMultiplier: 1.25, maxCashbackPercent: 8 },
  search: { baseCoinsPerHundred: 1.5, bonusMultiplier: 1.0, maxCashbackPercent: 5 },
  social: { baseCoinsPerHundred: 1.5, bonusMultiplier: 1.0, maxCashbackPercent: 5 },
  email: { baseCoinsPerHundred: 1, bonusMultiplier: 1.0, maxCashbackPercent: 5 },
  sms: { baseCoinsPerHundred: 1, bonusMultiplier: 1.0, maxCashbackPercent: 5 },
  display: { baseCoinsPerHundred: 1, bonusMultiplier: 1.0, maxCashbackPercent: 5 },
  video: { baseCoinsPerHundred: 1, bonusMultiplier: 1.0, maxCashbackPercent: 5 },
  push: { baseCoinsPerHundred: 1, bonusMultiplier: 1.0, maxCashbackPercent: 5 },
  print: { baseCoinsPerHundred: 0.5, bonusMultiplier: 1.0, maxCashbackPercent: 3 },
  ooh: { baseCoinsPerHundred: 0.5, bonusMultiplier: 1.0, maxCashbackPercent: 3 },
  walkin: { baseCoinsPerHundred: 0.5, bonusMultiplier: 1.0, maxCashbackPercent: 3 },
  organic: { baseCoinsPerHundred: 1, bonusMultiplier: 1.0, maxCashbackPercent: 5 },
  wallet: { baseCoinsPerHundred: 1, bonusMultiplier: 1.0, maxCashbackPercent: 5 },
  loyalty: { baseCoinsPerHundred: 0.5, bonusMultiplier: 1.0, maxCashbackPercent: 3 },
  aggregator: { baseCoinsPerHundred: 0.5, bonusMultiplier: 1.0, maxCashbackPercent: 3 },
  direct: { baseCoinsPerHundred: 0.5, bonusMultiplier: 1.0, maxCashbackPercent: 2 },
  unknown: { baseCoinsPerHundred: 0.5, bonusMultiplier: 1.0, maxCashbackPercent: 2 }
};

// DOOH-specific bonus multiplier (as per requirements)
const DOOH_BONUS_MULTIPLIER = parseFloat(process.env.DOOH_BONUS_MULTIPLIER || '1.5');

// ============================================
// CASHBACK ENGINE CLASS
// ============================================

export class CashbackEngine {
  private channelRewards: Map<ChannelType, ChannelRewardRate>;

  constructor(customRewards?: Partial<Record<ChannelType, ChannelRewardRate>>) {
    this.channelRewards = new Map(Object.entries(DEFAULT_CHANNEL_REWARDS) as [ChannelType, ChannelRewardRate][]);

    // Apply custom overrides
    if (customRewards) {
      for (const [channel, rate] of Object.entries(customRewards)) {
        const validatedChannel = ChannelTypeSchema.parse(channel);
        this.channelRewards.set(validatedChannel, rate);
      }
    }
  }

  /**
   * Load channel rewards from environment variables
   */
  loadFromEnv(): void {
    const envRewards = process.env.CHANNEL_BASE_REWARDS_JSON;
    if (envRewards) {
      try {
        const parsed = JSON.parse(envRewards);
        for (const [channel, coins] of Object.entries(parsed)) {
          const validatedChannel = ChannelTypeSchema.parse(channel);
          const existing = this.channelRewards.get(validatedChannel);
          if (existing) {
            this.channelRewards.set(validatedChannel, {
              ...existing,
              baseCoinsPerHundred: coins as number
            });
          }
        }
        logger.info('Loaded channel rewards from environment', { count: Object.keys(parsed).length });
      } catch (error) {
        logger.error('Failed to parse CHANNEL_BASE_REWARDS_JSON', { error });
      }
    }
  }

  /**
   * Get reward rate for a specific channel
   */
  getRewardRate(channel: ChannelType): ChannelRewardRate {
    return this.channelRewards.get(channel) || DEFAULT_CHANNEL_REWARDS.unknown;
  }

  /**
   * Calculate attribution weights based on attribution model
   */
  calculateAttributionWeights(
    channels: ChannelType[],
    attributedRevenue: Map<ChannelType, number> | Record<string, number>,
    attributionModel: string,
    totalOrderValue: number
  ): Map<ChannelType, { revenue: number; percentage: number }> {
    const weights = new Map<ChannelType, { revenue: number; percentage: number }>();

    switch (attributionModel) {
      case 'last_touch': {
        // All credit to the last touchpoint
        const lastChannel = channels[channels.length - 1];
        weights.set(lastChannel, { revenue: totalOrderValue, percentage: 100 });
        break;
      }

      case 'first_touch': {
        // All credit to the first touchpoint
        const firstChannel = channels[0];
        weights.set(firstChannel, { revenue: totalOrderValue, percentage: 100 });
        break;
      }

      case 'last_non_direct': {
        // All credit to last non-direct channel
        const nonDirectChannels = channels.filter(c => c !== 'direct');
        if (nonDirectChannels.length > 0) {
          const lastNonDirect = nonDirectChannels[nonDirectChannels.length - 1];
          weights.set(lastNonDirect, { revenue: totalOrderValue, percentage: 100 });
        } else {
          weights.set('direct', { revenue: totalOrderValue, percentage: 100 });
        }
        break;
      }

      case 'linear': {
        // Equal weight across all touchpoints
        const equalWeight = 100 / channels.length;
        for (const channel of channels) {
          const revenue = totalOrderValue / channels.length;
          weights.set(channel, { revenue, percentage: equalWeight });
        }
        break;
      }

      case 'time_decay': {
        // More recent touchpoints get more credit
        const decayFactor = 0.7; // Half-life factor
        let totalWeight = 0;
        const rawWeights: number[] = [];

        for (let i = 0; i < channels.length; i++) {
          const weight = Math.pow(decayFactor, channels.length - 1 - i);
          rawWeights.push(weight);
          totalWeight += weight;
        }

        for (let i = 0; i < channels.length; i++) {
          const normalizedWeight = (rawWeights[i] / totalWeight) * 100;
          const revenue = (rawWeights[i] / totalWeight) * totalOrderValue;
          weights.set(channels[i], { revenue, percentage: normalizedWeight });
        }
        break;
      }

      case 'position_based': {
        // 40% first, 40% last, 20% distributed among middle
        const firstChannel = channels[0];
        const lastChannel = channels[channels.length - 1];

        if (channels.length === 1) {
          weights.set(firstChannel, { revenue: totalOrderValue, percentage: 100 });
        } else if (channels.length === 2) {
          weights.set(firstChannel, { revenue: totalOrderValue * 0.5, percentage: 50 });
          weights.set(lastChannel, { revenue: totalOrderValue * 0.5, percentage: 50 });
        } else {
          // First gets 40%
          weights.set(firstChannel, { revenue: totalOrderValue * 0.4, percentage: 40 });
          // Last gets 40%
          weights.set(lastChannel, { revenue: totalOrderValue * 0.4, percentage: 40 });
          // Middle channels split 20%
          const middleChannels = channels.slice(1, -1);
          const middleShare = totalOrderValue * 0.2 / middleChannels.length;
          for (const channel of middleChannels) {
            weights.set(channel, { revenue: middleShare, percentage: 20 / middleChannels.length });
          }
        }
        break;
      }

      case 'data_driven': {
        // Use attributed revenue if provided, otherwise fall back to linear
        if (attributedRevenue && Object.keys(attributedRevenue).length > 0) {
          for (const channel of channels) {
            const revenue = (attributedRevenue as Record<string, number>)[channel] || 0;
            const percentage = totalOrderValue > 0 ? (revenue / totalOrderValue) * 100 : 0;
            weights.set(channel, { revenue, percentage });
          }
        } else {
          // Fall back to linear
          const equalWeight = 100 / channels.length;
          for (const channel of channels) {
            const revenue = totalOrderValue / channels.length;
            weights.set(channel, { revenue, percentage: equalWeight });
          }
        }
        break;
      }

      default: {
        // Default to linear
        const equalWeight = 100 / channels.length;
        for (const channel of channels) {
          const revenue = totalOrderValue / channels.length;
          weights.set(channel, { revenue, percentage: equalWeight });
        }
      }
    }

    return weights;
  }

  /**
   * Calculate coins for a single channel
   */
  calculateChannelCoins(
    channel: ChannelType,
    attributedRevenue: number,
    percentage: number
  ): { baseCoins: number; bonusMultiplier: number; finalCoins: number } {
    const rate = this.getRewardRate(channel);
    let bonusMultiplier = rate.bonusMultiplier;

    // Apply DOOH bonus if applicable
    if (channel === 'dooh') {
      bonusMultiplier *= DOOH_BONUS_MULTIPLIER;
    }

    // Calculate coins: (attributedRevenue / 100) * baseCoinsPerHundred
    const baseCoins = (attributedRevenue / 100) * rate.baseCoinsPerHundred;
    const finalCoins = Math.round(baseCoins * bonusMultiplier * 100) / 100;

    return { baseCoins, bonusMultiplier, finalCoins };
  }

  /**
   * Calculate cashback amount
   */
  calculateCashback(
    attributedRevenue: number,
    channel: ChannelType,
    finalCoins: number
  ): number {
    const rate = this.getRewardRate(channel);
    const maxCashbackPercent = rate.maxCashbackPercent;

    // Cashback is 1% of attributed revenue, capped by maxCashbackPercent
    const maxCashback = (attributedRevenue * maxCashbackPercent) / 100;

    // Cashback is 10% of coins value (assuming 1 coin = 1 INR for now)
    const coinValueCashback = finalCoins * 0.1;

    return Math.min(maxCashback, coinValueCashback);
  }

  /**
   * Get campaign multiplier for a channel
   */
  async getCampaignMultiplier(
    campaignId?: string,
    merchantId?: string,
    channel?: ChannelType
  ): Promise<number> {
    if (!campaignId) {
      return 1;
    }

    try {
      const campaign = await CampaignConfig.findByCampaignId(campaignId);
      if (!campaign) {
        // Try to parse from environment variable
        const multipliers = process.env.CAMPAIGN_MULTIPLIERS_JSON;
        if (multipliers) {
          const parsed = JSON.parse(multipliers);
          return parsed[campaignId] || 1;
        }
        return 1;
      }

      // Check eligibility
      if (channel && !campaign.isChannelEligible(channel)) {
        return 1;
      }

      return campaign.rewardMultiplier;
    } catch (error) {
      logger.error('Failed to get campaign multiplier', { campaignId, error });
      return 1;
    }
  }

  /**
   * Main calculation method - calculate full cashback for a conversion
   */
  async calculate(
    request: CashbackRequest
  ): Promise<CashbackCalculationResult> {
    const {
      conversionId,
      customerId,
      merchantId,
      orderValue,
      currency,
      channels,
      campaignId,
      attributionModel,
      attributedRevenue
    } = request;

    logger.info('Calculating cashback', {
      conversionId,
      customerId,
      orderValue,
      channels
    });

    // Validate channels
    const validatedChannels = channels.map(c => ChannelTypeSchema.parse(c));
    const uniqueChannels = [...new Set(validatedChannels)];

    // Calculate attribution weights
    const attributionWeights = this.calculateAttributionWeights(
      uniqueChannels,
      attributedRevenue || {},
      attributionModel,
      orderValue
    );

    // Get campaign multiplier
    const campaignMultiplier = await this.getCampaignMultiplier(
      campaignId,
      merchantId,
      uniqueChannels[0]
    );

    // Calculate rewards for each channel
    const channelCalculations: ChannelCalculation[] = [];
    let totalCoins = 0;
    let totalCashback = 0;

    for (const [channel, { revenue, percentage }] of attributionWeights.entries()) {
      const { baseCoins, bonusMultiplier, finalCoins } = this.calculateChannelCoins(
        channel,
        revenue,
        percentage
      );

      const cashbackAmount = this.calculateCashback(revenue, channel, finalCoins);
      const adjustedCoins = Math.round(finalCoins * campaignMultiplier * 100) / 100;

      channelCalculations.push({
        channel,
        attributedRevenue: revenue,
        percentage,
        baseCoins,
        bonusMultiplier,
        finalCoins: adjustedCoins,
        cashbackAmount
      });

      totalCoins += adjustedCoins;
      totalCashback += cashbackAmount;
    }

    // Round totals
    totalCoins = Math.round(totalCoins * 100) / 100;
    totalCashback = Math.round(totalCashback * 100) / 100;

    logger.info('Cashback calculation complete', {
      conversionId,
      totalCoins,
      totalCashback,
      channelCount: channelCalculations.length
    });

    return {
      bridgeId: uuidv4(),
      conversionId,
      customerId,
      merchantId,
      orderValue,
      currency,
      attributedChannels: uniqueChannels,
      attributionModel,
      channelCalculations,
      totalCoins,
      totalCashback,
      campaignId,
      campaignMultiplier,
      coinType: 'rez'
    };
  }

  /**
   * Create a bridge record from calculation result
   */
  async createBridgeRecord(calculation: CashbackCalculationResult): Promise<string> {
    const channelBreakdown: Record<string, { coins: number; cashback: number; percentage: number }> = {};

    for (const calc of calculation.channelCalculations) {
      channelBreakdown[calc.channel] = {
        coins: calc.finalCoins,
        cashback: calc.cashbackAmount,
        percentage: calc.percentage
      };
    }

    const bridgeRecordData = {
      bridgeId: calculation.bridgeId,
      conversionId: calculation.conversionId,
      customerId: calculation.customerId,
      merchantId: calculation.merchantId,
      orderValue: calculation.orderValue,
      currency: calculation.currency,
      attributedChannels: calculation.attributedChannels,
      attributionModel: calculation.attributionModel,
      attributedRevenue: calculation.channelCalculations.reduce(
        (acc, calc) => ({ ...acc, [calc.channel]: calc.attributedRevenue }),
        {} as Record<string, number>
      ),
      totalCoins: calculation.totalCoins,
      totalCashback: calculation.totalCashback,
      coinType: calculation.coinType,
      channelBreakdown,
      campaignId: calculation.campaignId,
      campaignMultiplier: calculation.campaignMultiplier,
      status: 'pending' as const
    };

    const validatedData = CreateBridgeRecordSchema.parse(bridgeRecordData);
    const bridgeRecord = new BridgeRecord(validatedData);
    await bridgeRecord.save();

    logger.info('Bridge record created', {
      bridgeId: bridgeRecord.bridgeId,
      conversionId: bridgeRecord.conversionId
    });

    return bridgeRecord.bridgeId;
  }

  /**
   * Calculate and create bridge record in one operation
   */
  async calculateAndCreate(request: CashbackRequest): Promise<string> {
    const calculation = await this.calculate(request);
    return this.createBridgeRecord(calculation);
  }
}

// ============================================
// EXPORT SINGLETON INSTANCE
// ============================================

export const cashbackEngine = new CashbackEngine();
