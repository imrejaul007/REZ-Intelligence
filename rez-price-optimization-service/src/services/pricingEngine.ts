/**
 * Core Pricing Engine Service
 * Implements dynamic pricing calculations based on multiple factors
 */

import {
  PriceCalculationInput,
  PriceBreakdown,
  PriceFactor,
  TimeContext,
  InventoryContext,
  DemandContext,
  CompetitionContext,
  BaseProduct,
} from '../types/index.js';

interface PricingEngineConfig {
  minMarginPercent: number;
  maxDiscountPercent: number;
  confidenceThreshold: number;
  enableCompetitionFactor: boolean;
  enableDemandFactor: boolean;
}

const DEFAULT_CONFIG: PricingEngineConfig = {
  minMarginPercent: 5,
  maxDiscountPercent: 50,
  confidenceThreshold: 0.7,
  enableCompetitionFactor: true,
  enableDemandFactor: true,
};

export class PricingEngine {
  private config: PricingEngineConfig;

  constructor(config: Partial<PricingEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate dynamic price based on all factors
   */
  calculatePrice(input: PriceCalculationInput): PriceBreakdown {
    const factors: PriceFactor[] = [];

    // Calculate individual factors
    const timeFactor = this.calculateTimeFactor(input.time);
    const inventoryFactor = this.calculateInventoryFactor(input.inventory);
    const demandFactor = this.calculateDemandFactor(input.demand);
    const competitionFactor = this.calculateCompetitionFactor(input.competition);

    factors.push(timeFactor, inventoryFactor, demandFactor, competitionFactor);

    // Calculate total adjustment using the formula:
    // finalPrice = basePrice × (1 + timeFactor) × (1 + inventoryFactor) × (1 + demandFactor) × (1 + competitionFactor)
    const basePrice = input.product.basePrice;
    const totalMultiplier = factors.reduce(
      (acc, factor) => acc * (1 + factor.value),
      1
    );

    let finalPrice = basePrice * totalMultiplier;

    // Apply price boundaries (min/max)
    const minPrice = this.calculateMinPrice(input.product);
    const maxPrice = this.calculateMaxPrice(input.product);
    finalPrice = Math.max(minPrice, Math.min(maxPrice, finalPrice));

    // Round to 2 decimal places
    finalPrice = Math.round(finalPrice * 100) / 100;

    // Calculate total adjustment percentage
    const totalAdjustment = (finalPrice - basePrice) / basePrice;

    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(input);

    return {
      basePrice,
      factors,
      totalAdjustment,
      finalPrice,
      minPrice,
      maxPrice,
      confidence,
      calculatedAt: new Date(),
    };
  }

  /**
   * Calculate time-based factor
   * Negative value = discount (price reduction)
   * Positive value = premium (price increase)
   */
  private calculateTimeFactor(time: TimeContext): PriceFactor {
    let value = 0;
    const details: Record<string, number> = {};
    const reasons: string[] = [];

    // Day of week factor
    const dayFactors: Record<number, number> = {
      0: -0.05,  // Sunday - high demand (less discount = negative adjustment to keep prices higher)
      1: 0.0,    // Monday - normal
      2: 0.0,    // Tuesday - normal
      3: -0.20,  // Wednesday - low demand (more discount)
      4: 0.0,    // Thursday - normal
      5: 0.10,   // Friday - high demand (premium)
      6: 0.05,   // Saturday - moderate demand
    };

    const dayFactor = dayFactors[time.dayOfWeek] || 0;
    value += dayFactor;
    details.dayOfWeek = dayFactor;
    if (dayFactor < 0) {
      reasons.push(`${time.dayOfWeek === 0 ? 'Sunday' : 'Wednesday'} - low/peak demand period`);
    } else if (dayFactor > 0) {
      reasons.push(`${time.dayOfWeek === 5 ? 'Friday' : 'Saturday'} - high demand period`);
    }

    // Time of day factor
    if (time.isPeakHour) {
      // Peak hours: premium pricing
      value += -0.10; // Less discount during peak (effectively higher price)
      details.peakHours = -0.10;
      reasons.push('Peak hours - premium pricing');
    } else {
      // Off-peak: more discount
      value += -0.25;
      details.offPeak = -0.25;
      reasons.push('Off-peak hours - incentivized pricing');
    }

    // Season factor
    const seasonFactors: Record<string, number> = {
      spring: 0.0,
      summer: 0.05,
      autumn: 0.0,
      winter: 0.08,
    };
    const seasonFactor = seasonFactors[time.season] || 0;
    value += seasonFactor;
    details.season = seasonFactor;
    if (seasonFactor !== 0) {
      reasons.push(`${time.season} season adjustment`);
    }

    // Holiday/Event factor
    if (time.isHoliday || time.isEventDay) {
      value += -0.15; // Premium pricing during events
      details.eventDay = -0.15;
      reasons.push('Holiday/event premium');
    }

    return {
      name: 'Time Factor',
      category: 'time',
      value: Math.round(value * 10000) / 10000,
      weight: 0.25,
      reason: reasons.join('; ') || 'Normal time period',
      details,
    };
  }

  /**
   * Calculate inventory-based factor
   */
  private calculateInventoryFactor(inventory: InventoryContext): PriceFactor {
    let value = 0;
    const details: Record<string, number> = {};
    const reasons: string[] = [];

    // Near expiry factor
    if (inventory.daysUntilExpiry !== null) {
      if (inventory.daysUntilExpiry < 3) {
        value += -0.40; // 40% discount for items expiring within 3 days
        details.nearExpiry = -0.40;
        reasons.push('Near expiry (< 3 days)');
      } else if (inventory.daysUntilExpiry < 7) {
        value += -0.25; // 25% discount for items expiring within 7 days
        details.nearExpiry = -0.25;
        reasons.push('Near expiry (< 7 days)');
      }
    }

    // Overstock factor
    const stockDays = inventory.stockLevel / (inventory.maxStock / 30); // Approximate days of stock
    if (stockDays > inventory.overstockThresholdDays) {
      value += -0.20; // 20% discount for overstock
      details.overstock = -0.20;
      reasons.push(`Overstock (> ${inventory.overstockThresholdDays} days supply)`);
    }

    // Scarcity factor
    if (inventory.stockPercentage < 10) {
      value += 0.10; // 10% premium for scarce items
      details.scarcity = 0.10;
      reasons.push('Scarcity (< 10% stock)');
    }

    // Low stock warning
    if (inventory.stockLevel <= inventory.reorderPoint && inventory.stockPercentage >= 10) {
      value += 0.05; // 5% premium for low but not critical stock
      details.lowStock = 0.05;
      reasons.push('Low stock warning');
    }

    return {
      name: 'Inventory Factor',
      category: 'inventory',
      value: Math.round(value * 10000) / 10000,
      weight: 0.30,
      reason: reasons.join('; ') || 'Normal inventory levels',
      details,
    };
  }

  /**
   * Calculate demand-based factor
   */
  private calculateDemandFactor(demand: DemandContext): PriceFactor {
    let value = 0;
    const details: Record<string, number> = {};
    const reasons: string[] = [];

    // Current demand vs historical average
    const demandDelta = demand.currentDemand - demand.historicalAverage;
    value += demandDelta * 0.3; // Scale demand impact
    details.demandDelta = demandDelta * 0.3;
    reasons.push(`Current demand: ${(demand.currentDemand * 100).toFixed(0)}% vs avg ${(demand.historicalAverage * 100).toFixed(0)}%`);

    // Predicted demand impact
    if (demand.predictedDemand > demand.currentDemand * 1.2) {
      value += 0.15; // Upcoming demand surge
      details.predictedSurge = 0.15;
      reasons.push('Predicted demand surge');
    } else if (demand.predictedDemand < demand.currentDemand * 0.8) {
      value -= 0.10; // Expected demand decline
      details.predictedDecline = -0.10;
      reasons.push('Predicted demand decline');
    }

    // Real-time interest
    if (demand.realTimeInterest > 0.8) {
      value += 0.10;
      details.realtimeInterest = 0.10;
      reasons.push('High real-time interest');
    }

    // Trend factor
    if (demand.trend === 'increasing') {
      value += 0.05;
      details.trend = 0.05;
      reasons.push('Increasing demand trend');
    } else if (demand.trend === 'decreasing') {
      value -= 0.08;
      details.trend = -0.08;
      reasons.push('Decreasing demand trend');
    }

    return {
      name: 'Demand Factor',
      category: 'demand',
      value: Math.round(value * 10000) / 10000,
      weight: 0.25,
      reason: reasons.join('; ') || 'Normal demand levels',
      details,
    };
  }

  /**
   * Calculate competition-based factor
   */
  private calculateCompetitionFactor(competition: CompetitionContext): PriceFactor {
    let value = 0;
    const details: Record<string, number> = {};
    const reasons: string[] = [];

    if (!this.config.enableCompetitionFactor || competition.competitorPrices.length === 0) {
      return {
        name: 'Competition Factor',
        category: 'competition',
        value: 0,
        weight: 0.20,
        reason: 'No competition data available',
        details,
      };
    }

    // Price difference from market average
    const avgCompetitorPrice = competition.averageCompetitorPrice;
    if (avgCompetitorPrice > 0) {
      // We want to be competitive but maintain margin
      const priceDiffPercent = (avgCompetitorPrice - competition.averageCompetitorPrice) / avgCompetitorPrice;

      if (competition.marketPosition === 'premium') {
        // Premium positioning: can be up to 15% above market
        if (priceDiffPercent > 0.15) {
          value -= 0.10; // Reduce to stay within premium band
          details.premiumAdjustment = -0.10;
          reasons.push('Premium positioning adjustment');
        }
      } else if (competition.marketPosition === 'economy') {
        // Economy positioning: aim to be 5-10% below market
        if (priceDiffPercent > 0.05) {
          value -= 0.08;
          details.economyAdjustment = -0.08;
          reasons.push('Economy positioning - competitive pricing');
        }
      } else {
        // Mid-market: match within 3%
        if (Math.abs(priceDiffPercent) > 0.03) {
          value -= priceDiffPercent * 0.5; // Move toward market
          details.marketMatch = priceDiffPercent * 0.5;
          reasons.push('Market alignment');
        }
      }

      // Specific competitor price matching
      const lowestCompetitor = Math.min(...competition.competitorPrices.map(c => c.price));
      const highestCompetitor = Math.max(...competition.competitorPrices.map(c => c.price));

      details.avgCompetitorPrice = avgCompetitorPrice;
      details.lowestCompetitor = lowestCompetitor;
      details.highestCompetitor = highestCompetitor;
      details.priceDifference = competition.priceDifference;
    }

    return {
      name: 'Competition Factor',
      category: 'competition',
      value: Math.round(value * 10000) / 10000,
      weight: 0.20,
      reason: reasons.join('; ') || 'Market competitive pricing',
      details,
    };
  }

  /**
   * Calculate minimum price (floor) to protect margin
   */
  private calculateMinPrice(product: BaseProduct): number {
    const minMarginDecimal = this.config.minMarginPercent / 100;
    const minPrice = product.cost * (1 + minMarginDecimal);
    return Math.round(minPrice * 100) / 100;
  }

  /**
   * Calculate maximum price (ceiling)
   */
  private calculateMaxPrice(product: BaseProduct): number {
    const maxDiscountDecimal = this.config.maxDiscountPercent / 100;
    const maxPrice = product.basePrice * (1 + maxDiscountDecimal);
    return Math.round(maxPrice * 100) / 100;
  }

  /**
   * Calculate confidence score based on data quality
   */
  private calculateConfidence(input: PriceCalculationInput): number {
    let confidence = 0.5; // Base confidence

    // Inventory data quality
    if (input.inventory.stockLevel >= 0) {
      confidence += 0.15;
    }

    // Demand data quality
    if (input.demand.confidence > 0) {
      confidence += input.demand.confidence * 0.2;
    }

    // Competition data quality
    if (input.competition.competitorPrices.length > 0) {
      confidence += 0.15;
    }

    // Time data is always available
    confidence += 0.1;

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Update pricing configuration
   */
  updateConfig(newConfig: Partial<PricingEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): PricingEngineConfig {
    return { ...this.config };
  }
}

export default PricingEngine;
