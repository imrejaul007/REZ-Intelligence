/**
 * CrossSell to Ads Integration
 *
 * Connects REZ-commerce-agents CrossSellAgent to REZ-ads-service
 * for moment-based cross-merchant advertising.
 *
 * Flow:
 * 1. CrossSellAgent generates recommendations
 * 2. Integration creates ad campaigns from recommendations
 * 3. REZ-ads-service serves ads with cross-sell targeting
 * 4. Attribution tracked back to source merchant
 */

import { logger } from '../config/logger';

const AD_SERVICE_URL = process.env.AD_SERVICE_URL || 'http://localhost:4007';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// ============================================
// TYPES
// ============================================

export interface CrossSellRecommendation {
  userId: string;
  fromMerchantId: string;
  fromMerchantName: string;
  fromCategory: string;
  toMerchantId: string;
  toMerchantName: string;
  toCategory: string;
  confidence: number;
  reason: string;
  estimatedValue: number;
  expiresAt?: Date;
}

export interface AdCampaignFromCrossSell {
  name: string;
  type: 'cross_sell' | 'upsell';
  merchantId: string;
  targetMerchantId: string;
  targeting: {
    userId?: string;
    segment?: string;
    categoryAffinity?: string[];
  };
  budget: number;
  cashbackPercent: number;
  validFrom: Date;
  validUntil: Date;
  attribution: {
    sourceMerchantId: string;
    sourceCategory: string;
    campaignType: string;
  };
}

export interface CrossSellAdResult {
  campaignId: string;
  adId: string;
  status: 'created' | 'pending' | 'active';
  targetingReason: string;
  estimatedReach: number;
  estimatedConversions: number;
}

// ============================================
// CROSS-SELL ADS INTEGRATION
// ============================================

