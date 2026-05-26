"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentConnector = void 0;
exports.getPaymentConnector = getPaymentConnector;
const logger_1 = __importDefault(require("./utils/logger"));
/**
 * Payment Service Connector
 *
 * Connects to rez-payment-service (Port 4001) for payment processing,
 * refunds, and transaction management.
 */
const client_1 = require("../utils/client");
const DEFAULT_CONFIG = {
    timeout: 30000,
    maxRetries: 3,
};
/**
 * Payment Connector
 *
 * Provides methods to interact with the payment service:
 * - Initiate payments (create orders with payment providers)
 * - Capture payments (process completed payments)
 * - Refund payments
 * - Get payment status
 */
class PaymentConnector extends client_1.ServiceClient {
    config;
    constructor(config = {}) {
        const paymentUrl = config.baseUrl || process.env.PAYMENT_SERVICE_URL || 'http://localhost:4001';
        const internalToken = config.internalToken || getInternalToken();
        const mergedConfig = {
            ...DEFAULT_CONFIG,
            ...config,
            baseUrl: paymentUrl,
            internalToken,
            serviceName: 'payment-service',
        };
        super(mergedConfig);
        this.config = mergedConfig;
    }
    /**
     * Initiate a new payment
     *
     * Creates a payment order and returns the payment ID.
     * Supports idempotency via orchestratorIdempotencyKey.
     *
     * @param request - Payment initiation parameters
     * @returns Payment initiation response with paymentId
     * @throws Error if payment initiation fails
     */
    async initiate(request) {
        const payload = {
            orderId: request.orderId,
            amount: request.amount,
            paymentMethod: request.paymentMethod,
            purpose: request.purpose || 'order_payment',
            orchestratorIdempotencyKey: request.orchestratorIdempotencyKey,
            userDetails: request.userDetails,
            metadata: {
                ...request.metadata,
                initiatedBy: 'orchestrator',
                initiatedAt: new Date().toISOString(),
            },
        };
        return this.safeRequest({
            method: 'POST',
            url: '/api/payments/initiate',
            data: payload,
        });
    }
    /**
     * Capture a completed payment
     *
     * Called after payment gateway confirms payment.
     * Validates signature and updates payment status.
     *
     * @param request - Capture parameters including razorpay details
     * @returns Updated payment information
     */
    async capture(request) {
        return this.safeRequest({
            method: 'POST',
            url: '/api/payments/capture',
            data: request,
        });
    }
    /**
     * Get payment by ID
     *
     * Retrieves current payment status and details.
     *
     * @param paymentId - The internal payment document ID
     * @returns Payment details
     */
    async getPayment(paymentId) {
        return this.safeRequest({
            method: 'GET',
            url: `/api/payments/${paymentId}`,
        });
    }
    /**
     * Get payment status
     *
     * Lightweight endpoint to check only the payment status.
     *
     * @param paymentId - The internal payment document ID
     * @returns Current payment status
     */
    async getStatus(paymentId) {
        return this.safeRequest({
            method: 'GET',
            url: `/api/payments/${paymentId}/status`,
        });
    }
    /**
     * Process a refund
     *
     * Initiates a refund for a completed payment.
     * Supports partial refunds by specifying amount.
     *
     * @param request - Refund parameters
     * @returns Refund result
     */
    async refund(request) {
        return this.safeRequest({
            method: 'POST',
            url: '/api/payments/refund',
            data: {
                paymentId: request.paymentId,
                amount: request.amount,
                reason: request.reason,
                idempotencyKey: request.idempotencyKey,
            },
        });
    }
    /**
     * Verify payment with gateway
     *
     * Fetches payment status directly from Razorpay for verification.
     * Used for high-value transactions or dispute resolution.
     *
     * @param razorpayPaymentId - The Razorpay payment ID
     * @returns Gateway verification result
     */
    async verifyWithGateway(razorpayPaymentId) {
        return this.safeRequest({
            method: 'GET',
            url: `/api/payments/verify/${razorpayPaymentId}`,
        });
    }
    /**
     * Internal debit from user wallet
     *
     * Service-to-service method to deduct from user wallet.
     * Requires X-Internal-Token authentication.
     *
     * @param userId - Target user's ID
     * @param orderId - Associated order ID
     * @param amount - Deduction amount in rupees
     * @param paymentMethod - Payment method used
     * @param purpose - Payment purpose category
     * @returns Debit result
     */
    async internalDeduct(userId, orderId, amount, paymentMethod = 'wallet', purpose = 'order') {
        return this.safeRequest({
            method: 'POST',
            url: '/api/payments/internal/deduct',
            data: {
                userId,
                orderId,
                amount,
                paymentMethod,
                purpose,
            },
        });
    }
    /**
     * Health check for payment service
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
exports.PaymentConnector = PaymentConnector;
/**
 * Get internal token from environment
 * INTERNAL_SERVICE_TOKENS_JSON is a JSON map: {"orchestrator": "token", ...}
 */
function getInternalToken() {
    const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
    try {
        const tokens = JSON.parse(tokensJson);
        return tokens.orchestrator || tokens.payment || '';
    }
    catch {
        logger_1.default.warn('[PaymentConnector] Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
        return '';
    }
}
// Singleton instance for convenience
let paymentInstance = null;
function getPaymentConnector(config) {
    if (!paymentInstance) {
        paymentInstance = new PaymentConnector(config);
    }
    return paymentInstance;
}
exports.default = PaymentConnector;
//# sourceMappingURL=payment.js.map