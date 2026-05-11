/**
 * FinanceModule.ts - Financial Services Integration for Merchant360
 */
import { Finances } from '../MerchantProfile';
export interface Transaction {
    id: string;
    merchant_id: string;
    amount: number;
    currency: string;
    type: 'payment' | 'payout' | 'refund' | 'fee' | 'adjustment';
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    description: string;
    created_at: string;
    completed_at?: string;
}
export interface PayoutSummary {
    pending: number;
    scheduled: number;
    last_payout_date: string;
    next_payout_date: string;
    payout_method: string;
}
export interface FinancialSummary {
    balance: number;
    pending_payouts: number;
    monthly_revenue: number;
    lifetime_revenue: number;
    pending_transactions: number;
    average_transaction_value: number;
}
export declare class FinanceModule {
    private client;
    private cache;
    private cacheTTL;
    constructor(baseURL?: string);
    setCacheTTL(ttl: number): void;
    /**
     * Get financial summary for a merchant
     */
    getFinances(merchantId: string): Promise<Finances>;
    /**
     * Update merchant finances (for sync)
     */
    updateFinances(merchantId: string, finances: Partial<Finances>): Promise<Finances>;
    /**
     * Get transaction history
     */
    getTransactions(merchantId: string, options?: {
        limit?: number;
        offset?: number;
        type?: Transaction['type'];
        status?: Transaction['status'];
        from_date?: string;
        to_date?: string;
    }): Promise<Transaction[]>;
    /**
     * Get payout summary
     */
    getPayoutSummary(merchantId: string): Promise<PayoutSummary>;
    /**
     * Get financial summary with additional metrics
     */
    getFinancialSummary(merchantId: string): Promise<FinancialSummary>;
    /**
     * Initiate payout request
     */
    requestPayout(merchantId: string, amount: number, method?: 'bank_transfer' | 'instant'): Promise<{
        success: boolean;
        payout_id?: string;
        error?: string;
    }>;
    /**
     * Get credit score details
     */
    getCreditScoreDetails(merchantId: string): Promise<{
        score: number;
        factors: {
            name: string;
            impact: number;
            description: string;
        }[];
        recommendations: string[];
    }>;
    /**
     * Sync finances from external source
     */
    syncFinances(merchantId: string, sourceData: Partial<Finances>): Promise<Finances>;
    private getDefaultFinances;
    clearCache(merchantId?: string): void;
}
//# sourceMappingURL=FinanceModule.d.ts.map