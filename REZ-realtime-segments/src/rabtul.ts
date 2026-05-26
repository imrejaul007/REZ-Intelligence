/**
 * REZ Realtime Segments - RABTUL Integration
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

export async function verifyToken(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await axios.get(`${AUTH_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    return { valid: res.data.success };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] verifyToken error:', err.message);
    return { valid: false, error: err.message };
  }
}

export async function rewardSegmentUpgrade(userId: string, segment: string): Promise<{ success: boolean; error?: string }> {
  const amounts: Record<string, number> = { high_spender: 200, loyal_customer: 100, power_user: 150 };
  try {
    const response = await axios.post(`${WALLET_URL}/api/wallet/add`, {
      userId,
      amount: amounts[segment] || 50,
      reason: `segment_upgrade_${segment}`,
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    return { success: response.data?.success ?? true };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] rewardSegmentUpgrade error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function notifyUser(userId: string, title: string, body: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(`${NOTIFICATION_URL}/api/notifications/push`, { userId, title, body }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    return { success: response.data?.success ?? true };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] notifyUser error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function publishSegmentEvent(type: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(`${EVENT_BUS_URL}/api/events/publish`, {
      type: `segment.${type}`,
      source: 'REZ-realtime-segments',
      data,
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    return { success: response.data?.success ?? true };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] publishSegmentEvent error:', err.message);
    return { success: false, error: err.message };
  }
}

export const realtimeSegmentsRABTUL = { verifyToken, rewardSegmentUpgrade, notifyUser, publishSegmentEvent };
export default realtimeSegmentsRABTUL;
