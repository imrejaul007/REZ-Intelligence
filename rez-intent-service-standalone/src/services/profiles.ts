import { UserProfile, IUserProfile } from '../models/intent';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface UserScores {
  engagementScore: number;
  valueSegment: 'HIGH' | 'MEDIUM' | 'LOW';
  churnRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  upsellOpportunity: boolean;
  healthScore: number;
  nps: number;
  predictedLTV: number;
}

interface Recommendation {
  type: 'cuisine' | 'restaurant' | 'item' | 'promotion';
  category: string;
  score: number;
  reason: string;
}

// ============================================
// USER PROFILE SERVICE
// ============================================

export class ProfileService {
  /**
   * Get or create user profile
   */
  async getProfile(userId: string): Promise<IUserProfile | null> {
    // Check cache first
    const cached = await redis.get(`profile:${userId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const profile = await UserProfile.findOne({ userId });

    if (profile) {
      await redis.setex(`profile:${userId}`, 300, JSON.stringify(profile));
      return profile;
    }

    return null;
  }

  /**
   * Get segments for user
   */
  async getSegments(userId: string): Promise<string[]> {
    const profile = await this.getProfile(userId);
    return profile?.segments || [];
  }

  /**
   * Calculate user scores
   */
  async calculateScores(userId: string): Promise<UserScores> {
    // Engagement score (0-100)
    const sessions = parseInt(await redis.get(`sessions:${userId}`) || '0');
    const engagementScore = Math.min(100, sessions * 10);

    // Value segment
    const totalSpent = parseFloat(await redis.get(`ltv:${userId}`) || '0');
    const valueSegment: 'HIGH' | 'MEDIUM' | 'LOW' =
      totalSpent > 10000 ? 'HIGH' :
      totalSpent > 1000 ? 'MEDIUM' : 'LOW';

    // Churn risk
    const lastOrder = await redis.get(`lastOrder:${userId}`);
    const daysSince = lastOrder
      ? Math.floor((Date.now() - parseInt(lastOrder)) / 86400000)
      : 999;
    const churnRisk: 'LOW' | 'MEDIUM' | 'HIGH' =
      daysSince > 30 ? 'HIGH' :
      daysSince > 7 ? 'MEDIUM' : 'LOW';

    // Upsell opportunity
    const upsellOpportunity = valueSegment === 'HIGH' && churnRisk === 'LOW';

    // Health score (weighted average)
    const healthScore = Math.round(
      (engagementScore * 0.4 + (valueSegment === 'HIGH' ? 100 : valueSegment === 'MEDIUM' ? 70 : 40) * 0.3 + (churnRisk === 'LOW' ? 100 : churnRisk === 'MEDIUM' ? 70 : 40) * 0.3)
    );

    // NPS from ratings
    const promoters = parseInt(await redis.get(`nps:promoters:${userId}`) || '0');
    const detractors = parseInt(await redis.get(`nps:detractors:${userId}` || '0');
    const total = promoters + detractors || 1;
    const nps = Math.round(((promoters - detractors) / total) * 100);

    // Predicted LTV
    const avgOrderValue = totalSpent / (parseInt(await redis.get(`orders:${userId}`) || '1'));
    const predictedLTV = avgOrderValue * 12; // 12 months

    return {
      engagementScore,
      valueSegment,
      churnRisk,
      upsellOpportunity,
      healthScore,
      nps,
      predictedLTV
    };
  }

  /**
   * Get recommendations for user
   */
  async getRecommendations(userId: string, limit = 10): Promise<Recommendation[]> {
    const profile = await this.getProfile(userId);
    const recommendations: Recommendation[] = [];

    if (!profile) {
      return recommendations;
    }

    // Cuisine recommendations based on preferences
    for (const cat of profile.categories || []) {
      recommendations.push({
        type: 'cuisine',
        category: cat.category,
        score: cat.affinityScore,
        reason: `You enjoy ${cat.category} frequently`
      });
    }

    // Sort by score and limit
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get lifetime value
   */
  async getLifetimeValue(userId: string): Promise<{
    totalSpent: number;
    orderCount: number;
    avgOrderValue: number;
    predictedLTV: number;
    lastOrder: string | null;
  }> {
    const totalSpent = parseFloat(await redis.get(`ltv:${userId}`) || '0');
    const orderCount = parseInt(await redis.get(`orders:${userId}` || '0');
    const lastOrder = await redis.get(`lastOrder:${userId}`);

    return {
      totalSpent,
      orderCount,
      avgOrderValue: totalSpent / (orderCount || 1),
      predictedLTV: totalSpent * 12,
      lastOrder
    };
  }

  /**
   * Get churn risk with factors
   */
  async getChurnRisk(userId: string): Promise<{
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
    factors: string[];
  }> {
    const factors: string[] = [];
    let risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    const lastOrder = await redis.get(`lastOrder:${userId}`);
    if (lastOrder) {
      const daysSince = Math.floor((Date.now() - parseInt(lastOrder)) / 86400000);
      if (daysSince > 30) {
        risk = 'HIGH';
        factors.push(`${daysSince} days since last order`);
      } else if (daysSince > 7) {
        risk = 'MEDIUM';
        factors.push(`${daysSince} days since last order`);
      }
    }

    const sessions = parseInt(await redis.get(`sessions:${userId}` || '0');
    if (sessions < 3) {
      risk = 'HIGH';
      factors.push('Low session count');
    }

    return { risk, factors };
  }
}

export const profileService = new ProfileService();
