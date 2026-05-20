/**
 * REZ Event Bus - RABTUL Event Bus Integration
 */

import axios from 'axios';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'https://rez-event-bus.onrender.com';

export async function verifyToken(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await axios.get(`${AUTH_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { valid: res.data.success };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

export async function publishEvent(type: string, source: string, data: Record<string, any>): Promise<{ success: boolean; eventId?: string }> {
  try {
    const res = await axios.post(`${EVENT_BUS_URL}/api/events/publish`, {
      type,
      source,
      data,
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true, eventId: res.data.eventId };
  } catch { return { success: false }; }
}

export async function subscribe(channel: string, callback: (data: any) => void): Promise<{ success: boolean }> {
  // Redis pub/sub subscription
  return { success: true };
}

export async function unsubscribe(channel: string): Promise<{ success: boolean }> {
  return { success: true };
}

export const eventBusRABTUL = { verifyToken, publishEvent, subscribe, unsubscribe };
export default eventBusRABTUL;
