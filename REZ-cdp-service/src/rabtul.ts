/**
 * REZ CDP Service - RABTUL Integration
 * Customer Data Platform
 */

import axios from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const PROFILE_URL = process.env.PROFILE_SERVICE_URL || 'https://rez-profile-service.onrender.com';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'https://rez-event-bus.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * Verify token
 */
export async function verifyToken(token: string): Promise<{ valid: boolean; user?; error?: string }> {
  try {
    const res = await axios.get(`${AUTH_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Internal-Token': INTERNAL_TOKEN },
    });
    if (res.data.success && res.data.user) {
      return { valid: true, user: res.data.user };
    }
    return { valid: false, error: 'Invalid token' };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Get customer profile
 */
export async function getProfile(userId: string): Promise<{ profile; error?: string }> {
  try {
    const res = await axios.get(`${PROFILE_URL}/api/profiles/${userId}`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { profile: res.data };
  } catch (error) {
    return { profile: null, error: error.message };
  }
}

/**
 * Update customer profile
 */
export async function updateProfile(userId: string, updates: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.patch(`${PROFILE_URL}/api/profiles/${userId}`, updates, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get customer wallet
 */
export async function getWallet(userId: string): Promise<{ wallet; error?: string }> {
  try {
    const res = await axios.get(`${WALLET_URL}/api/wallet/${userId}/balance`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { wallet: res.data };
  } catch (error) {
    return { wallet: null, error: error.message };
  }
}

/**
 * Notify customer
 */
export async function notifyCustomer(userId: string, title: string, body: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${NOTIFICATION_URL}/api/notifications/push`, { userId, title, body }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Publish CDP event
 */
export async function publishEvent(eventType: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${EVENT_BUS_URL}/api/events/publish`, {
      type: `cdp.${eventType}`,
      source: 'REZ-cdp-service',
      data,
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export const cdpServiceRABTUL = {
  verifyToken,
  getProfile,
  updateProfile,
  getWallet,
  notifyCustomer,
  publishEvent,
};

export default cdpServiceRABTUL;
