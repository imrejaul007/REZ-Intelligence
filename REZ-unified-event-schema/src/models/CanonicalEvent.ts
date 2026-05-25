/**
 * Canonical Event Schema - THE ONE EVENT MODEL FOR ALL OF REZ
 * Every event in the ecosystem uses this model
 */

export interface CanonicalEvent {
  // Required fields
  event_id: string;
  event_type: string;
  timestamp: string;
  source: EventSource;
  platform: EventPlatform;

  // Identity
  user_id?: string;
  merchant_id?: string;
  location_id?: string;
  device_id?: string;
  session_id?: string;

  // Transaction
  order_id?: string;
  payment_id?: string;
  transaction_id?: string;
  invoice_id?: string;

  // Money
  amount?: number;
  currency?: string;
  payment_method?: PaymentMethod;

  // Engagement
  coin_used?: boolean;
  loyalty_points?: number;
  discount_applied?: number;

  // Product/SKU
  product_id?: string;
  sku?: string;
  quantity?: number;

  // Location
  lat?: number;
  lng?: number;
  city?: string;
  country?: string;

  // Metadata
  metadata: Record<string, unknown>;
  tags: string[];
}

export type EventSource = 'pos' | 'app' | 'web' | 'qr' | 'api' | 'webhook' | 'scheduler' | 'ai';
export type EventPlatform = 'ios' | 'android' | 'web' | 'kiosk' | 'pos';
export type PaymentMethod = 'upi' | 'card' | 'wallet' | 'cash' | 'crypto' | 'points' | 'mixed';

// Event types
export const EVENT_TYPES = {
  // Order events
  ORDER_CREATED: 'order.created',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_PREPARING: 'order.preparing',
  ORDER_READY: 'order.ready',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_REFUNDED: 'order.refunded',

  // Payment events
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',

  // User events
  USER_SIGNED_UP: 'user.signed_up',
  USER_LOGGED_IN: 'user.logged_in',
  USER_LOGGED_OUT: 'user.logged_out',
  USER_PROFILE_UPDATED: 'user.profile_updated',

  // AI events
  AI_QUERY: 'ai.query',
  AI_RECOMMENDATION_SHOWN: 'ai.recommendation_shown',
  AI_RECOMMENDATION_CLICKED: 'ai.recommendation_clicked',
  AI_PURCHASE: 'ai.purchase',

  // Engagement events
  PAGE_VIEWED: 'page.viewed',
  SEARCH_PERFORMED: 'search.performed',
  PRODUCT_VIEWED: 'product.viewed',
  ADDED_TO_CART: 'cart.added',
  REMOVED_FROM_CART: 'cart.removed',
  WISHLIST_ADDED: 'wishlist.added',

  // Loyalty events
  POINTS_EARNED: 'loyalty.points_earned',
  POINTS_REDEEMED: 'loyalty.points_redeemed',
  COUPON_APPLIED: 'loyalty.coupon_applied',

  // DOOH events
  QR_SCANNED: 'dooh.qr_scanned',
  DOOH_VIEWED: 'dooh.viewed',

  // Review events
  REVIEW_SUBMITTED: 'review.submitted',
  REVIEW_HELPFUL: 'review.helpful',
} as const;
