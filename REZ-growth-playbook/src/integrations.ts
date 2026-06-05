/**
 * REZ Growth Playbook - Ecosystem Integration
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

export class GrowthPlaybookIntegration {

  /** Verify merchant authentication */
  static async verifyMerchant(merchantId: string): Promise<boolean> {
    try {
      const response = await axios.get(
        `${AUTH_SERVICE}/api/auth/verify/merchant/${merchantId}`,
        { headers, timeout: 5000 }
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /** Get AI playbook recommendations from HOJAI */
  static async getAIRecommendations(merchantId: string, goals: string[]): Promise<any[]> {
    try {
      const response = await axios.post(
        `${HOJAI_BRAIN}/api/recommendations/playbooks`,
        { merchantId, goals },
        { headers, timeout: 10000 }
      );
      return response.data.recommendations || [];
    } catch {
      return [];
    }
  }

  /** Create campaign from playbook */
  static async createCampaignFromPlaybook(
    merchantId: string,
    playbook: any,
    steps: any[]
  ): Promise<string | null> {
    try {
      const response = await axios.post(
        `${CAMPAIGN_SERVICE}/api/campaigns/from-playbook`,
        { merchantId, playbook, steps },
        { headers, timeout: 15000 }
      );
      return response.data.campaignId;
    } catch {
      return null;
    }
  }

  /** Track playbook usage */
  static async trackUsage(merchantId: string, playbookId: string): Promise<void> {
    try {
      await axios.post(
        `${HOJAI_BRAIN}/api/analytics/events`,
        {
          merchantId,
          event: 'playbook_used',
          playbookId,
          timestamp: new Date().toISOString()
        },
        { headers, timeout: 5000 }
      );
    } catch {}
  }
}
