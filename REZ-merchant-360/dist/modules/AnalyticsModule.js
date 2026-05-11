"use strict";
/**
 * AnalyticsModule.ts - Analytics & Insights for Merchant360
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsModule = void 0;
const axios_1 = __importDefault(require("axios"));
class AnalyticsModule {
    client;
    cache = new Map();
    cacheTTL = 300000; // 5 minutes default
    constructor(baseURL) {
        this.client = axios_1.default.create({
            baseURL: baseURL || process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4008',
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
    setCacheTTL(ttl) {
        this.cacheTTL = ttl;
    }
    /**
     * Get analytics summary for a merchant
     */
    async getAnalytics(merchantId) {
        const cacheKey = `analytics:${merchantId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }
        try {
            const summary = await this.getAnalyticsSummary(merchantId);
            const analytics = {
                monthly_orders: summary.monthly_orders,
                avg_order_value: summary.avg_order_value,
                customer_retention_rate: summary.customer_retention_rate,
                growth_rate: summary.growth_rate,
                top_category: summary.top_category,
                peak_hours: summary.peak_hours,
            };
            this.cache.set(cacheKey, { data: analytics, timestamp: Date.now() });
            return analytics;
        }
        catch (error) {
            console.error(`Failed to fetch analytics for merchant ${merchantId}:`, error);
            return this.getDefaultAnalytics();
        }
    }
    /**
     * Get detailed analytics summary
     */
    async getAnalyticsSummary(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/analytics/summary`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch analytics summary for merchant ${merchantId}:`, error);
            return this.getDefaultAnalyticsSummary();
        }
    }
    /**
     * Get dashboard data
     */
    async getDashboard(merchantId, period) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/analytics/dashboard`, { params: period });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch dashboard for merchant ${merchantId}:`, error);
            throw error;
        }
    }
    /**
     * Get sales metrics
     */
    async getSalesMetrics(merchantId, period) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/analytics/sales`, { params: period });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch sales metrics:`, error);
            throw error;
        }
    }
    /**
     * Get customer metrics
     */
    async getCustomerMetrics(merchantId, period) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/analytics/customers`, { params: period });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch customer metrics:`, error);
            throw error;
        }
    }
    /**
     * Get product metrics
     */
    async getProductMetrics(merchantId, period) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/analytics/products`, { params: period });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch product metrics:`, error);
            throw error;
        }
    }
    /**
     * Get traffic metrics
     */
    async getTrafficMetrics(merchantId, period) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/analytics/traffic`, { params: period });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch traffic metrics:`, error);
            throw error;
        }
    }
    /**
     * Get time series data
     */
    async getTimeSeries(merchantId, period, granularity = 'day') {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/analytics/timeseries`, { params: { ...period, granularity } });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch time series:`, error);
            return [];
        }
    }
    /**
     * Get revenue breakdown by category
     */
    async getRevenueByCategory(merchantId, period) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/analytics/revenue/by-category`, { params: period });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch revenue by category:`, error);
            return [];
        }
    }
    /**
     * Get revenue breakdown by source
     */
    async getRevenueBySource(merchantId, period) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/analytics/revenue/by-source`, { params: period });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch revenue by source:`, error);
            return [];
        }
    }
    /**
     * Get customer cohort analysis
     */
    async getCohortAnalysis(merchantId, cohortPeriod = 'month') {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/analytics/cohorts`, { params: { period: cohortPeriod } });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch cohort analysis:`, error);
            return [];
        }
    }
    /**
     * Get funnel analysis
     */
    async getFunnelAnalysis(merchantId, funnel = ['visit', 'add_to_cart', 'checkout', 'purchase']) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/analytics/funnel`, { params: { steps: funnel.join(',') } });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch funnel analysis:`, error);
            return [];
        }
    }
    /**
     * Get peak hours analysis
     */
    async getPeakHours(merchantId, period) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/analytics/peak-hours`, { params: period });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch peak hours:`, error);
            return [];
        }
    }
    /**
     * Export analytics report
     */
    async exportReport(merchantId, period, format = 'csv') {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/analytics/export`, { period, format });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to export report:`, error);
            throw error;
        }
    }
    /**
     * Get real-time metrics
     */
    async getRealTimeMetrics(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/analytics/realtime`);
            return response.data;
        }
        catch (error) {
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
    async syncAnalytics(merchantId, sourceData) {
        const current = await this.getAnalytics(merchantId);
        const updated = {
            ...current,
            ...sourceData,
        };
        this.cache.delete(`analytics:${merchantId}`);
        return updated;
    }
    getDefaultAnalytics() {
        return {
            monthly_orders: 0,
            avg_order_value: 0,
            peak_hours: [],
        };
    }
    getDefaultAnalyticsSummary() {
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
    clearCache(merchantId) {
        if (merchantId) {
            this.cache.delete(`analytics:${merchantId}`);
        }
        else {
            this.cache.clear();
        }
    }
}
exports.AnalyticsModule = AnalyticsModule;
//# sourceMappingURL=AnalyticsModule.js.map