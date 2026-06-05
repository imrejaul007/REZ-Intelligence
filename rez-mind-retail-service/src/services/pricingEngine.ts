import {
  StrategyType,
  CompetitorPrice,
  DemandSignal,
  PricingStrategy,
  CartItem,
} from '../types';
import {
  PRODUCT_CATEGORIES,
  PRICING_STRATEGY_TIERS,
  DEMAND_SIGNALS,
  SEASONAL_PATTERNS,
} from '../config/knowledge';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

interface PriceOptimizationContext {
  merchantId: string;
  competitorPrices?: CompetitorPrice[];
  demandSignals?: DemandSignal[];
  inventoryLevel?: number;
}

interface PriceOptimizationResult {
  suggestedPrice: number;
  strategy: StrategyType;
  minPrice: number;
  maxPrice: number;
  confidence: number;
  reasoning: string;
  triggers?: Array<{
    type: string;
    condition: string;
    action: string;
    threshold?: number;
    amount?: number;
  }>;
}

interface BundlePricing {
  bundleId: string;
  products: CartItem[];
  originalTotal: number;
  bundlePrice: number;
  discount: number;
  suggestedStrategy: StrategyType;
  confidence: number;
}

interface CompetitiveAnalysis {
  merchantId: string;
  analyzedProducts: number;
  competitivePosition: 'above' | 'at' | 'below';
  avgPriceDifference: number;
  recommendations: Array<{
    productId: string;
    currentPrice: number;
    suggestedPrice: number;
    action: 'increase' | 'decrease' | 'maintain';
    reason: string;
  }>;
}

export class PricingEngine {
  private baseCosts: Map<string, number> = new Map();

  constructor() {
    // Initialize base costs for common product types
    this.initializeBaseCosts();
  }

  /**
   * Initialize base cost estimates for products
   */
  private initializeBaseCosts(): void {
    Object.entries(PRODUCT_CATEGORIES).forEach(([category, data]) => {
      const estimatedCost = 50 * (1 - data.avgMargin);
      this.baseCosts.set(category, Math.max(10, estimatedCost));
    });
  }

  /**
   * Get estimated cost for a product
   */
  private getEstimatedCost(category: string): number {
    return this.baseCosts.get(category) || 30;
  }

