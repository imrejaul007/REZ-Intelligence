import Redis from 'ioredis';
import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';

export interface WhatsAppMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker' | 'location' | 'contacts' | 'template';
  text?: {
    preview_url?: boolean;
    body: string;
  };
  image?: {
    id?: string;
    link?: string;
    caption?: string;
  };
  document?: {
    id?: string;
    link?: string;
    caption?: string;
    filename?: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: string;
      sub_type?: string;
      index?: number;
      parameters?: Array<{
        type: string;
        text?: string;
        image?: { id: string };
        document?: { id: string };
      }>;
    }>;
  };
  recipient_type?: 'individual' | 'group';
}

export interface OrchestratorRequest {
  sessionId: string;
  userId: string;
  message: {
    type: 'text' | 'image' | 'audio' | 'document' | 'video';
    content: string;
    mediaUrl?: string;
  };
  channel: 'whatsapp';
  metadata: {
    phoneNumber: string;
    whatsappMessageId?: string;
    timestamp: string;
    profileName?: string;
  };
}

export interface OrchestratorResponse {
  sessionId: string;
  response: {
    type: 'text' | 'image' | 'template' | 'interactive';
    content: string;
    mediaUrl?: string;
    quickReplies?: string[];
    buttons?: Array<{ id: string; title: string }>;
  };
  expert?: {
    id: string;
    name: string;
    confidence: number;
  };
  metadata: {
    processingTimeMs: number;
    intent?: string;
    entities?: Record<string, unknown>;
  };
}

export interface MessageBridgeConfig {
  redis: Redis;
  orchestratorUrl: string;
  internalServiceToken: string;
  whatsappApiUrl: string;
  whatsappAccessToken: string;
  phoneNumberId: string;
  verifyToken: string;
  sessionTtlSeconds: number;
  maxRetries: number;
  retryDelayMs: number;
}

export class MessageBridge {
  private redis: Redis;
  private orchestratorClient: AxiosInstance;
  private whatsappClient: AxiosInstance;
  private config: MessageBridgeConfig;
  private isRunning: boolean = false;

  constructor(config: MessageBridgeConfig) {
    this.config = config;
    this.redis = config.redis;

    // Initialize orchestrator client
    this.orchestratorClient = axios.create({
      baseURL: config.orchestratorUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': config.internalServiceToken,
      },
    });

