/**
 * REZ Targeting Engine - RABTUL Integration
 */

import axios from 'axios';
import { logger } from './utils/logger.js';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'https://rez-event-bus.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

const AXIOS_TIMEOUT = 5000;

/**
 * Verify token
 */
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

/**
 * Publish targeting event
 */
export async function publishTargetingEvent(eventType: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(`${EVENT_BUS_URL}/api/events/publish`, {
      type: `targeting.${eventType}`,
      source: 'REZ-targeting-engine',
      data,
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      timeout: AXIOS_TIMEOUT,
    });
    return { success: response.data?.success ?? true };
  } catch (error) {
    const err = error as Error;
    logger.error('[RABTUL] publishTargetingEvent error:', err.message);
    return { success: false, error: err.message };
  }
}

export const targetingEngineRABTUL = {
  verifyToken,
  publishTargetingEvent,
};

export default targetingEngineRABTUL;
