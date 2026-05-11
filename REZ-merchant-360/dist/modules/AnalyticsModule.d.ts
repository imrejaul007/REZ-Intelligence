/**
 * AnalyticsModule.ts - Analytics & Insights for Merchant360
 */
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
    top_sellers: {
        product_id: string;
        name: string;
        units_sold: number;
        revenue: number;
    }[];
    top_categories: {
        category: string;
        revenue: number;
        units_sold: number;
    }[];
    avg_product_rating: number;
}
export interface TrafficMetrics {
    total_visits: number;
    unique_visitors: number;
    page_views: number;
    bounce_rate: number;
    avg_session_duration: number;
    conversion_rate: number;
    top_sources: {
        source: string;
        visits: number;
        conversions: number;
    }[];
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
    period: {
        start: string;
        end: string;
    };
    comparison_period: {
        start: string;
        end: string;
    };
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
export declare class AnalyticsModule {
    private client;
    private cache;
    private cacheTTL;
    constructor(baseURL?: string);
    setCacheTTL(ttl: number): void;
    /**
     * Get analytics summary for a merchant
     */
    getAnalytics(merchantId: string): Promise<Analytics>;
    /**
     * Get detailed analytics summary
     */
    getAnalyticsSummary(merchantId: string): Promise<AnalyticsSummary>;
    /**
     * Get dashboard data
     */
    getDashboard(merchantId: string, period: {
        start: string;
        end: string;
    }): Promise<DashboardData>;
    /**
     * Get sales metrics
     */
    getSalesMetrics(merchantId: string, period: {
        start: string;
        end: string;
    }): Promise<SalesMetrics>;
    /**
     * Get customer metrics
     */
    getCustomerMetrics(merchantId: string, period: {
        start: string;
        end: string;
    }): Promise<CustomerMetrics>;
    /**
     * Get product metrics
     */
    getProductMetrics(merchantId: string, period: {
        start: string;
        end: string;
    }): Promise<ProductMetrics>;
    /**
     * Get traffic metrics
     */
    getTrafficMetrics(merchantId: string, period: {
        start: string;
        end: string;
    }): Promise<TrafficMetrics>;
    /**
     * Get time series data
     */
    getTimeSeries(merchantId: string, period: {
        start: string;
        end: string;
    }, granularity?: 'hour' | 'day' | 'week' | 'month'): Promise<TimeSeriesData[]>;
    /**
     * Get revenue breakdown by category
     */
    getRevenueByCategory(merchantId: string, period: {
        start: string;
        end: string;
    }): Promise<{
        category: string;
        revenue: number;
        percentage: number;
        orders: number;
    }[]>;
    /**
     * Get revenue breakdown by source
     */
    getRevenueBySource(merchantId: string, period: {
        start: string;
        end: string;
    }): Promise<{
        source: string;
        revenue: number;
        percentage: number;
        orders: number;
    }[]>;
    /**
     * Get customer cohort analysis
     */
    getCohortAnalysis(merchantId: string, cohortPeriod?: 'week' | 'month'): Promise<{
        cohort: string;
        initial_size: number;
        retention_by_month: number[];
    }[]>;
    /**
     * Get funnel analysis
     */
    getFunnelAnalysis(merchantId: string, funnel?: string[]): Promise<{
        step: string;
        count: number;
        dropoff_rate: number;
    }[]>;
    /**
     * Get peak hours analysis
     */
    getPeakHours(merchantId: string, period: {
        start: string;
        end: string;
    }): Promise<{
        hour: number;
        orders: number;
        revenue: number;
    }[]>;
    /**
     * Export analytics report
     */
    exportReport(merchantId: string, period: {
        start: string;
        end: string;
    }, format?: 'csv' | 'json' | 'xlsx'): Promise<{
        url: string;
        expires_at: string;
    }>;
    /**
     * Get real-time metrics
     */
    getRealTimeMetrics(merchantId: string): Promise<{
        active_visitors: number;
        orders_today: number;
        revenue_today: number;
        avg_response_time_ms: number;
        conversion_rate_today: number;
    }>;
    /**
     * Sync analytics from external source
     */
    syncAnalytics(merchantId: string, sourceData: Partial<Analytics>): Promise<Analytics>;
    private getDefaultAnalytics;
    private getDefaultAnalyticsSummary;
    clearCache(merchantId?: string): void;
}
//# sourceMappingURL=AnalyticsModule.d.ts.map