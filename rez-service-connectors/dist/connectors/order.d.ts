/**
 * Order Service Connector
 *
 * Connects to rez-order-service (Port 3008) for order management,
 * status updates, and fulfillment operations.
 */
import { ServiceClient, ClientConfig } from '../utils/client';
import type { CreateOrderRequest, OrderResponse, UpdateOrderStatusRequest, OrderStatus, ServiceResponse, PaginationParams, PaginatedResponse } from '../types';
/**
 * Order Connector Configuration
 */
interface OrderConfig extends ClientConfig {
    baseUrl: string;
    internalToken: string;
}
export interface OrderListParams extends PaginationParams {
    merchantId?: string;
    userId?: string;
    status?: OrderStatus;
    dateFrom?: string;
    dateTo?: string;
}
/**
 * Order Connector
 *
 * Provides methods to interact with the order service:
 * - Create orders
 * - Get order details
 * - Update order status
 * - List orders with filters
 * - Cancel orders
 */
export declare class OrderConnector extends ServiceClient {
    private config;
    constructor(config?: Partial<OrderConfig>);
    /**
     * Create a new order
     *
     * Creates an order with items, pricing, and delivery details.
     *
     * @param request - Order creation parameters
     * @returns Created order details
     */
    create(request: CreateOrderRequest): Promise<OrderResponse>;
    /**
     * Get order by ID
     *
     * Retrieves full order details including items and status history.
     *
     * @param orderId - The order ID (MongoDB ObjectId or orderNumber)
     * @param fields - Optional specific fields to return
     * @returns Order details
     */
    getOrder(orderId: string, fields?: string[]): Promise<OrderResponse>;
    /**
     * List orders
     *
     * Returns paginated list of orders with optional filters.
     *
     * @param params - List parameters including filters and pagination
     * @returns Paginated order list
     */
    listOrders(params?: OrderListParams): Promise<PaginatedResponse<OrderResponse>>;
    /**
     * Update order status
     *
     * Updates order status following the state machine rules.
     * Validates that the transition is allowed.
     *
     * @param orderId - The order ID
     * @param request - Status update parameters
     * @returns Updated order
     */
    updateStatus(orderId: string, request: UpdateOrderStatusRequest): Promise<OrderResponse>;
    /**
     * Cancel an order
     *
     * Cancels an order. May trigger refund workflow.
     *
     * @param orderId - The order ID
     * @param reason - Cancellation reason
     * @param cancelledBy - Who initiated cancellation (user/merchant/system)
     * @returns Cancellation result
     */
    cancel(orderId: string, reason?: string, cancelledBy?: string): Promise<ServiceResponse>;
    /**
     * Add item to existing order
     *
     * Adds an item to an order in pending/confirmed state.
     *
     * @param orderId - The order ID
     * @param item - Item to add
     * @returns Updated order
     */
    addItem(orderId: string, item: CreateOrderRequest['items'][number]): Promise<OrderResponse>;
    /**
     * Remove item from order
     *
     * Removes an item from an order in pending state.
     *
     * @param orderId - The order ID
     * @param itemId - The item ID to remove
     * @returns Updated order
     */
    removeItem(orderId: string, itemId: string): Promise<OrderResponse>;
    /**
     * Update delivery address
     *
     * Updates delivery address for an order in pending state.
     *
     * @param orderId - The order ID
     * @param address - New delivery address
     * @returns Updated order
     */
    updateDeliveryAddress(orderId: string, address: Record<string, unknown>): Promise<OrderResponse>;
    /**
     * Get order status
     *
     * Lightweight endpoint to get only the order status.
     *
     * @param orderId - The order ID
     * @returns Order status
     */
    getStatus(orderId: string): Promise<{
        status: OrderStatus;
        updatedAt: string;
    }>;
    /**
     * Get order stream (SSE)
     *
     * Returns Server-Sent Events stream for real-time order updates.
     * Useful for merchant dashboards.
     *
     * Note: This returns the URL, the caller should use EventSource API.
     *
     * @param merchantId - The merchant ID to stream orders for
     * @returns Stream endpoint URL
     */
    getStreamUrl(merchantId: string): string;
    /**
     * Health check for order service
     *
     * @returns Health status
     */
    healthCheck(): Promise<{
        healthy: boolean;
        latency?: number;
    }>;
}
export declare function getOrderConnector(config?: Partial<OrderConfig>): OrderConnector;
export default OrderConnector;
//# sourceMappingURL=order.d.ts.map