  /**
   * Optimize price for a product
   */
  async optimizePrice(
    productId: string,
    context: PriceOptimizationContext
  ): Promise<PriceOptimizationResult> {
    logger.debug('Optimizing price', { productId, context });

    const {
      merchantId,
      competitorPrices = [],
      demandSignals = [],
      inventoryLevel,
    } = context;

    // Parse product category from ID
    const categoryMatch = productId.match(/-(electronics|fashion|grocery|home|furniture|beauty|sports|toys|books)-/i);
    const category = categoryMatch ? categoryMatch[1] : 'electronics';
    const categoryData = PRODUCT_CATEGORIES[category as keyof typeof PRODUCT_CATEGORIES];

    const baseCost = this.getEstimatedCost(category);
    const avgMargin = categoryData?.avgMargin || 0.35;

    // Calculate base price from cost and margin
    let basePrice = baseCost / (1 - avgMargin);

    // Apply competitor pricing adjustments
    let competitiveAdjustment = 0;
    let competitorInfluence = 0;

    if (competitorPrices.length > 0) {
      const avgCompetitorPrice = competitorPrices.reduce(
        (sum, cp) => sum + cp.price,
        0
      ) / competitorPrices.length;

      const priceDiff = (basePrice - avgCompetitorPrice) / avgCompetitorPrice;
      competitiveAdjustment = priceDiff * 0.3; // 30% weight to competitors
      competitorInfluence = Math.min(0.95, competitorPrices.length / 5);
    }

    // Apply demand signal adjustments
    let demandAdjustment = 0;
    if (demandSignals.length > 0) {
      demandSignals.forEach(signal => {
        const signalMultiplier = DEMAND_SIGNALS[this.getDemandLevel(signal.value)]?.multiplier || 1;
        demandAdjustment += (signalMultiplier - 1) * 0.25; // 25% weight to demand
      });
      demandAdjustment /= demandSignals.length;
    }

    // Apply inventory adjustments
    let inventoryAdjustment = 0;
    if (inventoryLevel !== undefined) {
      if (inventoryLevel < 10) {
        inventoryAdjustment = -0.1; // Increase price when low stock
      } else if (inventoryLevel > 100) {
        inventoryAdjustment = -0.05; // Slight discount for high stock
      }
    }

    // Apply seasonal adjustments
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' }).toLowerCase();
    const seasonalFactor = categoryData?.seasonalityPeak.includes(currentMonth) ? 0.05 : 0;

    // Calculate final adjustment
    const totalAdjustment =
      competitiveAdjustment +
      demandAdjustment +
      inventoryAdjustment +
      seasonalFactor;

    // Calculate suggested price
    let suggestedPrice = basePrice * (1 + totalAdjustment);

    // Apply psychological pricing (round to .99)
    suggestedPrice = this.psychologicalPricing(suggestedPrice);

    // Calculate price range
    const minPrice = Math.round(baseCost * 1.1 * 100) / 100; // At least 10% margin
    const maxPrice = Math.round(basePrice * 1.3 * 100) / 100; // Max 30% above base

    // Ensure suggested price is within range
    suggestedPrice = Math.max(minPrice, Math.min(maxPrice, suggestedPrice));

    // Determine strategy type
    let strategy: StrategyType = StrategyType.MARGIN;
    if (competitorPrices.length > 0 && competitorInfluence > 0.5) {
      strategy = StrategyType.COMPETITIVE;
    } else if (demandSignals.some(s => s.type === 'seasonal')) {
      strategy = StrategyType.SEASONAL;
    } else if (this.isPsychologicalPrice(suggestedPrice)) {
      strategy = StrategyType.PSYCHOLOGICAL;
    }

    // Calculate confidence
    const confidence = this.calculateConfidence(
      competitorInfluence,
      demandSignals.length,
      inventoryLevel !== undefined
    );

    // Generate reasoning
    const reasoning = this.generateReasoning(
      strategy,
      totalAdjustment,
      competitorPrices,
      demandSignals,
      inventoryLevel
    );

    // Generate triggers
    const triggers = this.generateTriggers(
      strategy,
      basePrice,
      suggestedPrice,
      competitorPrices
    );

    return {
      suggestedPrice,
      strategy,
      minPrice,
      maxPrice,
      confidence,
      reasoning,
      triggers,
    };
  }

  /**
   * Get demand level from signal value
   */
  private getDemandLevel(value: number): keyof typeof DEMAND_SIGNALS {
    if (value > 80) return 'high';
    if (value > 50) return 'normal';
    if (value > 20) return 'low';
    return 'very_low';
  }

  /**
   * Apply psychological pricing rules
   */
  psychologicalPricing(price: number): number {
    if (price < 10) {
      // Under $10: .99 pricing
      return Math.floor(price) + 0.99;
    } else if (price < 100) {
      // $10-$100: .95 or .99
      return Math.floor(price) + (Math.random() > 0.5 ? 0.99 : 0.95);
    } else if (price < 1000) {
      // $100-$1000: round to nearest 9.99 or 99
      return Math.round(price / 10) * 10 - 0.01;
    } else {
      // Over $1000: round to nearest 99
      return Math.round(price / 100) * 100 - 1;
    }
  }

  /**
   * Check if price is psychological
   */
  private isPsychologicalPrice(price: number): boolean {
    const decimal = price % 1;
    return decimal === 0.99 || decimal === 0.95 || decimal === 0.49;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    competitorInfluence: number,
    demandSignalCount: number,
    hasInventory: boolean
  ): number {
    let confidence = 0.5; // Base confidence

    confidence += competitorInfluence * 0.25;
    confidence += Math.min(0.25, demandSignalCount * 0.05);
    confidence += hasInventory ? 0.1 : 0;

    return Math.min(0.95, Math.max(0.6, confidence));
  }

