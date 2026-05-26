/**
 * REZ Action Engine - RABTUL Integration
 */

import axios from 'axios';
import winston from 'winston';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'https://rez-event-bus.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

const AXIOS_TIMEOUT = 5000;

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

/**
 * Verify token
 */
export async function verifyToken(token: string): Promise<{ valid: boolean; user?: unknown; error?: string }> {
  try {
    const res = await axios.get(`${AUTH_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    if (res.data.success && res.data.user) {
      return { valid: true, user: res.data.user };
    }
    return { valid: false, error: 'Invalid token' };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] verifyToken error:', err.message);
    return { valid: false, error: err.message };
  }
}

/**
 * Get user wallet
 */
export async function getWallet(userId: string): Promise<{ balance: number; error?: string }> {
  try {
    const res = await axios.get(`${WALLET_URL}/api/wallet/${userId}/balance`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    return { balance: res.data.balance || 0 };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] getWallet error:', err.message);
    return { balance: 0, error: err.message };
  }
}

/**
 * Add coins
 */
export async function addCoins(userId: string, amount: number, reason: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(`${WALLET_URL}/api/wallet/add`, { userId, amount, reason }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    return { success: response.data?.success ?? true };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] addCoins error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Deduct coins
 */
export async function deductCoins(userId: string, amount: number, reason: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(`${WALLET_URL}/api/wallet/deduct`, { userId, amount, reason }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    return { success: response.data?.success ?? true };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] deductCoins error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send notification
 */
export async function sendNotification(userId: string, title: string, body: string, data?: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(`${NOTIFICATION_URL}/api/notifications/push`, { userId, title, body, data }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    return { success: response.data?.success ?? true };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] sendNotification error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Publish action event
 */
export async function publishActionEvent(eventType: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(`${EVENT_BUS_URL}/api/events/publish`, {
      type: `action.${eventType}`,
      source: 'REZ-action-engine',
      data,
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    return { success: response.data?.success ?? true };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] publishActionEvent error:', err.message);
    return { success: false, error: err.message };
  }
}

export const actionEngineRABTUL = {
  verifyToken,
  getWallet,
  addCoins,
  deductCoins,
  sendNotification,
  publishActionEvent,
};

export default actionEngineRABTUL;
