/**
 * REZ Care Service - RABTUL Integration
 * Customer 360, Support, CSAT
 */

import axios from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const PROFILE_URL = process.env.PROFILE_SERVICE_URL || 'https://rez-profile-service.onrender.com';
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
 * Get customer 360 profile
 */
export async function getCustomer360(userId: string): Promise<{ profile; error?: string }> {
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
export async function updateCustomerProfile(userId: string, updates: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
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
 * Reward customer
 */
export async function rewardCustomer(userId: string, amount: number, reason: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${WALLET_URL}/api/wallet/add`, { userId, amount, reason }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send notification to customer
 */
export async function notifyCustomer(userId: string, title: string, body: string, data?: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${NOTIFICATION_URL}/api/notifications/push`, { userId, title, body, data }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send WhatsApp message
 */
export async function sendWhatsApp(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${NOTIFICATION_URL}/api/notifications/whatsapp`, { phone, message }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Publish support event to event bus
 */
export async function publishSupportEvent(eventType: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${EVENT_BUS_URL}/api/events/publish`, {
      type: `support.${eventType}`,
      source: 'REZ-care-service',
      data,
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Track CSAT
 */
export async function trackCSAT(ticketId: string, userId: string, score: number): Promise<{ success: boolean; error?: string }> {
  return publishSupportEvent('csat', { ticketId, userId, score });
}

/**
 * Create auto-ticket
 */
export async function createAutoTicket(params: {
  userId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
}): Promise<{ success: boolean; ticketId?: string; error?: string }> {
  try {
    const res = await axios.post(`${NOTIFICATION_URL}/api/tickets/create`, params, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true, ticketId: res.data.ticketId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export const careServiceRABTUL = {
  verifyToken,
  getCustomer360,
  updateCustomerProfile,
  rewardCustomer,
  notifyCustomer,
  sendWhatsApp,
  publishSupportEvent,
  trackCSAT,
  createAutoTicket,
};

export default careServiceRABTUL;
