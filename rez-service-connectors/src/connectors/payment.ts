import logger from './utils/logger';

/**
 * Payment Service Connector
 *
 * Connects to rez-payment-service (Port 4001) for payment processing,
 * refunds, and transaction management.
 */

import { ServiceClient, ClientConfig } from '../utils/client';
import type {
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  CapturePaymentRequest,
  RefundRequest,
  PaymentStatus,
  ServiceResponse,
} from '../types';

/**
 * Payment Connector Configuration
 */
interface PaymentConfig extends ClientConfig {
  baseUrl: string;
  internalToken: string;
}

const DEFAULT_CONFIG: Partial<PaymentConfig> = {
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
export class PaymentConnector extends ServiceClient {
  private config: PaymentConfig;

  constructor(config: Partial<PaymentConfig> = {}) {
    const paymentUrl = config.baseUrl || process.env.PAYMENT_SERVICE_URL || 'http://localhost:4001';
    const internalToken = config.internalToken || getInternalToken();

    const mergedConfig: PaymentConfig = {
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
  async initiate(request: InitiatePaymentRequest): Promise<InitiatePaymentResponse> {
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

    return this.safeRequest<InitiatePaymentResponse>({
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
  async capture(request: CapturePaymentRequest): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
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
  async getPayment(paymentId: string): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
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
  async getStatus(paymentId: string): Promise<{ status: PaymentStatus }> {
    return this.safeRequest<{ status: PaymentStatus }>({
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
  async refund(request: RefundRequest): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
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
  async verifyWithGateway(razorpayPaymentId: string): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
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
  async internalDeduct(
    userId: string,
    orderId: string,
    amount: number,
    paymentMethod: string = 'wallet',
    purpose: string = 'order'
  ): Promise<ServiceResponse> {
    return this.safeRequest<ServiceResponse>({
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
  async healthCheck(): Promise<{ healthy: boolean; latency?: number }> {
    const start = Date.now();
    try {
      await this.client.get('/health');
      return { healthy: true, latency: Date.now() - start };
    } catch {
      return { healthy: false, latency: Date.now() - start };
    }
  }
}

/**
 * Get internal token from environment
 * INTERNAL_SERVICE_TOKENS_JSON is a JSON map: {"orchestrator": "token", ...}
 */
function getInternalToken(): string {
  const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
  try {
    const tokens = JSON.parse(tokensJson);
    return tokens.orchestrator || tokens.payment || '';
  } catch {
    logger.warn('[PaymentConnector] Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
    return '';
  }
}

// Singleton instance for convenience
let paymentInstance: PaymentConnector | null = null;

export function getPaymentConnector(config?: Partial<PaymentConfig>): PaymentConnector {
  if (!paymentInstance) {
    paymentInstance = new PaymentConnector(config);
  }
  return paymentInstance;
}

export default PaymentConnector;
