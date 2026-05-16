import {
  ReorderSuggestion,
  SafetyStockCalculation,
  ReorderPointCalculation,
  ProductMaster,
  DemandDataPoint,
  SupplierLeadTime,
} from '../types/inventory.types.js';
import {
  mean,
  standardDeviation,
  calculateSafetyStock,
  calculateReorderPoint,
  daysOfInventory,
  roundTo,
  zScore,
} from '../utils/math.js';
import { reorderLogger as logger } from '../utils/logger.js';
import config from '../config/index.js';
import { addDays, startOfDay, differenceInDays } from 'date-fns';

/**
 * Reorder Optimizer Service
 * Calculates optimal reorder points, quantities, and timing based on:
 * - Historical demand patterns
 * - Supplier lead times
 * - Service level requirements
 * - Safety stock calculations
 */

export class ReorderOptimizerService {
  private readonly safetyStockServiceLevel: number;
  private readonly reorderPointServiceLevel: number;

  constructor() {
    this.safetyStockServiceLevel = config.optimization.safetyStockServiceLevel;
    this.reorderPointServiceLevel = config.optimization.reorderPointServiceLevel;
  }

  /**
   * Get reorder suggestions for a SKU
   */
  async getReorderSuggestion(
    sku: string,
    options: {
      daysUntilStockout?: number;
      considerSeasonality?: boolean;
      serviceLevel?: number;
    } = {}
  ): Promise<ReorderSuggestion> {
    const {
      daysUntilStockout = 14,
      considerSeasonality = true,
      serviceLevel = this.reorderPointServiceLevel,
    } = options;

    logger.info(`Calculating reorder suggestion for SKU: ${sku}`, { daysUntilStockout, serviceLevel });

    // Get product info
    const product = await this.getProductInfo(sku);
    if (!product) {
      throw new Error(`Product not found: ${sku}`);
    }

    // Get demand forecast
    const demandForecast = await this.getDemandForecast(sku, daysUntilStockout + 30);

    // Get lead time data
    const leadTimeData = await this.getLeadTimeData(sku, product.supplierId);

    // Calculate metrics
    const averageDemand = mean(demandForecast.map((d) => d.quantity));
    const demandStdDev = standardDeviation(demandForecast.map((d) => d.quantity));
    const averageLeadTime = leadTimeData?.averageLeadTimeDays || product.leadTimeDays;
    const leadTimeStdDev = leadTimeData?.stdDeviation || averageLeadTime * 0.2;

    // Calculate safety stock
    const safetyStock = calculateSafetyStock(
      averageDemand,
      demandStdDev,
      averageLeadTime,
      leadTimeStdDev,
      serviceLevel
    );

    // Calculate reorder point
    const reorderPoint = calculateReorderPoint(averageDemand, averageLeadTime, safetyStock);

    // Calculate reorder quantity
    const reorderQuantity = this.calculateOptimalReorderQuantity(
      product,
      averageDemand * 365,
      demandStdDev
    );

    // Calculate days until stockout
    const currentStock = product.currentStock;
    const dailyDemand = averageDemand || demandForecast[0]?.quantity || 1;
    const stockoutDays = Math.floor(currentStock / dailyDemand);

    // Determine urgency
    const urgency = this.determineUrgency(
      currentStock,
      reorderPoint,
      averageLeadTime,
      dailyDemand
    );

    // Calculate estimated cost
    const estimatedCost = roundTo(reorderQuantity * product.unitCost, 2);

    // Calculate suggested order date
    const daysUntilReorder = Math.max(0, stockoutDays - averageLeadTime - Math.ceil(daysUntilStockout / 2));
    const suggestedOrderDate = addDays(new Date(), daysUntilReorder);

    logger.info('Reorder suggestion calculated', {
      sku,
      currentStock,
      reorderPoint,
      reorderQuantity,
      urgency,
      stockoutDays,
    });

    return {
      sku,
      currentStock,
      reorderPoint,
      reorderQuantity,
      safetyStock: roundTo(safetyStock, 2),
      daysUntilStockout: stockoutDays,
      suggestedOrderDate,
      urgency,
      confidence: this.calculateConfidence(averageDemand, demandStdDev, leadTimeData),
      supplierId: product.supplierId,
      estimatedCost,
      metAtDate: stockoutDays <= averageLeadTime ? new Date() : undefined,
    };
  }

