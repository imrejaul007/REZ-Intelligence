import { Logger } from 'pino';
import { v4 as uuidv4 } from 'uuid';

export interface RecommendationRequest {
  userId: string;
  sessionId: string;
  context: RecommendationContext;
  strategy?: RecommendationStrategy;
  limit?: number;
}

export interface RecommendationContext {
  currentPage: string;
  category?: string;
  viewedItems?: string[];
  cartItems?: CartItem[];
  searchQuery?: string;
  filters?: Record<string, unknown>;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek?: 'weekday' | 'weekend';
  deviceType?: 'mobile' | 'desktop' | 'tablet';
}

export interface CartItem {
  itemId: string;
  category: string;
  price: number;
  quantity: number;
}

export type RecommendationStrategy =
  | 'personalized'
  | 'trending'
  | 'similar'
  | 'frequently_bought_together'
  | 'new_arrivals'
  | 'cross_sell'
  | 'upsell'
  | 'contextual';

export interface Recommendation {
  itemId: string;
  score: number;
  reason: string;
  category: string;
  price: number;
  title: string;
  imageUrl?: string;
  metadata: Record<string, unknown>;
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  strategy: RecommendationStrategy;
  userId: string;
  sessionId: string;
  contextSummary: string;
  nextBestAction?: NextBestAction;
  processingTimeMs: number;
}

export interface NextBestAction {
  type: 'view' | 'add_to_cart' | 'purchase' | 'upsell' | 'cross_sell';
  itemId: string;
  expectedLift: number;
  reasoning: string;
}

export interface RecommendationStrategyConfig {
  name: RecommendationStrategy;
  weight: number;
  fallbackStrategy?: RecommendationStrategy;
  minItems: number;
  maxItems: number;
}

const DEFAULT_STRATEGY_CONFIG: Record<RecommendationStrategy, RecommendationStrategyConfig> = {
  personalized: {
    name: 'personalized',
    weight: 0.4,
    fallbackStrategy: 'trending',
    minItems: 5,
    maxItems: 20,
  },
  trending: {
    name: 'trending',
    weight: 0.2,
    fallbackStrategy: 'new_arrivals',
    minItems: 3,
    maxItems: 15,
  },
  similar: {
    name: 'similar',
    weight: 0.15,
    fallbackStrategy: 'personalized',
    minItems: 4,
    maxItems: 12,
  },
  frequently_bought_together: {
    name: 'frequently_bought_together',
    weight: 0.1,
    fallbackStrategy: 'cross_sell',
    minItems: 2,
    maxItems: 8,
  },
  new_arrivals: {
    name: 'new_arrivals',
    weight: 0.05,
    fallbackStrategy: 'trending',
    minItems: 3,
    maxItems: 10,
  },
  cross_sell: {
    name: 'cross_sell',
    weight: 0.05,
    fallbackStrategy: 'upsell',
    minItems: 2,
    maxItems: 6,
  },
  upsell: {
    name: 'upsell',
    weight: 0.03,
    fallbackStrategy: 'personalized',
    minItems: 1,
    maxItems: 4,
  },
  contextual: {
    name: 'contextual',
    weight: 0.02,
    fallbackStrategy: 'personalized',
    minItems: 3,
    maxItems: 10,
  },
};

export class RecommendationRouter {
  private logger: Logger;
  private strategyConfigs: Map<RecommendationStrategy, RecommendationStrategyConfig>;

  constructor(logger: Logger) {
    this.logger = logger;
    this.strategyConfigs = new Map<RecommendationStrategy, RecommendationStrategyConfig>(
      Object.entries(DEFAULT_STRATEGY_CONFIG) as [RecommendationStrategy, RecommendationStrategyConfig][]
    );
  }

