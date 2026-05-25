/**
 * Secure Random Utilities
 *
 * Provides cryptographically secure random functions as replacements for Math.random()
 * These should be used for:
 * - ID generation (tokens, session IDs, message IDs)
 * - Nonces and salts
 * - Any security-sensitive operations
 *
 * Math.random() is NOT cryptographically secure and should never be used for:
 * - Session tokens
 * - Password reset tokens
 * - API keys
 * - Nonces
 * - Any security-sensitive IDs
 */

import crypto from 'crypto';

/**
 * Generate a cryptographically secure random number between 0 and 1
 */
export function secureRandom(): number {
  return parseInt(crypto.randomBytes(4).toString('hex'), 16) / 0xFFFFFFFF;
}

/**
 * Generate a random integer between min and max (inclusive)
 */
export function secureRandomInt(min: number, max: number): number {
  return Math.floor(secureRandom() * (max - min + 1)) + min;
}

/**
 * Generate a random float between min and max
 */
export function secureRandomFloat(min: number, max: number): number {
  return min + secureRandom() * (max - min);
}

/**
 * Generate a random hex string of specified length
 */
export function secureRandomHex(length: number): string {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * Generate a secure UUID v4
 */
export function secureUUID(): string {
  return crypto.randomUUID();
}

/**
 * Generate a secure alphanumeric string
 */
export function secureAlphanumeric(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = crypto.randomBytes(length);
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }

  return result;
}

/**
 * Generate a secure ID with prefix (e.g., 'msg_abc123')
 */
export function secureId(prefix: string, length: number = 12): string {
  return `${prefix}_${secureRandomHex(length)}`;
}

/**
 * Generate a secure nonce for OAuth/SSO
 */
export function generateNonce(): string {
  return secureRandomHex(32);
}

/**
 * Generate a secure state parameter for OAuth
 */
export function generateState(): string {
  return secureRandomHex(24);
}

/**
 * Add random variance to a value (for ML predictions)
 * Uses Box-Muller transform for normal distribution
 */
export function secureGaussianRandom(mean: number, stdDev: number): number {
  const u1 = secureRandom();
  const u2 = secureRandom();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}
