/**
 * LTV Attribution Service
 *
 * Attributes customer lifetime value to marketing channels.
 *
 * Features:
 * - First-touch LTV attribution
 * - Last-touch LTV attribution
 * - Multi-touch LTV attribution (linear)
 * - Channel contribution analysis
 * - Campaign ROI analysis
 */

import { logger } from './utils/logger.js';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  merchantId: string;
  firstOrderDate?: Date;
  lastOrderDate?: Date;
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  sourceChannel?: string;
  sourceCampaign?: string;
  touchpoints: Touchpoint[];
}

export interface Touchpoint {
  id: string;
  customerId: string;
  channel: string;
  campaignId?: string;
  adId?: string;
  orderId?: string;
  value?: number;
  timestamp: Date;
}

export interface AttributionResult {
  customerId: string;
  totalLTV: number;
  attributedLTV: Record<string, number>;
  channelContribution: Record<string, number>;
  campaignContribution: Record<string, number>;
  touchpointCount: number;
  firstTouchChannel?: string;
  lastTouchChannel?: string;
}

export interface ChannelLTVReport {
  channel: string;
  totalLTV: number;
  customerCount: number;
  averageLTV: number;
  touchpointCount: number;
  conversionRate: number;
}

export interface CampaignLTVReport {
  campaignId: string;
  channel: string;
  totalLTV: number;
  customerCount: number;
  averageLTV: number;
  touchpointCount: number;
  orders: number;
}

// ─── LTV Attribution Engine ──────────────────────────────────────────────────

export class LTVAttributionEngine {
  /**
   * Attribute LTV for a single customer
   */
  calculateCustomerLTV(
    customer: Customer,
    model: 'first_touch' | 'last_touch' | 'linear' = 'linear'
  ): AttributionResult {
    const touchpoints = customer.touchpoints || [];

    if (touchpoints.length === 0) {
      return {
        customerId: customer.id,
        totalLTV: customer.totalSpend,
        attributedLTV: {},
        channelContribution: {},
        campaignContribution: {},
        touchpointCount: 0,
        firstTouchChannel: customer.sourceChannel,
        lastTouchChannel: customer.sourceChannel,
      };
    }

    let attributedLTV: Record<string, number> = {};
    let channelContribution: Record<string, number> = {};
    let campaignContribution: Record<string, number> = {};

    switch (model) {
      case 'first_touch':
        attributedLTV = this.firstTouchAttribution(customer);
        break;
      case 'last_touch':
        attributedLTV = this.lastTouchAttribution(customer);
        break;
      case 'linear':
      default:
        attributedLTV = this.linearAttribution(customer);
        break;
    }

    // Extract channel contribution
    for (const [key, value] of Object.entries(attributedLTV)) {
      if (key.startsWith('channel:')) {
        const channel = key.replace('channel:', '');
        channelContribution[channel] = (channelContribution[channel] || 0) + value;
      } else if (key.startsWith('campaign:')) {
        const campaign = key.replace('campaign:', '');
        campaignContribution[campaign] = (campaignContribution[campaign] || 0) + value;
      }
    }

    return {
      customerId: customer.id,
      totalLTV: customer.totalSpend,
      attributedLTV,
      channelContribution,
      campaignContribution,
      touchpointCount: touchpoints.length,
      firstTouchChannel: touchpoints[0]?.channel,
      lastTouchChannel: touchpoints[touchpoints.length - 1]?.channel,
    };
  }

  /**
   * First-touch attribution
   * All LTV attributed to first touchpoint
   */
  private firstTouchAttribution(customer: Customer): Record<string, number> {
    const firstTouch = customer.touchpoints[0];
    if (!firstTouch) return {};

    const result: Record<string, number> = {};

    // Channel attribution
    result[`channel:${firstTouch.channel}`] = customer.totalSpend;

    // Campaign attribution
    if (firstTouch.campaignId) {
      result[`campaign:${firstTouch.campaignId}`] = customer.totalSpend;
    }

    return result;
  }

  /**
   * Last-touch attribution
   * All LTV attributed to last touchpoint
   */
  private lastTouchAttribution(customer: Customer): Record<string, number> {
    const lastTouch = customer.touchpoints[customer.touchpoints.length - 1];
    if (!lastTouch) return {};

    const result: Record<string, number> = {};

    // Channel attribution
    result['channel:' + lastTouch.channel] = customer.totalSpend;

    // Campaign attribution
    if (lastTouch.campaignId) {
      result['campaign:' + lastTouch.campaignId] = customer.totalSpend;
    }

    return result;
  }

