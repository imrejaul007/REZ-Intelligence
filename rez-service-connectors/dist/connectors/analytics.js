"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsConnector = void 0;
exports.getAnalyticsConnector = getAnalyticsConnector;
const logger_js_1 = __importDefault(require("./utils/logger.js"));
/**
 * Analytics Service Connector
 *
 * Connects to rez-analytics-service (Port 4005) for dashboards,
 * KPIs, reporting, and data aggregation.
 */
const client_1 = require("../utils/client");
const DEFAULT_CONFIG = {
    timeout: 30000,
    maxRetries: 3,
};
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
class AnalyticsConnector extends client_1.ServiceClient {
    config;
    constructor(config = {}) {
        const analyticsUrl = config.baseUrl || process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4005';
        const internalToken = config.internalToken || getInternalToken();
        const mergedConfig = {
            ...DEFAULT_CONFIG,
            ...config,
            baseUrl: analyticsUrl,
            internalToken,
            serviceName: 'analytics-service',
        };
        super(mergedConfig);
        this.config = mergedConfig;
    }
    /**
     * Get dashboard summary
     *
     * Returns full dashboard with KPIs, charts, and recent data.
     *
     * @param dateRange - Optional date range filter
     * @returns Dashboard summary
     */
    async getDashboardSummary(dateRange) {
        return this.safeRequest({
            method: 'GET',
            url: '/api/dashboard/summary',
            params: dateRange ? {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
            } : undefined,
        });
    }
    /**
     * Get KPIs
     *
     * Returns real-time key performance indicators with trends.
     *
     * @param dateRange - Optional date range filter
     * @returns KPI data with trends
     */
    async getKPIs(dateRange) {
        return this.safeRequest({
            method: 'GET',
            url: '/api/dashboard/kpis',
            params: dateRange ? {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
            } : undefined,
        });
    }
    /**
     * Get chart data
     *
     * Returns data for a specific chart.
     *
     * @param chartType - Type of chart (line, bar, pie, etc.)
     * @param params - Query parameters
     * @returns Chart data
     */
    async getChartData(chartType, params = {}) {
        return this.safeRequest({
            method: 'GET',
            url: `/api/charts/${chartType}`,
            params: {
                startDate: params.startDate,
                endDate: params.endDate,
                merchantId: params.merchantId,
                userId: params.userId,
                granularity: params.granularity || 'day',
            },
        });
    }
    /**
     * Get sales analytics
     *
     * Returns sales-related analytics.
     *
     * @param params - Query parameters
     * @returns Sales analytics data
     */
    async getSalesAnalytics(params = {}) {
        return this.safeRequest({
            method: 'GET',
            url: '/api/analytics/sales',
            params: {
                startDate: params.startDate,
                endDate: params.endDate,
                merchantId: params.merchantId,
                granularity: params.granularity,
            },
        });
    }
    /**
     * Get revenue analytics
     *
     * Returns revenue-related analytics.
     *
     * @param params - Query parameters
     * @returns Revenue analytics data
     */
    async getRevenueAnalytics(params = {}) {
        return this.safeRequest({
            method: 'GET',
            url: '/api/analytics/revenue',
            params: {
                startDate: params.startDate,
                endDate: params.endDate,
                merchantId: params.merchantId,
                granularity: params.granularity,
            },
        });
    }
    /**
     * Get customer analytics
     *
     * Returns customer-related analytics including retention.
     *
     * @param params - Query parameters
     * @returns Customer analytics data
     */
    async getCustomerAnalytics(params = {}) {
        return this.safeRequest({
            method: 'GET',
            url: '/api/analytics/customers',
            params: {
                startDate: params.startDate,
                endDate: params.endDate,
                merchantId: params.merchantId,
            },
        });
    }
    /**
     * Get order analytics
     *
     * Returns order-related analytics.
     *
     * @param params - Query parameters
     * @returns Order analytics data
     */
    async getOrderAnalytics(params = {}) {
        return this.safeRequest({
            method: 'GET',
            url: '/api/analytics/orders',
            params: {
                startDate: params.startDate,
                endDate: params.endDate,
                merchantId: params.merchantId,
                granularity: params.granularity,
            },
        });
    }
    /**
     * Get conversion metrics
     *
     * Returns conversion rate analytics.
     *
     * @param params - Query parameters
     * @returns Conversion metrics
     */
    async getConversionMetrics(params = {}) {
        return this.safeRequest({
            method: 'GET',
            url: '/api/analytics/conversion',
            params: {
                startDate: params.startDate,
                endDate: params.endDate,
                merchantId: params.merchantId,
            },
        });
    }
    /**
     * Generate report
     *
     * Generates a report based on specified parameters.
     *
     * @param request - Report generation parameters
     * @returns Generated report
     */
    async generateReport(request) {
        return this.safeRequest({
            method: 'POST',
            url: '/api/reports/generate',
            data: request,
        });
    }
    /**
     * Export data
     *
     * Exports analytics data in specified format.
     *
     * @param request - Export parameters
     * @returns Export URL or data
     */
    async export(request) {
        return this.safeRequest({
            method: 'POST',
            url: '/api/export',
            data: request,
        });
    }
    /**
     * Get real-time metrics
     *
     * Returns current real-time metrics (last hour/day).
     *
     * @returns Real-time metrics
     */
    async getRealTimeMetrics() {
        return this.safeRequest({
            method: 'GET',
            url: '/api/metrics/realtime',
        });
    }
    /**
     * Get trends
     *
     * Returns trend data for specified metric.
     *
     * @param metric - Metric name
     * @param params - Query parameters
     * @returns Trend data
     */
    async getTrends(metric, params = {}) {
        return this.safeRequest({
            method: 'GET',
            url: `/api/trends/${metric}`,
            params: {
                startDate: params.startDate,
                endDate: params.endDate,
                merchantId: params.merchantId,
                granularity: params.granularity || 'day',
            },
        });
    }
    /**
     * Get merchant comparison
     *
     * Compares metrics across multiple merchants.
     *
     * @param merchantIds - List of merchant IDs
     * @param dateRange - Date range for comparison
     * @returns Comparison data
     */
    async getMerchantComparison(merchantIds, dateRange) {
        return this.safeRequest({
            method: 'POST',
            url: '/api/analytics/compare',
            data: {
                merchantIds,
                dateRange,
            },
        });
    }
    /**
     * Health check for analytics service
     *
     * @returns Health status
     */
    async healthCheck() {
        const start = Date.now();
        try {
            await this.client.get('/health');
            return { healthy: true, latency: Date.now() - start };
        }
        catch {
            return { healthy: false, latency: Date.now() - start };
        }
    }
}
exports.AnalyticsConnector = AnalyticsConnector;
/**
 * Get internal token from environment
 */
function getInternalToken() {
    const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
    try {
        const tokens = JSON.parse(tokensJson);
        return tokens.orchestrator || tokens.analytics || '';
    }
    catch {
        logger_js_1.default.warn('[AnalyticsConnector] Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
        return '';
    }
}
// Singleton instance
let analyticsInstance = null;
function getAnalyticsConnector(config) {
    if (!analyticsInstance) {
        analyticsInstance = new AnalyticsConnector(config);
    }
    return analyticsInstance;
}
exports.default = AnalyticsConnector;
//# sourceMappingURL=analytics.js.map