    // Initialize WhatsApp API client
    this.whatsappClient = axios.create({
      baseURL: config.whatsappApiUrl,
      timeout: 15000,
      headers: {
        'Authorization': `Bearer ${config.whatsappAccessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get or create a session for a phone number
   */
  async getOrCreateSession(phoneNumber: string): Promise<string> {
    const sessionKey = `wa:session:${phoneNumber}`;

    let sessionId = await this.redis.get(sessionKey);

    if (!sessionId) {
      sessionId = uuidv4();
      await this.redis.setex(sessionKey, this.config.sessionTtlSeconds, sessionId);
      logger.info('Created new session', { phoneNumber, sessionId });
    } else {
      // Refresh TTL
      await this.redis.expire(sessionKey, this.config.sessionTtlSeconds);
    }

    return sessionId;
  }

  /**
   * Get user ID from phone number (lookup or create)
   */
  async getUserIdFromPhone(phoneNumber: string): Promise<string> {
    const userKey = `wa:user:${phoneNumber}`;

    let userId = await this.redis.get(userKey);

    if (!userId) {
      userId = `wa_${phoneNumber.replace(/[^0-9]/g, '')}`;
      await this.redis.set(userKey, userId);
      logger.info('Created new user mapping', { phoneNumber, userId });
    }

    return userId;
  }

  /**
   * Send message to orchestrator for processing
   */
  async sendToOrchestrator(
    message: {
      type: 'text' | 'image' | 'audio' | 'document' | 'video';
      content: string;
      mediaUrl?: string;
    },
    metadata: {
      phoneNumber: string;
      whatsappMessageId?: string;
      timestamp: string;
      profileName?: string;
    }
  ): Promise<OrchestratorResponse> {
    const sessionId = await this.getOrCreateSession(metadata.phoneNumber);
    const userId = await this.getUserIdFromPhone(metadata.phoneNumber);

    const request: OrchestratorRequest = {
      sessionId,
      userId,
      message,
      channel: 'whatsapp',
      metadata,
    };

    // Store request for debugging/replay
    const requestKey = `wa:request:${sessionId}:${Date.now()}`;
    await this.redis.setex(requestKey, 3600, JSON.stringify(request));

    logger.info('Sending message to orchestrator', {
      sessionId,
      userId,
      messageType: message.type,
      messageLength: message.content.length,
    });

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.orchestratorClient.post<OrchestratorResponse>(
          '/api/v2/message',
          request
        );

        logger.info('Received orchestrator response', {
          sessionId,
          processingTimeMs: response.data.metadata.processingTimeMs,
          expertName: response.data.expert?.name,
        });

        return response.data;
      } catch (error) {
        lastError = error as Error;

        if (axios.isAxiosError(error)) {
          logger.warn(`Orchestrator request failed (attempt ${attempt}/${this.config.maxRetries})`, {
            sessionId,
            status: error.response?.status,
            message: error.message,
          });

          // Don't retry on client errors (4xx)
          if (error.response?.status && error.response.status >= 400 && error.response.status < 500) {
            throw error;
          }
        } else {
          logger.warn(`Orchestrator request failed (attempt ${attempt}/${this.config.maxRetries})`, {
            sessionId,
            error: lastError.message,
          });
        }

        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelayMs * attempt);
        }
      }
    }

    throw lastError || new Error('Failed to send message to orchestrator');
  }

  /**
   * Send text message via WhatsApp
   */
  async sendWhatsAppText(to: string, body: string, previewUrl: boolean = false): Promise<string> {
    const payload: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        preview_url: previewUrl,
        body,
      },
    };

    try {
      const response = await this.whatsappClient.post(`/${this.config.phoneNumberId}/messages`, payload);

      const messageId = response.data.messages?.[0]?.id;

      logger.info('WhatsApp message sent', { to, messageId });

      return messageId;
    } catch (error) {
      logger.error('Failed to send WhatsApp message', { to, error });
      throw error;
    }
  }

  /**
   * Send image message via WhatsApp
   */
  async sendWhatsAppImage(
    to: string,
    imageUrl: string,
    caption?: string
  ): Promise<string> {
    const payload: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: {
        link: imageUrl,
        caption,
      },
    };

    try {
      const response = await this.whatsappClient.post(`/${this.config.phoneNumberId}/messages`, payload);

      const messageId = response.data.messages?.[0]?.id;

      logger.info('WhatsApp image sent', { to, messageId });

      return messageId;
    } catch (error) {
      logger.error('Failed to send WhatsApp image', { to, error });
      throw error;
    }
  }

  /**
   * Send template message via WhatsApp
   */
  async sendWhatsAppTemplate(
    to: string,
    templateName: string,
    languageCode: string = 'en',
    components?: WhatsAppMessage['template']['components']
  ): Promise<string> {
    const payload: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        components,
      },
    };

    try {
      const response = await this.whatsappClient.post(`/${this.config.phoneNumberId}/messages`, payload);

      const messageId = response.data.messages?.[0]?.id;

      logger.info('WhatsApp template sent', { to, templateName, messageId });

      return messageId;
    } catch (error) {
      logger.error('Failed to send WhatsApp template', { to, templateName, error });
      throw error;
    }
  }

  /**
   * Process orchestrator response and send via WhatsApp
   */
  async processAndSendResponse(
    phoneNumber: string,
    response: OrchestratorResponse
  ): Promise<string | null> {
    try {
      switch (response.response.type) {
        case 'text':
          return await this.sendWhatsAppText(phoneNumber, response.response.content);

        case 'image':
          return await this.sendWhatsAppImage(
            phoneNumber,
            response.response.mediaUrl || '',
            response.response.content
          );

        case 'template':
          // Parse template name from content (format: "template:name")
          const [_, templateName, ...rest] = response.response.content.split(':');
          const params = rest.join(':');
          return await this.sendWhatsAppTemplate(
            phoneNumber,
            templateName || 'default',
            'en',
            params ? [{
              type: 'body',
              parameters: [{ type: 'text', text: params }],
            }] : undefined
          );

        case 'interactive':
          // For interactive responses, send text with quick replies as a list message
          const interactiveText = response.response.content;
          const quickReplies = response.response.quickReplies || [];
          const fullText = quickReplies.length > 0
            ? `${interactiveText}\n\n${quickReplies.map((qr, i) => `${i + 1}. ${qr}`).join('\n')}`
            : interactiveText;
          return await this.sendWhatsAppText(phoneNumber, fullText);

        default:
          logger.warn('Unknown response type', { type: response.response.type });
          return null;
      }
    } catch (error) {
      logger.error('Failed to process and send response', {
        phoneNumber,
        error,
      });
      throw error;
    }
  }

  /**
   * Mark messages as read
   */
  async markAsRead(phoneNumberId: string, messageId: string): Promise<void> {
    try {
      await this.whatsappClient.post(`/${phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });

      logger.debug('Message marked as read', { messageId });
    } catch (error) {
      logger.warn('Failed to mark message as read', { messageId, error });
    }
  }

  /**
   * Store conversation context in Redis
   */
  async storeContext(
    sessionId: string,
    context: {
      lastIntent?: string;
      lastExpert?: string;
      entities?: Record<string, unknown>;
      messageCount: number;
    }
  ): Promise<void> {
    const contextKey = `wa:context:${sessionId}`;
    await this.redis.setex(contextKey, this.config.sessionTtlSeconds * 2, JSON.stringify(context));
  }

  /**
   * Get conversation context from Redis
   */
  async getContext(sessionId: string): Promise<{
    lastIntent?: string;
    lastExpert?: string;
    entities?: Record<string, unknown>;
    messageCount: number;
  } | null> {
    const contextKey = `wa:context:${sessionId}`;
    const context = await this.redis.get(contextKey);
    return context ? JSON.parse(context) : null;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, unknown> }> {
    const details: Record<string, unknown> = {};

    // Check Redis
    try {
      const pong = await this.redis.ping();
      details.redis = pong === 'PONG' ? 'healthy' : 'unhealthy';
    } catch (error) {
      details.redis = 'unhealthy';
    }

    // Check Orchestrator
    try {
      await this.orchestratorClient.get('/health');
      details.orchestrator = 'healthy';
    } catch (error) {
      details.orchestrator = 'unhealthy';
    }

    const healthy = Object.values(details).every(v => v === 'healthy');

    return { healthy, details };
  }

  /**
   * Start the bridge service
   */
  async start(): Promise<void> {
    this.isRunning = true;
    logger.info('WhatsApp Message Bridge started');
  }

  /**
   * Stop the bridge service
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    logger.info('WhatsApp Message Bridge stopped');
  }
}