  /**
   * Generate reasoning explanation
   */
  private generateReasoning(
    strategy: StrategyType,
    adjustment: number,
    competitors: CompetitorPrice[],
    demandSignals: DemandSignal[],
    inventory?: number
  ): string {
    const reasons: string[] = [];

    reasons.push(`Strategy: ${strategy} pricing`);

    if (adjustment > 0.05) {
      reasons.push('Strong demand signals support price increase');
    } else if (adjustment < -0.05) {
      reasons.push('Market conditions suggest price reduction');
    } else {
      reasons.push('Stable market conditions - maintaining competitive pricing');
    }

    if (competitors.length > 0) {
      const avgCompPrice = competitors.reduce((s, c) => s + c.price, 0) / competitors.length;
      reasons.push(`Competitor average: $${avgCompPrice.toFixed(2)}`);
    }

    if (demandSignals.length > 0) {
      const seasonalSignals = demandSignals.filter(s => s.type === 'seasonal');
      if (seasonalSignals.length > 0) {
        reasons.push('Seasonal demand factors applied');
      }
    }

    if (inventory !== undefined) {
      if (inventory < 10) {
        reasons.push('Low inventory supports premium pricing');
      } else if (inventory > 100) {
        reasons.push('High inventory - volume pricing considered');
      }
    }

    return reasons.join('. ') + '.';
  }

  /**
   * Generate pricing triggers
   */
  private generateTriggers(
    strategy: StrategyType,
    basePrice: number,
    suggestedPrice: number,
    competitors: CompetitorPrice[]
  ): Array<{
    type: string;
    condition: string;
    action: string;
    threshold?: number;
    amount?: number;
  }> {
    const triggers = [];

    // Competitor-based trigger
    if (strategy === StrategyType.COMPETITIVE && competitors.length > 0) {
      const avgCompetitor = competitors.reduce((s, c) => s + c.price, 0) / competitors.length;
      triggers.push({
        type: 'competitor_price',
        condition: `competitor price changes by more than 5%`,
        action: 'adjust',
        threshold: 0.05,
        amount: suggestedPrice - basePrice,
      });
    }

    // Demand-based trigger
    triggers.push({
      type: 'demand',
      condition: 'demand signals indicate significant change',
      action: suggestedPrice > basePrice ? 'increase' : 'decrease',
      threshold: 0.1,
      amount: Math.abs(suggestedPrice - basePrice) * 0.5,
    });

    // Inventory-based trigger
    triggers.push({
      type: 'inventory',
      condition: 'stock level changes significantly',
      action: 'adjust',
    });

    // Seasonal trigger
    triggers.push({
      type: 'seasonal',
      condition: 'seasonal demand period begins',
      action: 'increase',
      amount: basePrice * 0.05,
    });

    return triggers;
  }

  /**
   * Generate bundle pricing
   */
  async generateBundlePricing(bundleProducts: CartItem[]): Promise<BundlePricing> {
    logger.debug('Generating bundle pricing', { productCount: bundleProducts.length });

    const originalTotal = bundleProducts.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );

    // Bundle discount based on product count
    let discount: number;
    if (bundleProducts.length >= 4) {
      discount = 20;
    } else if (bundleProducts.length >= 3) {
      discount = 15;
    } else {
      discount = 10;
    }

    const bundlePrice = originalTotal * (1 - discount / 100);

    // Apply psychological pricing
    const finalBundlePrice = this.psychologicalPricing(bundlePrice);

    // Determine best strategy
    let suggestedStrategy: StrategyType = StrategyType.BUNDLE;
    if (discount >= 20) {
      suggestedStrategy = StrategyType.COMPETITIVE;
    }

