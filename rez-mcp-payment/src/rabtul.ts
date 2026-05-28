/**
 * MCP Payment - RABTUL Payment Integration
 */

import axios from 'axios';

const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || 'https://rez-payment-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * Create payment
 */
export async function createPayment(params: {
  userId: string;
  amount: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<{ success: boolean; paymentId?: string; error?: string }> {
  try {
    const res = await axios.post(`${PAYMENT_URL}/api/payments/create`, {
      userId: params.userId,
      amount: params.amount,
      currency: params.currency || 'INR',
      description: params.description,
      metadata: params.metadata,
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true, paymentId: res.data.paymentId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Verify payment
 */
export async function verifyPayment(paymentId: string): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const res = await axios.get(`${PAYMENT_URL}/api/payments/${paymentId}`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true, status: res.data.status };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Refund payment
 */
export async function refundPayment(paymentId: string, amount?: number): Promise<{ success: boolean; refundId?: string; error?: string }> {
  try {
    const res = await axios.post(`${PAYMENT_URL}/api/payments/${paymentId}/refund`, { amount }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true, refundId: res.data.refundId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Get payment history
 */
export async function getPaymentHistory(userId: string, limit = 20): Promise<{ payments: unknown[]; error?: string }> {
  try {
    const res = await axios.get(`${PAYMENT_URL}/api/payments/history/${userId}`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      params: { limit },
    });
    return { payments: res.data.payments || [] };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { payments: [], error: message };
  }
}

export const mcpPaymentRABTUL = {
  createPayment,
  verifyPayment,
  refundPayment,
  getPaymentHistory,
};

export default mcpPaymentRABTUL;
