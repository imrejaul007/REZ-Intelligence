/**
 * Hospitality Intents Module
 * Defines and handles all hospitality-specific intents
 */

import { z } from 'zod';
import {
  HospitalityIntent,
  ConversationContext,
  ChatMessage,
  ServiceRequest,
  Priority,
  ServiceStatus,
} from '../types/index.js';
import { expertiseService } from '../services/expertise.js';
import { workflowService } from '../services/workflows.js';
import { recommendationsService } from '../services/recommendations.js';
import { selectTone, ToneType } from '../config/tone.js';
import { logger } from './utils/logger';

// ============================================
// INTENT HANDLERS
// ============================================

export interface IntentHandler {
  detect: (message: string) => { intent: HospitalityIntent; confidence: number };
  handle: (context: ConversationContext, message: string) => Promise<IntentResponse>;
  getTone: (sentiment?: 'positive' | 'negative' | 'neutral') => ToneType;
}

export interface IntentResponse {
  intent: HospitalityIntent;
  message: string;
  confidence: number;
  suggestedActions?: string[];
  quickReplies?: string[];
  metadata?: Record<string, unknown>;
  followUp?: string;
  serviceRequest?: Partial<ServiceRequest>;
}

// ============================================
// INTENT DETECTION
// ============================================

export class HospitalityIntents {
  /**
   * Detect intent from user message
   */
  detectIntent(message: string, context?: ConversationContext): {
    intent: HospitalityIntent;
    confidence: number;
    context: string[];
  } {
    // Use expertise service for detection
    return expertiseService.detectIntent(message);
  }

  /**
   * Handle intent and generate response
   */
  async handleIntent(
    intent: HospitalityIntent,
    context: ConversationContext,
    message: string
  ): Promise<IntentResponse> {
    const handler = this.getIntentHandler(intent);
    return handler.handle(context, message);
  }

  /**
   * Get handler for specific intent
   */
  private getIntentHandler(intent: HospitalityIntent): IntentHandler {
    const handlers: Record<HospitalityIntent, IntentHandler> = {
      [HospitalityIntent.CHECK_IN]: new CheckInIntentHandler(),
      [HospitalityIntent.CHECK_OUT]: new CheckOutIntentHandler(),
      [HospitalityIntent.ROOM_SERVICE]: new RoomServiceIntentHandler(),
      [HospitalityIntent.HOUSEKEEPING]: new HousekeepingIntentHandler(),
      [HospitalityIntent.CONCIERGE]: new ConciergeIntentHandler(),
      [HospitalityIntent.AMENITIES]: new AmenitiesIntentHandler(),
      [HospitalityIntent.DINING]: new DiningIntentHandler(),
      [HospitalityIntent.SPA_WELLNESS]: new SpaWellnessIntentHandler(),
      [HospitalityIntent.TRANSPORTATION]: new TransportationIntentHandler(),
      [HospitalityIntent.LOCAL_RECOMMENDATIONS]: new LocalRecommendationsIntentHandler(),
      [HospitalityIntent.ROOM_UPGRADE]: new RoomUpgradeIntentHandler(),
      [HospitalityIntent.COMPLAINT]: new ComplaintIntentHandler(),
      [HospitalityIntent.GENERAL_INQUIRY]: new GeneralInquiryIntentHandler(),
      [HospitalityIntent.EMERGENCY]: new EmergencyIntentHandler(),
      [HospitalityIntent.BILLING]: new BillingIntentHandler(),
      [HospitalityIntent.WiFi_TECHNICAL]: new WiFiTechnicalIntentHandler(),
    };

    return handlers[intent] || new GeneralInquiryIntentHandler();
  }
}

// ============================================
// INTENT HANDLER IMPLEMENTATIONS
// ============================================

class CheckInIntentHandler implements IntentHandler {
  detect(message: string): { intent: HospitalityIntent; confidence: number } {
    return expertiseService.detectIntent(message);
  }

