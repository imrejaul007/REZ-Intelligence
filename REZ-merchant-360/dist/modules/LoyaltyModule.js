"use strict";
/**
 * LoyaltyModule.ts - Loyalty & Rewards Program for Merchant360
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoyaltyModule = void 0;
const axios_1 = __importDefault(require("axios"));
class LoyaltyModule {
    client;
    cache = new Map();
    cacheTTL = 180000; // 3 minutes default
    constructor(baseURL) {
        this.client = axios_1.default.create({
            baseURL: baseURL || process.env.LOYALTY_SERVICE_URL || 'http://localhost:4005',
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
    setCacheTTL(ttl) {
        this.cacheTTL = ttl;
    }
    /**
     * Get loyalty summary for a merchant
     */
    async getLoyalty(merchantId) {
        const cacheKey = `loyalty:${merchantId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }
        try {
            const summary = await this.getLoyaltySummary(merchantId);
            const loyalty = {
                program_active: summary.program_active,
                active_members: summary.active_members,
                monthly_points_issued: summary.monthly_points_issued,
                points_balance_total: summary.points_balance_total,
                monthly_redemptions: summary.monthly_redemptions,
                conversion_rate: summary.conversion_rate,
            };
            this.cache.set(cacheKey, { data: loyalty, timestamp: Date.now() });
            return loyalty;
        }
        catch (error) {
            console.error(`Failed to fetch loyalty for merchant ${merchantId}:`, error);
            return this.getDefaultLoyalty();
        }
    }
    /**
     * Get detailed loyalty summary
     */
    async getLoyaltySummary(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/loyalty/summary`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch loyalty summary for merchant ${merchantId}:`, error);
            return this.getDefaultLoyaltySummary();
        }
    }
    /**
     * Get loyalty program settings
     */
    async getProgram(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/loyalty/program`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch loyalty program for merchant ${merchantId}:`, error);
            return null;
        }
    }
    /**
     * Update loyalty program settings
     */
    async updateProgram(merchantId, updates) {
        try {
            const response = await this.client.patch(`/merchants/${merchantId}/loyalty/program`, updates);
            this.cache.delete(`loyalty:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to update loyalty program:`, error);
            throw error;
        }
    }
    /**
     * Get all members
     */
    async getMembers(merchantId, options = {}) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/loyalty/members`, { params: options });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch loyalty members for merchant ${merchantId}:`, error);
            return [];
        }
    }
    /**
     * Get single member
     */
    async getMember(merchantId, memberId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/loyalty/members/${memberId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch loyalty member ${memberId}:`, error);
            return null;
        }
    }
    /**
     * Find member by customer ID or email
     */
    async findMember(merchantId, identifier) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/loyalty/members/find`, identifier);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to find loyalty member:`, error);
            return null;
        }
    }
    /**
     * Enroll customer in loyalty program
     */
    async enrollMember(merchantId, customer) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/loyalty/members`, customer);
            this.cache.delete(`loyalty:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to enroll loyalty member:`, error);
            throw error;
        }
    }
    /**
     * Award points to member
     */
    async awardPoints(merchantId, memberId, points, description, reference) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/loyalty/members/${memberId}/points`, {
                points,
                description,
                type: 'earn',
                reference_type: reference?.type,
                reference_id: reference?.id,
            });
            this.cache.delete(`loyalty:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to award points:`, error);
            throw error;
        }
    }
    /**
     * Redeem points
     */
    async redeemPoints(merchantId, memberId, points, reward_id, description) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/loyalty/members/${memberId}/redeem`, {
                points,
                reward_id,
                description,
            });
            this.cache.delete(`loyalty:${merchantId}`);
            return { success: true, transaction: response.data };
        }
        catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || 'Redemption failed',
            };
        }
    }
    /**
     * Adjust points (admin)
     */
    async adjustPoints(merchantId, memberId, points, reason) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/loyalty/members/${memberId}/points`, {
                points,
                description: reason,
                type: 'adjust',
            });
            this.cache.delete(`loyalty:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to adjust points:`, error);
            throw error;
        }
    }
    /**
     * Get member transaction history
     */
    async getMemberTransactions(merchantId, memberId, options = {}) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/loyalty/members/${memberId}/transactions`, { params: options });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch member transactions:`, error);
            return [];
        }
    }
    /**
     * Get tiers
     */
    async getTiers(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/loyalty/tiers`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch loyalty tiers for merchant ${merchantId}:`, error);
            return [];
        }
    }
    /**
     * Create tier
     */
    async createTier(merchantId, tier) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/loyalty/tiers`, tier);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to create loyalty tier:`, error);
            throw error;
        }
    }
    /**
     * Update tier
     */
    async updateTier(merchantId, tierId, updates) {
        try {
            const response = await this.client.patch(`/merchants/${merchantId}/loyalty/tiers/${tierId}`, updates);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to update loyalty tier:`, error);
            throw error;
        }
    }
    /**
     * Process tier upgrades/downgrades
     */
    async processTierChanges(merchantId) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/loyalty/tiers/process`);
            this.cache.delete(`loyalty:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to process tier changes:`, error);
            throw error;
        }
    }
    /**
     * Get referrals for member
     */
    async getReferrals(merchantId, memberId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/loyalty/members/${memberId}/referrals`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch referrals:`, error);
            return [];
        }
    }
    /**
     * Process expired points
     */
    async processExpiredPoints(merchantId) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/loyalty/points/expire`);
            this.cache.delete(`loyalty:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to process expired points:`, error);
            throw error;
        }
    }
    /**
     * Sync loyalty from external source
     */
    async syncLoyalty(merchantId, sourceData) {
        const current = await this.getLoyalty(merchantId);
        const updated = {
            ...current,
            ...sourceData,
        };
        this.cache.delete(`loyalty:${merchantId}`);
        return updated;
    }
    getDefaultLoyalty() {
        return {
            program_active: false,
            active_members: 0,
            monthly_points_issued: 0,
        };
    }
    getDefaultLoyaltySummary() {
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
    clearCache(merchantId) {
        if (merchantId) {
            this.cache.delete(`loyalty:${merchantId}`);
        }
        else {
            this.cache.clear();
        }
    }
}
exports.LoyaltyModule = LoyaltyModule;
//# sourceMappingURL=LoyaltyModule.js.map