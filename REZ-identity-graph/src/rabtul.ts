/**
 * REZ Identity Graph - RABTUL Integration
 * Unified user identity management
 */

import axios from 'axios';

const AUTH_URL = process.env['AUTH_SERVICE_URL'] || 'https://rez-auth-service.onrender.com';
const PROFILE_URL = process.env['PROFILE_SERVICE_URL'] || 'https://rez-profile-service.onrender.com';
const WALLET_URL = process.env['WALLET_SERVICE_URL'] || 'https://rez-wallet-service.onrender.com';
const EVENT_BUS_URL = process.env['EVENT_BUS_URL'] || 'https://rez-event-bus.onrender.com';
const INTERNAL_TOKEN = process.env['INTERNAL_SERVICE_TOKEN'] || '';

// ============================================
// TYPES
// ============================================

interface TokenVerificationResult {
  valid: boolean;
  user?: unknown;
  error?: string;
}

interface ProfileResult {
  profile: unknown;
  error?: string;
}

interface WalletResult {
  wallet: unknown;
  error?: string;
}

// ============================================
// HELPERS
// ============================================

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// ============================================
// FUNCTIONS
// ============================================

/**
 * Verify token
 */
export async function verifyToken(token: string): Promise<TokenVerificationResult> {
  try {
    const res = await axios.get(`${AUTH_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Internal-Token': INTERNAL_TOKEN },
    });
    if (res.data.success && res.data.user) {
      return { valid: true, user: res.data.user };
    }
    return { valid: false, error: 'Invalid token' };
  } catch (error) {
    return { valid: false, error: getErrorMessage(error) };
  }
}

/**
 * Get unified profile
 */
export async function getUnifiedProfile(userId: string): Promise<ProfileResult> {
  try {
    const res = await axios.get(`${PROFILE_URL}/api/profiles/${userId}`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { profile: res.data };
  } catch (error) {
    return { profile: null, error: getErrorMessage(error) };
  }
}

/**
 * Update unified profile
 */
export async function updateUnifiedProfile(userId: string, updates: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.patch(`${PROFILE_URL}/api/profiles/${userId}`, updates, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Link identity to profile
 */
export async function linkIdentity(userId: string, identity: { type: string; value: string }): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${PROFILE_URL}/api/identities/link`, { userId, ...identity }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Resolve identity across sources
 */
export async function resolveIdentity(identifier: string, type: 'phone' | 'email' | 'device'): Promise<{ userId?: string; error?: string }> {
  try {
    const res = await axios.post(`${AUTH_URL}/api/auth/resolve-identity`, { identifier, type }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { userId: res.data.userId };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

/**
 * Get user wallet for verification
 */
export async function getUserWallet(userId: string): Promise<WalletResult> {
  try {
    const res = await axios.get(`${WALLET_URL}/api/wallet/${userId}/balance`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { wallet: res.data };
  } catch (error) {
    return { wallet: null, error: getErrorMessage(error) };
  }
}

/**
 * Publish identity event
 */
export async function publishIdentityEvent(eventType: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${EVENT_BUS_URL}/api/events/publish`, {
      type: `identity.${eventType}`,
      source: 'REZ-identity-graph',
      data,
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Track user registered
 */
export async function trackUserRegistered(userId: string, source: string): Promise<{ success: boolean; error?: string }> {
  return publishIdentityEvent('registered', { userId, source });
}

/**
 * Track user login
 */
export async function trackUserLogin(userId: string, deviceId?: string): Promise<{ success: boolean; error?: string }> {
  return publishIdentityEvent('logged_in', { userId, deviceId });
}

/**
 * Track identities linked
 */
export async function trackIdentitiesLinked(userId: string, identities: string[]): Promise<{ success: boolean; error?: string }> {
  return publishIdentityEvent('linked', { userId, identities });
}

export const identityGraphRABTUL = {
  verifyToken,
  getUnifiedProfile,
  updateUnifiedProfile,
  linkIdentity,
  resolveIdentity,
  getUserWallet,
  publishIdentityEvent,
  trackUserRegistered,
  trackUserLogin,
  trackIdentitiesLinked,
};

export default identityGraphRABTUL;
