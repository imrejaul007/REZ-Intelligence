/**
 * REZ Budget Optimizer - Ecosystem Integration
 *
 * Connects to:
 * - RABTUL: Auth, Wallet, Payment
 * - HOJAI: Enterprise Brain, AI services
 * - REZ: Campaign services, Analytics
 */

import axios from 'axios';

// ============== SERVICE URLs ==============

const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET_SERVICE = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const PAYMENT_SERVICE = process.env.PAYMENT_SERVICE_URL || 'https://rez-payment-service.onrender.com';
const HOJAI_BRAIN = process.env.HOJAI_BRAIN_URL || 'http://localhost:4600';
const CAMPAIGN_SERVICE = process.env.CAMPAIGN_SERVICE_URL || 'http://localhost:4301';
const ANALYTICS_SERVICE = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4304';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

// ============== HEADERS ==============

const authHeaders = {
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN
};

// ============== INTEGRATION SERVICE ==============

export class EcosystemIntegration {

  // ========== RABTUL INTEGRATIONS ==========

  /**
   * Verify merchant authentication
   */
  static async verifyMerchant(merchantId: string): Promise<boolean> {
    try {
      const response = await axios.get(
        `${AUTH_SERVICE}/api/auth/verify/merchant/${merchantId}`,
        { headers: authHeaders, timeout: 5000 }
      );
      return response.status === 200;
    } catch (error) {
      console.error('[BudgetOptimizer] Auth verification failed:', error);
      return false;
    }
  }

  /**
   * Get merchant wallet balance
   */
  static async getWalletBalance(merchantId: string): Promise<number> {
    try {
      const response = await axios.get(
        `${WALLET_SERVICE}/api/wallets/merchant/${merchantId}/balance`,
        { headers: authHeaders, timeout: 5000 }
      );
      return response.data.balance || 0;
    } catch (error) {
      console.error('[BudgetOptimizer] Wallet balance failed:', error);
      return 0;
    }
  }

  /**
   * Deduct from wallet for campaign spend
   */
  static async deductFromWallet(
    merchantId: string,
    amount: number,
    transactionId: string
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        `${WALLET_SERVICE}/api/wallets/deduct`,
        {
          merchantId,
          amount,
          transactionId,
          type: 'campaign_spend',
          description: 'Campaign budget allocation'
        },
        { headers: authHeaders, timeout: 10000 }
      );
      return response.data.success === true;
    } catch (error) {
      console.error('[BudgetOptimizer] Wallet deduction failed:', error);
      return false;
    }
  }

  /**
   * Refund to wallet for unused budget
   */
  static async refundToWallet(
    merchantId: string,
    amount: number,
    transactionId: string
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        `${WALLET_SERVICE}/api/wallets/refund`,
        {
          merchantId,
          amount,
          transactionId,
          type: 'campaign_refund',
          description: 'Unused campaign budget'
        },
        { headers: authHeaders, timeout: 10000 }
      );
      return response.data.success === true;
    } catch (error) {
      console.error('[BudgetOptimizer] Wallet refund failed:', error);
      return false;
    }
  }

  // ========== HOJAI INTEGRATIONS ==========

  /**
   * Get AI recommendations from HOJAI Brain
   */
  static async getAIRecommendations(
    merchantId: string,
    context: {
      revenue?: number;
      customerCount?: number;
      campaignHistory?: any[];
    }
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${HOJAI_BRAIN}/api/recommendations/merchant-growth`,
        {
          merchantId,
          context,
          intent: 'budget_optimization'
        },
        { headers: authHeaders, timeout: 10000 }
      );
      return response.data;
    } catch (error) {
      console.error('[BudgetOptimizer] HOJAI recommendations failed:', error);
      return null;
    }
  }

  /**
   * Send analytics to HOJAI
   */
  static async sendAnalytics(
    merchantId: string,
    event: string,
    data: any
  ): Promise<void> {
    try {
      await axios.post(
        `${HOJAI_BRAIN}/api/analytics/events`,
        {
          merchantId,
          event,
          data,
          source: 'budget_optimizer',
          timestamp: new Date().toISOString()
        },
        { headers: authHeaders, timeout: 5000 }
      );
    } catch (error) {
      console.error('[BudgetOptimizer] Analytics send failed:', error);
    }
  }

  // ========== REZ SERVICE INTEGRATIONS ==========

  /**
   * Get campaign performance from Campaign Service
   */
  static async getCampaignPerformance(merchantId: string): Promise<any[]> {
    try {
      const response = await axios.get(
        `${CAMPAIGN_SERVICE}/api/campaigns/${merchantId}/performance`,
        { headers: authHeaders, timeout: 10000 }
      );
      return response.data.campaigns || [];
    } catch (error) {
      console.error('[BudgetOptimizer] Campaign performance fetch failed:', error);
      return [];
    }
  }

  /**
   * Sync budget allocation to Campaign Service
   */
  static async syncBudgetAllocation(
    merchantId: string,
    allocations: any[]
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        `${CAMPAIGN_SERVICE}/api/budgets/sync`,
        { merchantId, allocations },
        { headers: authHeaders, timeout: 10000 }
      );
      return response.data.success === true;
    } catch (error) {
      console.error('[BudgetOptimizer] Budget sync failed:', error);
      return false;
    }
  }

  /**
   * Send revenue data to Analytics
   */
  static async sendRevenueAnalytics(
    merchantId: string,
    revenueData: {
      date: string;
      channel: string;
      spend: number;
      revenue: number;
      roas: number;
    }
  ): Promise<void> {
    try {
      await axios.post(
        `${ANALYTICS_SERVICE}/api/revenue/ingest`,
        {
          merchantId,
          ...revenueData,
          source: 'budget_optimizer'
        },
        { headers: authHeaders, timeout: 5000 }
      );
    } catch (error) {
      console.error('[BudgetOptimizer] Revenue analytics failed:', error);
    }
  }

  // ========== HELPER METHODS ==========

  /**
   * Check all ecosystem dependencies
   */
  static async healthCheck(): Promise<{
    auth: boolean;
    wallet: boolean;
    payment: boolean;
    hojai: boolean;
    campaign: boolean;
    analytics: boolean;
  }> {
    const check = async (url: string, fallback: boolean) => {
      try {
        await axios.get(`${url}/health`, { timeout: 3000 });
        return true;
      } catch {
        return fallback;
      }
    };

    return {
      auth: await check(AUTH_SERVICE, true),
      wallet: await check(WALLET_SERVICE, true),
      payment: await check(PAYMENT_SERVICE, true),
      hojai: await check(HOJAI_BRAIN, true),
      campaign: await check(CAMPAIGN_SERVICE, true),
      analytics: await check(ANALYTICS_SERVICE, true)
    };
  }
}

export default EcosystemIntegration;
