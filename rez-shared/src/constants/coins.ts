/**
 * Canonical coin type constants for the REZ platform.
 *
 * Primary coin is 'rez' throughout the platform.
 */

// ── Coin Type Constants ────────────────────────────────────────────────────────

export const COIN_TYPES = {
  // 2026-04-16: Keys reordered to match canonical shared-types/CoinType enum order.
  // Canonical priority order: PROMO → BRANDED → PRIVE → CASHBACK → REFERRAL → REZ
  // Also renamed PRIMARY → REZ to align with canonical enum key name.
  PROMO:    'promo'    as const,
  BRANDED:  'branded'  as const,
  PRIVE:    'prive'    as const,
  CASHBACK: 'cashback' as const,
  REFERRAL: 'referral' as const,
  REZ:      'rez'      as const,
} as const;

export type CoinType = typeof COIN_TYPES[keyof typeof COIN_TYPES];

/** Array form for iteration and validation (canonical priority order: PROMO → BRANDED → PRIVE → CASHBACK → REFERRAL → REZ) */
export const COIN_TYPE_ARRAY: readonly CoinType[] = [
  'promo', 'branded', 'prive', 'cashback', 'referral', 'rez',
] as const;

/**
 * Canonical coin type values for use in Mongoose schema enums and runtime validation.
 * Mirrors the backend's COIN_TYPE_VALUES but is defined here in the shared canonical source.
 * WALLET-03 fix: exported so rez-backend can import from @rez/shared instead of maintaining a duplicate.
 */
export const COIN_TYPE_VALUES = COIN_TYPE_ARRAY;

// ── Legacy Compatibility ───────────────────────────────────────────────────────

/** Maps legacy 'nuqta' to canonical 'rez'. All other types pass through. */
export const LEGACY_COIN_TYPE_MAP: Record<string, CoinType> = {
  nuqta:    'rez',
  rez:      'rez',
  prive:    'prive',
  branded:  'branded',
  promo:    'promo',
  cashback: 'cashback',
  referral: 'referral',
};

/** Normalize any coin type string to canonical CoinType. Falls back to 'rez'. */
export function normalizeCoinType(type: string): CoinType {
  return (LEGACY_COIN_TYPE_MAP[type.toLowerCase()] ?? 'rez') as CoinType;
}

// ── Coin Configuration ────────────────────────────────────────────────────────

// H36 fix: COIN_EXPIRY_DAYS values must match currencyRules.ts (the canonical backend source).
// Previous values: promo=7 (was 90 in backend), branded=90 (was 180 in backend).
// REZ coins: 0 in backend (never expire) — using 0 here to match.
export const COIN_EXPIRY_DAYS: Record<CoinType, number> = {
  rez:      0,    // Primary coins: never expire (matches currencyRules.ts expiryDays: 0)
  prive:    365,  // Privé coins: 1 year
  promo:    90,   // Promo coins: 90 days (matches currencyRules.ts)
  branded:  180,  // Branded coins: 6 months (matches currencyRules.ts)
  cashback: 365,  // Cashback coins: 1 year
  referral: 180,  // Referral coins: 6 months
};

export const COIN_DISPLAY_NAMES: Record<CoinType, string> = {
  rez:      'REZ Coins',
  prive:    'Privé Coins',
  promo:    'Promo Coins',
  branded:  'Branded Coins',
  cashback: 'Cashback',
  referral: 'Referral Bonus',
};

// ── Reward Types ──────────────────────────────────────────────────────────────

export const REWARD_TYPES = [
  'store_payment', 'bill_payment', 'recharge',
  'referral_bonus', 'streak_bonus', 'prive_campaign',
  'mission_complete', 'first_visit', 'birthday_bonus',
] as const;

export type RewardType = typeof REWARD_TYPES[number];

// ── P0-ENUM-2 FIX: Canonical CashbackStatus ──────────────────────────────────────
// Source of truth: rezbackend/src/models/Cashback.ts (status field enum).
// Canonical values are lowercase strings matching MongoDB document values.

