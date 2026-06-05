/**
 * Recommendation Engine
 *
 * Hybrid recommendation system combining:
 * - Collaborative filtering (user-user similarity)
 * - Content-based filtering (item attributes)
 * - Popularity-based recommendations
 * - Real-time personalization
 */

import { EventEmitter } from 'events';

export interface Recommendation {
  itemId: string;
  score: number;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface RecommendedItem {
  itemId: string;
  name: string;
  category: string;
  price?: number;
  imageUrl?: string;
  score: number;
}

export interface RecommendationContext {
  userId?: string;
  sessionId: string;
  currentItem?: string;
  category?: string;
  filters?: Record<string, unknown>;
}

export interface UserProfile {
  userId: string;
  preferences: UserPreferences;
  history: UserHistoryItem[];
  segments: string[];
}

export interface UserPreferences {
  categories: string[];
  priceRange: { min: number; max: number };
  brands: string[];
}

export interface UserHistoryItem {
  itemId: string;
  timestamp: string;
  interactionType: 'view' | 'purchase' | 'cart' | 'wishlist';
  value?: number;
}

export interface PopularItem {
  itemId: string;
  name: string;
  category: string;
  popularityScore: number;
}

export interface RecommendationConfig {
  maxResults: number;
  includePopular: boolean;
  personalizationLevel: 'none' | 'low' | 'medium' | 'high';
  collaborativeWeight?: number;
  contentWeight?: number;
  popularityWeight?: number;
}

export interface RecommendationResult {
  success: boolean;
  recommendation?: Recommendation[];
  error?: string;
}

export class RecommendationEngine extends EventEmitter {
  private config: RecommendationConfig;
  private itemCatalog: Map<string, any> = new Map();
  private userProfiles: Map<string, UserProfile> = new Map();
  private itemPopularity: Map<string, number> = new Map();
  private itemSimilarity: Map<string, Set<string>> = new Map();

  constructor(config?: Partial<RecommendationConfig>) {
    super();
    this.config = {
      maxResults: config?.maxResults || 10,
      includePopular: config?.includePopular ?? true,
      personalizationLevel: config?.personalizationLevel || 'medium',
      collaborativeWeight: config?.collaborativeWeight ?? 0.4,
      contentWeight: config?.contentWeight ?? 0.3,
      popularityWeight: config?.popularityWeight ?? 0.3,
    };
  }

