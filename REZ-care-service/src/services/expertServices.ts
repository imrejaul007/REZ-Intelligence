/**
 * REZ Care - Consolidated Expert Services
 *
 * Single service handling all 8 industry verticals:
 * - Hospitality (hotels, stays, resorts)
 * - Salon (beauty, spa, nails)
 * - Fitness (gym, workout, training)
 * - Health (medical, clinic)
 * - Education (courses, certifications)
 * - Travel (flights, destinations)
 * - Retail (shopping, products)
 * - Culinary (restaurant, recipes)
 */

import { logger } from '../utils/logger.js';

// Expert types
export type ExpertType = 'hospitality' | 'salon' | 'fitness' | 'health' | 'education' | 'travel' | 'retail' | 'culinary';

interface ExpertResponse {
  success: boolean;
  response: string;
  confidence: number;
  actions?: string[];
  escalate?: boolean;
  ticketCreated?: boolean;
}

// Industry keywords for routing
const INDUSTRY_KEYWORDS: Record<ExpertType, string[]> = {
  hospitality: ['hotel', 'room', 'stay', 'checkin', 'checkout', 'reservation', 'booking', 'guest', 'suite', 'lobby', 'concierge', 'housekeeping', 'spa', 'resort', 'accommodation', 'bed', 'pool', 'breakfast', 'checkout', 'upscale'],
  salon: ['salon', 'hair', 'beauty', 'spa', 'nail', 'makeup', 'stylist', 'facial', 'waxing', 'haircut', 'coloring', 'treatment', 'skincare', 'massage'],
  fitness: ['gym', 'workout', 'fitness', 'exercise', 'training', 'yoga', 'pilates', 'gym', 'personal trainer', 'membership', 'class', 'weights', 'cardio'],
  health: ['health', 'medical', 'doctor', 'clinic', 'prescription', 'medicine', 'symptoms', 'appointment', 'diagnosis', 'treatment', 'lab', 'test'],
  education: ['course', 'learn', 'study', 'tutorial', 'certification', 'exam', 'training', 'skills', 'class', 'lesson', 'student', 'instructor', 'online course'],
  travel: ['travel', 'trip', 'vacation', 'flight', 'destination', 'itinerary', 'tourism', 'booking', 'hotel booking', 'flight booking', 'airport', 'luggage'],
  retail: ['shopping', 'product', 'store', 'order', 'return', 'exchange', 'delivery', 'online shopping', 'cart', 'checkout', 'discount', 'offer'],
  culinary: ['food', 'recipe', 'restaurant', 'dining', 'menu', 'chef', 'cuisine', 'cooking', 'meal', 'dishes', 'ingredients', 'kitchen', 'table booking'],
};

// Domain-specific response templates
const EXPERT_RESPONSES: Record<ExpertType, {
  greeting: string;
  categories: string[];
  resolutions: Record<string, string>;
}> = {
  hospitality: {
    greeting: "Hello! I'm your hospitality concierge. I can help with hotel bookings, room issues, check-in/check-out, and more.",
    categories: ['booking', 'room', 'service', 'billing', 'cancellation'],
    resolutions: {
      booking: "I can help with your booking. Could you provide your booking reference?",
      room: "For room-related issues, I'll connect you with our housekeeping team.",
      service: "I'm sorry about the service issue. Let me flag this for immediate attention.",
      billing: "Let me review your billing details right away.",
      cancellation: "I understand. Our cancellation policy allows free cancellation within 24 hours of booking.",
    },
  },
  salon: {
    greeting: "Welcome to our beauty concierge! I can help with appointments, services, and treatments.",
    categories: ['appointment', 'service', 'booking', 'cancellation', 'feedback'],
    resolutions: {
      appointment: "I can help you book or modify your appointment.",
      service: "What specific service are you looking for?",
      booking: "Let me check available slots for you.",
      cancellation: "No problem. Can you tell me the reason for cancellation?",
      feedback: "Thank you for your feedback! We value your input.",
    },
  },
  fitness: {
    greeting: "Hey! I'm your fitness assistant. I can help with memberships, classes, and training programs.",
    categories: ['membership', 'class', 'trainer', 'facility', 'billing'],
    resolutions: {
      membership: "I can help you with membership plans and upgrades.",
      class: "Let me check class availability for you.",
      trainer: "We have excellent personal trainers available.",
      facility: "Our facilities include state-of-the-art equipment.",
      billing: "Let me review your billing and payment history.",
    },
  },
  health: {
    greeting: "Hello! I'm here to help with appointments, medical queries, and clinic services.",
    categories: ['appointment', 'consultation', 'prescription', 'records', 'billing'],
    resolutions: {
      appointment: "I can schedule an appointment with our specialists.",
      consultation: "What health concern would you like to discuss?",
      prescription: "For prescription refills, please consult your doctor.",
      records: "I can help you access your medical records.",
      billing: "Let me check your billing and insurance details.",
    },
  },
  education: {
    greeting: "Welcome to your learning assistant! I can help with courses, certifications, and training programs.",
    categories: ['course', 'certification', 'enrollment', 'completion', 'support'],
    resolutions: {
      course: "Let me help you find the right course for your goals.",
      certification: "I can assist with certification enrollment and preparation.",
      enrollment: "I can help you enroll in our programs.",
      completion: "Congratulations on your progress! Let me check your completion status.",
      support: "What academic support do you need?",
    },
  },
  travel: {
    greeting: "Hello! I'm your travel concierge. I can help with bookings, itineraries, and travel issues.",
    categories: ['booking', 'flight', 'hotel', 'itinerary', 'cancellation'],
    resolutions: {
      booking: "I can help modify or cancel your booking.",
      flight: "Let me check your flight status and options.",
      hotel: "I can assist with hotel reservations and modifications.",
      itinerary: "Let me review your travel itinerary.",
      cancellation: "I understand travel plans can change. Let me help with your cancellation.",
    },
  },
  retail: {
    greeting: "Hi! I'm your shopping assistant. I can help with orders, returns, and product inquiries.",
    categories: ['order', 'return', 'exchange', 'delivery', 'product'],
    resolutions: {
      order: "I can check your order status and details.",
      return: "Our return policy allows returns within 7 days.",
      exchange: "I can help you exchange items.",
      delivery: "Let me track your delivery for you.",
      product: "What product information do you need?",
    },
  },
  culinary: {
    greeting: "Welcome! I'm your culinary assistant. I can help with restaurant bookings, menus, and food queries.",
    categories: ['reservation', 'menu', 'order', 'feedback', 'dietary'],
    resolutions: {
      reservation: "I can help you book a table at our restaurant.",
      menu: "Let me explain our menu options to you.",
      order: "I can help you with food orders and customizations.",
      feedback: "Thank you for dining with us! We'll share your feedback with our chef.",
      dietary: "We accommodate all dietary requirements. What are your needs?",
    },
  },
};