  async getRecommendations(request: RecommendationRequest): Promise<RecommendationResult> {
    const startTime = Date.now();
    const resultId = uuidv4();

    try {
      // Validate request
      if (!request.userId || !request.context) {
        throw new Error('Missing required fields: userId, context');
      }

      // Determine best strategy based on context
      const strategy = request.strategy || this.selectBestStrategy(request.context);
      const config = this.strategyConfigs.get(strategy) || DEFAULT_STRATEGY_CONFIG.personalized;
      const limit = request.limit || config.maxItems;

      this.logger.info({
        resultId,
        userId: request.userId,
        strategy,
        limit,
        context: request.context.currentPage,
      }, 'Generating recommendations');

      // Fetch user preferences and history
      const userPreferences = await this.fetchUserPreferences(request.userId);
      const userHistory = await this.fetchUserHistory(request.userId);

      // Generate recommendations based on strategy
      let recommendations = await this.generateByStrategy(strategy, {
        ...request.context,
        userPreferences,
        userHistory,
      }, limit);

      // If not enough results, try fallback strategy
      if (recommendations.length < config.minItems && config.fallbackStrategy) {
        this.logger.info({
          resultId,
          originalStrategy: strategy,
          fallbackStrategy: config.fallbackStrategy,
        }, 'Falling back to alternative strategy');

        const fallbackRecs = await this.generateByStrategy(config.fallbackStrategy, {
          ...request.context,
          userPreferences,
          userHistory,
        }, limit);

        recommendations = this.mergeRecommendations(recommendations, fallbackRecs);
      }

      // Score and rank recommendations
      recommendations = this.scoreAndRank(recommendations, request.context, userPreferences);

      // Truncate to limit
      recommendations = recommendations.slice(0, limit);

      // Generate next best action
      const nextBestAction = this.generateNextBestAction(recommendations, request.context);

      const result: RecommendationResult = {
        recommendations,
        strategy,
        userId: request.userId,
        sessionId: request.sessionId,
        contextSummary: this.summarizeContext(request.context),
        nextBestAction,
        processingTimeMs: Date.now() - startTime,
      };

      this.logger.info({
        resultId,
        userId: request.userId,
        recommendationCount: recommendations.length,
        strategy,
        processingTimeMs: result.processingTimeMs,
      }, 'Recommendations generated');

      return result;

    } catch (error) {
      const err = error as Error;
      this.logger.error({ resultId, error: err.message }, 'Recommendation generation failed');
      throw error;
    }
  }

  private selectBestStrategy(context: RecommendationContext): RecommendationStrategy {
    // Strategy selection logic based on context

    if (context.cartItems && context.cartItems.length > 0) {
      return 'frequently_bought_together';
    }

    if (context.searchQuery) {
      return 'similar';
    }

    if (context.currentPage === 'home') {
      return 'personalized';
    }

    if (context.currentPage === 'product') {
      return 'similar';
    }

    if (context.currentPage === 'category') {
      return context.category ? 'similar' : 'trending';
    }

    return 'personalized';
  }

  private async generateByStrategy(
    strategy: RecommendationStrategy,
    context: RecommendationContext & { userPreferences?: { avgOrderValue?: number }; userHistory?: unknown },
    limit: number
  ): Promise<Recommendation[]> {
    switch (strategy) {
      case 'personalized':
        return this.generatePersonalized(context, limit);
      case 'trending':
        return this.generateTrending(context, limit);
      case 'similar':
        return this.generateSimilar(context, limit);
      case 'frequently_bought_together':
        return this.generateFrequentlyBoughtTogether(context, limit);
      case 'new_arrivals':
        return this.generateNewArrivals(context, limit);
      case 'cross_sell':
        return this.generateCrossSell(context, limit);
      case 'upsell':
        return this.generateUpsell(context, limit);
      case 'contextual':
        return this.generateContextual(context, limit);
      default:
        return this.generatePersonalized(context, limit);
    }
  }

  private async generatePersonalized(context: RecommendationContext & { userPreferences?: { avgOrderValue?: number }; userHistory?: unknown }, limit: number): Promise<Recommendation[]> {
    // In production, this would call ML model / recommendation service
    const userPreferences = context.userPreferences || {};

    return [
      {
        itemId: `PERS-1-${Date.now()}`,
        score: 0.95,
        reason: 'Based on your browsing history',
        category: 'electronics',
        price: 299.99,
        title: 'Premium Wireless Headphones',
        metadata: { relevance: 0.95, personalizationFactors: ['history', 'preferences'] },
      },
      {
        itemId: `PERS-2-${Date.now()}`,
        score: 0.88,
        reason: 'Matches your style preferences',
        category: 'electronics',
        price: 149.99,
        title: 'Smart Watch Pro',
        metadata: { relevance: 0.88, personalizationFactors: ['preferences'] },
      },
      {
        itemId: `PERS-3-${Date.now()}`,
        score: 0.82,
        reason: 'Popular among users like you',
        category: 'accessories',
        price: 79.99,
        title: 'Wireless Earbuds',
        metadata: { relevance: 0.82, personalizationFactors: ['collaborative'] },
      },
    ].slice(0, limit);
  }

