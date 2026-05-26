/**
 * Dashboard Service
 *
 * Aggregates metrics for the CRM dashboard overview:
 * - Sales metrics
 * - Customer metrics
 * - Engagement metrics
 * - Segment performance
 */

import { serviceUrls } from '../config/index.js';
import { logger } from './utils/logger.js';
import type {
  DashboardOverview,
  RevenueMetrics,
  EngagementMetrics,
  GrowthMetrics,
  SegmentPerformance,
  ProductPerformance,
  DashboardAlert,
  PeriodComparison,
} from '../types/index.js';

export interface DashboardFilters {
  merchantId?: string;
  storeId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  segmentIds?: string[];
}

export class DashboardService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = serviceUrls.intelligence.customerIntelligence;
  }

  /**
   * Get complete dashboard overview
   */
  async getOverview(filters: DashboardFilters = {}): Promise<DashboardOverview> {
    try {
      const [revenue, engagement, growth, segments, products, alerts] =
        await Promise.all([
          this.getRevenueMetrics(filters),
          this.getEngagementMetrics(filters),
          this.getGrowthMetrics(filters),
          this.getTopSegments(filters),
          this.getTopProducts(filters),
          this.getAlerts(filters),
        ]);

      // Get customer counts
      const customerCounts = await this.getCustomerCounts(filters);

      // Get period comparison
      const periodComparison = await this.getPeriodComparison(filters);

      return {
        totalCustomers: customerCounts.total,
        activeCustomers: customerCounts.active,
        newCustomersThisMonth: customerCounts.newThisMonth,
        returningCustomers: customerCounts.returning,
        revenue,
        engagement,
        growth,
        topSegments: segments,
        topProducts: products,
        alerts,
        periodOverPeriod: periodComparison,
      };
    } catch (error) {
      logger.error('Error fetching dashboard overview', { error });
      return this.getDefaultOverview();
    }
  }

  /**
   * Get revenue metrics
   */
  async getRevenueMetrics(
    filters: DashboardFilters
  ): Promise<RevenueMetrics> {
    try {
      // In production, this would call the order/payment service
      // For now, return mock data structure
      return {
        total: 0,
        averageOrderValue: 0,
        totalOrders: 0,
        projection: undefined,
      };
    } catch (error) {
      logger.error('Error fetching revenue metrics', { error });
      return {
        total: 0,
        averageOrderValue: 0,
        totalOrders: 0,
      };
    }
  }

  /**
   * Get engagement metrics
   */
  async getEngagementMetrics(
    filters: DashboardFilters
  ): Promise<EngagementMetrics> {
    try {
      return {
        averageEngagementScore: 65,
        activeUsers: 0,
        emailOpenRate: 0.25,
        pushOpenRate: 0.40,
        responseRate: 0.15,
      };
    } catch (error) {
      logger.error('Error fetching engagement metrics', { error });
      return {
        averageEngagementScore: 0,
        activeUsers: 0,
      };
    }
  }

  /**
   * Get growth metrics
   */
  async getGrowthMetrics(filters: DashboardFilters): Promise<GrowthMetrics> {
    try {
      // Calculate growth by comparing periods
      const currentPeriod = await this.getPeriodMetrics(filters);
      const previousPeriod = await this.getPreviousPeriodMetrics(filters);

      const customerGrowth = previousPeriod.customers > 0
        ? ((currentPeriod.customers - previousPeriod.customers) / previousPeriod.customers) * 100
        : 0;

      const revenueGrowth = previousPeriod.revenue > 0
        ? ((currentPeriod.revenue - previousPeriod.revenue) / previousPeriod.revenue) * 100
        : 0;

      const orderGrowth = previousPeriod.orders > 0
        ? ((currentPeriod.orders - previousPeriod.orders) / previousPeriod.orders) * 100
        : 0;

      return {
        customerGrowth,
        revenueGrowth,
        orderGrowth,
        retentionRate: 85, // Would calculate from actual data
      };
    } catch (error) {
      logger.error('Error fetching growth metrics', { error });
      return {
        customerGrowth: 0,
        revenueGrowth: 0,
        orderGrowth: 0,
        retentionRate: 0,
      };
    }
  }

  /**
   * Get top performing segments
   */
  async getTopSegments(
    filters: DashboardFilters,
    limit = 5
  ): Promise<SegmentPerformance[]> {
    try {
      // Would fetch from RFM service or segments service
      return [
        {
          segmentId: 'champions',
          segmentName: 'Champions',
          customerCount: 150,
          revenue: 450000,
          avgOrderValue: 3000,
          growth: 12.5,
        },
        {
          segmentId: 'loyal',
          segmentName: 'Loyal Customers',
          customerCount: 320,
          revenue: 640000,
          avgOrderValue: 2000,
          growth: 8.2,
        },
        {
          segmentId: 'potential',
          segmentName: 'Potential Loyalists',
          customerCount: 280,
          revenue: 420000,
          avgOrderValue: 1500,
          growth: 15.3,
        },
        {
          segmentId: 'at_risk',
          segmentName: 'At Risk',
          customerCount: 120,
          revenue: 180000,
          avgOrderValue: 1500,
          growth: -5.2,
        },
        {
          segmentId: 'new',
          segmentName: 'New Customers',
          customerCount: 200,
          revenue: 200000,
          avgOrderValue: 1000,
          growth: 25.0,
        },
      ].slice(0, limit);
    } catch (error) {
      logger.error('Error fetching top segments', { error });
      return [];
    }
  }

  /**
   * Get top performing products
   */
  async getTopProducts(
    filters: DashboardFilters,
    limit = 5
  ): Promise<ProductPerformance[]> {
    try {
      // Would fetch from order service
      return [
        {
          productId: 'prod-1',
          productName: 'Premium Pizza',
          categoryName: 'Food',
          unitsSold: 1250,
          revenue: 187500,
          customerCount: 890,
        },
        {
          productId: 'prod-2',
          productName: 'Biryani Combo',
          categoryName: 'Food',
          unitsSold: 980,
          revenue: 147000,
          customerCount: 720,
        },
        {
          productId: 'prod-3',
          productName: 'Cold Coffee',
          categoryName: 'Beverages',
          unitsSold: 2100,
          revenue: 105000,
          customerCount: 1500,
        },
        {
          productId: 'prod-4',
          productName: 'Paneer Tikka',
          categoryName: 'Food',
          unitsSold: 780,
          revenue: 93600,
          customerCount: 560,
        },
        {
          productId: 'prod-5',
          productName: 'Masala Tea',
          categoryName: 'Beverages',
          unitsSold: 3200,
          revenue: 64000,
          customerCount: 2100,
        },
      ].slice(0, limit);
    } catch (error) {
      logger.error('Error fetching top products', { error });
      return [];
    }
  }

  /**
   * Get dashboard alerts
   */
  async getAlerts(filters: DashboardFilters): Promise<DashboardAlert[]> {
    const alerts: DashboardAlert[] = [];

    try {
      // Check for high churn risk customers
      const churnData = await this.getChurnAlerts(filters);
      alerts.push(...churnData);

      // Check for inventory alerts
      const inventoryAlerts = await this.getInventoryAlerts(filters);
      alerts.push(...inventoryAlerts);

      // Check for campaign performance
      const campaignAlerts = await this.getCampaignAlerts(filters);
      alerts.push(...campaignAlerts);
    } catch (error) {
      logger.error('Error generating alerts', { error });
    }

    return alerts.sort((a, b) => {
      const priority = { URGENT: 0, WARNING: 1, INFO: 2 };
      return priority[a.type] - priority[b.type];
    });
  }

  /**
   * Get period comparison data
   */
  async getPeriodComparison(
    filters: DashboardFilters
  ): Promise<PeriodComparison> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const currentPeriod = {
      start: thirtyDaysAgo,
      end: now,
      customers: 0,
      revenue: 0,
      orders: 0,
    };

    const previousPeriod = {
      customers: 0,
      revenue: 0,
      orders: 0,
    };

    const currentMetrics = await this.getPeriodMetrics({
      ...filters,
      dateFrom: thirtyDaysAgo,
      dateTo: now,
    });

    const previousMetrics = await this.getPreviousPeriodMetrics({
      ...filters,
      dateFrom: sixtyDaysAgo,
      dateTo: thirtyDaysAgo,
    });

    return {
      current: { ...currentPeriod, ...currentMetrics },
      previous: previousMetrics,
      change: {
        customers: currentMetrics.customers - previousMetrics.customers,
        revenue: currentMetrics.revenue - previousMetrics.revenue,
        orders: currentMetrics.orders - previousMetrics.orders,
      },
    };
  }

  // Private helper methods

  private async getCustomerCounts(
    filters: DashboardFilters
  ): Promise<{ total: number; active: number; newThisMonth: number; returning: number }> {
    // Would fetch from customer service
    return {
      total: 1070,
      active: 890,
      newThisMonth: 120,
      returning: 520,
    };
  }

  private async getPeriodMetrics(filters: DashboardFilters): Promise<{
    customers: number;
    revenue: number;
    orders: number;
  }> {
    return {
      customers: 890,
      revenue: 1897000,
      orders: 2340,
    };
  }

  private async getPreviousPeriodMetrics(filters: DashboardFilters): Promise<{
    customers: number;
    revenue: number;
    orders: number;
  }> {
    return {
      customers: 820,
      revenue: 1650000,
      orders: 2100,
    };
  }

  private async getChurnAlerts(
    filters: DashboardFilters
  ): Promise<DashboardAlert[]> {
    const alerts: DashboardAlert[] = [];

    // Would check predictive engine for high-risk customers
    try {
      // Mock: Check if there are customers at risk
      const atRiskCount = 45; // Would fetch from service

      if (atRiskCount > 30) {
        alerts.push({
          id: 'churn-warning',
          type: 'WARNING',
          title: `${atRiskCount} customers at risk of churn`,
          description:
            'These customers have shown declining engagement. Consider targeted campaigns.',
          actionUrl: '/customers?segment=at_risk',
          actionLabel: 'View At-Risk Customers',
          createdAt: new Date(),
        });
      }
    } catch (error) {
      logger.error('Error checking churn alerts', { error });
    }

    return alerts;
  }

  private async getInventoryAlerts(
    filters: DashboardFilters
  ): Promise<DashboardAlert[]> {
    const alerts: DashboardAlert[] = [];

    // Would check inventory service
    return alerts;
  }

  private async getCampaignAlerts(
    filters: DashboardFilters
  ): Promise<DashboardAlert[]> {
    const alerts: DashboardAlert[] = [];

    // Would check campaign performance
    return alerts;
  }

  private getDefaultOverview(): DashboardOverview {
    return {
      totalCustomers: 0,
      activeCustomers: 0,
      newCustomersThisMonth: 0,
      returningCustomers: 0,
      revenue: {
        total: 0,
        averageOrderValue: 0,
        totalOrders: 0,
      },
      engagement: {
        averageEngagementScore: 0,
        activeUsers: 0,
      },
      growth: {
        customerGrowth: 0,
        revenueGrowth: 0,
        orderGrowth: 0,
        retentionRate: 0,
      },
      topSegments: [],
      topProducts: [],
      alerts: [],
      periodOverPeriod: {
        current: {
          start: new Date(),
          end: new Date(),
          customers: 0,
          revenue: 0,
          orders: 0,
        },
        previous: {
          customers: 0,
          revenue: 0,
          orders: 0,
        },
        change: {
          customers: 0,
          revenue: 0,
          orders: 0,
        },
      },
    };
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
