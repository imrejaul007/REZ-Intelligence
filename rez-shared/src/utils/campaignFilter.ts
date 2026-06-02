/**
 * Campaign Filter Translation Utility
 *
 * FL-13 fix: Consumer code sends `campaignType` (camelCase) with values like
 * 'LUCKY_DRAW' (SCREAMING_CASE) but the backend expects `type` (snake_case) with
 * values like 'lucky_draw' (lowercase).
 *
 * This utility provides bidirectional translation between consumer filter format
 * and the backend query format so that filtering always works regardless of which
 * layer sends the request.
 *
 * Consumer API call (before fix — BROKEN):
 *   GET /api/campaigns/active?campaignType=LUCKY_DRAW
 *
 * Consumer API call (after fix — WORKS):
 *   GET /api/campaigns/active?type=lucky_draw
 *   // OR use campaignFilterToBackend() to transform the full params object:
 *   const params = campaignFilterToBackend({ campaignType: 'LUCKY_DRAW' });
 *   // params = { type: 'lucky_draw' }
 */

import { screamingToSnake, normalizeCase } from './caseNormalization';

// ── Canonical CampaignType values (snake_case, as stored in DB) ─────────────────
export const CAMPAIGN_TYPE_VALUES = [
  'cashback_boost',
  'bank_offer',
  'bill_upload_bonus',
  'category_multiplier',
  'first_transaction_bonus',
  'festival_offer',
  'new-user',          // note: hyphen, not underscore (ENUM-11 — deferred)
  'flash_sale',
  'lucky_draw',
  'referral_bonus',
  'tier_upgrade',
] as const;

export type CampaignTypeCanonical = (typeof CAMPAIGN_TYPE_VALUES)[number];

// ── Consumer-facing campaign type labels (display names) ────────────────────────
export const CAMPAIGN_TYPE_LABELS: Record<CampaignTypeCanonical | string, string> = {
  cashback_boost: 'Cashback Boost',
  bank_offer: 'Bank Offer',
  bill_upload_bonus: 'Bill Upload Bonus',
  category_multiplier: 'Category Multiplier',
  first_transaction_bonus: 'First Transaction Bonus',
  festival_offer: 'Festival Offer',
  'new-user': 'New User',
  flash_sale: 'Flash Sale',
  lucky_draw: 'Lucky Draw',
  referral_bonus: 'Referral Bonus',
  tier_upgrade: 'Tier Upgrade',
};

// ── Consumer filter keys to backend query keys ──────────────────────────────────
interface CampaignFilterInput {
  campaignType?: string;
  type?: string;
  status?: string;
  isActive?: boolean;
  limit?: number;
  page?: number;
  region?: string;
}

/**
 * Translate a consumer-side campaign filter object to the format expected by
 * the backend /api/campaigns/active endpoint.
 *
 * Handles:
 *   - Key renaming: campaignType → type
 *   - Case normalization: 'LUCKY_DRAW' → 'lucky_draw'
 *   - Only passes recognized keys to the backend
 *
 * @param input - Consumer filter params (may contain campaignType, camelCase values)
 * @returns Backend-compatible query params
 */
export function campaignFilterToBackend(input: CampaignFilterInput): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};

  if (input.limit != null) result.limit = input.limit;
  if (input.page != null) result.page = input.page;
  if (input.region != null) result.region = input.region;
  if (input.isActive != null) result.isActive = input.isActive;

  // Normalize type: consumer may send 'campaignType' or 'type'
  const rawType = input.campaignType ?? input.type;
  if (rawType != null) {
    result.type = normalizeCase(rawType);
  }

  // Normalize status: consumer may send SCREAMING_CASE
  if (input.status != null) {
    result.status = normalizeCase(input.status);
  }

  return result;
}

/**
 * Translate a backend campaign response item to consumer-friendly format.
 * Normalizes enum values to canonical snake_case.
 *
 * @param campaign - Raw campaign object from backend
 * @returns Consumer-normalized campaign object
 */
export function campaignFromBackend<T extends Record<string, unknown>>(campaign: T): T {
  // Normalize the 'type' field if present
  if (campaign.type && typeof campaign.type === 'string') {
    return { ...campaign, type: normalizeCase(campaign.type) };
  }
  return campaign;
}

/**
 * Build a backend query URLSearchParams from consumer filter input.
 *
 * @example
 *   const params = buildCampaignQuery({ campaignType: 'LUCKY_DRAW', limit: 10 });
 *   // params.toString() === 'type=lucky_draw&limit=10'
 */
export function buildCampaignQuery(input: CampaignFilterInput): URLSearchParams {
  const backendParams = campaignFilterToBackend(input);
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(backendParams)) {
    searchParams.set(key, String(value));
  }
  return searchParams;
}

/**
 * Validate that a campaign type value is in the canonical set.
 * Returns the canonical value or null if invalid.
 */
export function validateCampaignType(raw: string | undefined): CampaignTypeCanonical | null {
  if (!raw) return null;
  const normalized = normalizeCase(raw);
  if (CAMPAIGN_TYPE_VALUES.includes(normalized as CampaignTypeCanonical)) {
    return normalized as CampaignTypeCanonical;
  }
  return null;
}
