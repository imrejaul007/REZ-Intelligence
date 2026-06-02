/**
 * Inventory Analyzer Service
 * Analyzes inventory levels, expiry dates, and provides optimization insights
 */

import {
  InventoryContext,
  BaseProduct,
  MerchantRecommendation,
} from '../types/index.js';

interface InventoryData {
  productId: string;
  currentStock: number;
  maxStock: number;
  reorderPoint: number;
  safetyStock: number;
  dailySalesRate: number;
  daysUntilExpiry: number | null;
  supplierLeadDays: number;
  lastRestockedDate: Date;
  warehouseLocation?: string;
}

interface InventoryAlert {
  id: string;
  productId: string;
  productName: string;
  type: 'critical_low' | 'low' | 'overstock' | 'expiring_soon' | 'expiring_critical';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  currentValue: number;
  thresholdValue: number;
  createdAt: Date;
}

interface InventoryMetrics {
  totalProducts: number;
  totalStockValue: number;
  averageTurnoverDays: number;
  lowStockCount: number;
  overstockCount: number;
  expiringCount: number;
  outOfStockCount: number;
  atRiskValue: number; // Value of inventory at risk (expiring/overstock)
}

interface InventoryAnalysisResult {
  context: InventoryContext;
  metrics: {
    turnoverRate: number;
    daysOfSupply: number;
    stockVelocity: 'fast' | 'normal' | 'slow';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    suggestedReorderQuantity: number;
    suggestedReorderDate: Date | null;
  };
  alerts: InventoryAlert[];
  productBasePrice: number;
}

const DEFAULT_CONFIG = {
  expiryThresholdDays: 7,
  criticalExpiryThresholdDays: 3,
  overstockThresholdDays: 30,
  lowStockThresholdPercent: 20,
  criticalStockThresholdPercent: 10,
  excessStockThresholdDays: 45,
};

export class InventoryAnalyzer {
  private inventoryData: Map<string, InventoryData>;
  private config: typeof DEFAULT_CONFIG;

