/**
 * Merchant Suggestions Service
 * AI-powered recommendations for inventory management and pricing optimization
 */

import {
  MerchantRecommendation,
  BaseProduct,
  PriceBreakdown,
  InventoryContext,
  DemandContext,
  CompetitionContext,
} from '../types/index.js';

interface RecommendationConfig {
  minConfidence: number;
  maxRecommendationsPerProduct: number;
  priorityThreshold: {
    high: number;
    medium: number;
  };
}

interface PromotionalCalendar {
  upcomingEvents: {
    name: string;
    date: Date;
    type: 'holiday' | 'seasonal' | 'cultural' | 'sales';
    expectedDemandMultiplier: number;
  }[];
}

const DEFAULT_CONFIG: RecommendationConfig = {
  minConfidence: 0.6,
  maxRecommendationsPerProduct: 5,
  priorityThreshold: {
    high: 0.8,
    medium: 0.65,
  },
};

export class MerchantSuggestions {
  private config: RecommendationConfig;
  private recommendationHistory: Map<string, MerchantRecommendation[]>;
  private promotionalCalendar: PromotionalCalendar;

  constructor(config: Partial<RecommendationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.recommendationHistory = new Map();
    this.promotionalCalendar = {
      upcomingEvents: this.generateUpcomingEvents(),
    };
  }

  /**
   * Generate comprehensive recommendations for a product
   */
  async generateRecommendations(
    product: BaseProduct,
    pricing: PriceBreakdown,
    inventory: InventoryContext,
    demand: DemandContext,
    competition: CompetitionContext
  ): Promise<MerchantRecommendation[]> {
    const recommendations: MerchantRecommendation[] = [];

    // 1. Price optimization recommendations
    recommendations.push(...this.generatePricingRecommendations(product, pricing));

    // 2. Inventory management recommendations
    recommendations.push(...this.generateInventoryRecommendations(product, inventory));

    // 3. Demand-based recommendations
    recommendations.push(...this.generateDemandRecommendations(product, demand));

    // 4. Competition-based recommendations
    recommendations.push(...this.generateCompetitionRecommendations(product, competition));

    // 5. Promotional recommendations
    recommendations.push(...this.generatePromotionalRecommendations(product, pricing));

    // Filter and sort by priority
    const filtered = recommendations.filter(r => r.confidence >= this.config.minConfidence);
    const sorted = filtered.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Limit results
    const limited = sorted.slice(0, this.config.maxRecommendationsPerProduct);

    // Store in history
    this.recommendationHistory.set(product.id, limited);

    return limited;
  }

