/**
 * Voice Support Agent
 * Handles customer support voice conversations for ReZ platform
 * Supports order status, refunds, and technical issues
 */

import { randomUUID } from 'crypto';
import { getConversationService } from '../services/conversationService';
import { getTTSService } from '../services/ttsService';
import { logger } from '../utils/logger.js';
import { VoiceAgentType, VoiceAgentResponse } from '../types';

export interface SupportTicket {
  ticketId?: string;
  type: 'order_status' | 'refund' | 'technical' | 'general';
  orderId?: string;
  status?: 'open' | 'resolved' | 'escalated';
  description?: string;
  resolution?: string;
}

export interface SupportContext {
  ticketType?: 'order_status' | 'refund' | 'technical' | 'general';
  orderId?: string;
  ticket: SupportTicket;
  escalationLevel: number;
  resolved: boolean;
}

export class VoiceSupportAgent {
  private conversationService = getConversationService();
  private ttsService = getTTSService();

  /**
   * Start a new support conversation
   */
  async startConversation(callSid: string, callerNumber: string): Promise<VoiceAgentResponse> {
    const conversation = this.conversationService.createConversation({
      callSid,
      callerNumber,
      agentType: VoiceAgentType.SUPPORT,
      metadata: {
        ticketType: undefined,
        escalationLevel: 0,
        resolved: false
      }
    });

    const greeting = 'Thank you for calling ReZ customer support. I\'m here to help. Are you calling about an existing order, a refund or cancellation, or do you need technical assistance?';

    return this.generateResponse(conversation.id, greeting);
  }

  /**
   * Process user input during support conversation
   */
  async processInput(
    conversationId: string,
    userMessage: string,
    options?: {
      transcription?: { text: string; confidence: number };
    }
  ): Promise<VoiceAgentResponse> {
    const conversation = this.conversationService.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const metadata = conversation.metadata as Record<string, unknown>;
    const ticketType = metadata.ticketType as string;

    // Analyze intent
    const intent = this.analyzeIntent(userMessage, ticketType);

    // Route based on ticket type
    if (!ticketType && intent.type) {
      metadata.ticketType = intent.type;
      return this.handleTicketTypeSelection(conversation, intent.type);
    }

    switch (ticketType) {
      case 'order_status':
        return this.handleOrderStatus(conversation, userMessage, intent);
      case 'refund':
        return this.handleRefund(conversation, userMessage, intent);
      case 'technical':
        return this.handleTechnical(conversation, userMessage, intent);
      default:
        return this.handleGeneralSupport(conversation, userMessage, intent);
    }
  }

  /**
   * Analyze user intent
   */
  private analyzeIntent(message: string, currentType?: string): {
    type: 'order_status' | 'refund' | 'technical' | 'general';
    action: 'check' | 'cancel' | 'refund' | 'help' | 'escalate' | 'resolve' | 'general';
    orderId?: string;
    confidence: number;
  } {
    const lower = message.toLowerCase();

    // Determine ticket type
    let type: 'order_status' | 'refund' | 'technical' | 'general' = 'general';

    if (lower.includes('order') || lower.includes('package') ||
        lower.includes('booking') || lower.includes('delivery') || lower.includes('tracking')) {
      type = 'order_status';
    } else if (lower.includes('refund') || lower.includes('cancel') ||
               lower.includes('money back') || lower.includes('return')) {
      type = 'refund';
    } else if (lower.includes('not working') || lower.includes('error') ||
               lower.includes('problem') || lower.includes('issue') || lower.includes('broken')) {
      type = 'technical';
    }

    // Determine action
    let action: 'check' | 'cancel' | 'refund' | 'help' | 'escalate' | 'resolve' | 'general' = 'general';

    if (lower.includes('check') || lower.includes('where') || lower.includes('status')) {
      action = 'check';
    } else if (lower.includes('cancel')) {
      action = 'cancel';
    } else if (lower.includes('refund') || lower.includes('money back')) {
      action = 'refund';
    } else if (lower.includes('help') || lower.includes('information')) {
      action = 'help';
    } else if (lower.includes('supervisor') || lower.includes('manager') || lower.includes('human')) {
      action = 'escalate';
    } else if (lower.includes('resolved') || lower.includes('fixed') || lower.includes('working')) {
      action = 'resolve';
    }

    // Extract order ID if present
    const orderId = this.extractOrderId(message);

    return { type, action, orderId, confidence: 0.8 };
  }

