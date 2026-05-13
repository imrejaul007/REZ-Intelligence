/**
 * Analytics Service Connector
 *
 * Connects to rez-analytics-service (Port 4005) for dashboards,
 * KPIs, reporting, and data aggregation.
 */
import { ServiceClient, ClientConfig } from '../utils/client';
import type { DateRange, DashboardSummary, KPIResponse, AnalyticsQueryParams, ServiceResponse } from '../types';
/**
 * Analytics Connector Configuration
 */
interface AnalyticsConfig extends ClientConfig {
    baseUrl: string;
    internalToken: string;
}
export interface ChartData {
    chartId: string;
    chartType: string;
    data: Record<string, unknown>[];
    metadata?: Record<string, unknown>;
}
export interface ReportRequest {
    reportType: 'sales' | 'revenue' | 'orders' | 'customers' | 'performance';
    dateRange: DateRange;
    merchantId?: string;
    filters?: Record<string, unknown>;
    format?: 'json' | 'csv' | 'pdf';
}
export interface ExportRequest {
    type: string;
    dateRange: DateRange;
    format: 'csv' | 'pdf' | 'excel';
    filters?: Record<string, unknown>;
}
/**
 * Analytics Connector
 *
 * Provides methods to interact with the analytics service:
 * - Get dashboard summary
 * - Fetch KPIs
 * - Get chart data
 * - Export reports
 * - Run custom queries
 */
export declare class AnalyticsConnector extends ServiceClient {
    private config;
    constructor(config?: Partial<AnalyticsConfig>);
    /**
     * Get dashboard summary
     *
     * Returns full dashboard with KPIs, charts, and recent data.
     *
     * @param dateRange - Optional date range filter
     * @returns Dashboard summary
     */
    getDashboardSummary(dateRange?: DateRange): Promise<DashboardSummary>;
    /**
     * Get KPIs
     *
     * Returns real-time key performance indicators with trends.
     *
     * @param dateRange - Optional date range filter
     * @returns KPI data with trends
     */
    getKPIs(dateRange?: DateRange): Promise<KPIResponse>;
    /**
     * Get chart data
     *
     * Returns data for a specific chart.
     *
     * @param chartType - Type of chart (line, bar, pie, etc.)
     * @param params - Query parameters
     * @returns Chart data
     */
    getChartData(chartType: string, params?: AnalyticsQueryParams): Promise<ChartData>;
    /**
     * Get sales analytics
     *
     * Returns sales-related analytics.
     *
     * @param params - Query parameters
     * @returns Sales analytics data
     */
    getSalesAnalytics(params?: AnalyticsQueryParams): Promise<ServiceResponse>;
    /**
     * Get revenue analytics
     *
     * Returns revenue-related analytics.
     *
     * @param params - Query parameters
     * @returns Revenue analytics data
     */
    getRevenueAnalytics(params?: AnalyticsQueryParams): Promise<ServiceResponse>;
    /**
     * Get customer analytics
     *
     * Returns customer-related analytics including retention.
     *
     * @param params - Query parameters
     * @returns Customer analytics data
     */
    getCustomerAnalytics(params?: AnalyticsQueryParams): Promise<ServiceResponse>;
    /**
     * Get order analytics
     *
     * Returns order-related analytics.
     *
     * @param params - Query parameters
     * @returns Order analytics data
     */
    getOrderAnalytics(params?: AnalyticsQueryParams): Promise<ServiceResponse>;
    /**
     * Get conversion metrics
     *
     * Returns conversion rate analytics.
     *
     * @param params - Query parameters
     * @returns Conversion metrics
     */
    getConversionMetrics(params?: AnalyticsQueryParams): Promise<ServiceResponse>;
    /**
     * Generate report
     *
     * Generates a report based on specified parameters.
     *
     * @param request - Report generation parameters
     * @returns Generated report
     */
    generateReport(request: ReportRequest): Promise<ServiceResponse>;
    /**
     * Export data
     *
     * Exports analytics data in specified format.
     *
     * @param request - Export parameters
     * @returns Export URL or data
     */
    export(request: ExportRequest): Promise<ServiceResponse>;
    /**
     * Get real-time metrics
     *
     * Returns current real-time metrics (last hour/day).
     *
     * @returns Real-time metrics
     */
    getRealTimeMetrics(): Promise<ServiceResponse>;
    /**
     * Get trends
     *
     * Returns trend data for specified metric.
     *
     * @param metric - Metric name
     * @param params - Query parameters
     * @returns Trend data
     */
    getTrends(metric: string, params?: AnalyticsQueryParams): Promise<ServiceResponse>;
    /**
     * Get merchant comparison
     *
     * Compares metrics across multiple merchants.
     *
     * @param merchantIds - List of merchant IDs
     * @param dateRange - Date range for comparison
     * @returns Comparison data
     */
    getMerchantComparison(merchantIds: string[], dateRange: DateRange): Promise<ServiceResponse>;
    /**
     * Health check for analytics service
     *
     * @returns Health status
     */
    healthCheck(): Promise<{
        healthy: boolean;
        latency?: number;
    }>;
}
export declare function getAnalyticsConnector(config?: Partial<AnalyticsConfig>): AnalyticsConnector;
export default AnalyticsConnector;
//# sourceMappingURL=analytics.d.ts.map