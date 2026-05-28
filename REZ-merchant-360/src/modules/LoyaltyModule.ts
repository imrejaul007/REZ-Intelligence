/**
 * LoyaltyModule.ts - Loyalty & Rewards Program for Merchant360
 */

import axios, { AxiosInstance } from 'axios';
import { Loyalty } from '../MerchantProfile';

export interface LoyaltyProgram {
  id: string;
  merchant_id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'ended';
  points_name: string;
  currency_name: string;
  points_per_currency: number;
  currency_value: number;
  min_redemption_points: number;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyMember {
  id: string;
  merchant_id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  tier_id?: string;
  tier_name?: string;
  points_balance: number;
  lifetime_points: number;
  lifetime_redemptions: number;
  visits: number;
  last_visit_date?: string;
  referral_code?: string;
  referral_count: number;
  status: 'active' | 'inactive' | 'suspended';
  enrolled_at: string;
  updated_at: string;
}

export interface LoyaltyTier {
  id: string;
  merchant_id: string;
  name: string;
  description: string;
  min_points: number;
  max_points?: number;
  points_multiplier: number;
  benefits: string[];
  color: string;
  is_default: boolean;
}

export interface LoyaltyTransaction {
  id: string;
  merchant_id: string;
  member_id: string;
  type: 'earn' | 'redeem' | 'adjust' | 'expire' | 'referral_bonus';
  points: number;
  balance_after: number;
  description: string;
  reference_type?: 'order' | 'review' | 'referral' | 'manual';
  reference_id?: string;
  expires_at?: string;
  created_at: string;
}

export interface LoyaltySummary {
  program_active: boolean;
  active_members: number;
  total_members: number;
  monthly_new_members: number;
  monthly_points_issued: number;
  monthly_points_redeemed: number;
  monthly_redemptions: number;
  points_balance_total: number;
  conversion_rate: number;
  avg_points_per_member: number;
  referral_count: number;
  active_tiers: number;
}

export class LoyaltyModule {
  private client: AxiosInstance;
  private cache: Map<string, { data: Loyalty; timestamp: number }> = new Map();
  private cacheTTL: number = 180000; // 3 minutes default

  constructor(baseURL?: string) {
    this.client = axios.create({
      baseURL: baseURL || process.env.LOYALTY_SERVICE_URL || 'http://localhost:4005',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
  }

  /**
   * Get loyalty summary for a merchant
   */
  async getLoyalty(merchantId: string): Promise<Loyalty> {
    const cacheKey = `loyalty:${merchantId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const summary = await this.getLoyaltySummary(merchantId);

      const loyalty: Loyalty = {
        program_active: summary.program_active,
        active_members: summary.active_members,
        monthly_points_issued: summary.monthly_points_issued,
        points_balance_total: summary.points_balance_total,
        monthly_redemptions: summary.monthly_redemptions,
        conversion_rate: summary.conversion_rate,
      };

      this.cache.set(cacheKey, { data: loyalty, timestamp: Date.now() });
      return loyalty;
    } catch (error) {
      console.error(`Failed to fetch loyalty for merchant ${merchantId}:`, error);
      return this.getDefaultLoyalty();
    }
  }

  /**
   * Get detailed loyalty summary
   */
  async getLoyaltySummary(merchantId: string): Promise<LoyaltySummary> {
    try {
      const response = await this.client.get<LoyaltySummary>(
        `/merchants/${merchantId}/loyalty/summary`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch loyalty summary for merchant ${merchantId}:`, error);
      return this.getDefaultLoyaltySummary();
    }
  }

