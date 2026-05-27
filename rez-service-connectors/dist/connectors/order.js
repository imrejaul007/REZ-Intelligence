"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderConnector = void 0;
exports.getOrderConnector = getOrderConnector;
const logger_js_1 = __importDefault(require("./utils/logger.js"));
/**
 * Order Service Connector
 *
 * Connects to rez-order-service (Port 3008) for order management,
 * status updates, and fulfillment operations.
 */
const client_1 = require("../utils/client");
const DEFAULT_CONFIG = {
    timeout: 30000,
    maxRetries: 3,
};
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
class OrderConnector extends client_1.ServiceClient {
    config;
    constructor(config = {}) {
        const orderUrl = config.baseUrl || process.env.ORDER_SERVICE_URL || 'http://localhost:3008';
        const internalToken = config.internalToken || getInternalToken();
        const mergedConfig = {
            ...DEFAULT_CONFIG,
            ...config,
            baseUrl: orderUrl,
            internalToken,
            serviceName: 'order-service',
        };
        super(mergedConfig);
        this.config = mergedConfig;
    }
    /**
     * Create a new order
     *
     * Creates an order with items, pricing, and delivery details.
     *
     * @param request - Order creation parameters
     * @returns Created order details
     */
    async create(request) {
        return this.safeRequest({
            method: 'POST',
            url: '/orders',
            data: {
                merchantId: request.merchantId,
                userId: request.userId,
                items: request.items,
                total: request.total,
                paymentMethod: request.paymentMethod,
                deliveryAddress: request.deliveryAddress,
                notes: request.notes,
                metadata: {
                    ...request.metadata,
                    createdBy: 'orchestrator',
                    createdAt: new Date().toISOString(),
                },
            },
        });
    }
    /**
     * Get order by ID
     *
     * Retrieves full order details including items and status history.
     *
     * @param orderId - The order ID (MongoDB ObjectId or orderNumber)
     * @param fields - Optional specific fields to return
     * @returns Order details
     */
    async getOrder(orderId, fields) {
        return this.safeRequest({
            method: 'GET',
            url: `/orders/${orderId}`,
            params: fields ? { fields: fields.join(',') } : undefined,
        });
    }
    /**
     * List orders
     *
     * Returns paginated list of orders with optional filters.
     *
     * @param params - List parameters including filters and pagination
     * @returns Paginated order list
     */
    async listOrders(params = {}) {
        return this.safeRequest({
            method: 'GET',
            url: '/orders',
            params: {
                merchantId: params.merchantId,
                userId: params.userId,
                status: params.status,
                dateFrom: params.dateFrom,
                dateTo: params.dateTo,
                page: params.page || 1,
                limit: params.limit || 20,
                offset: params.offset,
            },
        });
    }
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
    async updateStatus(orderId, request) {
        return this.safeRequest({
            method: 'PATCH',
            url: `/orders/${orderId}/status`,
            data: {
                status: request.status,
                reason: request.reason,
                metadata: request.metadata,
            },
        });
    }
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
    async cancel(orderId, reason, cancelledBy = 'orchestrator') {
        return this.safeRequest({
            method: 'POST',
            url: `/orders/${orderId}/cancel`,
            data: {
                reason,
                cancelledBy,
                metadata: {
                    cancelledAt: new Date().toISOString(),
                    cancelledBySystem: 'orchestrator',
                },
            },
        });
    }
    /**
     * Add item to existing order
     *
     * Adds an item to an order in pending/confirmed state.
     *
     * @param orderId - The order ID
     * @param item - Item to add
     * @returns Updated order
     */
    async addItem(orderId, item) {
        return this.safeRequest({
            method: 'POST',
            url: `/orders/${orderId}/items`,
            data: item,
        });
    }
    /**
     * Remove item from order
     *
     * Removes an item from an order in pending state.
     *
     * @param orderId - The order ID
     * @param itemId - The item ID to remove
     * @returns Updated order
     */
    async removeItem(orderId, itemId) {
        return this.safeRequest({
            method: 'DELETE',
            url: `/orders/${orderId}/items/${itemId}`,
        });
    }
    /**
     * Update delivery address
     *
     * Updates delivery address for an order in pending state.
     *
     * @param orderId - The order ID
     * @param address - New delivery address
     * @returns Updated order
     */
    async updateDeliveryAddress(orderId, address) {
        return this.safeRequest({
            method: 'PATCH',
            url: `/orders/${orderId}/address`,
            data: { deliveryAddress: address },
        });
    }
    /**
     * Get order status
     *
     * Lightweight endpoint to get only the order status.
     *
     * @param orderId - The order ID
     * @returns Order status
     */
    async getStatus(orderId) {
        return this.safeRequest({
            method: 'GET',
            url: `/orders/${orderId}/status`,
        });
    }
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
    getStreamUrl(merchantId) {
        return `${this.config.baseUrl}/orders/stream?merchantId=${merchantId}`;
    }
    /**
     * Health check for order service
     *
     * @returns Health status
     */
    async healthCheck() {
        const start = Date.now();
        try {
            await this.client.get('/health');
            return { healthy: true, latency: Date.now() - start };
        }
        catch {
            return { healthy: false, latency: Date.now() - start };
        }
    }
}
exports.OrderConnector = OrderConnector;
/**
 * Get internal token from environment
 */
function getInternalToken() {
    const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
    try {
        const tokens = JSON.parse(tokensJson);
        return tokens.orchestrator || tokens.order || '';
    }
    catch {
        logger_js_1.default.warn('[OrderConnector] Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
        return '';
    }
}
// Singleton instance
let orderInstance = null;
function getOrderConnector(config) {
    if (!orderInstance) {
        orderInstance = new OrderConnector(config);
    }
    return orderInstance;
}
exports.default = OrderConnector;
//# sourceMappingURL=order.js.map