/**
 * REZ Expert Services - RABTUL Integration
 *
 * Common RABTUL integration for all expert services:
 * - Hospitality Expert (3000)
 * - Salon Expert (3005)
 * - Fitness Expert (3010)
 * - Health Expert (3011)
 * - Travel Expert (3003)
 * - Retail Expert (3004)
 */

import axios from 'axios';

// Configuration
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'https://rez-payment-service.onrender.com';
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service-36vo.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// ============================================
// Auth Integration
// ============================================

export async function verifyUserToken(token: string): Promise<{
  valid: boolean;
  userId?: string;
  role?: string;
} | null> {
  try {
    const response = await axios.get(`${AUTH_SERVICE_URL}/api/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Internal-Token': INTERNAL_TOKEN,
      },
    });

    if (response.data.success && response.data.user) {
      return {
        valid: true,
        userId: response.data.user.id,
        role: response.data.user.role || 'user',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function sendOTP(phone: string): Promise<boolean> {
  try {
    const response = await axios.post(
      `${AUTH_SERVICE_URL}/api/auth/send-otp`,
      { phone },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data.success ?? false;
  } catch {
    return false;
  }
}

export async function verifyOTP(phone: string, otp: string): Promise<{
  success: boolean;
  token?: string;
} | null> {
  try {
    const response = await axios.post(
      `${AUTH_SERVICE_URL}/api/auth/verify-otp`,
      { phone, otp },
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (response.data.success) {
      return {
        success: true,
        token: response.data.token,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================
// Payment Integration
// ============================================

export async function createPayment(params: {
  userId: string;
  amount: number;
  description: string;
  metadata?: Record<string, string>;
}): Promise<{ paymentId: string } | null> {
  try {
    const response = await axios.post(
      `${PAYMENT_SERVICE_URL}/api/payments/create`,
      {
        userId: params.userId,
        amount: params.amount,
        description: params.description,
        metadata: params.metadata,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': INTERNAL_TOKEN,
        },
      }
    );

    return { paymentId: response.data.paymentId };
  } catch {
    return null;
  }
}

export async function verifyPayment(paymentId: string): Promise<{
  status: 'pending' | 'completed' | 'failed';
} | null> {
  try {
    const response = await axios.get(`${PAYMENT_SERVICE_URL}/api/payments/${paymentId}`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { status: response.data.status };
  } catch {
    return null;
  }
}

// ============================================
// Wallet Integration
// ============================================

export async function getWalletBalance(userId: string): Promise<number> {
  try {
    const response = await axios.get(`${WALLET_SERVICE_URL}/api/wallet/${userId}/balance`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return response.data.balance || 0;
  } catch {
    return 0;
  }
}

export async function addCoins(
  userId: string,
  amount: number,
  reason: string
): Promise<boolean> {
  try {
    await axios.post(
      `${WALLET_SERVICE_URL}/api/wallet/add`,
      { userId, amount, reason },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': INTERNAL_TOKEN,
        },
      }
    );
    return true;
  } catch {
    return false;
  }
}

export async function deductCoins(
  userId: string,
  amount: number,
  reason: string
): Promise<boolean> {
  try {
    await axios.post(
      `${WALLET_SERVICE_URL}/api/wallet/deduct`,
      { userId, amount, reason },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': INTERNAL_TOKEN,
        },
      }
    );
    return true;
  } catch {
    return false;
  }
}

// ============================================
// Default Export
// ============================================

export const expertRABTUL = {
  auth: {
    verifyUserToken,
    sendOTP,
    verifyOTP,
  },
  payment: {
    createPayment,
    verifyPayment,
  },
  wallet: {
    getBalance: getWalletBalance,
    addCoins,
    deductCoins,
  },
};

export default expertRABTUL;
