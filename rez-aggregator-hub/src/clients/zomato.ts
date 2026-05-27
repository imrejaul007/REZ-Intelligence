/**
 * Zomato API Client
 * Handles all communication with Zomato's Partner API
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
// Zomato-specific types
// ============================================

export interface ZomatoOrder {
  order_id: string;
  order_status: string;
  order_type: 'delivery' | 'pickup' | 'dine_in';
  customer: {
    name: string;
    phone: string;
    address?: {
      address_line_1: string;
      address_line_2?: string;
      city: string;
      pincode: string;
      landmark?: string;
    };
  };
  items: ZomatoOrderItem[];
  billing: {
    subtotal: number;
    tax: number;
    delivery_fee: number;
    packaging_charge: number;
    discount: number;
    total: number;
  };
  payment: {
    method: 'PREPAID' | 'COD' | 'CARD' | 'WALLET';
    status: 'SUCCESS' | 'PENDING' | 'FAILED';
  };
  special_instructions?: string;
  is_priority: boolean;
  created_at: string;
  updated_at: string;
  estimated_delivery_time?: string;
}

export interface ZomatoOrderItem {
  item_id: string;
  item_name: string;
  quantity: number;
  price: number;
  variant?: string;
  add_ons?: ZomatoAddon[];
  item_notes?: string;
}

export interface ZomatoAddon {
  addon_id: string;
  addon_name: string;
  price: number;
  quantity: number;
}

export interface ZomatoMenuItem {
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
  variants?: ZomatoVariant[];
  addons?: ZomatoAddonDefinition[];
  tags?: string[];
}

export interface ZomatoVariant {
  id: string;
  name: string;
  price: number;
  is_default?: boolean;
}

export interface ZomatoAddonDefinition {
  id: string;
  name: string;
  price: number;
  max_quantity?: number;
  is_required?: boolean;
}

export interface ZomatoWebhookPayload {
  event: string;
  timestamp: string;
  restaurant_id: string;
  order_id: string;
  data: Record<string, unknown>;
  signature: string;
}

export interface ZomatoApiError {
  error_code: string;
  error_message: string;
  details?: Record<string, unknown>;
}

export interface ZomatoAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

// ============================================
// Status mapping
// ============================================

const ZOMATO_STATUS_MAP: Record<string, OrderStatus> = {
  NEW: 'new',
  CONFIRMED: 'accepted',
  PREPARING: 'preparing',
  READY: 'ready',
  PICKED_UP: 'picked_up',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  PENDING: 'pending_confirmation',
};

// ============================================
// API Client
// ============================================

export class ZomatoClient {
  private readonly config: AggregatorConfig;
  private readonly logger: Logger;
  private readonly baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: AggregatorConfig, logger?: Logger) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };
    this.logger = logger?.child({ aggregator: 'zomato' }) || new Logger({}, { aggregator: 'zomato' });
    this.baseUrl = config.baseUrl || 'https://api.zomato.com/v2';
  }

  /**
   * Get authentication token (Zomato uses OAuth2)
   */
  private async getAccessToken(): Promise<string | null> {
    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    // For Zomato, the API key is typically used directly
    // If they provide an access token, use it
    if (this.config.apiKey) {
      this.accessToken = this.config.apiKey;
      this.tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      return this.accessToken;
    }

    return null;
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
    const token = await this.getAccessToken();

    const makeRequest = async (attempt: number): Promise<ApiResponse<T>> => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(options.headers as Record<string, string>),
        };

        // Add authentication
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        headers['x-zomato-api-key'] = this.config.apiKey;
        headers['x-zomato-restaurant-id'] = this.config.storeId;

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
          const errorData = await response.json().catch(() => ({})) as ZomatoApiError;
          throw new ZomatoApiException(
            errorData.error_code || `HTTP_${response.status}`,
            errorData.error_message || `HTTP Error ${response.status}`,
            response.status,
            errorData.details
          );
        }

        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        if (error instanceof ZomatoApiException) {
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
          code: error instanceof ZomatoApiException ? error.code : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error instanceof ZomatoApiException ? error.details : undefined,
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
   * Fetch all orders for a restaurant
   */
  async getOrders(params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<ZomatoOrder[]>> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.set('start_date', params.startDate);
    if (params?.endDate) queryParams.set('end_date', params.endDate);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.limit) queryParams.set('limit', String(params.limit));
    if (params?.offset) queryParams.set('offset', String(params.offset));

    const query = queryParams.toString();
    return this.request<ZomatoOrder[]>(
      `/orders${query ? `?${query}` : ''}`
    );
  }

  /**
   * Fetch a single order by ID
   */
  async getOrder(orderId: string): Promise<ApiResponse<ZomatoOrder>> {
    return this.request<ZomatoOrder>(`/orders/${orderId}`);
  }

  /**
   * Accept an order
   */
  async acceptOrder(orderId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>(
      `/orders/${orderId}/accept`,
      { method: 'POST' }
    );
  }

  /**
   * Reject an order
   */
  async rejectOrder(
    orderId: string,
    reason: string
  ): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>(
      `/orders/${orderId}/reject`,
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
    orderId: string,
    status: string,
    metadata?: Record<string, unknown>
  ): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>(
      `/orders/${orderId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status, ...metadata }),
      }
    );
  }

  /**
   * Mark order as ready
   */
  async markOrderReady(orderId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request<{ success: boolean }>(
      `/orders/${orderId}/ready`,
      { method: 'POST' }
    );
  }

  // ============================================
  // Menu Operations
  // ============================================

  /**
   * Get current menu from Zomato
   */
  async getMenu(): Promise<ApiResponse<ZomatoMenuItem[]>> {
    return this.request<ZomatoMenuItem[]>('/menu');
  }

  /**
   * Sync menu to Zomato
   */
  async syncMenu(menu: MenuItem[]): Promise<ApiResponse<SyncResult>> {
    const startTime = Date.now();
    const errors: SyncError[] = [];
    const warnings: SyncWarning[] = [];
    let itemsSuccess = 0;
    let itemsFailed = 0;

    // Transform menu items to Zomato format
    const zomatoMenu = menu.map((item) => this.transformMenuItemToZomato(item));

    const response = await this.request<{ success: boolean; processed: number }>(
      '/menu',
      {
        method: 'PUT',
        body: JSON.stringify({ items: zomatoMenu }),
      }
    );

    if (!response.success) {
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
        aggregator: 'zomato',
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
    updates: AvailabilityUpdate[]
  ): Promise<ApiResponse<{ success: boolean; updated: number }>> {
    const zomatoUpdates = updates.map((update) => ({
      item_id: update.storeItemId,
      is_available: update.isAvailable,
      reason: update.reason,
      effective_from: update.effectiveFrom?.toISOString(),
    }));

    return this.request<{ success: boolean; updated: number }>(
      '/availability',
      {
        method: 'PATCH',
        body: JSON.stringify({ updates: zomatoUpdates }),
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
    webhookUrl: string,
    events: string[]
  ): Promise<ApiResponse<{ success: boolean; webhook_id: string }>> {
    return this.request<{ success: boolean; webhook_id: string }>(
      '/webhooks',
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

    // Zomato uses HMAC-SHA256 for webhook signatures
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
  parseWebhookPayload(payload: unknown): ZomatoWebhookPayload | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const p = payload as Record<string, unknown>;

    if (
      !p.event ||
      !p.timestamp ||
      !p.restaurant_id ||
      !p.order_id
    ) {
      return null;
    }

    return {
      event: String(p.event),
      timestamp: String(p.timestamp),
      restaurant_id: String(p.restaurant_id),
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
        aggregator: 'zomato',
        status: response.success ? 'healthy' : 'degraded',
        latencyMs: latency,
        lastChecked: new Date(),
        error: response.success ? undefined : response.error?.message,
      };
    } catch (error) {
      return {
        aggregator: 'zomato',
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
   * Transform Zomato order to normalized order
   */
  transformOrderToNormalized(zomatoOrder: ZomatoOrder, storeId: string): Order {
    return {
      id: `zomato_${zomatoOrder.order_id}`,
      aggregatorOrderId: zomatoOrder.order_id,
      aggregator: 'zomato',
      storeId,
      customerName: zomatoOrder.customer.name,
      customerPhone: zomatoOrder.customer.phone,
      customerAddress: zomatoOrder.customer.address
        ? `${zomatoOrder.customer.address.address_line_1}${zomatoOrder.customer.address.address_line_2 ? ', ' + zomatoOrder.customer.address.address_line_2 : ''}${zomatoOrder.customer.address.landmark ? ', Landmark: ' + zomatoOrder.customer.address.landmark : ''}, ${zomatoOrder.customer.address.city} - ${zomatoOrder.customer.address.pincode}`
        : undefined,
      items: zomatoOrder.items.map((item) => ({
        id: item.item_id,
        name: item.item_name,
        quantity: item.quantity,
        price: item.price,
        variant: item.variant,
        addons: item.add_ons?.map((addon) => ({
          id: addon.addon_id,
          name: addon.addon_name,
          price: addon.price,
        })),
        notes: item.item_notes,
      })),
      subtotal: zomatoOrder.billing.subtotal,
      tax: zomatoOrder.billing.tax,
      deliveryFee: zomatoOrder.billing.delivery_fee,
      packagingFee: zomatoOrder.billing.packaging_charge,
      discount: zomatoOrder.billing.discount,
      total: zomatoOrder.billing.total,
      paymentMethod: this.mapPaymentMethod(zomatoOrder.payment.method),
      orderStatus: ZOMATO_STATUS_MAP[zomatoOrder.order_status] || 'new',
      orderType: zomatoOrder.order_type as 'delivery' | 'pickup' | 'dine-in',
      specialInstructions: zomatoOrder.special_instructions,
      createdAt: new Date(zomatoOrder.created_at),
      updatedAt: new Date(zomatoOrder.updated_at),
      estimatedDeliveryTime: zomatoOrder.estimated_delivery_time
        ? new Date(zomatoOrder.estimated_delivery_time)
        : undefined,
      isHighPriority: zomatoOrder.is_priority,
      retryCount: 0,
    };
  }

  /**
   * Transform menu item to Zomato format
   */
  private transformMenuItemToZomato(item: MenuItem): ZomatoMenuItem {
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
      tags: item.tags,
    };
  }

  private mapPaymentMethod(method: string): 'prepaid' | 'cod' | 'upi' | 'card' {
    switch (method) {
      case 'PREPAID':
      case 'WALLET':
        return 'upi';
      case 'CARD':
        return 'card';
      case 'COD':
        return 'cod';
      default:
        return 'cod';
    }
  }
}

// ============================================
// Custom Exception
// ============================================

class ZomatoApiException extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ZomatoApiException';
  }
}

export default ZomatoClient;
