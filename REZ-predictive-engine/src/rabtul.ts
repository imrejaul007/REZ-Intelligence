/**
 * REZ Predictive Engine - RABTUL Integration
 * Churn, LTV, Conversion predictions
 */

import axios from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'https://rez-event-bus.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// Helper to extract error message safely
const getErrorMsg = (e: unknown): string => e instanceof Error ? e.message : String(e);

/**
 * Verify token
 */
export async function verifyToken(token: string): Promise<{ valid: boolean; user?: Record<string, unknown>; error?: string }> {
  try {
    const res = await axios.get(`${AUTH_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Internal-Token': INTERNAL_TOKEN },
    });
    if (res.data.success && res.data.user) {
      return { valid: true, user: res.data.user as Record<string, unknown> };
    }
    return { valid: false, error: 'Invalid token' };
  } catch (error) {
    return { valid: false, error: getErrorMsg(error) };
  }
}

/**
 * Publish churn prediction
 */
export async function publishChurnPrediction(userId: string, probability: number, factors: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${EVENT_BUS_URL}/api/events/publish`, {
      type: 'intelligence.churn',
      source: 'REZ-predictive-engine',
      data: { userId, probability, factors },
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMsg(error) };
  }
}

/**
 * Publish LTV update
 */
export async function publishLTVUpdate(userId: string, ltv: number, tier: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${EVENT_BUS_URL}/api/events/publish`, {
      type: 'intelligence.ltv',
      source: 'REZ-predictive-engine',
      data: { userId, ltv, tier },
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMsg(error) };
  }
}

/**
 * Reward at-risk user to prevent churn
 */
export async function rewardToPreventChurn(userId: string, amount: number): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${WALLET_URL}/api/wallet/add`, {
      userId, amount, reason: 'churn_prevention'
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMsg(error) };
  }
}

/**
 * Notify at-risk user
 */
export async function notifyAtRiskUser(userId: string, offer: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${NOTIFICATION_URL}/api/notifications/push`, {
      userId,
      title: 'Special offer just for you!',
      body: offer,
      data: { action: 'churn_prevention' },
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMsg(error) };
  }
}

export const predictiveEngineRABTUL = {
  verifyToken,
  publishChurnPrediction,
  publishLTVUpdate,
  rewardToPreventChurn,
  notifyAtRiskUser,
};

export default predictiveEngineRABTUL;
