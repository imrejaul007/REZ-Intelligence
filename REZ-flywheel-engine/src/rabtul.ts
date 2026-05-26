/**
 * REZ Flywheel Engine - RABTUL Integration
 */
import axios from 'axios';
const AUTH = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const NOTIFY = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const EVENT = process.env.EVENT_BUS_URL || 'https://rez-event-bus.onrender.com';
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

export async function addCoins(userId: string, amount: number, reason: string) {
  try {
    const response = await axios.post(`${WALLET}/api/wallet/add`, { userId, amount, reason }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': TOKEN },
      timeout: 5000
    });
    return { success: response.data?.success ?? true };
  } catch (error) {
    console.error('[RABTUL] addCoins error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function notifyUser(userId: string, title: string, body: string) {
  try {
    const response = await axios.post(`${NOTIFY}/api/notifications/push`, { userId, title, body }, {
      headers: { 'X-Internal-Token': TOKEN },
      timeout: 5000
    });
    return { success: response.data?.success ?? true };
  } catch (error) {
    console.error('[RABTUL] notifyUser error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function publishEvent(type: string, data: Record<string, unknown>) {
  try {
    const response = await axios.post(`${EVENT}/api/events/publish`, { type: `flywheel.${type}`, source: 'REZ-flywheel-engine', data }, {
      headers: { 'X-Internal-Token': TOKEN },
      timeout: 5000
    });
    return { success: response.data?.success ?? true };
  } catch (error) {
    console.error('[RABTUL] publishEvent error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export const flywheelEngineRABTUL = { verifyToken, addCoins, notifyUser, publishEvent };
export default flywheelEngineRABTUL;