  /**
   * Get recommendations for a user
   */
  async recommend(userId: string, context: RecommendationContext): Promise<RecommendationResult> {
    try {
      const recommendations: Recommendation[] = [];

      // Get user profile for personalization
      const profile = this.userProfiles.get(userId);

      // 1. Collaborative filtering - similar users also liked
      if (profile && this.config.personalizationLevel !== 'none') {
        const collaborativeRecs = await this.getCollaborativeRecommendations(profile);
        recommendations.push(...collaborativeRecs);
      }

      // 2. Content-based - similar to items user interacted with
      if (profile && context.currentItem) {
        const contentRecs = await this.getContentRecommendations(context.currentItem, profile);
        recommendations.push(...contentRecs);
      }

      // 3. Popularity-based - trending items
      if (this.config.includePopular) {
        const popularRecs = await this.getPopularRecommendations(context);
        recommendations.push(...popularRecs);
      }

      // 4. Category-based - user preferences
      if (profile && profile.preferences.categories.length > 0) {
        const categoryRecs = this.getCategoryRecommendations(profile, context);
        recommendations.push(...categoryRecs);
      }

      // Deduplicate and score
      const scored = this.scoreAndDeduplicate(recommendations, profile);

      this.emit('recommendationGenerated', scored);

      return {
        success: true,
        recommendation: scored.slice(0, this.config.maxResults),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get personalized recommendations for a user
   */
  async getPersonalized(userId: string, limit: number = 10): Promise<RecommendedItem[]> {
    const profile = this.userProfiles.get(userId);
    if (!profile) {
      return this.getDefaultRecommendations(limit);
    }

    const recommendations: Recommendation[] = [];

    // Score items based on user preferences
    for (const [itemId, item] of this.itemCatalog) {
      // Skip already purchased/viewed
      const alreadyInteracted = profile.history.some(h => h.itemId === itemId);
      if (alreadyInteracted && this.config.personalizationLevel === 'high') continue;

      let score = 0;

      // Category match
      if (profile.preferences.categories.includes(item.category)) {
        score += 0.4;
      }

      // Price range match
      const price = item.price || 0;
      if (price >= profile.preferences.priceRange.min && price <= profile.preferences.priceRange.max) {
        score += 0.3;
      }

      // Popularity boost
      const popularity = this.itemPopularity.get(itemId) || 0;
      score += Math.min(0.3, popularity * 0.01);

      recommendations.push({
        itemId,
        score,
        reason: this.generateReason(profile, item),
        metadata: item,
      });
    }

    // Sort by score
    recommendations.sort((a, b) => b.score - a.score);

    return recommendations.slice(0, limit).map(r => ({
      itemId: r.itemId,
      name: typeof r.metadata?.name === 'string' ? r.metadata.name : r.itemId,
      category: typeof r.metadata?.category === 'string' ? r.metadata.category : 'unknown',
      price: typeof r.metadata?.price === 'number' ? r.metadata.price : undefined,
      score: r.score,
    }));
  }

  /**
   * Get similar items
   */
  async getSimilarItems(itemId: string, limit: number = 5): Promise<RecommendedItem[]> {
    const similarIds = this.itemSimilarity.get(itemId) || new Set();
    const results: RecommendedItem[] = [];

    for (const similarId of similarIds) {
      const item = this.itemCatalog.get(similarId);
      if (item) {
        results.push({
          itemId: similarId,
          name: item.name,
          category: item.category,
          price: item.price,
          imageUrl: item.imageUrl,
          score: 1,
        });
      }
    }

    return results.slice(0, limit);
  }

  /**
   * Record user interaction
   */
  async recordInteraction(userId: string, itemId: string, type: 'view' | 'purchase' | 'cart' | 'wishlist'): Promise<void> {
    let profile = this.userProfiles.get(userId);
    if (!profile) {
      profile = {
        userId,
        preferences: { categories: [], priceRange: { min: 0, max: 10000 }, brands: [] },
        history: [],
        segments: [],
      };
      this.userProfiles.set(userId, profile);
    }

    // Add to history
    profile.history.push({
      itemId,
      timestamp: new Date().toISOString(),
      interactionType: type,
      value: type === 'purchase' ? 1 : 0.1,
    });

    // Keep last 100 interactions
    if (profile.history.length > 100) {
      profile.history = profile.history.slice(-100);
    }

    // Update popularity
    const current = this.itemPopularity.get(itemId) || 0;
    const weight = type === 'purchase' ? 3 : type === 'cart' ? 2 : 1;
    this.itemPopularity.set(itemId, current + weight);

    // Update category preferences
    const item = this.itemCatalog.get(itemId);
    if (item && !profile.preferences.categories.includes(item.category)) {
      // Add category if user has 2+ interactions in it
      const catCount = profile.history.filter(h => {
        const i = this.itemCatalog.get(h.itemId);
        return i?.category === item.category;
      }).length;
      if (catCount >= 2) {
        profile.preferences.categories.push(item.category);
      }
    }
  }

  /**
   * Add item to catalog
   */
  addItem(item: { itemId: string; name: string; category: string; price?: number; imageUrl?: string; attributes?: Record<string, any> }): void {
    this.itemCatalog.set(item.itemId, item);

    // Build similarity index
    for (const [existingId, existing] of this.itemCatalog) {
      if (existingId === item.itemId) continue;

      const similarity = this.calculateItemSimilarity(item, existing);
      if (similarity > 0.3) {
        // Add to similarity index
        if (!this.itemSimilarity.has(item.itemId)) {
          this.itemSimilarity.set(item.itemId, new Set());
        }
        if (!this.itemSimilarity.has(existingId)) {
          this.itemSimilarity.set(existingId, new Set());
        }
        this.itemSimilarity.get(item.itemId)!.add(existingId);
        this.itemSimilarity.get(existingId)!.add(item.itemId);
      }
    }
  }

  private calculateItemSimilarity(a: any, b: any): number {
    let score = 0;

    // Category match
    if (a.category === b.category) score += 0.5;

    // Price range overlap
    const aPrice = a.price || 0;
    const bPrice = b.price || 0;
    const priceDiff = Math.abs(aPrice - bPrice);
    if (priceDiff < 100) score += 0.3;
    else if (priceDiff < 500) score += 0.1;

    // Attribute similarity
    if (a.attributes && b.attributes) {
      const sharedKeys = Object.keys(a.attributes).filter(k => b.attributes[k] === a.attributes[k]);
      score += sharedKeys.length * 0.1;
    }

    return Math.min(1, score);
  }

  private async getCollaborativeRecommendations(profile: UserProfile): Promise<Recommendation[]> {
    // Find items that similar users interacted with
    const recommendations: Recommendation[] = [];
    const interactedItems = new Set(profile.history.map(h => h.itemId));

    // Simplified collaborative filtering - recommend popular items from user segments
    for (const segment of profile.segments) {
      for (const [itemId, popularity] of this.itemPopularity) {
        if (!interactedItems.has(itemId)) {
          const item = this.itemCatalog.get(itemId);
          if (item) {
            recommendations.push({
              itemId,
              score: popularity * 0.5,
              reason: `Popular in your segment: ${segment}`,
              metadata: item,
            });
          }
        }
      }
    }

    return recommendations;
  }

  private async getContentRecommendations(currentItemId: string, profile: UserProfile): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const similarItems = this.itemSimilarity.get(currentItemId) || new Set();

    for (const itemId of similarItems) {
      const item = this.itemCatalog.get(itemId);
      if (item) {
        recommendations.push({
          itemId,
          score: 0.8,
          reason: `Similar to items you viewed`,
          metadata: item,
        });
      }
    }

    return recommendations;
  }

  private async getPopularRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Sort by popularity
    const sorted = [...this.itemPopularity.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [itemId, score] of sorted) {
      const item = this.itemCatalog.get(itemId);
      if (item) {
        recommendations.push({
          itemId,
          score: score * 0.3,
          reason: 'Trending now',
          metadata: item,
        });
      }
    }

    return recommendations;
  }

  private getCategoryRecommendations(profile: UserProfile, context: RecommendationContext): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const category of profile.preferences.categories) {
      for (const [itemId, item] of this.itemCatalog) {
        if (item.category === category) {
          recommendations.push({
            itemId,
            score: 0.6,
            reason: `Matches your ${category} preference`,
            metadata: item,
          });
        }
      }
    }

    return recommendations;
  }

  private scoreAndDeduplicate(recommendations: Recommendation[], profile?: UserProfile): Recommendation[] {
    const seen = new Map<string, Recommendation>();

    for (const rec of recommendations) {
      const existing = seen.get(rec.itemId);
      if (!existing || rec.score > existing.score) {
        seen.set(rec.itemId, rec);
      }
    }

    // Sort by score
    return [...seen.values()].sort((a, b) => b.score - a.score);
  }

  private generateReason(profile: UserProfile, item: any): string {
    if (profile.preferences.categories.includes(item.category)) {
      return `Matches your interest in ${item.category}`;
    }
    if (item.price && item.price <= profile.preferences.priceRange.max) {
      return 'Within your budget';
    }
    return 'Popular choice';
  }

  private getDefaultRecommendations(limit: number): RecommendedItem[] {
    const items: RecommendedItem[] = [];
    const sorted = [...this.itemPopularity.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    for (const [itemId] of sorted) {
      const item = this.itemCatalog.get(itemId);
      if (item) {
        items.push({
          itemId,
          name: item.name,
          category: item.category,
          price: item.price,
          imageUrl: item.imageUrl,
          score: 1,
        });
      }
    }

    return items;
  }
}
