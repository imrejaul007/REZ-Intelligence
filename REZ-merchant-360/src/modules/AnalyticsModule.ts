/**
 * AnalyticsModule.ts - Analytics & Insights for Merchant360
 */

import axios, { AxiosInstance } from 'axios';
import { Analytics } from '../MerchantProfile';

export interface SalesMetrics {
  total_revenue: number;
  revenue_change: number;
  revenue_change_percent: number;
  total_orders: number;
  orders_change: number;
  orders_change_percent: number;
  avg_order_value: number;
  avg_order_value_change: number;
  units_sold: number;
  units_sold_change: number;
}

export interface CustomerMetrics {
  total_customers: number;
  new_customers: number;
  returning_customers: number;
  customer_retention_rate: number;
  retention_rate_change: number;
  avg_customer_lifetime_value: number;
  avg_customer_lifetime_value_change: number;
  churn_rate: number;
  churn_rate_change: number;
}

export interface ProductMetrics {
  total_products: number;
  active_products: number;
  out_of_stock: number;
  top_sellers: { product_id: string; name: string; units_sold: number; revenue: number }[];
  top_categories: { category: string; revenue: number; units_sold: number }[];
  avg_product_rating: number;
}

export interface TrafficMetrics {
  total_visits: number;
  unique_visitors: number;
  page_views: number;
  bounce_rate: number;
  avg_session_duration: number;
  conversion_rate: number;
  top_sources: { source: string; visits: number; conversions: number }[];
}

export interface TimeSeriesData {
  date: string;
  revenue: number;
  orders: number;
  customers: number;
  avg_order_value: number;
}

export interface DashboardData {
  sales: SalesMetrics;
  customers: CustomerMetrics;
  products: ProductMetrics;
  traffic: TrafficMetrics;
  period: { start: string; end: string };
  comparison_period: { start: string; end: string };
}

export interface AnalyticsSummary {
  monthly_orders: number;
  avg_order_value: number;
  customer_retention_rate: number;
  growth_rate: number;
  top_category?: string;
  peak_hours: string[];
  revenue_trend: 'up' | 'down' | 'stable';
  customer_trend: 'up' | 'down' | 'stable';
}

export class AnalyticsModule {
  private client: AxiosInstance;
  private cache: Map<string, { data: Analytics; timestamp: number }> = new Map();
  private cacheTTL: number = 300000; // 5 minutes default

  constructor(baseURL?: string) {
    this.client = axios.create({
      baseURL: baseURL || process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4008',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
  }

  /**
   * Get analytics summary for a merchant
   */
  async getAnalytics(merchantId: string): Promise<Analytics> {
    const cacheKey = `analytics:${merchantId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const summary = await this.getAnalyticsSummary(merchantId);

      const analytics: Analytics = {
        monthly_orders: summary.monthly_orders,
        avg_order_value: summary.avg_order_value,
        customer_retention_rate: summary.customer_retention_rate,
        growth_rate: summary.growth_rate,
        top_category: summary.top_category,
        peak_hours: summary.peak_hours,
      };

      this.cache.set(cacheKey, { data: analytics, timestamp: Date.now() });
      return analytics;
    } catch (error) {
      console.error(`Failed to fetch analytics for merchant ${merchantId}:`, error);
      return this.getDefaultAnalytics();
    }
  }

  /**
   * Get detailed analytics summary
   */
  async getAnalyticsSummary(merchantId: string): Promise<AnalyticsSummary> {
    try {
      const response = await this.client.get<AnalyticsSummary>(
        `/merchants/${merchantId}/analytics/summary`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch analytics summary for merchant ${merchantId}:`, error);
      return this.getDefaultAnalyticsSummary();
    }
  }

  /**
   * Get dashboard data
   */
  async getDashboard(
    merchantId: string,
    period: { start: string; end: string }
  ): Promise<DashboardData> {
    try {
      const response = await this.client.get<DashboardData>(
        `/merchants/${merchantId}/analytics/dashboard`,
        { params: period }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch dashboard for merchant ${merchantId}:`, error);
      throw error;
    }
  }

  /**
   * Get sales metrics
   */
  async getSalesMetrics(
    merchantId: string,
    period: { start: string; end: string }
  ): Promise<SalesMetrics> {
    try {
      const response = await this.client.get<SalesMetrics>(
        `/merchants/${merchantId}/analytics/sales`,
        { params: period }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch sales metrics:`, error);
      throw error;
    }
  }

  /**
   * Get customer metrics
   */
  async getCustomerMetrics(
    merchantId: string,
    period: { start: string; end: string }
  ): Promise<CustomerMetrics> {
    try {
      const response = await this.client.get<CustomerMetrics>(
        `/merchants/${merchantId}/analytics/customers`,
        { params: period }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch customer metrics:`, error);
      throw error;
    }
  }

  /**
   * Get product metrics
   */
  async getProductMetrics(
    merchantId: string,
    period: { start: string; end: string }
  ): Promise<ProductMetrics> {
    try {
      const response = await this.client.get<ProductMetrics>(
        `/merchants/${merchantId}/analytics/products`,
        { params: period }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch product metrics:`, error);
      throw error;
    }
  }

