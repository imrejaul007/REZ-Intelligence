/**
 * Response Templates
 * Pre-built response templates for common hospitality scenarios
 */

import { HospitalityIntent, SuggestedAction } from '../types/index';
import { ToneType, TONE_CONFIGS } from '../config/tone';

// ============================================
// RESPONSE TEMPLATES
// ============================================

export interface ResponseTemplate {
  id: string;
  intent: HospitalityIntent;
  scenario: string;
  templates: {
    initial: string;
    followUp?: string;
    confirmation?: string;
    apology?: string;
  };
  tone: ToneType;
}

export const RESPONSE_TEMPLATES: ResponseTemplate[] = [
  // Check-In Templates
  {
    id: 'checkin-standard',
    intent: HospitalityIntent.CHECK_IN,
    scenario: 'standard',
    templates: {
      initial: 'Welcome! I\'m delighted to assist with your check-in. Our standard check-in time is 3:00 PM. Would you like to start the process now, or do you need information about early check-in?',
      followUp: 'Do you have your confirmation number handy?',
      confirmation: 'Your check-in is complete. Room {roomNumber} is ready for you. Welcome!',
    },
    tone: ToneType.WELCOME,
  },
  {
    id: 'checkin-early',
    intent: HospitalityIntent.CHECK_IN,
    scenario: 'early-checkin',
    templates: {
      initial: 'I\'d be happy to help with early check-in! Let me check the availability of your room type for an early arrival.',
      followUp: 'Great news! Your room is ready. May I proceed with the early check-in?',
      confirmation: 'Your early check-in is confirmed. Your room is waiting for you now.',
      apology: 'I\'m sorry, your room isn\'t quite ready yet. Would you like to wait in the lobby, or explore our amenities while we prepare your room?',
    },
    tone: ToneType.WELCOME,
  },
  {
    id: 'checkin-vip',
    intent: HospitalityIntent.CHECK_IN,
    scenario: 'vip',
    templates: {
      initial: 'Welcome, {guestName}! It\'s an honor to have you with us. We\'ve prepared your {roomType} with your preferred amenities. Shall we proceed with a smooth check-in?',
      followUp: 'Your suite has been prepared according to your preferences. Is there anything specific you\'d like arranged?',
      confirmation: 'Everything is ready for you. Your personal concierge will be in touch shortly.',
    },
    tone: ToneType.WELCOME,
  },

  // Check-Out Templates
  {
    id: 'checkout-standard',
    intent: HospitalityIntent.CHECK_OUT,
    scenario: 'standard',
    templates: {
      initial: 'Thank you for staying with us! Standard check-out is at 11:00 AM. How may I assist with your departure?',
      followUp: 'Would you like me to arrange transportation for your departure?',
      confirmation: 'Your check-out is complete. We hope to welcome you back soon!',
    },
    tone: ToneType.PROFESSIONAL,
  },
  {
    id: 'checkout-late',
    intent: HospitalityIntent.CHECK_OUT,
    scenario: 'late-checkout',
    templates: {
      initial: 'I\'d be happy to check on late checkout options for you. Our standard late checkout is until 2:00 PM.',
      followUp: 'I\'ve extended your checkout to {time}. Is there anything else I can arrange?',
      confirmation: 'Your late checkout is confirmed. You may take your time this morning.',
      apology: 'I\'m sorry, a late checkout isn\'t available for today due to upcoming reservations. We can store your luggage while you wait.',
    },
    tone: ToneType.PROFESSIONAL,
  },

  // Room Service Templates
  {
    id: 'roomservice-order',
    intent: HospitalityIntent.ROOM_SERVICE,
    scenario: 'placing-order',
    templates: {
      initial: 'Our room service menu is available 24 hours. What would you like to order?',
      followUp: 'Would you like anything else with your order?',
      confirmation: 'Your order has been placed. Estimated delivery time is {time}. Room {roomNumber}, correct?',
    },
    tone: ToneType.PROFESSIONAL,
  },
  {
    id: 'roomservice-delivery',
    intent: HospitalityIntent.ROOM_SERVICE,
    scenario: 'delivery',
    templates: {
      initial: 'Your order is on its way! A server will arrive at your room shortly.',
      confirmation: 'Here\'s your order. Enjoy your meal! May I get you anything else?',
    },
    tone: ToneType.PROFESSIONAL,
  },

  // Housekeeping Templates
  {
    id: 'housekeeping-request',
    intent: HospitalityIntent.HOUSEKEEPING,
    scenario: 'request',
    templates: {
      initial: 'I\'ll arrange that for you right away. Housekeeping will be there within {time}.',
      followUp: 'Is there anything else you need during your stay?',
      confirmation: 'Done! {item} will be delivered to your room shortly.',
    },
    tone: ToneType.PROFESSIONAL,
  },
  {
    id: 'housekeeping-maintenance',
    intent: HospitalityIntent.HOUSEKEEPING,
    scenario: 'maintenance',
    templates: {
      initial: 'I\'m sorry to hear about the issue with {item}. Let me arrange for our maintenance team to take a look.',
      followUp: 'Would you like us to send someone now, or would you prefer to schedule a time?',
      confirmation: 'Maintenance has been notified. Someone will be there within 15 minutes.',
      apology: 'We apologize for unknown inconvenience. We\'re addressing this immediately.',
    },
    tone: ToneType.PROFESSIONAL,
  },

  // Complaint Templates
  {
    id: 'complaint-general',
    intent: HospitalityIntent.COMPLAINT,
    scenario: 'complaint',
    templates: {
      initial: 'I\'m truly sorry to hear about your experience. Please tell me what happened so I can help make this right.',
      followUp: 'Thank you for letting me know. I want to ensure we resolve this for you immediately.',
      confirmation: 'I\'ve noted your concern and taken immediate action. Here\'s what we\'re doing: {action}',
      apology: 'Please accept our sincere apologies for this situation. We take full responsibility.',
    },
    tone: ToneType.SYMPATHETIC,
  },

  // Dining Templates
  {
    id: 'dining-reservation',
    intent: HospitalityIntent.DINING,
    scenario: 'reservation',
    templates: {
      initial: 'I\'d be happy to make a reservation for you. Which restaurant would you prefer, and for what time?',
      followUp: 'For how many guests, and do you have unknown dietary requirements we should know about?',
      confirmation: 'Your reservation is confirmed: {restaurant} at {time} for {guests} guests. See you then!',
    },
    tone: ToneType.ENTHUSIASTIC,
  },

  // Amenity Templates
  {
    id: 'amenities-pool',
    intent: HospitalityIntent.AMENITIES,
    scenario: 'pool',
    templates: {
      initial: 'Our pool is open from 6 AM to 10 PM. Towels are available poolside, and we have complimentary sun loungers for you.',
      followUp: 'Would you like me to reserve a cabana for you?',
      confirmation: 'A cabana has been reserved for you. Enjoy your time by the pool!',
    },
    tone: ToneType.INFORMATIVE,
  },
  {
    id: 'amenities-spa',
    intent: HospitalityIntent.SPA_WELLNESS,
    scenario: 'spa',
    templates: {
      initial: 'Welcome to our spa sanctuary. We offer massages, facials, body treatments, and more. Would you like to see our treatment menu?',
      followUp: 'Our most popular treatments are the deep tissue massage and the signature facial. Which interests you?',
      confirmation: 'Your treatment is booked: {treatment} at {time}. We look forward to seeing you!',
    },
    tone: ToneType.REASSURING,
  },

  // Transportation Templates
  {
    id: 'transportation-airport',
    intent: HospitalityIntent.TRANSPORTATION,
    scenario: 'airport',
    templates: {
      initial: 'I can arrange transportation to the airport for you. We offer sedan and SUV options. Which would you prefer?',
      followUp: 'What time is your flight?',
      confirmation: 'Your transfer is arranged: {vehicle} pickup at {time} from {location}. The driver will meet you in the lobby.',
    },
    tone: ToneType.PROFESSIONAL,
  },

  // Emergency Templates
  {
    id: 'emergency-general',
    intent: HospitalityIntent.EMERGENCY,
    scenario: 'emergency',
    templates: {
      initial: 'I\'m concerned for your safety. I\'m immediately connecting you with our emergency response team. Please stay on the line.',
      followUp: 'Can you tell me your exact location and the nature of the emergency?',
      confirmation: 'Help is on the way. Please stay calm and stay on the line.',
    },
    tone: ToneType.REASSURING,
  },

  // Billing Templates
  {
    id: 'billing-inquiry',
    intent: HospitalityIntent.BILLING,
    scenario: 'inquiry',
    templates: {
      initial: 'I can help you review your charges. Let me pull up your account.',
      followUp: 'Do you have unknown questions about specific charges?',
      confirmation: 'Here\'s a summary of your charges: {summary}',
    },
    tone: ToneType.PROFESSIONAL,
  },

  // WiFi Templates
  {
    id: 'wifi-password',
    intent: HospitalityIntent.WiFi_TECHNICAL,
    scenario: 'password',
    templates: {
      initial: 'Our WiFi is complimentary for all guests. The network name is: {network}. The password is: {password}',
      followUp: 'Are you able to connect, or are you experiencing unknown issues?',
      confirmation: 'Great! If you have unknown issues connecting, please let me know.',
    },
    tone: ToneType.PROFESSIONAL,
  },
];