  /**
   * Get loyalty program settings
   */
  async getProgram(merchantId: string): Promise<LoyaltyProgram | null> {
    try {
      const response = await this.client.get<LoyaltyProgram>(
        `/merchants/${merchantId}/loyalty/program`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch loyalty program for merchant ${merchantId}:`, error);
      return null;
    }
  }

  /**
   * Update loyalty program settings
   */
  async updateProgram(
    merchantId: string,
    updates: Partial<LoyaltyProgram>
  ): Promise<LoyaltyProgram> {
    try {
      const response = await this.client.patch<LoyaltyProgram>(
        `/merchants/${merchantId}/loyalty/program`,
        updates
      );
      this.cache.delete(`loyalty:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to update loyalty program:`, error);
      throw error;
    }
  }

  /**
   * Get all members
   */
  async getMembers(
    merchantId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: LoyaltyMember['status'];
      tier_id?: string;
      search?: string;
      sort_by?: 'points_balance' | 'lifetime_points' | 'visits' | 'enrolled_at';
      sort_order?: 'asc' | 'desc';
    } = {}
  ): Promise<LoyaltyMember[]> {
    try {
      const response = await this.client.get<LoyaltyMember[]>(
        `/merchants/${merchantId}/loyalty/members`,
        { params: options }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch loyalty members for merchant ${merchantId}:`, error);
      return [];
    }
  }

  /**
   * Get single member
   */
  async getMember(merchantId: string, memberId: string): Promise<LoyaltyMember | null> {
    try {
      const response = await this.client.get<LoyaltyMember>(
        `/merchants/${merchantId}/loyalty/members/${memberId}`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch loyalty member ${memberId}:`, error);
      return null;
    }
  }

  /**
   * Find member by customer ID or email
   */
  async findMember(
    merchantId: string,
    identifier: { customer_id?: string; email?: string; phone?: string }
  ): Promise<LoyaltyMember | null> {
    try {
      const response = await this.client.post<LoyaltyMember>(
        `/merchants/${merchantId}/loyalty/members/find`,
        identifier
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to find loyalty member:`, error);
      return null;
    }
  }

  /**
   * Enroll customer in loyalty program
   */
  async enrollMember(
    merchantId: string,
    customer: { customer_id: string; customer_name: string; customer_email: string }
  ): Promise<LoyaltyMember> {
    try {
      const response = await this.client.post<LoyaltyMember>(
        `/merchants/${merchantId}/loyalty/members`,
        customer
      );
      this.cache.delete(`loyalty:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to enroll loyalty member:`, error);
      throw error;
    }
  }

  /**
   * Award points to member
   */
  async awardPoints(
    merchantId: string,
    memberId: string,
    points: number,
    description: string,
    reference?: { type: string; id: string }
  ): Promise<LoyaltyTransaction> {
    try {
      const response = await this.client.post<LoyaltyTransaction>(
        `/merchants/${merchantId}/loyalty/members/${memberId}/points`,
        {
          points,
          description,
          type: 'earn',
          reference_type: reference?.type,
          reference_id: reference?.id,
        }
      );
      this.cache.delete(`loyalty:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to award points:`, error);
      throw error;
    }
  }

  /**
   * Redeem points
   */
  async redeemPoints(
    merchantId: string,
    memberId: string,
    points: number,
    reward_id: string,
    description: string
  ): Promise<{ success: boolean; transaction?: LoyaltyTransaction; error?: string }> {
    try {
      const response = await this.client.post<LoyaltyTransaction>(
        `/merchants/${merchantId}/loyalty/members/${memberId}/redeem`,
        {
          points,
          reward_id,
          description,
        }
      );
      this.cache.delete(`loyalty:${merchantId}`);
      return { success: true, transaction: response.data };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return {
        success: false,
        error: err.response?.data?.message || 'Redemption failed',
      };
    }
  }

  /**
   * Adjust points (admin)
   */
  async adjustPoints(
    merchantId: string,
    memberId: string,
    points: number,
    reason: string
  ): Promise<LoyaltyTransaction> {
    try {
      const response = await this.client.post<LoyaltyTransaction>(
        `/merchants/${merchantId}/loyalty/members/${memberId}/points`,
        {
          points,
          description: reason,
          type: 'adjust',
        }
      );
      this.cache.delete(`loyalty:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to adjust points:`, error);
      throw error;
    }
  }

