import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  RCSCard,
  RCSButton,
  RCSMessageStatus,
  RCSMessageType,
  RCSApiResponse,
  validateIndianPhoneNumber,
  normalizePhoneNumber,
} from '../models/RCSCard';
import { RCSLog } from '../models/RCSLog';
import { JioRCSSDK } from './jioRCSSDK';
import { AirtelRCSSDK } from './airtelRCSSDK';

export type CarrierType = 'jio' | 'airtel';

export interface SendMessageOptions {
  carrier?: CarrierType;
  from?: string;
  retryCount?: number;
  tags?: Record<string, string>;
}

export class RCSService {
  private jioSDK: JioRCSSDK;
  private airtelSDK: AirtelRCSSDK;
  private activeCarrier: CarrierType;

  constructor() {
    this.jioSDK = new JioRCSSDK();
    this.airtelSDK = new AirtelRCSSDK();
    this.activeCarrier = config.jio.enabled ? 'jio' : 'airtel';
  }

  /**
   * Send a rich card message to a recipient
   */
  async sendRichMessage(
    to: string,
    card: RCSCard,
    options: SendMessageOptions = {}
  ): Promise<RCSApiResponse> {
    const normalizedTo = normalizePhoneNumber(to);

    if (!validateIndianPhoneNumber(normalizedTo)) {
      throw new Error(`Invalid phone number: ${to}`);
    }

    const messageId = options.tags?.messageId || uuidv4();
    const carrier = options.carrier || this.activeCarrier;

    logger.info('Sending RCS rich message', {
      messageId,
      to: normalizedTo,
      carrier,
      title: card.title,
    });

    try {
      let response: RCSApiResponse;

      if (carrier === 'jio' && config.jio.enabled) {
        response = await this.jioSDK.sendRichCard(normalizedTo, card, messageId);
      } else if (carrier === 'airtel' && config.airtel.enabled) {
        response = await this.airtelSDK.sendRichCard(normalizedTo, card, messageId);
      } else {
        throw new Error(`Carrier ${carrier} is not configured`);
      }

      // Log the message
      await this.logMessage({
        messageId,
        from: options.from || '',
        to: normalizedTo,
        type: RCSMessageType.RICH_CARD,
        carrier,
        status: response.success ? RCSMessageStatus.SENT : RCSMessageStatus.FAILED,
        payload: card,
        response: response as unknown as Record<string, unknown>,
        errorMessage: response.error?.message,
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to send RCS rich message', {
        messageId,
        to: normalizedTo,
        carrier,
        error: errorMessage,
      });

      // Log failed message
      await this.logMessage({
        messageId,
        from: options.from || '',
        to: normalizedTo,
        type: RCSMessageType.RICH_CARD,
        carrier,
        status: RCSMessageStatus.FAILED,
        payload: card,
        errorMessage,
      });

      return {
        success: false,
        error: {
          code: 'SEND_FAILED',
          message: errorMessage,
        },
        carrier,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Send a carousel of rich cards
   */
  async sendCarousel(
    to: string,
    cards: RCSCard[],
    options: SendMessageOptions = {}
  ): Promise<RCSApiResponse> {
    const normalizedTo = normalizePhoneNumber(to);

    if (!validateIndianPhoneNumber(normalizedTo)) {
      throw new Error(`Invalid phone number: ${to}`);
    }

    if (cards.length === 0 || cards.length > 10) {
      throw new Error('Carousel must have between 1 and 10 cards');
    }

    const messageId = options.tags?.messageId || uuidv4();
    const carrier = options.carrier || this.activeCarrier;

    logger.info('Sending RCS carousel', {
      messageId,
      to: normalizedTo,
      carrier,
      cardCount: cards.length,
    });

    try {
      let response: RCSApiResponse;

      if (carrier === 'jio' && config.jio.enabled) {
        response = await this.jioSDK.sendCarousel(normalizedTo, cards, messageId);
      } else if (carrier === 'airtel' && config.airtel.enabled) {
        response = await this.airtelSDK.sendCarousel(normalizedTo, cards, messageId);
      } else {
        throw new Error(`Carrier ${carrier} is not configured`);
      }

      // Log the message
      await this.logMessage({
        messageId,
        from: options.from || '',
        to: normalizedTo,
        type: RCSMessageType.CAROUSEL,
        carrier,
        status: response.success ? RCSMessageStatus.SENT : RCSMessageStatus.FAILED,
        payload: { cards },
        response: response as unknown as Record<string, unknown>,
        errorMessage: response.error?.message,
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to send RCS carousel', {
        messageId,
        to: normalizedTo,
        carrier,
        error: errorMessage,
      });

      await this.logMessage({
        messageId,
        from: options.from || '',
        to: normalizedTo,
        type: RCSMessageType.CAROUSEL,
        carrier,
        status: RCSMessageStatus.FAILED,
        payload: { cards },
        errorMessage,
      });

      return {
        success: false,
        error: {
          code: 'SEND_FAILED',
          message: errorMessage,
        },
        carrier,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Send text message with suggestion buttons
   */
  async sendButton(
    to: string,
    text: string,
    buttons: RCSButton[],
    options: SendMessageOptions = {}
  ): Promise<RCSApiResponse> {
    const normalizedTo = normalizePhoneNumber(to);

    if (!validateIndianPhoneNumber(normalizedTo)) {
      throw new Error(`Invalid phone number: ${to}`);
    }

    if (buttons.length === 0 || buttons.length > 4) {
      throw new Error('Buttons must have between 1 and 4 items');
    }

    const messageId = options.tags?.messageId || uuidv4();
    const carrier = options.carrier || this.activeCarrier;

    logger.info('Sending RCS button message', {
      messageId,
      to: normalizedTo,
      carrier,
      text: text.substring(0, 50),
    });

    try {
      let response: RCSApiResponse;

      if (carrier === 'jio' && config.jio.enabled) {
        response = await this.jioSDK.sendTextWithSuggestions(normalizedTo, text, buttons, messageId);
      } else if (carrier === 'airtel' && config.airtel.enabled) {
        response = await this.airtelSDK.sendTextWithSuggestions(normalizedTo, text, buttons, messageId);
      } else {
        throw new Error(`Carrier ${carrier} is not configured`);
      }

      await this.logMessage({
        messageId,
        from: options.from || '',
        to: normalizedTo,
        type: RCSMessageType.TEXT_WITH_SUGGESTIONS,
        carrier,
        status: response.success ? RCSMessageStatus.SENT : RCSMessageStatus.FAILED,
        payload: { text, buttons },
        response: response as unknown as Record<string, unknown>,
        errorMessage: response.error?.message,
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to send RCS button message', {
        messageId,
        to: normalizedTo,
        carrier,
        error: errorMessage,
      });

      await this.logMessage({
        messageId,
        from: options.from || '',
        to: normalizedTo,
        type: RCSMessageType.TEXT_WITH_SUGGESTIONS,
        carrier,
        status: RCSMessageStatus.FAILED,
        payload: { text, buttons },
        errorMessage,
      });

      return {
        success: false,
        error: {
          code: 'SEND_FAILED',
          message: errorMessage,
        },
        carrier,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get message delivery status
   */
  async getMessageStatus(messageId: string): Promise<RCSMessageStatus | null> {
    try {
      const log = await RCSLog.findOne({ messageId });
      return log ? (log.status as RCSMessageStatus) : null;
    } catch (error) {
      logger.error('Failed to get message status', { messageId, error });
      return null;
    }
  }

  /**
   * Update message status (for webhooks)
   */
  async updateMessageStatus(
    messageId: string,
    status: RCSMessageStatus
  ): Promise<boolean> {
    try {
      const update: Partial<{
        status: RCSMessageStatus;
        deliveredAt: Date;
        readAt: Date;
      }> = { status };

      if (status === RCSMessageStatus.DELIVERED) {
        update.deliveredAt = new Date();
      } else if (status === RCSMessageStatus.READ) {
        update.readAt = new Date();
      }

      const result = await RCSLog.updateOne({ messageId }, { $set: update });
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('Failed to update message status', { messageId, status, error });
      return false;
    }
  }

  /**
   * Log message to database
   */
  private async logMessage(data: {
    messageId: string;
    from: string;
    to: string;
    type: RCSMessageType;
    carrier: CarrierType;
    status: RCSMessageStatus;
    payload: Record<string, unknown>;
    response?: Record<string, unknown>;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await RCSLog.findOneAndUpdate(
        { messageId: data.messageId },
        {
          $set: {
            messageId: data.messageId,
            from: data.from,
            to: data.to,
            type: data.type,
            carrier: data.carrier,
            status: data.status,
            payload: data.payload,
            response: data.response,
            errorMessage: data.errorMessage,
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      logger.error('Failed to log RCS message', { messageId: data.messageId, error });
    }
  }

  /**
   * Get the active carrier
   */
  getActiveCarrier(): CarrierType {
    return this.activeCarrier;
  }

  /**
   * Check if a carrier is available
   */
  isCarrierAvailable(carrier: CarrierType): boolean {
    if (carrier === 'jio') {
      return config.jio.enabled;
    }
    if (carrier === 'airtel') {
      return config.airtel.enabled;
    }
    return false;
  }
}
