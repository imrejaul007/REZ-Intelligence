/**
 * WHATSAPP BUSINESS API INTEGRATION
 *
 * Connects to WhatsApp Business API (Meta Graph API)
 * Supports Twilio or 360dialog as provider
 */

import fetch from 'node-fetch';
import { URL } from 'url';

const WHATSAPP_API_VERSION = 'v18.0';

// ============================================
// SSRF PROTECTION
// ============================================

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254',
  'metadata.google.internal',
]);

const BLOCKED_RANGES = [
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
];

function isUrlSafe(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    if (BLOCKED_HOSTS.has(hostname)) return false;

    for (const pattern of BLOCKED_RANGES) {
      if (pattern.test(hostname)) return false;
    }

    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

// ============================================
// CONFIG
// ============================================

interface WhatsAppConfig {
  provider: 'twilio' | '360dialog' | 'meta';
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  webhookVerifyToken: string;
  appSecret?: string;
}

const config: WhatsAppConfig = {
  provider: process.env.WHATSAPP_PROVIDER as any || 'meta',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  phoneNumberId: process.env.WHATSAPP_PHONE_ID || '',
  businessAccountId: process.env.WHATSAPP_BUSINESS_ID || '',
  webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_TOKEN || 'verify_token',
  appSecret: process.env.WHATSAPP_APP_SECRET,
};

// ============================================
// MESSAGE TYPES
// ============================================

export interface WhatsAppMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text' | 'image' | 'document' | 'sticker' | 'template' | 'interactive';
  recipient_type?: 'individual' | 'group';
}

export interface TextMessage extends WhatsAppMessage {
  type: 'text';
  text: {
    preview_url?: boolean;
    body: string;
  };
}

export interface TemplateMessage extends WhatsAppMessage {
  type: 'template';
  template: {
    name: string;
    language: {
      code: string;
    };
    components?: TemplateComponent[];
  };
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button' | 'footer';
  sub_type?: 'url' | 'quick_reply';
  index?: string;
  parameters: {
    type: 'text' | 'currency' | 'date_time' | 'image' | 'document';
    text?: string;
    currency?: { code: string; amount_1000: number };
    date_time?: { fallback_value: string };
    image?: { link: string };
    document?: { link: string; filename: string; caption?: string };
  }[];
}

// ============================================
// SEND MESSAGE
// ============================================

export async function sendWhatsAppMessage(message: WhatsAppMessage): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${config.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[WhatsApp] Error:', data);
      return { success: false, error: data.error?.message || 'Failed to send' };
    }

    return { success: true, messageId: data.messages?.[0]?.id };

  } catch (error: any) {
    console.error('[WhatsApp] Send error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// SEND TEXT
// ============================================

export async function sendText(to: string, body: string, previewUrl: boolean = false): Promise<{
  success: boolean;
  messageId?: string;
}> {
  const message: TextMessage = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { preview_url: previewUrl, body },
  };

  return sendWhatsAppMessage(message);
}

// ============================================
// SEND IMAGE
// ============================================

export async function sendImage(to: string, imageUrl: string, caption?: string): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  if (!isUrlSafe(imageUrl)) {
    console.error('[WhatsApp] SSRF blocked: Invalid or internal URL', imageUrl);
    return { success: false, error: 'Invalid image URL' };
  }

  const message: any = {
    messaging_product: 'whatsapp',
    to,
    type: 'image',
    image: { link: imageUrl, caption },
  };

  return sendWhatsAppMessage(message);
}

// ============================================
// SEND TEMPLATE
// ============================================

export async function sendTemplate(
  to: string,
  templateName: string,
  languageCode: string = 'en',
  components?: TemplateComponent[]
): Promise<{
  success: boolean;
  messageId?: string;
}> {
  const message: TemplateMessage = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  };

  return sendWhatsAppMessage(message);
}

// ============================================
// SEND INTERACTIVE BUTTONS
// ============================================

export interface InteractiveButton {
  type: 'reply';
  reply: {
    id: string;
    title: string;
  };
}

