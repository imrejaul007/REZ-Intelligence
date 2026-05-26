/**
 * RCS Bridge - RABTUL Integration
 */

import axios from 'axios';

const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * Send RCS message via RABTUL
 */
export async function sendRCS(params: {
  phone: string;
  message: string;
  mediaUrl?: string;
  buttons?: Array<{ title: string; action: string }>;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await axios.post(`${NOTIFICATION_URL}/api/notifications/rcs`, {
      phone: params.phone,
      message: params.message,
      mediaUrl: params.mediaUrl,
      buttons: params.buttons,
      type: 'rcs',
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true, messageId: res.data.messageId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send rich RCS with cards
 */
export async function sendRCSWithCards(params: {
  phone: string;
  cards: Array<{
    title: string;
    description?: string;
    mediaUrl?: string;
    buttons?: Array<{ title: string; action: string }>;
  }>;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await axios.post(`${NOTIFICATION_URL}/api/notifications/rcs/rich`, {
      phone: params.phone,
      cards: params.cards,
      type: 'rcs',
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true, messageId: res.data.messageId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get RCS status
 */
export async function getRCSStatus(messageId: string): Promise<{ status: string; error?: string }> {
  try {
    const res = await axios.get(`${NOTIFICATION_URL}/api/notifications/rcs/${messageId}/status`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { status: res.data.status };
  } catch (error) {
    return { status: 'unknown', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export const rcsBridgeRABTUL = {
  sendRCS,
  sendRCSWithCards,
  getRCSStatus,
};

export default rcsBridgeRABTUL;
