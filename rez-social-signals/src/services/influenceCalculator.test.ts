import {
  calculateInfluenceScore,
  calculateSharingBehavior,
  calculateSocialReach,
  calculateReferralMetrics,
  detectCommunityOrganizer,
  InfluenceCalculationInput,
  CommunityRoleInput
} from './influenceCalculator';
import { IShareEvent, IReferralEvent } from '../models';

describe('Influence Calculator', () => {
  describe('calculateInfluenceScore', () => {
    it('should return 0 for user with no activity', () => {
      const input: InfluenceCalculationInput = {
        totalImpressions: 0,
        clickCount: 0,
        shareCount: 0,
        conversionCount: 0,
        revenue: 0,
        uniqueRecipients: 0
      };

      const result = calculateInfluenceScore(input);

      expect(result.total).toBe(0);
      expect(result.tier).toBe('none');
    });

    it('should calculate high score for user with good metrics', () => {
      const input: InfluenceCalculationInput = {
        totalImpressions: 50000,
        clickCount: 5000,
        shareCount: 100,
        conversionCount: 50,
        revenue: 5000,
        uniqueRecipients: 10000
      };

      const result = calculateInfluenceScore(input);

      expect(result.total).toBeGreaterThan(50);
      expect(['macro', 'mid', 'micro']).toContain(result.tier);
      expect(result.reachScore).toBeGreaterThan(0);
      expect(result.engagementScore).toBeGreaterThan(0);
      expect(result.conversionScore).toBeGreaterThan(0);
    });

    it('should identify macro influencers correctly', () => {
      const input: InfluenceCalculationInput = {
        totalImpressions: 150000,
        clickCount: 15000,
        shareCount: 300,
        conversionCount: 150,
        revenue: 15000,
        uniqueRecipients: 50000
      };

      const result = calculateInfluenceScore(input);

      expect(result.total).toBeGreaterThanOrEqual(80);
      expect(result.tier).toBe('macro');
    });

    it('should handle edge case with zero impressions but conversions', () => {
      const input: InfluenceCalculationInput = {
        totalImpressions: 100,
        clickCount: 50,
        shareCount: 10,
        conversionCount: 5,
        revenue: 500,
        uniqueRecipients: 20
      };

      const result = calculateInfluenceScore(input);

      expect(result.total).toBeGreaterThan(0);
      expect(result.conversionScore).toBeGreaterThan(result.reachScore);
    });
  });

  describe('detectCommunityOrganizer', () => {
    it('should identify organizers with high activity', () => {
      const input: CommunityRoleInput = {
        eventsOrganized: 10,
        groupsCreated: 5,
        groupsJoined: 20,
        postsCount: 100,
        commentsCount: 200,
        reactionsCount: 500,
        isModerator: true,
        moderatorCommunities: ['group1', 'group2']
      };

      const result = detectCommunityOrganizer(input);

      expect(result.role).toBe('organizer');
      expect(result.eventsOrganized).toBe(10);
      expect(result.groupsCreated).toBe(5);
      expect(result.communityEngagement).toBeGreaterThan(0);
    });

    it('should identify active members', () => {
      const input: CommunityRoleInput = {
        eventsOrganized: 2,
        groupsCreated: 1,
        groupsJoined: 5,
        postsCount: 30,
        commentsCount: 50,
        reactionsCount: 100,
        isModerator: false
      };

      const result = detectCommunityOrganizer(input);

      expect(result.role).toBe('active_member');
    });

    it('should identify lurkers', () => {
      const input: CommunityRoleInput = {
        eventsOrganized: 0,
        groupsCreated: 0,
        groupsJoined: 2,
        postsCount: 5,
        commentsCount: 10,
        reactionsCount: 20,
        isModerator: false
      };

      const result = detectCommunityOrganizer(input);

      expect(['lurker', 'none']).toContain(result.role);
    });
  });

  describe('calculateSharingBehavior', () => {
    it('should calculate frequency correctly', () => {
      const mockShareEvents: Partial<IShareEvent>[] = [
        { recipientCount: 50, timestamp: new Date() },
        { recipientCount: 30, timestamp: new Date() },
        { recipientCount: 40, timestamp: new Date() }
      ];

      const result = calculateSharingBehavior({
        shareEvents: mockShareEvents as IShareEvent[],
        totalOffers: 100,
        timeWindowDays: 30
      });

      expect(result.frequency).toBeGreaterThan(0);
      expect(result.avgReach).toBeGreaterThan(0);
    });

    it('should identify preferred channels', () => {
      const mockShareEvents: Partial<IShareEvent>[] = [
        { channel: 'whatsapp', recipientCount: 50, timestamp: new Date() },
        { channel: 'whatsapp', recipientCount: 30, timestamp: new Date() },
        { channel: 'instagram', recipientCount: 40, timestamp: new Date() }
      ];

      const result = calculateSharingBehavior({
        shareEvents: mockShareEvents as IShareEvent[],
        totalOffers: 100
      });

      expect(result.preferredChannels).toContain('whatsapp');
      expect(result.preferredChannels[0]).toBe('whatsapp');
    });

    it('should calculate viral coefficient', () => {
      const mockShareEvents: Partial<IShareEvent>[] = [
        { conversionCount: 5, recipientCount: 50, timestamp: new Date() },
        { conversionCount: 3, recipientCount: 30, timestamp: new Date() }
      ];

      const result = calculateSharingBehavior({
        shareEvents: mockShareEvents as IShareEvent[],
        totalOffers: 100
      });

      expect(result.viralCoefficient).toBeGreaterThan(0);
    });
  });

  describe('calculateSocialReach', () => {
    it('should aggregate reach correctly', () => {
      const mockShareEvents: Partial<IShareEvent>[] = [
        { channel: 'whatsapp', recipientCount: 100, timestamp: new Date(), contentType: 'offer' },
        { channel: 'whatsapp', recipientCount: 50, timestamp: new Date(), contentType: 'offer' },
        { channel: 'instagram', recipientCount: 75, timestamp: new Date(), contentType: 'deal' }
      ];

      const result = calculateSocialReach(mockShareEvents as IShareEvent[]);

      expect(result.totalImpressions).toBe(225);
      expect(result.whatsappReach).toBe(150);
      expect(result.instagramReach).toBe(75);
      expect(result.reachByCategory.offer).toBe(150);
      expect(result.reachByCategory.deal).toBe(75);
    });

    it('should estimate audience accounting for overlaps', () => {
      const mockShareEvents: Partial<IShareEvent>[] = [
        { channel: 'whatsapp', recipientCount: 100, timestamp: new Date(), contentType: 'offer' },
        { channel: 'facebook', recipientCount: 100, timestamp: new Date(), contentType: 'offer' }
      ];

      const result = calculateSocialReach(mockShareEvents as IShareEvent[]);

      // Estimated audience should be less than total (accounting for overlaps)
      expect(result.estimatedAudience).toBeLessThan(result.totalImpressions);
    });
  });

  describe('calculateReferralMetrics', () => {
    it('should calculate conversion rate correctly', () => {
      const mockReferralEvents: Partial<IReferralEvent>[] = [
        { status: 'converted', conversionValue: 500, timestamp: new Date(), conversionTimestamp: new Date() },
        { status: 'converted', conversionValue: 300, timestamp: new Date(), conversionTimestamp: new Date() },
        { status: 'pending', timestamp: new Date() },
        { status: 'expired', timestamp: new Date() }
      ];

      const result = calculateReferralMetrics(mockReferralEvents as IReferralEvent[]);

      expect(result.totalReferrals).toBe(4);
      expect(result.successfulReferrals).toBe(2);
      expect(result.conversionRate).toBe(0.5);
      expect(result.referralRevenue).toBe(800);
    });

    it('should calculate referral LTV', () => {
      const mockReferralEvents: Partial<IReferralEvent>[] = [
        { status: 'converted', conversionValue: 1000, timestamp: new Date(), conversionTimestamp: new Date() },
        { status: 'converted', conversionValue: 500, timestamp: new Date(), conversionTimestamp: new Date() }
      ];

      const result = calculateReferralMetrics(mockReferralEvents as IReferralEvent[]);

      expect(result.referralLTV).toBe(750);
    });

    it('should handle empty referral list', () => {
      const result = calculateReferralMetrics([]);

      expect(result.totalReferrals).toBe(0);
      expect(result.conversionRate).toBe(0);
      expect(result.referralLTV).toBe(0);
    });
  });
});
