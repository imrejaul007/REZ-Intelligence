"use strict";
/**
 * FinanceModule.ts - Financial Services Integration for Merchant360
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceModule = void 0;
const axios_1 = __importDefault(require("axios"));
class FinanceModule {
    client;
    cache = new Map();
    cacheTTL = 60000; // 1 minute default
    constructor(baseURL) {
        this.client = axios_1.default.create({
            baseURL: baseURL || process.env.FINANCE_SERVICE_URL || 'http://localhost:4001',
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
     * Get financial summary for a merchant
     */
    async getFinances(merchantId) {
        const cacheKey = `finances:${merchantId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }
        try {
            const response = await this.client.get(`/merchants/${merchantId}/finances`);
            const finances = {
                wallet_balance: response.data.wallet_balance || 0,
                pending_payouts: response.data.pending_payouts || 0,
                monthly_revenue: response.data.monthly_revenue || 0,
                lifetime_revenue: response.data.lifetime_revenue || 0,
                credit_score: response.data.credit_score || 500,
            };
            this.cache.set(cacheKey, { data: finances, timestamp: Date.now() });
            return finances;
        }
        catch (error) {
            console.error(`Failed to fetch finances for merchant ${merchantId}:`, error);
            return this.getDefaultFinances();
        }
    }
    /**
     * Update merchant finances (for sync)
     */
    async updateFinances(merchantId, finances) {
        try {
            const response = await this.client.patch(`/merchants/${merchantId}/finances`, finances);
            this.cache.delete(`finances:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to update finances for merchant ${merchantId}:`, error);
            throw error;
        }
    }
    /**
     * Get transaction history
     */
    async getTransactions(merchantId, options = {}) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/transactions`, { params: options });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch transactions for merchant ${merchantId}:`, error);
            return [];
        }
    }
    /**
     * Get payout summary
     */
    async getPayoutSummary(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/payouts/summary`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch payout summary for merchant ${merchantId}:`, error);
            return {
                pending: 0,
                scheduled: 0,
                last_payout_date: '',
                next_payout_date: '',
                payout_method: 'bank_transfer',
            };
        }
    }
    /**
     * Get financial summary with additional metrics
     */
    async getFinancialSummary(merchantId) {
        try {
            const [finances, transactions] = await Promise.all([
                this.getFinances(merchantId),
                this.getTransactions(merchantId, { status: 'pending', limit: 100 }),
            ]);
            const pendingTotal = transactions
                .filter(t => t.type === 'payment')
                .reduce((sum, t) => sum + t.amount, 0);
            return {
                balance: finances.wallet_balance,
                pending_payouts: finances.pending_payouts,
                monthly_revenue: finances.monthly_revenue,
                lifetime_revenue: finances.lifetime_revenue,
                pending_transactions: transactions.length,
                average_transaction_value: finances.monthly_revenue / 30 || 0,
            };
        }
        catch (error) {
            console.error(`Failed to get financial summary for merchant ${merchantId}:`, error);
            throw error;
        }
    }
    /**
     * Initiate payout request
     */
    async requestPayout(merchantId, amount, method = 'bank_transfer') {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/payouts`, { amount, method });
            this.cache.delete(`finances:${merchantId}`);
            return { success: true, payout_id: response.data.payout_id };
        }
        catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || 'Payout request failed',
            };
        }
    }
    /**
     * Get credit score details
     */
    async getCreditScoreDetails(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/credit-score`);
            return response.data;
        }
        catch (error) {
            return {
                score: 500,
                factors: [
                    { name: 'New Merchant', impact: 0, description: 'Account is new' },
                ],
                recommendations: ['Continue transacting to build credit history'],
            };
        }
    }
    /**
     * Sync finances from external source
     */
    async syncFinances(merchantId, sourceData) {
        const current = await this.getFinances(merchantId);
        return this.updateFinances(merchantId, {
            ...current,
            ...sourceData,
        });
    }
    getDefaultFinances() {
        return {
            wallet_balance: 0,
            pending_payouts: 0,
            monthly_revenue: 0,
            lifetime_revenue: 0,
            credit_score: 500,
        };
    }
    clearCache(merchantId) {
        if (merchantId) {
            this.cache.delete(`finances:${merchantId}`);
        }
        else {
            this.cache.clear();
        }
    }
}
exports.FinanceModule = FinanceModule;
//# sourceMappingURL=FinanceModule.js.map