  /**
   * Extract order ID from message
   */
  private extractOrderId(message: string): string | undefined {
    // Look for common order ID patterns
    const patterns = [
      /order\s*#?\s*([A-Z0-9]{6,})/i,
      /booking\s*#?\s*([A-Z0-9]{6,})/i,
      /([A-Z]{2,}[0-9]{4,})/
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Handle ticket type selection
   */
  private async handleTicketTypeSelection(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    type: string
  ): Promise<VoiceAgentResponse> {
    const responses: Record<string, string> = {
      order_status: 'You\'d like to check on an order. Can you please provide your order number or the email used for the booking?',
      refund: 'I can help with refunds and cancellations. Could you provide your order number and let me know the reason for the request?',
      technical: 'I\'m sorry you\'re experiencing technical issues. Can you describe the problem you\'re encountering?',
      general: 'How can I help you today? I can assist with order inquiries, refunds, or technical support.'
    };

    const response = responses[type] || responses.general;
    return this.generateResponse(conversation.id, response);
  }

  /**
   * Handle order status inquiries
   */
  private async handleOrderStatus(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    message: string,
    intent: ReturnType<typeof this.analyzeIntent>
  ): Promise<VoiceAgentResponse> {
    const metadata = conversation.metadata as Record<string, unknown>;

    // If we have an order ID, check status
    if (intent.orderId || metadata.orderId) {
      const orderId = intent.orderId || (metadata.orderId as string);

      // Simulate order status check
      const status = this.getMockOrderStatus(orderId);

      metadata.orderId = orderId;

      if (status.found) {
        const response = `I found your order ${orderId}. Status: ${status.status}. ${status.details}. Would you like me to help with anything else regarding this order?`;
        return this.generateResponse(conversation.id, response);
      } else {
        const response = 'I couldn\'t find an order with that number. Could you please verify the order number or provide the email used for the booking?';
        return this.generateResponse(conversation.id, response);
      }
    }

    // Ask for order ID
    const response = 'I\'d be happy to check your order status. Could you please provide your order number? It typically starts with REZ followed by numbers.';
    return this.generateResponse(conversation.id, response);
  }

  /**
   * Handle refund requests
   */
  private async handleRefund(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    message: string,
    intent: ReturnType<typeof this.analyzeIntent>
  ): Promise<VoiceAgentResponse> {
    const metadata = conversation.metadata as Record<string, unknown>;
    const escalationLevel = (metadata.escalationLevel as number) || 0;

    // Check if we have order info
    if (intent.orderId || metadata.orderId) {
      const orderId = intent.orderId || (metadata.orderId as string);
      const status = this.getMockOrderStatus(orderId);

      if (!status.found) {
        return this.generateResponse(conversation.id, 'I couldn\'t find that order. Could you verify the order number?');
      }

      // Check refund eligibility
      if (status.eligibleForRefund) {
        const response = `Your order ${orderId} is eligible for a refund. The refund typically takes 5-7 business days to process. Should I proceed with the refund request?`;
        return this.generateResponse(conversation.id, response);
      } else {
        if (escalationLevel >= 2) {
          const response = 'I understand your concern about the refund policy. Let me transfer you to a supervisor who can review your case and provide a solution.';
          this.conversationService.endConversation(conversation.id, 'escalated to supervisor');
          return {
            text: response,
            action: 'transfer',
            transferNumber: process.env.SUPPORT_SUPERVISOR_NUMBER,
            metadata: { conversationId: conversation.id }
          };
        }

        const response = `I'm sorry, but this order may not be eligible for a refund due to our policy. However, I understand this may be frustrating. Would you like me to escalate this to a supervisor for further review?`;
        metadata.escalationLevel = escalationLevel + 1;
        return this.generateResponse(conversation.id, response);
      }
    }

    const response = 'For refund requests, I\'ll need your order number. Could you please provide that?';
    return this.generateResponse(conversation.id, response);
  }

  /**
   * Handle technical support
   */
  private async handleTechnical(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    message: string,
    intent: ReturnType<typeof this.analyzeIntent>
  ): Promise<VoiceAgentResponse> {
    const lower = message.toLowerCase();
    const metadata = conversation.metadata as Record<string, unknown>;
    const escalationLevel = (metadata.escalationLevel as number) || 0;

    // Common technical issues and solutions
    const solutions: Record<string, string> = {
      'payment': 'For payment issues, please ensure your card details are correct and your bank hasn\'t blocked the transaction. You can also try an alternative payment method.',
      'login': 'For login issues, try resetting your password. If you continue to have trouble, I can help you contact our support team.',
      'booking': 'If you\'re having trouble completing a booking, try clearing your browser cache or using a different browser. Your progress should be saved.',
      'confirmation': 'Confirmation emails can sometimes take a few minutes to arrive. Please also check your spam folder. I can resend the confirmation if needed.'
    };

    // Check for specific issues
    for (const [issue, solution] of Object.entries(solutions)) {
      if (lower.includes(issue)) {
        const response = `${solution} Is there anything else I can help you with?`;
        return this.generateResponse(conversation.id, response);
      }
    }

    // Check if this needs escalation
    if (lower.includes('still') || lower.includes('not working') || intent.action === 'escalate') {
      if (escalationLevel >= 1) {
        const response = 'I understand this issue is frustrating. Let me transfer you to our technical team who can provide more specialized assistance.';
        this.conversationService.endConversation(conversation.id, 'transferred to technical');
        return {
          text: response,
          action: 'transfer',
          transferNumber: process.env.TECH_SUPPORT_NUMBER,
          metadata: { conversationId: conversation.id }
        };
      }

      metadata.escalationLevel = escalationLevel + 1;
      const response = 'I want to make sure we resolve this for you. Can you try a few quick steps - clear your browser cache, refresh the page, and try again? If it still doesn\'t work, I\'ll connect you with our technical team.';
      return this.generateResponse(conversation.id, response);
    }

    const response = 'I\'m sorry to hear you\'re having trouble. Can you describe the specific issue you\'re experiencing? For example, is it related to payment, login, or booking?';
    return this.generateResponse(conversation.id, response);
  }

  /**
   * Handle general support inquiries
   */
  private async handleGeneralSupport(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    message: string,
    intent: ReturnType<typeof this.analyzeIntent>
  ): Promise<VoiceAgentResponse> {
    const lower = message.toLowerCase();

    // Check for specific requests
    if (intent.action === 'escalate') {
      const response = 'I understand you\'d like to speak with someone. Let me transfer you to the next available representative.';
      return {
        text: response,
        action: 'transfer',
        transferNumber: process.env.SUPPORT_TRANSFER_NUMBER,
        metadata: { conversationId: conversation.id }
      };
    }

    if (lower.includes('hour') || lower.includes('open') || lower.includes('close')) {
      const response = 'Our customer support hours are Monday to Friday, 8 AM to 8 PM EST, and Saturday 9 AM to 5 PM EST. For urgent matters outside these hours, you can reach us by email.';
      return this.generateResponse(conversation.id, response);
    }

    if (lower.includes('email') || lower.includes('contact')) {
      const response = 'You can reach us by email at support@rez.com. For immediate assistance, I\'m here to help you now. What specific issue can I assist with?';
      return this.generateResponse(conversation.id, response);
    }

    if (lower.includes('bye') || lower.includes('goodbye') || lower.includes('thank you')) {
      const farewell = 'Thank you for calling ReZ support. Have a great day!';
      this.conversationService.endConversation(conversation.id, 'customer ended');
      return {
        text: farewell,
        action: 'hangup'
      };
    }

    // Default - clarify what they need help with
    const response = 'I\'m here to help! Are you calling about an existing order, a refund, or do you need technical assistance?';
    return this.generateResponse(conversation.id, response);
  }

  /**
   * Generate response with audio
   */
  private async generateResponse(conversationId: string, text: string): Promise<VoiceAgentResponse> {
    try {
      const synthesis = await this.ttsService.synthesize(text, {
        voiceId: process.env.ELEVENLABS_VOICE_SUPPORT
      });

      await this.conversationService.generateResponse(conversationId, text);

      return {
        text,
        audioUrl: synthesis.audioUrl,
        action: 'continue'
      };
    } catch (error) {
      logger.error('Failed to generate support response', { conversationId, error });
      return {
        text,
        action: 'continue'
      };
    }
  }

  /**
   * Mock order status lookup (replace with actual API call)
   */
  private getMockOrderStatus(orderId: string): {
    found: boolean;
    status: string;
    details: string;
    eligibleForRefund: boolean;
  } {
    // Simulate finding an order
    if (orderId && orderId.length >= 6) {
      return {
        found: true,
        status: 'In Transit',
        details: 'Your package is expected to arrive within 2-3 business days.',
        eligibleForRefund: false
      };
    }
    return { found: false, status: '', details: '', eligibleForRefund: false };
  }

  /**
   * Create support ticket
   */
  createTicket(conversationId: string, ticket: SupportTicket): string {
    const ticketId = `TKT-${Date.now()}-${randomUUID().replace(/-/g, '').substring(0, 4).toUpperCase()}`;

    const conversation = this.conversationService.getConversation(conversationId);
    if (conversation) {
      const metadata = conversation.metadata as Record<string, unknown>;
      metadata.ticket = { ...ticket, ticketId };
    }

    logger.info('Support ticket created', { ticketId, conversationId, ticket });
    return ticketId;
  }

  /**
   * Get ticket status
   */
  getTicketStatus(conversationId: string): SupportTicket | null {
    const conversation = this.conversationService.getConversation(conversationId);
    if (!conversation) return null;

    const metadata = conversation.metadata as Record<string, unknown>;
    return (metadata.ticket as SupportTicket) || null;
  }
}

// Singleton instance
let supportAgentInstance: VoiceSupportAgent | null = null;

export function getVoiceSupportAgent(): VoiceSupportAgent {
  if (!supportAgentInstance) {
    supportAgentInstance = new VoiceSupportAgent();
  }
  return supportAgentInstance;
}

export default VoiceSupportAgent;
