/**
 * Channel Router Service
 * Routes incoming messages to the appropriate channel adapter and manages multi-channel communication
 */

import { ChannelType, IncomingMessage, OutgoingMessage } from '../types';
import { ChannelAdapter } from '../types';
import { WhatsAppAdapter } from '../channels/whatsapp.adapter';
import { VoiceAdapter } from '../channels/voice.adapter';
import { CopilotAdapter } from '../channels/copilot.adapter';
import { WebAdapter } from '../channels/web.adapter';
import { logger } from '../config/logger';
import { ConversationService } from './conversationLogger';

const channelRouterLogger = logger.child({ component: 'ChannelRouter' });

export class ChannelRouter {
  private adapters: Map<ChannelType, ChannelAdapter>;
  private adapterHealth: Map<ChannelType, { healthy: boolean; lastCheck: Date }>;

  constructor(conversationService: ConversationService) {
    this.adapters = new Map();
    this.adapterHealth = new Map();

    // Initialize adapters
    this.initializeAdapters(conversationService);
  }

  private initializeAdapters(conversationService: ConversationService): void {
    // WhatsApp adapter
    const whatsappAdapter = new WhatsAppAdapter(conversationService);
    this.adapters.set('whatsapp', whatsappAdapter);
    this.adapterHealth.set('whatsapp', { healthy: true, lastCheck: new Date() });

    // Voice adapter
    const voiceAdapter = new VoiceAdapter(conversationService);
    this.adapters.set('voice', voiceAdapter);
    this.adapterHealth.set('voice', { healthy: true, lastCheck: new Date() });

    // Copilot adapter
    const copilotAdapter = new CopilotAdapter(conversationService);
    this.adapters.set('copilot', copilotAdapter);
    this.adapterHealth.set('copilot', { healthy: true, lastCheck: new Date() });

    // Web adapter
    const webAdapter = new WebAdapter(conversationService);
    this.adapters.set('web', webAdapter);
    this.adapterHealth.set('web', { healthy: true, lastCheck: new Date() });

    channelRouterLogger.info('Channel adapters initialized', {
      channels: Array.from(this.adapters.keys()),
    });
  }

  /**
   * Get the appropriate adapter for a channel
   */
  getAdapter(channel: ChannelType): ChannelAdapter {
    const adapter = this.adapters.get(channel);
    if (!adapter) {
      throw new Error(`No adapter found for channel: ${channel}`);
    }
    return adapter;
  }

  /**
   * Check if a channel is available
   */
  isChannelAvailable(channel: ChannelType): boolean {
    const health = this.adapterHealth.get(channel);
    return health?.healthy ?? false;
  }

  /**
   * Get all available channels
   */
  getAvailableChannels(): ChannelType[] {
    return Array.from(this.adapters.keys()).filter(channel =>
      this.isChannelAvailable(channel)
    );
  }

  /**
   * Route an incoming message to the appropriate channel adapter
   */
  async routeIncoming(message: IncomingMessage): Promise<OutgoingMessage> {
    const startTime = Date.now();
    const { channel } = message;

    channelRouterLogger.debug('Routing incoming message', {
      channel,
      hasSessionId: Boolean(message.sessionId),
      messageLength: message.message.length,
    });

    try {
      const adapter = this.getAdapter(channel);

      // Check adapter health
      const health = this.adapterHealth.get(channel);
      if (!health?.healthy) {
        throw new Error(`Channel ${channel} is currently unavailable`);
      }

      // Process message through adapter
      const response = await adapter.processMessage(message);

      const processingTime = Date.now() - startTime;
      channelRouterLogger.info('Message routed successfully', {
        channel,
        messageId: response.messageId,
        processingTimeMs: processingTime,
      });

      return response;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      channelRouterLogger.error('Failed to route message', {
        channel,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: processingTime,
      });
      throw error;
    }
  }

