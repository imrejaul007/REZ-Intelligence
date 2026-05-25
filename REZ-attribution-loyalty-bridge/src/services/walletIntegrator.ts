/**
 * Attribution to Wallet Integrator
 *
 * Connects REZ-unified-attribution to REZ-unified-loyalty
 * Triggers cashback on attributed conversions
 */

import axios from 'axios';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

interface CashbackRequest {
  customerId: string;
  orderId: string;
  amount: number;
  channel: string;
  campaignId?: string;
  merchantId: string;
  attributedChannels: string[];
}

interface CashbackResult {
  success: boolean;
  transactionId?: string;
  coinsAwarded?: number;
  error?: string;
}

// Configuration
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const LOYALTY_SERVICE_URL = process.env.LOYALTY_SERVICE_URL || 'https://rez-loyalty-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Coin rates per channel (per 100 INR)
const CHANNEL_RATES: Record<string, number> = {
  'dooh': 3,        // DOOH gets highest (ad engagement)
  'qr': 2,          // QR code scans
  'search': 1.5,    // Search ads
  'social': 1.5,     // Social media
  'display': 1,      // Display ads
  'email': 1,       // Email marketing
  'referral': 2.5,  // Referrals
  'organic': 0.5     // Organic/repeat
};

export class WalletIntegrator {
  private redis: Redis;
  private dedupWindow = 86400; // 24 hours

  constructor() {
    this.redis = new Redis(REDIS_URL);
  }

