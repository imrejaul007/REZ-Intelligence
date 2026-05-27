/**
 * Voice Sales Agent
 * Handles sales-related voice conversations for ReZ platform
 * Supports hotels, travel packages, and advertising services
 */

import { getConversationService } from '../services/conversationService';
import { getTTSService } from '../services/ttsService';
import { logger } from '../utils/logger.js';
import { VoiceAgentType, VoiceAgentResponse, ConversationState } from '../types';

export interface SalesLead {
  name?: string;
  phone?: string;
  email?: string;
  interest?: string;
  budget?: string;
  timeline?: string;
  notes?: string;
}

export interface SalesContext {
  productCategory?: 'hotels' | 'travel' | 'advertising';
  interestLevel?: 'high' | 'medium' | 'low';
  budget?: string;
  timeline?: string;
  lead: SalesLead;
  qualified: boolean;
  followUpRequired: boolean;
}

export class VoiceSalesAgent {
  private conversationService = getConversationService();
  private ttsService = getTTSService();

  /**
   * Start a new sales conversation
   */
  async startConversation(callSid: string, callerNumber: string): Promise<VoiceAgentResponse> {
    const conversation = this.conversationService.createConversation({
      callSid,
      callerNumber,
      agentType: VoiceAgentType.SALES,
      metadata: {
        productCategory: undefined,
        interestLevel: 'medium',
        qualified: false
      }
    });

    const greeting = 'Hello! Welcome to ReZ sales. I\'m your voice assistant and I\'m here to help you find the perfect product or service. Are you interested in hotels, travel packages, or advertising services?';

    return this.generateResponse(conversation.id, greeting);
  }

  /**
   * Process user input during sales conversation
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

    // Analyze intent and update context
    const intent = this.analyzeIntent(userMessage);
    this.updateSalesContext(conversation, intent);

    // Process based on intent
    switch (intent.action) {
      case 'qualify':
        return this.handleQualification(conversation, userMessage);
      case 'product_info':
        return this.handleProductInfo(conversation, intent);
      case 'pricing':
        return this.handlePricing(conversation, intent);
      case 'close':
        return this.handleClose(conversation, intent);
      case 'objection':
        return this.handleObjection(conversation, userMessage);
      case 'schedule':
        return this.handleSchedule(conversation, intent);
      default:
        return this.handleGeneralInquiry(conversation, userMessage);
    }
  }

  /**
   * Analyze user intent from message
   */
  private analyzeIntent(message: string): {
    action: 'qualify' | 'product_info' | 'pricing' | 'close' | 'objection' | 'schedule' | 'general';
    product?: string;
    confidence: number;
  } {
    const lower = message.toLowerCase();

    // Check for qualification questions
    if (lower.includes('when') || lower.includes('timeline') ||
        lower.includes('planning') || lower.includes('need it')) {
      return { action: 'qualify', confidence: 0.8 };
    }

    // Check for pricing questions
    if (lower.includes('price') || lower.includes('cost') || lower.includes('how much') ||
        lower.includes('budget') || lower.includes('expensive') || lower.includes('cheap')) {
      return { action: 'pricing', confidence: 0.9 };
    }

    // Check for product info requests
    if (lower.includes('what') || lower.includes('tell me about') ||
        lower.includes('features') || lower.includes('how does')) {
      return { action: 'product_info', confidence: 0.8 };
    }

    // Check for closing signals
    if (lower.includes('yes') || lower.includes('interested') ||
        lower.includes('sign up') || lower.includes('buy') || lower.includes('order')) {
      return { action: 'close', confidence: 0.85 };
    }

    // Check for objections
    if (lower.includes('no') || lower.includes('not sure') ||
        lower.includes('maybe') || lower.includes('think') || lower.includes('later')) {
      return { action: 'objection', confidence: 0.9 };
    }

    // Check for scheduling
    if (lower.includes('schedule') || lower.includes('appointment') ||
        lower.includes('demo') || lower.includes('meeting') || lower.includes('call back')) {
      return { action: 'schedule', confidence: 0.85 };
    }

    // Check for product categories
    if (lower.includes('hotel')) {
      return { action: 'general', product: 'hotels', confidence: 0.9 };
    }
    if (lower.includes('travel') || lower.includes('package')) {
      return { action: 'general', product: 'travel', confidence: 0.9 };
    }
    if (lower.includes('ad') || lower.includes('advertising') || lower.includes('marketing')) {
      return { action: 'general', product: 'advertising', confidence: 0.9 };
    }

    return { action: 'general', confidence: 0.5 };
  }

