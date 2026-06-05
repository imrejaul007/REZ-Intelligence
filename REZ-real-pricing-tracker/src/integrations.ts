/**
 * REZ Real Pricing Tracker - Ecosystem Integration
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

export class PricingTrackerIntegration {

  /** Check if merchant has pricing feature */
  static async checkFeatureAccess(merchantId: string): Promise<boolean> {
    try {
      const response = await axios.get(
        `${AUTH_SERVICE}/api/merchants/${merchantId}/features`,
        { headers, timeout: 5000 }
      );
      return response.data.includes('competitor_pricing');
    } catch {
      return false;
    }
  }

  /** Scrape competitor data */
  static async scrapeCompetitor(source: string, url: string): Promise<any> {
    try {
      const response = await axios.post(
        `${HOJAI_BRAIN}/api/tools/scrape`,
        { source, url },
        { headers, timeout: 30000 }
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /** Launch counter-campaign */
  static async launchCounterCampaign(
    merchantId: string,
    competitor: any,
    myPrices: any[]
  ): Promise<string | null> {
    try {
      const response = await axios.post(
        `${CAMPAIGN_SERVICE}/api/campaigns/price-match`,
        { merchantId, competitor, myPrices },
        { headers, timeout: 15000 }
      );
      return response.data.campaignId;
    } catch {
      return null;
    }
  }

  /** Track pricing trends */
  static async trackPricingTrends(merchantId: string, data: any): Promise<void> {
    try {
      await axios.post(
        `${HOJAI_BRAIN}/api/analytics/pricing-trends`,
        { merchantId, ...data },
        { headers, timeout: 5000 }
      );
    } catch {}
  }

  /** Get AI pricing recommendations */
  static async getPricingRecommendations(
    merchantId: string,
    context: any
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${HOJAI_BRAIN}/api/ai/pricing-recommendations`,
        { merchantId, ...context },
        { headers, timeout: 10000 }
      );
      return response.data;
    } catch {
      return null;
    }
  }
}