  /**
   * Award cashback for attributed conversion
   */
  async awardCashback(request: CashbackRequest): Promise<CashbackResult> {
    const { customerId, orderId, amount, channel, campaignId, merchantId } = request;

    // Check deduplication
    const dedupKey = `cashback:${customerId}:${orderId}`;
    const existing = await this.redis.get(dedupKey);

    if (existing) {
      return {
        success: true,
        transactionId: existing,
        coinsAwarded: 0,
        error: 'Duplicate - already processed'
      };
    }

    try {
      // Calculate coins based on primary channel
      const baseRate = CHANNEL_RATES[channel] || 1;
      const baseCoins = Math.floor((amount / 100) * baseRate);

      // Apply campaign multiplier
      let multiplier = 1;
      if (campaignId) {
        multiplier = await this.getCampaignMultiplier(campaignId);
      }

      // DOOH bonus
      if (request.attributedChannels.includes('dooh')) {
        multiplier *= 1.5; // 1.5x DOOH bonus
      }

      const coinsAwarded = Math.floor(baseCoins * multiplier);

      // Create cashback transaction
      const transactionId = uuidv4();

      // Call wallet service
      await this.callWalletService({
        customerId,
        transactionId,
        coins: coinsAwarded,
        orderId,
        merchantId,
        channel,
        campaignId,
        source: 'attribution'
      });

      // Deduplicate
      await this.redis.set(dedupKey, transactionId, 'EX', this.dedupWindow);

      // Emit event for analytics
      await this.emitCashbackEvent({
        customerId,
        transactionId,
        coinsAwarded,
        channel,
        campaignId,
        orderId
      });

      return {
        success: true,
        transactionId,
        coinsAwarded
      };
    } catch (error) {
      console.error('Cashback award failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Award loyalty points for engagement
   */
  async awardEngagementPoints(data: {
    customerId: string;
    action: string;
    channel: string;
    metadata?: Record<string, unknown>;
  }): Promise<CashbackResult> {
    const { customerId, action, channel, metadata } = data;

    // Points per action
    const actionPoints: Record<string, number> = {
      'ad_view': 1,
      'ad_click': 5,
      'qr_scan': 3,
      'video_view': 2,
      'survey_complete': 10,
      'signup': 20
    };

    const points = actionPoints[action] || 1;

    try {
      const transactionId = uuidv4();

      // Call loyalty service
      await this.callLoyaltyService({
        customerId,
        transactionId,
        points,
        action,
        channel,
        metadata
      });

      return {
        success: true,
        transactionId,
        coinsAwarded: points
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get cashback history for customer
   */
  async getCashbackHistory(customerId: string): Promise<unknown[]> {
    try {
      const response = await axios.get(
        `${WALLET_SERVICE_URL}/api/v1/transactions`,
        {
          params: { customerId, source: 'attribution', limit: 50 },
          headers: { 'X-Internal-Token': INTERNAL_TOKEN },
          timeout: 5000
        }
      );

      return response.data.transactions || [];
    } catch (error) {
      console.error('Error fetching cashback history:', error);
      return [];
    }
  }

  /**
   * Get cashback balance
   */
  async getCashbackBalance(customerId: string): Promise<number> {
    try {
      const response = await axios.get(
        `${WALLET_SERVICE_URL}/api/v1/balance`,
        {
          params: { customerId },
          headers: { 'X-Internal-Token': INTERNAL_TOKEN },
          timeout: 5000
        }
      );

      return response.data.balance || 0;
    } catch (error) {
      console.error('Error fetching balance:', error);
      return 0;
    }
  }

  /**
   * Get campaign multiplier from cache or API
   */
  private async getCampaignMultiplier(campaignId: string): Promise<number> {
    const cacheKey = `campaign:${campaignId}:multiplier`;

    // Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return parseFloat(cached);
    }

    // Fetch from attribution service
    try {
      const response = await axios.get(
        `${process.env.ATTRIBUTION_SERVICE_URL || 'http://localhost:4090'}/api/v1/campaigns/${campaignId}`,
        {
          headers: { 'X-Internal-Token': INTERNAL_TOKEN },
          timeout: 5000
        }
      );

      const multiplier = response.data.multiplier || 1;

      // Cache for 1 hour
      await this.redis.set(cacheKey, multiplier.toString(), 'EX', 3600);

      return multiplier;
    } catch (error) {
      return 1;
    }
  }

  /**
   * Call wallet service to create transaction
   */
  private async callWalletService(data: {
    customerId: string;
    transactionId: string;
    coins: number;
    orderId: string;
    merchantId: string;
    channel: string;
    campaignId?: string;
    source: string;
  }): Promise<void> {
    await axios.post(
      `${WALLET_SERVICE_URL}/api/v1/transactions/credit`,
      {
        customerId: data.customerId,
        transactionId: data.transactionId,
        amount: data.coins,
        type: 'cashback',
        source: data.source,
        metadata: {
          orderId: data.orderId,
          merchantId: data.merchantId,
          channel: data.channel,
          campaignId: data.campaignId
        }
      },
      {
        headers: {
          'X-Internal-Token': INTERNAL_TOKEN,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
  }

  /**
   * Call loyalty service for engagement points
   */
  private async callLoyaltyService(data: {
    customerId: string;
    transactionId: string;
    points: number;
    action: string;
    channel: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await axios.post(
      `${LOYALTY_SERVICE_URL}/api/v1/points/credit`,
      {
        customerId: data.customerId,
        transactionId: data.transactionId,
        points: data.points,
        action: data.action,
        channel: data.channel,
        metadata: data.metadata
      },
      {
        headers: {
          'X-Internal-Token': INTERNAL_TOKEN,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
  }

  /**
   * Emit cashback event for analytics
   */
  private async emitCashbackEvent(data: {
    customerId: string;
    transactionId: string;
    coinsAwarded: number;
    channel: string;
    campaignId?: string;
    orderId: string;
  }): Promise<void> {
    const channel = `attribution:cashback`;
    await this.redis.publish(channel, JSON.stringify({
      ...data,
      timestamp: new Date().toISOString()
    }));
  }

  /**
   * Get channel rates (for API exposure)
   */
  getChannelRates(): Record<string, number> {
    return { ...CHANNEL_RATES };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}

export const walletIntegrator = new WalletIntegrator();