  async handle(context: ConversationContext, message: string): Promise<IntentResponse> {
    const workflow = workflowService.getCheckInWorkflow();

    return {
      intent: HospitalityIntent.CHECK_IN,
      message: `Welcome! I'm delighted to assist with your check-in. Our standard check-in time is 3:00 PM. Would you like to start the check-in process now, or do you need information about early check-in options?`,
      confidence: 0.95,
      suggestedActions: ['Start Check-In', 'Early Check-In', 'Arrival Information'],
      quickReplies: ['I want to check in', 'Can I check in early?', 'What time can I check in?'],
      followUp: 'Do you have your confirmation number handy?',
    };
  }

  getTone(sentiment?: 'positive' | 'negative' | 'neutral'): ToneType {
    return selectTone(HospitalityIntent.CHECK_IN, sentiment);
  }
}

class CheckOutIntentHandler implements IntentHandler {
  detect(message: string): { intent: HospitalityIntent; confidence: number } {
    return expertiseService.detectIntent(message);
  }

  async handle(context: ConversationContext, message: string): Promise<IntentResponse> {
    const checkoutTime = '11:00 AM';
    const lateCheckoutTime = '2:00 PM (subject to availability)';

    return {
      intent: HospitalityIntent.CHECK_OUT,
      message: `Thank you for staying with us! Standard check-out is at ${checkoutTime}. If you need a late checkout, we can extend until ${lateCheckoutTime}. How may I assist with your departure?`,
      confidence: 0.95,
      suggestedActions: ['Express Checkout', 'Late Checkout', 'Bag Storage'],
      quickReplies: ['I want to check out', 'Can I get late checkout?', 'Store my bags'],
      followUp: 'Would you like me to arrange transportation for your departure?',
    };
  }

  getTone(sentiment?: 'positive' | 'negative' | 'neutral'): ToneType {
    return selectTone(HospitalityIntent.CHECK_OUT, sentiment);
  }
}

class RoomServiceIntentHandler implements IntentHandler {
  detect(message: string): { intent: HospitalityIntent; confidence: number } {
    return expertiseService.detectIntent(message);
  }

  async handle(context: ConversationContext, message: string): Promise<IntentResponse> {
    return {
      intent: HospitalityIntent.ROOM_SERVICE,
      message: `Our room service is available 24 hours. What would you like to order? We have a full menu available, or I can send you our menu for breakfast, lunch, or dinner.`,
      confidence: 0.92,
      suggestedActions: ['Breakfast Menu', 'All-Day Dining', 'Late Night Menu'],
      quickReplies: ['Order breakfast', 'Full menu please', 'Late night snacks'],
      followUp: 'Is there anything specific you\'re craving?',
    };
  }

  getTone(sentiment?: 'positive' | 'negative' | 'neutral'): ToneType {
    return selectTone(HospitalityIntent.ROOM_SERVICE, sentiment);
  }
}

class HousekeepingIntentHandler implements IntentHandler {
  detect(message: string): { intent: HospitalityIntent; confidence: number } {
    return expertiseService.detectIntent(message);
  }

  async handle(context: ConversationContext, message: string): Promise<IntentResponse> {
    return {
      intent: HospitalityIntent.HOUSEKEEPING,
      message: `I'm happy to help with your housekeeping needs. What can I arrange for you?`,
      confidence: 0.90,
      suggestedActions: ['Extra Towels', 'Room Cleaning', 'Extra Amenities', 'Turndown Service'],
      quickReplies: ['Extra towels please', 'Clean my room', 'More pillows', 'Evening turndown'],
      followUp: 'Should I have housekeeping come right away, or would you prefer a specific time?',
    };
  }

  getTone(sentiment?: 'positive' | 'negative' | 'neutral'): ToneType {
    return selectTone(HospitalityIntent.HOUSEKEEPING, sentiment);
  }
}

class ConciergeIntentHandler implements IntentHandler {
  detect(message: string): { intent: HospitalityIntent; confidence: number } {
    return expertiseService.detectIntent(message);
  }

  async handle(context: ConversationContext, message: string): Promise<IntentResponse> {
    const localRecs = recommendationsService.generateLocalRecommendations({
      timeOfDay: 'afternoon',
    });

    return {
      intent: HospitalityIntent.CONCIERGE,
      message: `As your concierge, I'm here to make your stay exceptional. Whether you need restaurant reservations, tour bookings, transportation, or local recommendations - I have you covered. What would be helpful?`,
      confidence: 0.88,
      suggestedActions: ['Restaurant Booking', 'Local Recommendations', 'Tour Bookings', 'Transportation'],
      quickReplies: ['Recommend a restaurant', 'Book a tour', 'Arrange transportation', 'What\'s nearby?'],
      followUp: 'Is there a particular type of experience you\'re looking for?',
    };
  }

