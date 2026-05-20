/**
 * MCP Identity - RABTUL Identity Integration
 */

import axios from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const PROFILE_URL = process.env.PROFILE_SERVICE_URL || 'https://rez-profile-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * Verify token
 */
export async function verifyToken(token: string): Promise<{ valid: boolean; user?: any; error?: string }> {
  try {
    const res = await axios.get(`${AUTH_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Internal-Token': INTERNAL_TOKEN },
    });
    if (res.data.success && res.data.user) {
      return { valid: true, user: res.data.user };
    }
    return { valid: false, error: 'Invalid token' };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

/**
 * Register user
 */
export async function registerUser(data: {
  phone?: string;
  email?: string;
  name?: string;
  password?: string;
}): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    const res = await axios.post(`${AUTH_URL}/api/auth/register`, data, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.data.success) {
      return { success: true, userId: res.data.userId };
    }
    return { success: false, error: res.data.message };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get user profile
 */
export async function getProfile(userId: string): Promise<{ profile: any; error?: string }> {
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
 * Update user profile
 */
export async function updateProfile(userId: string, updates: Record<string, any>): Promise<{ success: boolean; error?: string }> {
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
 * Resolve identity
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

export const mcpIdentityRABTUL = {
  verifyToken,
  registerUser,
  getProfile,
  updateProfile,
  resolveIdentity,
};

export default mcpIdentityRABTUL;