export const CASHBACK_STATUS = {
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CREDITED: 'credited',
  PAID: 'paid',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

export type CashbackStatus = (typeof CASHBACK_STATUS)[keyof typeof CASHBACK_STATUS];

/**
 * Normalize any cashback status string to canonical lowercase form.
 * Handles UPPERCASE, MixedCase, and legacy variations.
 */
export function normalizeCashbackStatus(status: string): CashbackStatus {
  const canonical = CASHBACK_STATUS[status?.toUpperCase() as keyof typeof CASHBACK_STATUS];
  if (!canonical) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[normalizeCashbackStatus] Unknown status "${status}" — defaulting to pending`);
    }
    return 'pending';
  }
  return canonical;
}

// ── P0-ENUM-3 FIX + E-T5: Canonical LoyaltyTier (lowercase) ─────────────────────
// Handles the case mismatch between DB values (UPPERCASE) and business logic (lowercase).
// DB referralTier field: 'STARTER' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'DIMAOND' (typo)
// achievements.ts uses: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
//
// E-T5 FIX: The conflict was that rez-shared/src/enums.ts treats 'diamond' as a DISTINCT
// tier (5 tiers total), but this file was normalizing 'DIAMOND' → 'platinum'. The correct
// behavior is: 'DIAMOND' (DB UPPERCASE) → 'diamond' (canonical lowercase, distinct tier).
// Only the 'DIMAOND' typo should map to 'platinum' (to handle a DB entry error).
//
// Canonical LOYALTY_TIERS from enums.ts: ['bronze', 'silver', 'gold', 'platinum', 'diamond']

// ── Coin Earning Rate ─────────────────────────────────────────────────────────

// CRITICAL-010 FIX: Canonical coin earning rate.
// 1 REZ coin earned per ₹1 of transaction value.
// Used for earning calculations. For dynamic rates, services should use DB-backed WalletConfig.
// The display/redemption rate (coin → rupee) is COIN_TO_RUPEE_RATE (1.0 by default).
export const COIN_EARNING_RATE = {
  /** Coins earned per ₹1 spent. Default: 1 coin per ₹1. */
  PER_RUPEE: 1,
  /** Minimum transaction value (₹) before coins are earned. 0 = all transactions earn. */
  MIN_TRANSACTION: 0,
  /** Daily coin earning cap per user. 0 = no cap. */
  DAILY_CAP: 500,
  /** Coin earning cap per transaction. 0 = no cap. */
  PER_TRANSACTION_CAP: 200,
} as const;

/**
 * Compute coins earned for a given rupee amount.
 * Uses COIN_EARNING_RATE.PER_RUPEE as the base rate.
 *
 * @param rupees - Transaction value in rupees
 * @param cap - Optional per-transaction cap override
 */
export function coinsEarned(rupees: number, cap?: number): number {
  const earned = Math.floor(rupees * COIN_EARNING_RATE.PER_RUPEE);
  const effectiveCap = cap ?? COIN_EARNING_RATE.PER_TRANSACTION_CAP;
  return effectiveCap > 0 ? Math.min(earned, effectiveCap) : earned;
}

/**
 * Canonical spend rate: 1 coin = ₹1 (net-zero coin economy).
 * Locked as product decision on 2026-04-17: earn rate == spend rate.
 * All env vars (COIN_TO_RUPEE_RATE, REZ_COIN_TO_RUPEE_RATE, REZ_COINS_PER_RUPEE)
 * must remain aligned at 1.0 for this to hold.
 */
export const COIN_TO_RUPEE_RATE = 1.0 as const;

/**
 * Compute rupees equivalent for a given coin amount.
 * Uses COIN_TO_RUPEE_RATE as the redemption rate.
 */
export function coinsToRupees(coins: number): number {
  return coins * COIN_TO_RUPEE_RATE;
}

export const LOYALTY_TIER = {
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
  PLATINUM: 'platinum',
  STARTER: 'bronze',    // 'STARTER' maps to 'bronze'
  DIAMOND: 'diamond',   // E-T5 FIX: 'DIAMOND' is a distinct tier, not an alias for 'platinum'
  DIMAOND: 'platinum',  // 'DIMAOND' is the DB typo — normalize to 'platinum' (DB error)
} as const;

export type LoyaltyTier = (typeof LOYALTY_TIER)[keyof typeof LOYALTY_TIER];

/**
 * Normalize any loyalty tier string to canonical lowercase form.
 * Handles UPPERCASE, MixedCase, and the 'DIMAOND' typo.
 */
export function normalizeLoyaltyTier(tier: string): LoyaltyTier {
  if (!tier) return 'bronze';
  const upper = tier.toUpperCase();
  const map: Record<string, LoyaltyTier> = {
    'BRONZE': 'bronze', 'SILVER': 'silver', 'GOLD': 'gold', 'PLATINUM': 'platinum',
    'STARTER': 'bronze',
    // E-T5 FIX: 'diamond' is a distinct tier. Only 'DIMAOND' (typo) → 'platinum'.
    'DIAMOND': 'diamond', 'DIMAOND': 'platinum',
  };
  return map[upper] || 'bronze';
}
