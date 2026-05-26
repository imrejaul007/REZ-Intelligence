/**
 * Identity Bridge - RABTUL Integration
 * Connect to RABTUL unified identity
 */

import axios from 'axios';
import winston from 'winston';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const PROFILE_URL = process.env.PROFILE_SERVICE_URL || 'https://rez-profile-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

const AXIOS_TIMEOUT = 5000;

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

interface UserIdentity {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  [key: string]: unknown;
}

interface UnifiedProfile {
  id: string;
  userId: string;
  email?: string;
  phone?: string;
  name?: string;
  avatar?: string;
  preferences?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Verify token and get user identity
 */
export async function verifyAndGetIdentity(token: string): Promise<{ valid: boolean; identity?: UserIdentity; error?: string }> {
  try {
    const res = await axios.get(`${AUTH_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    if (res.data.success && res.data.user) {
      return { valid: true, identity: res.data.user as UserIdentity };
    }
    return { valid: false, error: 'Invalid token' };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] verifyAndGetIdentity error:', err.message);
    return { valid: false, error: err.message };
  }
}

/**
 * Link identity to unified profile
 */
export async function linkToUnifiedProfile(userId: string, identityData: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(`${PROFILE_URL}/api/identities/link`, { userId, ...identityData }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    return { success: response.data?.success ?? true };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] linkToUnifiedProfile error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get unified profile
 */
export async function getUnifiedProfile(userId: string): Promise<{ profile?: UnifiedProfile | null; error?: string }> {
  try {
    const res = await axios.get(`${PROFILE_URL}/api/profiles/${userId}`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    return { profile: res.data as UnifiedProfile };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] getUnifiedProfile error:', err.message);
    return { profile: null, error: err.message };
  }
}

/**
 * Update unified profile
 */
export async function updateUnifiedProfile(userId: string, updates: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.patch(`${PROFILE_URL}/api/profiles/${userId}`, updates, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    return { success: response.data?.success ?? true };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] updateUnifiedProfile error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Resolve identity across sources
 */
export async function resolveIdentity(identifier: string, type: 'phone' | 'email' | 'device'): Promise<{ userId?: string; error?: string }> {
  try {
    const res = await axios.post(`${AUTH_URL}/api/auth/resolve-identity`, { identifier, type }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    return { userId: res.data.userId };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] resolveIdentity error:', err.message);
    return { error: err.message };
  }
}

export const identityBridgeRABTUL = {
  verifyAndGetIdentity,
  linkToUnifiedProfile,
  getUnifiedProfile,
  updateUnifiedProfile,
  resolveIdentity,
};

export default identityBridgeRABTUL;
