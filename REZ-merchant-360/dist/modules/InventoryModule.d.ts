/**
 * InventoryModule.ts - Inventory Management Services for Merchant360
 */
import { Inventory } from '../MerchantProfile';
export interface InventoryItem {
    id: string;
    sku: string;
    product_id: string;
    variant_id?: string;
    warehouse_id: string;
    quantity: number;
    reserved_quantity: number;
    available_quantity: number;
    reorder_point: number;
    reorder_quantity: number;
    last_counted_at?: string;
    created_at: string;
    updated_at: string;
}
export interface Warehouse {
    id: string;
    merchant_id: string;
    name: string;
    address: string;
    is_primary: boolean;
    item_count: number;
}
export interface StockAlert {
    id: string;
    item_id: string;
    sku: string;
    product_name: string;
    warehouse_id: string;
    warehouse_name: string;
    current_quantity: number;
    reorder_point: number;
    alert_type: 'low_stock' | 'out_of_stock' | 'overstock';
    created_at: string;
}
export interface Supplier {
    id: string;
    merchant_id: string;
    name: string;
    contact_email: string;
    contact_phone?: string;
    lead_time_days: number;
    minimum_order_value: number;
    rating: number;
    is_active: boolean;
}
export interface InventorySummary {
    total_items: number;
    total_quantity: number;
    reserved_quantity: number;
    available_quantity: number;
    low_stock_alerts: number;
    out_of_stock: number;
    overstock: number;
    warehouse_count: number;
    supplier_count: number;
    last_inventory_sync: string;
}
export declare class InventoryModule {
    private client;
    private cache;
    private cacheTTL;
    constructor(baseURL?: string);
    setCacheTTL(ttl: number): void;
    /**
     * Get inventory summary for a merchant
     */
    getInventory(merchantId: string): Promise<Inventory>;
    /**
     * Get detailed inventory summary
     */
    getInventorySummary(merchantId: string): Promise<InventorySummary>;
    /**
     * Get all inventory items
     */
    getItems(merchantId: string, options?: {
        limit?: number;
        offset?: number;
        warehouse_id?: string;
        alert_type?: StockAlert['alert_type'];
        low_stock_only?: boolean;
        out_of_stock_only?: boolean;
    }): Promise<InventoryItem[]>;
    /**
     * Get single inventory item
     */
    getItem(merchantId: string, itemId: string): Promise<InventoryItem | null>;
    /**
     * Update inventory quantity
     */
    updateQuantity(merchantId: string, itemId: string, quantity: number, reason: string, reference?: string): Promise<InventoryItem>;
    /**
     * Reserve inventory (for orders)
     */
    reserveInventory(merchantId: string, reservations: {
        item_id: string;
        quantity: number;
    }[]): Promise<{
        success: boolean;
        reserved_ids?: string[];
        error?: string;
    }>;
    /**
     * Release reserved inventory
     */
    releaseReservation(merchantId: string, reservationIds: string[]): Promise<boolean>;
    /**
     * Get stock alerts
     */
    getAlerts(merchantId: string, options?: {
        type?: StockAlert['alert_type'];
        warehouse_id?: string;
        limit?: number;
    }): Promise<StockAlert[]>;
    /**
     * Get warehouses
     */
    getWarehouses(merchantId: string): Promise<Warehouse[]>;
    /**
     * Create a warehouse
     */
    createWarehouse(merchantId: string, warehouse: Partial<Warehouse>): Promise<Warehouse>;
    /**
     * Get suppliers
     */
    getSuppliers(merchantId: string): Promise<Supplier[]>;
    /**
     * Create a supplier
     */
    createSupplier(merchantId: string, supplier: Partial<Supplier>): Promise<Supplier>;
    /**
     * Create purchase order to supplier
     */
    createPurchaseOrder(merchantId: string, supplierId: string, items: {
        item_id: string;
        quantity: number;
        unit_cost: number;
    }[]): Promise<{
        order_id: string;
        total_cost: number;
    }>;
    /**
     * Perform inventory count (stocktake)
     */
    performCount(merchantId: string, warehouseId: string, counts: {
        item_id: string;
        counted_quantity: number;
    }[]): Promise<{
        variances: {
            item_id: string;
            expected: number;
            actual: number;
            variance: number;
        }[];
    }>;
    /**
     * Sync inventory from external source
     */
    syncInventory(merchantId: string, sourceData: Partial<Inventory>): Promise<Inventory>;
    private getDefaultInventory;
    private getDefaultInventorySummary;
    clearCache(merchantId?: string): void;
}
//# sourceMappingURL=InventoryModule.d.ts.map