// ============================================
// RESPONSE GENERATOR
// ============================================

export class ResponseGenerator {
  /**
   * Generate response from template
   */
  generateFromTemplate(
    templateId: string,
    variables: Record<string, string>,
    type: 'initial' | 'followUp' | 'confirmation' | 'apology' = 'initial'
  ): string {
    const template = RESPONSE_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      return 'I\'m sorry, I couldn\'t process that request. Could you please rephrase?';
    }

    let response = template.templates[type];
    if (!response) {
      response = template.templates.initial;
    }

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      response = response.replace(new RegExp(`{${key}}`, 'g'), value);
    }

    return response;
  }

  /**
   * Get quick replies for an intent
   */
  getQuickReplies(intent: HospitalityIntent): string[] {
    const quickReplies: Record<HospitalityIntent, string[]> = {
      [HospitalityIntent.CHECK_IN]: ['Start check-in', 'Early check-in', 'Arrival info'],
      [HospitalityIntent.CHECK_OUT]: ['Express checkout', 'Late checkout', 'Store bags'],
      [HospitalityIntent.ROOM_SERVICE]: ['Breakfast menu', 'Order food', 'Late night'],
      [HospitalityIntent.HOUSEKEEPING]: ['Extra towels', 'Clean room', 'Turndown'],
      [HospitalityIntent.CONCIERGE]: ['Restaurant', 'Tour booking', 'Local info'],
      [HospitalityIntent.AMENITIES]: ['Pool hours', 'Spa info', 'Gym access'],
      [HospitalityIntent.DINING]: ['Reserve table', 'View menu', 'Room service'],
      [HospitalityIntent.SPA_WELLNESS]: ['Book treatment', 'View menu', 'Hours'],
      [HospitalityIntent.TRANSPORTATION]: ['Airport transfer', 'Taxi', 'Directions'],
      [HospitalityIntent.LOCAL_RECOMMENDATIONS]: ['Restaurants', 'Attractions', 'Shopping'],
      [HospitalityIntent.ROOM_UPGRADE]: ['View suites', 'Upgrade options', 'Pricing'],
      [HospitalityIntent.COMPLAINT]: ['Report issue', 'Speak to manager', 'Room change'],
      [HospitalityIntent.GENERAL_INQUIRY]: ['WiFi password', 'Front desk', 'Hotel info'],
      [HospitalityIntent.EMERGENCY]: ['Medical', 'Security', 'Stay on line'],
      [HospitalityIntent.BILLING]: ['View bill', 'Dispute charge', 'Payment'],
      [HospitalityIntent.WiFi_TECHNICAL]: ['Password', 'Connection help', 'Tech support'],
    };
    return quickReplies[intent] || ['Help', 'Start over'];
  }

  /**
   * Generate greeting based on time of day
   */
  generateGreeting(guestName?: string): string {
    const hour = new Date().getHours();
    let timeGreeting = 'Good evening';

    if (hour >= 5 && hour < 12) {
      timeGreeting = 'Good morning';
    } else if (hour >= 12 && hour < 17) {
      timeGreeting = 'Good afternoon';
    }

    if (guestName) {
      return `${timeGreeting}, ${guestName}! Welcome to our property. How may I assist you today?`;
    }

    return `${timeGreeting}! Welcome to our property. How may I assist you today?`;
  }

  /**
   * Generate farewell message
   */
  generateFarewell(guestName?: string, includeReturn = true): string {
    const base = guestName
      ? `Thank you, ${guestName}!`
      : 'Thank you for choosing our property!';

    if (includeReturn) {
      return `${base} We hope to welcome you back soon. Have a wonderful day!`;
    }

    return `${base} Have a wonderful day!`;
  }

  /**
   * Generate apology for service failure
   */
  generateApology(scenario: string): string {
    const apologies: Record<string, string> = {
      'room-not-ready': 'I sincerely apologize that your room isn\'t ready yet. I understand this is frustrating, and I\'m doing everything I can to expedite the process.',
      'service-delay': 'I\'m very sorry for the delay. Your comfort is our priority, and I\'m personally ensuring this is addressed immediately.',
      'facility-issue': 'Please accept our sincere apologies for unknown inconvenience with the facilities. We\'re working to resolve this as quickly as possible.',
      'unavailable': 'I\'m sorry, that service isn\'t available at the moment. Let me suggest an alternative that might work for you.',
    };

    return apologies[scenario] || 'I apologize for unknown inconvenience. How can I make this right for you?';
  }

  /**
   * Generate escalation acknowledgment
   */
  generateEscalationAcknowledge(): string {
    return 'I completely understand your concern, and I want to ensure this is properly addressed. I\'m connecting you with our guest relations manager who will personally take care of this for you.';
  }

  /**
   * Generate status update
   */
  generateStatusUpdate(action: string, status: 'in-progress' | 'completed' | 'scheduled', time?: string): string {
    switch (status) {
      case 'in-progress':
        return `${action} is being arranged now. You\'ll have an update shortly.`;
      case 'completed':
        return `Good news! ${action} has been completed. Is there anything else you need?`;
      case 'scheduled':
        return `${action} has been scheduled for ${time || 'the requested time'}. I\'ll confirm when it\'s done.`;
      default:
        return `I\'ve noted your request regarding ${action}.`;
    }
  }
}

