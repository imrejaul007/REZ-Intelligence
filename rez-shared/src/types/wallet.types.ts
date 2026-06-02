/**
 * Canonical Wallet and Coin entity types for the REZ platform.
 *
 * Source of truth:
 *   rezbackend/src/models/Wallet.ts          (IWallet, ICoinBalance)
 *   rezbackend/src/models/CoinTransaction.ts  (ICoinTransaction)
 *   rez-shared/src/constants/coins.ts         (CoinType — authoritative)
 *
 * NOTE: WalletBalance and CoinTransaction (simple shapes) remain in
 * types/wallet.ts for backward compatibility. This file adds the full
 * Wallet entity and richer transaction types needed by all apps.
 *
 * Do NOT redefine these types in frontend apps — import from @rez/shared instead.
 */

// ── Coin Type ────────────────────────────────────────────────────────────────

/**
 * CoinType from @rez/shared/constants/coins.ts — canonical coin type enum.
 * WALLET-03 fix: the single source of truth, replacing WalletCoinType.
 * Use normalizeCoinType() from '@rez/shared' to canonicalize any legacy values
 * (e.g. 'nuqta') found in existing MongoDB docs.
 */
import type { CoinType } from '../constants/coins';
export type { CoinType } from '../constants/coins';

// ── Coin Balance (full) ───────────────────────────────────────────────────────

export interface BrandedCoinDetails {
  merchantId: string;
  merchantName: string;
  merchantLogo?: string;
  merchantColor?: string;
}

export interface CoinBalance {
  type: CoinType;
  amount: number;
  isActive: boolean;
  color: string;
  earnedDate?: string;       // ISO date string
  lastUsed?: string;
  lastEarned?: string;
  expiryDate?: string;
  brandedDetails?: BrandedCoinDetails;
  promoDetails?: {
    campaignId?: string;
    campaignName?: string;
    maxRedemptionPercentage: number;
    expiryDate: string;
  };
}

// ── Branded Coin ──────────────────────────────────────────────────────────────

export interface BrandedCoin {
  merchantId: string;
  merchantName: string;
  merchantLogo?: string;
  merchantColor?: string;
  amount: number;
  earnedDate: string;
  lastUsed?: string;
  expiresAt?: string;
  isActive: boolean;
}

// ── Wallet Balance (canonical — matches IWallet.balance) ──────────────────────

/**
 * Canonical balance shape from IWallet.balance.
 * Fields: total, available, pending, cashback.
 *
 * Note: A simpler WalletBalance interface (rez/prive/promo per-coin view)
 * lives in types/wallet.ts for backward compatibility with pre-Phase-8 code.
 * This WalletEntityBalance reflects the actual MongoDB document shape.
 */
export interface WalletEntityBalance {
  total: number;
  available: number;
  pending: number;
  cashback: number;
}

// ── Wallet Statistics ─────────────────────────────────────────────────────────

export interface WalletStatistics {
  totalEarned: number;
  totalSpent: number;
  totalCashback: number;
  totalRefunds: number;
  totalTopups: number;
  totalWithdrawals: number;
}

// ── Full Wallet entity ────────────────────────────────────────────────────────

// ── Wallet subdocument types (copied from backend IWallet) ─────────────────────
// WALLET-04 fix: these subdocuments existed in the backend IWallet model but were
// missing from the shared Wallet type, causing frontend reads of wallet.limits,
// wallet.settings, wallet.savingsInsights, and wallet.categoryBalances to return undefined.

export interface CategoryBalance {
  available: number;
  earned: number;
  spent: number;
}

export interface SavingsInsights {
  totalSaved: number;
  thisMonth: number;
  avgPerVisit: number;
  lastCalculated: string;  // ISO date string
  topCategory: string;
  topMerchant: { id: string; name: string };
  monthlyTrend: number[];  // 12 months of savings amounts
  weeklySpend: number;
  savedVsAvgUser: number;  // percentile 0-100
  potentialMissedSavings: number;
  favoriteStores: Array<{ id: string; name: string; visits: number }>;
}

export interface WalletLimits {
  maxBalance: number;
  minWithdrawal: number;
  dailySpendLimit: number;
  dailySpent: number;
  lastResetDate: string;  // ISO date string
}

export interface WalletSettings {
  autoTopup: boolean;
  autoTopupThreshold: number;
  autoTopupAmount: number;
  lowBalanceAlert: boolean;
  lowBalanceThreshold: number;
  smartAlertsEnabled: boolean;
  expiringCoinsAlertDays: number;
}

export interface Wallet {
  _id: string;
  user: string;
  balance: WalletEntityBalance;
  coins: CoinBalance[];
  brandedCoins: BrandedCoin[];
  categoryBalances: Record<string, CategoryBalance>;  // Map<string, CategoryBalance>
  currency: string;
  statistics: WalletStatistics;
  savingsInsights: SavingsInsights;
  limits: WalletLimits;
  settings: WalletSettings;
  isActive: boolean;
  isFrozen: boolean;
  frozenReason?: string;
  frozenAt?: string;
  lastTransactionAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Transaction Type ──────────────────────────────────────────────────────────

/**
 * Canonical transaction types from ICoinTransaction.type.
 */
export type CoinTransactionType =
  | 'earned'
  | 'spent'
  | 'expired'
  | 'refunded'
  | 'bonus'
  | 'branded_award';

// ── Transaction Status ────────────────────────────────────────────────────────

/**
 * BackendTransactionStatus: lowercase values sent by the backend API.
 * These are the wire values in CoinTransaction.status and wallet API responses.
 * Use this type when consuming API responses or writing API handlers.
 *
 * Note: 'reversed' is the backend term for a reversal (not 'REFUNDED').
 */
export type BackendTransactionStatus =
  | 'completed'
  | 'pending'
  | 'failed'
  | 'cancelled'
  | 'processing'
  | 'reversed';

/**
 * TransactionStatus: SCREAMING_CASE display enum for UI components.
 * Map from BackendTransactionStatus before rendering.
 * Do NOT send these values to the backend — use BackendTransactionStatus instead.
 */
export type TransactionStatus =
  | 'SUCCESS'
  | 'PENDING'
  | 'FAILED'
  | 'CANCELLED'
  | 'PROCESSING'
  | 'REVERSED';

// ── Coin Transaction coinType ─────────────────────────────────────────────────

/**
 * CoinTransaction.coinType values — as stored in the CoinTransaction model.
 * Distinct from WalletCoinType (the coin balance type in Wallet.coins[].type).
 */
/**
 * CoinTransactionCoinType: all coin types that can appear in a CoinTransaction document.
 * This is the full set from the CoinTransaction model (wallet-service + backend).
 * Matches CoinType from constants/coins.ts.
 * WALLET-03 fix: 'nuqta' removed — it is a legacy alias for 'rez'; normalize with
 * normalizeCoinType() when reading existing MongoDB docs, but never write new docs with 'nuqta'.
 */
export type CoinTransactionCoinType = 'rez' | 'prive' | 'branded' | 'promo' | 'cashback' | 'referral';

// ── Full Coin Transaction entity ──────────────────────────────────────────────

export interface CoinTransactionEntity {
  _id: string;
  user: string;
  type: CoinTransactionType;
  amount: number;
  balance: number;          // Legacy snapshot — balance at time of transaction
  coinType: CoinTransactionCoinType;
  balanceBefore: number;
  balanceAfter: number;
  source: string;           // See ICoinTransaction.source in backend for full enum
  description: string;
  category?: string;        // MainCategorySlug
  createdAt: string;
  updatedAt: string;
}
