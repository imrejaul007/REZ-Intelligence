import axios, { AxiosInstance, AxiosError } from 'axios';
import { createHmac, createHash } from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger.js';
import {
  RCSCard,
  RCSButton,
  RCSApiResponse,
  RCSMessageStatus,
} from '../models/RCSCard';

/**
 * Airtel RCS API Client
 * Handles communication with Airtel's RCS API for rich messaging
 * Uses OAuth2 authentication with client credentials
 */
export class AirtelRCSSDK {
  private client: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.baseUrl = config.airtel.baseUrl;
    this.apiKey = config.airtel.apiKey;
    this.apiSecret = config.airtel.apiSecret;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        logger.error('Airtel RCS API error', {
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
   * Get OAuth2 access token
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const credentials = Buffer.from(
        `${this.apiKey}:${this.apiSecret}`
      ).toString('base64');

      const response = await axios.post(
        `${this.baseUrl}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: this.apiKey,
          client_secret: this.apiSecret,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${credentials}`,
          },
          timeout: 10000,
        }
      );

      const data = response.data as {
        access_token: string;
        expires_in: number;
      };

      this.accessToken = data.access_token;
      // Set expiry 5 minutes before actual expiry for safety
      this.tokenExpiry = new Date(
        Date.now() + (data.expires_in - 300) * 1000
      );

