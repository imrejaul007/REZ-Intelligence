/**
 * REZ Cross-Sell Engine
 *
 * Identifies cross-selling opportunities based on:
 * - User behavior patterns
 * - Merchant category relationships
 * - Location proximity
 * - Social connections
 * - Purchase history
 *
 * Example:
 * Gym users → Protein shops → Wellness clinics → Healthy cafes
 */

import axios from 'axios';

// ============================================================================
// Configuration
// ============================================================================

const GRAPH_SERVICE_URL = process.env.GRAPH_SERVICE_URL || 'http://localhost:4129';
const PROFILE_SERVICE_URL = process.env.PROFILE_SERVICE_URL || 'http://localhost:4013';

// ============================================================================
// Types
// ============================================================================

interface MerchantLocation {
  lat: number;
  lng: number;
  radius?: number;
}

interface MerchantQuery {
  category: string;
  lat?: number;
  lng?: number;
  radius?: number;
}

interface HistoryItem {
  category?: string;
  merchantCategory?: string;
  score?: number;
  merchantId?: string;
  visits?: number;
}

export interface CrossSellOpportunity {
  userId: string;
  fromMerchantId: string;
  toMerchantId: string;
  reason: string;
  score: number; // 0-1
  categoryMatch: boolean;
  locationMatch: boolean;
  socialMatch: boolean;
  recommendation: {
    title: string;
    description: string;
    offer?: string;
    expiresIn?: number; // hours
  };
}

export interface CategoryGraph {
  category: string;
  relatedCategories: {
    category: string;
    strength: number; // 0-1
    type: 'complementary' | 'similar' | 'sequential';
  }[];
}

export interface CrossSellCampaign {
  campaignId: string;
  type: 'cross_merchant' | 'category_expansion' | 'lifecycle';
  targetSegments: string[];
  fromCategory: string;
  toCategory: string;
  offer: {
    type: 'discount' | 'cashback' | 'combo';
    value: number;
  };
  status: 'active' | 'paused' | 'completed';
}

// ============================================================================
// Category Relationship Graph
// ============================================================================

class CategoryGraphService {
  private relationships: Map<string, CategoryGraph> = new Map();

  constructor() {
    this.initializeRelationships();
  }

  private initializeRelationships(): void {
    // Define category relationships based on lifestyle patterns

    // Fitness ecosystem
    this.addRelationship('fitness_gym', 'protein_shop', 0.9, 'sequential');
    this.addRelationship('fitness_gym', 'sportswear', 0.8, 'complementary');
    this.addRelationship('fitness_gym', 'healthy_cafe', 0.7, 'sequential');
    this.addRelationship('fitness_gym', 'sports_nutrition', 0.85, 'sequential');
    this.addRelationship('protein_shop', 'sports_nutrition', 0.9, 'similar');
    this.addRelationship('protein_shop', 'healthy_cafe', 0.6, 'complementary');

    // Food ecosystem
    this.addRelationship('pizza', 'desserts', 0.8, 'complementary');
    this.addRelationship('pizza', 'beverages', 0.9, 'complementary');
    this.addRelationship('biryani', 'desserts', 0.7, 'complementary');
    this.addRelationship('biryani', 'cold_drink', 0.85, 'complementary');
    this.addRelationship('cafe', 'bakery', 0.8, 'similar');
    this.addRelationship('cafe', 'snacks', 0.9, 'complementary');

    // Beauty ecosystem
    this.addRelationship('salon', 'spa', 0.9, 'sequential');
    this.addRelationship('salon', 'beauty_products', 0.8, 'complementary');
    this.addRelationship('spa', 'yoga', 0.7, 'sequential');
    this.addRelationship('beauty_products', 'wellness', 0.6, 'complementary');

    // Travel ecosystem
    this.addRelationship('hotel', 'restaurant', 0.9, 'sequential');
    this.addRelationship('hotel', 'taxi', 0.85, 'sequential');
    this.addRelationship('restaurant', 'entertainment', 0.7, 'complementary');
    this.addRelationship('travel_agent', 'hotel', 0.9, 'sequential');
    this.addRelationship('travel_agent', 'tour', 0.85, 'sequential');

    // Shopping ecosystem
    this.addRelationship('mall', 'restaurant', 0.9, 'sequential');
    this.addRelationship('mall', 'entertainment', 0.8, 'sequential');
    this.addRelationship('grocery', 'pharmacy', 0.7, 'sequential');
    this.addRelationship('grocery', 'household', 0.8, 'complementary');

    // Professional ecosystem
    this.addRelationship('coworking', 'coffee_shop', 0.9, 'sequential');
    this.addRelationship('coworking', 'restaurant', 0.7, 'sequential');
    this.addRelationship('coworking', 'printing', 0.6, 'complementary');

    // Evening routine
    this.addRelationship('grocery', 'restaurant', 0.6, 'sequential');
    this.addRelationship('grocery', 'convenience', 0.7, 'complementary');
  }

