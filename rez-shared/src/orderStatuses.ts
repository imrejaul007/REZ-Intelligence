/**
 * Canonical Order Statuses — Phase 7 shared contracts
 *
 * Source of truth: rezbackend/src/config/orderStateMachine.ts
 * These values mirror the backend FSM exactly. If the backend FSM changes,
 * update this file in lockstep.
 *
 * See also: packages/rez-shared/src/statusCompat.ts for legacy value normalization.
 */

// Ordered statuses for linear progress calculation (placed → delivered)
export const STATUS_ORDER = [
  'placed',
  'confirmed',
  'preparing',
  'ready',
  'dispatched',
  'out_for_delivery',
  'delivered',
] as const;

// All valid order statuses (including terminal branches)
// NOTE: 'failed_delivery', 'return_requested', 'return_rejected' added — present in backend FSM
export const ORDER_STATUSES = [
  'placed',
  'confirmed',
  'preparing',
  'ready',
  'dispatched',
  'out_for_delivery',
  'failed_delivery',
  'delivered',
  'cancelling',
  'cancelled',
  'return_requested',
  'return_rejected',
  'returned',
  'refunded',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type LinearOrderStatus = (typeof STATUS_ORDER)[number];

// Terminal statuses — no further forward progress (order complete/closed)
export const TERMINAL_ORDER_STATUSES = ['cancelled', 'returned', 'refunded', 'return_rejected'] as const;
export type TerminalOrderStatus = (typeof TERMINAL_ORDER_STATUSES)[number];

// Active statuses — order is in progress (not yet delivered/cancelled/refunded)
export const ACTIVE_ORDER_STATUSES = [
  'placed',
  'confirmed',
  'preparing',
  'ready',
  'dispatched',
  'out_for_delivery',
  'failed_delivery',
  'cancelling',
  'return_requested',
] as const;
export type ActiveOrderStatus = (typeof ACTIVE_ORDER_STATUSES)[number];

// Past statuses — order reached a notable endpoint (delivered, failed, or cancelled)
export const PAST_ORDER_STATUSES = ['delivered', 'failed_delivery', 'return_rejected'] as const;
export type PastOrderStatus = (typeof PAST_ORDER_STATUSES)[number];

/**
 * Type guard: check if a string is a valid OrderStatus.
 */
export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

/**
 * Calculate order progress as a percentage (0–100).
 * Mirrors backend getOrderProgress() — keep in sync.
 */
export function getOrderProgress(status: string): number {
  if (status === 'delivered') return 100;
  // Post-delivery states: return flow is 100% delivered progress (item was delivered)
  if (status === 'failed_delivery' || status === 'return_requested' || status === 'return_rejected') return 100;
  // Cancelled/refunded: no progress
  if (status === 'cancelled' || status === 'refunded' || status === 'returned') return 0;

  const index = (STATUS_ORDER as readonly string[]).indexOf(status);
  if (index < 0) return 0;

  const maxIndex = STATUS_ORDER.length - 1; // 6 (delivered)
  return Math.round((index / maxIndex) * 100);
}
