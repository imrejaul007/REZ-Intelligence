import axios from 'axios';
import { ChannelPayload, ChannelResultPayload, NotificationChannel } from '../types/index.js';
import { logWarn, logError } from './logger.js';

// ============================================================================
// Push Notifications (FCM)
// ============================================================================

export async function sendPush(payload: ChannelPayload): Promise<ChannelResultPayload> {
  const fcmUrl = process.env.FCM_URL;

  if (!fcmUrl) {
    logWarn('FCM not configured, simulating push');
    return { status: 'sent', externalId: 'fcm_sim_' + Date.now() };
  }

  try {
    const response = await axios.post(
      fcmUrl,
      {
        to: payload.data?.fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
      },
      {
        timeout: 10000,
        headers: {
          'Authorization': `key=${process.env.FCM_SERVER_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const messageId = response.data?.success?.[0]?.message_id;
    return { status: 'sent', externalId: messageId || 'fcm_' + Date.now() };
  } catch (error) {
    logError('FCM push failed', { error: (error as Error).message });
    return { status: 'failed', error: (error as Error).message };
  }
}

// ============================================================================
// SMS (Twilio)
// ============================================================================

export async function sendSMS(payload: ChannelPayload): Promise<ChannelResultPayload> {
  const twilioUrl = process.env.TWILIO_URL;
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!twilioUrl || !twilioAccountSid || !twilioAuthToken) {
    logWarn('Twilio not configured, simulating SMS');
    return { status: 'sent', externalId: 'sms_sim_' + Date.now() };
  }

  try {
    const response = await axios.post(
      `${twilioUrl}/Accounts/${twilioAccountSid}/Messages.json`,
      {
        From: twilioPhoneNumber,
        To: payload.data?.phoneNumber,
        Body: payload.body,
      },
      {
        timeout: 10000,
        auth: {
          username: twilioAccountSid,
          password: twilioAuthToken,
        },
      }
    );

    const messageSid = response.data?.sid;
    return { status: 'sent', externalId: messageSid || 'twilio_' + Date.now() };
  } catch (error) {
    logError('Twilio SMS failed', { error: (error as Error).message });
    return { status: 'failed', error: (error as Error).message };
  }
}

// ============================================================================
// Email (SendGrid)
// ============================================================================

export async function sendEmail(payload: ChannelPayload): Promise<ChannelResultPayload> {
  const sendgridUrl = process.env.SENDGRID_URL;
  const sendgridApiKey = process.env.SENDGRID_API_KEY;

  if (!sendgridUrl || !sendgridApiKey) {
    logWarn('SendGrid not configured, simulating email');
    return { status: 'sent', externalId: 'email_sim_' + Date.now() };
  }

  try {
    const response = await axios.post(
      sendgridUrl,
      {
        personalizations: [
          {
            to: [{ email: payload.data?.email }],
            subject: payload.title,
          },
        ],
        from: { email: process.env.SENDGRID_FROM_EMAIL || 'noreply@rezapp.com' },
        content: [
          {
            type: 'text/plain',
            value: payload.body,
          },
        ],
      },
      {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const messageId = response.data?.headers?.['x-message-id'];
    return { status: 'sent', externalId: messageId || 'sendgrid_' + Date.now() };
  } catch (error) {
    logError('SendGrid email failed', { error: (error as Error).message });
    return { status: 'failed', error: (error as Error).message };
  }
}

// ============================================================================
// In-App Notifications
// ============================================================================

export function sendInApp(_payload: ChannelPayload): ChannelResultPayload {
  // In-app notifications are always delivered instantly
  return { status: 'delivered', externalId: 'in_app_' + Date.now() };
}

// ============================================================================
// Channel Router
// ============================================================================

export async function sendToChannel(
  channel: NotificationChannel,
  payload: ChannelPayload
): Promise<ChannelResultPayload> {
  switch (channel) {
    case 'push':
      return sendPush(payload);
    case 'sms':
      return sendSMS(payload);
    case 'email':
      return sendEmail(payload);
    case 'in_app':
      return sendInApp(payload);
    default:
      return { status: 'failed', error: 'Unknown channel' };
  }
}
