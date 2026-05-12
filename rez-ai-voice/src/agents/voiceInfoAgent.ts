/**
 * Voice Info Agent
 * Handles general information inquiries for ReZ platform
 * Provides business hours, locations, policies, and product information
 */

import { getConversationService } from '../services/conversationService';
import { getTTSService } from '../services/ttsService';
import { logger } from '../utils/logger';
import { VoiceAgentType, VoiceAgentResponse } from '../types';

export interface LocationInfo {
  name: string;
  address: string;
  phone: string;
  hours: string;
  services: string[];
}

export interface BusinessHours {
  day: string;
  open: string;
  close: string;
  closed?: boolean;
}

export class VoiceInfoAgent {
  private conversationService = getConversationService();
  private ttsService = getTTSService();

  // Business information database
  private locations: LocationInfo[] = [
    {
      name: 'ReZ Headquarters',
      address: '123 Commerce Street, San Francisco, CA 94102',
      phone: '+1-800-555-REZ1',
      hours: 'Monday-Friday 9AM-6PM PST',
      services: ['Corporate', 'Sales', 'Support']
    },
    {
      name: 'ReZ New York Office',
      address: '456 Broadway, New York, NY 10013',
      phone: '+1-800-555-REZ2',
      hours: 'Monday-Friday 9AM-6PM EST',
      services: ['Sales', 'Partnerships']
    },
    {
      name: 'ReZ London Office',
      address: '78 Market Street, London, EC2A 2PS',
      phone: '+44-800-555-REZ1',
      hours: 'Monday-Friday 9AM-5PM GMT',
      services: ['Sales', 'Support', 'Partnerships']
    }
  ];

  private defaultHours: BusinessHours[] = [
    { day: 'Monday', open: '8:00 AM', close: '8:00 PM' },
    { day: 'Tuesday', open: '8:00 AM', close: '8:00 PM' },
    { day: 'Wednesday', open: '8:00 AM', close: '8:00 PM' },
    { day: 'Thursday', open: '8:00 AM', close: '8:00 PM' },
    { day: 'Friday', open: '8:00 AM', close: '8:00 PM' },
    { day: 'Saturday', open: '9:00 AM', close: '5:00 PM' },
    { day: 'Sunday', open: '10:00 AM', close: '4:00 PM', closed: false }
  ];

  /**
   * Start a new info conversation
   */
  async startConversation(callSid: string, callerNumber: string): Promise<VoiceAgentResponse> {
    const conversation = this.conversationService.createConversation({
      callSid,
      callerNumber,
      agentType: VoiceAgentType.INFO,
      metadata: {}
    });

    const greeting = 'Thank you for calling ReZ. I can provide information about our business hours, locations, products, and services. What would you like to know about?';

    return this.generateResponse(conversation.id, greeting);
  }

