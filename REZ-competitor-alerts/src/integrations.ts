/**
 * REZ Competitor Alerts - Ecosystem Integration
 */

import axios from 'axios';

const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const HOJAI_BRAIN = process.env.HOJAI_BRAIN_URL || 'http://localhost:4600';
const CAMPAIGN_SERVICE = process.env.CAMPAIGN_SERVICE_URL || 'http://localhost:4301';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

const headers = {
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN
};

export class CompetitorIntegration {

  /** Get merchant subscription */
  static async checkSubscription(merchantId: string): Promise<boolean> {
    try {
      const response = await axios.get(
        `${AUTH_SERVICE}/api/merchants/${merchantId}/subscription`,
        { headers, timeout: 5000 }
      );
      return response.data.plan === 'competitor_intel' || response.data.plan === 'enterprise';
    } catch {
      return false;
    }
  }

  /** Send alert to campaign service */
  static async triggerCounterCampaign(merchantId: string, alert: any): Promise<string | null> {
    try {
      const response = await axios.post(
        `${CAMPAIGN_SERVICE}/api/campaigns/counter-offer`,
        { merchantId, alert },
        { headers, timeout: 15000 }
      );
      return response.data.campaignId;
    } catch {
      return null;
    }
  }

  /** Track competitor data */
  static async trackToHOJAI(merchantId: string, data: any): Promise<void> {
    try {
      await axios.post(
        `${HOJAI_BRAIN}/api/analytics/competitor`,
        { merchantId, ...data, source: 'competitor_alerts' },
        { headers, timeout: 5000 }
      );
    } catch {}
  }

  /** Get AI recommendations */
  static async getAIRecommendations(merchantId: string, context: any): Promise<string[]> {
    try {
      const response = await axios.post(
        `${HOJAI_BRAIN}/api/ai/competitor-strategy`,
        { merchantId, ...context },
        { headers, timeout: 10000 }
      );
      return response.data.recommendations || [];
    } catch {
      return [];
    }
  }
}
