import {
  StockOptimization,
  InventoryTurnAnalysis,
  ABCAnalysisResult,
  ABCClassificationItem,
  ABCClassification,
  ABCSummary,
  ProductMaster,
  DemandDataPoint,
} from '../types/inventory.types.js';
import {
  mean,
  standardDeviation,
  calculateInventoryTurnover,
  daysOfInventory,
  calculateEOQ,
  roundTo,
  clamp,
} from '../utils/math.js';
import { optimizationLogger as logger } from '../utils/logger.js';
import config from '../config/index.js';
import { subDays, startOfDay } from 'date-fns';

/**
 * Stock Optimizer Service
 * Provides stock level optimization, ABC analysis, and inventory turn rate analysis
 */

export class StockOptimizerService {
  private readonly targetTurnsPerYear: number;
  private readonly holdingCostPercent: number;
  private readonly orderCost: number;

  constructor() {
    this.targetTurnsPerYear = config.optimization.targetTurnsPerYear;
    this.holdingCostPercent = config.optimization.holdingCostPercent;
    this.orderCost = config.optimization.orderCostPerOrder;
  }

  /**
   * Get stock optimization recommendations for a SKU
   */
  async optimizeStock(
    sku: string,
    options: {
      targetTurnsPerYear?: number;
      holdingCostPercent?: number;
    } = {}
  ): Promise<StockOptimization> {
    const {
      targetTurnsPerYear = this.targetTurnsPerYear,
      holdingCostPercent = this.holdingCostPercent,
    } = options;

    logger.info(`Optimizing stock for SKU: ${sku}`, { targetTurnsPerYear, holdingCostPercent });

    // Get product info
    const product = await this.getProductInfo(sku);
    if (!product) {
      throw new Error(`Product not found: ${sku}`);
    }

    // Get demand history
    const demandHistory = await this.getDemandHistory(sku, 90);
    const demands = demandHistory.map((d) => d.quantity);

    // Calculate metrics
    const averageDailyDemand = mean(demands);
    const annualDemand = averageDailyDemand * 365;
    const demandStdDev = standardDeviation(demands);

    // Current inventory metrics
    const currentTurnsPerYear = calculateInventoryTurnover(
      annualDemand * product.unitCost,
      product.currentStock * product.unitCost
    );

    // Calculate EOQ
    const holdingCostPerUnit = product.unitCost * (holdingCostPercent / 100);
    const eoq = calculateEOQ(annualDemand, this.orderCost, holdingCostPerUnit);

    // Calculate target stock levels
    const daysOfCover = Math.ceil(365 / targetTurnsPerYear);
    const targetStock = Math.max(eoq, averageDailyDemand * daysOfCover);

    // Calculate min/max bounds
    const safetyStockFactor = 1.5; // Buffer above safety stock
    const minStock = Math.max(product.safetyStock * safetyStockFactor, product.minimumOrderQuantity);
    const maxStock = targetStock * 1.5;

    // Calculate optimized stock
    const optimizedStock = clamp(
      Math.round(targetStock),
      Math.ceil(minStock),
      Math.floor(maxStock)
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      product,
      currentTurnsPerYear,
      targetTurnsPerYear,
      product.currentStock,
      optimizedStock,
      averageDailyDemand
    );

    logger.info('Stock optimization completed', {
      sku,
      currentStock: product.currentStock,
      optimizedStock,
      currentTurnsPerYear,
      targetTurnsPerYear,
    });

    return {
      sku,
      currentStock: product.currentStock,
      optimizedStock,
      targetStock: roundTo(targetStock, 2),
      minStock: Math.ceil(minStock),
      maxStock: Math.floor(maxStock),
      economicOrderQuantity: eoq,
      currentTurnsPerYear: roundTo(currentTurnsPerYear, 2),
      targetTurnsPerYear,
      holdingCostPerUnit: roundTo(holdingCostPerUnit, 2),
      orderCostPerOrder: this.orderCost,
      recommendations,
    };
  }