  /**
   * Process user input during info conversation
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

    const intent = this.analyzeIntent(userMessage);

    switch (intent.category) {
      case 'hours':
        return this.handleHoursInquiry(conversation, intent.specific);
      case 'location':
        return this.handleLocationInquiry(conversation, intent.specific);
      case 'products':
        return this.handleProductsInquiry(conversation, intent.specific);
      case 'services':
        return this.handleServicesInquiry(conversation, intent.specific);
      case 'contact':
        return this.handleContactInquiry(conversation, intent.specific);
      case 'policy':
        return this.handlePolicyInquiry(conversation, intent.specific);
      case 'careers':
        return this.handleCareersInquiry(conversation);
      default:
        return this.handleGeneralInquiry(conversation, userMessage);
    }
  }

  /**
   * Analyze user intent
   */
  private analyzeIntent(message: string): {
    category: 'hours' | 'location' | 'products' | 'services' | 'contact' | 'policy' | 'careers' | 'general';
    specific?: string;
    confidence: number;
  } {
    const lower = message.toLowerCase();

    // Hours
    if (lower.includes('hour') || lower.includes('open') || lower.includes('close') ||
        lower.includes('when') || lower.includes('available')) {
      if (lower.includes('saturday') || lower.includes('sunday') || lower.includes('weekend')) {
        return { category: 'hours', specific: 'weekend', confidence: 0.9 };
      }
      if (lower.includes('holiday')) {
        return { category: 'hours', specific: 'holiday', confidence: 0.9 };
      }
      return { category: 'hours', specific: 'general', confidence: 0.85 };
    }

    // Location
    if (lower.includes('address') || lower.includes('where') || lower.includes('location') ||
        lower.includes('office') || lower.includes('near')) {
      if (lower.includes('new york') || lower.includes('nyc')) {
        return { category: 'location', specific: 'new_york', confidence: 0.9 };
      }
      if (lower.includes('london') || lower.includes('uk')) {
        return { category: 'location', specific: 'london', confidence: 0.9 };
      }
      if (lower.includes('san francisco') || lower.includes('california') || lower.includes('headquarters')) {
        return { category: 'location', specific: 'sf', confidence: 0.9 };
      }
      return { category: 'location', specific: 'all', confidence: 0.8 };
    }

    // Products
    if (lower.includes('product') || lower.includes('what do you') ||
        lower.includes('offer') || lower.includes('service')) {
      if (lower.includes('hotel')) {
        return { category: 'products', specific: 'hotels', confidence: 0.9 };
      }
      if (lower.includes('travel') || lower.includes('package')) {
        return { category: 'products', specific: 'travel', confidence: 0.9 };
      }
      if (lower.includes('advertising') || lower.includes('ad')) {
        return { category: 'products', specific: 'advertising', confidence: 0.9 };
      }
      return { category: 'products', specific: 'all', confidence: 0.8 };
    }

    // Contact
    if (lower.includes('contact') || lower.includes('phone') ||
        lower.includes('email') || lower.includes('reach') || lower.includes('talk')) {
      return { category: 'contact', specific: 'general', confidence: 0.85 };
    }

    // Policy
    if (lower.includes('policy') || lower.includes('refund') ||
        lower.includes('cancel') || lower.includes('privacy') || lower.includes('terms')) {
      if (lower.includes('refund')) {
        return { category: 'policy', specific: 'refund', confidence: 0.9 };
      }
      if (lower.includes('cancel')) {
        return { category: 'policy', specific: 'cancellation', confidence: 0.9 };
      }
      if (lower.includes('privacy')) {
        return { category: 'policy', specific: 'privacy', confidence: 0.9 };
      }
      return { category: 'policy', specific: 'general', confidence: 0.8 };
    }

    // Careers
    if (lower.includes('job') || lower.includes('career') ||
        lower.includes('hire') || lower.includes('work')) {
      return { category: 'careers', confidence: 0.85 };
    }

    return { category: 'general', confidence: 0.5 };
  }

  /**
   * Handle hours inquiry
   */
  private async handleHoursInquiry(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    specific?: string
  ): Promise<VoiceAgentResponse> {
    let response: string;

    switch (specific) {
      case 'weekend':
        response = 'We\'re open on Saturdays from 9 AM to 5 PM, and Sundays from 10 AM to 4 PM. Please note that support may be limited on Sundays.';
        break;
      case 'holiday':
        response = 'We\'re closed on major holidays including New Year\'s Day, Independence Day, Thanksgiving, and Christmas. We may have limited hours on Christmas Eve and New Year\'s Eve.';
        break;
      default:
        response = 'Our regular business hours are Monday through Friday, 8 AM to 8 PM, Saturday 9 AM to 5 PM, and Sunday 10 AM to 4 PM. Would you like more specific information about weekend or holiday hours?';
    }

    return this.generateResponse(conversation.id, response);
  }