  getTone(sentiment?: 'positive' | 'negative' | 'neutral'): ToneType {
    return selectTone(HospitalityIntent.CONCIERGE, sentiment);
  }
}

class AmenitiesIntentHandler implements IntentHandler {
  detect(message: string): { intent: HospitalityIntent; confidence: number } {
    return expertiseService.detectIntent(message);
  }

  async handle(context: ConversationContext, message: string): Promise<IntentResponse> {
    const amenities = expertiseService.getAmenityInfo();

    return {
      intent: HospitalityIntent.AMENITIES,
      message: `We have wonderful amenities for you to enjoy! Our fitness center is open 24 hours, the pool is available until 10 PM, and our spa welcomes you from 9 AM to 9 PM. What would you like to know more about?`,
      confidence: 0.85,
      suggestedActions: ['Pool Information', 'Spa & Wellness', 'Fitness Center', 'Kids Club'],
      quickReplies: ['When does the pool open?', 'Book a spa treatment', 'Gym information', 'Kids activities'],
      followUp: 'Are you interested in unknown particular amenities during your stay?',
    };
  }

  getTone(sentiment?: 'positive' | 'negative' | 'neutral'): ToneType {
    return selectTone(HospitalityIntent.AMENITIES, sentiment);
  }
}

class DiningIntentHandler implements IntentHandler {
  detect(message: string): { intent: HospitalityIntent; confidence: number } {
    return expertiseService.detectIntent(message);
  }

  async handle(context: ConversationContext, message: string): Promise<IntentResponse> {
    const diningRecs = recommendationsService.generateDiningRecommendations({
      timeOfDay: 'evening',
    });

    return {
      intent: HospitalityIntent.DINING,
      message: `We have excellent dining options! From casual poolside bites to fine dining at La Mer. I can make reservations, send you menus, or help you order room service. What would you prefer?`,
      confidence: 0.90,
      suggestedActions: ['Make Reservation', 'View Menus', 'Room Service', 'Special Dietary'],
      quickReplies: ['Reserve a table', 'Show me the menus', 'Order room service', 'I have dietary restrictions'],
      followUp: 'Do you have a preferred dining time?',
    };
  }

  getTone(sentiment?: 'positive' | 'negative' | 'neutral'): ToneType {
    return selectTone(HospitalityIntent.DINING, sentiment);
  }
}

class SpaWellnessIntentHandler implements IntentHandler {
  detect(message: string): { intent: HospitalityIntent; confidence: number } {
    return expertiseService.detectIntent(message);
  }

  async handle(context: ConversationContext, message: string): Promise<IntentResponse> {
    return {
      intent: HospitalityIntent.SPA_WELLNESS,
      message: `Welcome to our wellness sanctuary. We offer massage therapies, facials, body treatments, and more. Treatments are available from 9 AM to 9 PM. Would you like me to share our treatment menu or book an appointment?`,
      confidence: 0.88,
      suggestedActions: ['View Treatment Menu', 'Book Appointment', 'Spa Packages', 'Fitness Classes'],
      quickReplies: ['What treatments do you offer?', 'Book a massage', 'Couples spa package', 'Gym hours'],
      followUp: 'Are you interested in unknown specific treatment or would you like recommendations?',
    };
  }

  getTone(sentiment?: 'positive' | 'negative' | 'neutral'): ToneType {
    return selectTone(HospitalityIntent.SPA_WELLNESS, sentiment);
  }
}

class TransportationIntentHandler implements IntentHandler {
  detect(message: string): { intent: HospitalityIntent; confidence: number } {
    return expertiseService.detectIntent(message);
  }

