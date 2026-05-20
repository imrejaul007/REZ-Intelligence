/**
 * Identity Bridge - RABTUL Integration
 * Connect to RABTUL unified identity
 */

import axios from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const PROFILE_URL = process.env.PROFILE_SERVICE_URL || 'https://rez-profile-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * Verify token and get user identity
 */
export async function verifyAndGetIdentity(token: string): Promise<{ valid: boolean; identity?: any; error?: string }> {
  try {
    const res = await axios.get(`${AUTH_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Internal-Token': INTERNAL_TOKEN },
    });
    if (res.data.success && res.data.user) {
      return { valid: true, identity: res.data.user };
    }
    return { valid: false, error: 'Invalid token' };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

/**
 * Link identity to unified profile
 */
export async function linkToUnifiedProfile(userId: string, identityData: Record<string, any>): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${PROFILE_URL}/api/identities/link`, { userId, ...identityData }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get unified profile
 */
export async function getUnifiedProfile(userId: string): Promise<{ profile: any; error?: string }> {
  try {
    const res = await axios.get(`${PROFILE_URL}/api/profiles/${userId}`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { profile: res.data };
  } catch (error: any) {
    return { profile: null, error: error.message };
  }
}

/**
 * Update unified profile
 */
export async function updateUnifiedProfile(userId: string, updates: Record<string, any>): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.patch(`${PROFILE_URL}/api/profiles/${userId}`, updates, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
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
  } catch (error: any) {
    return { error: error.message };
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