  /**
   * Handle location inquiry
   */
  private async handleLocationInquiry(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    specific?: string
  ): Promise<VoiceAgentResponse> {
    let response: string;

    if (specific === 'all') {
      response = 'We have offices in San Francisco, New York, and London. The San Francisco headquarters is our main office. Would you like the address and phone number for a specific location?';
    } else {
      const location = this.locations.find(l => {
        if (specific === 'sf') return l.name.includes('Headquarters');
        if (specific === 'new_york') return l.name.includes('New York');
        if (specific === 'london') return l.name.includes('London');
        return false;
      });

      if (location) {
        response = `${location.name} is located at ${location.address}. The phone number is ${location.phone}, and they\'re open ${location.hours}. They offer ${location.services.join(', ')} services.`;
      } else {
        response = 'I\'m sorry, I don\'t have information for that location. Our main offices are in San Francisco, New York, and London. Would you like details on one of these?';
      }
    }

    return this.generateResponse(conversation.id, response);
  }

  /**
   * Handle products inquiry
   */
  private async handleProductsInquiry(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    specific?: string
  ): Promise<VoiceAgentResponse> {
    let response: string;

    switch (specific) {
      case 'hotels':
        response = 'ReZ offers hotel booking services with access to over 100,000 properties worldwide. We provide exclusive rates, loyalty rewards, and flexible cancellation policies. You can book individual rooms or manage corporate travel accounts.';
        break;
      case 'travel':
        response = 'Our travel packages include flights, hotels, and curated experiences bundled together. We offer significant savings compared to booking separately, plus 24/7 support during your trip. Packages are available for solo travelers, families, and groups.';
        break;
      case 'advertising':
        response = 'AdBazaar is our advertising platform targeting the hospitality and travel industry. With millions of monthly active users, you can run targeted banner ads, sponsored content, and access detailed analytics. Packages start at competitive rates for businesses of all sizes.';
        break;
      default:
        response = 'ReZ offers three main services: hotel booking with exclusive rates, travel packages with bundled savings, and AdBazaar advertising. We also provide 24/7 customer support. Which would you like to know more about?';
    }

    return this.generateResponse(conversation.id, response);
  }

  /**
   * Handle services inquiry
   */
  private async handleServicesInquiry(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    specific?: string
  ): Promise<VoiceAgentResponse> {
    let response: string;

    switch (specific) {
      case 'support':
        response = 'Our support team is available 24/7 for urgent matters. For general inquiries, we\'re available during business hours. You can reach us by phone, email, or through our online chat. We also have a comprehensive help center with FAQs.';
        break;
      case 'loyalty':
        response = 'ReZ Rewards is our loyalty program where you earn points on every booking. Points can be redeemed for discounts, free nights, and exclusive perks. Members also get early access to sales and special promotions.';
        break;
      default:
        response = 'Our services include hotel booking, travel packages, advertising, 24/7 customer support, and a loyalty rewards program. We also offer corporate accounts for businesses with frequent travel needs.';
    }

    return this.generateResponse(conversation.id, response);
  }

  /**
   * Handle contact inquiry
   */
  private async handleContactInquiry(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    specific?: string
  ): Promise<VoiceAgentResponse> {
    const response = 'You can reach us by phone at 1-800-555-REZ1, or by email at info@rez.com. For sales inquiries, you can email sales@rez.com. For support, email support@rez.com. Would you like me to transfer you to speak with someone directly?';

    return this.generateResponse(conversation.id, response);
  }

  /**
   * Handle policy inquiry
   */
  private async handlePolicyInquiry(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    specific?: string
  ): Promise<VoiceAgentResponse> {
    let response: string;

    switch (specific) {
      case 'refund':
        response = 'Our refund policy varies by product. Hotel bookings may be refundable depending on the rate plan - flexible rates are typically fully refundable before check-in. Travel packages have specific cancellation windows. For exact details on your booking, please provide your order number.';
        break;
      case 'cancellation':
        response = 'You can cancel most bookings through your account or by contacting us. Cancellation policies depend on the rate type - flexible rates usually allow free cancellation up to 24 hours before check-in. Some promotional rates may be non-refundable. What type of booking do you have?';
        break;
      case 'privacy':
        response = 'We take your privacy seriously. We collect only necessary information to process your bookings and improve our services. We never sell your personal data. For complete details, please visit our privacy policy on our website.';
        break;
      default:
        response = 'Our policies cover booking terms, cancellation, refunds, and privacy. Which specific policy would you like to know about - cancellation, refund, or privacy?';
    }

    return this.generateResponse(conversation.id, response);
  }

