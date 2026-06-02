// DM-HIGH-02: Unified payment state — canonical payment lifecycle states
// All services must use these exported values for consistent payment state tracking.

export const PAYMENT_STATES = {
  PENDING: 'pending',
  INITIATED: 'initiated',
  PROCESSING: 'processing',
  AUTHORIZED: 'authorized',
  CAPTURED: 'captured',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;
export type PaymentState = typeof PAYMENT_STATES[keyof typeof PAYMENT_STATES];
