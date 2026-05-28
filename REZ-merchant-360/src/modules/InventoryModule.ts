/**
 * InventoryModule.ts - Inventory Management Services for Merchant360
 */

import axios, { AxiosInstance } from 'axios';
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

export class InventoryModule {
  private client: AxiosInstance;
  private cache: Map<string, { data: Inventory; timestamp: number }> = new Map();
  private cacheTTL: number = 60000; // 1 minute default

  constructor(baseURL?: string) {
    this.client = axios.create({
      baseURL: baseURL || process.env.INVENTORY_SERVICE_URL || 'http://localhost:4003',
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
   * Get inventory summary for a merchant
   */
  async getInventory(merchantId: string): Promise<Inventory> {
    const cacheKey = `inventory:${merchantId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const summary = await this.getInventorySummary(merchantId);

      const inventory: Inventory = {
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
    } catch (error) {
      console.error(`Failed to fetch inventory for merchant ${merchantId}:`, error);
      return this.getDefaultInventory();
    }
  }

  /**
   * Get detailed inventory summary
   */
  async getInventorySummary(merchantId: string): Promise<InventorySummary> {
    try {
      const response = await this.client.get<InventorySummary>(
        `/merchants/${merchantId}/inventory/summary`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch inventory summary for merchant ${merchantId}:`, error);
      return this.getDefaultInventorySummary();
    }
  }

  /**
   * Get all inventory items
   */
  async getItems(
    merchantId: string,
    options: {
      limit?: number;
      offset?: number;
      warehouse_id?: string;
      alert_type?: StockAlert['alert_type'];
      low_stock_only?: boolean;
      out_of_stock_only?: boolean;
    } = {}
  ): Promise<InventoryItem[]> {
    try {
      const response = await this.client.get<InventoryItem[]>(
        `/merchants/${merchantId}/inventory/items`,
        { params: options }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch inventory items for merchant ${merchantId}:`, error);
      return [];
    }
  }

  /**
   * Get single inventory item
   */
  async getItem(merchantId: string, itemId: string): Promise<InventoryItem | null> {
    try {
      const response = await this.client.get<InventoryItem>(
        `/merchants/${merchantId}/inventory/items/${itemId}`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch inventory item ${itemId}:`, error);
      return null;
    }
  }

  /**
   * Update inventory quantity
   */
  async updateQuantity(
    merchantId: string,
    itemId: string,
    quantity: number,
    reason: string,
    reference?: string
  ): Promise<InventoryItem> {
    try {
      const response = await this.client.patch<InventoryItem>(
        `/merchants/${merchantId}/inventory/items/${itemId}`,
        {
          quantity,
          adjustment_reason: reason,
          reference,
        }
      );
      this.cache.delete(`inventory:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to update inventory item ${itemId}:`, error);
      throw error;
    }
  }

  /**
   * Reserve inventory (for orders)
   */
  async reserveInventory(
    merchantId: string,
    reservations: { item_id: string; quantity: number }[]
  ): Promise<{ success: boolean; reserved_ids?: string[]; error?: string }> {
    try {
      const response = await this.client.post<{ reserved_ids: string[] }>(
        `/merchants/${merchantId}/inventory/reserve`,
        { reservations }
      );
      this.cache.delete(`inventory:${merchantId}`);
      return { success: true, reserved_ids: response.data.reserved_ids };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return {
        success: false,
        error: err.response?.data?.message || 'Reservation failed',
      };
    }
  }

  /**
   * Release reserved inventory
   */
  async releaseReservation(
    merchantId: string,
    reservationIds: string[]
  ): Promise<boolean> {
    try {
      await this.client.post(
        `/merchants/${merchantId}/inventory/release`,
        { reservation_ids: reservationIds }
      );
      this.cache.delete(`inventory:${merchantId}`);
      return true;
    } catch (error) {
      console.error(`Failed to release reservations:`, error);
      return false;
    }
  }

  /**
   * Get stock alerts
   */
  async getAlerts(
    merchantId: string,
    options: {
      type?: StockAlert['alert_type'];
      warehouse_id?: string;
      limit?: number;
    } = {}
  ): Promise<StockAlert[]> {
    try {
      const response = await this.client.get<StockAlert[]>(
        `/merchants/${merchantId}/inventory/alerts`,
        { params: options }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch stock alerts for merchant ${merchantId}:`, error);
      return [];
    }
  }

  /**
   * Get warehouses
   */
  async getWarehouses(merchantId: string): Promise<Warehouse[]> {
    try {
      const response = await this.client.get<Warehouse[]>(
        `/merchants/${merchantId}/inventory/warehouses`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch warehouses for merchant ${merchantId}:`, error);
      return [];
    }
  }

  /**
   * Create a warehouse
   */
  async createWarehouse(merchantId: string, warehouse: Partial<Warehouse>): Promise<Warehouse> {
    try {
      const response = await this.client.post<Warehouse>(
        `/merchants/${merchantId}/inventory/warehouses`,
        warehouse
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to create warehouse for merchant ${merchantId}:`, error);
      throw error;
    }
  }

  /**
   * Get suppliers
   */
  async getSuppliers(merchantId: string): Promise<Supplier[]> {
    try {
      const response = await this.client.get<Supplier[]>(
        `/merchants/${merchantId}/inventory/suppliers`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch suppliers for merchant ${merchantId}:`, error);
      return [];
    }
  }

  /**
   * Create a supplier
   */
  async createSupplier(merchantId: string, supplier: Partial<Supplier>): Promise<Supplier> {
    try {
      const response = await this.client.post<Supplier>(
        `/merchants/${merchantId}/inventory/suppliers`,
        supplier
      );
      this.cache.delete(`inventory:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to create supplier for merchant ${merchantId}:`, error);
      throw error;
    }
  }

  /**
   * Create purchase order to supplier
   */
  async createPurchaseOrder(
    merchantId: string,
    supplierId: string,
    items: { item_id: string; quantity: number; unit_cost: number }[]
  ): Promise<{ order_id: string; total_cost: number }> {
    try {
      const response = await this.client.post(
        `/merchants/${merchantId}/inventory/purchase-orders`,
        { supplier_id: supplierId, items }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to create purchase order:`, error);
      throw error;
    }
  }

  /**
   * Perform inventory count (stocktake)
   */
  async performCount(
    merchantId: string,
    warehouseId: string,
    counts: { item_id: string; counted_quantity: number }[]
  ): Promise<{ variances: { item_id: string; expected: number; actual: number; variance: number }[] }> {
    try {
      const response = await this.client.post(
        `/merchants/${merchantId}/inventory/count`,
        { warehouse_id: warehouseId, counts }
      );
      this.cache.delete(`inventory:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to perform inventory count:`, error);
      throw error;
    }
  }

  /**
   * Sync inventory from external source
   */
  async syncInventory(merchantId: string, sourceData: Partial<Inventory>): Promise<Inventory> {
    const current = await this.getInventory(merchantId);
    const updated: Inventory = {
      ...current,
      ...sourceData,
    };

    this.cache.delete(`inventory:${merchantId}`);
    return updated;
  }

  private getDefaultInventory(): Inventory {
    return {
      total_items: 0,
      low_stock_alerts: 0,
      suppliers: [],
    };
  }

  private getDefaultInventorySummary(): InventorySummary {
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

  clearCache(merchantId?: string): void {
    if (merchantId) {
      this.cache.delete(`inventory:${merchantId}`);
    } else {
      this.cache.clear();
    }
  }
}