  /**
   * Calculate safety stock for a SKU
   */
  async calculateSafetyStock(sku: string): Promise<SafetyStockCalculation> {
    const product = await this.getProductInfo(sku);
    if (!product) {
      throw new Error(`Product not found: ${sku}`);
    }

    const demandHistory = await this.getDemandHistory(sku, 90);
    const leadTimeData = await this.getLeadTimeData(sku, product.supplierId);

    const demands = demandHistory.map((d) => d.quantity);
    const averageDemand = mean(demands);
    const demandStdDev = standardDeviation(demands);

    const averageLeadTime = leadTimeData?.averageLeadTimeDays || product.leadTimeDays;
    const leadTimeStdDev = leadTimeData?.stdDeviation || averageLeadTime * 0.2;

    const z = zScore(this.safetyStockServiceLevel);

    const safetyStock = calculateSafetyStock(
      averageDemand,
      demandStdDev,
      averageLeadTime,
      leadTimeStdDev,
      this.safetyStockServiceLevel
    );

    logger.info('Safety stock calculated', {
      sku,
      safetyStock,
      averageDemand,
      demandStdDev,
      averageLeadTime,
    });

    return {
      sku,
      safetyStock: roundTo(safetyStock, 2),
      serviceLevel: this.safetyStockServiceLevel,
      averageDemand: roundTo(averageDemand, 4),
      demandStdDev: roundTo(demandStdDev, 4),
      leadTimeDays: roundTo(averageLeadTime, 2),
      leadTimeStdDev: roundTo(leadTimeStdDev, 2),
      zScore: z,
      formula: leadTimeStdDev > 0 ? 'extended' : 'standard',
    };
  }

  /**
   * Calculate reorder point for a SKU
   */
  async calculateReorderPoint(sku: string): Promise<ReorderPointCalculation> {
    const product = await this.getProductInfo(sku);
    if (!product) {
      throw new Error(`Product not found: ${sku}`);
    }

    const safetyStockResult = await this.calculateSafetyStock(sku);
    const leadTimeData = await this.getLeadTimeData(sku, product.supplierId);

    const averageLeadTime = leadTimeData?.averageLeadTimeDays || product.leadTimeDays;
    const averageLeadTimeDemand = safetyStockResult.averageDemand * averageLeadTime;

    const reorderPoint = calculateReorderPoint(
      safetyStockResult.averageDemand,
      averageLeadTime,
      safetyStockResult.safetyStock
    );

    const isAboveStock = product.currentStock > reorderPoint;

    logger.info('Reorder point calculated', {
      sku,
      reorderPoint,
      currentStock: product.currentStock,
      isAboveStock,
    });

    return {
      sku,
      reorderPoint,
      safetyStock: safetyStockResult.safetyStock,
      averageLeadTimeDemand: roundTo(averageLeadTimeDemand, 2),
      leadTimeDays: roundTo(averageLeadTime, 2),
      serviceLevel: this.reorderPointServiceLevel,
      isAboveStock,
    };
  }

