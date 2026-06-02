/**
 * Format a number as Indian currency string.
 * e.g. 12500 → "₹12,500"
 */
export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Format with suffix for large numbers.
 * e.g. 12500 → "₹12.5K", 1200000 → "₹12L"
 */
export function formatShortCurrency(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000)   return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000)     return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
}

// ── DM-CRIT-02 FIX: Branded PaiseAmount type ─────────────────────────────────
// All monetary amounts in the platform are stored in PAISE (1 rupee = 100 paise).
// Raw `number` fields for amounts must use PaiseAmount to prevent 100× off errors
// from paise↔rupee confusion. All wallet, payment, and consumer app amounts are in paise.

declare const __brand: unique symbol;

/** Branded type for amounts stored in paise (1 rupee = 100 paise). */
export type PaiseAmount = number & { readonly [__brand]: typeof __brand };

/** Convert rupees to paise. Always rounds to nearest integer. */
export const toPaise = (rupees: number): PaiseAmount =>
  Math.round(rupees * 100) as PaiseAmount;

/** Convert paise to rupees. Returns float (e.g. 2500 paise → 25.00 rupees). */
export const toRupees = (paise: PaiseAmount): number => (paise as number) / 100;

/**
 * Display a PaiseAmount as a formatted rupee string.
 * @example formatPaise(2500) → "₹25.00"
 */
export const formatPaise = (paise: PaiseAmount): string =>
  formatCurrency(toRupees(paise));
