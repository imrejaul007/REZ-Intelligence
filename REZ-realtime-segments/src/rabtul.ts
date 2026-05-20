/**
 * REZ Realtime Segments - RABTUL Integration
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
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

export async function rewardSegmentUpgrade(userId: string, segment: string): Promise<{ success: boolean }> {
  const amounts: Record<string, number> = { high_spender: 200, loyal_customer: 100, power_user: 150 };
  try {
    await axios.post(`${WALLET_URL}/api/wallet/add`, {
      userId,
      amount: amounts[segment] || 50,
      reason: `segment_upgrade_${segment}`,
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch { return { success: false }; }
}

export async function notifyUser(userId: string, title: string, body: string): Promise<{ success: boolean }> {
  try {
    await axios.post(`${NOTIFICATION_URL}/api/notifications/push`, { userId, title, body }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch { return { success: false }; }
}

export async function publishSegmentEvent(type: string, data: Record<string, any>): Promise<{ success: boolean }> {
  try {
    await axios.post(`${EVENT_BUS_URL}/api/events/publish`, {
      type: `segment.${type}`,
      source: 'REZ-realtime-segments',
      data,
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch { return { success: false }; }
}

export const realtimeSegmentsRABTUL = { verifyToken, rewardSegmentUpgrade, notifyUser, publishSegmentEvent };
export default realtimeSegmentsRABTUL;
