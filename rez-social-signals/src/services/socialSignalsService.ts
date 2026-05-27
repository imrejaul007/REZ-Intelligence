import { v4 as uuidv4 } from 'uuid';
import {
  UserSocialProfile,
  ShareEvent,
  ReferralEvent,
  TrackShareInput,
  TrackReferralInput,
  ShareChannel,
  ApiResponse,
  InfluencerSummary,
  SocialSegment,
  InfluenceTier
} from '../types';
import {
  ShareEvent as ShareEventModel,
  ReferralEvent as ReferralEventModel,
  UserSocialProfile as UserSocialProfileModel,
  IShareEvent,
  IReferralEvent,
  IUserSocialProfile
} from '../models';
import {
  calculateInfluenceScore,
  calculateSharingBehavior,
  calculateSocialReach,
  calculateReferralMetrics,
  detectCommunityOrganizer,
  CommunityRoleInput,
  InfluenceCalculationInput
} from './influenceCalculator';

/**
 * Social Signals Service
 * Main service for tracking and analyzing social commerce signals
 */
export class SocialSignalsService {
  /**
   * Get or create user social profile
   */
  async getOrCreateProfile(userId: string): Promise<IUserSocialProfile> {
    let profile = await UserSocialProfileModel.findOne({ userId });

    if (!profile) {
      profile = new UserSocialProfileModel({
        userId,
        sharingBehavior: {
          frequency: 0,
          avgReach: 0,
          shareRate: 0,
          preferredChannels: [],
          viralCoefficient: 0,
          topSharedCategories: []
        },
        influenceScore: {
          total: 0,
          reachScore: 0,
          engagementScore: 0,
          conversionScore: 0,
          tier: 'none'
        },
        communityRole: {
          role: 'none',
          groupsJoined: 0,
          groupsCreated: 0,
          eventsOrganized: 0,
          eventsAttended: 0,
          communityEngagement: 0
        },
        socialReach: {
          totalImpressions: 0,
          uniqueRecipients: 0,
          whatsappReach: 0,
          instagramReach: 0,
          facebookReach: 0,
          twitterReach: 0,
          linkReach: 0,
          estimatedAudience: 0,
          reachByCategory: {}
        },
        referralMetrics: {
          totalReferrals: 0,
          pendingReferrals: 0,
          successfulReferrals: 0,
          conversionRate: 0,
          avgOrderValueFromReferrals: 0,
          referralRevenue: 0,
          referralLTV: 0
        },
        lastUpdated: new Date()
      });
      await profile.save();
    }

    return profile;
  }

  /**
   * Get user social profile
   */
  async getUserProfile(userId: string): Promise<ApiResponse<UserSocialProfile>> {
    try {
      const profile = await this.getOrCreateProfile(userId);

      return {
        success: true,
        data: this.mapProfileToOutput(profile),
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get profile',
        timestamp: new Date()
      };
    }
  }

  /**
   * Track a share event
   */
  async trackShare(input: TrackShareInput): Promise<ApiResponse<ShareEvent>> {
    try {
      const shareId = uuidv4();
      const shareEvent = new ShareEventModel({
        shareId,
        userId: input.userId,
        contentType: input.contentType,
        contentId: input.contentId,
        channel: input.channel,
        recipientCount: input.recipientCount || 0,
        clickCount: input.clickCount || 0,
        conversionCount: input.conversionCount || 0,
        revenue: input.revenue || 0,
        timestamp: new Date(),
        metadata: input.metadata
      });

      await shareEvent.save();

      // Update user profile
      await this.updateProfileFromShare(input.userId, shareEvent);

      return {
        success: true,
        data: this.mapShareEventToOutput(shareEvent),
        message: 'Share event tracked successfully',
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to track share',
        timestamp: new Date()
      };
    }
  }

  /**
   * Track a referral conversion
   */
  async trackReferral(input: TrackReferralInput): Promise<ApiResponse<ReferralEvent>> {
    try {
      const referralId = uuidv4();

      const referralEvent = new ReferralEventModel({
        referralId,
        referrerId: input.referrerId,
        refereeId: input.refereeId,
        referralCode: input.referralCode,
        source: input.source,
        status: 'pending',
        conversionValue: input.conversionValue,
        timestamp: new Date()
      });

      await referralEvent.save();

      // If there's a conversion value, update referrer profile
      if (input.conversionValue && input.conversionValue > 0) {
        referralEvent.status = 'converted';
        referralEvent.conversionTimestamp = new Date();
        await referralEvent.save();
        await this.updateProfileFromReferral(input.referrerId, referralEvent);
      }

      return {
        success: true,
        data: this.mapReferralEventToOutput(referralEvent),
        message: 'Referral event tracked successfully',
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to track referral',
        timestamp: new Date()
      };
    }
  }

