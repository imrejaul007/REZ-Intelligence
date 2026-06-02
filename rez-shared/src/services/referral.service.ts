/**
 * Referral Service
 *
 * Handles referral code generation, validation, and reward processing.
 * Supports referral tracking for user acquisition campaigns.
 */

import { randomBytes } from 'crypto';

// Referral code configuration
const REFERRAL_CODE_LENGTH = 8;
const REFERRAL_CODE_PREFIX = 'REZ';

// Reward configuration
export interface ReferralRewardConfig {
  referrerCoins: number;
  refereeCoins: number;
  minOrderAmount?: number;
  expiryDays?: number;
}

export const DEFAULT_REFERRAL_REWARD: ReferralRewardConfig = {
  referrerCoins: 100,
  refereeCoins: 50,
  minOrderAmount: 100,
  expiryDays: 30,
};

/**
 * Generate a unique referral code
 */
export function generateReferralCode(): string {
  const randomPart = randomBytes(REFERRAL_CODE_LENGTH)
    .toString('base64url')
    .slice(0, REFERRAL_CODE_LENGTH)
    .toUpperCase();

  return `${REFERRAL_CODE_PREFIX}${randomPart}`;
}

/**
 * Validate referral code format
 */
export function isValidReferralCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;

  const pattern = new RegExp(`^${REFERRAL_CODE_PREFIX}[A-Z0-9]{${REFERRAL_CODE_LENGTH}}$`);
  return pattern.test(code.toUpperCase());
}

/**
 * Referral event types
 */
export enum ReferralEventType {
  SENT = 'sent',
  SIGNUP_COMPLETED = 'signup_completed',
  FIRST_ORDER_COMPLETED = 'first_order_completed',
  REWARD_CLAIMED = 'reward_claimed',
  EXPIRED = 'expired',
}

/**
 * Referral status
 */
export enum ReferralStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  REWARDED = 'rewarded',
  EXPIRED = 'expired',
  FAILED = 'failed',
}

/**
 * Referral record interface
 */
export interface ReferralRecord {
  id: string;
  referralCode: string;
  referrerUserId: string;
  refereeUserId?: string;
  refereePhone?: string;
  refereeEmail?: string;
  status: ReferralStatus;
  referralReward?: ReferralRewardConfig;
  referredAt: Date;
  signupCompletedAt?: Date;
  firstOrderCompletedAt?: Date;
  rewardClaimedAt?: Date;
  rewardExpiresAt?: Date;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  channel?: 'sms' | 'whatsapp' | 'email' | 'link' | 'qr';
}

/**
 * Referral link builder
 */
export interface ReferralLinkParams {
  referralCode: string;
  baseUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  deepLink?: string;
}

/**
 * Build a referral link with UTM parameters
 */
export function buildReferralLink(params: ReferralLinkParams): string {
  const baseUrl = params.baseUrl || process.env.REFERRAL_BASE_URL || 'https://rez.money/invite';
  const url = new URL(baseUrl);

  url.searchParams.set('ref', params.referralCode);

  if (params.utmSource) {
    url.searchParams.set('utm_source', params.utmSource);
  }
  if (params.utmMedium) {
    url.searchParams.set('utm_medium', params.utmMedium);
  }
  if (params.utmCampaign) {
    url.searchParams.set('utm_campaign', params.utmCampaign);
  }
  if (params.deepLink) {
    url.searchParams.set('deeplink', params.deepLink);
  }

  return url.toString();
}

/**
 * Parse referral code from URL or string
 */
export function extractReferralCode(input: string): string | null {
  if (!input) return null;

  try {
    // Try as full URL first
    const url = new URL(input);
    const ref = url.searchParams.get('ref');
    if (ref && isValidReferralCode(ref)) {
      return ref.toUpperCase();
    }

    // Try as raw referral code
    if (isValidReferralCode(input)) {
      return input.toUpperCase();
    }
  } catch {
    // Not a URL, try as raw code
    if (isValidReferralCode(input)) {
      return input.toUpperCase();
    }
  }

  return null;
}

/**
 * Calculate referral reward eligibility
 */
export function calculateReferralReward(
  orderAmount: number,
  config: ReferralRewardConfig = DEFAULT_REFERRAL_REWARD
): { eligible: boolean; referrerReward: number; refereeReward: number } {
  const minOrder = config.minOrderAmount || 0;
  const eligible = orderAmount >= minOrder;

  return {
    eligible,
    referrerReward: eligible ? config.referrerCoins : 0,
    refereeReward: eligible ? config.refereeCoins : 0,
  };
}

/**
 * Check if referral reward has expired
 */
export function isReferralRewardExpired(referral: ReferralRecord): boolean {
  if (!referral.rewardExpiresAt) return false;
  return new Date() > new Date(referral.rewardExpiresAt);
}

/**
 * Referral sharing message templates
 */
export const REFERRAL_MESSAGES = {
  sms: (code: string, link: string) =>
    `Join me on ReZ! Use my referral code ${code} or click: ${link} to get exclusive rewards!`,

  whatsapp: (code: string, link: string, referrerName?: string) =>
    `Hey! ${referrerName ? `${referrerName} invited you to` : "I'm using"} ReZ and thought you'd love it too!\n\nUse my code *${code}* or tap: ${link}\n\nYou'll get rewards when you sign up and make your first order!`,

  email: (code: string, link: string, referrerName?: string) =>
    `Hey,\n\n${referrerName ? `${referrerName} thought you'd enjoy` : "I thought you'd enjoy"} ReZ!\n\nUse my referral code *${code}* or click this link: ${link}\n\nYou'll get rewards when you sign up and make your first order.\n\n- The ReZ Team`,

  social: (code: string, link: string) =>
    `Join me on ReZ! Use referral code ${code} to get exclusive rewards. Sign up here: ${link}`,
};

/**
 * Get sharing message for a specific channel
 */
export function getReferralMessage(
  code: string,
  link: string,
  channel: keyof typeof REFERRAL_MESSAGES,
  referrerName?: string
): string {
  const template = REFERRAL_MESSAGES[channel];
  if (!template) {
    return `Use my referral code ${code}: ${link}`;
  }
  return template(code, link, referrerName);
}

/**
 * Share options for referral
 */
export type ShareChannel = 'sms' | 'whatsapp' | 'email' | 'copy' | 'native';

/**
 * Share referral link via native share API or URL schemes
 */
export function getShareUrl(channel: ShareChannel, code: string, link: string): string {
  switch (channel) {
    case 'sms':
      return `sms:?body=${encodeURIComponent(getReferralMessage(code, link, 'sms'))}`;

    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(getReferralMessage(code, link, 'whatsapp'))}`;

    case 'email':
      return `mailto:?subject=${encodeURIComponent('Join me on ReZ!')}&body=${encodeURIComponent(
        getReferralMessage(code, link, 'email')
      )}`;

    case 'native':
    case 'copy':
    default:
      return link;
  }
}

/**
 * Validate referral for a user (check not self-referral, not already referred)
 */
export interface ReferralValidation {
  valid: boolean;
  error?: string;
}

export function validateReferral(
  referralCode: string,
  currentUserId: string,
  referrerUserId?: string
): ReferralValidation {
  // Check valid code format
  if (!isValidReferralCode(referralCode)) {
    return { valid: false, error: 'Invalid referral code format' };
  }

  // Check not self-referral
  if (referrerUserId && referrerUserId === currentUserId) {
    return { valid: false, error: 'Cannot use your own referral code' };
  }

  return { valid: true };
}
