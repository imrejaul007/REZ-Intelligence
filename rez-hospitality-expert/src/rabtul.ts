/**
 * Hospitality Expert - RABTUL Integration
 * Uses RABTUL for auth, payment, and wallet
 */

import axios from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || 'https://rez-payment-service.onrender.com';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service-36vo.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

export async function verifyToken(token: string) {
  try {
    const res = await axios.get(`${AUTH_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return res.data.success ? res.data.user : null;
  } catch { return null; }
}

export async function createPayment(userId: string, amount: number, description: string) {
  try {
    const res = await axios.post(`${PAYMENT_URL}/api/payments/create`, {
      userId, amount, description, metadata: { source: 'hospitality-expert' }
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return res.data.paymentId;
  } catch { return null; }
}

export async function addReward(userId: string, coins: number, reason: string) {
  try {
    await axios.post(`${WALLET_URL}/api/wallet/add`, { userId, amount: coins, reason }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return true;
  } catch { return false; }
}

export const hospitalityRABTUL = { verifyToken, createPayment, addReward };
