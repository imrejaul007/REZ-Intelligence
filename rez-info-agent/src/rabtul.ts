/**
 * Info Agent - RABTUL Integration
 */

import axios from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * Verify user token
 */
export async function verifyToken(token: string): Promise<{ valid: boolean; userId?: string; error?: string }> {
  try {
    const res = await axios.get(`${AUTH_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { valid: true, userId: res.data.user?.id };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

/**
 * Deduct coins for premium info
 */
export async function deductCoins(userId: string, amount: number, reason: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${WALLET_URL}/api/wallet/deduct`, { userId, amount, reason }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Add coins as reward for contributing info
 */
export async function rewardContributor(userId: string, amount: number, reason: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${WALLET_URL}/api/wallet/add`, { userId, amount, reason }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get user wallet balance
 */
export async function getBalance(userId: string): Promise<{ balance: number; error?: string }> {
  try {
    const res = await axios.get(`${WALLET_URL}/api/wallet/${userId}/balance`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { balance: res.data.balance || 0 };
  } catch (error: any) {
    return { balance: 0, error: error.message };
  }
}

/**
 * Send notification about info update
 */
export async function sendNotification(userId: string, title: string, body: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${NOTIFICATION_URL}/api/notifications/push`, { userId, title, body }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export const infoAgentRABTUL = {
  verifyToken,
  deductCoins,
  rewardContributor,
  getBalance,
  sendNotification,
};

export default infoAgentRABTUL;
