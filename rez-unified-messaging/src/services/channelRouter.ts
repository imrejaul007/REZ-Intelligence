/**
 * CHANNEL ROUTER
 *
 * Routes messages to appropriate channel based on:
 * - Lead temperature (hot/warm/cold)
 * - Urgency
 * - User preferences
 * - Channel availability
 */

import { sendText, sendImage, sendTemplate } from './whatsappService';
import { sendSMS } from './smsService';
import { sendEmail } from './emailService';
import { sendToDevice, sendToTopic, PushNotification } from './pushService';
import { detectIntent, generateAIResponse } from './rezMindService';

// ============================================
// TYPES
// ============================================

export type Channel = 'whatsapp' | 'sms' | 'email' | 'push' | 'in_app';
export type LeadTemperature = 'hot' | 'warm' | 'cold';

export interface ChannelContext {
  userId: string;
  phone?: string;
  email?: string;
  deviceToken?: string;
  temperature: LeadTemperature;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  intent?: string;
  preferences?: {
    preferredChannel?: Channel;
    notificationEnabled: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
    whatsappEnabled: boolean;
  };
}

export interface MessagePayload {
  type: 'marketing' | 'transactional' | 'support' | 'reminder' | 'offer';
  title?: string;
  body: string;
  imageUrl?: string;
  actionUrl?: string;
  actionText?: string;
  template?: string;
  templateData?: Record<string, any>;
}

