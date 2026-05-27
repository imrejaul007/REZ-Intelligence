import axios, { AxiosInstance, AxiosError } from 'axios';
import { createHmac } from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger.js';
import {
  RCSCard,
  RCSButton,
  RCSApiResponse,
  RCSMessageStatus,
} from '../models/RCSCard';

/**
 * Jio RCS API Client
 * Handles communication with Jio's RCS API for rich messaging
 */
export class JioRCSSDK {
  private client: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    this.baseUrl = config.jio.baseUrl;
    this.apiKey = config.jio.apiKey;
    this.apiSecret = config.jio.apiSecret;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use(
      (config) => {
        const timestamp = new Date().toISOString();
        const signature = this.generateSignature(timestamp);
        config.headers.set('X-Jio-Api-Key', this.apiKey);
        config.headers.set('X-Jio-Timestamp', timestamp);
        config.headers.set('X-Jio-Signature', signature);
        return config;
      },
      (error) => {
        logger.error('Jio RCS request interceptor error', { error });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        logger.error('Jio RCS API error', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Generate HMAC-SHA256 signature for authentication
   */
  private generateSignature(timestamp: string): string {
    const payload = `${timestamp}:${this.apiKey}`;
    return createHmac('sha256', this.apiSecret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Send a rich card message
   */
  async sendRichCard(
    to: string,
    card: RCSCard,
    messageId: string
  ): Promise<RCSApiResponse> {
    try {
      const payload = this.buildRichCardPayload(to, card, messageId);

      logger.debug('Jio RCS sending rich card', {
        messageId,
        to,
        title: card.title,
      });

      const response = await this.client.post('/messages/send', payload);

      const responseData = response.data as {
        messageId?: string;
        status?: string;
        error?: { code?: string; message?: string };
      };

      if (response.status === 200 || response.status === 201) {
        return {
          success: true,
          messageId: responseData.messageId || messageId,
          status: this.mapStatus(responseData.status),
          carrier: 'jio',
          timestamp: new Date(),
        };
      }

      return {
        success: false,
        error: {
          code: responseData.error?.code || 'UNKNOWN_ERROR',
          message: responseData.error?.message || 'Unknown error occurred',
        },
        carrier: 'jio',
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleError(error, messageId);
    }
  }

  /**
   * Send a carousel of rich cards
   */
  async sendCarousel(
    to: string,
    cards: RCSCard[],
    messageId: string
  ): Promise<RCSApiResponse> {
    try {
      const payload = this.buildCarouselPayload(to, cards, messageId);

      logger.debug('Jio RCS sending carousel', {
        messageId,
        to,
        cardCount: cards.length,
      });

      const response = await this.client.post('/messages/send', payload);

      const responseData = response.data as {
        messageId?: string;
        status?: string;
        error?: { code?: string; message?: string };
      };

      if (response.status === 200 || response.status === 201) {
        return {
          success: true,
          messageId: responseData.messageId || messageId,
          status: this.mapStatus(responseData.status),
          carrier: 'jio',
          timestamp: new Date(),
        };
      }

      return {
        success: false,
        error: {
          code: responseData.error?.code || 'UNKNOWN_ERROR',
          message: responseData.error?.message || 'Unknown error occurred',
        },
        carrier: 'jio',
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleError(error, messageId);
    }
  }

  /**
   * Send text message with suggestion buttons
   */
  async sendTextWithSuggestions(
    to: string,
    text: string,
    buttons: RCSButton[],
    messageId: string
  ): Promise<RCSApiResponse> {
    try {
      const payload = this.buildTextWithSuggestionsPayload(to, text, buttons, messageId);

      logger.debug('Jio RCS sending text with suggestions', {
        messageId,
        to,
        textLength: text.length,
        buttonCount: buttons.length,
      });

      const response = await this.client.post('/messages/send', payload);

      const responseData = response.data as {
        messageId?: string;
        status?: string;
        error?: { code?: string; message?: string };
      };

      if (response.status === 200 || response.status === 201) {
        return {
          success: true,
          messageId: responseData.messageId || messageId,
          status: this.mapStatus(responseData.status),
          carrier: 'jio',
          timestamp: new Date(),
        };
      }

      return {
        success: false,
        error: {
          code: responseData.error?.code || 'UNKNOWN_ERROR',
          message: responseData.error?.message || 'Unknown error occurred',
        },
        carrier: 'jio',
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleError(error, messageId);
    }
  }

  /**
   * Build rich card payload for Jio API
   */
  private buildRichCardPayload(
    to: string,
    card: RCSCard,
    messageId: string
  ): Record<string, unknown> {
    return {
      messageId,
      destination: to,
      messageType: 'rich_card',
      richCard: {
        richCardType: 'STANDALONE',
        richCardMedia: card.imageUrl
          ? {
              height: card.mediaHeight || 'MEDIUM',
              mediaUrl: card.imageUrl,
              mediaContentType: this.getMediaContentType(card.imageUrl),
              thumbnailUrl: card.imageUrl,
            }
          : undefined,
        richCardTitle: card.title,
        richCardDescription: card.description,
        suggestions: card.buttons?.map((button) =>
          this.buildSuggestion(button)
        ),
      },
    };
  }

  /**
   * Build carousel payload for Jio API
   */
  private buildCarouselPayload(
    to: string,
    cards: RCSCard[],
    messageId: string
  ): Record<string, unknown> {
    return {
      messageId,
      destination: to,
      messageType: 'carousel',
      richCard: {
        richCardType: 'CAROUSEL',
        cardWidth: 'MEDIUM',
        cardMedia: cards.map((card) => ({
          height: card.mediaHeight || 'MEDIUM',
          mediaUrl: card.imageUrl,
          mediaContentType: card.imageUrl
            ? this.getMediaContentType(card.imageUrl)
            : 'image/jpeg',
        })),
        richCardTitle: cards.map((card) => card.title),
        richCardDescription: cards.map((card) => card.description),
        suggestions: cards.map((card) =>
          card.buttons?.map((button) => this.buildSuggestion(button))
        ),
      },
    };
  }

  /**
   * Build text with suggestions payload for Jio API
   */
  private buildTextWithSuggestionsPayload(
    to: string,
    text: string,
    buttons: RCSButton[],
    messageId: string
  ): Record<string, unknown> {
    return {
      messageId,
      destination: to,
      messageType: 'text',
      textContent: {
        text,
        suggestions: buttons.map((button) => this.buildSuggestion(button)),
      },
    };
  }

  /**
   * Build suggestion object from button
   */
  private buildSuggestion(button: RCSButton): Record<string, unknown> {
    const suggestion: Record<string, unknown> = {
      text: button.title,
    };

    switch (button.type) {
      case 'url':
        suggestion.action = {
          urlAction: {
            openUrl: {
              url: button.url || button.value,
            },
          },
        };
        break;
      case 'phone':
        suggestion.action = {
          dialerAction: {
            dialPhoneNumber: {
              phoneNumber: button.phoneNumber || button.value,
            },
          },
        };
        break;
      case 'reply':
      case 'quickReply':
        suggestion.action = {
          postbackData: button.value || button.title,
        };
        break;
      default:
        suggestion.action = {
          postbackData: button.value || button.title,
        };
    }

    return suggestion;
  }

  /**
   * Map Jio API status to our status enum
   */
  private mapStatus(jioStatus?: string): RCSMessageStatus {
    const statusMap: Record<string, RCSMessageStatus> = {
      ACCEPTED: RCSMessageStatus.SENT,
      DELIVERED: RCSMessageStatus.DELIVERED,
      READ: RCSMessageStatus.READ,
      FAILED: RCSMessageStatus.FAILED,
      EXPIRED: RCSMessageStatus.EXPIRED,
    };
    return statusMap[jioStatus || ''] || RCSMessageStatus.PENDING;
  }

  /**
   * Get media content type from URL
   */
  private getMediaContentType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    return contentTypes[extension || ''] || 'image/jpeg';
  }

  /**
   * Handle API errors
   */
  private handleError(
    error: unknown,
    messageId: string
  ): RCSApiResponse {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const responseData = axiosError.response?.data as {
        error?: { code?: string; message?: string };
      };

      logger.error('Jio RCS API error', {
        messageId,
        status: axiosError.response?.status,
        errorCode: responseData?.error?.code,
        errorMessage: responseData?.error?.message,
      });

      return {
        success: false,
        error: {
          code: responseData?.error?.code || 'API_ERROR',
          message:
            responseData?.error?.message ||
            axiosError.message ||
            'Unknown API error',
        },
        carrier: 'jio',
        timestamp: new Date(),
      };
    }

    logger.error('Jio RCS unexpected error', {
      messageId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal error',
      },
      carrier: 'jio',
      timestamp: new Date(),
    };
  }

  /**
   * Check API health/connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