  /**
   * Perform ABC analysis on inventory
   */
  async performABCAnalysis(options: {
    category?: string;
    storeId?: string;
    limit?: number;
  } = {}): Promise<ABCAnalysisResult> {
    const { category, storeId, limit = 1000 } = options;

    logger.info('Performing ABC analysis', options);

    // Get all active products
    const { ProductMaster } = await import('../models/schemas.js');

    const query: Record<string, unknown> = { isActive: true };
    if (category) query.category = category;
    if (storeId) query.storeId = storeId;

    const products = await ProductMaster.find(query).lean();

    // Calculate annual value for each product
    const productValues: Array<{
      product: ProductMaster;
      annualDemand: number;
      annualValue: number;
    }> = [];

    for (const product of products) {
      const demandHistory = await this.getDemandHistory(product.sku, 365);
      const annualDemand = demandHistory.reduce((acc, d) => acc + d.quantity, 0);
      const annualValue = annualDemand * product.unitCost;

      if (annualValue > 0) {
        productValues.push({ product, annualDemand, annualValue });
      }
    }

    // Sort by annual value (descending)
    productValues.sort((a, b) => b.annualValue - a.annualValue);

    // Calculate cumulative values and assign classifications
    let cumulativeValue = 0;
    const totalValue = productValues.reduce((acc, p) => acc + p.annualValue, 0);

    const classifications: ABCClassificationItem[] = productValues.map((item) => {
      cumulativeValue += item.annualValue;
      const cumulativePercentage = (cumulativeValue / totalValue) * 100;

      // Class A: 0-80% of value (~20% of items)
      // Class B: 80-95% of value (~30% of items)
      // Class C: 95-100% of value (~50% of items)
      let classification: ABCClassification;
      let velocity: 'fast' | 'medium' | 'slow';
      let suggestedFrequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly';

      if (cumulativePercentage <= 80 || item.product.category === 'A') {
        classification = ABCClassification.A;
        velocity = 'fast';
        suggestedFrequency = 'weekly';
      } else if (cumulativePercentage <= 95 || item.product.category === 'B') {
        classification = ABCClassification.B;
        velocity = 'medium';
        suggestedFrequency = 'bi-weekly';
      } else {
        classification = ABCClassification.C;
        velocity = 'slow';
        suggestedFrequency = item.annualDemand > 0 ? 'monthly' : 'quarterly';
      }

      // Calculate turn rate
      const averageInventory = item.product.currentStock || 1;
      const turnRate = calculateInventoryTurnover(
        item.annualDemand * item.product.unitCost,
        averageInventory * item.product.unitCost
      );

      return {
        sku: item.product.sku,
        category: item.product.category,
        annualDemand: item.annualDemand,
        unitCost: item.product.unitCost,
        annualValue: roundTo(item.annualValue, 2),
        cumulativeValue: roundTo(cumulativeValue, 2),
        cumulativePercentage: roundTo(cumulativePercentage, 2),
        classification,
        velocity,
        suggestedReorderFrequency: suggestedFrequency,
        turnRate: roundTo(turnRate, 2),
      };
    });

    // Calculate summary statistics
    const classA = classifications.filter((c) => c.classification === ABCClassification.A);
    const classB = classifications.filter((c) => c.classification === ABCClassification.B);
    const classC = classifications.filter((c) => c.classification === ABCClassification.C);

    const summary: ABCSummary = {
      totalSkus: classifications.length,
      totalValue: roundTo(totalValue, 2),
      classACount: classA.length,
      classACoverage: roundTo((classA.length / classifications.length) * 100, 2),
      classAValue: roundTo(classA.reduce((acc, c) => acc + c.annualValue, 0), 2),
      classBCount: classB.length,
      classBCoverage: roundTo((classB.length / classifications.length) * 100, 2),
      classBValue: roundTo(classB.reduce((acc, c) => acc + c.annualValue, 0), 2),
      classCCount: classC.length,
      classCCoverage: roundTo((classC.length / classifications.length) * 100, 2),
      classCValue: roundTo(classC.reduce((acc, c) => acc + c.annualValue, 0), 2),
    };

    // Get fast and slow movers
    const fastMovers = classifications
      .filter((c) => c.velocity === 'fast')
      .sort((a, b) => b.turnRate - a.turnRate)
      .slice(0, 100);

    const slowMovers = classifications
      .filter((c) => c.velocity === 'slow')
      .sort((a, b) => a.daysOnHand - b.daysOnHand)
      .slice(0, 100);

    logger.info('ABC analysis completed', {
      totalSkus: classifications.length,
      classACount: classA.length,
      classBCount: classB.length,
      classCCount: classC.length,
    });

    return {
      classifications: classifications.slice(0, limit),
      summary,
      fastMovers,
      slowMovers,
      generatedAt: new Date(),
    };
  }

