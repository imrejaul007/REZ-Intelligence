/**
 * REZ AB Testing - RABTUL Integration
 */

import axios from 'axios';
import { logger } from './logger.js';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'https://rez-analytics-service.onrender.com';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'https://rez-event-bus.onrender.com';
const INTERNAL_TOKEN = process.env['INTERNAL_SERVICE_TOKEN'] || '';

const AXIOS_TIMEOUT = 5000;

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
 * Track experiment conversion
 */
export async function trackConversion(experimentId: string, userId: string, variant: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(`${ANALYTICS_URL}/api/track`, {
      event: 'experiment_conversion',
      properties: { experimentId, userId, variant },
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    return { success: response.data?.success ?? true };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] trackConversion error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Reward for experiment participation
 */
export async function rewardParticipation(userId: string, amount: number): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(`${WALLET_URL}/api/wallet/add`, { userId, amount, reason: 'ab_test_participation' }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    return { success: response.data?.success ?? true };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] rewardParticipation error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Publish experiment event
 */
export async function publishExperimentEvent(eventType: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(`${EVENT_BUS_URL}/api/events/publish`, {
      type: `experiment.${eventType}`,
      source: 'REZ-ab-testing',
      data,
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    return { success: response.data?.success ?? true };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] publishExperimentEvent error:', err.message);
    return { success: false, error: err.message };
  }
}

export const abTestingRABTUL = {
  verifyToken,
  trackConversion,
  rewardParticipation,
  publishExperimentEvent,
};

export default abTestingRABTUL;