  async handle(context: ConversationContext, message: string): Promise<IntentResponse> {
    return {
      intent: HospitalityIntent.TRANSPORTATION,
      message: `I can help arrange your transportation. We offer airport transfers, taxi service, car rentals, and valet parking. Where would you like to go, or what type of transportation do you need?`,
      confidence: 0.92,
      suggestedActions: ['Airport Transfer', 'Taxi Service', 'Car Rental', 'Valet Parking'],
      quickReplies: ['Book airport transfer', 'Call a taxi', 'Rent a car', 'Where is parking?'],
      followUp: 'What time would you like to depart?',
    };
  }

  getTone(sentiment?: 'positive' | 'negative' | 'neutral'): ToneType {
    return selectTone(HospitalityIntent.TRANSPORTATION, sentiment);
  }
}

class LocalRecommendationsIntentHandler implements IntentHandler {
  detect(message: string): { intent: HospitalityIntent; confidence: number } {
    return expertiseService.detectIntent(message);
  }

  async handle(context: ConversationContext, message: string): Promise<IntentResponse> {
    const recommendations = recommendationsService.generateLocalRecommendations({
      timeOfDay: 'afternoon',
    });

    return {
      intent: HospitalityIntent.LOCAL_RECOMMENDATIONS,
      message: `I'm excited to share our favorite local gems with you! From pristine beaches to hidden cafes and cultural attractions. What type of experience interests you - dining, adventure, shopping, or culture?`,
      confidence: 0.87,
      suggestedActions: ['Beaches', 'Restaurants', 'Attractions', 'Shopping'],
      quickReplies: ['Best beach nearby?', 'Restaurant recommendations', 'Local attractions', 'Good shopping?'],
      followUp: 'Are you looking for something romantic, family-friendly, or adventurous?',
    };
  }

  getTone(sentiment?: 'positive' | 'negative' | 'neutral'): ToneType {
    return selectTone(HospitalityIntent.LOCAL_RECOMMENDATIONS, sentiment);
  }
}

class RoomUpgradeIntentHandler implements IntentHandler {
  detect(message: string): { intent: HospitalityIntent; confidence: number } {
    return expertiseService.detectIntent(message);
  }

  async handle(context: ConversationContext, message: string): Promise<IntentResponse> {
    const currentRoom = context.reservation?.roomType || 'STANDARD';
    const upgrades = recommendationsService.generateRoomRecommendations({
      reservation: context.reservation,
      stayDuration: 1,
    });

    return {
      intent: HospitalityIntent.ROOM_UPGRADE,
      message: `I'd love to help enhance your stay! I can show you available upgrades from your current room. Would you like to see options for a better view, more space, or premium amenities?`,
      confidence: 0.85,
      suggestedActions: ['View Suites', 'Ocean View Options', 'Compare Rooms', 'Upgrade Benefits'],
      quickReplies: ['Show me suite options', 'Ocean view upgrade', 'What\'s included?', 'How much more?'],
      followUp: 'May I ask what\'s most important to you in an upgrade - the view, the size, or special amenities?',
      metadata: { availableUpgrades: upgrades },
    };
  }

  getTone(sentiment?: 'positive' | 'negative' | 'neutral'): ToneType {
    return selectTone(HospitalityIntent.ROOM_UPGRADE, sentiment);
  }
}

class ComplaintIntentHandler implements IntentHandler {
  detect(message: string): { intent: HospitalityIntent; confidence: number } {
    return expertiseService.detectIntent(message);
  }

  async handle(context: ConversationContext, message: string): Promise<IntentResponse> {
    return {
      intent: HospitalityIntent.COMPLAINT,
      message: `I'm truly sorry to hear you're experiencing an issue. Please tell me what happened, and I will do everything I can to make it right. Your comfort is our top priority.`,
      confidence: 0.88,
      suggestedActions: ['Report Issue', 'Speak to Manager', 'Request Refund', 'Room Change'],
      quickReplies: ['There\'s a problem with my room', 'I want to speak to a manager', 'Request compensation', 'Change my room'],
      followUp: 'Could you please share the details so I can assist you immediately?',
      serviceRequest: {
        priority: Priority.HIGH,
        status: ServiceStatus.PENDING,
      },
    };
  }

  getTone(sentiment?: 'positive' | 'negative' | 'neutral'): ToneType {
    return selectTone(HospitalityIntent.COMPLAINT, 'negative');
  }
}

