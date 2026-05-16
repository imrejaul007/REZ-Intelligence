/**
 * Loyalty Trigger Service
 * Triggers loyalty rewards (coins, cashback) on conversions
 *
 * Features:
 * - Integration with REZ wallet/rewards services
 * - Real-time reward notifications
 * - Transaction idempotency
 * - Retry with exponential backoff
 * - Event-driven architecture
 */

import axios, { AxiosInstance } from 'axios';
import { BridgeRecord } from '../models/BridgeRecord.js';
import { CampaignConfig } from '../models/CampaignConfig.js';
import { loyaltyLogger as logger } from './logger.js';
import { LoyaltyTriggerRequest } from '../types/schemas.js';

// ============================================
// TYPES
// ============================================

export interface LoyaltyTriggerResult {
  success: boolean;
  bridgeId: string;
  loyaltyTransactionId?: string;
  walletTransactionId?: string;
  coinsAwarded: number;
  cashbackAwarded: number;
  notificationSent: boolean;
  error?: string;
}

export interface RewardNotification {
  userId: string;
  title: string;
  message: string;
  type: 'reward' | 'milestone' | 'campaign' | 'expiry';
  data: {
    coinsEarned?: number;
    cashbackEarned?: number;
    totalBalance?: number;
    campaignName?: string;
    expiryDate?: string;
  };
}

// ============================================
// LOYALTY TRIGGER SERVICE
// ============================================