export interface ChannelResult {
  channel: Channel;
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================
// ROUTE MESSAGE
// ============================================

export async function routeMessage(
  context: ChannelContext,
  payload: MessagePayload
): Promise<ChannelResult[]> {
  const results: ChannelResult[] = [];

  // Determine channels based on temperature and urgency
  const channels = getChannelsForTemperature(context);

  for (const channel of channels) {
    try {
      const result = await sendViaChannel(channel, context, payload);
      results.push({ channel, ...result });

      // If high priority succeeded, don't send to other channels
      if (result.success && context.urgency === 'critical') {
        break;
      }
    } catch (error: any) {
      results.push({
        channel,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

// ============================================
// GET CHANNELS FOR TEMPERATURE
// ============================================

function getChannelsForTemperature(context: ChannelContext): Channel[] {
  const { temperature, urgency, preferences } = context;

  // Check user preferences first
  if (preferences?.preferredChannel) {
    return [preferences.preferredChannel];
  }

  // Hot leads → immediate channels
  if (temperature === 'hot') {
    if (urgency === 'critical' || urgency === 'high') {
      return ['whatsapp'];
    }
    return ['whatsapp', 'push'];
  }

  // Warm leads → notification channels
  if (temperature === 'warm') {
    return ['push', 'whatsapp'];
  }

  // Cold leads → broad reach
  return ['email', 'push', 'sms'];
}

// ============================================
// SEND VIA CHANNEL
// ============================================

async function sendViaChannel(
  channel: Channel,
  context: ChannelContext,
  payload: MessagePayload
): Promise<{ success: boolean; messageId?: string }> {
  switch (channel) {
    case 'whatsapp':
      return sendViaWhatsApp(context, payload);
    case 'sms':
      return sendViaSMS(context, payload);
    case 'email':
      return sendViaEmail(context, payload);
    case 'push':
      return sendViaPush(context, payload);
    default:
      return { success: false };
  }
}

// ============================================
// WHATSAPP
// ============================================

async function sendViaWhatsApp(
  context: ChannelContext,
  payload: MessagePayload
): Promise<{ success: boolean; messageId?: string }> {
  if (!context.phone || context.preferences?.whatsappEnabled === false) {
    return { success: false };
  }

  // Use template for marketing, text for transactional
  if (payload.type === 'marketing' && payload.template) {
    return sendTemplate(context.phone, payload.template, 'en');
  }

  if (payload.imageUrl) {
    return sendImage(context.phone, payload.imageUrl, payload.body);
  }

  return sendText(context.phone, payload.body, !!payload.actionUrl);
}

// ============================================
// SMS
// ============================================

async function sendViaSMS(
  context: ChannelContext,
  payload: MessagePayload
): Promise<{ success: boolean; messageId?: string }> {
  if (!context.phone || context.preferences?.smsEnabled === false) {
    return { success: false };
  }

  // SMS has 160 char limit
  const body = payload.body.substring(0, 160);
  return sendSMS(context.phone, body);
}

// ============================================
// EMAIL
// ============================================

async function sendViaEmail(
  context: ChannelContext,
  payload: MessagePayload
): Promise<{ success: boolean; messageId?: string }> {
  if (!context.email || context.preferences?.emailEnabled === false) {
    return { success: false };
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      ${payload.imageUrl ? `<img src="${payload.imageUrl}" style="max-width: 100%;" />` : ''}
      <h2>${payload.title || 'ReZ'}</h2>
      <p>${payload.body}</p>
      ${payload.actionUrl ? `<a href="${payload.actionUrl}" style="display:inline-block;padding:10px 20px;background:#007bff;color:#fff;text-decoration:none;border-radius:5px;">${payload.actionText || 'Learn More'}</a>` : ''}
    </div>
  `;

  const { sendEmail } = await import('./emailService');
  const result = await sendEmail({
    to: context.email,
    subject: payload.title || 'Message from ReZ',
    html,
  });

  return { success: result.success, messageId: result.messageId };
}

// ============================================
// PUSH
// ============================================

async function sendViaPush(
  context: ChannelContext,
  payload: MessagePayload
): Promise<{ success: boolean; messageId?: string }> {
  if (!context.deviceToken || context.preferences?.notificationEnabled === false) {
    return { success: false };
  }

  const notification: PushNotification = {
    title: payload.title || 'ReZ',
    body: payload.body,
    image: payload.imageUrl,
    clickAction: payload.actionUrl,
  };

  return sendToDevice(context.deviceToken, notification);
}

// ============================================
// AI-POWERED MESSAGE GENERATION
// ============================================

export async function generateAndSend(
  context: ChannelContext,
  intent: string,
  userMessage?: string
): Promise<ChannelResult[]> {
  // Detect exact intent
  const detectedIntent = await detectIntent(userMessage || intent, {
    userId: context.userId,
    channel: 'whatsapp',
  });

  // Generate AI response
  const response = await generateAIResponse({
    user: { userId: context.userId, phone: context.phone || '', segments: [] },
    merchant: undefined,
    conversation: { turnCount: 1 },
    signals: { timeOfDay: new Date().toLocaleTimeString('en-US', { hour: 'numeric' }), dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }) }
  }, detectedIntent);

  // Create payload
  const payload: MessagePayload = {
    type: 'support',
    body: response.reply,
  };

  // Send via appropriate channel
  return routeMessage(context, payload);
}

// ============================================
// CAMPAIGN BROADCAST
// ============================================

export async function broadcastToSegment(
  segment: 'hot' | 'warm' | 'cold' | 'all',
  payload: MessagePayload,
  userIds: string[]
): Promise<{
  total: number;
  byChannel: Record<Channel, { sent: number; failed: number }>;
}> {
  const results: Record<Channel, { sent: number; failed: number }> = {
    whatsapp: { sent: 0, failed: 0 },
    sms: { sent: 0, failed: 0 },
    email: { sent: 0, failed: 0 },
    push: { sent: 0, failed: 0 },
    in_app: { sent: 0, failed: 0 },
  };

  // Get channel based on segment
  const channels: Channel[] = segment === 'hot' ? ['whatsapp'] :
                               segment === 'cold' ? ['email', 'sms'] :
                               ['push', 'whatsapp'];

  for (const userId of userIds) {
    // Get user context (from database)
    const userContext: ChannelContext = {
      userId,
      temperature: segment === 'all' ? 'warm' : segment,
      urgency: 'medium',
    };

    const channelResults = await routeMessage(userContext, payload);

    for (const result of channelResults) {
      if (result.success) {
        results[result.channel].sent++;
      } else {
        results[result.channel].failed++;
      }
    }
  }

  return {
    total: userIds.length,
    byChannel: results,
  };
}

// ============================================
// RE-ENGAGEMENT FLOW
// ============================================

export async function sendReEngagement(
  context: ChannelContext,
  reason: 'abandoned_cart' | 'abandoned_search' | 'inactive' | 'price_drop',
  customMessage?: string
): Promise<ChannelResult[]> {
  const messages: Record<string, { title: string; body: string }> = {
    abandoned_cart: {
      title: 'Your cart is waiting! 🛒',
      body: customMessage || 'Complete your order before it expires.',
    },
    abandoned_search: {
      title: 'Still looking?',
      body: customMessage || 'We found some great options for you!',
    },
    inactive: {
      title: 'We miss you!',
      body: customMessage || 'It\'s been a while. Check out what\'s new!',
    },
    price_drop: {
      title: 'Price dropped! ⬇️',
      body: customMessage || 'An item in your wishlist is now cheaper.',
    },
  };

  const msg = messages[reason];

  const payload: MessagePayload = {
    type: 'reminder',
    title: msg.title,
    body: msg.body,
  };

  return routeMessage(context, payload);
}
