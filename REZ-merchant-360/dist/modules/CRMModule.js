"use strict";
/**
 * CRMModule.ts - Customer Relationship Management for Merchant360
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRMModule = void 0;
const axios_1 = __importDefault(require("axios"));
class CRMModule {
    client;
    cache = new Map();
    cacheTTL = 180000; // 3 minutes default
    constructor(baseURL) {
        this.client = axios_1.default.create({
            baseURL: baseURL || process.env.CRM_SERVICE_URL || 'http://localhost:4004',
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
     * Get CRM summary for a merchant
     */
    async getCRM(merchantId) {
        const cacheKey = `crm:${merchantId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }
        try {
            const summary = await this.getCRMSummary(merchantId);
            const crm = {
                total_customers: summary.total_customers,
                monthly_customers: summary.monthly_customers,
                avg_rating: summary.avg_rating,
                reviews_count: summary.reviews_count,
                total_feedback: summary.total_feedback,
                satisfaction_rate: summary.satisfaction_rate,
            };
            this.cache.set(cacheKey, { data: crm, timestamp: Date.now() });
            return crm;
        }
        catch (error) {
            console.error(`Failed to fetch CRM for merchant ${merchantId}:`, error);
            return this.getDefaultCRM();
        }
    }
    /**
     * Get detailed CRM summary
     */
    async getCRMSummary(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/crm/summary`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch CRM summary for merchant ${merchantId}:`, error);
            return this.getDefaultCRMSummary();
        }
    }
    /**
     * Get all customers
     */
    async getCustomers(merchantId, options = {}) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/customers`, { params: options });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch customers for merchant ${merchantId}:`, error);
            return [];
        }
    }
    /**
     * Get single customer
     */
    async getCustomer(merchantId, customerId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/customers/${customerId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch customer ${customerId}:`, error);
            return null;
        }
    }
    /**
     * Create or update customer
     */
    async upsertCustomer(merchantId, customer) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/customers`, customer);
            this.cache.delete(`crm:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to upsert customer for merchant ${merchantId}:`, error);
            throw error;
        }
    }
    /**
     * Update customer tags
     */
    async updateCustomerTags(merchantId, customerId, tags) {
        try {
            const response = await this.client.patch(`/merchants/${merchantId}/customers/${customerId}`, { tags });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to update customer tags:`, error);
            throw error;
        }
    }
    /**
     * Add customer note
     */
    async addCustomerNote(merchantId, customerId, note) {
        try {
            await this.client.post(`/merchants/${merchantId}/customers/${customerId}/notes`, { content: note });
            return true;
        }
        catch (error) {
            console.error(`Failed to add customer note:`, error);
            return false;
        }
    }
    /**
     * Get reviews
     */
    async getReviews(merchantId, options = {}) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/reviews`, { params: options });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch reviews for merchant ${merchantId}:`, error);
            return [];
        }
    }
    /**
     * Respond to review
     */
    async respondToReview(merchantId, reviewId, response) {
        try {
            const responseData = await this.client.patch(`/merchants/${merchantId}/reviews/${reviewId}`, {
                response,
                response_date: new Date().toISOString(),
            });
            this.cache.delete(`crm:${merchantId}`);
            return responseData.data;
        }
        catch (error) {
            console.error(`Failed to respond to review ${reviewId}:`, error);
            throw error;
        }
    }
    /**
     * Get feedback
     */
    async getFeedback(merchantId, options = {}) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/feedback`, { params: options });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch feedback for merchant ${merchantId}:`, error);
            return [];
        }
    }
    /**
     * Create feedback
     */
    async createFeedback(merchantId, feedback) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/feedback`, feedback);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to create feedback:`, error);
            throw error;
        }
    }
    /**
     * Update feedback status
     */
    async updateFeedbackStatus(merchantId, feedbackId, status, resolution) {
        try {
            const response = await this.client.patch(`/merchants/${merchantId}/feedback/${feedbackId}`, {
                status,
                resolution,
                resolved_at: status === 'resolved' ? new Date().toISOString() : undefined,
            });
            this.cache.delete(`crm:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to update feedback status:`, error);
            throw error;
        }
    }
    /**
     * Get customer segments
     */
    async getSegments(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/crm/segments`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch segments for merchant ${merchantId}:`, error);
            return [];
        }
    }
    /**
     * Export customer data
     */
    async exportCustomers(merchantId, format = 'csv') {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/customers/export`, { params: { format } });
            return response.data.url;
        }
        catch (error) {
            console.error(`Failed to export customers:`, error);
            throw error;
        }
    }
    /**
     * Sync CRM from external source
     */
    async syncCRM(merchantId, sourceData) {
        const current = await this.getCRM(merchantId);
        const updated = {
            ...current,
            ...sourceData,
        };
        this.cache.delete(`crm:${merchantId}`);
        return updated;
    }
    getDefaultCRM() {
        return {
            total_customers: 0,
            monthly_customers: 0,
            avg_rating: 0,
            reviews_count: 0,
        };
    }
    getDefaultCRMSummary() {
        return {
            total_customers: 0,
            active_customers: 0,
            new_customers_this_month: 0,
            returning_customers: 0,
            churned_customers: 0,
            monthly_customers: 0,
            avg_rating: 0,
            reviews_count: 0,
            total_feedback: 0,
            satisfaction_rate: 100,
            top_customer_tags: [],
        };
    }
    clearCache(merchantId) {
        if (merchantId) {
            this.cache.delete(`crm:${merchantId}`);
        }
        else {
            this.cache.clear();
        }
    }
}
exports.CRMModule = CRMModule;
//# sourceMappingURL=CRMModule.js.map