import { BaseConnector } from './baseConnector';
import type { Logger, RetryOptions, CircuitBreakerOptions, CreateOrderRequest, OrderResult, OrderItem, Address } from '../types';
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
export declare class OrderConnector extends BaseConnector {
    constructor(baseUrl: string, authToken: string, options?: {
        logger?: Logger;
        timeout?: number;
        retry?: RetryOptions;
        circuitBreaker?: CircuitBreakerOptions;
    });
    /**
     * Create a new order
     */
    createOrder(items: OrderItem[], request: Omit<CreateOrderRequest, 'items'> & {
        items: OrderItem[];
    }): Promise<OrderResult>;
    /**
     * Get order by ID
     */
    getOrder(orderId: string): Promise<OrderResult>;
    /**
     * Update order
     */
    updateOrder(orderId: string, updates: UpdateOrderRequest): Promise<OrderResult>;
    /**
     * Update order status
     */
    updateOrderStatus(orderId: string, status: string, metadata?: Record<string, unknown>): Promise<OrderResult>;
    /**
     * Cancel order
     */
    cancelOrder(orderId: string, reason: string, requestRefund?: boolean): Promise<OrderCancellation>;
    /**
     * Get orders for a customer
     */
    getCustomerOrders(customerId: string, options?: {
        page?: number;
        pageSize?: number;
        status?: string;
        fromDate?: string;
        toDate?: string;
    }): Promise<OrderListResult>;
    /**
     * Get orders by status
     */
    getOrdersByStatus(status: string, options?: {
        page?: number;
        pageSize?: number;
    }): Promise<OrderListResult>;
    /**
     * Add items to order
     */
    addItems(orderId: string, items: OrderItem[]): Promise<OrderResult>;
    /**
     * Remove items from order
     */
    removeItems(orderId: string, itemIds: string[]): Promise<OrderResult>;
    /**
     * Update shipping address
     */
    updateShippingAddress(orderId: string, address: Address): Promise<OrderResult>;
    /**
     * Get order status history
     */
    getOrderStatusHistory(orderId: string): Promise<OrderStatusUpdate[]>;
    /**
     * Confirm order
     */
    confirmOrder(orderId: string, paymentId: string): Promise<OrderResult>;
    /**
     * Ship order
     */
    shipOrder(orderId: string, trackingInfo?: {
        carrier: string;
        trackingNumber: string;
        estimatedDelivery?: string;
    }): Promise<OrderResult>;
    /**
     * Mark order as delivered
     */
    deliverOrder(orderId: string): Promise<OrderResult>;
    /**
     * Calculate order totals
     */
    calculateTotals(items: OrderItem[], shippingAddress?: Address): Promise<{
        subtotal: number;
        tax: number;
        shipping: number;
        discount: number;
        total: number;
    }>;
}
export declare function createOrderConnector(baseUrl: string, authToken: string, options?: {
    logger?: Logger;
    timeout?: number;
    retry?: RetryOptions;
    circuitBreaker?: CircuitBreakerOptions;
}): OrderConnector;
//# sourceMappingURL=order.d.ts.map