  private async generateTrending(context: RecommendationContext & { userPreferences?: { avgOrderValue?: number }; userHistory?: unknown }, limit: number): Promise<Recommendation[]> {
    return [
      {
        itemId: `TREND-1-${Date.now()}`,
        score: 0.92,
        reason: 'Trending in your area',
        category: 'trending',
        price: 199.99,
        title: 'Trending Product A',
        metadata: { trendScore: 0.92, velocity: 'high' },
      },
      {
        itemId: `TREND-2-${Date.now()}`,
        score: 0.87,
        reason: 'Most viewed this week',
        category: 'trending',
        price: 89.99,
        title: 'Trending Product B',
        metadata: { trendScore: 0.87, views: 15000 },
      },
    ].slice(0, limit);
  }

  private async generateSimilar(context: RecommendationContext & { userPreferences?: { avgOrderValue?: number }; userHistory?: unknown }, limit: number): Promise<Recommendation[]> {
    const viewedItems = context.viewedItems || [];
    return [
      {
        itemId: `SIM-1-${Date.now()}`,
        score: 0.91,
        reason: 'Similar to items you viewed',
        category: context.category || 'general',
        price: 129.99,
        title: 'Similar Product 1',
        metadata: { similarity: 0.91, baseItems: viewedItems.slice(0, 2) },
      },
    ].slice(0, limit);
  }

  private async generateFrequentlyBoughtTogether(context: RecommendationContext & { userPreferences?: { avgOrderValue?: number }; userHistory?: unknown }, limit: number): Promise<Recommendation[]> {
    const cartItems = context.cartItems || [];
    return cartItems.flatMap(cartItem => [
      {
        itemId: `FBT-${cartItem.itemId}-1`,
        score: 0.89,
        reason: 'Frequently bought with ' + cartItem.itemId,
        category: cartItem.category,
        price: 49.99,
        title: 'Complementary Item for ' + cartItem.itemId,
        metadata: { associatedItems: [cartItem.itemId], lift: 3.2 },
      },
    ]).slice(0, limit);
  }

  private async generateNewArrivals(context: RecommendationContext & { userPreferences?: { avgOrderValue?: number }; userHistory?: unknown }, limit: number): Promise<Recommendation[]> {
    return [
      {
        itemId: `NEW-1-${Date.now()}`,
        score: 0.78,
        reason: 'New arrival in your favorite category',
        category: context.category || 'general',
        price: 159.99,
        title: 'New Arrival Product',
        metadata: { daysSinceLaunch: 3, novelty: 0.9 },
      },
    ].slice(0, limit);
  }

  private async generateCrossSell(context: RecommendationContext & { userPreferences?: { avgOrderValue?: number }; userHistory?: unknown }, limit: number): Promise<Recommendation[]> {
    const cartItems = context.cartItems || [];
    return cartItems.map(cartItem => ({
      itemId: `CROSS-${cartItem.itemId}`,
      score: 0.75,
      reason: 'Goes well with your selection',
      category: this.getComplementaryCategory(cartItem.category),
      price: cartItem.price * 0.3,
      title: 'Accessory for ' + cartItem.itemId,
      metadata: { crossSellLift: 1.8 },
    })).slice(0, limit);
  }

  private async generateUpsell(context: RecommendationContext & { userPreferences?: { avgOrderValue?: number }; userHistory?: unknown }, limit: number): Promise<Recommendation[]> {
    const cartItems = context.cartItems || [];
    return cartItems.map(cartItem => ({
      itemId: `UPSELL-${cartItem.itemId}`,
      score: 0.72,
      reason: 'Premium version available',
      category: cartItem.category,
      price: cartItem.price * 2,
      title: 'Premium ' + cartItem.itemId,
      metadata: { upgradePotential: 0.85, priceIncrease: '2x' },
    })).slice(0, limit);
  }

