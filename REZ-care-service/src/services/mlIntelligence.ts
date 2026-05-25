/**
 * REZ Care - REZ Intelligence ML Integration
 *
 * Connects to ML services:
 * - Churn Predictor
 * - LTV Attribution
 * - Sentiment Analysis
 * - Demand Forecast
 * - Merchant Brain
 * - Delivery Tracking
 * - Inventory Intelligence
 */

import axios from 'axios';
import { logger } from '../utils/logger';

// ML Service URLs
const ML_URLS = {
  churnPredictor: process.env.REZ_CHURN_PREDICTOR_URL || 'http://localhost:4123',
  ltvAttribution: process.env.REZ_LTV_URL || 'http://localhost:4090',
  sentimentAnalysis: process.env.REZ_SENTIMENT_URL || 'http://localhost:4150',
  demandForecast: process.env.REZ_DEMAND_URL || 'http://localhost:4160',
  merchantBrain: process.env.REZ_MERCHANT_BRAIN_URL || 'http://localhost:4122',
  deliveryTracking: process.env.REZ_DELIVERY_TRACKING_URL || 'http://localhost:4009',
  inventoryIntelligence: process.env.REZ_INVENTORY_URL || 'http://localhost:4170',
  nextBestAction: process.env.REZ_NEXT_BEST_ACTION_URL || 'http://localhost:4190',
};

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token';

const mlHeaders = {
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN,
};

/**
 * REZ Intelligence ML Service
 */
class MLIntelligence {
  // CHURN PREDICTOR
  async getChurnRisk(customerId: string): Promise<{ risk: number; factors: string[]; recommendations: string[] }> {
    try {
      const res = await axios.get(`${ML_URLS.churnPredictor}/customer/${customerId}/risk`, {
        headers: mlHeaders,
        timeout: 5000,
      });
      return res.data;
    } catch (error) {
      logger.warn('[ML] Churn risk failed', error);
      return { risk: 0.5, factors: [], recommendations: [] };
    }
  }

  // LTV ATTRIBUTION
  async getLTV(customerId: string): Promise<{ ltv: number; segment: string; cohort: string }> {
    try {
      const res = await axios.get(`${ML_URLS.ltvAttribution}/customer/${customerId}`, {
        headers: mlHeaders,
        timeout: 5000,
      });
      return res.data;
    } catch {
      return { ltv: 0, segment: 'unknown', cohort: 'unknown' };
    }
  }

  // SENTIMENT ANALYSIS
  async analyzeSentiment(text: string): Promise<{ sentiment: string; score: number; keywords: string[] }> {
    try {
      const res = await axios.post(`${ML_URLS.sentimentAnalysis}/analyze`, { text }, {
        headers: mlHeaders,
        timeout: 5000,
      });
      return res.data;
    } catch {
      return { sentiment: 'neutral', score: 0.5, keywords: [] };
    }
  }

  // DEMAND FORECAST
  async getSupportForecast(days: number = 7): Promise<{ forecast: number[]; confidence: number }> {
    try {
      const res = await axios.get(`${ML_URLS.demandForecast}/support`, {
        params: { days },
        headers: mlHeaders,
        timeout: 5000,
      });
      return res.data;
    } catch {
      return { forecast: [], confidence: 0 };
    }
  }

  async getProductDemand(productId: string): Promise<{ demand: number; trend: string }> {
    try {
      const res = await axios.get(`${ML_URLS.demandForecast}/product/${productId}`, {
        headers: mlHeaders,
        timeout: 5000,
      });
      return res.data;
    } catch {
      return { demand: 0, trend: 'stable' };
    }
  }

  // MERCHANT BRAIN
  async getMerchantSuggestions(merchantId: string, context): Promise<string[]> {
    try {
      const res = await axios.post(`${ML_URLS.merchantBrain}/suggest`, { merchantId, ...context }, {
        headers: mlHeaders,
        timeout: 10000,
      });
      return res.data?.suggestions || [];
    } catch {
      return [];
    }
  }

  // DELIVERY TRACKING
  async getLiveTracking(orderId: string): Promise<unknown> {
    try {
      const res = await axios.get(`${ML_URLS.deliveryTracking}/${orderId}`, {
        headers: mlHeaders,
        timeout: 5000,
      });
      return res.data;
    } catch {
      return null;
    }
  }

  // INVENTORY
  async getStockLevel(productId: string): Promise<{ stock: number; reorderThreshold: number }> {
    try {
      const res = await axios.get(`${ML_URLS.inventoryIntelligence}/stock/${productId}`, {
        headers: mlHeaders,
        timeout: 5000,
      });
      return res.data;
    } catch {
      return { stock: 100, reorderThreshold: 10 };
    }
  }

  // ENRICH TICKET
  async enrichTicket(ticket): Promise<unknown> {
    const [churn, ltv, sentiment] = await Promise.all([
      this.getChurnRisk(ticket.customerId),
      this.getLTV(ticket.customerId),
      this.analyzeSentiment(ticket.message || ticket.description || ''),
    ]);

    return {
      ...ticket,
      churnRisk: churn.risk,
      ltv: ltv.ltv,
      sentiment: sentiment.sentiment,
      mlEnriched: true,
    };
  }
}

export const mlIntelligence = new MLIntelligence();
export { MLIntelligence };