  /**
   * Get member transaction history
   */
  async getMemberTransactions(
    merchantId: string,
    memberId: string,
    options: {
      limit?: number;
      offset?: number;
      type?: LoyaltyTransaction['type'];
      from_date?: string;
      to_date?: string;
    } = {}
  ): Promise<LoyaltyTransaction[]> {
    try {
      const response = await this.client.get<LoyaltyTransaction[]>(
        `/merchants/${merchantId}/loyalty/members/${memberId}/transactions`,
        { params: options }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch member transactions:`, error);
      return [];
    }
  }

  /**
   * Get tiers
   */
  async getTiers(merchantId: string): Promise<LoyaltyTier[]> {
    try {
      const response = await this.client.get<LoyaltyTier[]>(
        `/merchants/${merchantId}/loyalty/tiers`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch loyalty tiers for merchant ${merchantId}:`, error);
      return [];
    }
  }

  /**
   * Create tier
   */
  async createTier(merchantId: string, tier: Partial<LoyaltyTier>): Promise<LoyaltyTier> {
    try {
      const response = await this.client.post<LoyaltyTier>(
        `/merchants/${merchantId}/loyalty/tiers`,
        tier
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to create loyalty tier:`, error);
      throw error;
    }
  }

  /**
   * Update tier
   */
  async updateTier(
    merchantId: string,
    tierId: string,
    updates: Partial<LoyaltyTier>
  ): Promise<LoyaltyTier> {
    try {
      const response = await this.client.patch<LoyaltyTier>(
        `/merchants/${merchantId}/loyalty/tiers/${tierId}`,
        updates
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to update loyalty tier:`, error);
      throw error;
    }
  }

  /**
   * Process tier upgrades/downgrades
   */
  async processTierChanges(merchantId: string): Promise<{
    upgraded: number;
    downgraded: number;
    unchanged: number;
  }> {
    try {
      const response = await this.client.post(
        `/merchants/${merchantId}/loyalty/tiers/process`
      );
      this.cache.delete(`loyalty:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to process tier changes:`, error);
      throw error;
    }
  }

  /**
   * Get referrals for member
   */
  async getReferrals(
    merchantId: string,
    memberId: string
  ): Promise<{ referred_member_id: string; referred_name: string; bonus_awarded: number; created_at: string }[]> {
    try {
      const response = await this.client.get(
        `/merchants/${merchantId}/loyalty/members/${memberId}/referrals`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch referrals:`, error);
      return [];
    }
  }

  /**
   * Process expired points
   */
  async processExpiredPoints(merchantId: string): Promise<{ expired_count: number; expired_points: number }> {
    try {
      const response = await this.client.post(
        `/merchants/${merchantId}/loyalty/points/expire`
      );
      this.cache.delete(`loyalty:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to process expired points:`, error);
      throw error;
    }
  }

  /**
   * Sync loyalty from external source
   */
  async syncLoyalty(merchantId: string, sourceData: Partial<Loyalty>): Promise<Loyalty> {
    const current = await this.getLoyalty(merchantId);
    const updated: Loyalty = {
      ...current,
      ...sourceData,
    };

    this.cache.delete(`loyalty:${merchantId}`);
    return updated;
  }

  private getDefaultLoyalty(): Loyalty {
    return {
      program_active: false,
      active_members: 0,
      monthly_points_issued: 0,
    };
  }

  private getDefaultLoyaltySummary(): LoyaltySummary {
    return {
      program_active: false,
      active_members: 0,
      total_members: 0,
      monthly_new_members: 0,
      monthly_points_issued: 0,
      monthly_points_redeemed: 0,
      monthly_redemptions: 0,
      points_balance_total: 0,
      conversion_rate: 0,
      avg_points_per_member: 0,
      referral_count: 0,
      active_tiers: 0,
    };
  }

  clearCache(merchantId?: string): void {
    if (merchantId) {
      this.cache.delete(`loyalty:${merchantId}`);
    } else {
      this.cache.clear();
    }
  }
}