  private async generateContextual(context: RecommendationContext & { userPreferences?: { avgOrderValue?: number }; userHistory?: unknown }, limit: number): Promise<Recommendation[]> {
    const timeOfDay = context.timeOfDay || 'afternoon';
    const dayOfWeek = context.dayOfWeek || 'weekday';

    return [
      {
        itemId: `CONTEXT-1-${Date.now()}`,
        score: 0.85,
        reason: `Perfect for your ${timeOfDay}`,
        category: 'contextual',
        price: 99.99,
        title: 'Time-Based Recommendation',
        metadata: { contextFactors: { timeOfDay, dayOfWeek } },
      },
    ].slice(0, limit);
  }

  private mergeRecommendations(primary: Recommendation[], secondary: Recommendation[]): Recommendation[] {
    const seen = new Set(primary.map(r => r.itemId));
    const merged = [...primary];

    for (const rec of secondary) {
      if (!seen.has(rec.itemId)) {
        merged.push({ ...rec, score: rec.score * 0.8 }); // Penalize fallback
        seen.add(rec.itemId);
      }
    }

    return merged;
  }

  private scoreAndRank(
    recommendations: Recommendation[],
    context: RecommendationContext,
    userPreferences: { avgOrderValue?: number } | null | undefined
  ): Recommendation[] {
    // Apply contextual boosting
    const boosted = recommendations.map(rec => {
      let finalScore = rec.score;

      // Device type boost
      if (context.deviceType === 'mobile' && rec.metadata.mobileFriendly) {
        finalScore *= 1.1;
      }

      // Time-based boost
      if (context.timeOfDay === 'evening' && rec.category === 'entertainment') {
        finalScore *= 1.15;
      }

      // Price range alignment
      const avgOrderValue = userPreferences?.avgOrderValue;
      if (avgOrderValue && avgOrderValue > 0) {
        const priceRatio = rec.price / avgOrderValue;
        if (priceRatio < 1.5) finalScore *= 1.1; // Boost if within budget
      }

      return { ...rec, score: Math.min(1, finalScore) };
    });

    // Sort by score descending
    return boosted.sort((a, b) => b.score - a.score);
  }

  private generateNextBestAction(
    recommendations: Recommendation[],
    context: RecommendationContext
  ): NextBestAction | undefined {
    if (recommendations.length === 0) return undefined;

    const topRec = recommendations[0];

    let actionType: NextBestAction['type'] = 'view';
    if (context.currentPage === 'product' && topRec.score > 0.8) {
      actionType = 'add_to_cart';
    } else if (context.cartItems && context.cartItems.length > 0) {
      actionType = 'cross_sell';
    }

    return {
      type: actionType,
      itemId: topRec.itemId,
      expectedLift: topRec.score * 0.15,
      reasoning: `Recommended due to ${topRec.reason}`,
    };
  }

  private summarizeContext(context: RecommendationContext): string {
    const parts: string[] = [];

    if (context.currentPage) parts.push(`Page: ${context.currentPage}`);
    if (context.category) parts.push(`Category: ${context.category}`);
    if (context.cartItems?.length) parts.push(`Cart items: ${context.cartItems.length}`);
    if (context.timeOfDay) parts.push(`Time: ${context.timeOfDay}`);
    if (context.deviceType) parts.push(`Device: ${context.deviceType}`);

    return parts.join(', ');
  }

  private async fetchUserPreferences(userId: string): Promise<{ preferredCategories?: string[]; avgOrderValue?: number; brandPreferences?: string[] }> {
    // Would fetch from User Service / Preference Service
    return {
      preferredCategories: ['electronics', 'accessories'],
      avgOrderValue: 150,
      brandPreferences: ['BrandA', 'BrandB'],
    };
  }

  private async fetchUserHistory(userId: string): Promise<unknown> {
    // Would fetch from User Service / Analytics
    return {
      recentViews: [],
      recentPurchases: [],
      searchHistory: [],
    };
  }

  private getComplementaryCategory(category: string): string {
    const mapping: Record<string, string> = {
      electronics: 'accessories',
      clothing: 'accessories',
      home: 'decor',
      beauty: 'personal care',
    };
    return mapping[category] || 'accessories';
  }

  // Register custom strategy
  registerStrategy(strategy: RecommendationStrategy, config: RecommendationStrategyConfig): void {
    this.strategyConfigs.set(strategy, config);
    this.logger.info({ strategy, config }, 'Registered custom recommendation strategy');
  }
}
