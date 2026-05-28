/**
 * REZ Service - RABTUL Integration
 * PRODUCTION: Fixed with proper error handling
 */

import axios from 'axios';

const AUTH_URL = process.env['AUTH_SERVICE_URL'] || 'https://rez-auth-service.onrender.com';
const WALLET_URL = process.env['WALLET_SERVICE_URL'] || 'https://rez-wallet-service.onrender.com';
const NOTIFICATION_URL = process.env['NOTIFICATION_SERVICE_URL'] || 'https://rez-notifications-service.onrender.com';
const EVENT_BUS_URL = process.env['EVENT_BUS_URL'] || 'https://rez-event-bus.onrender.com';
const INTERNAL_TOKEN = process.env['INTERNAL_SERVICE_TOKEN'] || '';
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

export async function addCoins(userId: string, amount: number, reason: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(
      `${WALLET_URL}/api/wallet/add`,
      { userId, amount, reason },
      { headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN }, timeout: TIMEOUT }
    );
    if (response.data?.success) {
      return { success: true };
    }
    return { success: false, error: response.data?.error || 'Failed to add coins' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add coins';
    console.error('[RABTUL] addCoins error:', message, { userId, amount });
    return { success: false, error: message };
  }
}

export async function notifyUser(userId: string, title: string, body: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(
      `${NOTIFICATION_URL}/api/notifications/push`,
      { userId, title, body },
      { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: TIMEOUT }
    );
    if (response.data?.success) {
      return { success: true };
    }
    return { success: false, error: response.data?.error || 'Failed to send notification' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send notification';
    console.error('[RABTUL] notifyUser error:', message, { userId });
    return { success: false, error: message };
  }
}

export async function publishEvent(type: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(
      `${EVENT_BUS_URL}/api/events/publish`,
      { type, source: 'service-name', data },
      { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: TIMEOUT }
    );
    if (response.data?.success) {
      return { success: true };
    }
    return { success: false, error: response.data?.error || 'Failed to publish event' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to publish event';
    console.error('[RABTUL] publishEvent error:', message, { type });
    return { success: false, error: message };
  }
}