export class LoyaltyTriggerService {
  private walletServiceUrl: string;
  private rewardsServiceUrl: string;
  private notificationServiceUrl: string;
  private internalToken: string;
  private httpClient: AxiosInstance;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor() {
    this.walletServiceUrl = process.env.WALLET_SERVICE_URL || 'http://localhost:4002';
    this.rewardsServiceUrl = process.env.REWARDS_SERVICE_URL || 'http://localhost:4008';
    this.notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4004';
    this.internalToken = process.env.INTERNAL_SERVICE_TOKEN || '';
    this.maxRetries = 3;
    this.retryDelayMs = 1000;

    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': this.internalToken
      }
    });
  }

  /**
   * Trigger loyalty reward for a bridge record
   */
  async triggerReward(bridgeRecordId: string): Promise<LoyaltyTriggerResult> {
    const bridgeRecord = await BridgeRecord.findById(bridgeRecordId);

    if (!bridgeRecord) {
      throw new Error(`Bridge record not found: ${bridgeRecordId}`);
    }

    if (bridgeRecord.status === 'completed') {
      logger.warn('Bridge record already processed', { bridgeId: bridgeRecord.bridgeId });
      return {
        success: true,
        bridgeId: bridgeRecord.bridgeId,
        loyaltyTransactionId: bridgeRecord.loyaltyTransactionId,
        walletTransactionId: bridgeRecord.walletTransactionId,
        coinsAwarded: bridgeRecord.totalCoins,
        cashbackAwarded: bridgeRecord.totalCashback,
        notificationSent: false
      };
    }

    try {
      // Mark as processing
      await bridgeRecord.markProcessing();

      // Get or create user ID from customer ID
      const userId = await this.resolveUserId(bridgeRecord.customerId);

      if (!userId) {
        throw new Error(`Could not resolve user ID for customer: ${bridgeRecord.customerId}`);
      }

      // Award coins to wallet
      const coinsResult = await this.awardCoins(userId, bridgeRecord);

      // Award cashback if applicable
      let cashbackResult = null;
      if (bridgeRecord.totalCashback > 0) {
        cashbackResult = await this.awardCashback(userId, bridgeRecord);
      }

      // Send notification
      const notificationSent = await this.sendRewardNotification(userId, bridgeRecord, coinsResult);

      // Update bridge record
      await bridgeRecord.markCompleted(
        coinsResult.transactionId,
        cashbackResult?.transactionId
      );

      // Update campaign stats if applicable
      if (bridgeRecord.campaignId) {
        await this.updateCampaignStats(bridgeRecord.campaignId, bridgeRecord.totalCoins);
      }

      logger.info('Reward triggered successfully', {
        bridgeId: bridgeRecord.bridgeId,
        coinsAwarded: bridgeRecord.totalCoins,
        cashbackAwarded: bridgeRecord.totalCashback,
        userId
      });

      return {
        success: true,
        bridgeId: bridgeRecord.bridgeId,
        loyaltyTransactionId: coinsResult.transactionId,
        walletTransactionId: cashbackResult?.transactionId,
        coinsAwarded: bridgeRecord.totalCoins,
        cashbackAwarded: bridgeRecord.totalCashback,
        notificationSent
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to trigger reward', {
        bridgeId: bridgeRecord.bridgeId,
        error: errorMessage
      });

      await bridgeRecord.markFailed(errorMessage);

      return {
        success: false,
        bridgeId: bridgeRecord.bridgeId,
        coinsAwarded: 0,
        cashbackAwarded: 0,
        notificationSent: false,
        error: errorMessage
      };
    }
  }

  /**
   * Resolve user ID from customer ID
   */
  private async resolveUserId(customerId: string): Promise<string | null> {
    try {
      // Try to get user ID from identity service or customer service
      // For now, we assume customerId == userId in most cases
      // In production, this would call the identity service
      return customerId;
    } catch (error) {
      logger.error('Failed to resolve user ID', { customerId, error });
      return null;
    }
  }

  /**
   * Award coins to user wallet
   */
  private async awardCoins(
    userId: string,
    bridgeRecord: BridgeRecord
  ): Promise<{ transactionId: string; newBalance: number }> {
    const payload = {
      userId,
      amount: bridgeRecord.totalCoins,
      coinType: bridgeRecord.coinType,
      source: 'attribution_bridge',
      referenceId: bridgeRecord.bridgeId,
      referenceType: 'conversion',
      metadata: {
        conversionId: bridgeRecord.conversionId,
        merchantId: bridgeRecord.merchantId,
        campaignId: bridgeRecord.campaignId,
        channels: bridgeRecord.attributedChannels,
        attributionModel: bridgeRecord.attributionModel
      },
      expiresIn: bridgeRecord.expiresAt
        ? Math.floor((bridgeRecord.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : undefined
    };

    const response = await this.callWithRetry(
      `${this.walletServiceUrl}/api/v1/wallet/credit`,
      'POST',
      payload
    );

    return {
      transactionId: response.data.transactionId,
      newBalance: response.data.newBalance
    };
  }

  /**
   * Award cashback to user wallet
   */
  private async awardCashback(
    userId: string,
    bridgeRecord: BridgeRecord
  ): Promise<{ transactionId: string; newBalance: number }> {
    const payload = {
      userId,
      amount: bridgeRecord.totalCashback,
      type: 'cashback',
      source: 'attribution_bridge',
      referenceId: bridgeRecord.bridgeId,
      referenceType: 'conversion',
      metadata: {
        conversionId: bridgeRecord.conversionId,
        merchantId: bridgeRecord.merchantId,
        campaignId: bridgeRecord.campaignId
      }
    };

    const response = await this.callWithRetry(
      `${this.walletServiceUrl}/api/v1/wallet/cashback`,
      'POST',
      payload
    );

    return {
      transactionId: response.data.transactionId,
      newBalance: response.data.newBalance
    };
  }

  /**
   * Send reward notification to user
   */
  private async sendRewardNotification(
    userId: string,
    bridgeRecord: BridgeRecord,
    coinsResult: { newBalance: number }
  ): Promise<boolean> {
    try {
      // Get campaign name if applicable
      let campaignName: string | undefined;
      if (bridgeRecord.campaignId) {
        const campaign = await CampaignConfig.findByCampaignId(bridgeRecord.campaignId);
        campaignName = campaign?.name;
      }

      const notification: RewardNotification = {
        userId,
        title: bridgeRecord.totalCashback > 0
          ? `Earned ${bridgeRecord.totalCoins} coins + ${bridgeRecord.totalCashback} cashback!`
          : `Earned ${bridgeRecord.totalCoins} REZ coins!`,
        message: this.buildNotificationMessage(bridgeRecord, campaignName),
        type: 'reward',
        data: {
          coinsEarned: bridgeRecord.totalCoins,
          cashbackEarned: bridgeRecord.totalCashback > 0 ? bridgeRecord.totalCashback : undefined,
          totalBalance: coinsResult.newBalance,
          campaignName
        }
      };

      await this.httpClient.post(
        `${this.notificationServiceUrl}/api/v1/notifications`,
        notification
      );

      logger.info('Reward notification sent', {
        userId,
        bridgeId: bridgeRecord.bridgeId
      });

      return true;
    } catch (error) {
      logger.error('Failed to send reward notification', {
        userId,
        bridgeId: bridgeRecord.bridgeId,
        error
      });
      return false;
    }
  }

  /**
   * Build notification message
   */
  private buildNotificationMessage(
    bridgeRecord: BridgeRecord,
    campaignName?: string
  ): string {
    const channels = bridgeRecord.attributedChannels.join(', ');
    let message = `Thanks to your ${channels} purchase, `;

    if (bridgeRecord.totalCashback > 0) {
      message += `you've earned ${bridgeRecord.totalCoins} REZ coins and ${bridgeRecord.totalCashback} cashback!`;
    } else {
      message += `you've earned ${bridgeRecord.totalCoins} REZ coins!`;
    }

    if (campaignName) {
      message += ` Campaign bonus applied: ${campaignName}`;
    }

    return message;
  }

  /**
   * Update campaign statistics
   */
  private async updateCampaignStats(campaignId: string, coinsAwarded: number): Promise<void> {
    try {
      const campaign = await CampaignConfig.findByCampaignId(campaignId);
      if (campaign) {
        await campaign.recordRedemption(coinsAwarded);
        logger.info('Campaign stats updated', { campaignId, coinsAwarded });
      }
    } catch (error) {
      logger.error('Failed to update campaign stats', { campaignId, error });
    }
  }

  /**
   * Call external service with retry logic
   */
  private async callWithRetry(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH',
    data?: unknown,
    attempt: number = 1
  ): Promise<{ data: Record<string, unknown> }> {
    try {
      const response = await this.httpClient.request({
        url,
        method,
        data
      });
      return response;
    } catch (error) {
      if (attempt >= this.maxRetries) {
        throw error;
      }

      const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
      logger.warn(`Retrying ${method} ${url}, attempt ${attempt + 1} in ${delay}ms`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return this.callWithRetry(url, method, data, attempt + 1);
    }
  }

  /**
   * Process pending bridge records (batch processing)
   */
  async processPendingRecords(limit: number = 100): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const pendingRecords = await BridgeRecord.find({
      status: { $in: ['pending', 'failed'] },
      $or: [
        { nextRetryAt: { $exists: false } },
        { nextRetryAt: { $lte: new Date() } }
      ]
    }).limit(limit);

    let succeeded = 0;
    let failed = 0;

    for (const record of pendingRecords) {
      const result = await this.triggerReward(record._id.toString());
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    logger.info('Batch processing complete', {
      processed: pendingRecords.length,
      succeeded,
      failed
    });

    return {
      processed: pendingRecords.length,
      succeeded,
      failed
    };
  }

  /**
   * Sync specific bridge record (manual trigger)
   */
  async syncBridgeRecord(bridgeId: string): Promise<LoyaltyTriggerResult> {
    const bridgeRecord = await BridgeRecord.findOne({ bridgeId });

    if (!bridgeRecord) {
      throw new Error(`Bridge record not found: ${bridgeId}`);
    }

    return this.triggerReward(bridgeRecord._id.toString());
  }

  /**
   * Cancel pending bridge record
   */
  async cancelBridgeRecord(bridgeId: string, reason: string): Promise<void> {
    const bridgeRecord = await BridgeRecord.findOne({ bridgeId });

    if (!bridgeRecord) {
      throw new Error(`Bridge record not found: ${bridgeId}`);
    }

    if (bridgeRecord.status === 'completed') {
      throw new Error('Cannot cancel completed bridge record');
    }

    bridgeRecord.status = 'failed';
    bridgeRecord.errorMessage = `Cancelled: ${reason}`;
    await bridgeRecord.save();

    logger.info('Bridge record cancelled', { bridgeId, reason });
  }
}

// ============================================
// EXPORT SINGLETON INSTANCE
// ============================================

export const loyaltyTriggerService = new LoyaltyTriggerService();