  /**
   * Handle careers inquiry
   */
  private async handleCareersInquiry(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>
  ): Promise<VoiceAgentResponse> {
    const response = 'We\'re always looking for talented people to join our team! We have openings in engineering, sales, marketing, and customer support. You can view all current openings and apply at careers.rez.com. We offer competitive benefits and a great work environment.';

    return this.generateResponse(conversation.id, response);
  }

  /**
   * Handle general inquiry
   */
  private async handleGeneralInquiry(
    conversation: NonNullable<ReturnType<typeof this.conversationService.getConversation>>,
    message: string
  ): Promise<VoiceAgentResponse> {
    const lower = message.toLowerCase();

    // Simple pattern matching
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      return this.generateResponse(conversation.id, 'Hello! How can I help you today? I can provide information about our hours, locations, products, or connect you with the right department.');
    }

    if (lower.includes('thank')) {
      return this.generateResponse(conversation.id, 'You\'re welcome! Is there anything else I can help you with?');
    }

    if (lower.includes('bye') || lower.includes('goodbye')) {
      const farewell = 'Thank you for calling ReZ. Have a wonderful day!';
      this.conversationService.endConversation(conversation.id, 'customer ended');
      return {
        text: farewell,
        action: 'hangup'
      };
    }

    // Default response
    const response = 'I can help you with business hours, office locations, our products and services, contact information, and company policies. What would you like to know about?';
    return this.generateResponse(conversation.id, response);
  }

  /**
   * Generate response with audio
   */
  private async generateResponse(conversationId: string, text: string): Promise<VoiceAgentResponse> {
    try {
      const synthesis = await this.ttsService.synthesize(text, {
        voiceId: process.env.ELEVENLABS_VOICE_INFO
      });

      await this.conversationService.generateResponse(conversationId, text);

      return {
        text,
        audioUrl: synthesis.audioUrl,
        action: 'continue'
      };
    } catch (error) {
      logger.error('Failed to generate info response', { conversationId, error });
      return {
        text,
        action: 'continue'
      };
    }
  }

  /**
   * Get current business hours
   */
  getCurrentHours(): BusinessHours | null {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    return this.defaultHours.find(h => h.day === today) || null;
  }

  /**
   * Check if currently open
   */
  isCurrentlyOpen(): { open: boolean; message: string } {
    const currentHours = this.getCurrentHours();
    if (!currentHours) {
      return { open: false, message: 'Unable to determine current hours' };
    }

    if (currentHours.closed) {
      return { open: false, message: `We are currently closed. ${currentHours.day}s we are open from ${currentHours.open} to ${currentHours.close}.` };
    }

    // Simplified check - in production, would compare actual times
    const now = new Date();
    const openHour = parseInt(currentHours.open.split(':')[0]);
    const closeHour = parseInt(currentHours.close.split(':')[0]);

    if (now.getHours() >= openHour && now.getHours() < closeHour) {
      return { open: true, message: `We are currently open until ${currentHours.close}.` };
    }

    return { open: false, message: `We are currently closed. We open at ${currentHours.open}.` };
  }

  /**
   * Get all locations
   */
  getLocations(): LocationInfo[] {
    return this.locations;
  }
}

// Singleton instance
let infoAgentInstance: VoiceInfoAgent | null = null;

export function getVoiceInfoAgent(): VoiceInfoAgent {
  if (!infoAgentInstance) {
    infoAgentInstance = new VoiceInfoAgent();
  }
  return infoAgentInstance;
}

export default VoiceInfoAgent;