  /**
   * Get all SKUs that need reordering
   */
  async getReorderAlerts(options: {
    storeId?: string;
    category?: string;
    urgency?: 'critical' | 'high' | 'medium' | 'low';
    limit?: number;
  } = {}): Promise<ReorderSuggestion[]> {
    const { limit = 100 } = options;

    logger.info('Getting reorder alerts', options);

    // Get products that are active and have stock below reorder point
    const { ProductMaster } = await import('../models/schemas.js');

    const query: Record<string, unknown> = { isActive: true };
    if (options.storeId) query.storeId = options.storeId;
    if (options.category) query.category = options.category;

    const products = await ProductMaster.find(query)
      .sort({ currentStock: 1 })
      .limit(limit * 2)
      .lean();

    const suggestions: ReorderSuggestion[] = [];

    for (const product of products) {
      try {
        const suggestion = await this.getReorderSuggestion(product.sku);

        if (options.urgency && suggestion.urgency !== options.urgency) {
          continue;
        }

        // Only include if stock is below reorder point
        if (suggestion.currentStock <= suggestion.reorderPoint) {
          suggestions.push(suggestion);
        }
      } catch (error) {
        logger.warn(`Failed to get reorder suggestion for ${product.sku}`, { error });
      }

      if (suggestions.length >= limit) break;
    }

    // Sort by urgency (critical first) then by days until stockout
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    suggestions.sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return a.daysUntilStockout - b.daysUntilStockout;
    });

    return suggestions.slice(0, limit);
  }

  /**
   * Calculate optimal reorder quantity using EOQ with adjustments
   */
  private calculateOptimalReorderQuantity(
    product: ProductMaster,
    annualDemand: number,
    demandStdDev: number
  ): number {
    const orderCost = config.optimization.orderCostPerOrder;
    const holdingCostPerUnit = product.unitCost * (config.optimization.holdingCostPercent / 100);

    // Base EOQ calculation
    let eoq = Math.sqrt((2 * annualDemand * orderCost) / holdingCostPerUnit);

    // Adjust for demand uncertainty (add buffer for high-variance items)
    const cv = demandStdDev / (annualDemand / 365); // Coefficient of variation
    if (cv > 0.5) {
      eoq *= 1.2; // Add 20% buffer for high uncertainty
    }

    // Ensure it's at least the minimum order quantity
    const optimalQty = Math.max(product.minimumOrderQuantity, Math.ceil(eoq));

    // Round to a convenient multiple
    const multiple = this.findConvenientMultiple(optimalQty);

    logger.debug('EOQ calculated', {
      sku: product.sku,
      annualDemand,
      eoq,
      optimalQty,
      finalQty: multiple,
    });

    return multiple;
  }

  /**
   * Find a convenient multiple for ordering (e.g., round to 5s, 10s, etc.)
   */
  private findConvenientMultiple(quantity: number): number {
    const multiples = [1, 5, 10, 12, 15, 20, 25, 50, 100];

    for (const m of multiples) {
      if (quantity <= m) return m;
      if (quantity % m === 0) return m;
    }

    return Math.ceil(quantity / 10) * 10;
  }

  /**
   * Determine urgency level
   */
  private determineUrgency(
    currentStock: number,
    reorderPoint: number,
    leadTime: number,
    dailyDemand: number
  ): 'critical' | 'high' | 'medium' | 'low' {
    if (currentStock <= 0) return 'critical';

    const daysOfStock = currentStock / dailyDemand;

    if (daysOfStock <= leadTime * 0.5) return 'critical';
    if (daysOfStock <= leadTime) return 'high';
    if (daysOfStock <= reorderPoint / dailyDemand) return 'medium';
    return 'low';
  }

  /**
   * Calculate confidence score for the suggestion
   */
  private calculateConfidence(
    averageDemand: number,
    demandStdDev: number,
    leadTimeData: SupplierLeadTime | null
  ): number {
    let confidence = 1.0;

    // Reduce confidence for high-variance demand
    const cv = demandStdDev / (averageDemand || 1);
    if (cv > 0.5) confidence -= 0.2;
    if (cv > 1.0) confidence -= 0.2;

    // Reduce confidence for uncertain lead times
    if (leadTimeData) {
      const leadTimeCV = leadTimeData.stdDeviation / (leadTimeData.averageLeadTimeDays || 1);
      if (leadTimeCV > 0.3) confidence -= 0.15;
      if (leadTimeCV > 0.5) confidence -= 0.15;

      // Reduce for low reliability
      if (leadTimeData.reliabilityScore < 80) confidence -= 0.1;
    }

    return roundTo(Math.max(0.3, Math.min(1.0, confidence)), 2);
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
    const startDate = addDays(new Date(), -days);

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
   * Get demand forecast from forecasting service
   */
  private async getDemandForecast(sku: string, horizon: number): Promise<DemandDataPoint[]> {
    // This would call the demand forecasting service
    // For now, return historical data as a proxy
    const history = await this.getDemandHistory(sku, horizon);
    return history.length > 0 ? history : [{ date: new Date(), quantity: 1 }];
  }

  /**
   * Get lead time data for a SKU from a supplier
   */
  private async getLeadTimeData(
    sku: string,
    supplierId: string
  ): Promise<SupplierLeadTime | null> {
    const { SupplierLeadTime } = await import('../models/schemas.js');
    return SupplierLeadTime.findOne({ supplierId, sku }).lean();
  }

  /**
   * Analyze supplier lead times for a specific supplier
   */
  async analyzeSupplierLeadTimes(supplierId: string): Promise<{
    averageLeadTime: number;
    reliability: number;
    seasonalPatterns: Array<{ month: number; avgDays: number }>;
    skus: string[];
  }> {
    const { SupplierLeadTime } = await import('../models/schemas.js');

    const leadTimeRecords = await SupplierLeadTime.find({ supplierId }).lean();

    if (leadTimeRecords.length === 0) {
      throw new Error(`No lead time data found for supplier: ${supplierId}`);
    }

    const avgLeadTime =
      leadTimeRecords.reduce((acc, r) => acc + r.averageLeadTimeDays, 0) / leadTimeRecords.length;

    const reliability =
      leadTimeRecords.reduce((acc, r) => acc + r.reliabilityScore, 0) / leadTimeRecords.length;

    // Aggregate seasonal patterns
    const seasonalByMonth: Record<number, number[]> = {};
    for (const record of leadTimeRecords) {
      for (const pattern of record.seasonalPatterns || []) {
        if (!seasonalByMonth[pattern.month]) {
          seasonalByMonth[pattern.month] = [];
        }
        seasonalByMonth[pattern.month].push(pattern.averageLeadTimeDays);
      }
    }

    const seasonalPatterns = Object.entries(seasonalByMonth).map(([month, values]) => ({
      month: parseInt(month),
      avgDays: mean(values),
    }));

    const skus = leadTimeRecords.map((r) => r.sku);

    return {
      averageLeadTime: roundTo(avgLeadTime, 2),
      reliability: roundTo(reliability, 2),
      seasonalPatterns,
      skus,
    };
  }

  /**
   * Get lead times for all SKUs from a specific supplier
   */
  async getSupplierLeadTimes(supplierId: string): Promise<SupplierLeadTime[]> {
    const { SupplierLeadTime } = await import('../models/schemas.js');

    const leadTimes = await SupplierLeadTime.find({ supplierId })
      .sort({ averageLeadTimeDays: -1 })
      .lean();

    return leadTimes;
  }
}

// Export singleton instance
export const reorderOptimizerService = new ReorderOptimizerService();
export default reorderOptimizerService;
