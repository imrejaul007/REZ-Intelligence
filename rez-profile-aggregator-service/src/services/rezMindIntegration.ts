/**
 * REZ Mind Integration Service
 *
 * Connects Profile Aggregator to REZ Mind for AI-powered insights
 *
 * This service:
 * - Fetches user analytics from REZ Mind
 * - Enriches unified profile with AI data
 * - Publishes loyalty signals to REZ Mind
 * - Uses satisfaction predictions for retention
 */

import axios from 'axios';
import { redis } from '../config/redis';

const REZ_MIND_URL = process.env.REZ_MIND_URL || 'http://localhost:4017';
const CACHE_TTL = 300; // 5 minutes

// Cache keys
const REZ_MIND_CACHE_PREFIX = 'rezmind:';

export interface MindUserAnalytics {
  userId: string;
  preferences: {
    preferredCities: string[];
    preferredStarRatings: number[];
    preferredAmenities: string[];
    dietaryPreferences: string[];
  };
  behavior: {
    avgBookingValue: number;
    totalBookings: number;
    stayFrequency: number;
    lastBookingDate?: string;
    serviceUsagePatterns: Record<string, number>;
  };
  intelligence: {
    satisfactionScore: number;
    engagementScore: number;
    loyaltyTendency: number;
    priceRange: 'budget' | 'mid' | 'premium' | 'luxury';
  };
  risk: {
    churnRisk: number;
    atRisk: boolean;
    riskFactors: string[];
  };
}

export interface MindSatisfactionPrediction {
  score: number;
  riskFactors: string[];
  recommendations: string[];
  atRisk: boolean;
}

export class RezMindIntegration {

  /**
   * Get enhanced user analytics from REZ Mind
   */
  async getUserAnalytics(userId: string): Promise<MindUserAnalytics | null> {
    // Check cache first
    const cacheKey = `${REZ_MIND_CACHE_PREFIX}analytics:${userId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Call REZ Mind API
      const response = await axios.get(
        `${REZ_MIND_URL}/api/analytics/user/${userId}`,
        { timeout: 3000 }
      );

      if (!response.data) {
        return null;
      }

      // Transform to our format
      const analytics: MindUserAnalytics = {
        userId,
        preferences: {
          preferredCities: response.data.preferredCities || [],
          preferredStarRatings: response.data.preferredStarRatings || [],
          preferredAmenities: response.data.preferredAmenities || [],
          dietaryPreferences: response.data.dietaryPreferences || [],
        },
        behavior: {
          avgBookingValue: response.data.avgBookingValue || 0,
          totalBookings: response.data.totalBookings || 0,
          stayFrequency: response.data.stayFrequency || 0,
          lastBookingDate: response.data.lastBookingDate,
          serviceUsagePatterns: response.data.serviceUsagePatterns || {},
        },
        intelligence: {
          satisfactionScore: response.data.satisfactionScore || 50,
          engagementScore: response.data.engagementScore || 50,
          loyaltyTendency: response.data.loyaltyTendency || 50,
          priceRange: this.getPriceRange(response.data.avgBookingValue || 0),
        },
        risk: {
          churnRisk: response.data.churnRisk || 0,
          atRisk: response.data.atRisk || false,
          riskFactors: response.data.riskFactors || [],
        },
      };

      // Cache the result
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(analytics));

      return analytics;
    } catch (error) {
      console.error('Failed to get REZ Mind analytics:', error);
      return null;
    }
  }

  /**
   * Get satisfaction prediction
   */
  async getSatisfactionPrediction(userId: string): Promise<MindSatisfactionPrediction | null> {
    try {
      const response = await axios.get(
        `${REZ_MIND_URL}/api/ai/satisfaction/${userId}`,
        { timeout: 3000 }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to get satisfaction prediction:', error);
      return null;
    }
  }

  /**
   * Publish loyalty signal to REZ Mind
   */
  async publishLoyaltySignal(signal: {
    userId: string;
    type: 'order' | 'streak' | 'tier' | 'badge' | 'karma';
    action: string;
    data: Record<string, any>;
  }): Promise<boolean> {
    try {
      const eventData = {
        category: 'LOYALTY',
        type: signal.type.toUpperCase(),
        userId: signal.userId,
        timestamp: new Date().toISOString(),
        source: 'profile-aggregator',
        data: {
          action: signal.action,
          ...signal.data,
        },
      };

      await axios.post(`${REZ_MIND_URL}/api/signals`, eventData, {
        timeout: 2000,
      });

      return true;
    } catch (error) {
      console.error('Failed to publish loyalty signal:', error);
      return false;
    }
  }

  /**
   * Get personalized recommendations for user
   */
  async getPersonalizedOffers(userId: string): Promise<any[]> {
    try {
      const response = await axios.post(
        `${REZ_MIND_URL}/api/recommendations/personalized`,
        {
          userId,
          context: 'loyalty',
          limit: 5,
        },
        { timeout: 3000 }
      );

      return response.data.offers || [];
    } catch (error) {
      console.error('Failed to get personalized offers:', error);
      return [];
    }
  }

  /**
   * Get churn intervention strategy
   */
  async getChurnIntervention(userId: string): Promise<{
    strategy: 'aggressive' | 'moderate' | 'minimal';
    offers: string[];
    message: string;
  } | null> {
    try {
      const analytics = await this.getUserAnalytics(userId);
      if (!analytics) return null;

      // Determine intervention strategy based on risk
      const churnRisk = analytics.risk.churnRisk;

      if (churnRisk > 70) {
        return {
          strategy: 'aggressive',
          offers: [
            '20% discount on next booking',
            'Free upgrade',
            'Extended loyalty points multiplier',
          ],
          message: 'We miss you! Here\'s an exclusive offer to welcome you back.',
        };
      } else if (churnRisk > 40) {
        return {
          strategy: 'moderate',
          offers: [
            '10% discount on next booking',
            'Bonus loyalty points',
          ],
          message: 'We noticed you haven\'t visited recently. Here\'s something special!',
        };
      } else {
        return {
          strategy: 'minimal',
          offers: [
            'Double points this week',
          ],
          message: 'Thank you for being a loyal customer! Enjoy this reward.',
        };
      }
    } catch (error) {
      console.error('Failed to get churn intervention:', error);
      return null;
    }
  }

  /**
   * Get merchant intelligence
   */
  async getMerchantIntelligence(merchantId: string): Promise<{
    totalCustomers: number;
    atRiskCustomers: number;
    highValueCustomers: number;
    avgSatisfaction: number;
    recommendedActions: string[];
  } | null> {
    try {
      const response = await axios.get(
        `${REZ_MIND_URL}/api/analytics/merchant/${merchantId}`,
        { timeout: 3000 }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to get merchant intelligence:', error);
      return null;
    }
  }

  /**
   * Calculate price range from booking value
   */
  private getPriceRange(avgValue: number): 'budget' | 'mid' | 'premium' | 'luxury' {
    if (avgValue < 2000) return 'budget';
    if (avgValue < 5000) return 'mid';
    if (avgValue < 15000) return 'premium';
    return 'luxury';
  }

  /**
   * Invalidate cache for user
   */
  async invalidateCache(userId: string): Promise<void> {
    const cacheKey = `${REZ_MIND_CACHE_PREFIX}analytics:${userId}`;
    await redis.del(cacheKey);
  }
}

// Singleton instance
export const rezMindIntegration = new RezMindIntegration();
