/**
 * REZ Error Intelligence - RABTUL Integration
 */

import axios from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * Verify token
 */
export async function verifyToken(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await axios.get(`${AUTH_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { valid: res.data.success };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Notify dev team
 */
export async function notifyDevTeam(title: string, error: string, severity: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${NOTIFICATION_URL}/api/notifications/push`, {
      userId: 'dev_team',
      title: `[${severity.toUpperCase()}] ${title}`,
      body: error.substring(0, 200),
      data: { source: 'REZ-error-intelligence' },
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export const errorIntelligenceRABTUL = {
  verifyToken,
  notifyDevTeam,
};

export default errorIntelligenceRABTUL;