  /**
   * Update sales context based on intent
   */
  private updateSalesContext(
    conversation: ReturnType<typeof this.conversationService.getConversation>,
    intent: ReturnType<typeof this.analyzeIntent>
  ): void {
    if (!conversation) return;

    const metadata = conversation.metadata as Record<string, unknown>;

    if (intent.product) {
      metadata.productCategory = intent.product;
    }

    if (intent.action === 'close') {
      metadata.qualified = true;
      metadata.interestLevel = 'high';
    }

    if (intent.action === 'objection') {
      metadata.interestLevel = 'medium';
    }
  }

  /**
   * Handle qualification questions
   */
  private async handleQualification(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    message: string
  ): Promise<VoiceAgentResponse> {
    const lower = message.toLowerCase();
    const metadata = conversation.metadata as Record<string, unknown>;

    let response: string;

    if (lower.includes('when') || lower.includes('timeline')) {
      response = 'That\'s great that you\'re planning ahead! For hotels and travel, we recommend booking at least 2-4 weeks in advance for the best availability and rates. For advertising, we can typically start campaigns within 3-5 business days. What\'s your ideal timeline?';
    } else if (lower.includes('budget')) {
      response = 'Budget is important to understand so we can recommend the best options for you. For hotels, we have options ranging from budget-friendly to luxury. For advertising, packages start at competitive rates with flexible spending options. What range works for you?';
    } else {
      response = 'I\'d love to understand more about your needs. Are you looking for something specific, or would you like me to walk you through our main offerings?';
    }

    // Update context
    if (lower.includes('when') || lower.includes('planning')) {
      metadata.timeline = this.extractTimeline(message);
    }

    return this.generateResponse(conversation.id, response);
  }

  /**
   * Handle product information requests
   */
  private async handleProductInfo(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    intent: { product?: string }
  ): Promise<VoiceAgentResponse> {
    const metadata = conversation.metadata as Record<string, unknown>;
    const product = intent.product || (metadata.productCategory as string);

    let response: string;

    switch (product) {
      case 'hotels':
        response = 'ReZ partners with thousands of hotels worldwide. We offer exclusive rates, loyalty rewards, and flexible cancellation policies. Whether you need a single room or bulk bookings for your team, we can help. Would you like to know about specific destinations or amenities?';
        break;
      case 'travel':
        response = 'Our travel packages include flights, hotels, and curated experiences all in one booking. We offer significant savings compared to booking separately, plus 24/7 support during your trip. Are you planning a solo trip, family vacation, or business travel?';
        break;
      case 'advertising':
        response = 'AdBazaar by ReZ offers targeted advertising across our platform. We have millions of monthly active users in the hospitality and travel space. Options include banner ads, sponsored content, and data insights. What\'s your marketing goal?';
        break;
      default:
        response = 'ReZ offers three main services: hotels with exclusive rates, travel packages with bundled savings, and AdBazaar advertising. Which interests you most?';
    }

    return this.generateResponse(conversation.id, response);
  }

  /**
   * Handle pricing questions
   */
  private async handlePricing(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    intent: { product?: string }
  ): Promise<VoiceAgentResponse> {
    const metadata = conversation.metadata as Record<string, unknown>;
    const product = intent.product || (metadata.productCategory as string);

    let response: string;

    switch (product) {
      case 'hotels':
        response = 'Hotel pricing varies by location, dates, and star rating. We have options starting from budget-friendly rates to luxury properties. We also offer corporate rates for frequent travelers. Would you like me to check availability for specific dates?';
        break;
      case 'travel':
        response = 'Travel packages are priced based on destination, duration, and inclusions. We find that bundling typically saves 15-30% compared to booking separately. I can create a custom quote if you share your preferred destination and dates.';
        break;
      case 'advertising':
        response = 'AdBazaar offers flexible advertising budgets starting from competitive entry points. We can discuss options based on your marketing goals and target audience. Would you like to schedule a consultation with our advertising team?';
        break;
      default:
        response = 'I\'d be happy to discuss pricing! Could you tell me which service interests you - hotels, travel packages, or advertising?';
    }

    return this.generateResponse(conversation.id, response);
  }

  /**
   * Handle closing the sale
   */
  private async handleClose(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    intent: { product?: string }
  ): Promise<VoiceAgentResponse> {
    const metadata = conversation.metadata as Record<string, unknown>;
    const product = intent.product || (metadata.productCategory as string);

    // Mark as qualified
    metadata.qualified = true;
    metadata.followUpRequired = false;

    const responses: Record<string, string> = {
      hotels: 'Excellent! Let me get your details so we can check availability for your dates. What\'s the destination and when would you like to check in?',
      travel: 'Great choice! I\'d love to help plan your trip. Can you share your preferred destination, travel dates, and number of travelers?',
      advertising: 'Wonderful! Let me connect you with our advertising specialists who can create a custom campaign for you. Can I get your email to send over some options?',
      default: 'I\'d love to help you get started. What\'s the best way to reach you - by phone, email, or should I transfer you to complete the booking?'
    };

    const response = responses[product || 'default'] || responses.default;

    // Generate audio
    const synthesis = await this.ttsService.synthesize(response);

    return {
      text: response,
      audioUrl: synthesis.audioUrl,
      action: 'continue'
    };
  }

