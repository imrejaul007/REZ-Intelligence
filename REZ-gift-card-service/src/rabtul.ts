/**
 * REZ Gift Card Service - RABTUL Integration
 * PRODUCTION: Fixed with proper error handling
 */

import axios from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
const TIMEOUT = 5000;

export async function verifyToken(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await axios.get(`${AUTH_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: TIMEOUT
    });
    if (response.data?.success) {
      return { valid: true };
    }
    return { valid: false, error: 'Invalid token response' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token verification failed';
    console.error('[RABTUL] verifyToken error:', message);
    return { valid: false, error: message };
  }
}

export async function addGiftCardBalance(userId: string, amount: number): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(
      `${WALLET_URL}/api/wallet/add`,
      { userId, amount, reason: 'gift_card_redemption' },
      { headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN }, timeout: TIMEOUT }
    );
    if (response.data?.success) {
      return { success: true };
    }
    return { success: false, error: response.data?.error || 'Failed to add gift card balance' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add gift card balance';
    console.error('[RABTUL] addGiftCardBalance error:', message, { userId, amount });
    return { success: false, error: message };
  }
}

export async function notifyGiftRecipient(recipientId: string, senderName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(
      `${NOTIFICATION_URL}/api/notifications/push`,
      { userId: recipientId, title: 'You received a gift card!', body: `${senderName} sent you a gift card` },
      { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: TIMEOUT }
    );
    if (response.data?.success) {
      return { success: true };
    }
    return { success: false, error: response.data?.error || 'Failed to notify recipient' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to notify recipient';
    console.error('[RABTUL] notifyGiftRecipient error:', message, { recipientId });
    return { success: false, error: message };
  }
}

export const giftCardServiceRABTUL = { verifyToken, addGiftCardBalance, notifyGiftRecipient };
export default giftCardServiceRABTUL;