  /**
   * Get traffic metrics
   */
  async getTrafficMetrics(
    merchantId: string,
    period: { start: string; end: string }
  ): Promise<TrafficMetrics> {
    try {
      const response = await this.client.get<TrafficMetrics>(
        `/merchants/${merchantId}/analytics/traffic`,
        { params: period }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch traffic metrics:`, error);
      throw error;
    }
  }

  /**
   * Get time series data
   */
  async getTimeSeries(
    merchantId: string,
    period: { start: string; end: string },
    granularity: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<TimeSeriesData[]> {
    try {
      const response = await this.client.get<TimeSeriesData[]>(
        `/merchants/${merchantId}/analytics/timeseries`,
        { params: { ...period, granularity } }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch time series:`, error);
      return [];
    }
  }

  /**
   * Get revenue breakdown by category
   */
  async getRevenueByCategory(
    merchantId: string,
    period: { start: string; end: string }
  ): Promise<{ category: string; revenue: number; percentage: number; orders: number }[]> {
    try {
      const response = await this.client.get(
        `/merchants/${merchantId}/analytics/revenue/by-category`,
        { params: period }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch revenue by category:`, error);
      return [];
    }
  }

  /**
   * Get revenue breakdown by source
   */
  async getRevenueBySource(
    merchantId: string,
    period: { start: string; end: string }
  ): Promise<{ source: string; revenue: number; percentage: number; orders: number }[]> {
    try {
      const response = await this.client.get(
        `/merchants/${merchantId}/analytics/revenue/by-source`,
        { params: period }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch revenue by source:`, error);
      return [];
    }
  }

  /**
   * Get customer cohort analysis
   */
  async getCohortAnalysis(
    merchantId: string,
    cohortPeriod: 'week' | 'month' = 'month'
  ): Promise<{
    cohort: string;
    initial_size: number;
    retention_by_month: number[];
  }[]> {
    try {
      const response = await this.client.get(
        `/merchants/${merchantId}/analytics/cohorts`,
        { params: { period: cohortPeriod } }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch cohort analysis:`, error);
      return [];
    }
  }

  /**
   * Get funnel analysis
   */
  async getFunnelAnalysis(
    merchantId: string,
    funnel: string[] = ['visit', 'add_to_cart', 'checkout', 'purchase']
  ): Promise<{ step: string; count: number; dropoff_rate: number }[]> {
    try {
      const response = await this.client.get(
        `/merchants/${merchantId}/analytics/funnel`,
        { params: { steps: funnel.join(',') } }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch funnel analysis:`, error);
      return [];
    }
  }

  /**
   * Get peak hours analysis
   */
  async getPeakHours(
    merchantId: string,
    period: { start: string; end: string }
  ): Promise<{ hour: number; orders: number; revenue: number }[]> {
    try {
      const response = await this.client.get(
        `/merchants/${merchantId}/analytics/peak-hours`,
        { params: period }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch peak hours:`, error);
      return [];
    }
  }

  /**
   * Export analytics report
   */
  async exportReport(
    merchantId: string,
    period: { start: string; end: string },
    format: 'csv' | 'json' | 'xlsx' = 'csv'
  ): Promise<{ url: string; expires_at: string }> {
    try {
      const response = await this.client.post(
        `/merchants/${merchantId}/analytics/export`,
        { period, format }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to export report:`, error);
      throw error;
    }
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(merchantId: string): Promise<{
    active_visitors: number;
    orders_today: number;
    revenue_today: number;
    avg_response_time_ms: number;
    conversion_rate_today: number;
  }> {
    try {
      const response = await this.client.get(
        `/merchants/${merchantId}/analytics/realtime`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch real-time metrics:`, error);
      return {
        active_visitors: 0,
        orders_today: 0,
        revenue_today: 0,
        avg_response_time_ms: 0,
        conversion_rate_today: 0,
      };
    }
  }

  /**
   * Sync analytics from external source
   */
  async syncAnalytics(merchantId: string, sourceData: Partial<Analytics>): Promise<Analytics> {
    const current = await this.getAnalytics(merchantId);
    const updated: Analytics = {
      ...current,
      ...sourceData,
    };

    this.cache.delete(`analytics:${merchantId}`);
    return updated;
  }

  private getDefaultAnalytics(): Analytics {
    return {
      monthly_orders: 0,
      avg_order_value: 0,
      peak_hours: [],
    };
  }

  private getDefaultAnalyticsSummary(): AnalyticsSummary {
    return {
      monthly_orders: 0,
      avg_order_value: 0,
      customer_retention_rate: 0,
      growth_rate: 0,
      peak_hours: [],
      revenue_trend: 'stable',
      customer_trend: 'stable',
    };
  }

  clearCache(merchantId?: string): void {
    if (merchantId) {
      this.cache.delete(`analytics:${merchantId}`);
    } else {
      this.cache.clear();
    }
  }
}