/**
 * Generate a complete response with template, tone, and actions
 */
export function generateResponse(
  intent: HospitalityIntent,
  scenario: string,
  variables: Record<string, string>,
  options?: {
    tone?: ToneType;
    includeQuickReplies?: boolean;
  }
): {
  message: string;
  tone: ToneType;
  quickReplies?: string[];
} {
  const generator = new ResponseGenerator();

  // Find matching template
  const template = RESPONSE_TEMPLATES.find(
    t => t.intent === intent && (t.scenario === scenario || scenario === 'default')
  ) || RESPONSE_TEMPLATES.find(t => t.intent === intent);

  const tone = options?.tone || template?.tone || ToneType.PROFESSIONAL;

  let message = template
    ? generator.generateFromTemplate(template.id, variables)
    : variables.message || 'I\'m here to help. How may I assist you?';

  // Add tone-specific elements
  const toneConfig = TONE_CONFIGS[tone];
  if (toneConfig.example && !message.includes(toneConfig.example)) {
    // This is a fallback, normally we'd use the template
  }

  const quickReplies = options?.includeQuickReplies
    ? generator.getQuickReplies(intent)
    : undefined;

  return {
    message,
    tone,
    quickReplies,
  };
}

// Export singleton
export const responseGenerator = new ResponseGenerator();
