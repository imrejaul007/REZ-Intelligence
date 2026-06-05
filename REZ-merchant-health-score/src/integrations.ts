/**
 * REZ Merchant Health Score - Ecosystem Integration
 */

import axios from 'axios';

const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET_SERVICE = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const HOJAI_BRAIN = process.env.HOJAI_BRAIN_URL || 'http://localhost:4600';
const LOYALTY_SERVICE = process.env.LOYALTY_SERVICE_URL || 'http://localhost:4305';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

const headers = {
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN
};

export class MerchantHealthIntegration {

  /** Get merchant data from RABTUL */
  static async getMerchantData(merchantId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${AUTH_SERVICE}/api/merchants/${merchantId}/profile`,
        { headers, timeout: 10000 }
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /** Get loyalty metrics */
  static async getLoyaltyMetrics(merchantId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${LOYALTY_SERVICE}/api/metrics/merchant/${merchantId}`,
        { headers, timeout: 10000 }
      );
      return response.data;
    } catch {
      return { members: 0, activeRate: 0, avgTier: 'bronze' };
    }
  }

  /** Get wallet transactions for revenue data */
  static async getTransactionData(merchantId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${WALLET_SERVICE}/api/transactions/merchant/${merchantId}/summary`,
        { headers, timeout: 10000 }
      );
      return response.data;
    } catch {
      return { totalRevenue: 0, transactionCount: 0 };
    }
  }

  /** Send health data to HOJAI for analysis */
  static async sendToHOJAI(merchantId: string, healthData: any): Promise<void> {
    try {
      await axios.post(
        `${HOJAI_BRAIN}/api/merchant-health/score`,
        { merchantId, ...healthData },
        { headers, timeout: 10000 }
      );
    } catch {}
  }

  /** Get recommendations from HOJAI */
  static async getRecommendations(merchantId: string, score: number): Promise<string[]> {
    try {
      const response = await axios.post(
        `${HOJAI_BRAIN}/api/recommendations/merchant-health`,
        { merchantId, score },
        { headers, timeout: 10000 }
      );
      return response.data.recommendations || [];
    } catch {
      return [];
    }
  }
}
