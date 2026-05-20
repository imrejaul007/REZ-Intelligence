/**
 * Consultant Agent - RABTUL Integration
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
 * Charge for consultation
 */
export async function chargeConsultation(userId: string, amount: number, consultationType: string): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const res = await axios.post(`${WALLET_URL}/api/wallet/deduct`, {
      userId,
      amount,
      reason: `consultation_${consultationType}`,
      metadata: { type: 'consultation', consultationType },
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true, transactionId: res.data.transactionId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Reward consultant for successful consultation
 */
export async function rewardConsultant(consultantId: string, amount: number, consultationType: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${WALLET_URL}/api/wallet/add`, {
      userId: consultantId,
      amount,
      reason: `consultation_completed_${consultationType}`,
      metadata: { type: 'consultant_reward', consultationType },
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Send notification to user
 */
export async function notifyUser(userId: string, title: string, body: string, data?: Record<string, string>): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${NOTIFICATION_URL}/api/notifications/push`, { userId, title, body, data }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get user balance
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
 * Notify consultant of new consultation request
 */
export async function notifyConsultant(consultantId: string, clientName: string, topic: string): Promise<{ success: boolean; error?: string }> {
  return notifyUser(consultantId, 'New Consultation Request', `You have a new consultation request from ${clientName} about ${topic}`);
}

/**
 * Send OTP for verification
 */
export async function sendOTP(phone: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${AUTH_URL}/api/auth/send-otp`, { phone }, {
      headers: { 'Content-Type': 'application/json' },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export const consultantAgentRABTUL = {
  verifyToken,
  chargeConsultation,
  rewardConsultant,
  notifyUser,
  notifyConsultant,
  getBalance,
  sendOTP,
};

export default consultantAgentRABTUL;
