/**
 * Customer Aggregator Service
 *
 * 🔒 INTERNAL: Aggregates customer data from all sources:
 * - REZ NOW (orders, CRM)
 * - REZ Media (engagement, campaigns)
 * - REZ Intelligence (AI predictions, segments)
 * - External CRM (HubSpot, Zoho)
 * - CorpPerks (enterprise sales)
 */

import axios from 'axios';
import { serviceUrls } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { rezServices } from './rezServices.js';
import type {
  InternalCustomer,
  InternalDemographics,
  InternalLifetime,
  InternalActivity,
  InternalEngagement,
  InternalPredictions,
  InternalSegment,
  InternalSmartTag,
  CustomerSource,
  ChurnRisk,
  EngagementTier,
} from '../types/index.js';

export interface AggregatedCustomerData {
  // From REZ NOW
  orders?: {
    totalOrders: number;
    totalSpend: number;
    avgOrderValue: number;
    lastOrderDate?: Date;
    firstOrderDate?: Date;
  };

  // From REZ Intelligence
  predictions?: {
    churnRisk: ChurnRisk;
    churnProbability: number;
    ltvPrediction?: number;
  };

  segments?: Array<{
    id: string;
    name: string;
    type: string;
  }>;

  // From External CRM
  crmData?: {
    source: string;
    externalId: string;
    company?: string;
    jobTitle?: string;
    lifecycleStage?: string;
  };

  // From REZ Media
  engagement?: {
    emailOpens?: number;
    campaignClicks?: number;
    loyaltyPoints?: number;
    tier?: string;
  };
}

