/**
 * REZ Merchant Intelligence - RABTUL Integration
 */

import axios from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'https://rez-event-bus.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

interface MerchantUser {
  id: string;
  merchantId?: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

interface WalletData {
  balance?: number;
  currency?: string;
  [key: string]: unknown;
}

/**
 * Verify merchant token
 */
export async function verifyMerchantToken(token: string): Promise<{ valid: boolean; merchant?: MerchantUser; error?: string }> {
  try {
    const res = await axios.get(`${AUTH_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Internal-Token': INTERNAL_TOKEN },
    });
    if (res.data.success && res.data.user) {
      return { valid: true, merchant: res.data.user as MerchantUser };
    }
    return { valid: false, error: 'Invalid token' };
  } catch (err) {
    const error = err as Error;
    return { valid: false, error: error.message };
  }
}

/**
 * Get merchant wallet
 */
export async function getMerchantWallet(merchantId: string): Promise<{ wallet?: WalletData | null; error?: string }> {
  try {
    const res = await axios.get(`${WALLET_URL}/api/wallet/${merchantId}/balance`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { wallet: res.data as WalletData };
  } catch (err) {
    const error = err as Error;
    return { wallet: null, error: error.message };
  }
}

/**
 * Add merchant earnings
 */
export async function addEarnings(merchantId: string, amount: number, reason: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${WALLET_URL}/api/wallet/add`, { userId: merchantId, amount, reason }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message };
  }
}

/**
 * Send merchant notification
 */
export async function notifyMerchant(merchantId: string, title: string, body: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${NOTIFICATION_URL}/api/notifications/push`, { userId: merchantId, title, body }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message };
  }
}

/**
 * Publish merchant event
 */
export async function publishMerchantEvent(eventType: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${EVENT_BUS_URL}/api/events/publish`, {
      type: `merchant.${eventType}`,
      source: 'REZ-merchant-intelligence',
      data,
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message };
  }
}

export const merchantIntelligenceRABTUL = {
  verifyMerchantToken,
  getMerchantWallet,
  addEarnings,
  notifyMerchant,
  publishMerchantEvent,
};

export default merchantIntelligenceRABTUL;
