import { BaseConnector } from './baseConnector';
import type { Logger, RetryOptions, CircuitBreakerOptions, ProcessPaymentOptions, PaymentResult } from '../types';
export interface RefundRequest {
    paymentId: string;
    amount?: number;
    reason?: string;
    notes?: string;
}
export interface RefundResult {
    refundId: string;
    paymentId: string;
    amount: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    reason?: string;
    createdAt: string;
    processedAt?: string;
}
export interface PaymentStatusResult {
    paymentId: string;
    status: string;
    amount: number;
    currency: string;
    method: string;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown>;
}
export interface PaymentHistoryResult {
    payments: PaymentResult[];
    total: number;
    page: number;
    pageSize: number;
}
export declare class PaymentConnector extends BaseConnector {
    constructor(baseUrl: string, authToken: string, options?: {
        logger?: Logger;
        timeout?: number;
        retry?: RetryOptions;
        circuitBreaker?: CircuitBreakerOptions;
    });
    /**
     * Process a payment
     */
    processPayment(orderId: string, amount: number, method: string, options?: ProcessPaymentOptions): Promise<PaymentResult>;
    /**
     * Get payment status
     */
    getPayment(paymentId: string): Promise<PaymentStatusResult>;
    /**
     * Get payment history for a customer
     */
    getPaymentHistory(customerId: string, options?: {
        page?: number;
        pageSize?: number;
        status?: string;
        fromDate?: string;
        toDate?: string;
    }): Promise<PaymentHistoryResult>;
    /**
     * Initiate a refund
     */
    refund(request: RefundRequest): Promise<RefundResult>;
    /**
     * Get refund status
     */
    getRefund(refundId: string): Promise<RefundResult>;
    /**
     * Cancel a pending payment
     */
    cancelPayment(paymentId: string, reason?: string): Promise<PaymentResult>;
    /**
     * Verify payment signature (for webhook validation)
     */
    verifySignature(paymentId: string, signature: string): Promise<{
        valid: boolean;
    }>;
    /**
     * Get payment methods available
     */
    getAvailableMethods(): Promise<{
        methods: string[];
        currencies: string[];
    }>;
}
export declare function createPaymentConnector(baseUrl: string, authToken: string, options?: {
    logger?: Logger;
    timeout?: number;
    retry?: RetryOptions;
    circuitBreaker?: CircuitBreakerOptions;
}): PaymentConnector;
//# sourceMappingURL=payment.d.ts.map