/**
 * REZ DOOH Intelligence - RABTUL Integration
 * PRODUCTION: Fixed with proper error handling
 */

import axios from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'https://rez-event-bus.onrender.com';
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

export async function notifyScreenOwner(ownerId: string, title: string, body: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(
      `${NOTIFICATION_URL}/api/notifications/push`,
      { userId: ownerId, title, body },
      { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: TIMEOUT }
    );
    if (response.data?.success) {
      return { success: true };
    }
    return { success: false, error: response.data?.error || 'Failed to notify screen owner' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to notify screen owner';
    console.error('[RABTUL] notifyScreenOwner error:', message, { ownerId });
    return { success: false, error: message };
  }
}

export async function addScreenOwnerEarnings(ownerId: string, amount: number): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(
      `${WALLET_URL}/api/wallet/add`,
      { userId: ownerId, amount, reason: 'dooh_earnings' },
      { headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN }, timeout: TIMEOUT }
    );
    if (response.data?.success) {
      return { success: true };
    }
    return { success: false, error: response.data?.error || 'Failed to add earnings' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add earnings';
    console.error('[RABTUL] addScreenOwnerEarnings error:', message, { ownerId, amount });
    return { success: false, error: message };
  }
}

export async function publishDOOHEvent(type: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(
      `${EVENT_BUS_URL}/api/events/publish`,
      { type: `dooh.${type}`, source: 'rez-dooh-intelligence', data },
      { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: TIMEOUT }
    );
    if (response.data?.success) {
      return { success: true };
    }
    return { success: false, error: response.data?.error || 'Failed to publish DOOH event' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to publish DOOH event';
    console.error('[RABTUL] publishDOOHEvent error:', message, { type });
    return { success: false, error: message };
  }
}

export const doohIntelligenceRABTUL = { verifyToken, notifyScreenOwner, addScreenOwnerEarnings, publishDOOHEvent };
export default doohIntelligenceRABTUL;
