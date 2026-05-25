/**
 * REZ Observability System - RABTUL Integration
 */

import axios from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

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

export async function notifyOncall(title: string, body: string, severity: string): Promise<{ success: boolean }> {
  try {
    await axios.post(`${NOTIFICATION_URL}/api/notifications/push`, {
      userId: 'oncall_team',
      title: `[${severity.toUpperCase()}] ${title}`,
      body,
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch { return { success: false }; }
}

export const observabilitySystemRABTUL = { verifyToken, notifyOncall };
export default observabilitySystemRABTUL;
