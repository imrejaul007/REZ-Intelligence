/**
 * Price Optimization Model
 *
 * Dynamic pricing engine using:
 * - Demand elasticity
 * - Competitive pricing
 * - Inventory levels
 * - Seasonality factors
 * - Customer segmentation
 */

import { EventEmitter } from 'events';

export interface PriceOptimization {
  originalPrice: number;
  optimizedPrice: number;
  minPrice: number;
  maxPrice: number;
  confidence: number;
  factors: PriceFactors;
  reasoning: string;
}

export interface PriceFactors {
  demand: number;       // 0-1, higher = more demand
  competition: number;   // 0-1, higher = more competitive
  inventory: number;   // 0-1, higher = more stock
  seasonality: number; // Multiplier for seasonal demand
  customerSegment: string;
  timeOfDay?: number;  // 0-1, demand by time
  dayOfWeek?: number; // Day multiplier
}

export interface OptimizationConfig {
  strategy: 'aggressive' | 'moderate' | 'conservative';
  minMargin: number;
  maxDiscountPercent: number;
  priceFloor?: number;
  priceCeiling?: number;
}

export interface PriceHistory {
  date: string;
  price: number;
  sales: number;
  inventory: number;
}

export interface OptimizationResult {
  success: boolean;
  optimization?: PriceOptimization;
  error?: string;
}

export interface Item {
  itemId: string;
  name: string;
  basePrice: number;
  cost: number;
  category: string;
  stock: number;
  maxStock: number;
}

export class PriceOptimizationModel extends EventEmitter {
  private config: OptimizationConfig;
  private itemData: Map<string, Item> = new Map();
  private priceHistory: Map<string, PriceHistory[]> = new Map();

  constructor(config?: Partial<OptimizationConfig>) {
    super();
    this.config = {
      strategy: config?.strategy || 'moderate',
      minMargin: config?.minMargin || 0.1,
      maxDiscountPercent: config?.maxDiscountPercent || 30,
      priceFloor: config?.priceFloor,
      priceCeiling: config?.priceCeiling,
    };
  }

