/**
 * REZ Gift Card Service - RABTUL Integration
 */

import axios from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
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

export async function addGiftCardBalance(userId: string, amount: number): Promise<{ success: boolean }> {
  try {
    await axios.post(`${WALLET_URL}/api/wallet/add`, { userId, amount, reason: 'gift_card_redemption' }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch { return { success: false }; }
}

export async function notifyGiftRecipient(recipientId: string, senderName: string): Promise<{ success: boolean }> {
  try {
    await axios.post(`${NOTIFICATION_URL}/api/notifications/push`, {
      userId: recipientId,
      title: 'You received a gift card!',
      body: `${senderName} sent you a gift card`,
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch { return { success: false }; }
}

export const giftCardServiceRABTUL = { verifyToken, addGiftCardBalance, notifyGiftRecipient };
export default giftCardServiceRABTUL;