  /**
   * Send a message through a specific channel
   */
  async sendMessage(message: OutgoingMessage): Promise<string> {
    const { channel, messageId } = message;

    channelRouterLogger.debug('Sending message', {
      channel,
      messageId,
    });

    try {
      const adapter = this.getAdapter(channel);
      const channelMessageId = await adapter.sendMessage(message);

      channelRouterLogger.info('Message sent', {
        channel,
        messageId,
        channelMessageId,
      });

      return channelMessageId;
    } catch (error) {
      channelRouterLogger.error('Failed to send message', {
        channel,
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Handle webhook from a channel
   */
  async handleWebhook(
    channel: ChannelType,
    req: unknown,
    res: unknown
  ): Promise<void> {
    channelRouterLogger.debug('Handling webhook', { channel });

    try {
      const adapter = this.getAdapter(channel);
      await adapter.handleWebhook(req, res);

      channelRouterLogger.info('Webhook handled successfully', { channel });
    } catch (error) {
      channelRouterLogger.error('Failed to handle webhook', {
        channel,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update channel health status
   */
  updateChannelHealth(channel: ChannelType, healthy: boolean): void {
    this.adapterHealth.set(channel, {
      healthy,
      lastCheck: new Date(),
    });

    channelRouterLogger.info('Channel health updated', {
      channel,
      healthy,
    });
  }

  /**
   * Get health status for all channels
   */
  getHealthStatus(): Record<ChannelType, { healthy: boolean; lastCheck: Date }> {
    const status: Record<string, { healthy: boolean; lastCheck: Date }> = {};

    for (const [channel, health] of this.adapterHealth.entries()) {
      status[channel] = health;
    }

    return status as Record<ChannelType, { healthy: boolean; lastCheck: Date }>;
  }

  /**
   * Check health of all adapters
   */
  async checkAllAdapters(): Promise<void> {
    for (const channel of this.adapters.keys()) {
      try {
        // Implement actual health check logic
        // For now, mark as healthy
        this.updateChannelHealth(channel, true);
      } catch (error) {
        channelRouterLogger.error('Adapter health check failed', {
          channel,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        this.updateChannelHealth(channel, false);
      }
    }
  }

  /**
   * Route to multiple channels (broadcast)
   */
  async broadcastMessage(
    message: OutgoingMessage,
    targetChannels: ChannelType[]
  ): Promise<Record<ChannelType, string>> {
    const results: Record<ChannelType, string> = {} as Record<ChannelType, string>;

    channelRouterLogger.info('Broadcasting message', {
      targetChannels,
      messageId: message.messageId,
    });

    const sendPromises = targetChannels.map(async (channel) => {
      try {
        // Clone message for each channel
        const channelMessage: OutgoingMessage = {
          ...message,
          channel,
        };

        const channelMessageId = await this.sendMessage(channelMessage);
        results[channel] = channelMessageId;
      } catch (error) {
        channelRouterLogger.error('Failed to broadcast to channel', {
          channel,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    });

    await Promise.allSettled(sendPromises);

    return results;
  }

  /**
   * Cross-channel routing (e.g., escalate from web to WhatsApp)
   */
  async crossChannelTransfer(
    message: IncomingMessage,
    targetChannel: ChannelType
  ): Promise<OutgoingMessage> {
    channelRouterLogger.info('Cross-channel transfer', {
      fromChannel: message.channel,
      toChannel: targetChannel,
      sessionId: message.sessionId,
    });

    // Process message through new channel
    const response = await this.routeIncoming({
      ...message,
      channel: targetChannel,
    });

    return response;
  }

  /**
   * Get channel-specific capabilities
   */
  getChannelCapabilities(channel: ChannelType): {
    supportsText: boolean;
    supportsMedia: boolean;
    supportsInteractive: boolean;
    supportsTypingIndicator: boolean;
    maxMessageLength: number;
  } {
    switch (channel) {
      case 'whatsapp':
        return {
          supportsText: true,
          supportsMedia: true,
          supportsInteractive: true,
          supportsTypingIndicator: true,
          maxMessageLength: 65536,
        };
      case 'voice':
        return {
          supportsText: false,
          supportsMedia: false,
          supportsInteractive: false,
          supportsTypingIndicator: false,
          maxMessageLength: 0,
        };
      case 'copilot':
        return {
          supportsText: true,
          supportsMedia: true,
          supportsInteractive: true,
          supportsTypingIndicator: true,
          maxMessageLength: 10000,
        };
      case 'web':
        return {
          supportsText: true,
          supportsMedia: true,
          supportsInteractive: true,
          supportsTypingIndicator: true,
          maxMessageLength: 10000,
        };
      default:
        return {
          supportsText: true,
          supportsMedia: false,
          supportsInteractive: false,
          supportsTypingIndicator: false,
          maxMessageLength: 1000,
        };
    }
  }
}

// Singleton instance
let channelRouterInstance: ChannelRouter | null = null;

export function getChannelRouter(conversationService: ConversationService): ChannelRouter {
  if (!channelRouterInstance) {
    channelRouterInstance = new ChannelRouter(conversationService);
  }
  return channelRouterInstance;
}

export function resetChannelRouter(): void {
  channelRouterInstance = null;
}
