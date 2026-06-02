/**
 * Canonical Payment Statuses — Phase 7 shared contracts
 *
 * Source of truth: rezbackend/src/config/financialStateMachine.ts
 * These values mirror the backend FSM exactly. If the backend FSM changes,
 * update this file in lockstep.
 *
 * Two distinct status domains are tracked:
 *   1. PaymentStatus       — standalone Payment model lifecycle
 *   2. OrderPaymentStatus  — Order.payment.status sub-document lifecycle
 *
 * See also: packages/rez-shared/src/statusCompat.ts for legacy value normalization.
 */

// ── Standalone Payment model lifecycle ────────────────────────────────────────
export const PAYMENT_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'expired',
  'refund_initiated',
  'refund_processing',
  'refunded',
  'refund_failed',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// ── Order.payment.status sub-document lifecycle ────────────────────────────────
export const ORDER_PAYMENT_STATUSES = [
  'pending',
  'awaiting_payment',
  'processing',
  'authorized',
  'paid',
  'partially_refunded',
  'failed',
  'refunded',
] as const;

export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[number];

// Terminal payment statuses (standalone Payment model)
export const TERMINAL_PAYMENT_STATUSES = ['completed', 'cancelled', 'expired', 'refunded'] as const;
export type TerminalPaymentStatus = (typeof TERMINAL_PAYMENT_STATUSES)[number];

// Terminal order-payment statuses
export const TERMINAL_ORDER_PAYMENT_STATUSES = ['failed', 'refunded'] as const;
export type TerminalOrderPaymentStatus = (typeof TERMINAL_ORDER_PAYMENT_STATUSES)[number];

/**
 * Type guard: check if a string is a valid PaymentStatus.
 */
export function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Type guard: check if a string is a valid OrderPaymentStatus.
 */
export function isOrderPaymentStatus(value: string): value is OrderPaymentStatus {
  return (ORDER_PAYMENT_STATUSES as readonly string[]).includes(value);
}