  private addRelationship(
    from: string,
    to: string,
    strength: number,
    type: 'complementary' | 'similar' | 'sequential'
  ): void {
    // Add forward relationship
    if (!this.relationships.has(from)) {
      this.relationships.set(from, { category: from, relatedCategories: [] });
    }
    this.relationships.get(from)!.relatedCategories.push({ category: to, strength, type });

    // Add reverse relationship (slightly weaker)
    if (!this.relationships.has(to)) {
      this.relationships.set(to, { category: to, relatedCategories: [] });
    }
    this.relationships.get(to)!.relatedCategories.push({
      category: from,
      strength: strength * 0.7,
      type
    });
  }

  getRelatedCategories(category: string): CategoryGraph['relatedCategories'] {
    return this.relationships.get(category)?.relatedCategories || [];
  }
}

// ============================================================================
// Cross-Sell Engine
// ============================================================================

class CrossSellEngine {
  private categoryGraph: CategoryGraphService;

  constructor() {
    this.categoryGraph = new CategoryGraphService();
  }

  /**
   * Find cross-sell opportunities for user
   */
  async findOpportunities(userId: string): Promise<CrossSellOpportunity[]> {
    const opportunities: CrossSellOpportunity[] = [];

    // Get user's purchase history
    const userHistory = await this.getUserPurchaseHistory(userId);

    // Get user's category preferences
    const userCategories = this.getTopCategories(userHistory);

    // Get user's location context
    const userLocation = await this.getUserLocation(userId);

    // For each category the user likes, find related opportunities
    for (const category of userCategories) {
      const related = this.categoryGraph.getRelatedCategories(category.name);

      for (const rel of related) {
        const merchants = await this.findMerchants(rel.category, userLocation);

        for (const merchant of merchants) {
          // Skip if user already frequently visits this merchant
          if (this.isAlreadyCustomer(userHistory, merchant.id)) continue;

          const opportunity = this.buildOpportunity(
            userId,
            category,
            rel,
            merchant,
            userLocation
          );

          if (opportunity) {
            opportunities.push(opportunity);
          }
        }
      }
    }

    // Sort by score and return top opportunities
    return opportunities
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  /**
   * Find cross-sell for specific category expansion
   */
  async expandCategory(
    userId: string,
    currentCategory: string
  ): Promise<CrossSellOpportunity[]> {
    const related = this.categoryGraph.getRelatedCategories(currentCategory);
    const opportunities: CrossSellOpportunity[] = [];

    const userLocation = await this.getUserLocation(userId);

    for (const rel of related) {
      const merchants = await this.findMerchants(rel.category, userLocation);

      for (const merchant of merchants) {
        opportunities.push({
          userId,
          fromMerchantId: '',
          toMerchantId: merchant.id,
          reason: `Expands from ${currentCategory}`,
          score: rel.strength * 0.8,
          categoryMatch: true,
          locationMatch: true,
          socialMatch: false,
          recommendation: {
            title: `Try ${merchant.name}`,
            description: `People who like ${currentCategory} also like ${merchant.name}`,
            offer: rel.strength > 0.8 ? '20% off first visit' : undefined
          }
        });
      }
    }

    return opportunities.sort((a, b) => b.score - a.score);
  }

  /**
   * Get category expansion path (e.g., Gym → Protein → Supplements → Health)
   */
  async getExpansionPath(
    userId: string,
    startCategory: string
  ): Promise<string[]> {
    const path = [startCategory];
    const visited = new Set([startCategory]);

    let current = startCategory;
    for (let i = 0; i < 5; i++) { // Max 5 steps
      const related = this.categoryGraph.getRelatedCategories(current);
      const strongest = related
        .filter(r => !visited.has(r.category))
        .sort((a, b) => b.strength - a.strength)[0];

      if (!strongest) break;

      path.push(strongest.category);
      visited.add(strongest.category);
      current = strongest.category;
    }

    return path;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async getUserPurchaseHistory(userId: string): Promise<unknown[]> {
    try {
      const response = await axios.get(
        `${GRAPH_SERVICE_URL}/api/edges/user/${userId}/purchases`,
        { timeout: 3000 }
      );
      return response.data || [];
    } catch (error) {
      return [];
    }
  }

  private async getUserLocation(userId: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const response = await axios.get(
        `${PROFILE_SERVICE_URL}/api/profiles/${userId}/location`,
        { timeout: 2000 }
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }

  private async findMerchants(
    category: string,
    location: MerchantLocation | null
  ): Promise<{ id: string; name: string; rating: number }[]> {
    try {
      const params: MerchantQuery = { category };
      if (location) {
        params.lat = location.lat;
        params.lng = location.lng;
        params.radius = location.radius || 5; // 5km
      }

      const response = await axios.get(
        `${GRAPH_SERVICE_URL}/api/merchants`,
        { params, timeout: 3000 }
      );
      return response.data || [];
    } catch {
      return [];
    }
  }

  private getTopCategories(history: HistoryItem[]): { name: string; score: number }[] {
    const categoryScores: Record<string, number> = {};

    for (const item of history) {
      const cat = item.category || item.merchantCategory;
      if (cat) {
        categoryScores[cat] = (categoryScores[cat] || 0) + (item.score || 1);
      }
    }

    return Object.entries(categoryScores)
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  private isAlreadyCustomer(history: HistoryItem[], merchantId: string): boolean {
    return history.some(h => h.merchantId === merchantId && (h.visits ?? 0) > 3);
  }

  private buildOpportunity(
    userId: string,
    fromCategory: { name: string; score: number },
    toCategory: { category: string; strength: number; type: string },
    merchant: { id: string; name: string },
    location: { lat: number; lng: number } | null
  ): CrossSellOpportunity | null {
    // Calculate score
    const categoryScore = fromCategory.score * toCategory.strength;
    const locationScore = 0.8; // Assume nearby for now
    const socialScore = 0.5; // No social data yet

    const score = (categoryScore * 0.5 + locationScore * 0.3 + socialScore * 0.2);

    // Only recommend if score is above threshold
    if (score < 0.3) return null;

    // Build recommendation
    const titles: Record<string, string> = {
      sequential: `After your ${fromCategory.name} visit`,
      complementary: `While you're into ${fromCategory.name}`,
      similar: `You might also like`
    };

    return {
      userId,
      fromMerchantId: '',
      toMerchantId: merchant.id,
      reason: `${titles[toCategory.type] || 'Recommended for you'}: ${merchant.name}`,
      score,
      categoryMatch: true,
      locationMatch: true,
      socialMatch: false,
      recommendation: {
        title: `Explore ${merchant.name}`,
        description: this.getDescription(fromCategory.name, merchant.name, toCategory.type),
        offer: score > 0.7 ? '15% off first visit' : undefined,
        expiresIn: score > 0.8 ? 24 : 72
      }
    };
  }

  private getDescription(from: string, to: string, type: string): string {
    const descriptions: Record<string, string> = {
      sequential: `Complete your ${from} routine with ${to}`,
      complementary: `Pair your ${from} with ${to}`,
      similar: `People who like ${from} also enjoy ${to}`
    };
    return descriptions[type] || `Discover ${to} near you`;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const crossSellEngine = new CrossSellEngine();
export const categoryGraph = new CategoryGraphService();
export default crossSellEngine;