    return {
      bundleId: uuidv4(),
      products: bundleProducts,
      originalTotal: Math.round(originalTotal * 100) / 100,
      bundlePrice: Math.round(finalBundlePrice * 100) / 100,
      discount,
      suggestedStrategy,
      confidence: 0.75 + (bundleProducts.length * 0.02),
    };
  }

  /**
   * Perform competitive analysis
   */
  async competitiveAnalysis(merchantId: string): Promise<CompetitiveAnalysis> {
    logger.debug('Running competitive analysis', { merchantId });

    const recommendations: CompetitiveAnalysis['recommendations'] = [];

    // Analyze each category
    Object.entries(PRODUCT_CATEGORIES).forEach(([category, data]) => {
      const baseCost = this.getEstimatedCost(category);
      const basePrice = baseCost / (1 - data.avgMargin);

      // Simulate competitor prices
      const competitorPrice = basePrice * (0.9 + Math.random() * 0.2);
      const priceDiff = (basePrice - competitorPrice) / competitorPrice;

      let action: 'increase' | 'decrease' | 'maintain';
      let suggestedPrice = basePrice;

      if (priceDiff > 0.1) {
        action = 'decrease';
        suggestedPrice = competitorPrice * 0.98; // Just under competitor
      } else if (priceDiff < -0.1) {
        action = 'increase';
        suggestedPrice = competitorPrice * 0.95; // Not too aggressive
      } else {
        action = 'maintain';
        suggestedPrice = basePrice;
      }

      recommendations.push({
        productId: `comp-${merchantId}-${category}`,
        currentPrice: Math.round(basePrice * 100) / 100,
        suggestedPrice: this.psychologicalPricing(suggestedPrice),
        action,
        reason: action === 'decrease'
          ? 'Price above market - recommend adjustment'
          : action === 'increase'
          ? 'Room to increase price while staying competitive'
          : 'Price is well-positioned',
      });
    });

    // Calculate aggregate metrics
    const avgPriceDiff = recommendations.reduce(
      (sum, r) => sum + ((r.suggestedPrice - r.currentPrice) / r.currentPrice),
      0
    ) / recommendations.length;

    let competitivePosition: 'above' | 'at' | 'below';
    if (avgPriceDiff > 0.05) {
      competitivePosition = 'above';
    } else if (avgPriceDiff < -0.05) {
      competitivePosition = 'below';
    } else {
      competitivePosition = 'at';
    }

    return {
      merchantId,
      analyzedProducts: recommendations.length,
      competitivePosition,
      avgPriceDifference: Math.round(avgPriceDiff * 10000) / 100, // percentage
      recommendations,
    };
  }

  /**
   * Calculate price elasticity
   */
  calculatePriceElasticity(
    currentPrice: number,
    demandAtCurrentPrice: number,
    newPrice: number
  ): {
    elasticity: number;
    estimatedDemandChange: number;
    recommendation: 'raise' | 'lower' | 'maintain';
  } {
    // Simplified price elasticity calculation
    const priceChangeRatio = (newPrice - currentPrice) / currentPrice;

    // Assume elasticity of -1.5 (typical for retail)
    const elasticity = -1.5;
    const estimatedDemandChange = elasticity * priceChangeRatio;

    let recommendation: 'raise' | 'lower' | 'maintain';
    if (estimatedDemandChange > 0.1) {
      recommendation = 'lower';
    } else if (estimatedDemandChange < -0.1) {
      recommendation = 'raise';
    } else {
      recommendation = 'maintain';
    }

    return {
      elasticity,
      estimatedDemandChange: Math.round(estimatedDemandChange * 10000) / 100,
      recommendation,
    };
  }

  /**
   * Get pricing tier for a category
   */
  getPricingTier(category: string): {
    name: string;
    markupRange: [number, number];
    characteristics: string[];
  } {
    const categoryData = PRODUCT_CATEGORIES[category as keyof typeof PRODUCT_CATEGORIES];
    const avgMargin = categoryData?.avgMargin || 0.35;

    // Determine tier based on margin
    if (avgMargin <= 0.2) {
      return PRICING_STRATEGY_TIERS.economy;
    } else if (avgMargin <= 0.4) {
      return PRICING_STRATEGY_TIERS.standard;
    } else if (avgMargin <= 0.6) {
      return PRICING_STRATEGY_TIERS.premium;
    } else {
      return PRICING_STRATEGY_TIERS.luxury;
    }
  }
}