  /**
   * Linear attribution
   * LTV split equally across all touchpoints
   */
  private linearAttribution(customer: Customer): Record<string, number> {
    const touchpoints = customer.touchpoints;
    if (touchpoints.length === 0) return {};

    const valuePerTouch = customer.totalSpend / touchpoints.length;
    const result: Record<string, number> = {};

    // Channel attribution
    const channelValues: Record<string, number> = {};
    for (const touch of touchpoints) {
      channelValues[touch.channel] = (channelValues[touch.channel] || 0) + valuePerTouch;
    }

    for (const [channel, value] of Object.entries(channelValues)) {
      result[`channel:${channel}`] = value;
    }

    // Campaign attribution
    const campaignValues: Record<string, number> = {};
    for (const touch of touchpoints) {
      if (touch.campaignId) {
        campaignValues[touch.campaignId] = (campaignValues[touch.campaignId] || 0) + valuePerTouch;
      }
    }

    for (const [campaign, value] of Object.entries(campaignValues)) {
      result[`campaign:${campaign}`] = value;
    }

    return result;
  }

  /**
   * Generate channel LTV report
   */
  generateChannelReport(customers: Customer[]): ChannelLTVReport[] {
    const channelData: Record<string, {
      totalLTV: number;
      customerCount: number;
      touchpointCount: number;
    }> = {};

    for (const customer of customers) {
      const result = this.calculateCustomerLTV(customer, 'linear');

      for (const [channel, ltv] of Object.entries(result.channelContribution)) {
        if (!channelData[channel]) {
          channelData[channel] = {
            totalLTV: 0,
            customerCount: 0,
            touchpointCount: 0,
          };
        }

        channelData[channel].totalLTV += ltv;
        channelData[channel].customerCount += 1;
        channelData[channel].touchpointCount += result.touchpointCount;
      }
    }

    return Object.entries(channelData).map(([channel, data]) => ({
      channel,
      totalLTV: data.totalLTV,
      customerCount: data.customerCount,
      averageLTV: data.totalLTV / data.customerCount,
      touchpointCount: data.touchpointCount,
      conversionRate: data.touchpointCount / data.customerCount,
    }));
  }

  /**
   * Generate campaign LTV report
   */
  generateCampaignReport(customers: Customer[]): CampaignLTVReport[] {
    const campaignData: Record<string, {
      channel: string;
      totalLTV: number;
      customerCount: number;
      touchpointCount: number;
      orders: number;
    }> = {};

    for (const customer of customers) {
      const result = this.calculateCustomerLTV(customer, 'linear');

      for (const [key, ltv] of Object.entries(result.campaignContribution)) {
        const campaignId = key.replace('campaign:', '');

        if (!campaignData[campaignId]) {
          // Get channel from first touchpoint
          const firstTouch = customer.touchpoints.find(t => t.campaignId === campaignId);
          campaignData[campaignId] = {
            channel: firstTouch?.channel || 'unknown',
            totalLTV: 0,
            customerCount: 0,
            touchpointCount: 0,
            orders: 0,
          };
        }

        campaignData[campaignId].totalLTV += ltv;
        campaignData[campaignId].customerCount += 1;
        campaignData[campaignId].touchpointCount += result.touchpointCount;
        campaignData[campaignId].orders += customer.totalOrders;
      }
    }

    return Object.entries(campaignData).map(([campaignId, data]) => ({
      campaignId,
      channel: data.channel,
      totalLTV: data.totalLTV,
      customerCount: data.customerCount,
      averageLTV: data.totalLTV / data.customerCount,
      touchpointCount: data.touchpointCount,
      orders: data.orders,
    }));
  }

  /**
   * Calculate channel efficiency (LTV per touchpoint)
   */
  calculateChannelEfficiency(customers: Customer[]): Record<string, number> {
    const channelData: Record<string, { totalLTV: number; touchpoints: number }> = {};

    for (const customer of customers) {
      const result = this.calculateCustomerLTV(customer, 'linear');

      for (const [channel, ltv] of Object.entries(result.channelContribution)) {
        if (!channelData[channel]) {
          channelData[channel] = { totalLTV: 0, touchpoints: 0 };
        }
        channelData[channel].totalLTV += ltv;
        channelData[channel].touchpoints += result.touchpointCount;
      }
    }

    const efficiency: Record<string, number> = {};
    for (const [channel, data] of Object.entries(channelData)) {
      efficiency[channel] = data.touchpoints > 0 ? data.totalLTV / data.touchpoints : 0;
    }

    return efficiency;
  }
}

export const ltvAttribution = new LTVAttributionEngine();
export default ltvAttribution;
