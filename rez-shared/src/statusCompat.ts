/**
 * Legacy status compatibility mapper — Phase 7 shared contracts
 *
 * Copied from rezbackend/src/utils/statusCompat.ts so that clients can
 * normalize legacy status values without a round-trip to the server.
 *
 * Add mappings here as legacy values are discovered in client storage,
 * push notifications, or cached API responses. Never remove a mapping
 * until you are certain no stored data or client can produce the old value.
 *
 * Source of truth: rezbackend/src/utils/statusCompat.ts
 */

// ── Order status normalizer ────────────────────────────────────────────────────

const ORDER_STATUS_MAP: Record<string, string> = {
  in_transit: 'out_for_delivery',      // old name → canonical
  refund_initiated: 'partially_refunded',
  shipping: 'dispatched',
  packed: 'preparing',
  accepted: 'confirmed',
  // DM-CRIT-01 P0 FIX: frontend e2e tests use 'pending_payment' as initial order state
  // but backend FSM uses 'placed'. Map so normalizeOrderStatus('pending_payment') → 'placed'.
  pending_payment: 'placed',
  // DM-CRIT-01 P0 FIX: frontend e2e tests use 'completed' as terminal state
  // but backend FSM uses 'delivered'. Map so normalizeOrderStatus('completed') → 'delivered'.
  completed: 'delivered',
};

// ── Payment status normalizer ──────────────────────────────────────────────────

const PAYMENT_STATUS_MAP: Record<string, string> = {
  success: 'paid',
  captured: 'paid',
  pending_capture: 'authorized',
  completed: 'paid',
  initiated: 'awaiting_payment',
};

// ── PaymentStatus ↔ OrderPaymentStatus bridge ──────────────────────────────────
//
// Two FSM domains exist for different purposes:
//   1. PaymentStatus (standalone Payment model): Financial lifecycle
//      Values: pending | processing | completed | failed | cancelled |
//              expired | refund_initiated | refund_processing | refunded | refund_failed
//   2. OrderPaymentStatus (Order.payment subdoc): Consumer-facing state
//      Values: pending | awaiting_payment | processing | authorized | paid |
//              partially_refunded | failed | refunded
//
// Map standalone → subdoc (lossy — some states have no subdoc equivalent):
const PAYMENT_TO_ORDER_STATUS: Partial<Record<string, string>> = {
  pending:          'pending',
  processing:      'processing',
  completed:       'paid',
  failed:          'failed',
  cancelled:       'failed',
  refunded:        'refunded',
  partially_refunded: 'partially_refunded',
  // P0 FIX: Filled NULL gaps for terminal/terminalizing states.
  // These states have no perfect OrderPaymentStatus equivalent, but 'failed'
  // is the closest consumer-facing representation for expired payments.
  expired:            'failed',
  // refund_initiated|refund_processing|refund_failed are intermediate refund states.
  // Map all to 'refunded' (the terminal refund state) as the closest equivalent.
  // This is lossy but better than null for consumer-facing display.
  refund_initiated:   'refunded',
  refund_processing:  'refunded',
  refund_failed:      'refunded',
};

/**
 * Normalize a legacy order status string to its canonical Phase 3 equivalent.
 * Returns the input unchanged if it is already canonical.
 *
 * @example
 *   normalizeOrderStatus('in_transit')  // → 'out_for_delivery'
 *   normalizeOrderStatus('confirmed')   // → 'confirmed'
 */
export function normalizeOrderStatus(status: string): string {
  return ORDER_STATUS_MAP[status] ?? status;
}

/**
 * Normalize a legacy payment status string to its canonical Phase 3 equivalent.
 * Returns the input unchanged if it is already canonical.
 *
 * @example
 *   normalizePaymentStatus('success')  // → 'paid'
 *   normalizePaymentStatus('paid')     // → 'paid'
 */
export function normalizePaymentStatus(status: string): string {
  return PAYMENT_STATUS_MAP[status] ?? status;
}

/**
 * Bridge: convert standalone PaymentStatus to OrderPaymentStatus.
 * Returns null for states that have no OrderPaymentStatus equivalent
 * (expired, refund_initiated, refund_processing, refund_failed).
 *
 * Decision (TF-05): Both FSMs are kept as canonical for their domain.
 * Use this bridge when rendering consumer-facing payment state from
 * the financial Payment model.
 *
 * @example
 *   paymentStatusToOrderPayment('completed')  // → 'paid'
 *   paymentStatusToOrderPayment('expired')   // → null
 */
export function paymentStatusToOrderPayment(status: string): string | null {
  return PAYMENT_TO_ORDER_STATUS[status] ?? null;
}

export default { normalizeOrderStatus, normalizePaymentStatus, paymentStatusToOrderPayment };