  constructor(config: Partial<typeof DEFAULT_CONFIG> = {}) {
    this.inventoryData = new Map();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get complete inventory context for pricing decisions
   */
  async getInventoryContext(product: BaseProduct): Promise<InventoryContext> {
    const data = this.getInventoryData(product.id);

    const stockPercentage = data.maxStock > 0
      ? (data.currentStock / data.maxStock) * 100
      : 0;

    return {
      stockLevel: data.currentStock,
      maxStock: data.maxStock,
      stockPercentage,
      daysUntilExpiry: data.daysUntilExpiry,
      expiryThresholdDays: this.config.expiryThresholdDays,
      overstockThresholdDays: this.config.overstockThresholdDays,
      reorderPoint: data.reorderPoint,
    };
  }

  /**
   * Analyze inventory and provide detailed insights
   */
  async analyzeInventory(product: BaseProduct): Promise<InventoryAnalysisResult> {
    const data = this.getInventoryData(product.id);
    const context = await this.getInventoryContext(product);
    const alerts = this.generateAlerts(product, data);

    // Calculate days of supply
    const daysOfSupply = data.dailySalesRate > 0
      ? data.currentStock / data.dailySalesRate
      : Infinity;

    // Calculate turnover rate (times per month)
    const monthlyDemand = data.dailySalesRate * 30;
    const turnoverRate = monthlyDemand > 0 ? data.currentStock / monthlyDemand : 0;

    // Determine stock velocity
    let stockVelocity: 'fast' | 'normal' | 'slow';
    if (daysOfSupply < 7) stockVelocity = 'fast';
    else if (daysOfSupply < 21) stockVelocity = 'normal';
    else stockVelocity = 'slow';

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (data.daysUntilExpiry !== null && data.daysUntilExpiry <= this.config.criticalExpiryThresholdDays) {
      riskLevel = 'critical';
    } else if (data.daysUntilExpiry !== null && data.daysUntilExpiry <= this.config.expiryThresholdDays) {
      riskLevel = 'high';
    } else if (context.stockPercentage < this.config.criticalStockThresholdPercent) {
      riskLevel = 'critical';
    } else if (context.stockPercentage < this.config.lowStockThresholdPercent) {
      riskLevel = 'high';
    } else if (daysOfSupply > this.config.excessStockThresholdDays) {
      riskLevel = 'high';
    } else if (daysOfSupply > this.config.overstockThresholdDays) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    // Calculate suggested reorder quantity
    const suggestedReorderQuantity = this.calculateReorderQuantity(data);

    // Calculate suggested reorder date
    const suggestedReorderDate = this.calculateReorderDate(data, suggestedReorderQuantity);

    return {
      context,
      metrics: {
        turnoverRate,
        daysOfSupply: Math.round(daysOfSupply * 10) / 10,
        stockVelocity,
        riskLevel,
        suggestedReorderQuantity,
        suggestedReorderDate,
      },
      alerts,
      productBasePrice: product.basePrice,
    };
  }

  /**
   * Get inventory recommendations
   */
  async getRecommendations(product: BaseProduct): Promise<MerchantRecommendation[]> {
    const analysis = await this.analyzeInventory(product);
    const recommendations: MerchantRecommendation[] = [];

    // Expiring soon recommendation
    if (analysis.context.daysUntilExpiry !== null) {
      const potentialLoss = analysis.context.stockLevel * analysis.productBasePrice * 0.4;
      if (analysis.context.daysUntilExpiry <= this.config.criticalExpiryThresholdDays) {
        recommendations.push({
          id: `exp-crit-${product.id}`,
          type: 'discount',
          title: 'Critical Expiry - Urgent Discount Required',
          description: `This product expires in ${analysis.context.daysUntilExpiry} day(s). Apply maximum discount to clear inventory before expiry.`,
          potentialImpact: {
            revenueChange: -potentialLoss,
            marginImpact: -0.15,
            unitsAffected: analysis.context.stockLevel,
          },
          priority: 'high',
          confidence: 0.95,
          actionItems: [
            'Apply 40%+ discount immediately',
            'Move to prominent display location',
            'Consider bundling with high-margin items',
            'Alert staff for priority selling',
          ],
          estimatedCompletionDays: analysis.context.daysUntilExpiry,
        });
      } else if (analysis.context.daysUntilExpiry <= this.config.expiryThresholdDays) {
        recommendations.push({
          id: `exp-soon-${product.id}`,
          type: 'discount',
          title: 'Expiring Soon - Gradual Discount',
          description: `This product expires in ${analysis.context.daysUntilExpiry} day(s). Start with moderate discount to optimize revenue.`,
          potentialImpact: {
            revenueChange: -potentialLoss * 0.6,
            marginImpact: -0.08,
            unitsAffected: analysis.context.stockLevel,
          },
          priority: 'high',
          confidence: 0.90,
          actionItems: [
            'Apply 25% discount today',
            'Increase to 40% if sales remain slow',
            'Consider promotional bundle',
            'Review receiving schedule with supplier',
          ],
          estimatedCompletionDays: analysis.context.daysUntilExpiry,
        });
      }
    }

    // Overstock recommendation
    if (analysis.metrics.daysOfSupply > this.config.overstockThresholdDays) {
      const overstockDays = analysis.metrics.daysOfSupply - this.config.overstockThresholdDays;
      const promotionRevenue = analysis.context.stockLevel * analysis.productBasePrice * 0.15;
      recommendations.push({
        id: `overstock-${product.id}`,
        type: 'promotion',
        title: 'Overstock Situation',
        description: `Current stock covers ${Math.round(analysis.metrics.daysOfSupply)} days. Consider promotions to reduce excess inventory.`,
        potentialImpact: {
          revenueChange: promotionRevenue,
          marginImpact: -0.05,
          unitsAffected: Math.floor(analysis.context.stockLevel * 0.3),
        },
        priority: 'medium',
        confidence: 0.85,
        actionItems: [
          'Create volume discount promotion',
          'Bundle with complementary products',
          'Consider markdown strategy',
          'Review future ordering with supplier',
        ],
        estimatedCompletionDays: Math.min(overstockDays, 30),
      });
    }

    // Low stock recommendation
    if (analysis.context.stockPercentage < this.config.lowStockThresholdPercent) {
      recommendations.push({
        id: `low-stock-${product.id}`,
        type: 'restock',
        title: analysis.context.stockPercentage < this.config.criticalStockThresholdPercent
          ? 'Critical Stock Level'
          : 'Low Stock Warning',
        description: `Current stock at ${analysis.context.stockPercentage.toFixed(0)}% capacity (${analysis.context.stockLevel} units). Reorder recommended.`,
        potentialImpact: {
          revenueChange: 0,
          marginImpact: 0,
          unitsAffected: analysis.metrics.suggestedReorderQuantity,
        },
        priority: analysis.context.stockPercentage < this.config.criticalStockThresholdPercent
          ? 'high'
          : 'medium',
        confidence: 0.90,
        actionItems: [
          `Place order for ${analysis.metrics.suggestedReorderQuantity} units`,
          analysis.metrics.suggestedReorderDate
            ? `Order by ${analysis.metrics.suggestedReorderDate.toLocaleDateString()}`
            : 'Place order immediately',
          `Supplier lead time: ${this.getInventoryData(product.id).supplierLeadDays} days`,
          'Consider increasing safety stock',
        ],
        estimatedCompletionDays: this.getInventoryData(product.id).supplierLeadDays,
      });
    }

    // Scarcity premium recommendation
    if (analysis.context.stockPercentage < 10 && analysis.context.stockPercentage >= 1) {
      recommendations.push({
        id: `scarcity-${product.id}`,
        type: 'marketing',
        title: 'Scarcity Opportunity',
        description: 'Limited stock available. Consider premium pricing to maximize revenue from remaining inventory.',
        potentialImpact: {
          revenueChange: analysis.context.stockLevel * product.basePrice * 0.10,
          marginImpact: 0.10,
          unitsAffected: analysis.context.stockLevel,
        },
        priority: 'medium',
        confidence: 0.80,
        actionItems: [
          'Apply 10% price premium',
          'Highlight limited availability',
          'Monitor competitor pricing',
          'Track sell-through rate',
        ],
        estimatedCompletionDays: Math.ceil(analysis.metrics.daysOfSupply),
      });
    }

    return recommendations;
  }

  /**
   * Update inventory data
   */
  updateInventory(productId: string, data: Partial<InventoryData>): void {
    const existing = this.inventoryData.get(productId);
    if (existing) {
      this.inventoryData.set(productId, { ...existing, ...data });
    } else {
      this.inventoryData.set(productId, {
        productId,
        currentStock: 0,
        maxStock: 100,
        reorderPoint: 20,
        safetyStock: 10,
        dailySalesRate: 5,
        daysUntilExpiry: null,
        supplierLeadDays: 7,
        lastRestockedDate: new Date(),
        ...data,
      });
    }
  }

  /**
   * Get inventory metrics for dashboard
   */
  async getMetrics(): Promise<InventoryMetrics> {
    const allData = Array.from(this.inventoryData.values());

    let totalStockValue = 0;
    let lowStockCount = 0;
    let overstockCount = 0;
    let expiringCount = 0;
    let outOfStockCount = 0;
    let atRiskValue = 0;

    for (const data of allData) {
      // Estimate value (would come from product data in real implementation)
      const unitValue = 10; // Placeholder
      totalStockValue += data.currentStock * unitValue;

      // Stock level analysis
      const stockPercent = (data.currentStock / data.maxStock) * 100;
      if (data.currentStock === 0) outOfStockCount++;
      else if (stockPercent < this.config.lowStockThresholdPercent) lowStockCount++;
      else if (data.dailySalesRate > 0 && data.currentStock / data.dailySalesRate > this.config.excessStockThresholdDays) {
        overstockCount++;
        atRiskValue += data.currentStock * unitValue;
      }

      // Expiry analysis
      if (data.daysUntilExpiry !== null && data.daysUntilExpiry <= this.config.expiryThresholdDays) {
        expiringCount++;
        atRiskValue += data.currentStock * unitValue * 0.5; // 50% risk
      }
    }

    // Calculate average turnover
    const turnoverRates = allData
      .filter(d => d.dailySalesRate > 0)
      .map(d => d.currentStock / (d.dailySalesRate * 30));
    const averageTurnoverDays = turnoverRates.length > 0
      ? turnoverRates.reduce((a, b) => a + b, 0) / turnoverRates.length * 30
      : 0;

    return {
      totalProducts: allData.length,
      totalStockValue,
      averageTurnoverDays: Math.round(averageTurnoverDays * 10) / 10,
      lowStockCount,
      overstockCount,
      expiringCount,
      outOfStockCount,
      atRiskValue,
    };
  }

  /**
   * Get inventory data
   */
  private getInventoryData(productId: string): InventoryData {
    return this.inventoryData.get(productId) || this.generateMockInventory(productId);
  }

  /**
   * Generate alerts based on inventory status
   */
  private generateAlerts(product: BaseProduct, data: InventoryData): InventoryAlert[] {
    const alerts: InventoryAlert[] = [];
    const stockPercent = (data.currentStock / data.maxStock) * 100;

    // Out of stock
    if (data.currentStock === 0) {
      alerts.push({
        id: `oos-${product.id}`,
        productId: product.id,
        productName: product.name,
        type: 'critical_low',
        severity: 'critical',
        message: `${product.name} is out of stock. Immediate reorder required.`,
        currentValue: 0,
        thresholdValue: data.reorderPoint,
        createdAt: new Date(),
      });
    }
    // Critical low
    else if (stockPercent < this.config.criticalStockThresholdPercent) {
      alerts.push({
        id: `crit-${product.id}`,
        productId: product.id,
        productName: product.name,
        type: 'critical_low',
        severity: 'critical',
        message: `${product.name} stock critically low (${stockPercent.toFixed(0)}%). Reorder immediately.`,
        currentValue: data.currentStock,
        thresholdValue: data.reorderPoint * 0.5,
        createdAt: new Date(),
      });
    }
    // Low stock
    else if (stockPercent < this.config.lowStockThresholdPercent) {
      alerts.push({
        id: `low-${product.id}`,
        productId: product.id,
        productName: product.name,
        type: 'low',
        severity: 'warning',
        message: `${product.name} stock low (${stockPercent.toFixed(0)}%). Consider reordering.`,
        currentValue: data.currentStock,
        thresholdValue: data.reorderPoint,
        createdAt: new Date(),
      });
    }

    // Expiring soon
    if (data.daysUntilExpiry !== null) {
      if (data.daysUntilExpiry <= this.config.criticalExpiryThresholdDays) {
        alerts.push({
          id: `exp-crit-${product.id}`,
          productId: product.id,
          productName: product.name,
          type: 'expiring_critical',
          severity: 'critical',
          message: `${product.name} expires in ${data.daysUntilExpiry} day(s)! Immediate discount needed.`,
          currentValue: data.daysUntilExpiry,
          thresholdValue: this.config.criticalExpiryThresholdDays,
          createdAt: new Date(),
        });
      } else if (data.daysUntilExpiry <= this.config.expiryThresholdDays) {
        alerts.push({
          id: `exp-soon-${product.id}`,
          productId: product.id,
          productName: product.name,
          type: 'expiring_soon',
          severity: 'warning',
          message: `${product.name} expires in ${data.daysUntilExpiry} day(s). Plan discount promotion.`,
          currentValue: data.daysUntilExpiry,
          thresholdValue: this.config.expiryThresholdDays,
          createdAt: new Date(),
        });
      }
    }

    // Overstock
    if (data.dailySalesRate > 0) {
      const daysOfSupply = data.currentStock / data.dailySalesRate;
      if (daysOfSupply > this.config.excessStockThresholdDays) {
        alerts.push({
          id: `over-${product.id}`,
          productId: product.id,
          productName: product.name,
          type: 'overstock',
          severity: 'info',
          message: `${product.name} has ${Math.round(daysOfSupply)} days of supply. Consider promotions.`,
          currentValue: daysOfSupply,
          thresholdValue: this.config.overstockThresholdDays,
          createdAt: new Date(),
        });
      }
    }

    return alerts;
  }

  /**
   * Calculate reorder quantity
   */
  private calculateReorderQuantity(data: InventoryData): number {
    // Target: bring stock to max, but consider lead time demand
    const leadTimeDemand = data.dailySalesRate * data.supplierLeadDays;
    const targetStock = data.maxStock;
    const reorderQty = Math.max(0, targetStock - data.currentStock + leadTimeDemand - data.safetyStock);
    return Math.ceil(reorderQty);
  }

  /**
   * Calculate reorder date
   */
  private calculateReorderDate(data: InventoryData, _reorderQty: number): Date | null {
    if (data.dailySalesRate <= 0) return null;

    const daysUntilStockout = data.currentStock / data.dailySalesRate;
    const bufferDays = data.supplierLeadDays;

    // Reorder when we have enough time to receive new stock
    if (daysUntilStockout <= bufferDays + 2) {
      const reorderDate = new Date();
      reorderDate.setDate(reorderDate.getDate() + Math.ceil(daysUntilStockout - bufferDays));
      return reorderDate;
    }

    return null; // No urgent reorder needed
  }

  /**
   * Generate mock inventory data for testing
   */
  private generateMockInventory(productId: string): InventoryData {
    const currentStock = Math.floor(Math.random() * 150);
    const maxStock = 200;
    const dailySalesRate = 5 + Math.random() * 10;
    const daysUntilExpiry = Math.random() > 0.7
      ? Math.floor(Math.random() * 14)
      : null;

    return {
      productId,
      currentStock,
      maxStock,
      reorderPoint: Math.floor(maxStock * 0.2),
      safetyStock: Math.floor(maxStock * 0.1),
      dailySalesRate,
      daysUntilExpiry,
      supplierLeadDays: 5 + Math.floor(Math.random() * 10),
      lastRestockedDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    };
  }
}

export default InventoryAnalyzer;
