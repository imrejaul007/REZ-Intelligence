/**
 * REZ Autonomous Growth Agent - Ecosystem Integration
 */

import axios from 'axios';

const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET_SERVICE = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const HOJAI_BRAIN = process.env.HOJAI_BRAIN_URL || 'http://localhost:4600';
const CAMPAIGN_SERVICE = process.env.CAMPAIGN_SERVICE_URL || 'http://localhost:4301';
const LOYALTY_SERVICE = process.env.LOYALTY_SERVICE_URL || 'http://localhost:4305';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

const headers = {
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN
};

export class GrowthAgentIntegration {

  /** Get merchant context */
  static async getMerchantContext(merchantId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${AUTH_SERVICE}/api/merchants/${merchantId}/context`,
        { headers, timeout: 10000 }
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /** Create experiment campaign */
  static async createExperiment(merchantId: string, experiment: any): Promise<string | null> {
    try {
      const response = await axios.post(
        `${CAMPAIGN_SERVICE}/api/experiments`,
        { merchantId, ...experiment },
        { headers, timeout: 15000 }
      );
      return response.data.experimentId;
    } catch {
      return null;
    }
  }

  /** Allocate budget from wallet */
  static async allocateBudget(
    merchantId: string,
    amount: number,
    experimentId: string
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        `${WALLET_SERVICE}/api/budgets/allocate`,
        { merchantId, amount, experimentId, type: 'growth_experiment' },
        { headers, timeout: 10000 }
      );
      return response.data.success === true;
    } catch {
      return false;
    }
  }

  /** Update loyalty for experiment */
  static async updateLoyalty(
    merchantId: string,
    customerId: string,
    points: number
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        `${LOYALTY_SERVICE}/api/points/award`,
        { merchantId, customerId, points, source: 'growth_experiment' },
        { headers, timeout: 10000 }
      );
      return response.data.success === true;
    } catch {
      return false;
    }
  }

  /** Send results to HOJAI */
  static async sendResultsToHOJAI(merchantId: string, results: any): Promise<void> {
    try {
      await axios.post(
        `${HOJAI_BRAIN}/api/analytics/growth-experiment`,
        { merchantId, ...results, source: 'autonomous_growth_agent' },
        { headers, timeout: 10000 }
      );
    } catch {}
  }

  /** Get AI strategy recommendations */
  static async getAIStrategy(merchantId: string, context: any): Promise<any> {
    try {
      const response = await axios.post(
        `${HOJAI_BRAIN}/api/ai/growth-strategy`,
        { merchantId, ...context },
        { headers, timeout: 15000 }
      );
      return response.data;
    } catch {
      return null;
    }
  }
}