  /**
   * Convert a pending referral to converted
   */
  async convertReferral(referralId: string, conversionValue: number): Promise<ApiResponse<ReferralEvent>> {
    try {
      const referralEvent = await ReferralEventModel.findOne({ referralId });

      if (!referralEvent) {
        return {
          success: false,
          error: 'Referral not found',
          timestamp: new Date()
        };
      }

      if (referralEvent.status === 'converted') {
        return {
          success: false,
          error: 'Referral already converted',
          timestamp: new Date()
        };
      }

      referralEvent.status = 'converted';
      referralEvent.conversionValue = conversionValue;
      referralEvent.conversionTimestamp = new Date();
      await referralEvent.save();

      // Update referrer profile
      await this.updateProfileFromReferral(referralEvent.referrerId, referralEvent);

      return {
        success: true,
        data: this.mapReferralEventToOutput(referralEvent),
        message: 'Referral converted successfully',
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert referral',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get influence score for a user
   */
  async getInfluenceScore(userId: string): Promise<ApiResponse<{ userId: string; influenceScore: UserSocialProfile['influenceScore'] }>> {
    try {
      const profile = await this.getOrCreateProfile(userId);

      return {
        success: true,
        data: {
          userId,
          influenceScore: profile.influenceScore
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get influence score',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get sharing behavior for a user
   */
  async getSharingBehavior(userId: string): Promise<ApiResponse<{ userId: string; sharingBehavior: UserSocialProfile['sharingBehavior'] }>> {
    try {
      const profile = await this.getOrCreateProfile(userId);

      return {
        success: true,
        data: {
          userId,
          sharingBehavior: profile.sharingBehavior
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get sharing behavior',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get referral metrics for a user
   */
  async getReferralMetrics(userId: string): Promise<ApiResponse<{ userId: string; referralMetrics: UserSocialProfile['referralMetrics'] }>> {
    try {
      const profile = await this.getOrCreateProfile(userId);

      return {
        success: true,
        data: {
          userId,
          referralMetrics: profile.referralMetrics
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get referral metrics',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get top influencers
   */
  async getTopInfluencers(limit: number = 20, minScore: number = 20): Promise<ApiResponse<InfluencerSummary[]>> {
    try {
      const profiles = await UserSocialProfileModel.find({
        'influenceScore.total': { $gte: minScore }
      })
        .sort({ 'influenceScore.total': -1 })
        .limit(limit);

      const summaries: InfluencerSummary[] = profiles.map(profile => {
        const totalRevenue = profile.referralMetrics.referralRevenue;
        const totalConversions = profile.referralMetrics.successfulReferrals;

        // Find top channel
        const reachByChannel = {
          whatsapp: profile.socialReach.whatsappReach,
          instagram: profile.socialReach.instagramReach,
          facebook: profile.socialReach.facebookReach,
          twitter: profile.socialReach.twitterReach,
          link: profile.socialReach.linkReach
        };

        const topChannel = Object.entries(reachByChannel)
          .sort(([, a], [, b]) => b - a)[0][0] as ShareChannel;

        return {
          userId: profile.userId,
          influenceScore: profile.influenceScore,
          totalRevenue,
          totalConversions,
          topChannel,
          rank: 0 // Will be set after sorting
        };
      });

      // Assign ranks
      summaries.forEach((summary, index) => {
        summary.rank = index + 1;
      });

      return {
        success: true,
        data: summaries,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get top influencers',
        timestamp: new Date()
      };
    }
  }

  /**
   * Get users by social segment
   */
  async getUsersBySegment(
    segment: SocialSegment['segmentType'],
    limit: number = 100
  ): Promise<ApiResponse<{ segment: SocialSegment['segmentType']; userIds: string[]; count: number }>> {
    try {
      let query: Record<string, unknown> = {};

      switch (segment) {
        case 'influencer':
          query = { 'influenceScore.total': { $gte: 20 } };
          break;
        case 'referrer':
          query = { 'referralMetrics.totalReferrals': { $gt: 0 } };
          break;
        case 'community_organizer':
          query = { 'communityRole.role': 'organizer' };
          break;
        case 'viral_sharer':
          query = { 'sharingBehavior.viralCoefficient': { $gt: 0.1 } };
          break;
        case 'engaged_user':
          query = { 'sharingBehavior.frequency': { $gt: 5 } };
          break;
      }

      const profiles = await UserSocialProfileModel.find(query)
        .select('userId')
        .limit(limit);

      const userIds = profiles.map(p => p.userId);

      return {
        success: true,
        data: {
          segment,
          userIds,
          count: userIds.length
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get users by segment',
        timestamp: new Date()
      };
    }
  }

  /**
   * Update profile from share event
   */
  private async updateProfileFromShare(userId: string, shareEvent: IShareEvent): Promise<void> {
    const profile = await this.getOrCreateProfile(userId);

    // Get all share events for this user
    const shareEvents = await ShareEventModel.find({ userId })
      .sort({ timestamp: -1 })
      .limit(100);

    // Recalculate metrics
    const influenceInput: InfluenceCalculationInput = {
      totalImpressions: shareEvents.reduce((sum, s) => sum + s.recipientCount, 0),
      clickCount: shareEvents.reduce((sum, s) => sum + s.clickCount, 0),
      shareCount: shareEvents.length,
      conversionCount: shareEvents.reduce((sum, s) => sum + s.conversionCount, 0),
      revenue: shareEvents.reduce((sum, s) => sum + s.revenue, 0),
      uniqueRecipients: this.estimateUniqueRecipients(shareEvents),
      recentShares: shareEvents.slice(0, 20)
    };

    profile.influenceScore = calculateInfluenceScore(influenceInput);
    profile.sharingBehavior = calculateSharingBehavior({
      shareEvents,
      totalOffers: 100 // Would come from offers service
    });

    const reach = calculateSocialReach(shareEvents);
    profile.socialReach = {
      ...profile.socialReach,
      ...reach
    };

    profile.lastUpdated = new Date();
    await profile.save();
  }

  /**
   * Update profile from referral event
   */
  private async updateProfileFromReferral(userId: string, referralEvent: IReferralEvent): Promise<void> {
    const profile = await this.getOrCreateProfile(userId);

    // Get all referral events for this user
    const referralEvents = await ReferralEventModel.find({ referrerId: userId });

    const metrics = calculateReferralMetrics(referralEvents);
    profile.referralMetrics = {
      ...profile.referralMetrics,
      ...metrics
    };

    profile.lastUpdated = new Date();
    await profile.save();
  }

  /**
   * Estimate unique recipients from share events
   */
  private estimateUniqueRecipients(shareEvents: IShareEvent[]): number {
    // Simple estimation: total recipients * 0.7 (accounting for overlaps)
    const total = shareEvents.reduce((sum, s) => sum + s.recipientCount, 0);
    return Math.round(total * 0.7);
  }

  /**
   * Map profile to output format
   */
  private mapProfileToOutput(profile: IUserSocialProfile): UserSocialProfile {
    return {
      userId: profile.userId,
      sharingBehavior: profile.sharingBehavior as UserSocialProfile['sharingBehavior'],
      influenceScore: profile.influenceScore as UserSocialProfile['influenceScore'],
      communityRole: profile.communityRole as UserSocialProfile['communityRole'],
      socialReach: {
        totalImpressions: profile.socialReach.totalImpressions,
        uniqueRecipients: profile.socialReach.uniqueRecipients,
        whatsappReach: profile.socialReach.whatsappReach,
        instagramReach: profile.socialReach.instagramReach,
        facebookReach: profile.socialReach.facebookReach,
        twitterReach: profile.socialReach.twitterReach,
        linkReach: profile.socialReach.linkReach,
        estimatedAudience: profile.socialReach.estimatedAudience,
        reachByCategory: profile.socialReach.reachByCategory as Record<string, number>
      },
      referralMetrics: profile.referralMetrics as UserSocialProfile['referralMetrics'],
      lastUpdated: profile.lastUpdated,
      createdAt: (profile as unknown as { createdAt: Date }).createdAt || new Date()
    };
  }

  /**
   * Map share event to output format
   */
  private mapShareEventToOutput(event: IShareEvent): ShareEvent {
    return {
      shareId: event.shareId,
      userId: event.userId,
      contentType: event.contentType,
      contentId: event.contentId,
      contentTitle: event.contentTitle,
      channel: event.channel,
      recipientCount: event.recipientCount,
      clickCount: event.clickCount,
      conversionCount: event.conversionCount,
      revenue: event.revenue,
      timestamp: event.timestamp,
      metadata: event.metadata
    };
  }

  /**
   * Map referral event to output format
   */
  private mapReferralEventToOutput(event: IReferralEvent): ReferralEvent {
    return {
      referralId: event.referralId,
      referrerId: event.referrerId,
      refereeId: event.refereeId,
      referralCode: event.referralCode,
      source: event.source,
      status: event.status,
      conversionValue: event.conversionValue,
      conversionTimestamp: event.conversionTimestamp,
      expiresAt: event.expiresAt,
      timestamp: event.timestamp
    };
  }

  /**
   * Batch update community role (called from events service)
   */
  async updateCommunityRole(userId: string, input: CommunityRoleInput): Promise<ApiResponse<UserSocialProfile>> {
    try {
      const profile = await this.getOrCreateProfile(userId);
      profile.communityRole = detectCommunityOrganizer(input);
      profile.lastUpdated = new Date();
      await profile.save();

      return {
        success: true,
        data: this.mapProfileToOutput(profile) as UserSocialProfile,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update community role',
        timestamp: new Date()
      };
    }
  }
}

// Export singleton instance
export const socialSignalsService = new SocialSignalsService();