  /**
   * Analyze inventory turn rate for a SKU
   */
  async analyzeInventoryTurn(sku: string): Promise<InventoryTurnAnalysis> {
    logger.info(`Analyzing inventory turn for SKU: ${sku}`);

    // Get product info
    const product = await this.getProductInfo(sku);
    if (!product) {
      throw new Error(`Product not found: ${sku}`);
    }

    // Get demand history
    const demandHistory = await this.getDemandHistory(sku, 365);
    const annualDemand = demandHistory.reduce((acc, d) => acc + d.quantity, 0);
    const annualCOGS = annualDemand * product.unitCost;

    // Calculate metrics
    const averageInventory = product.currentStock || 1;
    const currentTurnsPerYear = calculateInventoryTurnover(annualCOGS, averageInventory * product.unitCost);
    const daysOnHand = daysOfInventory(product.currentStock, annualDemand / 365);

    // Generate age buckets
    const ageBuckets = this.calculateAgeBuckets(product, demandHistory);

    // Calculate health score (0-100)
    const healthScore = this.calculateHealthScore(
      currentTurnsPerYear,
      this.targetTurnsPerYear,
      daysOnHand,
      ageBuckets
    );

    // Generate recommendations
    const recommendations = this.generateTurnRecommendations(
      product,
      currentTurnsPerYear,
      this.targetTurnsPerYear,
      daysOnHand,
      ageBuckets
    );

    logger.info('Inventory turn analysis completed', {
      sku,
      currentTurnsPerYear,
      targetTurnsPerYear: this.targetTurnsPerYear,
      healthScore,
    });

    return {
      sku,
      currentTurnsPerYear: roundTo(currentTurnsPerYear, 2),
      targetTurnsPerYear: this.targetTurnsPerYear,
      averageInventory: roundTo(averageInventory, 2),
      costOfGoodsSold: roundTo(annualCOGS, 2),
      daysOnHand: roundTo(daysOnHand, 1),
      ageOfInventory: ageBuckets,
      recommendations,
      healthScore,
    };
  }