  /**
   * Generate pricing optimization recommendations
   */
  private generatePricingRecommendations(
    product: BaseProduct,
    pricing: PriceBreakdown
  ): MerchantRecommendation[] {
    const recommendations: MerchantRecommendation[] = [];
    const estimatedStock = this.inventoryEstimate(product);

    // Analyze total adjustment
    if (pricing.totalAdjustment < -0.15) {
      recommendations.push({
        id: `price-high-disc-${product.id}`,
        type: 'discount',
        title: 'High Discount Alert',
        description: `Current pricing suggests a ${(pricing.totalAdjustment * 100).toFixed(0)}% adjustment from base. Review if this aligns with margin targets.`,
        potentialImpact: {
          revenueChange: product.basePrice * pricing.totalAdjustment * estimatedStock,
          marginImpact: pricing.totalAdjustment * 0.8,
          unitsAffected: Math.floor(product.basePrice * 0.1),
        },
        priority: 'high',
        confidence: 0.9,
        actionItems: [
          'Review cost structure',
          'Consider gradual discount instead of steep reduction',
          'Check if demand justifies the discount',
          'Evaluate competitor pricing',
        ],
        estimatedCompletionDays: 1,
      });
    } else if (pricing.totalAdjustment > 0.05) {
      recommendations.push({
        id: `price-premium-${product.id}`,
        type: 'discount',
        title: 'Premium Pricing Opportunity',
        description: `Favorable market conditions allow for a ${(pricing.totalAdjustment * 100).toFixed(0)}% price increase.`,
        potentialImpact: {
          revenueChange: product.basePrice * pricing.totalAdjustment * estimatedStock,
          marginImpact: pricing.totalAdjustment,
          unitsAffected: Math.floor(product.basePrice * 0.1),
        },
        priority: 'medium',
        confidence: 0.75,
        actionItems: [
          'Monitor competitor pricing closely',
          'Set price ceiling to avoid customer backlash',
          'Prepare justification for price increase',
          'Consider gradual price adjustment',
        ],
        estimatedCompletionDays: 3,
      });
    }

    // Factor-specific recommendations
    pricing.factors.forEach(factor => {
      if (Math.abs(factor.value) > 0.15) {
        recommendations.push({
          id: `price-factor-${factor.category}-${product.id}`,
          type: 'discount',
          title: `${factor.category.charAt(0).toUpperCase() + factor.category.slice(1)} Factor Review`,
          description: `The ${factor.name} is driving a ${(factor.value * 100).toFixed(0)}% adjustment: ${factor.reason}`,
          potentialImpact: {
            revenueChange: product.basePrice * factor.value * estimatedStock,
            marginImpact: factor.value * 0.6,
            unitsAffected: Math.floor(estimatedStock * Math.abs(factor.value)),
          },
          priority: 'medium',
          confidence: factor.weight,
          actionItems: this.getFactorActionItems(factor.category, factor.value),
          estimatedCompletionDays: 2,
        });
      }
    });

    return recommendations;
  }

  /**
   * Generate inventory-related recommendations
   */
  private generateInventoryRecommendations(
    product: BaseProduct,
    inventory: InventoryContext
  ): MerchantRecommendation[] {
    const recommendations: MerchantRecommendation[] = [];

    // Expiry urgency
    if (inventory.daysUntilExpiry !== null) {
      if (inventory.daysUntilExpiry < 3) {
        recommendations.push({
          id: `inv-urgent-${product.id}`,
          type: 'discount',
          title: 'URGENT: Clear Expiring Stock',
          description: `${inventory.daysUntilExpiry} day(s) until expiry. Immediate markdown required to prevent waste.`,
          potentialImpact: {
            revenueChange: -inventory.stockLevel * product.basePrice * 0.4,
            marginImpact: -0.4,
            unitsAffected: inventory.stockLevel,
          },
          priority: 'high',
          confidence: 0.98,
          actionItems: [
            'Apply maximum allowable discount immediately',
            'Move to high-traffic location',
            'Notify staff for priority selling',
            'Consider bundle with non-perishable items',
            'Alert customers through marketing',
          ],
          estimatedCompletionDays: inventory.daysUntilExpiry,
        });
      }
    }

    // Overstock strategy
    if (inventory.stockPercentage > 70) {
      recommendations.push({
        id: `inv-overstock-${product.id}`,
        type: 'promotion',
        title: 'Overstock Clearance Needed',
        description: `Stock at ${inventory.stockPercentage.toFixed(0)}% capacity. Implement clearance strategy.`,
        potentialImpact: {
          revenueChange: inventory.stockLevel * product.basePrice * 0.15,
          marginImpact: -0.1,
          unitsAffected: Math.floor(inventory.stockLevel * 0.4),
        },
        priority: 'medium',
        confidence: 0.85,
        actionItems: [
          'Create time-limited promotion',
          'Consider bulk discounts',
          'Bundle with complementary products',
          'Review future ordering quantities',
        ],
        estimatedCompletionDays: 14,
      });
    }

    // Scarcity pricing
    if (inventory.stockPercentage < 15) {
      recommendations.push({
        id: `inv-scarce-${product.id}`,
        type: 'marketing',
        title: 'Leverage Scarcity for Premium Pricing',
        description: `Limited stock (${inventory.stockPercentage.toFixed(0)}%). Implement urgency marketing.`,
        potentialImpact: {
          revenueChange: inventory.stockLevel * product.basePrice * 0.15,
          marginImpact: 0.15,
          unitsAffected: inventory.stockLevel,
        },
        priority: 'medium',
        confidence: 0.80,
        actionItems: [
          'Display "Limited Availability" messaging',
          'Consider slight price increase',
          'Add to "Selling Fast" section',
          'Prepare restock messaging',
        ],
        estimatedCompletionDays: Math.ceil(inventory.stockLevel / 10),
      });
    }

    return recommendations;
  }

