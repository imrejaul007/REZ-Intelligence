/**
 * REZ Care Service - RABTUL Payment Integration
 * Connects to RABTUL Payment Service (Port 4001) for:
 * - Payment initiation (Razorpay)
 * - Refund processing
 * - Webhook handling
 * - Invoice generation
 */

import axios, { AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'https://rez-payment-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// Helper to extract error messages from axios errors
function getAxiosErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.error || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

// ============================================
// TYPES
// ============================================

export interface PaymentOrder {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method?: PaymentMethod;
  customerId: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  paidAt?: Date;
}

export interface RefundRequest {
  paymentId: string;
  amount: number;
  reason?: string;
  idempotencyKey?: string;
}

export interface PaymentWebhook {
  event: string;
  payload: {
    payment?: {
      id: string;
      amount: number;
      currency: string;
      status: string;
      method?: string;
    };
    refund?: {
      id: string;
      amount: number;
      status: string;
    };
  };
}

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'refund_initiated'
  | 'refund_processing'
  | 'refunded'
  | 'refund_failed'
  | 'partially_refunded';

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet' | 'emi' | 'cod';

export interface Invoice {
  id: string;
  subscriptionId: string;
  clientId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  paymentId?: string;
  description?: string;
  dueDate: Date;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  paidAt?: Date;
}

// ============================================
// PAYMENT CLIENT
// ============================================

class RabtulPaymentClient {
  private baseURL: string;
  private headers: Record<string, string>;

  constructor() {
    this.baseURL = PAYMENT_SERVICE_URL;
    this.headers = {
      'Content-Type': 'application/json',
      'X-Internal-Token': INTERNAL_TOKEN,
    };
  }

  /**
   * Initiate a payment order
   */
  async createPaymentOrder(params: {
    clientId: string;
    amount: number;
    currency?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ success: boolean; order?: PaymentOrder; razorpayOrderId?: string; error?: string }> {
    try {
      const idempotencyKey = `rezcare_${params.clientId}_${Date.now()}`;

      const res = await axios.post(
        `${this.baseURL}/api/pay/initiate`,
        {
          amount: Math.round(params.amount * 100), // Razorpay uses paise
          currency: params.currency || 'INR',
          description: params.description || 'REZ Care Subscription',
          customerId: params.clientId,
          metadata: {
            ...params.metadata,
            source: 'rez-care-service',
            clientId: params.clientId,
          },
          idempotencyKey,
        },
        { headers: this.headers }
      );

      if (res.data.success) {
        return {
          success: true,
          order: res.data.payment,
          razorpayOrderId: res.data.razorpayOrderId,
        };
      }

      return { success: false, error: res.data.error || 'Payment initiation failed' };
    } catch (error) {
      console.error('[RabtulPayment] Create payment order failed:', getAxiosErrorMessage(error));
      return { success: false, error: getAxiosErrorMessage(error) };
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<{ success: boolean; payment?: PaymentOrder; error?: string }> {
    try {
      const res = await axios.get(`${this.baseURL}/api/pay/status/${paymentId}`, {
        headers: this.headers,
      });

      if (res.data.success) {
        return { success: true, payment: res.data.payment };
      }

      return { success: false, error: res.data.error || 'Payment not found' };
    } catch (error) {
      return { success: false, error: getAxiosErrorMessage(error) };
    }
  }

  /**
   * Process refund
   */
  async processRefund(params: {
    paymentId: string;
    amount: number;
    reason?: string;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; refundId?: string; error?: string }> {
    try {
      const idempotencyKey = params.idempotencyKey || `rezcare_refund_${params.paymentId}_${Date.now()}`;

      const res = await axios.post(
        `${this.baseURL}/api/pay/refund`,
        {
          paymentId: params.paymentId,
          amount: Math.round(params.amount * 100), // Convert to paise
          reason: params.reason || 'Customer request',
          idempotencyKey,
        },
        { headers: this.headers }
      );

      if (res.data.success) {
        return {
          success: true,
          refundId: res.data.refundId,
        };
      }

      return { success: false, error: res.data.error || 'Refund failed' };
    } catch (error) {
      console.error('[RabtulPayment] Process refund failed:', getAxiosErrorMessage(error));
      return { success: false, error: getAxiosErrorMessage(error) };
    }
  }

  /**
   * Handle webhook from Razorpay via RABTUL payment service
   */
  async handleWebhook(webhook: PaymentWebhook): Promise<{ success: boolean; action?: string; error?: string }> {
    try {
      const res = await axios.post(
        `${this.baseURL}/api/pay/webhook/razorpay`,
        webhook,
        { headers: this.headers }
      );

      return {
        success: res.data.success,
        action: res.data.action,
      };
    } catch (error) {
      return { success: false, error: getAxiosErrorMessage(error) };
    }
  }

  /**
   * Credit wallet after successful payment
   */
  async creditWallet(params: {
    userId: string;
    amount: number;
    reason: string;
    referenceId?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await axios.post(
        `${this.baseURL}/api/pay/internal/wallet-credit`,
        {
          userId: params.userId,
          amount: params.amount,
          reason: params.reason,
          referenceId: params.referenceId,
        },
        { headers: this.headers }
      );

      return { success: res.data.success };
    } catch (error) {
      return { success: false, error: getAxiosErrorMessage(error) };
    }
  }

  /**
   * Verify webhook signature (HMAC-SHA256)
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return expectedSignature === signature;
  }
}

// ============================================
// INVOICE GENERATOR
// ============================================

class InvoiceGenerator {
  private invoices: Map<string, Invoice> = new Map();

  /**
   * Generate invoice for subscription
   */
  generateInvoice(params: {
    subscriptionId: string;
    clientId: string;
    amount: number;
    currency?: string;
    description?: string;
    periodStart: Date;
    periodEnd: Date;
  }): Invoice {
    const invoice: Invoice = {
      id: `inv_${uuidv4()}`,
      subscriptionId: params.subscriptionId,
      clientId: params.clientId,
      amount: params.amount,
      currency: params.currency || 'INR',
      status: 'draft',
      description: params.description || 'REZ Care Subscription',
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
    };

    this.invoices.set(invoice.id, invoice);
    return invoice;
  }

  /**
   * Get invoice by ID
   */
  getInvoice(invoiceId: string): Invoice | null {
    return this.invoices.get(invoiceId) || null;
  }

  /**
   * Get invoices for subscription
   */
  getSubscriptionInvoices(subscriptionId: string): Invoice[] {
    return Array.from(this.invoices.values()).filter(
      (inv) => inv.subscriptionId === subscriptionId
    );
  }

  /**
   * Update invoice status
   */
  updateInvoiceStatus(invoiceId: string, status: Invoice['status'], paymentId?: string): Invoice | null {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) return null;

    invoice.status = status;
    if (paymentId) invoice.paymentId = paymentId;
    if (status === 'paid') invoice.paidAt = new Date();

    this.invoices.set(invoiceId, invoice);
    return invoice;
  }

  /**
   * List all invoices for client
   */
  getClientInvoices(clientId: string): Invoice[] {
    return Array.from(this.invoices.values())
      .filter((inv) => inv.clientId === clientId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get invoice statistics
   */
  getInvoiceStats(): {
    total: number;
    paid: number;
    open: number;
    draft: number;
    totalAmount: number;
    paidAmount: number;
  } {
    const invoices = Array.from(this.invoices.values());

    return {
      total: invoices.length,
      paid: invoices.filter((i) => i.status === 'paid').length,
      open: invoices.filter((i) => i.status === 'open').length,
      draft: invoices.filter((i) => i.status === 'draft').length,
      totalAmount: invoices.reduce((sum, i) => sum + i.amount, 0),
      paidAmount: invoices
        .filter((i) => i.status === 'paid')
        .reduce((sum, i) => sum + i.amount, 0),
    };
  }
}

// ============================================
// EXPORTS
// ============================================

export const rabtulPayment = new RabtulPaymentClient();
export const invoiceGenerator = new InvoiceGenerator();

export default {
  payment: rabtulPayment,
  invoices: invoiceGenerator,
};
