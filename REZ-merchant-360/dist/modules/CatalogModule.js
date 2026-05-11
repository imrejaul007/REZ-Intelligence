"use strict";
/**
 * CatalogModule.ts - Product Catalog Services for Merchant360
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogModule = void 0;
const axios_1 = __importDefault(require("axios"));
class CatalogModule {
    client;
    cache = new Map();
    cacheTTL = 120000; // 2 minutes default
    constructor(baseURL) {
        this.client = axios_1.default.create({
            baseURL: baseURL || process.env.CATALOG_SERVICE_URL || 'http://localhost:4002',
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
     * Get catalog summary for a merchant
     */
    async getCatalog(merchantId) {
        const cacheKey = `catalog:${merchantId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }
        try {
            const summary = await this.getCatalogSummary(merchantId);
            const catalog = {
                total_products: summary.total_products,
                active_products: summary.active_products,
                categories: summary.categories,
                last_product_update: summary.last_product_update,
                avg_product_rating: summary.avg_product_rating,
            };
            this.cache.set(cacheKey, { data: catalog, timestamp: Date.now() });
            return catalog;
        }
        catch (error) {
            console.error(`Failed to fetch catalog for merchant ${merchantId}:`, error);
            return this.getDefaultCatalog();
        }
    }
    /**
     * Get detailed catalog summary
     */
    async getCatalogSummary(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/catalog/summary`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch catalog summary for merchant ${merchantId}:`, error);
            return this.getDefaultCatalogSummary();
        }
    }
    /**
     * Get all products for a merchant
     */
    async getProducts(merchantId, options = {}) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/products`, { params: options });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch products for merchant ${merchantId}:`, error);
            return [];
        }
    }
    /**
     * Get single product by ID
     */
    async getProduct(merchantId, productId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/products/${productId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch product ${productId} for merchant ${merchantId}:`, error);
            return null;
        }
    }
    /**
     * Create a new product
     */
    async createProduct(merchantId, product) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/products`, product);
            this.cache.delete(`catalog:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to create product for merchant ${merchantId}:`, error);
            throw error;
        }
    }
    /**
     * Update a product
     */
    async updateProduct(merchantId, productId, updates) {
        try {
            const response = await this.client.patch(`/merchants/${merchantId}/products/${productId}`, updates);
            this.cache.delete(`catalog:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to update product ${productId} for merchant ${merchantId}:`, error);
            throw error;
        }
    }
    /**
     * Delete a product
     */
    async deleteProduct(merchantId, productId) {
        try {
            await this.client.delete(`/merchants/${merchantId}/products/${productId}`);
            this.cache.delete(`catalog:${merchantId}`);
            return true;
        }
        catch (error) {
            console.error(`Failed to delete product ${productId} for merchant ${merchantId}:`, error);
            return false;
        }
    }
    /**
     * Get all categories
     */
    async getCategories(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/categories`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch categories for merchant ${merchantId}:`, error);
            return [];
        }
    }
    /**
     * Create a new category
     */
    async createCategory(merchantId, category) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/categories`, category);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to create category for merchant ${merchantId}:`, error);
            throw error;
        }
    }
    /**
     * Bulk update product status
     */
    async bulkUpdateStatus(merchantId, productIds, status) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/products/bulk-status`, { product_ids: productIds, status });
            this.cache.delete(`catalog:${merchantId}`);
            return { updated: response.data.updated, failed: productIds.length - response.data.updated };
        }
        catch (error) {
            console.error(`Failed to bulk update products for merchant ${merchantId}:`, error);
            return { updated: 0, failed: productIds.length };
        }
    }
    /**
     * Sync catalog from external source
     */
    async syncCatalog(merchantId, sourceData) {
        const current = await this.getCatalog(merchantId);
        const updated = {
            ...current,
            ...sourceData,
            categories: sourceData.categories || current.categories,
        };
        // In a real implementation, this would sync to the catalog service
        this.cache.delete(`catalog:${merchantId}`);
        return updated;
    }
    getDefaultCatalog() {
        return {
            total_products: 0,
            active_products: 0,
            categories: [],
        };
    }
    getDefaultCatalogSummary() {
        return {
            total_products: 0,
            active_products: 0,
            draft_products: 0,
            archived_products: 0,
            categories: [],
        };
    }
    clearCache(merchantId) {
        if (merchantId) {
            this.cache.delete(`catalog:${merchantId}`);
        }
        else {
            this.cache.clear();
        }
    }
}
exports.CatalogModule = CatalogModule;
//# sourceMappingURL=CatalogModule.js.map