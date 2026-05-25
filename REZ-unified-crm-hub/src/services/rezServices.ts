/**
 * REZ Services Connector
 *
 * Connects to all REZ Intelligence services to aggregate customer data.
 */

import axios, { AxiosInstance } from 'axios';
import { serviceUrls } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface ServiceHealth {
  service: string;
  url: string;
  healthy: boolean;
  latency?: number;
  error?: string;
}

export class RezServicesConnector {
  private clients: Map<string, AxiosInstance> = new Map();

  constructor() {
    this.initClients();
  }

  private initClients() {
    const services = [
      { name: 'identityGraph', url: serviceUrls.intelligence.identityGraph },
      { name: 'predictiveEngine', url: serviceUrls.intelligence.predictiveEngine },
      { name: 'rfmService', url: serviceUrls.intelligence.rfmService },
      { name: 'unifiedProfile', url: serviceUrls.intelligence.unifiedProfile },
      { name: 'customerIntelligence', url: serviceUrls.intelligence.customerIntelligence },
      { name: 'rezNow', url: serviceUrls.consumer.rezNow },
      { name: 'merchantService', url: serviceUrls.consumer.merchantService },
      { name: 'engagementPlatform', url: serviceUrls.media.engagementPlatform },
      { name: 'campaignBuilder', url: serviceUrls.media.campaignBuilder },
      { name: 'crmHub', url: serviceUrls.external.crmHub },
    ];

    for (const service of services) {
      const client = axios.create({
        baseURL: service.url,
        timeout: 5000,
        headers: {
          'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN,
          'Content-Type': 'application/json',
        },
      });

      this.clients.set(service.name, client);
    }
  }

  /**
   * Check health of all services
   */
  async checkServicesHealth(): Promise<ServiceHealth[]> {
    const results: ServiceHealth[] = [];
    const serviceEntries = [
      { name: 'identityGraph', path: '/health' },
      { name: 'predictiveEngine', path: '/health' },
      { name: 'rfmService', path: '/health' },
      { name: 'unifiedProfile', path: '/health' },
      { name: 'customerIntelligence', path: '/health' },
      { name: 'rezNow', path: '/api/health' },
      { name: 'engagementPlatform', path: '/health' },
    ];

    const healthChecks = serviceEntries.map(async ({ name, path }) => {
      const client = this.clients.get(name);
      if (!client) {
        return { service: name, url: name, healthy: false, error: 'Client not found' };
      }

      const start = Date.now();
      try {
        const response = await client.get(path);
        return {
          service: name,
          url: serviceUrls.intelligence[name as keyof typeof serviceUrls.intelligence] || '',
          healthy: response.status === 200,
          latency: Date.now() - start,
        };
      } catch (error) {
        return {
          service: name,
          url: serviceUrls.intelligence[name as keyof typeof serviceUrls.intelligence] || '',
          healthy: false,
          latency: Date.now() - start,
          error: error.message,
        };
      }
    });

    const settled = await Promise.allSettled(healthChecks);
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    }

