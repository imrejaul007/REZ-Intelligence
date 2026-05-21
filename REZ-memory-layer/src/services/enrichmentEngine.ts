/**
 * REZ Memory Layer - Enrichment Engine
 * Enrich events with additional context from external services
 */

import axios, { AxiosInstance } from 'axios';
import { TimelineEvent, EventEnrichments } from '../types/timeline';
import { logger } from '../config/logger';

const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:4007';
const MERCHANT_SERVICE_URL = process.env.MERCHANT_SERVICE_URL || 'http://localhost:4005';
const REZ_INTELLIGENCE_URL = process.env.REZ_INTELLIGENCE_URL || 'http://localhost:4018';
const REZ_PLATFORM_URL = process.env.REZ_PLATFORM_URL || 'http://localhost:4000';

interface EnrichmentConfig {
  catalogClient: AxiosInstance;
  merchantClient: AxiosInstance;
  intelligenceClient: AxiosInstance;
  platformClient: AxiosInstance;
}

export class EnrichmentEngine {
  private config: EnrichmentConfig;
  private readonly logger = logger;
  private cache: Map<string, { data: unknown; expiry: number }> = new Map();

  constructor() {
    this.config = {
      catalogClient: axios.create({
        baseURL: CATALOG_SERVICE_URL,
        timeout: 5000,
        headers: {
          'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN,
          'Content-Type': 'application/json'
        }
      }),
      merchantClient: axios.create({
        baseURL: MERCHANT_SERVICE_URL,
        timeout: 5000,
        headers: {
          'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN,
          'Content-Type': 'application/json'
        }
      }),
      intelligenceClient: axios.create({
        baseURL: REZ_INTELLIGENCE_URL,
        timeout: 5000,
        headers: {
          'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN,
          'Content-Type': 'application/json'
        }
      }),
      platformClient: axios.create({
        baseURL: REZ_PLATFORM_URL,
        timeout: 5000,
        headers: {
          'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN,
          'Content-Type': 'application/json'
        }
      })
    };

    // Cleanup cache every 5 minutes
    setInterval(() => this.cleanupCache(), 5 * 60 * 1000);
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiry < now) {
        this.cache.delete(key);
      }
    }
  }

  private async getCached<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data as T;
    }
    return null;
  }

  private setCache(key: string, data: unknown, ttlSeconds: number = 300): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlSeconds * 1000
    });
  }

  /**
   * Enrich a timeline event with additional context
   */
  async enrichEvent(event: TimelineEvent): Promise<EventEnrichments> {
    const enrichments: EventEnrichments = {};

    try {
      // Run all enrichment tasks in parallel
      const [product, merchant, campaign, agent, user] = await Promise.all([
        this.enrichWithProduct(event),
        this.enrichWithMerchant(event),
        this.enrichWithCampaign(event),
        this.enrichWithAgent(event),
        this.enrichWithUser(event)
      ]);

      if (product) enrichments.product = product;
      if (merchant) enrichments.merchant = merchant;
      if (campaign) enrichments.campaign = campaign;
      if (agent) enrichments.agent = agent;
      if (user) enrichments.user = user;

    } catch (error) {
      this.logger.warn(`Failed to enrich event ${event.id}:`, error);
    }

    return enrichments;
  }

  /**
   * Enrich with product details
   */
  private async enrichWithProduct(event: TimelineEvent): Promise<EventEnrichments['product'] | null> {
    // Only enrich commerce/order events
    if (!['order', 'catalog'].includes(event.source)) {
      return null;
    }

    const data = event.data as Record<string, unknown>;
    const productId = data.productId || data.product_id;

    if (!productId) {
      // Try to find productId from items array
      const items = data.items as Array<Record<string, unknown>>;
      if (items && items.length > 0) {
        const firstItem = items[0];
        if (firstItem.productId || firstItem.product_id) {
          return this.enrichWithProduct({
            ...event,
            data: { productId: firstItem.productId || firstItem.product_id }
          } as TimelineEvent);
        }
      }
      return null;
    }

    // Check cache
    const cacheKey = `product:${productId}`;
    const cached = await this.getCached<EventEnrichments['product']>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.config.catalogClient.get(
        `/api/products/${productId}`
      );

      const productData = response.data;
      const enrichment: EventEnrichments['product'] = {
        productId,
        productName: productData.name || productData.productName,
        category: productData.category,
        brand: productData.brand,
        price: productData.price,
        imageUrl: productData.imageUrl || productData.image
      };

      this.setCache(cacheKey, enrichment, 3600); // Cache for 1 hour
      return enrichment;

    } catch (error) {
      this.logger.debug(`Failed to fetch product ${productId}:`, error);
      return null;
    }
  }

  /**
   * Enrich with merchant details
   */
  private async enrichWithMerchant(event: TimelineEvent): Promise<EventEnrichments['merchant'] | null> {
    const data = event.data as Record<string, unknown>;
    const merchantId = data.merchantId || data.merchant_id;

    if (!merchantId) return null;

    // Check cache
    const cacheKey = `merchant:${merchantId}`;
    const cached = await this.getCached<EventEnrichments['merchant']>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.config.merchantClient.get(
        `/api/merchants/${merchantId}`
      );

      const merchantData = response.data;
      const enrichment: EventEnrichments['merchant'] = {
        merchantId,
        merchantName: merchantData.name || merchantData.businessName,
        merchantType: merchantData.type || merchantData.category,
        location: merchantData.location,
        rating: merchantData.rating
      };

      this.setCache(cacheKey, enrichment, 3600);
      return enrichment;

    } catch (error) {
      this.logger.debug(`Failed to fetch merchant ${merchantId}:`, error);
      return null;
    }
  }

  /**
   * Enrich with campaign details
   */
  private async enrichWithCampaign(event: TimelineEvent): Promise<EventEnrichments['campaign'] | null> {
    if (event.source !== 'campaign') return null;

    const data = event.data as Record<string, unknown>;
    const campaignId = data.campaignId || data.campaign_id;

    if (!campaignId) return null;

    // Check cache
    const cacheKey = `campaign:${campaignId}`;
    const cached = await this.getCached<EventEnrichments['campaign']>(cacheKey);
    if (cached) return cached;

    try {
      // Get campaign details from intelligence service
      const response = await this.config.intelligenceClient.get(
        `/api/campaigns/${campaignId}`
      );

      const campaignData = response.data;
      const enrichment: EventEnrichments['campaign'] = {
        campaignId,
        campaignName: campaignData.name || campaignData.title,
        campaignType: campaignData.type || campaignData.campaignType,
        channel: campaignData.channel || event.source,
        segment: campaignData.segment
      };

      this.setCache(cacheKey, enrichment, 1800);
      return enrichment;

    } catch (error) {
      this.logger.debug(`Failed to fetch campaign ${campaignId}:`, error);
      return null;
    }
  }

  /**
   * Enrich with agent details for AI interactions
   */
  private async enrichWithAgent(event: TimelineEvent): Promise<EventEnrichments['agent'] | null> {
    if (event.source !== 'ai') return null;

    const data = event.data as Record<string, unknown>;
    const agentId = data.agentId || data.agent_id;

    if (!agentId) return null;

    // Check cache
    const cacheKey = `agent:${agentId}`;
    const cached = await this.getCached<EventEnrichments['agent']>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.config.intelligenceClient.get(
        `/api/agents/${agentId}`
      );

      const agentData = response.data;
      const enrichment: EventEnrichments['agent'] = {
        agentId,
        agentName: agentData.name || agentData.agentName,
        agentType: agentData.type || agentData.agentType,
        intent: data.intent as string,
        confidence: typeof data.confidence === 'number' ? data.confidence : undefined
      };

      this.setCache(cacheKey, enrichment, 3600);
      return enrichment;

    } catch (error) {
      this.logger.debug(`Failed to fetch agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Enrich with user profile data
   */
  private async enrichWithUser(event: TimelineEvent): Promise<EventEnrichments['user'] | null> {
    const cacheKey = `user:${event.userId}`;
    const cached = await this.getCached<EventEnrichments['user']>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.config.platformClient.get(
        `/api/users/${event.userId}/profile`
      );

      const userData = response.data;
      const enrichment: EventEnrichments['user'] = {
        userName: userData.name || userData.userName,
        email: userData.email,
        phone: userData.phone,
        tier: userData.tier || userData.membershipTier
      };

      this.setCache(cacheKey, enrichment, 900); // Cache for 15 minutes
      return enrichment;

    } catch (error) {
      this.logger.debug(`Failed to fetch user ${event.userId}:`, error);
      return null;
    }
  }

  /**
   * Batch enrich multiple events
   */
  async enrichEvents(events: TimelineEvent[]): Promise<Map<string, EventEnrichments>> {
    const results = new Map<string, EventEnrichments>();

    // Process in batches of 10
    const batchSize = 10;
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      const promises = batch.map(async (event) => {
        const enrichments = await this.enrichEvent(event);
        results.set(event.id, enrichments);
      });

      await Promise.all(promises);
    }

    return results;
  }
}

export const enrichmentEngine = new EnrichmentEngine();