  /**
   * Calculate inventory age buckets
   */
  private calculateAgeBuckets(
    product: ProductMaster,
    demandHistory: DemandDataPoint[]
  ): Array<{ range: string; quantity: number; percentage: number; value: number }> {
    // For demonstration, create age buckets based on turnover
    const currentStock = product.currentStock;
    const annualDemand = demandHistory.reduce((acc, d) => acc + d.quantity, 0);

    if (currentStock === 0 || annualDemand === 0) {
      return [
        { range: '0-30 days', quantity: 0, percentage: 0, value: 0 },
        { range: '31-60 days', quantity: 0, percentage: 0, value: 0 },
        { range: '61-90 days', quantity: 0, percentage: 0, value: 0 },
        { range: '90+ days', quantity: 0, percentage: 0, value: 0 },
      ];
    }

    // Estimate age distribution based on demand patterns
    const avgDaysOfStock = currentStock / (annualDemand / 365);
    const dailyConsumption = annualDemand / 365;

    // Create realistic distribution
    const buckets = [
      { range: '0-30 days', percentage: Math.min(0.5, dailyConsumption * 30 / currentStock) },
      { range: '31-60 days', percentage: Math.min(0.3, dailyConsumption * 30 / currentStock * 0.8) },
      { range: '61-90 days', percentage: Math.min(0.15, dailyConsumption * 30 / currentStock * 0.5) },
      { range: '90+ days', percentage: 0.05 },
    ];

    // Normalize to sum to 1
    const total = buckets.reduce((acc, b) => acc + b.percentage, 0);
    const normalizedBuckets = buckets.map((b) => ({
      ...b,
      percentage: b.percentage / total,
    }));

    return normalizedBuckets.map((b) => ({
      range: b.range,
      quantity: Math.round(currentStock * b.percentage),
      percentage: roundTo(b.percentage * 100, 2),
      value: roundTo(currentStock * b.percentage * product.unitCost, 2),
    }));
  }

  /**
   * Calculate inventory health score
   */
  private calculateHealthScore(
    currentTurns: number,
    targetTurns: number,
    daysOnHand: number,
    ageBuckets: Array<{ range: string; percentage: number }>
  ): number {
    let score = 100;

    // Turn rate scoring (40% weight)
    const turnRatio = currentTurns / targetTurns;
    if (turnRatio < 0.5) score -= 30;
    else if (turnRatio < 0.8) score -= 15;
    else if (turnRatio > 1.5) score -= 10;
    else if (turnRatio > 2.0) score -= 5;

    // Days on hand scoring (30% weight)
    const idealDaysOnHand = 365 / targetTurns;
    const daysDeviation = Math.abs(daysOnHand - idealDaysOnHand) / idealDaysOnHand;
    if (daysDeviation > 1) score -= 20;
    else if (daysDeviation > 0.5) score -= 10;

    // Age distribution scoring (30% weight)
    const oldStockPercentage =
      (ageBuckets.find((b) => b.range === '90+ days')?.percentage || 0) +
      (ageBuckets.find((b) => b.range === '61-90 days')?.percentage || 0);

    if (oldStockPercentage > 0.3) score -= 25;
    else if (oldStockPercentage > 0.15) score -= 15;
    else if (oldStockPercentage > 0.05) score -= 5;

    return roundTo(Math.max(0, Math.min(100, score)), 0);
  }

  /**
   * Generate recommendations for stock optimization
   */
  private generateRecommendations(
    product: ProductMaster,
    currentTurns: number,
    targetTurns: number,
    currentStock: number,
    optimizedStock: number,
    avgDailyDemand: number
  ): string[] {
    const recommendations: string[] = [];

    // Stock level recommendations
    if (currentStock > optimizedStock * 1.2) {
      recommendations.push(
        `Overstocked by ${roundTo(currentStock - optimizedStock, 0)} units. Consider promotional campaigns to reduce inventory.`
      );
    } else if (currentStock < optimizedStock * 0.8) {
      recommendations.push(
        `Stock level is ${roundTo(optimizedStock - currentStock, 0)} units below optimal. Plan replenishment.`
      );
    }

    // Turn rate recommendations
    if (currentTurns < targetTurns * 0.7) {
      recommendations.push(
        `Inventory turn rate is below target. Reduce order quantities or increase demand through promotions.`
      );
    } else if (currentTurns > targetTurns * 1.3) {
      recommendations.push(
        `Inventory turn rate is above target. Consider increasing order quantities to reduce ordering frequency.`
      );
    }

    // Safety stock recommendations
    if (product.safetyStock === 0 && avgDailyDemand > 0) {
      recommendations.push('Consider setting a safety stock level to prevent stockouts.');
    }

    // MOQ recommendations
    if (product.minimumOrderQuantity > optimizedStock * 0.3) {
      recommendations.push(
        `Minimum order quantity (${product.minimumOrderQuantity}) may be too high for optimal stock levels.`
      );
    }

    return recommendations;
  }

