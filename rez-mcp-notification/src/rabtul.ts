/**
 * REZ MCP Notification - RABTUL Integration
 */
import axios from 'axios';
const AUTH = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const NOTIFY = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

export async function verifyToken(token: string) {
  try {
    const r = await axios.get(`${AUTH}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Internal-Token': TOKEN },
      timeout: 5000
    });
    return { valid: r.data?.success ?? false };
  } catch (error) {
    console.error('[RABTUL] verifyToken error:', error);
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendPush(userId: string, title: string, body: string) {
  try {
    const response = await axios.post(`${NOTIFY}/api/notifications/push`, { userId, title, body }, {
      headers: { 'X-Internal-Token': TOKEN },
      timeout: 5000
    });
    return { success: response.data?.success ?? true };
  } catch (error) {
    console.error('[RABTUL] sendPush error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export const mcpNotificationRABTUL = { verifyToken, sendPush };
export default mcpNotificationRABTUL;
