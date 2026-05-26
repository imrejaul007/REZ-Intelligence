/**
 * REZ Memory Layer - Enrichment Engine
 * Enrich events with additional context from external services
 */

import axios from 'axios';
import { logger } from '../config/logger';

const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:4007';
const MERCHANT_SERVICE_URL = process.env.MERCHANT_SERVICE_URL || 'http://localhost:4005';
const REZ_INTELLIGENCE_URL = process.env.REZ_INTELLIGENCE_URL || 'http://localhost:4018';
const REZ_PLATFORM_URL = process.env.REZ_PLATFORM_URL || 'http://localhost:4000';

const clients = {
  catalog: axios.create({ baseURL: CATALOG_SERVICE_URL, timeout: 5000 }),
  merchant: axios.create({ baseURL: MERCHANT_SERVICE_URL, timeout: 5000 }),
  intelligence: axios.create({ baseURL: REZ_INTELLIGENCE_URL, timeout: 5000 }),
  platform: axios.create({ baseURL: REZ_PLATFORM_URL, timeout: 5000 })
};

export class EnrichmentEngine {
  async enrichEvent(event: { id?: string; data?: { productId?: string; merchantId?: string; campaignId?: string } }): Promise<Record<string, unknown>> {
    const enrichments: Record<string, unknown> = {};

    try {
      if (event.data?.productId) {
        enrichments.product = await this.enrichProduct(event.data.productId);
      }
      if (event.data?.merchantId) {
        enrichments.merchant = await this.enrichMerchant(event.data.merchantId);
      }
      if (event.data?.campaignId) {
        enrichments.campaign = await this.enrichCampaign(event.data.campaignId);
      }
    } catch (error) {
      logger.warn('Enrichment failed', { error, eventId: event.id });
    }

    return enrichments;
  }

  private async enrichProduct(productId: string): Promise<unknown> {
    try {
      const response = await clients.catalog.get(`/products/${productId}`);
      return response.data;
    } catch {
      return { productId };
    }
  }

  private async enrichMerchant(merchantId: string): Promise<unknown> {
    try {
      const response = await clients.merchant.get(`/merchants/${merchantId}`);
      return response.data;
    } catch {
      return { merchantId };
    }
  }

  private async enrichCampaign(campaignId: string): Promise<unknown> {
    try {
      const response = await clients.intelligence.get(`/campaigns/${campaignId}`);
      return response.data;
    } catch {
      return { campaignId };
    }
  }
}

export const enrichmentEngine = new EnrichmentEngine();
