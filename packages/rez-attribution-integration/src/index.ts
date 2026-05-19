/**
 * REZ Attribution Integration - Unified Client
 *
 * Consolidates all attribution services under a single interface:
 * - REZ-unified-attribution (primary)
 * - REZ-ltv-attribution (lifetime value)
 * - REZ-dooh-attribution (digital out-of-home)
 * - rez-crosschannel-attribution (cross-channel)
 */

import { ServiceClient, ClientConfig } from '../utils/client';
import type {
  TouchpointEvent,
  ConversionEvent,
  AttributionReport,
  ChannelAttribution,
} from '../types';

// ============================================
// Configuration
// ============================================

export const ATTRIBUTION_ENDPOINTS = {
  unified: process.env.UNIFIED_ATTRIBUTION_URL || 'http://localhost:4090',
  ltv: process.env.LTV_ATTRIBUTION_URL || 'http://localhost:4090',
  dooh: process.env.DOOH_ATTRIBUTION_URL || 'http://localhost:4081',
  crosschannel: process.env.CROSSCHANNEL_URL || 'http://localhost:4115',
} as const;

export interface AttributionConfig extends ClientConfig {
  primaryEndpoint?: keyof typeof ATTRIBUTION_ENDPOINTS;
  enableFallback?: boolean;
}

// ============================================
// Types
// ============================================

export interface TrackTouchpointRequest {
  customerId: string;
  merchantId?: string;
  channel: string;
  source: string;
  campaignId?: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

export interface TrackConversionRequest {
  customerId: string;
  merchantId: string;
  orderId: string;
  amount: number;
  channel: string;
  touchpointIds?: string[];
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

export interface GetAttributionRequest {
  customerId: string;
  merchantId?: string;
  startDate: Date;
  endDate: Date;
  model?: 'FIRST_TOUCH' | 'LAST_TOUCH' | 'LINEAR' | 'TIME_DECAY' | 'POSITION_BASED' | 'DATA_DRIVEN';
}

export interface AttributionResult {
  customerId: string;
  totalAttributedValue: number;
  channels: ChannelAttribution[];
  touchpoints: number;
  conversions: number;
  conversionRate: number;
  model: string;
}

// ============================================
// Attribution Client
// ============================================

export class AttributionClient extends ServiceClient {
  private config: Required<AttributionConfig>;
  private primaryEndpoint: string;

  constructor(config: AttributionConfig = {}) {
    const internalToken = config.internalToken || getInternalToken();

    super({
      baseUrl: ATTRIBUTION_ENDPOINTS[config.primaryEndpoint || 'unified'],
      internalToken,
      serviceName: 'attribution',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
    });

    this.config = {
      ...config,
      internalToken,
      primaryEndpoint: config.primaryEndpoint || 'unified',
      enableFallback: config.enableFallback ?? true,
    };

    this.primaryEndpoint = ATTRIBUTION_ENDPOINTS[this.config.primaryEndpoint];
  }

  // ============================================
  // Touchpoint Tracking
  // ============================================

  /**
   * Track a customer touchpoint (impression, click, etc.)
   */
  async trackTouchpoint(request: TrackTouchpointRequest): Promise<{ touchpointId: string }> {
    const endpoint = this.getEndpoint('unified');
    const response = await this.post(`${endpoint}/api/v1/track/touchpoint`, {
      customerId: request.customerId,
      merchantId: request.merchantId,
      channel: request.channel,
      source: request.source,
      campaignId: request.campaignId,
      timestamp: request.timestamp || new Date(),
      metadata: request.metadata,
    });
    return response as { touchpointId: string };
  }

  /**
   * Track multiple touchpoints in batch
   */
  async trackTouchpointBatch(requests: TrackTouchpointRequest[]): Promise<{ count: number }> {
    const endpoint = this.getEndpoint('unified');
    const response = await this.post(`${endpoint}/api/v1/track/touchpoint/batch`, {
      touchpoints: requests,
    });
    return response as { count: number };
  }

  // ============================================
  // Conversion Tracking
  // ============================================

  /**
   * Track a conversion (purchase, signup, etc.)
   */
  async trackConversion(request: TrackConversionRequest): Promise<{ conversionId: string }> {
    const endpoint = this.getEndpoint('unified');
    const response = await this.post(`${endpoint}/api/v1/track/conversion`, {
      customerId: request.customerId,
      merchantId: request.merchantId,
      orderId: request.orderId,
      amount: request.amount,
      channel: request.channel,
      touchpointIds: request.touchpointIds,
      timestamp: request.timestamp || new Date(),
      metadata: request.metadata,
    });
    return response as { conversionId: string };
  }

  // ============================================
  // Attribution Reports
  // ============================================

  /**
   * Get attribution report for a customer
   */
  async getAttribution(request: GetAttributionRequest): Promise<AttributionResult> {
    const endpoint = this.getEndpoint('unified');
    const params = new URLSearchParams({
      customerId: request.customerId,
      startDate: request.startDate.toISOString(),
      endDate: request.endDate.toISOString(),
    });

    if (request.merchantId) params.append('merchantId', request.merchantId);
    if (request.model) params.append('model', request.model);

    const response = await this.get(`${endpoint}/api/v1/reports/attribution?${params}`);
    return response as AttributionResult;
  }