class GeneralInquiryIntentHandler implements IntentHandler {
  detect(message: string): { intent: HospitalityIntent; confidence: number } {
    return expertiseService.detectIntent(message);
  }

  async handle(context: ConversationContext, message: string): Promise<IntentResponse> {
    return {
      intent: HospitalityIntent.GENERAL_INQUIRY,
      message: `I'm happy to help! I can assist with check-in/out, room service, dining reservations, spa bookings, local recommendations, transportation, and much more. How may I assist you today?`,
      confidence: 0.70,
      suggestedActions: ['Hotel Services', 'WiFi Info', 'Contact Info', 'Common Questions'],
      quickReplies: ['WiFi password', 'Front desk number', 'Restaurant hours', 'What services do you offer?'],
      followUp: 'Is there something specific I can help you with?',
    };
  }

  getTone(sentiment?: 'positive' | 'negative' | 'neutral'): ToneType {
    return selectTone(HospitalityIntent.GENERAL_INQUIRY, sentiment);
  }
}

class EmergencyIntentHandler implements IntentHandler {
  detect(message: string): { intent: HospitalityIntent; confidence: number } {
    return expertiseService.detectIntent(message);
  }

  async handle(context: ConversationContext, message: string): Promise<IntentResponse> {
    logger.error('Emergency intent detected', { message, context });

    return {
      intent: HospitalityIntent.EMERGENCY,
      message: `I'm concerned for your safety. I'm immediately connecting you with our emergency response team. Please stay on the line or tell me your exact location. For medical emergencies, our front desk can reach paramedics within minutes.`,
      confidence: 0.98,
      suggestedActions: ['Contact Emergency Services', 'Contact Security', 'Stay on Line', 'Share Location'],
      quickReplies: ['Medical emergency', 'Security issue', 'Fire emergency', 'I need help now'],
      followUp: 'Please provide your room number and describe the situation.',
      serviceRequest: {
        priority: Priority.URGENT,
        status: ServiceStatus.PENDING,
      },
    };
  }

  getTone(sentiment?: 'positive' | 'negative' | 'neutral'): ToneType {
    return ToneType.REASSURING;
  }
}

class BillingIntentHandler implements IntentHandler {
  detect(message: string): { intent: HospitalityIntent; confidence: number } {
    return expertiseService.detectIntent(message);
  }

  async handle(context: ConversationContext, message: string): Promise<IntentResponse> {
    return {
      intent: HospitalityIntent.BILLING,
      message: `I can help you with your billing questions. Would you like to review your current charges, understand a specific item, discuss payment options, or process your final bill?`,
      confidence: 0.90,
      suggestedActions: ['View Bill', 'Dispute Charge', 'Payment Options', 'Express Checkout'],
      quickReplies: ['Show my charges', 'Question about a charge', 'Payment methods', 'Pay my bill'],
      followUp: 'Are you looking at your current folio or final bill at checkout?',
    };
  }

  getTone(sentiment?: 'positive' | 'negative' | 'neutral'): ToneType {
    return selectTone(HospitalityIntent.BILLING, sentiment);
  }
}

class WiFiTechnicalIntentHandler implements IntentHandler {
  detect(message: string): { intent: HospitalityIntent; confidence: number } {
    return expertiseService.detectIntent(message);
  }

  async handle(context: ConversationContext, message: string): Promise<IntentResponse> {
    return {
      intent: HospitalityIntent.WiFi_TECHNICAL,
      message: `I'm here to help with your WiFi or technical issues. Our high-speed internet is complimentary for all guests. Would you like the WiFi password, help connecting, or technical support?`,
      confidence: 0.88,
      suggestedActions: ['Get WiFi Password', 'Connection Help', 'Tech Support', 'Restart Router'],
      quickReplies: ['What\'s the WiFi password?', 'Can\'t connect', 'Internet too slow', 'Reset my connection'],
      followUp: 'Are you having trouble connecting, or just need the password?',
    };
  }

  getTone(sentiment?: 'positive' | 'negative' | 'neutral'): ToneType {
    return selectTone(HospitalityIntent.WiFi_TECHNICAL, sentiment);
  }
}

// ============================================
// EXPORT
// ============================================

export const hospitalityIntents = new HospitalityIntents();