  /**
   * Generate recommendations for inventory turn improvement
   */
  private generateTurnRecommendations(
    product: ProductMaster,
    currentTurns: number,
    targetTurns: number,
    daysOnHand: number,
    ageBuckets: Array<{ range: string; percentage: number }>
  ): string[] {
    const recommendations: string[] = [];

    const turnRatio = currentTurns / targetTurns;
    const idealDays = 365 / targetTurns;

    if (turnRatio < 0.5) {
      recommendations.push(
        'Critical: Inventory turns are very low. Consider liquidation sales, bundle deals, or returns to supplier.'
      );
    } else if (turnRatio < 0.8) {
      recommendations.push(
        'Inventory turns below target. Reduce order frequency or negotiate better pricing for larger orders.'
      );
    }

    if (daysOnHand > idealDays * 2) {
      recommendations.push(
        `Days of inventory (${roundTo(daysOnHand, 0)}) is significantly higher than ideal (${Math.round(idealDays)}).`
      );
    }

    // Age-based recommendations
    const oldStock = ageBuckets.find((b) => b.range === '90+ days')?.percentage || 0;
    if (oldStock > 0.1) {
      recommendations.push(
        ` ${roundTo(oldStock * 100, 1)}% of stock is over 90 days old. Consider markdown pricing or clearance.`
      );
    }

    // Product-specific recommendations
    if (product.status === 'overstocked') {
      recommendations.push('Product is marked as overstocked. Prioritize demand generation activities.');
    }

    return recommendations;
  }

  /**
   * Get product info from database
   */
  private async getProductInfo(sku: string): Promise<ProductMaster | null> {
    const { ProductMaster } = await import('../models/schemas.js');
    return ProductMaster.findOne({ sku, isActive: true }).lean();
  }

  /**
   * Get demand history from database
   */
  private async getDemandHistory(sku: string, days: number): Promise<DemandDataPoint[]> {
    const { DemandData } = await import('../models/schemas.js');
    const startDate = subDays(new Date(), days);

    const records = await DemandData.find({
      sku,
      date: { $gte: startDate },
    })
      .sort({ date: 1 })
      .lean();

    return records.map((r) => ({
      date: r.date,
      quantity: r.totalQuantity,
      revenue: r.totalRevenue,
    }));
  }

  /**
   * Get optimization recommendations for all SKUs below target turn rate
   */
  async getUnderperformingSKUs(limit: number = 50): Promise<
    Array<{
      sku: string;
      currentTurns: number;
      targetTurns: number;
      daysOnHand: number;
      healthScore: number;
    }>
  > {
    logger.info('Finding underperforming SKUs');

    const { ProductMaster } = await import('../models/schemas.js');

    const products = await ProductMaster.find({ isActive: true })
      .select('sku currentStock unitCost')
      .limit(limit * 2)
      .lean();

    const results: Array<{
      sku: string;
      currentTurns: number;
      targetTurns: number;
      daysOnHand: number;
      healthScore: number;
    }> = [];

    for (const product of products) {
      try {
        const analysis = await this.analyzeInventoryTurn(product.sku);

        // Only include if below target
        if (analysis.currentTurnsPerYear < this.targetTurnsPerYear * 0.8) {
          results.push({
            sku: product.sku,
            currentTurns: analysis.currentTurnsPerYear,
            targetTurns: analysis.targetTurnsPerYear,
            daysOnHand: analysis.daysOnHand,
            healthScore: analysis.healthScore,
          });
        }
      } catch (error) {
        logger.warn(`Failed to analyze SKU: ${product.sku}`, { error });
      }

      if (results.length >= limit) break;
    }

    // Sort by health score (worst first)
    results.sort((a, b) => a.healthScore - b.healthScore);

    return results;
  }
}

// Export singleton instance
export const stockOptimizerService = new StockOptimizerService();
export default stockOptimizerService;
