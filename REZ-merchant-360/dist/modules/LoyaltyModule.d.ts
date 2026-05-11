/**
 * LoyaltyModule.ts - Loyalty & Rewards Program for Merchant360
 */
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
export declare class LoyaltyModule {
    private client;
    private cache;
    private cacheTTL;
    constructor(baseURL?: string);
    setCacheTTL(ttl: number): void;
    /**
     * Get loyalty summary for a merchant
     */
    getLoyalty(merchantId: string): Promise<Loyalty>;
    /**
     * Get detailed loyalty summary
     */
    getLoyaltySummary(merchantId: string): Promise<LoyaltySummary>;
    /**
     * Get loyalty program settings
     */
    getProgram(merchantId: string): Promise<LoyaltyProgram | null>;
    /**
     * Update loyalty program settings
     */
    updateProgram(merchantId: string, updates: Partial<LoyaltyProgram>): Promise<LoyaltyProgram>;
    /**
     * Get all members
     */
    getMembers(merchantId: string, options?: {
        limit?: number;
        offset?: number;
        status?: LoyaltyMember['status'];
        tier_id?: string;
        search?: string;
        sort_by?: 'points_balance' | 'lifetime_points' | 'visits' | 'enrolled_at';
        sort_order?: 'asc' | 'desc';
    }): Promise<LoyaltyMember[]>;
    /**
     * Get single member
     */
    getMember(merchantId: string, memberId: string): Promise<LoyaltyMember | null>;
    /**
     * Find member by customer ID or email
     */
    findMember(merchantId: string, identifier: {
        customer_id?: string;
        email?: string;
        phone?: string;
    }): Promise<LoyaltyMember | null>;
    /**
     * Enroll customer in loyalty program
     */
    enrollMember(merchantId: string, customer: {
        customer_id: string;
        customer_name: string;
        customer_email: string;
    }): Promise<LoyaltyMember>;
    /**
     * Award points to member
     */
    awardPoints(merchantId: string, memberId: string, points: number, description: string, reference?: {
        type: string;
        id: string;
    }): Promise<LoyaltyTransaction>;
    /**
     * Redeem points
     */
    redeemPoints(merchantId: string, memberId: string, points: number, reward_id: string, description: string): Promise<{
        success: boolean;
        transaction?: LoyaltyTransaction;
        error?: string;
    }>;
    /**
     * Adjust points (admin)
     */
    adjustPoints(merchantId: string, memberId: string, points: number, reason: string): Promise<LoyaltyTransaction>;
    /**
     * Get member transaction history
     */
    getMemberTransactions(merchantId: string, memberId: string, options?: {
        limit?: number;
        offset?: number;
        type?: LoyaltyTransaction['type'];
        from_date?: string;
        to_date?: string;
    }): Promise<LoyaltyTransaction[]>;
    /**
     * Get tiers
     */
    getTiers(merchantId: string): Promise<LoyaltyTier[]>;
    /**
     * Create tier
     */
    createTier(merchantId: string, tier: Partial<LoyaltyTier>): Promise<LoyaltyTier>;
    /**
     * Update tier
     */
    updateTier(merchantId: string, tierId: string, updates: Partial<LoyaltyTier>): Promise<LoyaltyTier>;
    /**
     * Process tier upgrades/downgrades
     */
    processTierChanges(merchantId: string): Promise<{
        upgraded: number;
        downgraded: number;
        unchanged: number;
    }>;
    /**
     * Get referrals for member
     */
    getReferrals(merchantId: string, memberId: string): Promise<{
        referred_member_id: string;
        referred_name: string;
        bonus_awarded: number;
        created_at: string;
    }[]>;
    /**
     * Process expired points
     */
    processExpiredPoints(merchantId: string): Promise<{
        expired_count: number;
        expired_points: number;
    }>;
    /**
     * Sync loyalty from external source
     */
    syncLoyalty(merchantId: string, sourceData: Partial<Loyalty>): Promise<Loyalty>;
    private getDefaultLoyalty;
    private getDefaultLoyaltySummary;
    clearCache(merchantId?: string): void;
}
//# sourceMappingURL=LoyaltyModule.d.ts.map