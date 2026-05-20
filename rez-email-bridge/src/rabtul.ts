/**
 * Email Bridge - RABTUL Integration
 */

import axios from 'axios';

const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * Send email via RABTUL
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
  html?: string;
  from?: string;
  replyTo?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await axios.post(`${NOTIFICATION_URL}/api/notifications/email`, {
      to: params.to,
      subject: params.subject,
      body: params.body,
      html: params.html,
      from: params.from,
      replyTo: params.replyTo,
      type: 'email',
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true, messageId: res.data.messageId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Send bulk email
 */
export async function sendBulkEmail(emails: Array<{
  to: string;
  subject: string;
  body: string;
  html?: string;
}>): Promise<{ success: boolean; sent: number; failed: number; error?: string }> {
  try {
    const res = await axios.post(`${NOTIFICATION_URL}/api/notifications/email/bulk`, {
      emails,
      type: 'email',
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true, sent: res.data.sent, failed: res.data.failed };
  } catch (error: any) {
    return { success: false, sent: 0, failed: emails.length, error: error.message };
  }
}

/**
 * Send transactional email
 */
export async function sendTransactionalEmail(params: {
  to: string;
  template: string;
  data: Record<string, any>;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await axios.post(`${NOTIFICATION_URL}/api/notifications/email/transactional`, {
      to: params.to,
      template: params.template,
      data: params.data,
      type: 'email',
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true, messageId: res.data.messageId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get email status
 */
export async function getEmailStatus(messageId: string): Promise<{ status: string; error?: string }> {
  try {
    const res = await axios.get(`${NOTIFICATION_URL}/api/notifications/email/${messageId}/status`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { status: res.data.status };
  } catch (error: any) {
    return { status: 'unknown', error: error.message };
  }
}

export const emailBridgeRABTUL = {
  sendEmail,
  sendBulkEmail,
  sendTransactionalEmail,
  getEmailStatus,
};

export default emailBridgeRABTUL;