  /**
   * Generate demand-based recommendations
   */
  private generateDemandRecommendations(
    product: BaseProduct,
    demand: DemandContext
  ): MerchantRecommendation[] {
    const recommendations: MerchantRecommendation[] = [];
    const estimatedStock = this.inventoryEstimate(product);

    // Demand surge
    if (demand.trend === 'increasing') {
      recommendations.push({
        id: `demand-surge-${product.id}`,
        type: 'marketing',
        title: 'Demand Surge Detected',
        description: `Demand trending up with ${(demand.realTimeInterest * 100).toFixed(0)}% real-time interest. Stock up or adjust pricing.`,
        potentialImpact: {
          revenueChange: product.basePrice * 0.1 * estimatedStock,
          marginImpact: 0.1,
          unitsAffected: estimatedStock,
        },
        priority: 'high',
        confidence: demand.confidence,
        actionItems: [
          'Check current inventory levels',
          'Place urgent reorder if needed',
          'Consider price optimization for peak demand',
          'Prepare for flash sale if overstock exists',
        ],
        estimatedCompletionDays: 1,
      });
    }

    // Demand decline
    if (demand.trend === 'decreasing' && demand.currentDemand < 0.3) {
      recommendations.push({
        id: `demand-decline-${product.id}`,
        type: 'promotion',
        title: 'Demand Decline Warning',
        description: `Current demand at ${(demand.currentDemand * 100).toFixed(0)}% with downward trend. Consider promotional action.`,
        potentialImpact: {
          revenueChange: product.basePrice * 0.05 * estimatedStock,
          marginImpact: -0.08,
          unitsAffected: Math.floor(estimatedStock * 0.5),
        },
        priority: 'medium',
        confidence: demand.confidence * 0.8,
        actionItems: [
          'Analyze competitor activity',
          'Review product positioning',
          'Consider targeted promotion',
          'Evaluate product listing visibility',
        ],
        estimatedCompletionDays: 7,
      });
    }

    // Predicted surge
    if (demand.predictedDemand > demand.currentDemand * 1.3) {
      recommendations.push({
        id: `demand-predicted-${product.id}`,
        type: 'restock',
        title: 'Anticipated Demand Spike',
        description: `Predicted demand up ${((demand.predictedDemand / demand.currentDemand - 1) * 100).toFixed(0)}% in coming period. Prepare inventory.`,
        potentialImpact: {
          revenueChange: product.basePrice * (demand.predictedDemand - demand.currentDemand) * estimatedStock,
          marginImpact: 0.05,
          unitsAffected: Math.ceil((demand.predictedDemand - demand.currentDemand) * estimatedStock),
        },
        priority: 'high',
        confidence: demand.confidence * 0.7,
        actionItems: [
          'Review supplier capacity',
          'Place advance order',
          'Consider pre-emptive pricing strategy',
          'Plan marketing for demand peak',
        ],
        estimatedCompletionDays: 5,
      });
    }

    return recommendations;
  }

