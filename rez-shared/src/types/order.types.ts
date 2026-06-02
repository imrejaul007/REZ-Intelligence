/**
 * Canonical Order types for the REZ platform.
 *
 * Source of truth: rezbackend/src/models/Order.ts
 * Status enums are kept in sync with:
 *   rezbackend/src/config/orderStateMachine.ts    (OrderStatus)
 *   rezbackend/src/config/financialStateMachine.ts (PaymentStatus)
 *
 * Do NOT redefine these types in frontend apps — import from @rez/shared instead.
 *
 * Re-exports orderStatuses and paymentStatuses for convenience.
 */

// ── Import canonical status types (do not re-export — they come from root) ────

import type { OrderStatus } from '../orderStatuses';
import type { OrderPaymentStatus } from '../paymentStatuses';

// Re-export for consumers who import directly from '@rez/shared/types'
export type { OrderStatus } from '../orderStatuses';
export type { OrderPaymentStatus } from '../paymentStatuses';

// ── Order Totals ──────────────────────────────────────────────────────────────

/**
 * Canonical totals shape.
 * Field names are authoritative — all clients must use these exact names.
 *   subtotal    = sum of item prices
 *   delivery    = delivery fee (NOT deliveryFee — matches backend IOrderTotals)
 *   tax         = tax amount
 *   discount    = discount applied
 *   cashback    = cashback credited
 *   total       = final amount charged
 *   platformFee = 15% of subtotal (platform commission)
 *   merchantPayout = subtotal - platformFee
 */
export interface OrderTotals {
  subtotal: number;
  tax: number;
  delivery: number;
  discount: number;
  cashback: number;
  total: number;
  paidAmount: number;
  platformFee: number;
  merchantPayout: number;
  refundAmount?: number;
  lockFeeDiscount?: number;
}

// ── Order Item ────────────────────────────────────────────────────────────────

export interface OrderItem {
  _id?: string;
  /** MongoDB ObjectId serialized as a string (populate required for display). */
  product: string;
  /** MongoDB ObjectId serialized as a string (populate required for display). */
  store: string;
  storeName?: string;
  name: string;
  image: string;
  itemType: 'product' | 'service' | 'event';
  quantity: number;
  price: number;
  originalPrice?: number;
  discount?: number;
  subtotal: number;
  variant?: {
    type: string;
    value: string;
  };
  specialInstructions?: string;
  sku?: string;
}

// ── Order Payment ─────────────────────────────────────────────────────────────

export type OrderPaymentMethod =
  | 'wallet'
  | 'card'
  | 'upi'
  | 'cod'
  | 'netbanking'
  | 'razorpay'
  | 'stripe';

// OrderPaymentStatus is imported above from '../paymentStatuses'

export interface OrderPayment {
  method: OrderPaymentMethod;
  status: OrderPaymentStatus;
  transactionId?: string;
  paymentGateway?: string;
  failureReason?: string;
  paidAt?: string;
  refundId?: string;
  refundedAt?: string;
  coinsUsed?: {
    rezCoins?: number;
    promoCoins?: number;
    storePromoCoins?: number;
    totalCoinsValue?: number;
  };
}

// ── Order Delivery Address ────────────────────────────────────────────────────

export interface OrderDeliveryAddress {
  name: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  coordinates?: [number, number];
  landmark?: string;
  addressType?: 'home' | 'work' | 'other';
}

// ── Fulfillment ───────────────────────────────────────────────────────────────

export type FulfillmentType = 'delivery' | 'pickup' | 'drive_thru' | 'dine_in';

// OrderStatus is imported above from '../orderStatuses'

// ── Order Timeline ─────────────────────────────────────────────────────────────

export interface OrderTimelineEntry {
  status: string;
  message: string;
  timestamp: string;
  updatedBy?: string;
}

// ── Main Order type ───────────────────────────────────────────────────────────

export interface Order {
  _id: string;
  orderNumber: string;
  status: OrderStatus;
  /**
   * MongoDB ObjectId serialized as a 24-character hex string in JSON responses.
   * Always call `.populate('user')` in backend queries before returning to clients.
   */
  user: string;
  /**
   * MongoDB ObjectId serialized as a 24-character hex string in JSON responses.
   * Always call `.populate('store')` in backend queries before returning to clients.
   */
  store?: string;
  fulfillmentType: FulfillmentType;
  items: OrderItem[];
  /**
   * Canonical totals object. Use totals.{subtotal, delivery, tax, total, platformFee, merchantPayout}.
   * Never access these as top-level fields on Order.
   */
  totals: OrderTotals;
  payment: OrderPayment;
  delivery?: {
    method: string;
    status: string;
    address: OrderDeliveryAddress;
    estimatedTime?: string;
    deliveryFee: number;
    instructions?: string;
  };
  timeline: OrderTimelineEntry[];
  couponCode?: string;
  notes?: string;
  specialInstructions?: string;
  cancelReason?: string;
  cancelledAt?: string;
  returnReason?: string;
  returnedAt?: string;
  invoiceUrl?: string;
  createdAt: string;
  updatedAt: string;
}
