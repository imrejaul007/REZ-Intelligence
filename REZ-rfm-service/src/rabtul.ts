/**
 * REZ RFM Service - RABTUL Integration
 * Recency, Frequency, Monetary segmentation
 */

import axios from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'https://rez-event-bus.onrender.com';
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

/**
 * Reward based on RFM tier
 */
export async function rewardRFMTier(userId: string, tier: string, amount: number): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${WALLET_URL}/api/wallet/add`, {
      userId, amount, reason: `rfm_tier_${tier}`
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Notify user about RFM tier upgrade
 */
export async function notifyTierUpgrade(userId: string, newTier: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${NOTIFICATION_URL}/api/notifications/push`, {
      userId,
      title: 'Congratulations! You upgraded!',
      body: `You've reached ${newTier} tier!`,
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Publish RFM event
 */
export async function publishRFMEvent(eventType: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${EVENT_BUS_URL}/api/events/publish`, {
      type: `rfm.${eventType}`,
      source: 'REZ-rfm-service',
      data,
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export const rfmServiceRABTUL = {
  verifyToken,
  rewardRFMTier,
  notifyTierUpgrade,
  publishRFMEvent,
};

export default rfmServiceRABTUL;
