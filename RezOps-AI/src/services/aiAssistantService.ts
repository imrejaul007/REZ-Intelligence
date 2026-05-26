import { v4 as uuidv4 } from 'uuid';
import { merchantService } from './merchantService.js';
import { llmService } from './llmService.js';
import type { 
  Message, 
  Conversation, 
  KnowledgeItem,
  Customer,
  Merchant 
} from '../types/index.js';
import { logger } from './utils/logger.js';

interface AIContext {
  merchant: Merchant;
  customer?: Customer;
  conversation: Conversation;
  recentMessages: Message[];
}

interface AIResponse {
  message: string;
  action?: 'send_message' | 'create_booking' | 'request_approval' | 'escalate' | 'none';
  data?: Record<string, unknown>;
  confidence: number;
  requiresApproval?: boolean;
}

export class AIAssistantService {
  async processMessage(
    merchantId: string,
    customerPhone: string,
    userMessage: string
  ): Promise<AIResponse> {
    const context = await this.buildContext(merchantId, customerPhone);
    
    if (!context) {
      return {
        message: "We're having some trouble. Please try again.",
        action: 'none',
        confidence: 0,
      };
    }

    try {
      // Get knowledge base for context
      const knowledgeItems = await merchantService.getKnowledgeBase(merchantId);
      const knowledgeContext = knowledgeItems.map(k => 
        k.question ? `${k.question}: ${k.answer}` : k.answer
      );

      // Build customer history
      const customerHistory = context.customer ? [
        `Total visits: ${context.customer.visitCount}`,
        context.customer.lastVisit ? `Last visit: ${new Date(context.customer.lastVisit).toLocaleDateString()}` : '',
        context.customer.totalSpent > 0 ? `Total spent: ₹${context.customer.totalSpent}` : '',
      ].filter(Boolean) : [];

      // Call LLM
      const response = await llmService.chat(
        [{ role: 'user', content: userMessage }],
        {
          customerName: context.customer?.name,
          businessName: context.merchant.businessName,
          customerHistory,
          knowledgeItems: knowledgeContext,
        }
      );

      // Determine action based on response
      const action = this.classifyAction(response.content);

      return {
        message: response.content,
        action,
        confidence: 0.9,
        requiresApproval: action === 'request_approval',
      };
    } catch (error) {
      logger.error('AI processing error', { error });
      return this.fallbackResponse();
    }
  }

  private async buildContext(merchantId: string, customerPhone: string): Promise<AIContext | null> {
    const merchant = await merchantService.getMerchant(merchantId);
    if (!merchant) return null;

    const customer = await merchantService.getCustomerByPhone(merchantId, customerPhone);
    const conversation = await merchantService.getOrCreateConversation(merchantId, customerPhone);

    return { merchant, customer: customer || undefined, conversation, recentMessages: [] };
  }

  private classifyAction(message: string): AIResponse['action'] {
    const msg = message.toLowerCase();
    
    if (msg.includes('book') || msg.includes('appointment') || msg.includes('slot')) {
      return 'create_booking';
    }
    
    if (msg.includes('refund') || msg.includes('discount') || msg.includes('cancel')) {
      return 'request_approval';
    }
    
    if (msg.includes('sorry') || msg.includes('manager') || msg.includes('escalate')) {
      return 'escalate';
    }
    
    return 'send_message';
  }

  private fallbackResponse(): AIResponse {
    return {
      message: "I'm not quite sure I understood that. Could you rephrase or ask something else?",
      action: 'send_message',
      confidence: 0.5,
    };
  }

  async getPersonalizedGreeting(customer: Customer, merchant: Merchant): Promise<string> {
    if (customer.visitCount === 0) {
      return `Welcome to ${merchant.businessName}! This is your first visit - we're excited to have you!`;
    }
    
    const visits = customer.visitCount;
    const ordinal = this.getOrdinal(visits);
    
    let greeting = `Welcome back to ${merchant.businessName}! `;
    greeting += `This is your ${ordinal} visit.`;
    
    if (customer.preferences && Object.keys(customer.preferences).length > 0) {
      if (customer.preferences.favoriteStaff) {
        greeting += ` Would you like ${customer.preferences.favoriteStaff} again?`;
      }
    }
    
    return greeting;
  }

  private getOrdinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  async logMessage(data: Omit<Message, 'messageId' | 'timestamp'>): Promise<Message> {
    const message: Message = {
      ...data,
      messageId: uuidv4(),
      timestamp: new Date().toISOString(),
    };
    
    const conversation = await merchantService.getConversation(data.conversationId);
    if (conversation) {
      await merchantService.updateConversation(data.conversationId, {
        lastMessage: data.content.substring(0, 100),
        lastMessageAt: message.timestamp,
        messageCount: conversation.messageCount + 1,
        aiHandled: data.sender === 'ai' ? true : undefined,
      });
    }
    
    logger.info(`Message logged`, { 
      messageId: message.messageId, 
      conversationId: data.conversationId,
      sender: data.sender 
    });
    
    return message;
  }
}

export const aiAssistantService = new AIAssistantService();
