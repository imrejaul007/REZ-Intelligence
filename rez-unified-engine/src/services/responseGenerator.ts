/**
 * Response Generator Service
 * Generates appropriate responses based on intent, context, and routing decisions
 */

import axios from 'axios';
import {
  IncomingMessage,
  OutgoingMessage,
  ConversationContext,
  IntentData,
  RoutingDecision,
  MessageRole,
  AgentInfo,
  ChannelType,
  QuickReply,
} from '../types';
import { config } from '../config';
import { logger } from '../config/logger';

const responseGeneratorLogger = logger.child({ component: 'ResponseGenerator' });

interface GenerationRequest {
  message: IncomingMessage;
  context: ConversationContext;
  intent: IntentData;
  routing: RoutingDecision;
}

interface AgentOSResponse {
  response: {
    text?: string;
    html?: string;
    attachments?: Array<{
      type: string;
      url: string;
      caption?: string;
    }>;
    quickReplies?: QuickReply[];
  };
  agent?: AgentInfo;
  metadata?: Record<string, unknown>;
}

export class ResponseGenerator {
  private agentOSUrl: string;
  private timeout: number;
  private fallbackResponses: Map<string, string[]>;

  constructor() {
    this.agentOSUrl = config.services.agentOs.url;
    this.timeout = config.performance.messageProcessingTimeoutMs;
    this.fallbackResponses = new Map();

    this.initializeFallbackResponses();
  }

  /**
   * Initialize fallback responses for common intents
   */
  private initializeFallbackResponses(): void {
    this.fallbackResponses.set('greeting', [
      'Hello! How can I help you today?',
      'Hi there! What can I assist you with?',
      'Good day! How may I help you?',
    ]);

    this.fallbackResponses.set('goodbye', [
      'Thank you for chatting with us. Have a great day!',
      'Goodbye! Feel free to reach out if you need anything else.',
      'Take care! We\'re here if you need us.',
    ]);

    this.fallbackResponses.set('help', [
      'I\'m here to help! Could you please provide more details about what you need?',
      'Of course! What specific information are you looking for?',
      'I\'d be happy to assist. Please let me know your question.',
    ]);

    this.fallbackResponses.set('order_status', [
      'I\'d be happy to check your order status. Could you please provide your order ID?',
      'To look up your order, please share your order number or the email used for the purchase.',
    ]);

    this.fallbackResponses.set('refund', [
      'I understand you\'d like a refund. Let me help you with that. Could you provide your order ID?',
      'For refund requests, I\'ll need your order number to process this for you.',
    ]);

    this.fallbackResponses.set('complaint', [
      'I\'m sorry to hear about your experience. Let me connect you with our support team to resolve this.',
      'I apologize for unknown inconvenience. Let me escalate this to ensure it gets proper attention.',
    ]);

    this.fallbackResponses.set('general_inquiry', [
      'Thank you for your message. Let me look into that for you.',
      'I\'ve received your message and I\'ll get back to you shortly.',
      'Thanks for reaching out. How can I assist you further?',
    ]);

    this.fallbackResponses.set('empty_message', [
      'I didn\'t receive a message. Could you please try again?',
    ]);

    this.fallbackResponses.set('question', [
      'That\'s a great question. Let me provide some information on that.',
      'I understand your question. Here\'s what I can tell you:',
    ]);
  }

