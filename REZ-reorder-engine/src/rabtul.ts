/**
 * REZ Reorder Engine - RABTUL Integration
 * PRODUCTION: Fixed to properly handle errors and return actual status.
 */
import axios from 'axios';

const AUTH = process.env['AUTH_SERVICE_URL'] || 'https://rez-auth-service.onrender.com';
const WALLET = process.env['WALLET_SERVICE_URL'] || 'https://rez-wallet-service.onrender.com';
const NOTIFY = process.env['NOTIFICATION_SERVICE_URL'] || 'https://rez-notifications-service.onrender.com';
const TOKEN = process.env['INTERNAL_SERVICE_TOKEN'] || '';

const REQUEST_TIMEOUT = 10000;

export async function verifyToken(token: string): Promise<{ valid: boolean; user?: unknown; error?: string }> {
  try {
    const response = await axios.get(`${AUTH}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Internal-Token': TOKEN },
      timeout: REQUEST_TIMEOUT,
    });
    if (response.data.success && response.data.user) {
      return { valid: true, user: response.data.user };
    }
    return { valid: false, error: 'Invalid token response' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token verification failed';
    console.error('[RABTUL] verifyToken error:', message);
    return { valid: false, error: message };
  }
}

export async function addCoins(
  userId: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const response = await axios.post(
      `${WALLET}/api/wallet/add`,
      { userId, amount, reason },
      { headers: { 'Content-Type': 'application/json', 'X-Internal-Token': TOKEN }, timeout: REQUEST_TIMEOUT }
    );
    if (response.data.success) {
      return { success: true, transactionId: response.data.transactionId };
    }
    return { success: false, error: response.data.error || 'Wallet operation failed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add coins';
    console.error('[RABTUL] addCoins error:', message, { userId, amount });
    return { success: false, error: message };
  }
}

export async function notifyUser(
  userId: string,
  title: string,
  body: string
): Promise<{ success: boolean; notificationId?: string; error?: string }> {
  try {
    const response = await axios.post(
      `${NOTIFY}/api/notifications/push`,
      { userId, title, body },
      { headers: { 'X-Internal-Token': TOKEN }, timeout: REQUEST_TIMEOUT }
    );
    if (response.data.success) {
      return { success: true, notificationId: response.data.notificationId };
    }
    return { success: false, error: response.data.error || 'Notification failed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send notification';
    console.error('[RABTUL] notifyUser error:', message, { userId, title });
    return { success: false, error: message };
  }
}

export const reorderEngineRABTUL = { verifyToken, addCoins, notifyUser };
export default reorderEngineRABTUL;