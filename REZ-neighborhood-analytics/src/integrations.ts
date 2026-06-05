/**
 * REZ Neighborhood Analytics - Ecosystem Integration
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

export class NeighborhoodIntegration {

  /** Get location data for merchant */
  static async getMerchantLocation(merchantId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${AUTH_SERVICE}/api/merchants/${merchantId}/location`,
        { headers, timeout: 5000 }
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /** Get weather data */
  static async getWeatherData(lat: number, lng: number): Promise<any> {
    try {
      const response = await axios.get(
        `${HOJAI_BRAIN}/api/external/weather?lat=${lat}&lng=${lng}`,
        { headers, timeout: 5000 }
      );
      return response.data;
    } catch {
      return { temperature: 25, condition: 'clear' };
    }
  }

  /** Get local events */
  static async getLocalEvents(lat: number, lng: number, radius: number): Promise<any[]> {
    try {
      const response = await axios.get(
        `${HOJAI_BRAIN}/api/external/events?lat=${lat}&lng=${lng}&radius=${radius}`,
        { headers, timeout: 10000 }
      );
      return response.data.events || [];
    } catch {
      return [];
    }
  }

  /** Get demographic data */
  static async getDemographicData(neighborhoodId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${HOJAI_BRAIN}/api/geo/demographics/${neighborhoodId}`,
        { headers, timeout: 10000 }
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /** Create hyperlocal campaign */
  static async createHyperlocalCampaign(
    merchantId: string,
    campaign: any
  ): Promise<string | null> {
    try {
      const response = await axios.post(
        `${CAMPAIGN_SERVICE}/api/campaigns/hyperlocal`,
        { merchantId, ...campaign },
        { headers, timeout: 15000 }
      );
      return response.data.campaignId;
    } catch {
      return null;
    }
  }

  /** Track footfall patterns */
  static async trackFootfall(merchantId: string, data: any): Promise<void> {
    try {
      await axios.post(
        `${HOJAI_BRAIN}/api/analytics/footfall`,
        { merchantId, ...data },
        { headers, timeout: 5000 }
      );
    } catch {}
  }

  /** Get AI demand insights */
  static async getDemandInsights(neighborhoodId: string, context: any): Promise<any> {
    try {
      const response = await axios.post(
        `${HOJAI_BRAIN}/api/ai/demand-insights`,
        { neighborhoodId, ...context },
        { headers, timeout: 10000 }
      );
      return response.data;
    } catch {
      return null;
    }
  }
}
