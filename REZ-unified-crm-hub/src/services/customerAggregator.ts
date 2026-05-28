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
      const data = await rezServices.aggregateCustomerData(userId) as Record<string, unknown>;

      // Merge data from all sources
      return this.mergeCustomerData(userId, {
        intelligence: (data.profile || {}) as Record<string, unknown>,
        now: (data.rezNow || {}) as Record<string, unknown>,
        media: (data.engagement || {}) as Record<string, unknown>,
        predictions: (data.predictions || {}) as Record<string, unknown>,
        rfm: (data.rfm || {}) as Record<string, unknown>,
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

      const res = response as Record<string, unknown>;
      return {
        customers: ((res.data || []) as unknown[]).map((d) =>
          this.mapToCustomer(d as Record<string, unknown>)
        ),
        total: (res.total as number) || 0,
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
      const response = (await this.fetchFromService(
        `${serviceUrls.intelligence.unifiedProfile}/api/profile/${userId}/segments`
      )) as Record<string, unknown>;

      return ((response.segments || []) as unknown[]).map((s: Record<string, unknown>) => ({
        id: s.id as string,
        name: s.name as string,
        type: ((s.type as string) || 'BEHAVIORAL') as 'BEHAVIORAL' | 'DEMOGRAPHIC' | 'ENGAGEMENT',
        description: s.description as string,
        rules: (s.rules as InternalSegment['rules']) || [],
        logic: ((s.logic as string) || 'AND') as 'AND' | 'OR',
        customerCount: (s.customerCount as number) || 0,
        isActive: s.isActive !== false,
        createdAt: new Date(s.createdAt as string),
        updatedAt: new Date((s.updatedAt || s.createdAt) as string),
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
    orderHistory?: unknown[]
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
      const response = (await this.fetchFromService(
        `${serviceUrls.intelligence.predictiveEngine}/api/predictions/${userId}`
      )) as Record<string, unknown>;

      const ltvPrediction = response.ltvPrediction as Record<string, unknown> | undefined;
      return {
        churnRisk: (response.churnRisk || 'LOW') as InternalPredictions['churnRisk'],
        churnProbability: (response.churnProbability as number) || 0,
        nextPurchaseLikelihood: (response.nextPurchaseLikelihood as number) || 0,
        ltvPrediction: ltvPrediction
          ? {
              predicted: (ltvPrediction.predicted as number) || 0,
              actual: (ltvPrediction.actual as number) || 0,
              confidence: (ltvPrediction.confidence as number) || 0,
              timeframe: ((ltvPrediction.timeframe as string) || '365d') as '30d' | '90d' | '365d',
            }
          : { predicted: 0, actual: 0, confidence: 0, timeframe: '365d' as const },
        productAffinity: (response.productAffinity as InternalPredictions['productAffinity']) || [],
        preferredChannels: (response.preferredChannels as string[]) || ['APP_PUSH'],
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
      const response = (await this.fetchFromService(
        `${serviceUrls.intelligence.unifiedProfile}/api/profile/${userId}/activity`
      )) as Record<string, unknown>;

      const score = (response.engagementScore as number) || 50;
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
        smsOptIn: (response.smsOptIn as boolean) || false,
        lastEngagement: response.lastEngagement
          ? new Date(response.lastEngagement as string)
          : undefined,
        engagementFrequency: ((response.frequency as string) || 'WEEKLY') as 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'RARELY',
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
  private analyzeOrderPatterns(orders?: unknown[]): {
    avgOrderValue: number;
    storeAvgOrderValue: number;
    orderCount: number;
    weekendVisits: number;
    totalVisits: number;
    nightOrders: number;
    totalOrders: number;
    uniqueMerchants: number;
  } {
    const typedOrders = (orders || []) as Array<{ total?: number; storeId?: string; createdAt?: string | Date }>;

    if (typedOrders.length === 0) {
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

    const totalSpend = typedOrders.reduce((sum: number, o) => sum + (o.total || 0), 0);
    const avgOrderValue = totalSpend / typedOrders.length;
    const merchants = new Set(typedOrders.map((o) => o.storeId));

    let weekendVisits = 0;
    let nightOrders = 0;

    for (const order of typedOrders) {
      const date = new Date(order.createdAt as string);
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
      intelligence: Record<string, unknown>;
      now: Record<string, unknown>;
      media: Record<string, unknown>;
      predictions?: Record<string, unknown>;
      rfm?: Record<string, unknown>;
    }
  ): InternalCustomer {
    const intelligence = sources.intelligence || {};
    const now = sources.now || {};
    const media = sources.media || {};
    const predictions = sources.predictions || {};
    const rfm = sources.rfm || {};

    // Helper to safely get string values
    const getStr = (obj: Record<string, unknown>, key: string): string | undefined =>
      (obj[key] as string) || undefined;

    // Helper to safely get number values
    const getNum = (obj: Record<string, unknown>, key: string, fallback: number): number => {
      const val = obj[key];
      return typeof val === 'number' ? val : fallback;
    };

    // Helper to safely get Date values
    const getDate = (obj: Record<string, unknown>, key: string): Date | undefined => {
      const val = obj[key];
      if (val instanceof Date) return val;
      if (typeof val === 'string') return new Date(val);
      if (typeof val === 'number') return new Date(val);
      return undefined;
    };

    // Helper to safely get boolean values
    const getBool = (obj: Record<string, unknown>, key: string, fallback: boolean): boolean => {
      const val = obj[key];
      return typeof val === 'boolean' ? val : fallback;
    };

    // Demographics from any source
    const demographics: InternalDemographics = {
      age: intelligence.age as InternalDemographics['age'],
      gender: intelligence.gender as InternalDemographics['gender'],
      city: intelligence.city as InternalDemographics['city'],
      state: intelligence.state as InternalDemographics['state'],
      pincode: intelligence.pincode as InternalDemographics['pincode'],
      language: intelligence.language as InternalDemographics['language'],
      occupation: intelligence.occupation as InternalDemographics['occupation'],
      incomeTier: intelligence.incomeTier as InternalDemographics['incomeTier'],
    };

    // Lifetime data from orders
    const orders = (now.orders || []) as Array<{ total?: number; createdAt?: Date | string | number }>;
    const totalSpend = orders.reduce((sum: number, o) => sum + (typeof o.total === 'number' ? o.total : 0), 0);
    const lifetime: InternalLifetime = {
      tenureDays: getNum(now, 'tenureDays', 0),
      totalOrders: orders.length,
      totalSpend,
      averageOrderValue: orders.length > 0 ? totalSpend / orders.length : 0,
      lastOrderDate: orders[0]?.createdAt ? getDate(now, 'createdAt') : undefined,
      firstOrderDate: orders.length > 0 ? getDate(now, 'createdAt') : undefined,
      predictedLTV: getNum(intelligence, 'predictedLTV', 0),
      ltvConfidence: getNum(intelligence, 'ltvConfidence', 0),
    };

    // Activity
    const activity: InternalActivity = {
      last30Days: (now.activity30Days as InternalActivity['last30Days']) || { orders: 0, spend: 0, visits: 0 },
      last90Days: (now.activity90Days as InternalActivity['last90Days']) || { orders: 0, spend: 0, visits: 0 },
      last365Days: (now.activity365Days as InternalActivity['last365Days']) || { orders: 0, spend: 0, visits: 0 },
      visits: (now.visitPattern as InternalActivity['visits']) || {
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
      score: getNum(media, 'engagementScore', getNum(intelligence, 'engagementScore', 50)),
      tier: (media.engagementTier || intelligence.tier || 'WARM') as InternalEngagement['tier'],
      emailOptIn: media.emailOptIn !== false,
      pushOptIn: media.pushOptIn !== false,
      smsOptIn: getBool(media, 'smsOptIn', false),
      lastEngagement: getDate(media, 'lastEngagement'),
      engagementFrequency: (media.frequency || 'WEEKLY') as InternalEngagement['engagementFrequency'],
    };

    // Predictions from AI
    const mergedPredictions: InternalPredictions = {
      churnRisk: (predictions.churnRisk || intelligence.churnRisk || 'LOW') as InternalPredictions['churnRisk'],
      churnProbability: getNum(predictions, 'churnProbability', getNum(intelligence, 'churnProbability', 0.1)),
      nextPurchaseLikelihood: getNum(predictions, 'nextPurchaseLikelihood', getNum(intelligence, 'nextPurchaseLikelihood', 0.5)),
      ltvPrediction: (predictions.ltvPrediction || intelligence.ltvPrediction) as InternalPredictions['ltvPrediction'],
      productAffinity: (predictions.productAffinity || intelligence.productAffinity || []) as InternalPredictions['productAffinity'],
      preferredChannels: (predictions.preferredChannels || media.preferredChannels || ['APP_PUSH']) as InternalPredictions['preferredChannels'],
    };

    // Segments
    const intSegs = (intelligence.segments || []) as InternalSegment[];
    const nowSegs = (now.segments || []) as InternalSegment[];
    const mediaSegs = (media.segments || []) as InternalSegment[];
    const segments: InternalSegment[] = [...intSegs, ...nowSegs, ...mediaSegs].map((s, i: number) => ({
      id: s.id || `segment-${i}`,
      name: s.name,
      type: s.type || 'BEHAVIORAL',
      description: s.description,
      rules: s.rules || [],
      logic: (s.logic as 'AND' | 'OR') || 'AND',
      customerCount: s.customerCount || 1,
      isActive: s.isActive !== false,
      createdAt: s.createdAt || new Date(),
      updatedAt: s.updatedAt || s.createdAt || new Date(),
    }));

    // Sources
    const sourcesData: CustomerSource[] = [];
    if (now.source) {
      sourcesData.push({
        source: 'REZ_NOW',
        externalId: userId,
        firstSeen: getDate(now, 'createdAt') || new Date(),
      });
    }
    if (media.source) {
      sourcesData.push({
        source: 'REZ_MEDIA',
        externalId: userId,
        firstSeen: getDate(media, 'createdAt') || new Date(),
      });
    }

    return {
      id: userId,
      userId,
      email: getStr(intelligence, 'email') || getStr(now, 'email') || getStr(media, 'email'),
      phone: getStr(intelligence, 'phone') || getStr(now, 'phone') || getStr(media, 'phone'),
      firstName: getStr(intelligence, 'firstName') || getStr(now, 'firstName'),
      lastName: getStr(intelligence, 'lastName') || getStr(now, 'lastName'),
      fullName: getStr(intelligence, 'fullName') || `${getStr(now, 'firstName') || ''} ${getStr(now, 'lastName') || ''}`.trim(),
      avatar: getStr(intelligence, 'avatar') || getStr(now, 'avatar'),
      demographics,
      lifetime,
      activity,
      engagement,
      predictions: mergedPredictions,
      segments,
      smartTags: [],
      intentSignals: (intelligence.intentSignals as InternalCustomer['intentSignals']) || {
        score: 50,
        primaryIntent: 'unknown',
        intents: [],
      } as InternalCustomer['intentSignals'],
      sources: sourcesData,
      createdAt: getDate(intelligence, 'createdAt') || getDate(now, 'createdAt') || new Date(),
      updatedAt: new Date(),
    };
  }

  private mapToCustomer(data: Record<string, unknown>): InternalCustomer {
    const d = data as {
      id?: string;
      userId?: string;
      email?: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
      fullName?: string;
      avatar?: string;
      demographics?: InternalDemographics;
      lifetime?: InternalLifetime;
      activity?: InternalActivity;
      engagement?: InternalEngagement;
      predictions?: InternalPredictions;
      segments?: InternalSegment[];
      smartTags?: InternalSmartTag[];
      intentSignals?: { preferredChannels: string[]; intentScore: number };
      sources?: CustomerSource[];
      createdAt?: Date | string | number;
      updatedAt?: Date | string | number;
    };

    const toDate = (val: Date | string | number | undefined): Date => {
      if (!val) return new Date();
      if (val instanceof Date) return val;
      return new Date(val);
    };

    return {
      id: d.userId || d.id || '',
      userId: d.userId || d.id || '',
      email: d.email || '',
      phone: d.phone || '',
      firstName: d.firstName || '',
      lastName: d.lastName || '',
      fullName: d.fullName || '',
      avatar: d.avatar || '',
      demographics: d.demographics || {} as InternalDemographics,
      lifetime: d.lifetime || {
        tenureDays: 0,
        totalOrders: 0,
        totalSpend: 0,
        averageOrderValue: 0,
      },
      activity: d.activity || {
        last30Days: { orders: 0, spend: 0, visits: 0 },
        last90Days: { orders: 0, spend: 0, visits: 0 },
        last365Days: { orders: 0, spend: 0, visits: 0 },
        visits: { weekday: 0, weekend: 0, morning: 0, afternoon: 0, evening: 0, night: 0 },
      },
      engagement: d.engagement || {
        score: 50,
        tier: 'WARM',
        emailOptIn: true,
        pushOptIn: true,
        smsOptIn: false,
        engagementFrequency: 'WEEKLY',
      },
      predictions: d.predictions || {
        churnRisk: 'LOW',
        churnProbability: 0.1,
        nextPurchaseLikelihood: 0.5,
        ltvPrediction: undefined,
        productAffinity: [],
        preferredChannels: ['APP_PUSH'],
      },
      segments: (d.segments || []).map((s: InternalSegment) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        description: s.description,
        rules: s.rules || [],
        logic: s.logic,
        customerCount: s.customerCount || 0,
        isActive: s.isActive !== false,
        createdAt: s.createdAt || new Date(),
        updatedAt: s.updatedAt || s.createdAt || new Date(),
      })),
      smartTags: [],
      intentSignals: d.intentSignals || {
        preferredChannels: [],
        intentScore: 50,
      },
      sources: d.sources || [],
      createdAt: toDate(d.createdAt),
      updatedAt: toDate(d.updatedAt),
    };
  }

  private async fetchFromService(
    url: string,
    options?: unknown
  ): Promise<unknown> {
    try {
      const response = await this.axiosInstance.get(url, options);
      return response.data;
    } catch (error) {
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
