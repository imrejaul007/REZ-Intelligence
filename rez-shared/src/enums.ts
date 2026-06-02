// Canonical enum definitions for the REZ platform.
// Source of truth for all status codes, types, and categorical values.
//
// All services should import from @rez/shared instead of defining their own.
// For npm consumers: import { LOYALTY_TIERS, USER_ROLES, TRANSACTION_TYPES } from '@rez/shared';
//
// NOTE: Coin types, cashback status, order status, and payment status — along with
// their normalization helpers (normalizeCoinType, normalizeCashbackStatus,
// normalizeLoyaltyTier, normalizeOrderStatus, normalizePaymentStatus) — are
// exported by their respective files: constants/coins.ts, orderStatuses.ts,
// paymentStatuses.ts, and statusCompat.ts. Do NOT re-export them here to avoid
// duplicate identifier errors.

// ── Loyalty Tiers ──────────────────────────────────────────────────────────────
// DM-HIGH-05 FIX: Canonical lowercase enum. All comparisons must use this enum.
// DM values: 'bronze', 'silver', 'gold', 'platinum', 'diamond'
export const LOYALTY_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const;
export type LoyaltyTier = typeof LOYALTY_TIERS[number];

export function normalizeLoyaltyTier(tier: string): LoyaltyTier {
  if (!tier) return 'bronze';
  const map: Record<string, LoyaltyTier> = {
    BRONZE: 'bronze', SILVER: 'silver', GOLD: 'gold', PLATINUM: 'platinum',
    STARTER: 'bronze',
    // P0 FIX: 'diamond' is now a distinct tier (not normalized to 'platinum').
    // 'DIAMOND' (UPPERCASE) and 'DIMAOND' (DB typo) still map to 'platinum'
    // for DB normalization, but 'diamond' (lowercase) is a valid canonical value.
    DIAMOND: 'diamond', DIMAOND: 'platinum',
  };
  return map[tier.toUpperCase()] ?? (LOYALTY_TIERS.includes(tier.toLowerCase() as LoyaltyTier) ? tier.toLowerCase() as LoyaltyTier : 'bronze');
}

// Transaction Types
// NOTE: Backend wallet service only supports 6 types (earned|spent|expired|refunded|bonus|branded_award).
// 'transfer' and 'gift' are NOT in the backend type definition. Do NOT add them to
// the backend wallet service without first updating the backend type definition.
export const TRANSACTION_TYPES = {
  EARNED: 'earned',
  SPENT: 'spent',
  EXPIRED: 'expired',
  REFUNDED: 'refunded',
  BONUS: 'bonus',
  BRANDED_AWARD: 'branded_award',
} as const;
export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];

// ── Loyalty Tier Perks Configuration ──────────────────────────────────────────
// Defines tangible benefits per loyalty tier. Used by consumer app, admin dashboard,
// and notification services to display tier-specific benefits and enforce rules.
export interface LoyaltyTierPerks {
  tier: LoyaltyTier;
  /** Cashback rate as a decimal (e.g., 0.01 = 1%) */
  cashbackRate: number;
  /** Free delivery on orders above this amount (INR). 0 = free delivery on all orders. null = no free delivery. */
  freeDeliveryMinOrder: number | null;
  /** Whether the user gets priority customer support */
  prioritySupport: boolean;
  /** Whether the user gets exclusive offers/deals */
  exclusiveOffers: boolean;
  /** Whether the user gets early access to new features/products */
  earlyAccess: boolean;
}

export const LOYALTY_TIER_PERKS: Record<LoyaltyTier, LoyaltyTierPerks> = {
  bronze: {
    tier: 'bronze',
    cashbackRate: 0.01,           // 1% cashback
    freeDeliveryMinOrder: 999,    // No free delivery
    prioritySupport: false,
    exclusiveOffers: false,
    earlyAccess: false,
  },
  silver: {
    tier: 'silver',
    cashbackRate: 0.015,          // 1.5% cashback
    freeDeliveryMinOrder: 500,    // Free delivery on orders > ₹500
    prioritySupport: false,
    exclusiveOffers: false,
    earlyAccess: false,
  },
  gold: {
    tier: 'gold',
    cashbackRate: 0.02,           // 2% cashback
    freeDeliveryMinOrder: 0,      // Free delivery on all orders
    prioritySupport: true,
    exclusiveOffers: false,
    earlyAccess: false,
  },
  platinum: {
    tier: 'platinum',
    cashbackRate: 0.03,           // 3% cashback
    freeDeliveryMinOrder: 0,      // Free delivery on all orders
    prioritySupport: true,
    exclusiveOffers: true,
    earlyAccess: false,
  },
  diamond: {
    tier: 'diamond',
    cashbackRate: 0.05,           // 5% cashback
    freeDeliveryMinOrder: 0,      // Free delivery on all orders
    prioritySupport: true,
    exclusiveOffers: true,
    earlyAccess: true,
  },
};

/**
 * Get the perks for a given loyalty tier.
 * Falls back to bronze perks if the tier is unknown.
 */
export function getLoyaltyTierPerks(tier: string): LoyaltyTierPerks {
  const normalized = normalizeLoyaltyTier(tier);
  return LOYALTY_TIER_PERKS[normalized] ?? LOYALTY_TIER_PERKS.bronze;
}

// User Roles
// 2026-04-16: CONSUMER added to match canonical shared-types/UserRole (7 values).
export const USER_ROLES = {
  USER: 'user',
  CONSUMER: 'consumer',
  MERCHANT: 'merchant',
  ADMIN: 'admin',
  SUPPORT: 'support',
  OPERATOR: 'operator',
  SUPER_ADMIN: 'super_admin',
} as const;
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
