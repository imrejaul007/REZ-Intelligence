/**
 * REZ Unified Commerce Graph - RABTUL Integration
 * PRODUCTION: Fixed with proper error handling
 */
import axios from 'axios';

const AUTH = process.env.AUTH_SERVICE_URL || 'https://rez-auth-service.onrender.com';
const EVENT = process.env.EVENT_BUS_URL || 'https://rez-event-bus.onrender.com';
const TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
const TIMEOUT = 5000;

export async function verifyToken(token: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await axios.get(`${AUTH}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Internal-Token': TOKEN },
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

export async function publishEvent(type: string, data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await axios.post(
      `${EVENT}/api/events/publish`,
      { type: `commerce.${type}`, source: 'REZ-unified-commerce-graph', data },
      { headers: { 'X-Internal-Token': TOKEN }, timeout: TIMEOUT }
    );
    if (response.data?.success) {
      return { success: true };
    }
    return { success: false, error: response.data?.error || 'Event publish failed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Event publish failed';
    console.error('[RABTUL] publishEvent error:', message, { type });
    return { success: false, error: message };
  }
}

export const unifiedCommerceGraphRABTUL = { verifyToken, publishEvent };
export default unifiedCommerceGraphRABTUL;