export class CrossSellAdsIntegration {
  /**
   * Create ad campaign from cross-sell recommendation
   */
  async createCampaignFromRecommendation(
    recommendation: CrossSellRecommendation
  ): Promise<CrossSellAdResult> {
    try {
      // Create campaign payload
      const campaign: AdCampaignFromCrossSell = {
        name: `Cross-sell: ${recommendation.fromMerchantName} → ${recommendation.toMerchantName}`,
        type: 'cross_sell',
        merchantId: recommendation.toMerchantId,
        targetMerchantId: recommendation.fromMerchantId,
        targeting: {
          userId: recommendation.userId,
          categoryAffinity: [recommendation.fromCategory]
        },
        budget: recommendation.estimatedValue * 0.1, // 10% of estimated value
        cashbackPercent: 10,
        validFrom: new Date(),
        validUntil: recommendation.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        attribution: {
          sourceMerchantId: recommendation.fromMerchantId,
          sourceCategory: recommendation.fromCategory,
          campaignType: 'cross_sell_recommendation'
        }
      };

      // Create campaign in ad service
      const response = await fetch(`${AD_SERVICE_URL}/api/campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': INTERNAL_TOKEN
        },
        body: JSON.stringify(campaign)
      });

      if (!response.ok) {
        throw new Error(`Failed to create campaign: ${response.statusText}`);
      }

      const result = await response.json();

      logger.info('Cross-sell campaign created', {
        recommendation,
        campaignId: result.data?.campaignId
      });

      return {
        campaignId: result.data?.campaignId || '',
        adId: result.data?.adId || '',
        status: 'created',
        targetingReason: recommendation.reason,
        estimatedReach: 1,
        estimatedConversions: Math.round(recommendation.confidence * recommendation.estimatedValue)
      };
    } catch (error) {
      logger.error('Failed to create cross-sell campaign', { error, recommendation });
      throw error;
    }
  }

  /**
   * Batch create campaigns from recommendations
   */
  async createBatchCampaigns(
    recommendations: CrossSellRecommendation[]
  ): Promise<CrossSellAdResult[]> {
    const results: CrossSellAdResult[] = [];

    for (const recommendation of recommendations) {
      try {
        const result = await this.createCampaignFromRecommendation(recommendation);
        results.push(result);
      } catch (error) {
        logger.error('Failed to create campaign for recommendation', {
          error,
          recommendation
        });
      }
    }

    return results;
  }

  /**
   * Get active cross-sell campaigns for user
   */
  async getActiveCampaignsForUser(userId: string): Promise<CrossSellAdResult[]> {
    try {
      const response = await fetch(
        `${AD_SERVICE_URL}/api/campaigns?userId=${userId}&type=cross_sell&status=active`,
        {
          method: 'GET',
          headers: {
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch campaigns: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data?.campaigns || [];
    } catch (error) {
      logger.error('Failed to fetch active campaigns', { error, userId });
      return [];
    }
  }

  /**
   * Pause cross-sell campaign after conversion
   */
  async pauseCampaignAfterConversion(campaignId: string, conversionValue: number): Promise<void> {
    try {
      const response = await fetch(`${AD_SERVICE_URL}/api/campaigns/${campaignId}/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': INTERNAL_TOKEN
        },
        body: JSON.stringify({
          reason: 'conversion',
          conversionValue
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to pause campaign: ${response.statusText}`);
      }

      logger.info('Cross-sell campaign paused after conversion', {
        campaignId,
        conversionValue
      });
    } catch (error) {
      logger.error('Failed to pause campaign', { error, campaignId });
    }
  }
}

// ============================================
// CATEGORY CROSS-SELL MAP
// ============================================

export const CATEGORY_CROSS_SELL_MAP: Record<string, string[]> = {
  'gym': ['nutrition', 'supplements', 'sports_wear', 'wellness', 'protein_shop'],
  'restaurant': ['dessert', 'cafe', 'food_delivery', 'grocery'],
  'cafe': ['bakery', 'restaurant', 'bookstore'],
  'salon': ['spa', 'beauty', 'skincare', 'wellness'],
  'spa': ['salon', 'wellness', 'yoga', 'massage'],
  'yoga': ['gym', 'wellness', 'nutrition', 'sports_wear'],
  'grocery': ['restaurant', 'pharmacy', 'convenience_store'],
  'pharmacy': ['grocery', 'health_clinic', 'wellness'],
  'electronics': ['accessories', 'repairs', 'accessories_shop'],
  'fashion': ['accessories', 'footwear', 'jewelry'],
  'footwear': ['fashion', 'sports', 'accessories'],
  'sports': ['nutrition', 'supplements', 'sports_wear', 'gym'],
  'movies': ['restaurant', 'cafe', 'entertainment'],
  'travel': ['hotels', 'restaurants', 'tourism', 'transport']
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getCrossSellCategories(category: string): string[] {
  return CATEGORY_CROSS_SELL_MAP[category.toLowerCase()] || [];
}

export function calculateCrossSellValue(
  avgBill: number,
  conversionRate: number,
  cashbackPercent: number
): number {
  // Expected value = avgBill * conversionRate * (1 - cashbackPercent)
  return avgBill * conversionRate * (1 - cashbackPercent / 100);
}

export function shouldShowCrossSellAd(
  user: { churnRisk: number; lastVisit: Date; visitFrequency: number },
  recommendation: { confidence: number }
): boolean {
  const daysSinceVisit = Math.floor(
    (Date.now() - user.lastVisit.getTime()) / (1000 * 60 * 60 * 24)
  );
  const expectedDaysBetweenVisits = 1 / user.visitFrequency;

  // Show ad if:
  // 1. High churn risk
  // 2. User hasn't visited in expected timeframe
  // 3. High confidence in recommendation
  const showDueToChurn = user.churnRisk > 0.6;
  const showDueToInactivity = daysSinceVisit > expectedDaysBetweenVisits * 0.8;
  const showDueToConfidence = recommendation.confidence > 0.7;

  return (showDueToChurn || showDueToInactivity) && showDueToConfidence;
}

// ============================================
// DEFAULT EXPORT
// ============================================

export const crossSellAdsIntegration = new CrossSellAdsIntegration();
