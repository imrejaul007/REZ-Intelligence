"use strict";
/**
 * InventoryModule.ts - Inventory Management Services for Merchant360
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryModule = void 0;
const axios_1 = __importDefault(require("axios"));
class InventoryModule {
    client;
    cache = new Map();
    cacheTTL = 60000; // 1 minute default
    constructor(baseURL) {
        this.client = axios_1.default.create({
            baseURL: baseURL || process.env.INVENTORY_SERVICE_URL || 'http://localhost:4003',
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
     * Get inventory summary for a merchant
     */
    async getInventory(merchantId) {
        const cacheKey = `inventory:${merchantId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }
        try {
            const summary = await this.getInventorySummary(merchantId);
            const inventory = {
                total_items: summary.total_items,
                low_stock_alerts: summary.low_stock_alerts,
                suppliers: [], // Populated from getSuppliers
                last_inventory_sync: summary.last_inventory_sync,
            };
            // Get suppliers
            const suppliers = await this.getSuppliers(merchantId);
            inventory.suppliers = suppliers.map(s => s.id);
            this.cache.set(cacheKey, { data: inventory, timestamp: Date.now() });
            return inventory;
        }
        catch (error) {
            console.error(`Failed to fetch inventory for merchant ${merchantId}:`, error);
            return this.getDefaultInventory();
        }
    }
    /**
     * Get detailed inventory summary
     */
    async getInventorySummary(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/inventory/summary`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch inventory summary for merchant ${merchantId}:`, error);
            return this.getDefaultInventorySummary();
        }
    }
    /**
     * Get all inventory items
     */
    async getItems(merchantId, options = {}) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/inventory/items`, { params: options });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch inventory items for merchant ${merchantId}:`, error);
            return [];
        }
    }
    /**
     * Get single inventory item
     */
    async getItem(merchantId, itemId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/inventory/items/${itemId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch inventory item ${itemId}:`, error);
            return null;
        }
    }
    /**
     * Update inventory quantity
     */
    async updateQuantity(merchantId, itemId, quantity, reason, reference) {
        try {
            const response = await this.client.patch(`/merchants/${merchantId}/inventory/items/${itemId}`, {
                quantity,
                adjustment_reason: reason,
                reference,
            });
            this.cache.delete(`inventory:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to update inventory item ${itemId}:`, error);
            throw error;
        }
    }
    /**
     * Reserve inventory (for orders)
     */
    async reserveInventory(merchantId, reservations) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/inventory/reserve`, { reservations });
            this.cache.delete(`inventory:${merchantId}`);
            return { success: true, reserved_ids: response.data.reserved_ids };
        }
        catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || 'Reservation failed',
            };
        }
    }
    /**
     * Release reserved inventory
     */
    async releaseReservation(merchantId, reservationIds) {
        try {
            await this.client.post(`/merchants/${merchantId}/inventory/release`, { reservation_ids: reservationIds });
            this.cache.delete(`inventory:${merchantId}`);
            return true;
        }
        catch (error) {
            console.error(`Failed to release reservations:`, error);
            return false;
        }
    }
    /**
     * Get stock alerts
     */
    async getAlerts(merchantId, options = {}) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/inventory/alerts`, { params: options });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch stock alerts for merchant ${merchantId}:`, error);
            return [];
        }
    }
    /**
     * Get warehouses
     */
    async getWarehouses(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/inventory/warehouses`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch warehouses for merchant ${merchantId}:`, error);
            return [];
        }
    }
    /**
     * Create a warehouse
     */
    async createWarehouse(merchantId, warehouse) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/inventory/warehouses`, warehouse);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to create warehouse for merchant ${merchantId}:`, error);
            throw error;
        }
    }
    /**
     * Get suppliers
     */
    async getSuppliers(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/inventory/suppliers`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch suppliers for merchant ${merchantId}:`, error);
            return [];
        }
    }
    /**
     * Create a supplier
     */
    async createSupplier(merchantId, supplier) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/inventory/suppliers`, supplier);
            this.cache.delete(`inventory:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to create supplier for merchant ${merchantId}:`, error);
            throw error;
        }
    }
    /**
     * Create purchase order to supplier
     */
    async createPurchaseOrder(merchantId, supplierId, items) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/inventory/purchase-orders`, { supplier_id: supplierId, items });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to create purchase order:`, error);
            throw error;
        }
    }
    /**
     * Perform inventory count (stocktake)
     */
    async performCount(merchantId, warehouseId, counts) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/inventory/count`, { warehouse_id: warehouseId, counts });
            this.cache.delete(`inventory:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to perform inventory count:`, error);
            throw error;
        }
    }
    /**
     * Sync inventory from external source
     */
    async syncInventory(merchantId, sourceData) {
        const current = await this.getInventory(merchantId);
        const updated = {
            ...current,
            ...sourceData,
        };
        this.cache.delete(`inventory:${merchantId}`);
        return updated;
    }
    getDefaultInventory() {
        return {
            total_items: 0,
            low_stock_alerts: 0,
            suppliers: [],
        };
    }
    getDefaultInventorySummary() {
        return {
            total_items: 0,
            total_quantity: 0,
            reserved_quantity: 0,
            available_quantity: 0,
            low_stock_alerts: 0,
            out_of_stock: 0,
            overstock: 0,
            warehouse_count: 0,
            supplier_count: 0,
            last_inventory_sync: new Date().toISOString(),
        };
    }
    clearCache(merchantId) {
        if (merchantId) {
            this.cache.delete(`inventory:${merchantId}`);
        }
        else {
            this.cache.clear();
        }
    }
}
exports.InventoryModule = InventoryModule;
//# sourceMappingURL=InventoryModule.js.map