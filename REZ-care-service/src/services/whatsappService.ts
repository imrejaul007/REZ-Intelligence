/**
 * REZ Care - WhatsApp Business Service
 *
 * Handles WhatsApp Business API integration for customer support.
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'location' | 'contacts' | 'sticker' | 'reaction' | 'interactive';
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; url?: string };
  interactive?;
}

export interface WhatsAppWebhook {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: WhatsAppMessage[];
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
          conversation?;
          pricing?;
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface WhatsAppConfig {
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  webhookVerifyToken: string;
  apiVersion: string;
}

class WhatsAppService {
  private http: AxiosInstance;
  private config: WhatsAppConfig;
  private rateLimitQueue: Map<string, number> = new Map();
  private readonly RATE_LIMIT = 250; // messages per minute

  constructor() {
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';

    this.config = {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
      accessToken: process.env.WHATSAPP_API_TOKEN || '',
      webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
      apiVersion,
    };

    this.http = axios.create({
      baseURL: `https://graph.facebook.com/${apiVersion}`,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string): boolean {
    if (!signature || !payload) return false;

    const expected = 'sha256=' + crypto
      .createHmac('sha256', process.env.WHATSAPP_APP_SECRET || '')
      .update(payload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      );
    } catch {
      return false;
    }
  }

  /**
   * Verify webhook URL (for Facebook verification)
   */
  verifyWebhook(mode: string, token: string, challenge: string): boolean {
    return mode === 'subscribe' && token === this.config.webhookVerifyToken;
  }

  /**
   * Send a text message
   */
  async sendText(to: string, body: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (this.isRateLimited(to)) {
      return { success: false, error: 'Rate limited. Try again later.' };
    }

    try {
      const response = await this.http.post(`/${this.config.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body },
      });

      this.markRateLimit(to);
      logger.info('[WhatsApp] Message sent', { to, messageId: response.data.messages?.[0]?.id });

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
      };
    } catch (error) {
      logger.error('[WhatsApp] Send failed', { to, error: error.message });
      return { success: false, error: error.response?.data?.error?.message || error.message };
    }
  }

  /**
   * Send a template message
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string = 'en',
    components?: Array<{ type: string; parameters: Array<{ type: string; text?: string; currency?; date_time?: unknown }> }>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (this.isRateLimited(to)) {
      return { success: false, error: 'Rate limited. Try again later.' };
    }

    try {
      const payload: unknown = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
        },
      };

      if (components) {
        payload.template.components = components;
      }

      const response = await this.http.post(`/${this.config.phoneNumberId}/messages`, payload);

      this.markRateLimit(to);
      logger.info('[WhatsApp] Template sent', { to, templateName, messageId: response.data.messages?.[0]?.id });

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
      };
    } catch (error) {
      logger.error('[WhatsApp] Template send failed', { to, templateName, error: error.message });
      return { success: false, error: error.response?.data?.error?.message || error.message };
    }
  }

  /**
   * Send interactive buttons message
   */
  async sendButtons(
    to: string,
    body: string,
    buttons: Array<{ type: string; title: string; id?: string }>,
    header?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await this.http.post(`/${this.config.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          action: {
            buttons: buttons.map(btn => ({
              type: btn.type,
              title: btn.title,
              ...(btn.id && { id: btn.id }),
            })),
          },
          ...(header && { header: { type: 'text', text: header } }),
        },
      });

      logger.info('[WhatsApp] Buttons sent', { to, messageId: response.data.messages?.[0]?.id });

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
      };
    } catch (error) {
      logger.error('[WhatsApp] Buttons send failed', { to, error: error.message });
      return { success: false, error: error.response?.data?.error?.message || error.message };
    }
  }

  /**
   * Send list message
   */
  async sendList(
    to: string,
    header: string,
    body: string,
    footer: string,
    buttonTitle: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await this.http.post(`/${this.config.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: { type: 'text', text: header },
          body: { text: body },
          footer: { text: footer },
          action: {
            button: buttonTitle,
            sections,
          },
        },
      });

      logger.info('[WhatsApp] List sent', { to, messageId: response.data.messages?.[0]?.id });

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
      };
    } catch (error) {
      logger.error('[WhatsApp] List send failed', { to, error: error.message });
      return { success: false, error: error.response?.data?.error?.message || error.message };
    }
  }

  /**
   * Mark message as read
   */
  async markRead(messageId: string): Promise<boolean> {
    try {
      await this.http.post(`/${this.config.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });
      return true;
    } catch (error) {
      logger.warn('[WhatsApp] Mark read failed', { messageId, error: error.message });
      return false;
    }
  }

  /**
   * Parse incoming webhook
   */
  parseWebhook(payload: WhatsAppWebhook): {
    messages: Array<{ from: string; id: string; text: string; timestamp: string; type: string; name?: string }>;
    statuses: Array<{ id: string; status: string; timestamp: string; recipientId: string }>;
  } {
    const messages: Array<{ from: string; id: string; text: string; timestamp: string; type: string; name?: string }> = [];
    const statuses: Array<{ id: string; status: string; timestamp: string; recipientId: string }> = [];

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const value = change.value;

        // Parse messages
        if (value.messages) {
          for (const msg of value.messages) {
            const contact = value.contacts?.[0];
            messages.push({
              from: msg.from,
              id: msg.id,
              text: msg.text?.body || '',
              timestamp: msg.timestamp,
              type: msg.type,
              name: contact?.profile?.name,
            });
          }
        }

        // Parse status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            statuses.push({
              id: status.id,
              status: status.status,
              timestamp: status.timestamp,
              recipientId: status.recipient_id,
            });
          }
        }
      }
    }

    return { messages, statuses };
  }

  /**
   * Get message templates
   */
  async getTemplates(): Promise<Array<{ id: string; name: string; status: string; category: string }>> {
    try {
      const response = await this.http.get(`/${this.config.businessAccountId}/message_templates`);
      return response.data.data || [];
    } catch (error) {
      logger.error('[WhatsApp] Get templates failed', { error: error.message });
      return [];
    }
  }

  /**
   * Check if number is rate limited
   */
  private isRateLimited(phoneNumber: string): boolean {
    const lastSent = this.rateLimitQueue.get(phoneNumber);
    if (!lastSent) return false;

    const now = Date.now();
    return now - lastSent < (60000 / this.RATE_LIMIT);
  }

  /**
   * Mark rate limit for phone number
   */
  private markRateLimit(phoneNumber: string): void {
    this.rateLimitQueue.set(phoneNumber, Date.now());

    // Clean up old entries
    setTimeout(() => {
      const lastSent = this.rateLimitQueue.get(phoneNumber);
      if (lastSent && Date.now() - lastSent > 60000) {
        this.rateLimitQueue.delete(phoneNumber);
      }
    }, 60000);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.http.get(`/${this.config.phoneNumberId}`);
      return response.data?.verified === true;
    } catch {
      return false;
    }
  }
}

export const whatsappService = new WhatsAppService();
