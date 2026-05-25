/**
 * SMS Bridge - RABTUL Integration
 */

import axios from 'axios';

const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'https://rez-notifications-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

/**
 * Send SMS via RABTUL
 */
export async function sendSMS(params: {
  phone: string;
  message: string;
  senderId?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await axios.post(`${NOTIFICATION_URL}/api/notifications/sms`, {
      phone: params.phone,
      message: params.message,
      senderId: params.senderId,
      type: 'sms',
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true, messageId: res.data.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send OTP via SMS
 */
export async function sendOTP(phone: string, otp: string): Promise<{ success: boolean; error?: string }> {
  return sendSMS({
    phone,
    message: `Your REZ verification code is: ${otp}. Valid for 5 minutes.`,
  });
}

/**
 * Send bulk SMS
 */
export async function sendBulkSMS(messages: Array<{
  phone: string;
  message: string;
}>): Promise<{ success: boolean; sent: number; failed: number; error?: string }> {
  try {
    const res = await axios.post(`${NOTIFICATION_URL}/api/notifications/sms/bulk`, {
      messages,
      type: 'sms',
    }, {
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { success: true, sent: res.data.sent, failed: res.data.failed };
  } catch (error) {
    return { success: false, sent: 0, failed: messages.length, error: error.message };
  }
}

/**
 * Get SMS status
 */
export async function getSMSStatus(messageId: string): Promise<{ status: string; error?: string }> {
  try {
    const res = await axios.get(`${NOTIFICATION_URL}/api/notifications/sms/${messageId}/status`, {
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    });
    return { status: res.data.status };
  } catch (error) {
    return { status: 'unknown', error: error.message };
  }
}

export const smsBridgeRABTUL = {
  sendSMS,
  sendOTP,
  sendBulkSMS,
  getSMSStatus,
};

export default smsBridgeRABTUL;
