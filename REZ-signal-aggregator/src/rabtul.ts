/**
 * REZ Signal Aggregator - RABTUL Integration
 */

import axios from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'https://rez-event-bus.onrender.com';
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

export async function rewardHighValueUser(userId: string, amount: number): Promise<{ success: boolean }> {
  try {
    await axios.post(`${WALLET_URL}/api/wallet/add`, { userId, amount, reason: 'signal_based_reward' }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch { return { success: false }; }
}

export async function notifyAtRiskUser(userId: string): Promise<{ success: boolean }> {
  try {
    await axios.post(`${NOTIFICATION_URL}/api/notifications/push`, {
      userId,
      title: 'We miss you!',
      body: 'Here is a special offer just for you.',
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch { return { success: false }; }
}

export async function publishSignal(signalType: string, data: Record<string, unknown>): Promise<{ success: boolean }> {
  try {
    await axios.post(`${EVENT_BUS_URL}/api/events/publish`, {
      type: `signal.${signalType}`,
      source: 'REZ-signal-aggregator',
      data,
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch { return { success: false }; }
}

export const signalAggregatorRABTUL = { verifyToken, rewardHighValueUser, notifyAtRiskUser, publishSignal };
export default signalAggregatorRABTUL;