  /**
   * Handle objections
   */
  private async handleObjection(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    message: string
  ): Promise<VoiceAgentResponse> {
    const lower = message.toLowerCase();

    let response: string;

    if (lower.includes('not sure') || lower.includes('maybe') || lower.includes('think')) {
      response = 'That\'s completely understandable! Take your time. Would it help if I explained how others in similar situations have benefited? Or we could schedule a call for when you\'ve had a chance to think it over?';
    } else if (lower.includes('later') || lower.includes('no time')) {
      response = 'I completely understand you\'re busy. Let me take a moment of your time - our service can typically save you 20% or more on your bookings. Is there a better time I could call you back?';
    } else if (lower.includes('price') || lower.includes('expensive')) {
      response = 'I hear you on the budget. Let me see what options we have that might work better for you. We also offer payment plans for larger bookings. What\'s your comfort zone for spending?';
    } else {
      response = 'I appreciate you sharing that. Let me address your concern. Would you like me to explain more about our satisfaction guarantee or flexible policies?';
    }

    return this.generateResponse(conversation.id, response);
  }

  /**
   * Handle scheduling requests
   */
  private async handleSchedule(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    intent: { product?: string }
  ): Promise<VoiceAgentResponse> {
    const metadata = conversation.metadata as Record<string, unknown>;
    metadata.followUpRequired = true;

    const product = intent.product || (metadata.productCategory as string) || 'general';
    const response = `I'd be happy to schedule a consultation for you. For ${product} inquiries, one of our specialists can provide personalized recommendations. Would you like me to take your contact information, or should I transfer you to schedule directly?`;

    return this.generateResponse(conversation.id, response);
  }

  /**
   * Handle general inquiries
   */
  private async handleGeneralInquiry(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    message: string
  ): Promise<VoiceAgentResponse> {
    const lower = message.toLowerCase();

    // Simple pattern matching for common responses
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      return this.generateResponse(conversation.id, 'Hello! Great to hear from you. What can I help you with today?');
    }

    if (lower.includes('thank')) {
      return this.generateResponse(conversation.id, 'You\'re welcome! Is there anything else I can help you with?');
    }

    if (lower.includes('bye') || lower.includes('goodbye')) {
      const farewell = 'Thank you for calling ReZ sales. Have a wonderful day!';
      const synthesis = await this.ttsService.synthesize(farewell);

      this.conversationService.endConversation(conversation.id, 'customer ended');

      return {
        text: farewell,
        audioUrl: synthesis.audioUrl,
        action: 'hangup'
      };
    }

    // Default response
    const response = 'I\'m here to help with hotels, travel packages, or advertising. What would you like to know more about?';
    return this.generateResponse(conversation.id, response);
  }

  /**
   * Generate response with audio
   */
  private async generateResponse(conversationId: string, text: string): Promise<VoiceAgentResponse> {
    try {
      const synthesis = await this.ttsService.synthesize(text, {
        voiceId: process.env.ELEVENLABS_VOICE_SALES
      });

      // Add to conversation
      await this.conversationService.generateResponse(conversationId, text);

      return {
        text,
        audioUrl: synthesis.audioUrl,
        action: 'continue'
      };
    } catch (error) {
      logger.error('Failed to generate sales response', { conversationId, error });
      return {
        text,
        action: 'continue'
      };
    }
  }

  /**
   * Extract timeline from message
   */
  private extractTimeline(message: string): string {
    const lower = message.toLowerCase();

    if (lower.includes('asap') || lower.includes('immediately')) return 'immediate';
    if (lower.includes('week')) return 'within_week';
    if (lower.includes('month')) return 'within_month';
    if (lower.includes('next year') || lower.includes('202')) return 'next_year';

    return 'unknown';
  }

  /**
   * Check if lead is qualified
   */
  isLeadQualified(conversationId: string): boolean {
    const conversation = this.conversationService.getConversation(conversationId);
    if (!conversation) return false;

    const metadata = conversation.metadata as Record<string, unknown>;
    return !!(metadata.qualified);
  }

  /**
   * Get lead information
   */
  getLeadInfo(conversationId: string): SalesLead | null {
    const conversation = this.conversationService.getConversation(conversationId);
    if (!conversation) return null;

    const metadata = conversation.metadata as Record<string, unknown>;
    return (metadata.lead as SalesLead) || null;
  }
}

// Singleton instance
let salesAgentInstance: VoiceSalesAgent | null = null;

export function getVoiceSalesAgent(): VoiceSalesAgent {
  if (!salesAgentInstance) {
    salesAgentInstance = new VoiceSalesAgent();
  }
  return salesAgentInstance;
}

export default VoiceSalesAgent;