  /**
   * Generate competition-based recommendations
   */
  private generateCompetitionRecommendations(
    product: BaseProduct,
    competition: CompetitionContext
  ): MerchantRecommendation[] {
    const recommendations: MerchantRecommendation[] = [];
    const estimatedStock = this.inventoryEstimate(product);

    if (competition.competitorPrices.length === 0) {
      return recommendations;
    }

    // Price gap analysis
    const avgCompetitor = competition.averageCompetitorPrice;
    const ourPrice = product.basePrice;
    const priceGap = ((avgCompetitor - ourPrice) / ourPrice) * 100;

    if (priceGap > 15) {
      recommendations.push({
        id: `comp-undercut-${product.id}`,
        type: 'marketing',
        title: 'Significant Price Gap vs Competition',
        description: `Our price is ${priceGap.toFixed(0)}% below market average. Consider if this is intentional or pricing error.`,
        potentialImpact: {
          revenueChange: estimatedStock * ourPrice * (priceGap / 100) * 0.3,
          marginImpact: -0.05,
          unitsAffected: Math.floor(estimatedStock * 0.3),
        },
        priority: 'medium',
        confidence: 0.85,
        actionItems: [
          'Review pricing strategy',
          'Verify competitor prices',
          'Consider gradual price increase',
          'Ensure value proposition is communicated',
        ],
        estimatedCompletionDays: 3,
      });
    } else if (priceGap < -10) {
      recommendations.push({
        id: `comp-premium-${product.id}`,
        type: 'marketing',
        title: 'Above Market Pricing Detected',
        description: `Our price is ${Math.abs(priceGap).toFixed(0)}% above market. Ensure differentiation justifies premium.`,
        potentialImpact: {
          revenueChange: -estimatedStock * ourPrice * (Math.abs(priceGap) / 100) * 0.2,
          marginImpact: -0.1,
          unitsAffected: Math.floor(estimatedStock * 0.2),
        },
        priority: 'medium',
        confidence: 0.80,
        actionItems: [
          'Verify product quality messaging',
          'Highlight unique selling points',
          'Consider competitive matching',
          'Review customer reviews',
        ],
        estimatedCompletionDays: 7,
      });
    }

    // Nearest competitor warning
    const nearest = competition.competitorPrices
      .filter(c => c.distance !== undefined)
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))[0];

    if (nearest && (nearest.distance || 0) < 5) {
      const localGap = ((nearest.price - ourPrice) / ourPrice) * 100;
      if (localGap > 10) {
        recommendations.push({
          id: `comp-local-${product.id}`,
          type: 'marketing',
          title: 'Local Competitor Price Advantage',
          description: `Nearby competitor ${nearest.competitorName} is ${Math.abs(localGap).toFixed(0)}% cheaper. Local customers may switch.`,
          potentialImpact: {
            revenueChange: -estimatedStock * ourPrice * 0.05,
            marginImpact: -0.03,
            unitsAffected: Math.floor(estimatedStock * 0.15),
          },
          priority: 'medium',
          confidence: 0.75,
          actionItems: [
            'Review local competitor pricing',
            'Consider location-based promotions',
            'Highlight convenience advantages',
            'Evaluate price matching policy',
          ],
          estimatedCompletionDays: 2,
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate promotional recommendations
   */
  private generatePromotionalRecommendations(
    product: BaseProduct,
    _pricing: PriceBreakdown
  ): MerchantRecommendation[] {
    const recommendations: MerchantRecommendation[] = [];
    const now = new Date();
    const estimatedStock = this.inventoryEstimate(product);

    // Check upcoming events
    const nextEvent = this.promotionalCalendar.upcomingEvents
      .filter(e => e.date > now)
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

    if (nextEvent) {
      const daysUntil = Math.ceil((nextEvent.date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      recommendations.push({
        id: `promo-event-${product.id}`,
        type: 'promotion',
        title: `${nextEvent.name} Preparation`,
        description: `${nextEvent.name} in ${daysUntil} days. Expected demand increase: ${((nextEvent.expectedDemandMultiplier - 1) * 100).toFixed(0)}%.`,
        potentialImpact: {
          revenueChange: product.basePrice * (nextEvent.expectedDemandMultiplier - 1) * estimatedStock,
          marginImpact: 0.05,
          unitsAffected: Math.ceil(estimatedStock * 0.3),
        },
        priority: daysUntil <= 7 ? 'high' : 'medium',
        confidence: 0.80,
        actionItems: [
          'Prepare promotional pricing',
          'Ensure adequate stock levels',
          'Plan marketing materials',
          'Set up event-specific displays',
          'Train staff on promotions',
        ],
        estimatedCompletionDays: daysUntil,
      });
    }

    // Cross-sell recommendations
    recommendations.push({
      id: `promo-bundle-${product.id}`,
      type: 'bundle',
      title: 'Bundle Opportunity',
      description: 'Create bundle packages to increase average order value and clear slow-moving inventory.',
      potentialImpact: {
        revenueChange: product.basePrice * 0.2 * estimatedStock,
        marginImpact: 0.08,
        unitsAffected: Math.floor(estimatedStock * 0.3),
      },
      priority: 'low',
      confidence: 0.70,
      actionItems: [
        'Identify complementary products',
        'Calculate bundle pricing',
        'Design bundle presentation',
        'Set up bundle tracking',
      ],
      estimatedCompletionDays: 10,
    });

    return recommendations;
  }

  /**
   * Get action items for specific factor category
   */
  private getFactorActionItems(category: string, value: number): string[] {
    const baseItems: Record<string, string[]> = {
      time: [
        'Review pricing schedule',
        'Consider time-based promotions',
        'Adjust peak/off-peak strategy',
      ],
      inventory: [
        'Review inventory levels',
        'Check expiry dates',
        'Evaluate reorder points',
      ],
      demand: [
        'Monitor demand trends',
        'Adjust marketing efforts',
        'Consider demand forecasting improvements',
      ],
      competition: [
        'Review competitor prices',
        'Analyze market positioning',
        'Consider competitive response',
      ],
    };

    const items = baseItems[category] || ['Review current settings'];
    if (value > 0) {
      items.unshift('Review if premium pricing is sustainable');
    } else {
      items.unshift('Evaluate if discount is necessary');
    }

    return items.slice(0, 4);
  }

  /**
   * Get upcoming promotional events
   */
  getUpcomingEvents(days: number = 30): PromotionalCalendar['upcomingEvents'] {
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return this.promotionalCalendar.upcomingEvents
      .filter(e => e.date >= now && e.date <= cutoff)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Get recommendation history
   */
  getRecommendationHistory(productId?: string): Map<string, MerchantRecommendation[]> {
    if (productId) {
      return new Map([[productId, this.recommendationHistory.get(productId) || []]]);
    }
    return new Map(this.recommendationHistory);
  }

  /**
   * Generate upcoming events for the next 3 months
   */
  private generateUpcomingEvents(): PromotionalCalendar['upcomingEvents'] {
    const now = new Date();
    const events: PromotionalCalendar['upcomingEvents'] = [];

    // Add common retail events
    const commonEvents = [
      { name: 'Weekend Sale', daysOffset: 2, type: 'seasonal' as const, multiplier: 1.2 },
      { name: 'Mid-Week Special', daysOffset: 5, type: 'seasonal' as const, multiplier: 1.1 },
      { name: 'End of Month Clearance', daysOffset: 10, type: 'sales' as const, multiplier: 1.3 },
      { name: 'Flash Sale Weekend', daysOffset: 14, type: 'sales' as const, multiplier: 1.4 },
    ];

    commonEvents.forEach(event => {
      const date = new Date(now.getTime() + event.daysOffset * 24 * 60 * 60 * 1000);
      events.push({
        name: event.name,
        date,
        type: event.type,
        expectedDemandMultiplier: event.multiplier,
      });
    });

    return events;
  }

  /**
   * Estimate inventory for impact calculations
   * In real implementation, this would query actual inventory
   */
  private inventoryEstimate(_product: BaseProduct): number {
    return 50;
  }
}

export default MerchantSuggestions;
