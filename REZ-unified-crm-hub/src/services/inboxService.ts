/**
 * Inbox Service
 *
 * Unified inbox for all customer communications:
 * - WhatsApp
 * - Instagram DM
 * - SMS
 * - App Push
 * - Email
 * - Support Chats
 * - Booking Chats
 */

import axios from 'axios';
import { serviceUrls } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type {
  InboxMessage,
  InboxChannel,
  MessageChannel,
  MessageStatus,
} from '../types/index.js';

export interface InboxFilters {
  channel?: MessageChannel;
  customerId?: string;
  merchantId?: string;
  storeId?: string;
  status?: MessageStatus;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export class InboxService {
  private axiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 10000,
      headers: {
        'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN,
      },
    });
  }

  /**
   * Get all inbox messages with filters
   */
  async getMessages(filters: InboxFilters = {}): Promise<{
    messages: InboxMessage[];
    total: number;
    unreadCount: number;
  }> {
    try {
      const [whatsapp, instagram, sms, appMessages, support] = await Promise.allSettled([
        this.fetchWhatsAppMessages(filters),
        this.fetchInstagramMessages(filters),
        this.fetchSMSMessages(filters),
        this.fetchAppMessages(filters),
        this.fetchSupportMessages(filters),
      ]);

      const allMessages: InboxMessage[] = [];

      if (whatsapp.status === 'fulfilled') {
        allMessages.push(...whatsapp.value);
      }
      if (instagram.status === 'fulfilled') {
        allMessages.push(...instagram.value);
      }
      if (sms.status === 'fulfilled') {
        allMessages.push(...sms.value);
      }
      if (appMessages.status === 'fulfilled') {
        allMessages.push(...appMessages.value);
      }
      if (support.status === 'fulfilled') {
        allMessages.push(...support.value);
      }

      // Sort by created date (newest first)
      allMessages.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Apply filters
      const filteredMessages = this.applyFilters(allMessages, filters);

      const total = filteredMessages.length;
      const unreadCount = filteredMessages.filter(
        (m) => m.status === 'RECEIVED' && m.direction === 'INBOUND'
      ).length;

      // Apply pagination
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const startIndex = (page - 1) * limit;
      const paginatedMessages = filteredMessages.slice(
        startIndex,
        startIndex + limit
      );

      return {
        messages: paginatedMessages,
        total,
        unreadCount,
      };
    } catch (error) {
      logger.error('Error fetching inbox messages', { error });
      return { messages: [], total: 0, unreadCount: 0 };
    }
  }

  /**
   * Get channels summary
   */
  async getChannels(): Promise<InboxChannel[]> {
    const channels: InboxChannel[] = [];

    try {
      const [whatsappStatus, instagramStatus, smsStatus, appStatus] =
        await Promise.allSettled([
          this.getChannelStatus('WHATSAPP'),
          this.getChannelStatus('INSTAGRAM'),
          this.getChannelStatus('SMS'),
          this.getChannelStatus('APP_PUSH'),
        ]);

      channels.push(
        this.buildChannel(
          'WHATSAPP',
          'WhatsApp',
          'message-circle',
          whatsappStatus
        )
      );
      channels.push(
        this.buildChannel(
          'INSTAGRAM',
          'Instagram',
          'instagram',
          instagramStatus
        )
      );
      channels.push(
        this.buildChannel('SMS', 'SMS', 'message-square', smsStatus)
      );
      channels.push(
        this.buildChannel('APP_PUSH', 'App Push', 'bell', appStatus)
      );

      // Add other channels
      channels.push({
        channel: 'EMAIL',
        name: 'Email',
        icon: 'mail',
        unreadCount: 0,
        isConnected: false,
      });
      channels.push({
        channel: 'SUPPORT_CHAT',
        name: 'Support',
        icon: 'headphones',
        unreadCount: 0,
        isConnected: false,
      });
    } catch (error) {
      logger.error('Error fetching channel status', { error });
    }

    return channels;
  }

  /**
   * Send a message
   */
  async sendMessage(
    channel: MessageChannel,
    customerId: string,
    content: string,
    metadata: {
      merchantId?: string;
      storeId?: string;
      orderId?: string;
    } = {}
  ): Promise<InboxMessage | null> {
    try {
      switch (channel) {
        case 'WHATSAPP':
          return await this.sendWhatsApp(customerId, content, metadata);
        case 'SMS':
          return await this.sendSMS(customerId, content, metadata);
        case 'EMAIL':
          return await this.sendEmail(customerId, content, metadata);
        default:
          logger.warn('Unsupported channel for sending', { channel });
          return null;
      }
    } catch (error) {
      logger.error('Error sending message', { channel, error });
      return null;
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string, channel: MessageChannel): Promise<boolean> {
    try {
      switch (channel) {
        case 'WHATSAPP':
          await this.markWhatsAppRead(messageId);
          break;
        case 'SMS':
          await this.markSMSRead(messageId);
          break;
        case 'APP_PUSH':
          await this.markAppPushRead(messageId);
          break;
        default:
          logger.warn('Mark read not supported for channel', { channel });
      }
      return true;
    } catch (error) {
      logger.error('Error marking message as read', { messageId, error });
      return false;
    }
  }

  // Private methods

  private async fetchWhatsAppMessages(
    filters: InboxFilters
  ): Promise<InboxMessage[]> {
    // Would call reks-whatsapp-commerce service
    // For now, return empty
    return [];
  }

  private async fetchInstagramMessages(
    filters: InboxFilters
  ): Promise<InboxMessage[]> {
    // Would call Instagram sales agent service
    return [];
  }

  private async fetchSMSMessages(filters: InboxFilters): Promise<InboxMessage[]> {
    // Would call SMS service (MSG91/Twilio)
    return [];
  }

  private async fetchAppMessages(filters: InboxFilters): Promise<InboxMessage[]> {
    // Would call notification service
    return [];
  }

  private async fetchSupportMessages(
    filters: InboxFilters
  ): Promise<InboxMessage[]> {
    // Would call support service
    return [];
  }

  private async getChannelStatus(
    channel: MessageChannel
  ): Promise<{ unread: number; lastMessage?: InboxMessage }> {
    try {
      // Would call respective service for status
      return { unread: 0 };
    } catch (error) {
      return { unread: 0 };
    }
  }

  private buildChannel(
    channel: MessageChannel,
    name: string,
    icon: string,
    statusPromise: PromiseSettledResult<{ unread: number; lastMessage?: InboxMessage }>
  ): InboxChannel {
    if (statusPromise.status === 'fulfilled') {
      return {
        channel,
        name,
        icon,
        unreadCount: statusPromise.value.unread,
        lastMessage: statusPromise.value.lastMessage,
        isConnected: true,
      };
    }
    return {
      channel,
      name,
      icon,
      unreadCount: 0,
      isConnected: false,
    };
  }

  private async sendWhatsApp(
    customerId: string,
    content: string,
    metadata: unknown
  ): Promise<InboxMessage | null> {
    // Would call WhatsApp service
    logger.info('Sending WhatsApp message', { customerId, content });
    return null;
  }

  private async sendSMS(
    customerId: string,
    content: string,
    metadata: unknown
  ): Promise<InboxMessage | null> {
    // Would call SMS service
    logger.info('Sending SMS', { customerId, content });
    return null;
  }

  private async sendEmail(
    customerId: string,
    content: string,
    metadata: unknown
  ): Promise<InboxMessage | null> {
    // Would call email service
    logger.info('Sending email', { customerId, content });
    return null;
  }

  private async markWhatsAppRead(messageId: string): Promise<void> {
    // Would call WhatsApp service
  }

  private async markSMSRead(messageId: string): Promise<void> {
    // Would call SMS service
  }

  private async markAppPushRead(messageId: string): Promise<void> {
    // Would call notification service
  }

  private applyFilters(
    messages: InboxMessage[],
    filters: InboxFilters
  ): InboxMessage[] {
    let result = [...messages];

    if (filters.channel) {
      result = result.filter((m) => m.channel === filters.channel);
    }

    if (filters.customerId) {
      result = result.filter((m) => m.customerId === filters.customerId);
    }

    if (filters.status) {
      result = result.filter((m) => m.status === filters.status);
    }

    if (filters.dateFrom) {
      result = result.filter(
        (m) => new Date(m.createdAt) >= filters.dateFrom!
      );
    }

    if (filters.dateTo) {
      result = result.filter(
        (m) => new Date(m.createdAt) <= filters.dateTo!
      );
    }

    return result;
  }
}

export const inboxService = new InboxService();
export default inboxService;
