import { BaseConnector } from './baseConnector';
import type {
  Logger,
  RetryOptions,
  CircuitBreakerOptions,
  CreateOrderRequest,
  OrderResult,
  OrderItem,
  Address,
  HttpResponse,
} from '../types';

// ============================================================================
// Order Service Types
// ============================================================================

export interface UpdateOrderRequest {
  items?: OrderItem[];
  shippingAddress?: Address;
  billingAddress?: Address;
  metadata?: Record<string, unknown>;
}

export interface OrderListResult {
  orders: OrderResult[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrderStatusUpdate {
  orderId: string;
  previousStatus: string;
  newStatus: string;
  updatedBy: string;
  timestamp: string;
}

export interface OrderCancellation {
  orderId: string;
  reason: string;
  cancelledBy: string;
  cancelledAt: string;
  refundId?: string;
}

// ============================================================================
// Order Connector
// ============================================================================

export class OrderConnector extends BaseConnector {
  constructor(
    baseUrl: string,
    authToken: string,
    options: {
      logger?: Logger;
      timeout?: number;
      retry?: RetryOptions;
      circuitBreaker?: CircuitBreakerOptions;
    } = {},
  ) {
    super('order-service', baseUrl, authToken, options);
  }

  /**
   * Create a new order
   */
  async createOrder(
    items: OrderItem[],
    request: Omit<CreateOrderRequest, 'items'> & { items: OrderItem[] },
  ): Promise<OrderResult> {
    this.logger.info('Creating order', {
      customerId: request.customerId,
      itemCount: items.length,
    });

    const fullRequest: CreateOrderRequest = {
      ...request,
      items,
    };

    const response = await this.post<OrderResult>('/orders', fullRequest);
    this.logger.info('Order created successfully', {
      orderId: response.data.orderId,
      customerId: request.customerId,
    });
    return response.data;
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<OrderResult> {
    this.logger.debug('Getting order', { orderId });

    const response = await this.get<OrderResult>(`/orders/${orderId}`);
    return response.data;
  }

  /**
   * Update order
   */
  async updateOrder(orderId: string, updates: UpdateOrderRequest): Promise<OrderResult> {
    this.logger.info('Updating order', { orderId });

    const response = await this.patch<OrderResult>(`/orders/${orderId}`, updates);
    this.logger.info('Order updated successfully', { orderId });
    return response.data;
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: string,
    metadata?: Record<string, unknown>,
  ): Promise<OrderResult> {
    this.logger.info('Updating order status', { orderId, status });

    const response = await this.post<OrderResult>(`/orders/${orderId}/status`, {
      status,
      metadata,
    });
    this.logger.info('Order status updated', { orderId, status });
    return response.data;
  }

  /**
   * Cancel order
   */
  async cancelOrder(
    orderId: string,
    reason: string,
    requestRefund?: boolean,
  ): Promise<OrderCancellation> {
    this.logger.info('Cancelling order', { orderId, reason });

    const response = await this.post<OrderCancellation>(`/orders/${orderId}/cancel`, {
      reason,
      requestRefund,
    });
    this.logger.info('Order cancelled', { orderId });
    return response.data;
  }

  /**
   * Get orders for a customer
   */
  async getCustomerOrders(
    customerId: string,
    options?: {
      page?: number;
      pageSize?: number;
      status?: string;
      fromDate?: string;
      toDate?: string;
    },
  ): Promise<OrderListResult> {
    this.logger.debug('Getting customer orders', { customerId, options });

    const params: Record<string, string> = {};

    if (options?.page) params.page = String(options.page);
    if (options?.pageSize) params.pageSize = String(options.pageSize);
    if (options?.status) params.status = options.status;
    if (options?.fromDate) params.fromDate = options.fromDate;
    if (options?.toDate) params.toDate = options.toDate;

    const response = await this.get<OrderListResult>(`/orders/customer/${customerId}`, params);
    return response.data;
  }

  /**
   * Get orders by status
   */
  async getOrdersByStatus(
    status: string,
    options?: {
      page?: number;
      pageSize?: number;
    },
  ): Promise<OrderListResult> {
    this.logger.debug('Getting orders by status', { status, options });

    const params: Record<string, string> = { status };

    if (options?.page) params.page = String(options.page);
    if (options?.pageSize) params.pageSize = String(options.pageSize);

    const response = await this.get<OrderListResult>('/orders', params);
    return response.data;
  }

  /**
   * Add items to order
   */
  async addItems(
    orderId: string,
    items: OrderItem[],
  ): Promise<OrderResult> {
    this.logger.info('Adding items to order', {
      orderId,
      itemCount: items.length,
    });

    const response = await this.post<OrderResult>(`/orders/${orderId}/items`, { items });
    this.logger.info('Items added to order', { orderId });
    return response.data;
  }

  /**
   * Remove items from order
   */
  async removeItems(
    orderId: string,
    itemIds: string[],
  ): Promise<OrderResult> {
    this.logger.info('Removing items from order', {
      orderId,
      itemCount: itemIds.length,
    });

    const response = await this.delete<OrderResult>(`/orders/${orderId}/items`,);
    return response.data;
  }

  /**
   * Update shipping address
   */
  async updateShippingAddress(
    orderId: string,
    address: Address,
  ): Promise<OrderResult> {
    this.logger.info('Updating shipping address', { orderId });

    const response = await this.put<OrderResult>(`/orders/${orderId}/shipping`, { address });
    return response.data;
  }

  /**
   * Get order status history
   */
  async getOrderStatusHistory(orderId: string): Promise<OrderStatusUpdate[]> {
    this.logger.debug('Getting order status history', { orderId });

    const response = await this.get<OrderStatusUpdate[]>(`/orders/${orderId}/status-history`);
    return response.data;
  }

  /**
   * Confirm order
   */
  async confirmOrder(
    orderId: string,
    paymentId: string,
  ): Promise<OrderResult> {
    this.logger.info('Confirming order', { orderId, paymentId });

    const response = await this.post<OrderResult>(`/orders/${orderId}/confirm`, {
      paymentId,
    });
    this.logger.info('Order confirmed', { orderId });
    return response.data;
  }

  /**
   * Ship order
   */
  async shipOrder(
    orderId: string,
    trackingInfo?: {
      carrier: string;
      trackingNumber: string;
      estimatedDelivery?: string;
    },
  ): Promise<OrderResult> {
    this.logger.info('Shipping order', { orderId, trackingInfo });

    const response = await this.post<OrderResult>(`/orders/${orderId}/ship`, {
      trackingInfo,
    });
    this.logger.info('Order shipped', { orderId });
    return response.data;
  }

  /**
   * Mark order as delivered
   */
  async deliverOrder(orderId: string): Promise<OrderResult> {
    this.logger.info('Marking order as delivered', { orderId });

    const response = await this.post<OrderResult>(`/orders/${orderId}/deliver`);
    this.logger.info('Order delivered', { orderId });
    return response.data;
  }

  /**
   * Calculate order totals
   */
  async calculateTotals(
    items: OrderItem[],
    shippingAddress?: Address,
  ): Promise<{
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
    total: number;
  }> {
    this.logger.debug('Calculating order totals', { itemCount: items.length });

    const response = await this.post<{
      subtotal: number;
      tax: number;
      shipping: number;
      discount: number;
      total: number;
    }>('/orders/calculate', {
      items,
      shippingAddress,
    });
    return response.data;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createOrderConnector(
  baseUrl: string,
  authToken: string,
  options?: {
    logger?: Logger;
    timeout?: number;
    retry?: RetryOptions;
    circuitBreaker?: CircuitBreakerOptions;
  },
): OrderConnector {
  return new OrderConnector(baseUrl, authToken, options);
}