  /**
   * Optimize price for an item
   */
  async optimize(itemId: string, date: Date = new Date(), factors?: Partial<PriceFactors>): Promise<OptimizationResult> {
    try {
      const item = this.itemData.get(itemId);
      if (!item) {
        return { success: false, error: 'Item not found' };
      }

      // Calculate factors
      const priceFactors = this.calculateFactors(item, date, factors);

      // Calculate base optimization
      const optimization = this.calculateOptimalPrice(item, priceFactors);

      this.emit('optimizationComplete', optimization);

      return { success: true, optimization };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch optimize multiple items
   */
  async batchOptimize(items: Array<{ itemId: string; date?: Date }>): Promise<OptimizationResult[]> {
    return Promise.all(
      items.map(({ itemId, date }) => this.optimize(itemId, date || new Date()))
    );
  }

  /**
   * Record a sale for analytics
   */
  recordSale(itemId: string, price: number, date: Date = new Date()): void {
    const history = this.priceHistory.get(itemId) || [];
    const item = this.itemData.get(itemId);

    history.push({
      date: date.toISOString(),
      price,
      sales: 1,
      inventory: item?.stock || 0,
    });

    // Keep last 90 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    this.priceHistory.set(itemId, history.filter(h => new Date(h.date) > cutoff));
  }

  /**
   * Update item data
   */
  updateItem(item: Item): void {
    this.itemData.set(item.itemId, item);
  }

  /**
   * Get price history
   */
  getHistory(itemId: string): PriceHistory[] {
    return this.priceHistory.get(itemId) || [];
  }

  private calculateFactors(item: Item, date: Date, overrides?: Partial<PriceFactors>): PriceFactors {
    const hour = date.getHours();
    const dayOfWeek = date.getDay();
    const month = date.getMonth();

    // Time of day factor (higher during peak hours)
    const timeFactor = this.getTimeFactor(hour);

    // Day of week factor
    const dayFactor = this.getDayFactor(dayOfWeek);

    // Seasonality factor
    const seasonFactor = this.getSeasonalityFactor(month);

    // Get historical demand
    const demand = this.calculateHistoricalDemand(item.itemId);

    // Competition factor (would be from external API in production)
    const competition = overrides?.competition ?? 0.5;

    // Inventory factor (lower stock = can raise prices)
    const inventoryRatio = item.stock / (item.maxStock || item.stock * 2);
    const inventory = overrides?.inventory ?? Math.min(1, inventoryRatio);

    return {
      demand: overrides?.demand ?? demand,
      competition,
      inventory,
      seasonality: seasonFactor,
      customerSegment: overrides?.customerSegment ?? 'standard',
      timeOfDay: timeFactor,
      dayOfWeek: dayFactor,
    };
  }

  private calculateOptimalPrice(item: Item, factors: PriceFactors): PriceOptimization {
    const basePrice = item.basePrice;
    const cost = item.cost;
    const minMargin = this.config.minMargin;
    const maxDiscount = this.config.maxDiscountPercent / 100;

    // Strategy multipliers
    const strategyMultipliers = {
      aggressive: { demandBoost: 1.2, competitionBoost: 1.1 },
      moderate: { demandBoost: 1.0, competitionBoost: 1.0 },
      conservative: { demandBoost: 0.9, competitionBoost: 0.95 },
    };

    const { demandBoost, competitionBoost } = strategyMultipliers[this.config.strategy];

    // Calculate price factors
    let priceMultiplier = 1.0;

    // Demand impact (high demand = raise prices)
    priceMultiplier *= (1 + (factors.demand - 0.5) * demandBoost);

    // Competition impact (high competition = lower prices)
    priceMultiplier *= (1 - (factors.competition - 0.5) * 0.3 * competitionBoost);

    // Inventory impact (low stock = raise prices)
    if (factors.inventory < 0.3) {
      priceMultiplier *= 1.1;
    } else if (factors.inventory > 0.8) {
      priceMultiplier *= 0.95;
    }

    // Seasonality impact
    priceMultiplier *= factors.seasonality;

    // Time of day impact
    if (factors.timeOfDay) {
      priceMultiplier *= (0.9 + factors.timeOfDay * 0.2);
    }

    // Day of week impact
    if (factors.dayOfWeek) {
      priceMultiplier *= factors.dayOfWeek;
    }

    // Calculate optimized price
    let optimizedPrice = basePrice * priceMultiplier;

    // Apply constraints
    const minPrice = Math.max(cost * (1 + minMargin), basePrice * (1 - maxDiscount));
    const maxPrice = this.config.priceCeiling || basePrice * 1.5;

    optimizedPrice = Math.max(minPrice, Math.min(maxPrice, optimizedPrice));

    // Round to nearest 0.99
    optimizedPrice = Math.floor(optimizedPrice) + 0.99;

    return {
      originalPrice: basePrice,
      optimizedPrice,
      minPrice,
      maxPrice,
      confidence: this.calculateConfidence(factors),
      factors,
      reasoning: this.generateReasoning(factors, basePrice, optimizedPrice),
    };
  }

  private getTimeFactor(hour: number): number {
    // Peak hours: 11-14 (lunch), 18-21 (dinner)
    if (hour >= 11 && hour <= 14) return 0.9;
    if (hour >= 18 && hour <= 21) return 1.0;
    if (hour >= 6 && hour <= 10) return 0.7;
    return 0.5;
  }

  private getDayFactor(dayOfWeek: number): number {
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) return 1.1; // Weekend boost
    if (dayOfWeek === 5) return 1.05; // Friday boost
    return 1.0;
  }

  private getSeasonalityFactor(month: number): number {
    // Simplified seasonality (customize based on your business)
    const factors: Record<number, number> = {
      0: 0.9,   // January - post-holiday slump
      1: 0.85,  // February
      2: 0.9,   // March
      3: 1.0,   // April
      4: 1.0,   // May
      5: 1.1,   // June - summer starts
      6: 1.15,  // July - peak summer
      7: 1.1,   // August
      8: 1.0,   // September
      9: 1.05,  // October
      10: 1.1,  // November - pre-holiday
      11: 1.2,  // December - holiday peak
    };
    return factors[month] || 1.0;
  }

  private calculateHistoricalDemand(itemId: string): number {
    const history = this.priceHistory.get(itemId) || [];
    if (history.length === 0) return 0.5; // Default

    const recent = history.slice(-7); // Last 7 days
    const avgSales = recent.reduce((sum, h) => sum + h.sales, 0) / recent.length;

    // Normalize to 0-1
    return Math.min(1, avgSales / 10);
  }

  private calculateConfidence(factors: PriceFactors): number {
    let confidence = 0.6;

    if (factors.demand !== 0.5) confidence += 0.1;
    if (factors.competition !== 0.5) confidence += 0.1;
    if (factors.inventory !== 0.5) confidence += 0.1;
    if (factors.timeOfDay) confidence += 0.05;
    if (factors.dayOfWeek) confidence += 0.05;

    return Math.min(1, confidence);
  }

  private generateReasoning(factors: PriceFactors, original: number, optimized: number): string {
    const reasons: string[] = [];

    if (factors.demand > 0.6) {
      reasons.push('high demand');
    } else if (factors.demand < 0.4) {
      reasons.push('low demand');
    }

    if (factors.competition > 0.6) {
      reasons.push('competitive market');
    }

    if (factors.inventory < 0.3) {
      reasons.push('limited stock');
    }

    if (factors.seasonality > 1.1) {
      reasons.push('peak season');
    } else if (factors.seasonality < 0.9) {
      reasons.push('off-season');
    }

    const change = ((optimized - original) / original * 100).toFixed(1);
    const direction = optimized > original ? 'increase' : optimized < original ? 'decrease' : 'maintain';

    return `${direction} price by ${change}% due to ${reasons.join(', ') || 'market conditions'}`;
  }
}

export function createPriceOptimizationModel(config?: Partial<OptimizationConfig>): PriceOptimizationModel {
  return new PriceOptimizationModel(config);
}
