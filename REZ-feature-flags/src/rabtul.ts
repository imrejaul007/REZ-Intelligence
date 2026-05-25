/**
 * REZ Feature Flags - RABTUL Integration
 */

import axios from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * Verify token
 */
export async function verifyToken(token: string): Promise<{ valid: boolean; user?; error?: string }> {
  try {
    const res = await axios.get(`${AUTH_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Internal-Token': INTERNAL_TOKEN },
    });
    if (res.data.success && res.data.user) {
      return { valid: true, user: res.data.user };
    }
    return { valid: false, error: 'Invalid token' };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

export const featureFlagsRABTUL = {
  verifyToken,
};

export default featureFlagsRABTUL;
