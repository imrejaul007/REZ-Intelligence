// Canonical Razorpay type definitions for the REZ platform.
// Covers the subset of Razorpay entity shapes used across services.

export interface RazorpayPayment {
  id: string;
  entity: string;
  amount: number;          // Amount in paise
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';
  order_id: string;
  invoice_id?: string;
  international?: boolean;
  method?: string;
  amount_refunded?: number;
  refunds?: RazorpayRefund[];
  created_at: number;
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;          // Amount in paise
  amount_paid: number;
  amount_due: number;
  currency: string;
  status: 'created' | 'paid' | 'partial_paid' | 'expired';
  attempts: number;
  receipt?: string;
  created_at: number;
}

export interface RazorpayRefund {
  id: string;
  entity: string;
  amount: number;          // Amount in paise
  status: 'pending' | 'processed' | 'failed';
  payment_id: string;
  created_at: number;
}

export interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: { entity: RazorpayPayment };
    order?: { entity: RazorpayOrder };
    refund?: { entity: RazorpayRefund };
  };
}