  /**
   * Generate response for incoming message
   */
  async generate(
    message: IncomingMessage,
    context: ConversationContext,
    intent: IntentData,
    routing: RoutingDecision
  ): Promise<OutgoingMessage> {
    const startTime = Date.now();

    responseGeneratorLogger.debug('Generating response', {
      intentName: intent.name,
      agentType: routing.agentType,
      channel: message.channel,
    });

    try {
      let response: OutgoingMessage;

      if (routing.agentType === 'bot') {
        response = await this.generateBotResponse(message, intent, context);
      } else if (routing.agentType === 'human') {
        response = await this.generateHumanHandoffResponse(message, intent, routing);
      } else {
        response = await this.generateAIAssistResponse(message, intent, context, routing);
      }

      const processingTime = Date.now() - startTime;
      response.metadata = {
        ...response.metadata,
        processingTimeMs: processingTime,
        intentConfidence: intent.confidence,
        routingReason: routing.reason,
      };

      responseGeneratorLogger.debug('Response generated', {
        messageId: response.messageId,
        processingTimeMs: processingTime,
      });

      return response;
    } catch (error) {
      responseGeneratorLogger.error('Failed to generate response', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return fallback response
      return this.generateFallbackResponse(message);
    }
  }

  /**
   * Generate bot response
   */
  private async generateBotResponse(
    message: IncomingMessage,
    intent: IntentData,
    context: ConversationContext
  ): Promise<OutgoingMessage> {
    // Try to get response from Agent OS
    try {
      const agentOSResponse = await this.getAgentOSResponse(message, intent, context);

      if (agentOSResponse?.response) {
        return this.formatResponse(message, agentOSResponse);
      }
    } catch (error) {
      responseGeneratorLogger.warn('Agent OS response failed, using fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Use fallback response
    return this.generateFallbackResponse(message, intent.name);
  }

  /**
   * Get response from Agent OS
   */
  private async getAgentOSResponse(
    message: IncomingMessage,
    intent: IntentData,
    context: ConversationContext
  ): Promise<AgentOSResponse | null> {
    try {
      const response = await axios.post(
        `${this.agentOSUrl}/api/chat/generate`,
        {
          message: message.message,
          intent: {
            intentId: intent.intentId,
            name: intent.name,
            confidence: intent.confidence,
            entities: intent.entities,
          },
          context: {
            userId: context.user?.userId,
            conversationId: context.conversation.conversationId,
            channel: message.channel,
            userAttributes: context.user?.attributes || {},
            sessionVariables: context.conversation.variables,
          },
          history: context.history.messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': config.internalServiceTokens['rez-agent-os'] || '',
          },
        }
      );

      return response.data as AgentOSResponse;
    } catch (error) {
      responseGeneratorLogger.debug('Agent OS request failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Generate human handoff response
   */
  private async generateHumanHandoffResponse(
    message: IncomingMessage,
    intent: IntentData,
    routing: RoutingDecision
  ): Promise<OutgoingMessage> {
    const messageId = this.generateMessageId();

    let text = 'I\'m connecting you with a human agent who can better assist you. Please hold on for a moment.';
    const quickReplies: QuickReply[] = [
      {
        id: 'cancel_handoff',
        text: 'Cancel',
        payload: 'cancel_handoff',
      },
    ];

    // Add queue information if available
    if (routing.queue) {
      text += ` You\'ve been added to the ${routing.queue} queue.`;
    }

    return {
      messageId,
      conversationId: message.conversationId || '',
      sessionId: message.sessionId || '',
      channel: message.channel,
      content: {
        text,
        quickReplies,
      },
      sender: {
        role: MessageRole.AGENT,
        agent: {
          agentId: routing.agentId || 'system',
          name: 'REZ Support',
          type: 'bot',
        },
      },
      metadata: {
        intent,
        routing,
        handoff: true,
      },
    };
  }

  /**
   * Generate AI assist response
   */
  private async generateAIAssistResponse(
    message: IncomingMessage,
    intent: IntentData,
    context: ConversationContext,
    routing: RoutingDecision
  ): Promise<OutgoingMessage> {
    // AI assist suggests responses to human agent
    const suggestion = await this.getAISuggestion(message, intent, context);

    const messageId = this.generateMessageId();

    return {
      messageId,
      conversationId: message.conversationId || '',
      sessionId: message.sessionId || '',
      channel: message.channel,
      content: {
        text: suggestion,
      },
      sender: {
        role: MessageRole.AGENT,
        agent: {
          agentId: 'ai-assist',
          name: 'AI Assistant',
          type: 'ai-assist',
          skills: routing.skills,
        },
      },
      metadata: {
        intent,
        routing,
        suggestion: true,
      },
    };
  }

  /**
   * Get AI suggestion for human agent
   */
  private async getAISuggestion(
    message: IncomingMessage,
    intent: IntentData,
    context: ConversationContext
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${this.agentOSUrl}/api/ai/suggest`,
        {
          message: message.message,
          intent,
          context,
        },
        {
          timeout: 1000,
          headers: {
            'X-Internal-Token': config.internalServiceTokens['rez-agent-os'] || '',
          },
        }
      );

      return response.data?.suggestion || 'Consider responding with empathy and offering a solution.';
    } catch (error) {
      return 'Consider responding with empathy and offering a solution.';
    }
  }

  /**
   * Format response from Agent OS
   */
  private formatResponse(
    message: IncomingMessage,
    agentResponse: AgentOSResponse
  ): OutgoingMessage {
    const messageId = this.generateMessageId();

    return {
      messageId,
      conversationId: message.conversationId || '',
      sessionId: message.sessionId || '',
      channel: message.channel,
      content: {
        text: agentResponse.response.text,
        html: agentResponse.response.html,
        attachments: agentResponse.response.attachments?.map((att, idx) => ({
          id: `att_${idx}`,
          type: att.type as 'image' | 'video' | 'audio' | 'document',
          url: att.url,
          caption: att.caption,
        })),
        quickReplies: agentResponse.response.quickReplies,
      },
      sender: {
        role: MessageRole.AGENT,
        agent: agentResponse.agent || {
          agentId: 'bot',
          name: 'REZ Assistant',
          type: 'bot',
        },
      },
      metadata: agentResponse.metadata,
    };
  }

  /**
   * Generate fallback response
   */
  private generateFallbackResponse(
    message: IncomingMessage,
    intentName: string = 'general_inquiry'
  ): OutgoingMessage {
    const messageId = this.generateMessageId();

    // Get random fallback for intent
    const fallbacks = this.fallbackResponses.get(intentName) ||
                      this.fallbackResponses.get('general_inquiry') ||
                      ['Thank you for your message. Let me help you with that.'];

    const text = fallbacks[Math.floor(Math.random() * fallbacks.length)];

    return {
      messageId,
      conversationId: message.conversationId || '',
      sessionId: message.sessionId || '',
      channel: message.channel,
      content: {
        text,
      },
      sender: {
        role: MessageRole.AGENT,
        agent: {
          agentId: 'bot',
          name: 'REZ Assistant',
          type: 'bot',
        },
      },
      metadata: {
        fallback: true,
        originalIntent: intentName,
      },
    };
  }

  /**
   * Generate message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format response for specific channel
   */
  formatForChannel(response: OutgoingMessage, channel: ChannelType): unknown {
    switch (channel) {
      case 'whatsapp':
        return this.formatForWhatsApp(response);
      case 'voice':
        return this.formatForVoice(response);
      case 'copilot':
        return this.formatForCopilot(response);
      case 'web':
      default:
        return this.formatForWeb(response);
    }
  }

  /**
   * Format for WhatsApp
   */
  private formatForWhatsApp(response: OutgoingMessage): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: response.metadata?.recipientPhone || '',
      type: 'text',
    };

    if (response.content.text) {
      payload.type = 'text';
      payload.text = { body: response.content.text };
    }

    if (response.content.attachments?.length) {
      const attachment = response.content.attachments[0];
      payload.type = attachment.type === 'image' ? 'image' : 'document';
      payload[attachment.type] = {
        id: attachment.id,
        caption: attachment.caption || response.content.text,
      };
    }

    if (response.content.quickReplies?.length) {
      payload.type = 'interactive';
      payload.interactive = {
        type: 'button',
        body: { text: response.content.text || '' },
        action: {
          buttons: response.content.quickReplies.slice(0, 3).map(qr => ({
            type: 'reply',
            reply: { id: qr.id, title: qr.text.slice(0, 20) },
          })),
        },
      };
    }

    return payload;
  }

  /**
   * Format for Voice
   */
  private formatForVoice(response: OutgoingMessage): string {
    const text = response.content.text || 'Thank you for your message.';
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${this.escapeXml(text)}</Say>
</Response>`;
  }

  /**
   * Format for Copilot
   */
  private formatForCopilot(response: OutgoingMessage): Record<string, unknown> {
    return {
      type: 'message',
      content: [
        {
          type: 'text',
          text: response.content.text,
        },
      ],
      metadata: response.metadata,
    };
  }

  /**
   * Format for Web
   */
  private formatForWeb(response: OutgoingMessage): Record<string, unknown> {
    return {
      id: response.messageId,
      type: 'message',
      content: {
        text: response.content.text,
        html: response.content.html,
        attachments: response.content.attachments,
        quickReplies: response.content.quickReplies,
        interactive: response.content.interactive,
      },
      sender: {
        id: response.sender.agent?.agentId || 'bot',
        name: response.sender.agent?.name || 'REZ Assistant',
        type: 'agent',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Escape XML characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// Singleton instance
let responseGeneratorInstance: ResponseGenerator | null = null;

export function getResponseGenerator(): ResponseGenerator {
  if (!responseGeneratorInstance) {
    responseGeneratorInstance = new ResponseGenerator();
  }
  return responseGeneratorInstance;
}

export function resetResponseGenerator(): void {
  responseGeneratorInstance = null;
}

export { ResponseGenerator };