/**
 * Expert Services - Consolidated Router
 */
export class ExpertServices {
  /**
   * Detect industry from message
   */
  detectIndustry(message: string): ExpertType | null {
    const lowerMessage = message.toLowerCase();

    for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerMessage.includes(keyword)) {
          return industry as ExpertType;
        }
      }
    }

    return null;
  }

  /**
   * Route to appropriate expert
   */
  async route(message: string, context: {
    customerId?: string;
    category?: string;
  }): Promise<ExpertResponse> {
    // Detect industry
    const industry = this.detectIndustry(message);

    if (industry) {
      return this.handleExpert(industry, message, context);
    }

    // Fallback to general support
    return {
      success: true,
      response: "I'm here to help! I specialize in hospitality, salon, fitness, health, education, travel, retail, and culinary support. What can I help you with today?",
      confidence: 0.5,
    };
  }

  /**
   * Handle expert-specific query
   */
  private async handleExpert(
    industry: ExpertType,
    message: string,
    context: { customerId?: string; category?: string }
  ): Promise<ExpertResponse> {
    const templates = EXPERT_RESPONSES[industry];
    const lowerMessage = message.toLowerCase();

    // Detect category from message
    let detectedCategory = context.category || 'service';
    for (const cat of templates.categories) {
      if (lowerMessage.includes(cat)) {
        detectedCategory = cat;
        break;
      }
    }

    // Check for escalation triggers
    const escalateKeywords = ['refund', 'lawsuit', 'manager', 'escalate', 'serious', 'emergency', 'hospital'];
    const shouldEscalate = escalateKeywords.some(k => lowerMessage.includes(k));

    // Generate response
    let response = templates.resolutions[detectedCategory] || templates.greeting;

    // Handle cancellation requests
    if (lowerMessage.includes('cancel')) {
      response = templates.resolutions.cancellation;
    }

    // Handle complaints
    if (lowerMessage.includes('complaint') || lowerMessage.includes('issue') || lowerMessage.includes('problem')) {
      response = "I'm sorry you're experiencing this issue. Let me help resolve it right away.";
    }

    return {
      success: true,
      response,
      confidence: 0.85,
      actions: [detectedCategory],
      escalate: shouldEscalate,
    };
  }

  /**
   * Get greeting for industry
   */
  getGreeting(industry: ExpertType): string {
    return EXPERT_RESPONSES[industry]?.greeting || "Hello! How can I help you today?";
  }

  /**
   * Get all available industries
   */
  getAvailableIndustries(): ExpertType[] {
    return Object.keys(INDUSTRY_KEYWORDS).map(k => k as ExpertType);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; industries: number }> {
    return {
      healthy: true,
      industries: this.getAvailableIndustries().length,
    };
  }
}

// Singleton
export const expertServices = new ExpertServices();
