/**
 * ReferralModule - Referral Program Management
 * Manages referral codes, tracking, and rewards
 */

import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import { ConsumerGraph } from '../ConsumerGraph';

export interface Referral {
  referral_id: string;
  referrer_id: string;
  referred_id?: string;
  referral_code: string;
  status: 'pending' | 'signed_up' | 'purchased' | 'completed';
  created_at: string;
  signup_at?: string;
  first_purchase_at?: string;
  referrer_reward?: number;
  referred_reward?: number;
}

export interface ReferralSummary {
  referral_count: number;
  successful_referrals: number;
  pending_referrals: number;
  total_earnings: number;
  referral_code: string;
}

export class ReferralModule {
  private consumerGraph: ConsumerGraph;
  private logger: winston.Logger;

  // Local storage
  private referrals: Map<string, Referral>;
  private codeToReferral: Map<string, string>; // code -> referralId
  private userReferrals: Map<string, Set<string>>; // userId -> Set<referralIds>

  constructor(consumerGraph: ConsumerGraph) {
    this.consumerGraph = consumerGraph;
    this.referrals = new Map();
    this.codeToReferral = new Map();
    this.userReferrals = new Map();

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });

    this.logger.info('ReferralModule initialized');
  }

  // ============================================
  // REFERRAL CODE MANAGEMENT
  // ============================================

  /**
   * Generate referral code
   */
  async generateReferralCode(userId: string): Promise<string> {
    const profile = this.consumerGraph.getConsumer(userId);
    if (!profile) {
      throw new Error('Consumer not found');
    }

    // Generate unique code (format: REZ-XXXXX)
    const code = `REZ-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Create referral record
    const referral: Referral = {
      referral_id: uuidv4(),
      referrer_id: userId,
      referral_code: code,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    this.referrals.set(referral.referral_id, referral);
    this.codeToReferral.set(code, referral.referral_id);

    if (!this.userReferrals.has(userId)) {
      this.userReferrals.set(userId, new Set());
    }
    this.userReferrals.get(userId)!.add(referral.referral_id);

    this.logger.info('Referral code generated', { userId, code });
    return code;
  }

  /**
   * Get referral code for user
   */
  async getReferralCode(userId: string): Promise<string | null> {
    const referrals = this.userReferrals.get(userId);
    if (!referrals || referrals.size === 0) {
      return null;
    }

    for (const referralId of referrals) {
      const referral = this.referrals.get(referralId);
      if (referral) {
        return referral.referral_code;
      }
    }

    return null;
  }

  /**
   * Validate referral code
   */
  async validateReferralCode(code: string): Promise<{
    valid: boolean;
    referrer_id?: string;
    error?: string;
  }> {
    const referralId = this.codeToReferral.get(code);
    if (!referralId) {
      return { valid: false, error: 'Invalid referral code' };
    }

    const referral = this.referrals.get(referralId);
    if (!referral) {
      return { valid: false, error: 'Referral not found' };
    }

    if (referral.status !== 'pending') {
      return { valid: false, error: 'Referral code already used' };
    }

    return { valid: true, referrer_id: referral.referrer_id };
  }

  // ============================================
  // REFERRAL TRACKING
  // ============================================

  /**
   * Process referral signup
   */
  async processSignup(
    code: string,
    referredUserId: string
  ): Promise<{ success: boolean; referrer_reward: number; error?: string }> {
    const validation = await this.validateReferralCode(code);
    if (!validation.valid || !validation.referrer_id) {
      return { success: false, referrer_reward: 0, error: validation.error };
    }

    const referralId = this.codeToReferral.get(code);
    if (!referralId) {
      return { success: false, referrer_reward: 0, error: 'Referral not found' };
    }

    const referral = this.referrals.get(referralId)!;
    const referrerId = referral.referrer_id;

    // Update referral
    referral.referred_id = referredUserId;
    referral.status = 'signed_up';
    referral.signup_at = new Date().toISOString();

    // Process rewards
    const referrerReward = 200; // Points for referrer
    const referredReward = 100; // Points for referred user

    referral.referrer_reward = referrerReward;
    referral.referred_reward = referredReward;

    // Credit rewards
    const loyaltyModule = this.consumerGraph.getLoyaltyModule();
    await loyaltyModule.processReferralSignup(referrerId, referredUserId);

    this.logger.info('Referral signup processed', {
      referrerId,
      referredUserId,
      referrerReward,
      referredReward,
    });

    return { success: true, referrer_reward: referrerReward };
  }

  /**
   * Process referral purchase
   */
  async processPurchase(
    referredUserId: string,
    purchaseAmount: number
  ): Promise<{ success: boolean; referrer_reward: number }> {
    // Find referral for this user
    let referral: Referral | undefined;
    for (const ref of this.referrals.values()) {
      if (ref.referred_id === referredUserId && ref.status === 'signed_up') {
        referral = ref;
        break;
      }
    }

    if (!referral) {
      return { success: false, referrer_reward: 0 };
    }

    // Update referral
    referral.status = 'purchased';
    referral.first_purchase_at = new Date().toISOString();

    // Calculate bonus reward (percentage of first purchase)
    const referrerReward = Math.floor(purchaseAmount * 0.1); // 10% of purchase
    referral.referrer_reward = (referral.referrer_reward || 0) + referrerReward;

    // Process rewards
    const loyaltyModule = this.consumerGraph.getLoyaltyModule();
    await loyaltyModule.processReferralPurchase(
      referral.referrer_id,
      referredUserId,
      purchaseAmount
    );

    this.logger.info('Referral purchase processed', {
      referrerId: referral.referrer_id,
      referredUserId,
      purchaseAmount,
      referrerReward,
    });

    return { success: true, referrer_reward: referrerReward };
  }

  // ============================================
  // SUMMARIES
  // ============================================

  /**
   * Get referral summary for user
   */
  async getReferralSummary(userId: string): Promise<ReferralSummary> {
    const userReferralIds = this.userReferrals.get(userId) || new Set();
    const referrals = Array.from(userReferralIds)
      .map((id) => this.referrals.get(id))
      .filter((r): r is Referral => r !== undefined);

    const successfulReferrals = referrals.filter(
      (r) => r.status === 'purchased' || r.status === 'completed'
    );
    const pendingReferrals = referrals.filter((r) => r.status === 'pending' || r.status === 'signed_up');
    const totalEarnings = successfulReferrals.reduce(
      (sum, r) => sum + (r.referrer_reward || 0),
      0
    );

    const referralCode = await this.getReferralCode(userId);

    return {
      referral_count: referrals.length,
      successful_referrals: successfulReferrals.length,
      pending_referrals: pendingReferrals.length,
      total_earnings: totalEarnings,
      referral_code: referralCode || '',
    };
  }

  /**
   * Get all referrals for user
   */
  async getReferrals(
    userId: string,
    status?: Referral['status']
  ): Promise<Referral[]> {
    const userReferralIds = this.userReferrals.get(userId) || new Set();
    let referrals = Array.from(userReferralIds)
      .map((id) => this.referrals.get(id))
      .filter((r): r is Referral => r !== undefined);

    if (status) {
      referrals = referrals.filter((r) => r.status === status);
    }

    return referrals.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  // ============================================
  // REFERRAL ANALYTICS
  // ============================================

  /**
   * Get top referrers
   */
  async getTopReferrers(limit: number = 10): Promise<
    Array<{
      user_id: string;
      referral_count: number;
      total_earnings: number;
    }>
  > {
    const referrerStats: Record<
      string,
      { referral_count: number; total_earnings: number }
    > = {};

    for (const referral of this.referrals.values()) {
      const status = referral.status;
      if (status === 'purchased' || status === 'completed') {
        if (!referrerStats[referral.referrer_id]) {
          referrerStats[referral.referrer_id] = { referral_count: 0, total_earnings: 0 };
        }
        referrerStats[referral.referrer_id].referral_count++;
        referrerStats[referral.referrer_id].total_earnings +=
          referral.referrer_reward || 0;
      }
    }

    return Object.entries(referrerStats)
      .map(([userId, stats]) => ({ user_id: userId, ...stats }))
      .sort((a, b) => b.referral_count - a.referral_count)
      .slice(0, limit);
  }

  /**
   * Get referral conversion rate
   */
  async getConversionRate(): Promise<{
    signup_rate: number;
    purchase_rate: number;
  }> {
    const allReferrals = Array.from(this.referrals.values());
    const totalReferrals = allReferrals.length;

    if (totalReferrals === 0) {
      return { signup_rate: 0, purchase_rate: 0 };
    }

    const signups = allReferrals.filter(
      (r) => r.status !== 'pending'
    ).length;
    const purchases = allReferrals.filter(
      (r) => r.status === 'purchased' || r.status === 'completed'
    ).length;

    return {
      signup_rate: signups / totalReferrals,
      purchase_rate: purchases / totalReferrals,
    };
  }
}
