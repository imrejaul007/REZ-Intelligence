/**
 * Fraud Agent - RABTUL Integration
 */

import axios from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'https://rez-event-bus.onrender.com';
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
 * Freeze user wallet if fraud detected
 */
export async function freezeUserWallet(userId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${WALLET_URL}/api/wallet/freeze`, { userId, reason }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Unfreeze user wallet
 */
export async function unfreezeUserWallet(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${WALLET_URL}/api/wallet/unfreeze`, { userId }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Notify security team of fraud
 */
export async function notifySecurityTeam(fraudType: string, userId: string, details: Record<string, any>): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${NOTIFICATION_URL}/api/notifications/push`, {
      userId: 'security_team',
      title: 'Fraud Alert',
      body: `${fraudType} detected for user ${userId}`,
      data: { action: 'review_fraud', userId, fraudType, ...details },
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Publish fraud event to event bus
 */
export async function publishFraudEvent(eventType: string, data: Record<string, any>): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${EVENT_BUS_URL}/api/events/publish`, {
      type: `fraud.${eventType}`,
      source: 'rez-fraud-agent',
      data,
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get wallet balance for verification
 */
export async function getWalletBalance(userId: string): Promise<{ balance: number; frozen: boolean; error?: string }> {
  try {
    const res = await axios.get(`${WALLET_URL}/api/wallet/${userId}/balance`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { balance: res.data.balance || 0, frozen: res.data.frozen || false };
  } catch (error: any) {
    return { balance: 0, frozen: false, error: error.message };
  }
}

export const fraudAgentRABTUL = {
  verifyToken,
  freezeUserWallet,
  unfreezeUserWallet,
  notifySecurityTeam,
  publishFraudEvent,
  getWalletBalance,
};

export default fraudAgentRABTUL;