      logger.debug('Airtel RCS: Obtained new access token');
      return this.accessToken;
    } catch (error) {
      logger.error('Failed to get Airtel RCS access token', { error });
      throw new Error('Failed to authenticate with Airtel RCS API');
    }
  }

  /**
   * Generate message signature for payload integrity
   */
  private generateSignature(payload: string): string {
    const hmac = createHmac('sha256', this.apiSecret)
      .update(payload)
      .digest('hex');
    const hash = createHash('sha256')
      .update(payload + this.apiSecret)
      .digest('hex');
    return `${hmac}.${hash}`;
  }

  /**
   * Get authenticated request headers
   */
  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'X-API-Key': this.apiKey,
      'X-Timestamp': new Date().toISOString(),
    };
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
      const headers = await this.getHeaders();

      // Add signature to payload
      const payloadString = JSON.stringify(payload);
      headers['X-Signature'] = this.generateSignature(payloadString);

      logger.debug('Airtel RCS sending rich card', {
        messageId,
        to,
        title: card.title,
      });

      const response = await this.client.post('/messages/rcs', payload, {
        headers,
      });

      const responseData = response.data as {
        id?: string;
        status?: string;
        error?: { code?: string; message?: string };
      };

      if (response.status === 200 || response.status === 201 || response.status === 202) {
        return {
          success: true,
          messageId: responseData.id || messageId,
          status: this.mapStatus(responseData.status),
          carrier: 'airtel',
          timestamp: new Date(),
        };
      }

      return {
        success: false,
        error: {
          code: responseData.error?.code || 'UNKNOWN_ERROR',
          message: responseData.error?.message || 'Unknown error occurred',
        },
        carrier: 'airtel',
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
      const headers = await this.getHeaders();

      const payloadString = JSON.stringify(payload);
      headers['X-Signature'] = this.generateSignature(payloadString);

      logger.debug('Airtel RCS sending carousel', {
        messageId,
        to,
        cardCount: cards.length,
      });

      const response = await this.client.post('/messages/rcs', payload, {
        headers,
      });

      const responseData = response.data as {
        id?: string;
        status?: string;
        error?: { code?: string; message?: string };
      };

      if (response.status === 200 || response.status === 201 || response.status === 202) {
        return {
          success: true,
          messageId: responseData.id || messageId,
          status: this.mapStatus(responseData.status),
          carrier: 'airtel',
          timestamp: new Date(),
        };
      }

      return {
        success: false,
        error: {
          code: responseData.error?.code || 'UNKNOWN_ERROR',
          message: responseData.error?.message || 'Unknown error occurred',
        },
        carrier: 'airtel',
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
      const headers = await this.getHeaders();

      const payloadString = JSON.stringify(payload);
      headers['X-Signature'] = this.generateSignature(payloadString);

      logger.debug('Airtel RCS sending text with suggestions', {
        messageId,
        to,
        textLength: text.length,
        buttonCount: buttons.length,
      });

      const response = await this.client.post('/messages/rcs', payload, {
        headers,
      });

      const responseData = response.data as {
        id?: string;
        status?: string;
        error?: { code?: string; message?: string };
      };

      if (response.status === 200 || response.status === 201 || response.status === 202) {
        return {
          success: true,
          messageId: responseData.id || messageId,
          status: this.mapStatus(responseData.status),
          carrier: 'airtel',
          timestamp: new Date(),
        };
      }

      return {
        success: false,
        error: {
          code: responseData.error?.code || 'UNKNOWN_ERROR',
          message: responseData.error?.message || 'Unknown error occurred',
        },
        carrier: 'airtel',
        timestamp: new Date(),
      };
    } catch (error) {
      return this.handleError(error, messageId);
    }
  }

  /**
   * Build rich card payload for Airtel API
   */
  private buildRichCardPayload(
    to: string,
    card: RCSCard,
    messageId: string
  ): Record<string, unknown> {
    return {
      correlation_id: messageId,
      destination: to,
      rcs_type: 'rich_card',
      content: {
        card: {
          media: card.imageUrl
            ? {
                url: card.imageUrl,
                height: this.mapMediaHeight(card.mediaHeight || 'medium'),
                thumbnail_url: card.imageUrl,
              }
            : undefined,
          title: card.title,
          description: card.description,
          suggestions: card.buttons?.map((button) =>
            this.buildSuggestion(button)
          ),
        },
      },
    };
  }

  /**
   * Build carousel payload for Airtel API
   */
  private buildCarouselPayload(
    to: string,
    cards: RCSCard[],
    messageId: string
  ): Record<string, unknown> {
    return {
      correlation_id: messageId,
      destination: to,
      rcs_type: 'carousel',
      content: {
        cards: cards.map((card) => ({
          media: card.imageUrl
            ? {
                url: card.imageUrl,
                height: this.mapMediaHeight(card.mediaHeight || 'medium'),
              }
            : undefined,
          title: card.title,
          description: card.description,
          suggestions: card.buttons?.map((button) =>
            this.buildSuggestion(button)
          ),
        })),
      },
    };
  }

  /**
   * Build text with suggestions payload for Airtel API
   */
  private buildTextWithSuggestionsPayload(
    to: string,
    text: string,
    buttons: RCSButton[],
    messageId: string
  ): Record<string, unknown> {
    return {
      correlation_id: messageId,
      destination: to,
      rcs_type: 'text_with_suggestions',
      content: {
        text,
        suggestions: buttons.map((button) => this.buildSuggestion(button)),
      },
    };
  }

  /**
   * Build suggestion object from button (Airtel format)
   */
  private buildSuggestion(button: RCSButton): Record<string, unknown> {
    switch (button.type) {
      case 'url':
        return {
          type: 'url',
          label: button.title,
          url: button.url || button.value,
        };
      case 'phone':
        return {
          type: 'phone_number',
          label: button.title,
          phone_number: button.phoneNumber || button.value,
        };
      case 'reply':
      case 'quickReply':
        return {
          type: 'reply',
          label: button.title,
          postback: button.value || button.title,
        };
      case 'location':
        return {
          type: 'location',
          label: button.title,
          location_data: button.value,
        };
      case 'copy':
        return {
          type: 'copy',
          label: button.title,
          copy_text: button.value,
        };
      default:
        return {
          type: 'reply',
          label: button.title,
          postback: button.value || button.title,
        };
    }
  }

  /**
   * Map our media height to Airtel's format
   */
  private mapMediaHeight(height: string): string {
    const heightMap: Record<string, string> = {
      short: 'SHORT',
      medium: 'MEDIUM',
      tall: 'TALL',
    };
    return heightMap[height.toLowerCase()] || 'MEDIUM';
  }

  /**
   * Map Airtel API status to our status enum
   */
  private mapStatus(airtelStatus?: string): RCSMessageStatus {
    const statusMap: Record<string, RCSMessageStatus> = {
      QUEUED: RCSMessageStatus.PENDING,
      SENT: RCSMessageStatus.SENT,
      DELIVERED: RCSMessageStatus.DELIVERED,
      READ: RCSMessageStatus.READ,
      FAILED: RCSMessageStatus.FAILED,
      EXPIRED: RCSMessageStatus.EXPIRED,
      UNDELIVERABLE: RCSMessageStatus.FAILED,
    };
    return statusMap[airtelStatus?.toUpperCase() || ''] || RCSMessageStatus.PENDING;
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
        message?: string;
      };

      logger.error('Airtel RCS API error', {
        messageId,
        status: axiosError.response?.status,
        errorCode: responseData?.error?.code,
        errorMessage: responseData?.error?.message || responseData?.message,
      });

      // Handle specific error codes
      if (axiosError.response?.status === 401) {
        // Clear cached token so next request gets a fresh one
        this.accessToken = null;
        this.tokenExpiry = null;
      }

      return {
        success: false,
        error: {
          code: responseData?.error?.code || 'API_ERROR',
          message:
            responseData?.error?.message ||
            responseData?.message ||
            axiosError.message ||
            'Unknown API error',
        },
        carrier: 'airtel',
        timestamp: new Date(),
      };
    }

    logger.error('Airtel RCS unexpected error', {
      messageId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal error',
      },
      carrier: 'airtel',
      timestamp: new Date(),
    };
  }

  /**
   * Check API health/connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const response = await this.client.get('/health', { headers });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
