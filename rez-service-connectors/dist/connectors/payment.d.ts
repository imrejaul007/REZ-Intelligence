/**
 * Payment Service Connector
 *
 * Connects to rez-payment-service (Port 4001) for payment processing,
 * refunds, and transaction management.
 */
import { ServiceClient, ClientConfig } from '../utils/client';
import type { InitiatePaymentRequest, InitiatePaymentResponse, CapturePaymentRequest, RefundRequest, PaymentStatus, ServiceResponse } from '../types';
/**
 * Payment Connector Configuration
 */
interface PaymentConfig extends ClientConfig {
    baseUrl: string;
    internalToken: string;
}
/**
 * Payment Connector
 *
 * Provides methods to interact with the payment service:
 * - Initiate payments (create orders with payment providers)
 * - Capture payments (process completed payments)
 * - Refund payments
 * - Get payment status
 */
export declare class PaymentConnector extends ServiceClient {
    private config;
    constructor(config?: Partial<PaymentConfig>);
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
    initiate(request: InitiatePaymentRequest): Promise<InitiatePaymentResponse>;
    /**
     * Capture a completed payment
     *
     * Called after payment gateway confirms payment.
     * Validates signature and updates payment status.
     *
     * @param request - Capture parameters including razorpay details
     * @returns Updated payment information
     */
    capture(request: CapturePaymentRequest): Promise<ServiceResponse>;
    /**
     * Get payment by ID
     *
     * Retrieves current payment status and details.
     *
     * @param paymentId - The internal payment document ID
     * @returns Payment details
     */
    getPayment(paymentId: string): Promise<ServiceResponse>;
    /**
     * Get payment status
     *
     * Lightweight endpoint to check only the payment status.
     *
     * @param paymentId - The internal payment document ID
     * @returns Current payment status
     */
    getStatus(paymentId: string): Promise<{
        status: PaymentStatus;
    }>;
    /**
     * Process a refund
     *
     * Initiates a refund for a completed payment.
     * Supports partial refunds by specifying amount.
     *
     * @param request - Refund parameters
     * @returns Refund result
     */
    refund(request: RefundRequest): Promise<ServiceResponse>;
    /**
     * Verify payment with gateway
     *
     * Fetches payment status directly from Razorpay for verification.
     * Used for high-value transactions or dispute resolution.
     *
     * @param razorpayPaymentId - The Razorpay payment ID
     * @returns Gateway verification result
     */
    verifyWithGateway(razorpayPaymentId: string): Promise<ServiceResponse>;
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
    internalDeduct(userId: string, orderId: string, amount: number, paymentMethod?: string, purpose?: string): Promise<ServiceResponse>;
    /**
     * Health check for payment service
     *
     * @returns Health status
     */
    healthCheck(): Promise<{
        healthy: boolean;
        latency?: number;
    }>;
}
export declare function getPaymentConnector(config?: Partial<PaymentConfig>): PaymentConnector;
export default PaymentConnector;
//# sourceMappingURL=payment.d.ts.map