export async function sendInteractiveButtons(
  to: string,
  body: string,
  buttons: InteractiveButton[]
): Promise<{
  success: boolean;
  messageId?: string;
}> {
  try {
    const message: any = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body },
        action: { buttons },
      },
    };

    return sendWhatsAppMessage(message);
  } catch (error: any) {
    return { success: false };
  }
}

// ============================================
// SEND LIST
// ============================================

export async function sendList(
  to: string,
  header: string,
  body: string,
  footer: string,
  buttonText: string,
  sections: {
    title: string;
    rows: { id: string; title: string; description?: string }[];
  }[]
): Promise<{
  success: boolean;
  messageId?: string;
}> {
  try {
    const message: any = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: header },
        body: { text: body },
        footer: { text: footer },
        action: {
          button: buttonText,
          sections,
        },
      },
    };

    return sendWhatsAppMessage(message);
  } catch (error: any) {
    return { success: false };
  }
}

// ============================================
// WEBHOOK VERIFICATION
// ============================================

export function verifyWebhook(mode: string, token: string, challenge: string): {
  success: boolean;
  challenge?: string;
} {
  if (mode === 'subscribe' && token === config.webhookVerifyToken) {
    console.log('[WhatsApp] Webhook verified');
    return { success: true, challenge };
  }
  return { success: false };
}

// ============================================
// PARSE INCOMING MESSAGE
// ============================================

export interface IncomingMessage {
  messageId: string;
  from: string;
  to: string;
  timestamp: string;
  type: string;
  text?: string;
  image?: { mime_type: string; sha256: string; url: string };
  location?: { latitude: number; longitude: number; name?: string };
  context?: { from: string; id: string };
  button?: { payload: string; text: string };
  list_reply?: { id: string; title: string; description: string };
}

export function parseIncomingMessage(payload: any): IncomingMessage | null {
  try {
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value?.messages?.[0]) return null;

    const msg = value.messages[0];

    return {
      messageId: msg.id,
      from: msg.from,
      to: msg.to || config.phoneNumberId,
      timestamp: msg.timestamp,
      type: msg.type,
      text: msg.text?.body,
      image: msg.image,
      location: msg.location,
      context: msg.context,
      button: msg.button,
      list_reply: msg.list_reply,
    };
  } catch (error) {
    console.error('[WhatsApp] Parse error:', error);
    return null;
  }
}

// ============================================
// MARK AS READ
// ============================================

export async function markAsRead(messageId: string): Promise<boolean> {
  try {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${config.phoneNumberId}/messages`;

    await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    });

    return true;
  } catch (error) {
    return false;
  }
}

// ============================================
// GET MESSAGE STATUS
// ============================================

export async function getMessageStatus(messageId: string): Promise<{
  status: string;
  timestamp: string;
} | null> {
  try {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${config.phoneNumberId}/messages?ids=${messageId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
      },
    });

    const data = await response.json();
    const msg = data[messageId];

    if (msg) {
      return {
        status: msg.status,
        timestamp: msg.timestamp,
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}

// ============================================
// VALIDATE WEBHOOK SIGNATURE
// ============================================

export function validateSignature(
  payload: string,
  signature: string
): boolean {
  if (!config.appSecret) return true;

  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', config.appSecret)
    .update(payload)
    .digest('hex');

  return signature === `sha256=${expectedSignature}`;
}

// ============================================
// GET BUSINESS INFO
// ============================================

export async function getBusinessInfo(): Promise<any> {
  try {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${config.businessAccountId}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
      },
    });

    return await response.json();
  } catch (error) {
    return null;
  }
}

// ============================================
// GET PHONE NUMBERS
// ============================================

export async function getPhoneNumbers(): Promise<any[]> {
  try {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${config.businessAccountId}/phone_numbers`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
      },
    });

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    return [];
  }
}

// ============================================
// TEMPLATE MANAGEMENT
// ============================================

export async function getTemplates(): Promise<any[]> {
  try {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${config.businessAccountId}/message_templates`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
      },
    });

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    return [];
  }
}

export async function createTemplate(template: {
  name: string;
  category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  language: string;
  components: any[];
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${config.businessAccountId}/message_templates`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(template),
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    return { success: true, id: data.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
