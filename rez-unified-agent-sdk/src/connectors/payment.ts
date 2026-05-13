import { BaseConnector } from './baseConnector';
import type {
  Logger,
  RetryOptions,
  CircuitBreakerOptions,
  ProcessPaymentRequest,
  ProcessPaymentOptions,
  PaymentResult,
  HttpResponse,
  SDKError,
  ServiceError,
  CircuitOpenError,
  TimeoutError,
  RetryExhaustedError,
} from '../types';

// ============================================================================
// Payment Service Types
// ============================================================================

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

// ============================================================================
// Payment Connector
// ============================================================================

export class PaymentConnector extends BaseConnector {
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
    super('payment-service', baseUrl, authToken, options);
  }

  /**
   * Process a payment
   */
  async processPayment(
    orderId: string,
    amount: number,
    method: string,
    options?: ProcessPaymentOptions,
  ): Promise<PaymentResult> {
    this.logger.info('Processing payment', { orderId, amount, method });

    try {
      const request: ProcessPaymentRequest = {
        orderId,
        amount,
        method: method as ProcessPaymentRequest['method'],
        options,
      };

      const response = await this.post<PaymentResult>('/payments', request);
      this.logger.info('Payment processed successfully', {
        paymentId: response.data.paymentId,
        orderId,
      });
      return response.data;
    } catch (error) {
      this.logger.error('Payment processing failed', {
        orderId,
        amount,
        method,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get payment status
   */
  async getPayment(paymentId: string): Promise<PaymentStatusResult> {
    this.logger.debug('Getting payment status', { paymentId });

    const response = await this.get<PaymentStatusResult>(`/payments/${paymentId}`);
    return response.data;
  }

  /**
   * Get payment history for a customer
   */
  async getPaymentHistory(
    customerId: string,
    options?: {
      page?: number;
      pageSize?: number;
      status?: string;
      fromDate?: string;
      toDate?: string;
    },
  ): Promise<PaymentHistoryResult> {
    this.logger.debug('Getting payment history', { customerId, options });

    const params: Record<string, string> = {
      customerId,
    };

    if (options?.page) params.page = String(options.page);
    if (options?.pageSize) params.pageSize = String(options.pageSize);
    if (options?.status) params.status = options.status;
    if (options?.fromDate) params.fromDate = options.fromDate;
    if (options?.toDate) params.toDate = options.toDate;

    const response = await this.get<PaymentHistoryResult>('/payments/history', params);
    return response.data;
  }

  /**
   * Initiate a refund
   */
  async refund(request: RefundRequest): Promise<RefundResult> {
    this.logger.info('Initiating refund', {
      paymentId: request.paymentId,
      amount: request.amount,
    });

    const response = await this.post<RefundResult>('/refunds', request);
    this.logger.info('Refund initiated', {
      refundId: response.data.refundId,
      paymentId: request.paymentId,
    });
    return response.data;
  }

  /**
   * Get refund status
   */
  async getRefund(refundId: string): Promise<RefundResult> {
    this.logger.debug('Getting refund status', { refundId });

    const response = await this.get<RefundResult>(`/refunds/${refundId}`);
    return response.data;
  }

  /**
   * Cancel a pending payment
   */
  async cancelPayment(paymentId: string, reason?: string): Promise<PaymentResult> {
    this.logger.info('Cancelling payment', { paymentId, reason });

    const response = await this.post<PaymentResult>(`/payments/${paymentId}/cancel`, {
      reason,
    });
    return response.data;
  }

  /**
   * Verify payment signature (for webhook validation)
   */
  async verifySignature(
    paymentId: string,
    signature: string,
  ): Promise<{ valid: boolean }> {
    this.logger.debug('Verifying payment signature', { paymentId });

    const response = await this.post<{ valid: boolean }>('/payments/verify', {
      paymentId,
      signature,
    });
    return response.data;
  }

  /**
   * Get payment methods available
   */
  async getAvailableMethods(): Promise<{ methods: string[]; currencies: string[] }> {
    this.logger.debug('Getting available payment methods');

    const response = await this.get<{ methods: string[]; currencies: string[] }>('/methods');
    return response.data;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createPaymentConnector(
  baseUrl: string,
  authToken: string,
  options?: {
    logger?: Logger;
    timeout?: number;
    retry?: RetryOptions;
    circuitBreaker?: CircuitBreakerOptions;
  },
): PaymentConnector {
  return new PaymentConnector(baseUrl, authToken, options);
}
