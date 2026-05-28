/**
 * DOOHModule - Digital Out-of-Home Engagement
 * Tracks DOOH interactions, QR scans, and campaign engagement
 */

import crypto from 'crypto';
import winston from 'winston';
import { ConsumerGraph } from '../ConsumerGraph';
import { DOOHEngagement, DOOHSummary } from '../types';

export interface DOOHScanResult {
  success: boolean;
  campaign_id?: string;
  offer_id?: string;
  reward_earned?: number;
  points_credited?: boolean;
  error?: string;
}

export interface CampaignEngagement {
  campaign_id: string;
  campaign_name: string;
  views: number;
  scans: number;
  redemptions: number;
  engagement_rate: number;
  last_engagement: string;
}

export class DOOHModule {
  private consumerGraph: ConsumerGraph;
  private logger: winston.Logger;

  // Local storage
  private engagements: Map<string, DOOHEngagement[]>;
  private campaignViews: Map<string, Map<string, number>>; // userId -> campaignId -> views

  constructor(consumerGraph: ConsumerGraph) {
    this.consumerGraph = consumerGraph;
    this.engagements = new Map();
    this.campaignViews = new Map();

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });

    this.logger.info('DOOHModule initialized');
  }

  // ============================================
  // SCANNING
  // ============================================

  /**
   * Process QR code scan
   */
  async processScan(
    userId: string,
    code: string,
    locationId: string
  ): Promise<DOOHScanResult> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) {
      return { success: false, error: 'Consumer not found' };
    }

    // Parse QR code (format: REZ:CAMPAIGN:OFFER:LOCATION)
    const parts = code.split(':');
    if (parts.length < 2 || parts[0] !== 'REZ') {
      return { success: false, error: 'Invalid QR code format' };
    }

    const campaignId = parts[1];
    const offerId = parts[2] || undefined;
    const location = parts[3] || locationId;

    // Create engagement record
    const engagement: DOOHEngagement = {
      engagement_id: `${crypto.randomUUID()}`,
      user_id: userId,
      campaign_id: campaignId,
      location_id: location,
      engagement_type: 'scan',
      timestamp: new Date().toISOString(),
      reward_earned: 0,
    };

    // Store engagement
    this.storeEngagement(userId, engagement);

    // Update consumer DOOH stats
    profile.recordDOOHEngagement('scan', location);

    // Track campaign view
    this.incrementCampaignView(userId, campaignId);

    // Calculate reward (simplified)
    let rewardEarned = 10; // Base points
    if (offerId) {
      rewardEarned += 5; // Bonus for offer
    }

    this.logger.info('DOOH scan processed', {
      userId,
      campaignId,
      offerId,
      rewardEarned,
    });

    return {
      success: true,
      campaign_id: campaignId,
      offer_id: offerId,
      reward_earned: rewardEarned,
      points_credited: true,
    };
  }

  /**
   * Record view (without scan)
   */
  async recordView(
    userId: string,
    campaignId: string,
    locationId: string,
    duration?: number
  ): Promise<void> {
    const engagement: DOOHEngagement = {
      engagement_id: `${crypto.randomUUID()}`,
      user_id: userId,
      campaign_id: campaignId,
      location_id: locationId,
      engagement_type: 'view',
      timestamp: new Date().toISOString(),
      duration,
    };

    this.storeEngagement(userId, engagement);
    this.incrementCampaignView(userId, campaignId);
  }

  /**
   * Record interaction
   */
  async recordInteraction(
    userId: string,
    campaignId: string,
    locationId: string
  ): Promise<void> {
    const engagement: DOOHEngagement = {
      engagement_id: `${crypto.randomUUID()}`,
      user_id: userId,
      campaign_id: campaignId,
      location_id: locationId,
      engagement_type: 'interact',
      timestamp: new Date().toISOString(),
    };

    this.storeEngagement(userId, engagement);
  }

  /**
   * Record redemption
   */
  async recordRedemption(
    userId: string,
    campaignId: string,
    offerId: string,
    pointsSpent?: number
  ): Promise<void> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) return;

    const engagement: DOOHEngagement = {
      engagement_id: `${crypto.randomUUID()}`,
      user_id: userId,
      campaign_id: campaignId,
      location_id: '',
      engagement_type: 'redeem',
      timestamp: new Date().toISOString(),
      reward_earned: 0,
    };

    this.storeEngagement(userId, engagement);
    profile.recordDOOHEngagement('redeem');

    this.logger.info('DOOH redemption recorded', { userId, campaignId, offerId });
  }

  // ============================================
  // SUMMARIES
  // ============================================

  /**
   * Get DOOH summary for consumer
   */
  async getDOOHSummary(userId: string): Promise<DOOHSummary | null> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) return null;

    const consumerData = profile.toJSON();
    return consumerData.dooh;
  }

  /**
   * Get campaign engagement for consumer
   */
  async getCampaignEngagements(
    userId: string,
    limit: number = 10
  ): Promise<CampaignEngagement[]> {
    const userEngagements = this.engagements.get(userId) || [];
    const campaignMap = new Map<
      string,
      {
        views: number;
        scans: number;
        redemptions: number;
        last_engagement: string;
      }
    >();

    for (const engagement of userEngagements) {
      const existing = campaignMap.get(engagement.campaign_id) || {
        views: 0,
        scans: 0,
        redemptions: 0,
        last_engagement: '',
      };

      switch (engagement.engagement_type) {
        case 'view':
          existing.views++;
          break;
        case 'scan':
          existing.scans++;
          break;
        case 'redeem':
          existing.redemptions++;
          break;
      }

      if (engagement.timestamp > existing.last_engagement) {
        existing.last_engagement = engagement.timestamp;
      }

      campaignMap.set(engagement.campaign_id, existing);
    }

    return Array.from(campaignMap.entries())
      .map(([campaignId, stats]) => ({
        campaign_id: campaignId,
        campaign_name: campaignId, // Would come from campaign service
        views: stats.views,
        scans: stats.scans,
        redemptions: stats.redemptions,
        engagement_rate:
          stats.views > 0 ? (stats.scans / stats.views) * 100 : 0,
        last_engagement: stats.last_engagement,
      }))
      .sort(
        (a, b) =>
          new Date(b.last_engagement).getTime() -
          new Date(a.last_engagement).getTime()
      )
      .slice(0, limit);
  }

  // ============================================
  // LOCATION ANALYTICS
  // ============================================

  /**
   * Get favorite DOOH locations
   */
  async getFavoriteLocations(userId: string): Promise<
    Array<{
      location_id: string;
      visit_count: number;
      last_visit: string;
      campaigns: number;
    }>
  > {
    const userEngagements = this.engagements.get(userId) || [];
    const locationMap = new Map<
      string,
      { visit_count: number; last_visit: string; campaigns: Set<string> }
    >();

    for (const engagement of userEngagements) {
      if (!engagement.location_id) continue;

      const existing = locationMap.get(engagement.location_id) || {
        visit_count: 0,
        last_visit: '',
        campaigns: new Set(),
      };

      existing.visit_count++;
      existing.campaigns.add(engagement.campaign_id);

      if (engagement.timestamp > existing.last_visit) {
        existing.last_visit = engagement.timestamp;
      }

      locationMap.set(engagement.location_id, existing);
    }

    return Array.from(locationMap.entries())
      .map(([locationId, stats]) => ({
        location_id: locationId,
        visit_count: stats.visit_count,
        last_visit: stats.last_visit,
        campaigns: stats.campaigns.size,
      }))
      .sort((a, b) => b.visit_count - a.visit_count);
  }

  // ============================================
  // HELPERS
  // ============================================

  private storeEngagement(userId: string, engagement: DOOHEngagement): void {
    if (!this.engagements.has(userId)) {
      this.engagements.set(userId, []);
    }
    this.engagements.get(userId)!.push(engagement);
  }

  private incrementCampaignView(userId: string, campaignId: string): void {
    if (!this.campaignViews.has(userId)) {
      this.campaignViews.set(userId, new Map());
    }
    const views = this.campaignViews.get(userId)!;
    views.set(campaignId, (views.get(campaignId) || 0) + 1);
  }

  /**
   * Get engagement history
   */
  async getEngagementHistory(
    userId: string,
    type?: 'view' | 'scan' | 'interact' | 'redeem',
    limit: number = 50
  ): Promise<DOOHEngagement[]> {
    const userEngagements = this.engagements.get(userId) || [];

    let filtered = userEngagements;
    if (type) {
      filtered = userEngagements.filter((e) => e.engagement_type === type);
    }

    return filtered
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, limit);
  }

  /**
   * Calculate DOOH influence score
   */
  async getInfluenceScore(userId: string): Promise<number> {
    const profile = await this.consumerGraph.getConsumer(userId);
    if (!profile) return 0;

    const consumerData = profile.toJSON();
    const dooh = consumerData.dooh;

    // Base score from scan count
    let score = Math.min(1, dooh.scanned_codes / 50);

    // Boost from redemption rate
    if (dooh.scanned_codes > 0) {
      score += (dooh.redemptions / dooh.scanned_codes) * 0.2;
    }

    // Boost from engagement score
    score += dooh.engagement_score * 0.2;

    // Boost from unique locations
    score += Math.min(0.1, dooh.favorite_locations.length * 0.02);

    return Math.min(1, score);
  }
}