  /**
   * Get channel attribution breakdown
   */
  async getChannelAttribution(request: GetAttributionRequest): Promise<ChannelAttribution[]> {
    const endpoint = this.getEndpoint('unified');
    const params = new URLSearchParams({
      customerId: request.customerId,
      startDate: request.startDate.toISOString(),
      endDate: request.endDate.toISOString(),
    });

    const response = await this.get(`${endpoint}/api/v1/reports/channel?${params}`);
    return (response as { channels: ChannelAttribution[] }).channels;
  }

  // ============================================
  // DOOH Attribution
  // ============================================

  /**
   * Track DOOH impression
   */
  async trackDOOHImpression(data: {
    merchantId: string;
    screenId: string;
    customerId?: string;
    dwellTime: number;
    timestamp?: Date;
  }): Promise<{ impressionId: string }> {
    const endpoint = this.getEndpoint('dooh');
    const response = await this.post(`${endpoint}/api/v1/dooh/impression`, data);
    return response as { impressionId: string };
  }

  /**
   * Track DOOH visit (when customer visits store after seeing DOOH)
   */
  async trackDOOHVisit(data: {
    merchantId: string;
    screenId: string;
    customerId: string;
    visitTime: Date;
  }): Promise<{ visitId: string }> {
    const endpoint = this.getEndpoint('dooh');
    const response = await this.post(`${endpoint}/api/v1/dooh/visit`, data);
    return response as { visitId: string };
  }

  // ============================================
  // LTV Attribution
  // ============================================

  /**
   * Get customer lifetime value by channel
   */
  async getLTVByChannel(customerId: string): Promise<{
    customerId: string;
    totalLTV: number;
    channelLTV: Record<string, number>;
  }> {
    const endpoint = this.getEndpoint('ltv');
    const response = await this.get(`${endpoint}/api/v1/ltv/${customerId}`);
    return response as { customerId: string; totalLTV: number; channelLTV: Record<string, number> };
  }

  /**
   * Get LTV cohort analysis
   */
  async getLTVCohort(cohortId: string): Promise<{
    cohortId: string;
    size: number;
    avgLTV: number;
    channelDistribution: Record<string, number>;
  }> {
    const endpoint = this.getEndpoint('ltv');
    const response = await this.get(`${endpoint}/api/v1/cohorts/${cohortId}`);
    return response as { cohortId: string; size: number; avgLTV: number; channelDistribution: Record<string, number> };
  }

  // ============================================
  // Cross-Channel Attribution
  // ============================================

  /**
   * Track cross-channel journey
   */
  async trackCrossChannelJourney(data: {
    customerId: string;
    channels: string[];
    conversions: number;
    revenue: number;
  }): Promise<{ journeyId: string }> {
    const endpoint = this.getEndpoint('crosschannel');
    const response = await this.post(`${endpoint}/api/v1/journey`, data);
    return response as { journeyId: string };
  }

  /**
   * Get cross-channel attribution model
   */
  async getCrossChannelModel(customerId: string): Promise<{
    customerId: string;
    model: string;
    channels: string[];
    weights: Record<string, number>;
  }> {
    const endpoint = this.getEndpoint('crosschannel');
    const response = await this.get(`${endpoint}/api/v1/model/${customerId}`);
    return response as { customerId: string; model: string; channels: string[]; weights: Record<string, number> };
  }

  // ============================================
  // ROI Analysis
  // ============================================

  /**
   * Get ROI by channel
   */
  async getROIByChannel(request: {
    merchantId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<{
    channel: string;
    spend: number;
    revenue: number;
    roi: number;
  }[]> {
    const endpoint = this.getEndpoint('unified');
    const params = new URLSearchParams({
      merchantId: request.merchantId,
      startDate: request.startDate.toISOString(),
      endDate: request.endDate.toISOString(),
    });

    const response = await this.get(`${endpoint}/api/v1/roi?${params}`);
    return (response as { channels: { channel: string; spend: number; revenue: number; roi: number }[] }).channels;
  }

  // ============================================
  // Helper Methods
  // ============================================

  private getEndpoint(type: keyof typeof ATTRIBUTION_ENDPOINTS): string {
    return ATTRIBUTION_ENDPOINTS[type];
  }

  private async post(url: string, data: unknown): Promise<unknown> {
    try {
      return await this.fetch(url, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': this.config.internalToken,
        },
      });
    } catch (error) {
      if (this.config.enableFallback && type !== 'unified') {
        console.warn(`Attribution endpoint ${type} failed, using primary:`, error);
        return this.post(ATTRIBUTION_ENDPOINTS.unified + url.split(ATTRIBUTION_ENDPOINTS[type as string] || '')[1], data);
      }
      throw error;
    }
  }

  private async get(url: string): Promise<unknown> {
    try {
      return await this.fetch(url, {
        method: 'GET',
        headers: {
          'X-Internal-Token': this.config.internalToken,
        },
      });
    } catch (error) {
      if (this.config.enableFallback) {
        console.warn(`Attribution endpoint failed:`, error);
      }
      throw error;
    }
  }

  private async fetch(url: string, options: RequestInit): Promise<unknown> {
    const response = await fetch(url, options as RequestInit);
    if (!response.ok) {
      throw new Error(`Attribution API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
}

// ============================================
// Utility Functions
// ============================================

export function getInternalToken(): string {
  return process.env.INTERNAL_SERVICE_TOKEN || '';
}

// ============================================
// Default Export
// ============================================

export default AttributionClient;
