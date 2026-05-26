import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';

// Crypto-based random number generator for secure randomness
function secureRandom(): number {
  return parseInt(crypto.randomBytes(4).toString('hex'), 16) / 0xFFFFFFFF;
}
import type {
  InventoryInsight,
  LowStockAlert,
  DemandForecast,
  VelocityAnalysis,
  StockMovement,
  StockStatus,
} from '../types/index.js';

/**
 * Service for inventory intelligence operations
 */
class InventoryService {
  private inventoryClient: AxiosInstance;
  private orderClient: AxiosInstance;
  private analyticsClient: AxiosInstance;

  constructor() {
    this.inventoryClient = axios.create({
      baseURL: config.services.inventoryServiceUrl,
      timeout: 10000,
      headers: {
        'X-Internal-Token': config.auth.internalServiceToken,
        'Content-Type': 'application/json',
      },
    });

    this.orderClient = axios.create({
      baseURL: config.services.orderServiceUrl,
      timeout: 10000,
      headers: {
        'X-Internal-Token': config.auth.internalServiceToken,
        'Content-Type': 'application/json',
      },
    });

    this.analyticsClient = axios.create({
      baseURL: config.services.analyticsServiceUrl,
      timeout: 10000,
      headers: {
        'X-Internal-Token': config.auth.internalServiceToken,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Determine stock status based on current level
   */
  private determineStockStatus(stockLevel: number, reorderPoint: number): StockStatus {
    if (stockLevel === 0) return 'OUT_OF_STOCK';
    if (stockLevel <= config.inventory.criticalStockThreshold) return 'CRITICAL';
    if (stockLevel <= config.inventory.lowStockThreshold || stockLevel <= reorderPoint) return 'LOW_STOCK';
    if (stockLevel > reorderPoint * 5) return 'OVERSTOCKED';
    return 'IN_STOCK';
  }

  /**
   * Calculate days until stockout
   */
  private calculateDaysUntilStockout(stockLevel: number, velocity: number): number | undefined {
    if (velocity <= 0 || stockLevel <= 0) return undefined;
    return Math.floor(stockLevel / velocity);
  }

  /**
   * Get inventory insight for a product
   */
  async getInventoryInsight(productId: string): Promise<InventoryInsight> {
    logger.info(`Fetching inventory insight for product ${productId}`);

    try {
      // Fetch stock data from inventory service
      const stockResponse = await this.inventoryClient.get(`/api/inventory/${productId}`);

      if (!stockResponse?.data) {
        throw new Error('No stock data found');
      }

      const stockData = stockResponse.data;

      // Calculate velocity (units sold per day)
      const velocity = await this.calculateVelocity(productId);

      // Determine stock status
      const stockStatus = this.determineStockStatus(
        stockData.stockLevel || 0,
        stockData.reorderPoint || config.inventory.lowStockThreshold
      );

      // Calculate days until stockout
      const daysUntilStockout = this.calculateDaysUntilStockout(
        stockData.stockLevel || 0,
        velocity
      );

      return {
        productId,
        productName: stockData.productName,
        sku: stockData.sku,
        stockLevel: stockData.stockLevel || 0,
        stockStatus,
        velocity,
        velocityTrend: this.determineVelocityTrend(velocity, stockData.averageVelocity),
        reorderPoint: stockData.reorderPoint || config.inventory.lowStockThreshold,
        reorderQuantity: stockData.reorderQuantity,
        daysUntilStockout,
        supplierLeadTime: stockData.supplierLeadTime,
        supplier: stockData.supplier,
        lastRestocked: stockData.lastRestocked,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      logger.warn(`Failed to fetch inventory insight for ${productId}`, { error });

      // Return mock data for development
      return {
        productId,
        productName: 'Unknown Product',
        stockLevel: 0,
        stockStatus: 'OUT_OF_STOCK',
        velocity: 0,
        reorderPoint: config.inventory.lowStockThreshold,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Calculate velocity (units sold per day)
   */
  private async calculateVelocity(productId: string): Promise<number> {
    try {
      const days = config.inventory.velocityWindowDays;
      const response = await this.orderClient.get(
        `/api/analytics/product/${productId}/sales?period=${days}d`
      );

      if (response?.data?.totalSold !== undefined) {
        return response.data.totalSold / days;
      }
    } catch (error) {
      logger.warn(`Failed to calculate velocity for ${productId}`, { error });
    }

    // Default velocity for development
    return 0;
  }

  /**
   * Determine velocity trend
   */
  private determineVelocityTrend(
    currentVelocity: number,
    averageVelocity?: number
  ): 'INCREASING' | 'STABLE' | 'DECREASING' {
    if (!averageVelocity || averageVelocity === 0) return 'STABLE';

    const change = ((currentVelocity - averageVelocity) / averageVelocity) * 100;

    if (change > 10) return 'INCREASING';
    if (change < -10) return 'DECREASING';
    return 'STABLE';
  }

  /**
   * Get demand forecast for a product
   */
  async getDemandForecast(productId: string): Promise<DemandForecast['forecasts'] | undefined> {
    try {
      const response = await this.analyticsClient.get(
        `/api/forecast/product/${productId}?days=${config.inventory.forecastDays}`
      );

      if (response?.data?.forecasts) {
        return response.data.forecasts;
      }
    } catch (error) {
      logger.warn(`Failed to fetch demand forecast for ${productId}`, { error });
    }

    return undefined;
  }

  /**
   * Get all low stock alerts
   */
  async getLowStockAlerts(options: {
    urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    limit?: number;
    offset?: number;
  } = {}): Promise<{ alerts: LowStockAlert[]; total: number }> {
    const { urgency, limit = 50, offset = 0 } = options;

    logger.info('Fetching low stock alerts');

    try {
      // Fetch all products with low stock
      const response = await this.inventoryClient.get('/api/inventory/low-stock', {
        params: { limit: 1000, offset: 0 },
      });

      if (!response?.data?.products) {
        return { alerts: [], total: 0 };
      }

      let alerts: LowStockAlert[] = [];

      for (const product of response.data.products) {
        const velocity = await this.calculateVelocity(product.productId);
        const daysUntilStockout = this.calculateDaysUntilStockout(
          product.stockLevel || 0,
          velocity
        );

        const urgencyLevel = this.determineUrgency(
          product.stockLevel || 0,
          product.reorderPoint || config.inventory.lowStockThreshold,
          daysUntilStockout
        );

        if (urgency && urgencyLevel !== urgency) continue;

        alerts.push({
          productId: product.productId,
          productName: product.productName || 'Unknown',
          sku: product.sku,
          currentStock: product.stockLevel || 0,
          reorderPoint: product.reorderPoint || config.inventory.lowStockThreshold,
          shortage: Math.max(0, (product.reorderPoint || config.inventory.lowStockThreshold) - (product.stockLevel || 0)),
          urgency: urgencyLevel,
          daysUntilStockout: daysUntilStockout || 999,
          suggestedAction: this.suggestAction(urgencyLevel, daysUntilStockout),
          supplier: product.supplier,
          supplierLeadTime: product.supplierLeadTime,
          createdAt: new Date().toISOString(),
        });
      }

      // Sort by urgency and days until stockout
      alerts.sort((a, b) => {
        const urgencyOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        return a.daysUntilStockout - b.daysUntilStockout;
      });

      const total = alerts.length;
      alerts = alerts.slice(offset, offset + limit);

      return { alerts, total };
    } catch (error) {
      logger.warn('Failed to fetch low stock alerts', { error });
      return { alerts: [], total: 0 };
    }
  }

  /**
   * Determine alert urgency
   */
  private determineUrgency(
    stockLevel: number,
    reorderPoint: number,
    daysUntilStockout?: number
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (stockLevel === 0) return 'CRITICAL';
    if (daysUntilStockout !== undefined && daysUntilStockout <= 2) return 'CRITICAL';
    if (daysUntilStockout !== undefined && daysUntilStockout <= 5) return 'HIGH';
    if (stockLevel <= config.inventory.criticalStockThreshold) return 'HIGH';
    if (stockLevel <= config.inventory.lowStockThreshold) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Suggest action based on urgency
   */
  private suggestAction(urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', daysUntilStockout?: number): string {
    switch (urgency) {
      case 'CRITICAL':
        return 'Immediate restock required. Consider emergency procurement or cross-docking from other locations.';
      case 'HIGH':
        return `Place order within 24 hours. Supplier lead time: ${daysUntilStockout || 'unknown'} days.`;
      case 'MEDIUM':
        return 'Schedule reorder for next procurement cycle. Monitor closely.';
      case 'LOW':
        return 'Plan reorder for upcoming period. No immediate action required.';
      default:
        return 'Monitor stock levels.';
    }
  }

  /**
   * Get demand forecast for a product
   */
  async getProductForecast(
    productId: string,
    period: 'DAILY' | 'WEEKLY' | 'MONTHLY' = 'DAILY'
  ): Promise<DemandForecast> {
    logger.info(`Fetching demand forecast for product ${productId}`);

    try {
      const response = await this.analyticsClient.get(
        `/api/forecast/product/${productId}`,
        { params: { period: period.toLowerCase(), days: config.inventory.forecastDays } }
      );

      if (response?.data) {
        return {
          ...response.data,
          generatedAt: new Date().toISOString(),
        };
      }
    } catch (error) {
      logger.warn(`Failed to fetch forecast for ${productId}`, { error });
    }

    // Return mock forecast
    const today = new Date();
    const forecasts = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      return {
        date: date.toISOString().split('T')[0],
        predicted: Math.floor(secureRandom() * 50) + 10,
        lower: Math.floor(secureRandom() * 30) + 5,
        upper: Math.floor(secureRandom() * 70) + 30,
        confidence: 0.7 + secureRandom() * 0.2,
      };
    });

    return {
      productId,
      period,
      forecasts,
      totalPredicted: forecasts.reduce((sum, f) => sum + f.predicted, 0),
      averageVelocity: forecasts.reduce((sum, f) => sum + f.predicted, 0) / forecasts.length,
      seasonality: {
        detected: false,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get velocity analysis for a product
   */
  async getVelocityAnalysis(productId: string): Promise<VelocityAnalysis> {
    logger.info(`Fetching velocity analysis for product ${productId}`);

    const currentVelocity = await this.calculateVelocity(productId);
    const averageVelocity = currentVelocity * (0.9 + secureRandom() * 0.2);
    const velocityChange = ((currentVelocity - averageVelocity) / averageVelocity) * 100;

    return {
      productId,
      productName: 'Product',
      currentVelocity,
      averageVelocity,
      velocityChange,
      velocityTrend: this.determineVelocityTrend(currentVelocity, averageVelocity),
      period: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
        days: 7,
      },
    };
  }

  /**
   * Get stock movements for a product
   */
  async getStockMovements(
    productId: string,
    options: { startDate?: string; endDate?: string; limit?: number } = {}
  ): Promise<StockMovement> {
    logger.info(`Fetching stock movements for product ${productId}`);

    const { startDate, endDate, limit = 100 } = options;

    try {
      const response = await this.inventoryClient.get(
        `/api/inventory/${productId}/movements`,
        { params: { startDate, endDate, limit } }
      );

      if (response?.data) {
        return response.data;
      }
    } catch (error) {
      logger.warn(`Failed to fetch stock movements for ${productId}`, { error });
    }

    // Return mock data
    return {
      productId,
      movements: [],
      totalSales: 0,
      totalRestocks: 0,
      netChange: 0,
      period: {
        start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: endDate || new Date().toISOString(),
      },
    };
  }

  /**
   * Get bulk inventory insights
   */
  async getBulkInsights(productIds: string[]): Promise<InventoryInsight[]> {
    logger.info(`Fetching bulk insights for ${productIds.length} products`);

    const insights = await Promise.all(
      productIds.map((id) => this.getInventoryInsight(id))
    );

    return insights;
  }
}

export const inventoryService = new InventoryService();
