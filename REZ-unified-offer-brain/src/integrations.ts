/**
 * REZ Unified Offer Brain - Ecosystem Integration
 */

import axios from 'axios';

const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET_SERVICE = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const HOJAI_BRAIN = process.env.HOJAI_BRAIN_URL || 'http://localhost:4600';
const CAMPAIGN_SERVICE = process.env.CAMPAIGN_SERVICE_URL || 'http://localhost:4301';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

const headers = {
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN
};

export class OfferBrainIntegration {

  /** Get customer segment */
  static async getCustomerSegment(customerId: string): Promise<string> {
    try {
      const response = await axios.get(
        `${AUTH_SERVICE}/api/customers/${customerId}/segment`,
        { headers, timeout: 5000 }
      );
      return response.data.segment || 'general';
    } catch {
      return 'general';
    }
  }

  /** Get customer LTV from wallet */
  static async getCustomerLTV(customerId: string): Promise<number> {
    try {
      const response = await axios.get(
        `${WALLET_SERVICE}/api/customers/${customerId}/ltv`,
        { headers, timeout: 5000 }
      );
      return response.data.ltv || 0;
    } catch {
      return 0;
    }
  }

  /** Create offer campaign */
  static async createOfferCampaign(offer: any): Promise<string | null> {
    try {
      const response = await axios.post(
        `${CAMPAIGN_SERVICE}/api/campaigns/offer`,
        offer,
        { headers, timeout: 15000 }
      );
      return response.data.campaignId;
    } catch {
      return null;
    }
  }

  /** Award offer to customer */
  static async awardOffer(
    customerId: string,
    offer: any
  ): Promise<boolean> {
    try {
      const response = await axios.post(
        `${WALLET_SERVICE}/api/offers/award`,
        { customerId, offer },
        { headers, timeout: 10000 }
      );
      return response.data.success === true;
    } catch {
      return false;
    }
  }

  /** Track offer performance */
  static async trackOfferPerformance(offerId: string, data: any): Promise<void> {
    try {
      await axios.post(
        `${HOJAI_BRAIN}/api/analytics/offer-performance`,
        { offerId, ...data },
        { headers, timeout: 5000 }
      );
    } catch {}
  }

  /** Get AI offer optimization */
  static async getAIOptimization(
    merchantId: string,
    offerContext: any
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${HOJAI_BRAIN}/api/ai/offer-optimization`,
        { merchantId, ...offerContext },
        { headers, timeout: 15000 }
      );
      return response.data;
    } catch {
      return null;
    }
  }
}