export class CustomerAggregator {
  private axiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 10000,
      headers: {
        'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN,
      },
    });
  }

  /**
   * Get unified customer profile by userId
   * Uses REZ Services Connector for reliable service communication
   */
  async getCustomer(userId: string): Promise<InternalCustomer | null> {
    try {
      // Use rezServices connector for all service calls
      const data = await rezServices.aggregateCustomerData(userId);

      // Merge data from all sources
      return this.mergeCustomerData(userId, {
        intelligence: data.profile,
        now: data.rezNow,
        media: data.engagement,
        predictions: data.predictions,
        rfm: data.rfm,
      });
    } catch (error) {
      logger.error('Error fetching customer', { userId, error });
      return null;
    }
  }

  /**
   * Search customers with filters
   */
  async searchCustomers(filters: {
    query?: string;
    segmentIds?: string[];
    tagIds?: string[];
    page?: number;
    limit?: number;
  }): Promise<{ customers: InternalCustomer[]; total: number }> {
    try {
      // Use REZ Intelligence unified profile search
      const response = await this.fetchFromService(
        `${serviceUrls.intelligence.unifiedProfile}/api/profiles/search`,
        {
          params: {
            q: filters.query,
            segments: filters.segmentIds?.join(','),
            page: filters.page || 1,
            limit: filters.limit || 20,
          },
        }
      );

      return {
        customers: (response.data || []).map((d: any) =>
          this.mapToCustomer(d)
        ),
        total: response.total || 0,
      };
    } catch (error) {
      logger.error('Error searching customers', { filters, error });
      return { customers: [], total: 0 };
    }
  }

  /**
   * Get customer segments
   */
  async getInternalSegments(userId: string): Promise<InternalSegment[]> {
    try {
      const response = await this.fetchFromService(
        `${serviceUrls.intelligence.unifiedProfile}/api/profile/${userId}/segments`
      );

      return (response.segments || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        type: s.type || 'BEHAVIORAL',
        description: s.description,
        rules: s.rules || [],
        logic: s.logic || 'AND',
        customerCount: s.customerCount || 0,
        isActive: s.isActive !== false,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt || s.createdAt),
      }));
    } catch (error) {
      logger.error('Error fetching customer segments', { userId, error });
      return [];
    }
  }

  /**
   * Get AI-generated smart tags for a customer
   */
  async getCustomerSmartTags(
    userId: string,
    orderHistory?: any[]
  ): Promise<InternalSmartTag[]> {
    const tags: InternalSmartTag[] = [];

    try {
      // Get predictions for AI-based tags
      const predictions = await this.getInternalPredictions(userId);

      // Get engagement score
      const engagement = await this.getInternalEngagement(userId);

      // Analyze order patterns if available
      const patterns = this.analyzeOrderPatterns(orderHistory);

      // Generate smart tags based on analysis
      if (patterns.avgOrderValue > patterns.storeAvgOrderValue * 2) {
        tags.push({
          id: 'high_spender',
          name: 'High Spender',
          slug: 'high_spender',
          description: 'Average order value is 2x above store average',
          category: 'SPENDING',
          color: '#9333ea',
          customerCount: 1,
          confidence: 0.9,
          isAutoGenerated: true,
          createdAt: new Date(),
        });
      }

      if (patterns.orderCount >= 5) {
        tags.push({
          id: 'returning_customer',
          name: 'Returning Customer',
          slug: 'returning_customer',
          description: 'Has placed 5+ orders',
          category: 'LOYALTY',
          color: '#84cc16',
          customerCount: 1,
          confidence: 0.95,
          isAutoGenerated: true,
          createdAt: new Date(),
        });
      }

      if (patterns.weekendVisits > patterns.totalVisits * 0.6) {
        tags.push({
          id: 'weekend_visitor',
          name: 'Weekend Visitor',
          slug: 'weekend_visitor',
          description: '>60% of visits on Saturday/Sunday',
          category: 'TIMING',
          color: '#3b82f6',
          customerCount: 1,
          confidence: patterns.weekendVisits / patterns.totalVisits,
          isAutoGenerated: true,
          createdAt: new Date(),
        });
      }

      if (patterns.nightOrders > patterns.totalOrders * 0.4) {
        tags.push({
          id: 'late_night_customer',
          name: 'Late Night Customer',
          slug: 'late_night_customer',
          description: '>40% of orders placed after 9 PM',
          category: 'TIMING',
          color: '#6366f1',
          customerCount: 1,
          confidence: patterns.nightOrders / patterns.totalOrders,
          isAutoGenerated: true,
          createdAt: new Date(),
        });
      }

      // Loyalty tags based on single merchant
      if (patterns.uniqueMerchants === 1 && patterns.orderCount >= 3) {
        tags.push({
          id: 'brand_loyalist',
          name: 'Brand Loyalist',
          slug: 'brand_loyalist',
          description: 'Single merchant/store preference',
          category: 'LOYALTY',
          color: '#8b5cf6',
          customerCount: 1,
          confidence: 0.85,
          isAutoGenerated: true,
          createdAt: new Date(),
        });
      }

      // Churn risk tag
      if (predictions.churnRisk === 'HIGH' || predictions.churnRisk === 'CRITICAL') {
        tags.push({
          id: 'churn_risk',
          name: 'Churn Risk',
          slug: 'churn_risk',
          description: 'High probability of churn',
          category: 'LOYALTY',
          color: '#ef4444',
          customerCount: 1,
          confidence: predictions.churnProbability,
          isAutoGenerated: true,
          createdAt: new Date(),
        });
      }
    } catch (error) {
      logger.error('Error generating smart tags', { userId, error });
    }

    return tags;
  }

  /**
   * Get customer predictions from AI
   */
  async getInternalPredictions(
    userId: string
  ): Promise<InternalPredictions> {
    try {
      const response = await this.fetchFromService(
        `${serviceUrls.intelligence.predictiveEngine}/api/predictions/${userId}`
      );

      return {
        churnRisk: response.churnRisk || 'LOW',
        churnProbability: response.churnProbability || 0,
        nextPurchaseLikelihood: response.nextPurchaseLikelihood || 0,
        ltvPrediction: response.ltvPrediction
          ? {
              predicted: response.ltvPrediction.predicted,
              actual: response.ltvPrediction.actual || 0,
              confidence: response.ltvPrediction.confidence || 0,
              timeframe: response.ltvPrediction.timeframe || '365d',
            }
          : { predicted: 0, actual: 0, confidence: 0, timeframe: '365d' },
        productAffinity: response.productAffinity || [],
        preferredChannels: response.preferredChannels || ['APP_PUSH'],
      };
    } catch (error) {
      logger.warn('Failed to fetch predictions', { userId });
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
  }

  /**
   * Get customer engagement score
   */
  async getInternalEngagement(userId: string): Promise<InternalEngagement> {
    try {
      const response = await this.fetchFromService(
        `${serviceUrls.intelligence.unifiedProfile}/api/profile/${userId}/activity`
      );

      const score = response.engagementScore || 50;
      let tier: EngagementTier = 'WARM';

      if (score >= 80) tier = 'CHAMPION';
      else if (score >= 60) tier = 'HOT';
      else if (score >= 40) tier = 'WARM';
      else if (score >= 20) tier = 'COLD';
      else tier = 'INACTIVE';

      return {
        score,
        tier,
        emailOptIn: response.emailOptIn !== false,
        pushOptIn: response.pushOptIn !== false,
        smsOptIn: response.smsOptIn || false,
        lastEngagement: response.lastEngagement
          ? new Date(response.lastEngagement)
          : undefined,
        engagementFrequency: response.frequency || 'WEEKLY',
      };
    } catch (error) {
      return {
        score: 50,
        tier: 'WARM',
        emailOptIn: true,
        pushOptIn: true,
        smsOptIn: false,
        engagementFrequency: 'WEEKLY',
      };
    }
  }

  /**
   * Analyze order patterns for smart tags
   */
  private analyzeOrderPatterns(orders?: any[]): {
    avgOrderValue: number;
    storeAvgOrderValue: number;
    orderCount: number;
    weekendVisits: number;
    totalVisits: number;
    nightOrders: number;
    totalOrders: number;
    uniqueMerchants: number;
  } {
    if (!orders || orders.length === 0) {
      return {
        avgOrderValue: 0,
        storeAvgOrderValue: 0,
        orderCount: 0,
        weekendVisits: 0,
        totalVisits: 0,
        nightOrders: 0,
        totalOrders: 0,
        uniqueMerchants: 0,
      };
    }

    const totalSpend = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const avgOrderValue = totalSpend / orders.length;
    const merchants = new Set(orders.map((o: any) => o.storeId));

    let weekendVisits = 0;
    let nightOrders = 0;

    for (const order of orders) {
      const date = new Date(order.createdAt);
      const day = date.getDay();
      const hour = date.getHours();

      // Weekend (Sat=6, Sun=0)
      if (day === 0 || day === 6) weekendVisits++;

      // Night (after 9 PM = 21:00)
      if (hour >= 21 || hour < 6) nightOrders++;
    }

    return {
      avgOrderValue,
      storeAvgOrderValue: avgOrderValue * 0.8, // Simplified - would come from store data
      orderCount: orders.length,
      weekendVisits,
      totalVisits: orders.length,
      nightOrders,
      totalOrders: orders.length,
      uniqueMerchants: merchants.size,
    };
  }

  /**
   * Merge customer data from all sources
   */
  private mergeCustomerData(
    userId: string,
    sources: {
      intelligence: any;
      now: any;
      media: any;
      predictions?: any;
      rfm?: any;
    }
  ): InternalCustomer {
    const intelligence = sources.intelligence || {};
    const now = sources.now || {};
    const media = sources.media || {};
    const predictions = sources.predictions || {};
    const rfm = sources.rfm || {};

    // Demographics from any source
    const demographics: InternalDemographics = {
      age: intelligence.age || now.age,
      gender: intelligence.gender || now.gender,
      city: intelligence.city || now.city,
      state: intelligence.state || now.state,
      pincode: intelligence.pincode || now.pincode,
      language: intelligence.language || now.language,
      occupation: intelligence.occupation || now.occupation,
      incomeTier: intelligence.incomeTier || now.incomeTier,
    };

    // Lifetime data from orders
    const orders = now.orders || [];
    const totalSpend = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const lifetime: InternalLifetime = {
      tenureDays: now.tenureDays || 0,
      totalOrders: orders.length,
      totalSpend,
      averageOrderValue: orders.length > 0 ? totalSpend / orders.length : 0,
      lastOrderDate: orders[0]?.createdAt
        ? new Date(orders[0].createdAt)
        : undefined,
      firstOrderDate: orders[orders.length - 1]?.createdAt
        ? new Date(orders[orders.length - 1].createdAt)
        : undefined,
      predictedLTV: intelligence.predictedLTV,
      ltvConfidence: intelligence.ltvConfidence,
    };

    // Activity
    const activity: InternalActivity = {
      last30Days: now.activity30Days || { orders: 0, spend: 0, visits: 0 },
      last90Days: now.activity90Days || { orders: 0, spend: 0, visits: 0 },
      last365Days: now.activity365Days || { orders: 0, spend: 0, visits: 0 },
      visits: now.visitPattern || {
        weekday: 50,
        weekend: 50,
        morning: 20,
        afternoon: 30,
        evening: 35,
        night: 15,
      },
    };

    // Engagement
    const engagement: InternalEngagement = {
      score: media.engagementScore || intelligence.engagementScore || 50,
      tier: media.engagementTier || intelligence.tier || 'WARM',
      emailOptIn: media.emailOptIn !== false,
      pushOptIn: media.pushOptIn !== false,
      smsOptIn: media.smsOptIn || false,
      lastEngagement: media.lastEngagement
        ? new Date(media.lastEngagement)
        : undefined,
      engagementFrequency: media.frequency || 'WEEKLY',
    };

    // Predictions from AI (merge with predictions from rezServices if available)
    const mergedPredictions: InternalPredictions = {
      churnRisk: predictions.churnRisk || intelligence.churnRisk || 'LOW',
      churnProbability: predictions.churnProbability || intelligence.churnProbability || 0.1,
      nextPurchaseLikelihood: predictions.nextPurchaseLikelihood || intelligence.nextPurchaseLikelihood || 0.5,
      ltvPrediction: predictions.ltvPrediction || intelligence.ltvPrediction,
      productAffinity: predictions.productAffinity || intelligence.productAffinity || [],
      preferredChannels: predictions.preferredChannels || media.preferredChannels || ['APP_PUSH'],
    };

    // Segments
    const segments: InternalSegment[] = [
      ...(intelligence.segments || []),
      ...(now.segments || []),
      ...(media.segments || []),
    ].map((s: any, i: number) => ({
      id: s.id || `segment-${i}`,
      name: s.name,
      type: s.type || 'BEHAVIORAL',
      description: s.description,
      rules: s.rules || [],
      logic: (s.logic as 'AND' | 'OR') || 'AND',
      customerCount: s.customerCount || 1,
      isActive: s.isActive !== false,
      createdAt: new Date(s.createdAt || Date.now()),
      updatedAt: new Date(s.updatedAt || s.createdAt || Date.now()),
    }));

    // Sources
    const sourcesData: CustomerSource[] = [];
    if (now.source) {
      sourcesData.push({
        source: 'REZ_NOW',
        externalId: userId,
        firstSeen: new Date(now.createdAt || Date.now()),
      });
    }
    if (media.source) {
      sourcesData.push({
        source: 'REZ_MEDIA',
        externalId: userId,
        firstSeen: new Date(media.createdAt || Date.now()),
      });
    }

    return {
      id: userId,
      userId,
      email: intelligence.email || now.email || media.email,
      phone: intelligence.phone || now.phone || media.phone,
      firstName: intelligence.firstName || now.firstName,
      lastName: intelligence.lastName || now.lastName,
      fullName:
        intelligence.fullName ||
        `${now.firstName || ''} ${now.lastName || ''}`.trim(),
      avatar: intelligence.avatar || now.avatar,
      demographics,
      lifetime,
      activity,
      engagement,
      predictions: mergedPredictions,
      segments,
      smartTags: [], // Will be populated separately
      intentSignals: intelligence.intentSignals || {
        preferredChannels: [],
        intentScore: 50,
      },
      sources: sourcesData,
      createdAt: new Date(intelligence.createdAt || now.createdAt || Date.now()),
      updatedAt: new Date(),
    };
  }

  private mapToCustomer(data: any): InternalCustomer {
    return {
      id: data.userId || data.id,
      userId: data.userId || data.id,
      email: data.email,
      phone: data.phone,
      firstName: data.firstName,
      lastName: data.lastName,
      fullName: data.fullName,
      avatar: data.avatar,
      demographics: data.demographics || {},
      lifetime: data.lifetime || {
        tenureDays: 0,
        totalOrders: 0,
        totalSpend: 0,
        averageOrderValue: 0,
      },
      activity: data.activity || {
        last30Days: { orders: 0, spend: 0, visits: 0 },
        last90Days: { orders: 0, spend: 0, visits: 0 },
        last365Days: { orders: 0, spend: 0, visits: 0 },
        visits: { weekday: 0, weekend: 0, morning: 0, afternoon: 0, evening: 0, night: 0 },
      },
      engagement: data.engagement || {
        score: 50,
        tier: 'WARM',
        emailOptIn: true,
        pushOptIn: true,
        smsOptIn: false,
        engagementFrequency: 'WEEKLY',
      },
      predictions: data.predictions || {
        churnRisk: 'LOW',
        churnProbability: 0.1,
        nextPurchaseLikelihood: 0.5,
        ltvPrediction: undefined,
        productAffinity: [],
        preferredChannels: ['APP_PUSH'],
      },
      segments: (data.segments || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        type: s.type || 'BEHAVIORAL',
        description: s.description,
        rules: s.rules || [],
        logic: (s.logic as 'AND' | 'OR') || 'AND',
        customerCount: s.customerCount || 0,
        isActive: s.isActive !== false,
        createdAt: new Date(s.createdAt || Date.now()),
        updatedAt: new Date(s.updatedAt || s.createdAt || Date.now()),
      })),
      smartTags: [],
      intentSignals: data.intentSignals || {
        preferredChannels: [],
        intentScore: 50,
      },
      sources: data.sources || [],
      createdAt: new Date(data.createdAt || Date.now()),
      updatedAt: new Date(data.updatedAt || data.createdAt || Date.now()),
    };
  }

  private async fetchFromService(
    url: string,
    options?: any
  ): Promise<any> {
    try {
      const response = await this.axiosInstance.get(url, options);
      return response.data;
    } catch (error: any) {
      if (error.response) {
        logger.debug('Service unavailable', {
          url,
          status: error.response.status,
        });
        return null;
      }
      throw error;
    }
  }
}

export const customerAggregator = new CustomerAggregator();
export default customerAggregator;
