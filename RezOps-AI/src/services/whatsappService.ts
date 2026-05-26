import axios from 'axios';
import { merchantService } from './merchantService.js';
import { aiAssistantService } from './aiAssistantService.js';
import { logger } from './utils/logger.js';

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

interface WhatsAppWebhookPayload {
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
      };
      field: string;
    }>;
  }>;
}

export class WhatsAppService {
  private readonly WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
  private readonly ACCESS_TOKEN: string;
  private readonly PHONE_NUMBER_ID: string;

  constructor() {
    this.ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  }

  async processWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
    try {
      const entry = payload.entry;
      
      for (const change of entry[0]?.changes || []) {
        const messages = change.value?.messages;
        if (messages) {
          for (const msg of messages) {
            const contact = change.value?.contacts?.[0];
            await this.processIncomingMessage(msg, contact, change.value?.metadata?.phone_number_id);
          }
        }
      }
    } catch (error) {
      logger.error('Error processing WhatsApp webhook', { error });
      throw error;
    }
  }

  private async processIncomingMessage(
    message: WhatsAppMessage,
    contact: { profile: { name: string }; wa_id: string } | undefined,
    phoneNumberId: string | undefined
  ): Promise<void> {
    const customerPhone = message.from;
    const customerName = contact?.profile?.name;
    const content = message.text?.body || '';
    
    const merchant = await this.findMerchantByPhoneId(phoneNumberId || '');
    if (!merchant) {
      logger.warn('Merchant not found for phone number ID', { phoneNumberId });
      return;
    }

    const customer = await merchantService.registerCustomer(merchant.merchantId, customerPhone, customerName);
    const conversation = await merchantService.getOrCreateConversation(merchant.merchantId, customerPhone);

    await aiAssistantService.logMessage({
      conversationId: conversation.conversationId,
      merchantId: merchant.merchantId,
      customerId: customer.customerId,
      direction: 'inbound',
      type: 'text',
      content,
      sender: 'customer',
      status: 'read',
    });

    const aiResponse = await aiAssistantService.processMessage(merchant.merchantId, customerPhone, content);

    if (aiResponse.action === 'send_message' || aiResponse.action === 'escalate') {
      await this.sendMessage(customerPhone, aiResponse.message);
      
      await aiAssistantService.logMessage({
        conversationId: conversation.conversationId,
        merchantId: merchant.merchantId,
        customerId: customer.customerId,
        direction: 'outbound',
        type: 'text',
        content: aiResponse.message,
        sender: 'ai',
        status: 'sent',
      });
    }

    logger.info('WhatsApp message processed', {
      merchantId: merchant.merchantId,
      customerPhone,
      aiAction: aiResponse.action,
    });
  }

  private async findMerchantByPhoneId(_phoneNumberId: string) {
    const merchants = await merchantService.listMerchants();
    return merchants[0] || null;
  }

  async sendMessage(to: string, body: string): Promise<string> {
    try {
      const response = await axios.post(
        `${this.WHATSAPP_API_URL}/${this.PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body },
        },
        {
          headers: {
            Authorization: `Bearer ${this.ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const messageId = response.data?.messages?.[0]?.id;
      logger.info('WhatsApp message sent', { to, messageId });
      return messageId || '';
    } catch (error) {
      logger.error('Failed to send WhatsApp message', { to, error });
      throw error;
    }
  }

  async sendTemplateMessage(to: string, templateName: string, params?: Record<string, string>[]): Promise<string> {
    try {
      const payload: Record<string, unknown> = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
        },
      };

      if (params) {
        (payload.template as Record<string, unknown>).components = params.map(p => ({
          type: 'body',
          parameters: Object.entries(p).map(([, value]) => ({
            type: 'text',
            text: value,
          })),
        }));
      }

      const response = await axios.post(
        `${this.WHATSAPP_API_URL}/${this.PHONE_NUMBER_ID}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const messageId = response.data?.messages?.[0]?.id;
      logger.info('WhatsApp template sent', { to, templateName, messageId });
      return messageId || '';
    } catch (error) {
      logger.error('Failed to send WhatsApp template', { to, templateName, error });
      throw error;
    }
  }

  async sendBookingConfirmation(to: string, details: { service: string; date: string; time: string; businessName: string }): Promise<string> {
    return this.sendTemplateMessage(to, 'booking_confirmation', [
      { service: details.service, date: details.date, time: details.time, business: details.businessName },
    ]);
  }

  async sendReminder(to: string, details: { service: string; date: string; time: string }): Promise<string> {
    return this.sendTemplateMessage(to, 'appointment_reminder', [
      { service: details.service, date: details.date, time: details.time },
    ]);
  }

  async sendWelcomeMessage(to: string, businessName: string): Promise<string> {
    return this.sendTemplateMessage(to, 'welcome_message', [{ business: businessName }]);
  }

  async sendFollowUp(to: string, businessName: string): Promise<string> {
    return this.sendTemplateMessage(to, 'follow_up', [{ business: businessName }]);
  }
}

export const whatsAppService = new WhatsAppService();
