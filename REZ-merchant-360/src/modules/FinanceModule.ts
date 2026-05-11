/**
 * FinanceModule.ts - Financial Services Integration for Merchant360
 */

import axios, { AxiosInstance } from 'axios';
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

export class FinanceModule {
  private client: AxiosInstance;
  private cache: Map<string, { data: Finances; timestamp: number }> = new Map();
  private cacheTTL: number = 60000; // 1 minute default

  constructor(baseURL?: string) {
    this.client = axios.create({
      baseURL: baseURL || process.env.FINANCE_SERVICE_URL || 'http://localhost:4001',
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
   * Get financial summary for a merchant
   */
  async getFinances(merchantId: string): Promise<Finances> {
    const cacheKey = `finances:${merchantId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const response = await this.client.get<Finances>(`/merchants/${merchantId}/finances`);
      const finances: Finances = {
        wallet_balance: response.data.wallet_balance || 0,
        pending_payouts: response.data.pending_payouts || 0,
        monthly_revenue: response.data.monthly_revenue || 0,
        lifetime_revenue: response.data.lifetime_revenue || 0,
        credit_score: response.data.credit_score || 500,
      };

      this.cache.set(cacheKey, { data: finances, timestamp: Date.now() });
      return finances;
    } catch (error) {
      console.error(`Failed to fetch finances for merchant ${merchantId}:`, error);
      return this.getDefaultFinances();
    }
  }

  /**
   * Update merchant finances (for sync)
   */
  async updateFinances(merchantId: string, finances: Partial<Finances>): Promise<Finances> {
    try {
      const response = await this.client.patch<Finances>(
        `/merchants/${merchantId}/finances`,
        finances
      );
      this.cache.delete(`finances:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to update finances for merchant ${merchantId}:`, error);
      throw error;
    }
  }

  /**
   * Get transaction history
   */
  async getTransactions(
    merchantId: string,
    options: {
      limit?: number;
      offset?: number;
      type?: Transaction['type'];
      status?: Transaction['status'];
      from_date?: string;
      to_date?: string;
    } = {}
  ): Promise<Transaction[]> {
    try {
      const response = await this.client.get<Transaction[]>(
        `/merchants/${merchantId}/transactions`,
        { params: options }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch transactions for merchant ${merchantId}:`, error);
      return [];
    }
  }

  /**
   * Get payout summary
   */
  async getPayoutSummary(merchantId: string): Promise<PayoutSummary> {
    try {
      const response = await this.client.get<PayoutSummary>(
        `/merchants/${merchantId}/payouts/summary`
      );
      return response.data;
    } catch (error) {
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
  async getFinancialSummary(merchantId: string): Promise<FinancialSummary> {
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
    } catch (error) {
      console.error(`Failed to get financial summary for merchant ${merchantId}:`, error);
      throw error;
    }
  }

  /**
   * Initiate payout request
   */
  async requestPayout(
    merchantId: string,
    amount: number,
    method: 'bank_transfer' | 'instant' = 'bank_transfer'
  ): Promise<{ success: boolean; payout_id?: string; error?: string }> {
    try {
      const response = await this.client.post<{ payout_id: string }>(
        `/merchants/${merchantId}/payouts`,
        { amount, method }
      );
      this.cache.delete(`finances:${merchantId}`);
      return { success: true, payout_id: response.data.payout_id };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Payout request failed',
      };
    }
  }

  /**
   * Get credit score details
   */
  async getCreditScoreDetails(merchantId: string): Promise<{
    score: number;
    factors: { name: string; impact: number; description: string }[];
    recommendations: string[];
  }> {
    try {
      const response = await this.client.get(
        `/merchants/${merchantId}/credit-score`
      );
      return response.data;
    } catch (error) {
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
  async syncFinances(merchantId: string, sourceData: Partial<Finances>): Promise<Finances> {
    const current = await this.getFinances(merchantId);
    return this.updateFinances(merchantId, {
      ...current,
      ...sourceData,
    });
  }

  private getDefaultFinances(): Finances {
    return {
      wallet_balance: 0,
      pending_payouts: 0,
      monthly_revenue: 0,
      lifetime_revenue: 0,
      credit_score: 500,
    };
  }

  clearCache(merchantId?: string): void {
    if (merchantId) {
      this.cache.delete(`finances:${merchantId}`);
    } else {
      this.cache.clear();
    }
  }
}
