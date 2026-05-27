/**
 * Swiggy API Client
 * Handles all communication with Swiggy's Partner API
 */

import {
  AggregatorConfig,
  ApiResponse,
  MenuItem,
  AvailabilityUpdate,
  Order,
  OrderStatus,
  SyncResult,
  SyncError,
  SyncWarning,
  HealthCheck,
} from '../types';
import { Logger } from '../utils/logger.js';

// ============================================
// Swiggy-specific types
// ============================================

export interface SwiggyOrder {
  order_id: string;
  order_status: string;
  order_type: 'delivery' | 'pickup' | 'dine_in';
  customer: {
    name: string;
    phone: string;
    address?: {
      address_line1: string;
      address_line2?: string;
      city: string;
      pincode: string;
    };
  };
  items: SwiggyOrderItem[];
  billing: {
    item_total: number;
    tax: number;
    delivery_charge: number;
    packaging_charge: number;
    discount: number;
    total: number;
  };
  payment: {
    mode: 'PREPAID' | 'POSTPAID' | 'CASH';
    status: 'SUCCESS' | 'PENDING' | 'FAILED';
  };
  special_instruction?: string;
  is_priority: boolean;
  created_at: string;
  updated_at: string;
  estimated_delivery_time?: string;
}

export interface SwiggyOrderItem {
  item_id: string;
  item_name: string;
  quantity: number;
  price: number;
  variant?: string;
  add_ons?: SwiggyAddon[];
  item_notes?: string;
}

export interface SwiggyAddon {
  add_on_id: string;
  add_on_name: string;
  price: number;
  quantity: number;
}

export interface SwiggyMenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  image_url?: string;
  is_available: boolean;
  is_veg: boolean;
  is_bestseller?: boolean;
  preparation_time?: number;
  variants?: SwiggyVariant[];
  addons?: SwiggyAddonDefinition[];
}

export interface SwiggyVariant {
  id: string;
  name: string;
  price: number;
  is_default?: boolean;
}

export interface SwiggyAddonDefinition {
  id: string;
  name: string;
  price: number;
  max_quantity?: number;
  is_required?: boolean;
}

export interface SwiggyWebhookPayload {
  event: string;
  timestamp: string;
  store_id: string;
  order_id: string;
  data: Record<string, unknown>;
  signature: string;
}

export interface SwiggyApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================
// Status mapping
// ============================================

const SWIGGY_STATUS_MAP: Record<string, OrderStatus> = {
  NEW: 'new',
  RESTAURANT_CONFIRMED: 'accepted',
  FOOD_PREPARING: 'preparing',
  READY_FOR_PICKUP: 'ready',
  PICKED_UP: 'picked_up',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  PENDING_CONFIRMATION: 'pending_confirmation',
};

// ============================================
// API Client
// ============================================

export class SwiggyClient {
  private readonly config: AggregatorConfig;
  private readonly logger: Logger;
  private readonly baseUrl: string;

