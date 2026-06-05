/**
 * REZ Revenue Forecast - Ecosystem Integration
 */

import axios from 'axios';

const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET_SERVICE = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const HOJAI_BRAIN = process.env.HOJAI_BRAIN_URL || 'http://localhost:4600';
const POS_SERVICE = process.env.POS_SERVICE_URL || 'http://localhost:4308';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

const headers = {
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN
};

export class RevenueForecastIntegration {

  /** Get historical revenue from wallet */
  static async getHistoricalRevenue(merchantId: string, days: number): Promise<any[]> {
    try {
      const response = await axios.get(
        `${WALLET_SERVICE}/api/revenue/merchant/${merchantId}/history?days=${days}`,
        { headers, timeout: 10000 }
      );
      return response.data.data || [];
    } catch {
      return [];
    }
  }

  /** Get POS data for accuracy */
  static async getPOSData(merchantId: string, date: string): Promise<any> {
    try {
      const response = await axios.get(
        `${POS_SERVICE}/api/orders/merchant/${merchantId}/date/${date}`,
        { headers, timeout: 10000 }
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /** Get merchant info */
  static async getMerchantInfo(merchantId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${AUTH_SERVICE}/api/merchants/${merchantId}`,
        { headers, timeout: 5000 }
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /** Get weather data for forecasting */
  static async getWeatherData(location: { lat: number; lng: number }, date: string): Promise<any> {
    try {
      const response = await axios.get(
        `${HOJAI_BRAIN}/api/external/weather?lat=${location.lat}&lng=${location.lng}&date=${date}`,
        { headers, timeout: 5000 }
      );
      return response.data;
    } catch {
      return { temperature: 25, condition: 'clear' };
    }
  }

  /** Get event data for demand signals */
  static async getLocalEvents(location: { lat: number; lng: number }, date: string): Promise<any[]> {
    try {
      const response = await axios.get(
        `${HOJAI_BRAIN}/api/external/events?lat=${location.lat}&lng=${location.lng}&date=${date}`,
        { headers, timeout: 10000 }
      );
      return response.data.events || [];
    } catch {
      return [];
    }
  }

  /** Send forecast to HOJAI for analysis */
  static async sendForecastToHOJAI(merchantId: string, forecast: any): Promise<void> {
    try {
      await axios.post(
        `${HOJAI_BRAIN}/api/analytics/forecast`,
        { merchantId, ...forecast, source: 'revenue_forecast' },
        { headers, timeout: 5000 }
      );
    } catch {}
  }

  /** Get AI demand prediction */
  static async getAIDemandPrediction(merchantId: string, context: any): Promise<any> {
    try {
      const response = await axios.post(
        `${HOJAI_BRAIN}/api/ai/demand-prediction`,
        { merchantId, ...context },
        { headers, timeout: 15000 }
      );
      return response.data;
    } catch {
      return null;
    }
  }
}