    return results;
  }

  // ============================================
  // IDENTITY GRAPH (Port 4050)
  // ============================================

  async getIdentityByUserId(userId: string): Promise<unknown> {
    const client = this.clients.get('identityGraph');
    if (!client) return null;

    try {
      const response = await client.get(`/api/v1/identity/${userId}`);
      return response.data;
    } catch (error) {
      logger.debug('Identity Graph unavailable', { userId });
      return null;
    }
  }

  async resolveIdentity(identifier: { email?: string; phone?: string; deviceId?: string }): Promise<unknown> {
    const client = this.clients.get('identityGraph');
    if (!client) return null;

    try {
      const response = await client.post('/api/v1/identity/resolve', identifier);
      return response.data;
    } catch (error) {
      logger.debug('Identity resolution failed', { identifier });
      return null;
    }
  }

  async getLinkedAccounts(userId: string): Promise<string[]> {
    const identity = await this.getIdentityByUserId(userId);
    return identity?.linkedAccounts || [];
  }

  // ============================================
  // PREDICTIVE ENGINE (Port 4059)
  // ============================================

  async getPredictions(userId: string): Promise<unknown> {
    const client = this.clients.get('predictiveEngine');
    if (!client) return this.getDefaultPredictions();

    try {
      const response = await client.get(`/api/predictions/${userId}`);
      return response.data;
    } catch (error) {
      logger.debug('Predictions unavailable', { userId });
      return this.getDefaultPredictions();
    }
  }

  async getChurnRisk(userId: string): Promise<{ risk: string; probability: number }> {
    const predictions = await this.getPredictions(userId);
    return {
      risk: predictions?.churnRisk || 'LOW',
      probability: predictions?.churnProbability || 0.1,
    };
  }

  async getLTVPrediction(userId: string): Promise<{ predicted: number; confidence: number }> {
    const predictions = await this.getPredictions(userId);
    const ltv = predictions?.ltvPrediction;
    return {
      predicted: ltv?.predicted || 0,
      confidence: ltv?.confidence || 0,
    };
  }

  private getDefaultPredictions() {
    return {
      churnRisk: 'LOW',
      churnProbability: 0.1,
      nextPurchaseLikelihood: 0.5,
      ltvPrediction: {
        predicted: 0,
        actual: 0,
        confidence: 0,
        timeframe: '365d',
      },
      productAffinity: [],
      preferredChannels: ['APP_PUSH'],
    };
  }

  // ============================================
  // RFM SERVICE (Port 4055)
  // ============================================

  async getRFMScore(userId: string): Promise<unknown> {
    const client = this.clients.get('rfmService');
    if (!client) return null;

    try {
      const response = await client.get(`/api/v1/rfm/${userId}`);
      return response.data;
    } catch (error) {
      logger.debug('RFM Service unavailable', { userId });
      return null;
    }
  }

  async getRFMAnalysis(storeId?: string): Promise<unknown> {
    const client = this.clients.get('rfmService');
    if (!client) return null;

    try {
      const response = await client.get('/api/v1/rfm/analysis', {
        params: { storeId },
      });
      return response.data;
    } catch (error) {
      logger.debug('RFM analysis unavailable', { storeId });
      return null;
    }
  }

  // ============================================
  // UNIFIED PROFILE (Port 4060)
  // ============================================

  async getProfile(userId: string): Promise<unknown> {
    const client = this.clients.get('unifiedProfile');
    if (!client) return null;

    try {
      const response = await client.get(`/api/profile/${userId}`);
      return response.data;
    } catch (error) {
      logger.debug('Unified Profile unavailable', { userId });
      return null;
    }
  }

  async getProfileActivity(userId: string): Promise<unknown> {
    const client = this.clients.get('unifiedProfile');
    if (!client) return null;

    try {
      const response = await client.get(`/api/profile/${userId}/activity`);
      return response.data;
    } catch (error) {
      logger.debug('Activity data unavailable', { userId });
      return null;
    }
  }

  async searchProfiles(query: string, filters?): Promise<unknown[]> {
    const client = this.clients.get('unifiedProfile');
    if (!client) return [];

    try {
      const response = await client.get('/api/profiles/search', {
        params: { q: query, ...filters },
      });
      return response.data?.profiles || [];
    } catch (error) {
      logger.debug('Profile search unavailable', { query });
      return [];
    }
  }

  // ============================================
  // CUSTOMER INTELLIGENCE (Port 4140)
  // ============================================

  async getCustomerIntelligence(userId: string): Promise<unknown> {
    const client = this.clients.get('customerIntelligence');
    if (!client) return null;

    try {
      const response = await client.get(`/api/v1/customer/${userId}`);
      return response.data;
    } catch (error) {
      logger.debug('Customer Intelligence unavailable', { userId });
      return null;
    }
  }

  async getCustomerOrders(userId: string, options?: { limit?: number; offset?: number }): Promise<unknown[]> {
    const client = this.clients.get('customerIntelligence');
    if (!client) return [];

    try {
      const response = await client.get(`/api/v1/customer/${userId}/orders`, {
        params: options,
      });
      return response.data?.orders || [];
    } catch (error) {
      logger.debug('Customer orders unavailable', { userId });
      return [];
    }
  }

  // ============================================
  // REZ NOW (Consumer)
  // ============================================

  async getRezNowCustomer(userId: string): Promise<unknown> {
    const client = this.clients.get('rezNow');
    if (!client) return null;

    try {
      const response = await client.get(`/api/customers/${userId}`);
      return response.data;
    } catch (error) {
      logger.debug('REZ NOW customer unavailable', { userId });
      return null;
    }
  }

  async getRezNowOrders(userId: string, storeSlug?: string): Promise<unknown[]> {
    const client = this.clients.get('rezNow');
    if (!client) return [];

    try {
      const response = await client.get('/api/orders', {
        params: { userId, store: storeSlug },
      });
      return response.data?.orders || [];
    } catch (error) {
      logger.debug('REZ NOW orders unavailable', { userId });
      return [];
    }
  }

  // ============================================
  // ENGAGEMENT PLATFORM (REZ Media)
  // ============================================

  async getEngagementData(userId: string): Promise<unknown> {
    const client = this.clients.get('engagementPlatform');
    if (!client) return null;

    try {
      const response = await client.get(`/api/customers/${userId}/engagement`);
      return response.data;
    } catch (error) {
      logger.debug('Engagement data unavailable', { userId });
      return null;
    }
  }

  async getLoyaltyStatus(userId: string): Promise<unknown> {
    const client = this.clients.get('engagementPlatform');
    if (!client) return null;

    try {
      const response = await client.get(`/api/customers/${userId}/loyalty`);
      return response.data;
    } catch (error) {
      logger.debug('Loyalty status unavailable', { userId });
      return null;
    }
  }

  // ============================================
  // CRM HUB (HubSpot/Zoho)
  // ============================================

  async getCRMContact(userId: string): Promise<unknown> {
    const client = this.clients.get('crmHub');
    if (!client) return null;

    try {
      const response = await client.get(`/api/contacts/${userId}`);
      return response.data;
    } catch (error) {
      logger.debug('CRM contact unavailable', { userId });
      return null;
    }
  }

  // ============================================
  // AGGREGATE ALL DATA
  // ============================================

  async aggregateCustomerData(userId: string): Promise<unknown> {
    logger.info('Aggregating customer data', { userId });

    // Run all requests in parallel
    const [
      identity,
      predictions,
      rfm,
      profile,
      activity,
      rezNow,
      engagement,
      crm,
    ] = await Promise.allSettled([
      this.getIdentityByUserId(userId),
      this.getPredictions(userId),
      this.getRFMScore(userId),
      this.getProfile(userId),
      this.getProfileActivity(userId),
      this.getRezNowCustomer(userId),
      this.getEngagementData(userId),
      this.getCRMContact(userId),
    ]);

    const data = {
      identity: identity.status === 'fulfilled' ? identity.value : null,
      predictions: predictions.status === 'fulfilled' ? predictions.value : null,
      rfm: rfm.status === 'fulfilled' ? rfm.value : null,
      profile: profile.status === 'fulfilled' ? profile.value : null,
      activity: activity.status === 'fulfilled' ? activity.value : null,
      rezNow: rezNow.status === 'fulfilled' ? rezNow.value : null,
      engagement: engagement.status === 'fulfilled' ? engagement.value : null,
      crm: crm.status === 'fulfilled' ? crm.value : null,
    };

    logger.info('Customer data aggregated', {
      userId,
      sources: Object.keys(data).filter(k => data[k as keyof typeof data] !== null),
    });

    return data;
  }
}

export const rezServices = new RezServicesConnector();
export default rezServices;