  constructor(config: AggregatorConfig, logger?: Logger) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };
    this.logger = logger?.child({ aggregator: 'swiggy' }) || new Logger({}, { aggregator: 'swiggy' });
    this.baseUrl = config.baseUrl || 'https://partner-api.swiggy.com';
  }

  /**
   * Make an authenticated API request with retry logic
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const startTime = Date.now();

    const makeRequest = async (attempt: number): Promise<ApiResponse<T>> => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'x-api-key': this.config.apiKey,
          ...(options.headers as Record<string, string>),
        };

        const response = await fetch(url, {
          ...options,
          headers,
          signal: AbortSignal.timeout(this.config.timeout || 30000),
        });

        const duration = Date.now() - startTime;
        this.logger.apiRequest(
          options.method || 'GET',
          endpoint,
          response.status,
          duration
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})) as SwiggyApiError;
          throw new SwiggyApiException(
            errorData.code || `HTTP_${response.status}`,
            errorData.message || `HTTP Error ${response.status}`,
            response.status,
            errorData.details
          );
        }

        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        if (error instanceof SwiggyApiException) {
          throw error;
        }

        const isRetryable =
          error instanceof TypeError || // Network error
          (error instanceof Error && error.message.includes('timeout'));

        if (isRetryable && attempt < (this.config.retryAttempts || 3)) {
          this.logger.warn(`Retrying request (attempt ${attempt + 1})`, {
            endpoint,
            error: error instanceof Error ? error.message : String(error),
          });
          await this.delay(this.config.retryDelay || 1000 * Math.pow(2, attempt));
          return makeRequest(attempt + 1);
        }

        throw error;
      }
    };

    return makeRequest(0).catch((error) => {
      this.logger.error(`API request failed: ${endpoint}`, error as Error);
      return {
        success: false,
        error: {
          code: error instanceof SwiggyApiException ? error.code : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error instanceof SwiggyApiException ? error.details : undefined,
        },
      };
    }) as Promise<ApiResponse<T>>;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================
  // Order Operations
  // ============================================

  /**
   * Fetch all orders for a store
   */
  async getOrders(storeId: string, params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<SwiggyOrder[]>> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.set('start_date', params.startDate);
    if (params?.endDate) queryParams.set('end_date', params.endDate);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.limit) queryParams.set('limit', String(params.limit));
    if (params?.offset) queryParams.set('offset', String(params.offset));

    const query = queryParams.toString();
    return this.request<SwiggyOrder[]>(
      `/stores/${storeId}/orders${query ? `?${query}` : ''}`
    );
  }

  /**
   * Fetch a single order by ID
   */
  async getOrder(storeId: string, orderId: string): Promise<ApiResponse<SwiggyOrder>> {
    return this.request<SwiggyOrder>(`/stores/${storeId}/orders/${orderId}`);
  }

  /**
   * Accept an order
   */
  async acceptOrder(storeId: string, orderId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>(
      `/stores/${storeId}/orders/${orderId}/accept`,
      { method: 'POST' }
    );
  }

  /**
   * Reject an order
   */
  async rejectOrder(
    storeId: string,
    orderId: string,
    reason: string
  ): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>(
      `/stores/${storeId}/orders/${orderId}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    storeId: string,
    orderId: string,
    status: string,
    metadata?: Record<string, unknown>
  ): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>(
      `/stores/${storeId}/orders/${orderId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status, ...metadata }),
      }
    );
  }

  /**
   * Mark order as ready
   */
  async markOrderReady(
    storeId: string,
    orderId: string
  ): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>(
      `/stores/${storeId}/orders/${orderId}/ready`,
      { method: 'POST' }
    );
  }

  // ============================================
  // Menu Operations
  // ============================================

  /**
   * Get current menu from Swiggy
   */
  async getMenu(storeId: string): Promise<ApiResponse<SwiggyMenuItem[]>> {
    return this.request<SwiggyMenuItem[]>(`/stores/${storeId}/menu`);
  }

  /**
   * Sync menu to Swiggy
   */
  async syncMenu(
    storeId: string,
    menu: MenuItem[]
  ): Promise<ApiResponse<SyncResult>> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    const warnings: SyncWarning[] = [];
    let itemsSuccess = 0;
    let itemsFailed = 0;

    // Transform menu items to Swiggy format
    const swiggyMenu = menu.map((item) => this.transformMenuItemToSwiggy(item));

    const response = await this.request<{ success: boolean; processed: number }>(
      `/stores/${storeId}/menu`,
      {
        method: 'PUT',
        body: JSON.stringify({ items: swiggyMenu }),
      }
    );

    if (!response.success) {
      // Mark all items as failed
      itemsFailed = menu.length;
      menu.forEach((item) => {
        errors.push({
          itemId: item.id,
          itemName: item.name,
          errorCode: 'SYNC_FAILED',
          message: response.error?.message || 'Failed to sync menu',
          retryable: true,
        });
      });
    } else {
      itemsSuccess = response.data?.processed || menu.length;
      itemsFailed = menu.length - itemsSuccess;
    }

    return {
      success: response.success,
      data: {
        success: response.success,
        aggregator: 'swiggy',
        syncedAt: new Date(),
        itemsProcessed: menu.length,
        itemsSuccess,
        itemsFailed,
        errors,
        warnings,
        durationMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Update item availability
   */
  async updateAvailability(
    storeId: string,
    updates: AvailabilityUpdate[]
  ): Promise<ApiResponse<{ success: boolean; updated: number }>> {
    const swiggyUpdates = updates.map((update) => ({
      item_id: update.storeItemId,
      is_available: update.isAvailable,
      reason: update.reason,
      effective_from: update.effectiveFrom?.toISOString(),
    }));

    return this.request<{ success: boolean; updated: number }>(
      `/stores/${storeId}/availability`,
      {
        method: 'PATCH',
        body: JSON.stringify({ updates: swiggyUpdates }),
      }
    );
  }

  // ============================================
  // Webhook Operations
  // ============================================

  /**
   * Register webhook for order events
   */
  async registerWebhook(
    storeId: string,
    webhookUrl: string,
    events: string[]
  ): Promise<ApiResponse<{ success: boolean; webhook_id: string }>> {
    return this.request<{ success: boolean; webhook_id: string }>(
      `/stores/${storeId}/webhooks`,
      {
        method: 'POST',
        body: JSON.stringify({
          url: webhookUrl,
          events,
        }),
      }
    );
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      this.logger.warn('Webhook secret not configured, skipping verification');
      return true;
    }

    // Swiggy uses HMAC-SHA256 for webhook signatures
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payload: unknown): SwiggyWebhookPayload | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const p = payload as Record<string, unknown>;

    if (
      !p.event ||
      !p.timestamp ||
      !p.store_id ||
      !p.order_id
    ) {
      return null;
    }

    return {
      event: String(p.event),
      timestamp: String(p.timestamp),
      store_id: String(p.store_id),
      order_id: String(p.order_id),
      data: (p.data as Record<string, unknown>) || {},
      signature: String(p.signature || ''),
    };
  }

  // ============================================
  // Health Check
  // ============================================

  async healthCheck(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const response = await this.request<{ status: string }>('/health');
      const latency = Date.now() - startTime;

      return {
        aggregator: 'swiggy',
        status: response.success ? 'healthy' : 'degraded',
        latencyMs: latency,
        lastChecked: new Date(),
        error: response.success ? undefined : response.error?.message,
      };
    } catch (error) {
      return {
        aggregator: 'swiggy',
        status: 'down',
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================
  // Transform helpers
  // ============================================

  /**
   * Transform Swiggy order to normalized order
   */
  transformOrderToNormalized(swiggyOrder: SwiggyOrder, storeId: string): Order {
    return {
      id: `swiggy_${swiggyOrder.order_id}`,
      aggregatorOrderId: swiggyOrder.order_id,
      aggregator: 'swiggy',
      storeId,
      customerName: swiggyOrder.customer.name,
      customerPhone: swiggyOrder.customer.phone,
      customerAddress: swiggyOrder.customer.address
        ? `${swiggyOrder.customer.address.address_line1}${swiggyOrder.customer.address.address_line2 ? ', ' + swiggyOrder.customer.address.address_line2 : ''}, ${swiggyOrder.customer.address.city} - ${swiggyOrder.customer.address.pincode}`
        : undefined,
      items: swiggyOrder.items.map((item) => ({
        id: item.item_id,
        name: item.item_name,
        quantity: item.quantity,
        price: item.price,
        variant: item.variant,
        addons: item.add_ons?.map((addon) => ({
          id: addon.add_on_id,
          name: addon.add_on_name,
          price: addon.price,
        })),
        notes: item.item_notes,
      })),
      subtotal: swiggyOrder.billing.item_total,
      tax: swiggyOrder.billing.tax,
      deliveryFee: swiggyOrder.billing.delivery_charge,
      packagingFee: swiggyOrder.billing.packaging_charge,
      discount: swiggyOrder.billing.discount,
      total: swiggyOrder.billing.total,
      paymentMethod: this.mapPaymentMethod(swiggyOrder.payment.mode),
      orderStatus: SWIGGY_STATUS_MAP[swiggyOrder.order_status] || 'new',
      orderType: swiggyOrder.order_type as 'delivery' | 'pickup' | 'dine-in',
      specialInstructions: swiggyOrder.special_instruction,
      createdAt: new Date(swiggyOrder.created_at),
      updatedAt: new Date(swiggyOrder.updated_at),
      estimatedDeliveryTime: swiggyOrder.estimated_delivery_time
        ? new Date(swiggyOrder.estimated_delivery_time)
        : undefined,
      isHighPriority: swiggyOrder.is_priority,
      retryCount: 0,
    };
  }

  /**
   * Transform menu item to Swiggy format
   */
  private transformMenuItemToSwiggy(item: MenuItem): SwiggyMenuItem {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      image_url: item.imageUrl,
      is_available: item.isAvailable,
      is_veg: item.isVeg,
      is_bestseller: item.isBestseller,
      preparation_time: item.preparationTime,
      variants: item.variants?.map((v) => ({
        id: v.id,
        name: v.name,
        price: v.price,
        is_default: v.isDefault,
      })),
      addons: item.addons?.map((a) => ({
        id: a.id,
        name: a.name,
        price: a.price,
        max_quantity: a.maxQuantity,
        is_required: a.isRequired,
      })),
    };
  }

  private mapPaymentMethod(mode: string): 'prepaid' | 'cod' | 'upi' | 'card' {
    switch (mode) {
      case 'PREPAID':
        return 'upi';
      case 'POSTPAID':
        return 'card';
      case 'CASH':
        return 'cod';
      default:
        return 'cod';
    }
  }
}

// ============================================
// Custom Exception
// ============================================

class SwiggyApiException extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SwiggyApiException';
  }
}

export default SwiggyClient;
