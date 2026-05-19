/**
 * REZ Care Service - Industry Expert Router
 *
 * Routes customer queries to the correct industry expert agent.
 * Falls back to REZ-support-copilot for generic queries.
 * Creates tickets when experts or AI can't resolve.
 */

import axios from 'axios';
import { logger } from '../utils/logger';

// Expert Service URLs
const EXPERT_URLS = {
  hospitality: process.env.HOSPITALITY_EXPERT_URL || 'http://localhost:3005',
  salon: process.env.SALON_EXPERT_URL || 'http://localhost:3006',
  fitness: process.env.FITNESS_EXPERT_URL || 'http://localhost:3007',
  health: process.env.HEALTH_EXPERT_URL || 'http://localhost:3008',
  education: process.env.EDUCATION_EXPERT_URL || 'http://localhost:3009',
  travel: process.env.TRAVEL_EXPERT_URL || 'http://localhost:3010',
  retail: process.env.RETAIL_EXPERT_URL || 'http://localhost:3011',
  culinary: process.env.CULINARY_EXPERT_URL || 'http://localhost:3012',
};

// Fallback AI
const COPILOT_URL = process.env.SUPPORT_COPILOT_URL || 'http://localhost:4033';

export interface ExpertContext {
  customerId?: string;
  sessionId?: string;
  platform: string;
  industry?: string;
  [key: string]: any;
}

export interface ExpertResponse {
  success: boolean;
  response: string;
  suggestions?: string[];
  actions?: string[];
  escalate?: boolean;
  ticketCreated?: boolean;
  ticketNumber?: string;
  source: 'expert' | 'copilot';
  expertType?: string;
  confidence: number;
}

export interface ExpertHealth {
  expert: string;
  healthy: boolean;
  latency?: number;
}

/**
 * Industry to Expert mapping
 */
const INDUSTRY_EXPERT_MAP: Record<string, string> = {
  // Hospitality
  hotel: 'hospitality',
  stay: 'hospitality',
  room: 'hospitality',
  resort: 'hospitality',
  guest: 'hospitality',
  checkin: 'hospitality',
  checkout: 'hospitality',
  booking: 'travel',

  // Salon & Beauty
  salon: 'salon',
  spa: 'salon',
  beauty: 'salon',
  haircut: 'salon',
  makeover: 'salon',
  skincare: 'salon',
  nail: 'salon',

  // Fitness
  gym: 'fitness',
  workout: 'fitness',
  fitness: 'fitness',
  exercise: 'fitness',
  training: 'fitness',
  yoga: 'fitness',

  // Health
  health: 'health',
  medical: 'health',
  clinic: 'health',
  doctor: 'health',
  prescription: 'health',

  // Education
  course: 'education',
  learning: 'education',
  tutorial: 'education',
  certification: 'education',
  training: 'education',
  exam: 'education',

  // Travel
  travel: 'travel',
  trip: 'travel',
  vacation: 'travel',
  flight: 'travel',
  destination: 'travel',

  // Retail
  shopping: 'retail',
  product: 'retail',
  store: 'retail',
  order: 'retail',
  return: 'retail',

  // Culinary
  food: 'culinary',
  recipe: 'culinary',
  restaurant: 'culinary',
  dining: 'culinary',
  menu: 'culinary',
};

/**
 * Category keywords for routing
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  hospitality: ['hotel', 'room', 'stay', 'checkin', 'checkout', 'reservation', 'booking', 'guest', 'suite', 'lobby', 'concierge', 'housekeeping', 'spa'],
  salon: ['salon', 'hair', 'beauty', 'spa', 'nail', 'makeup', 'stylist', 'facial', 'waxing'],
  fitness: ['gym', 'workout', 'fitness', 'exercise', 'training', 'yoga', 'pilates', 'gym'],
  health: ['health', 'medical', 'doctor', 'clinic', 'prescription', 'medicine', 'symptoms'],
  education: ['course', 'learn', 'study', 'tutorial', 'certification', 'exam', 'training', 'skills'],
  travel: ['travel', 'trip', 'vacation', 'flight', 'destination', 'itinerary', 'tourism'],
  retail: ['shopping', 'product', 'store', 'order', 'return', 'exchange', 'delivery'],
  culinary: ['food', 'recipe', 'restaurant', 'dining', 'menu', 'chef', 'cuisine', 'cooking'],
};

/**
 * Expert Router class
 */
export class ExpertRouter {
  /**
   * Route message to the correct expert or AI
   */
  async route(message: string, context: ExpertContext): Promise<ExpertResponse> {
    const lowerMessage = message.toLowerCase();

    // Step 1: Detect industry from message
    const detectedIndustry = this.detectIndustry(lowerMessage);

    // Step 2: Route to expert if detected
    if (detectedIndustry) {
      try {
        const expertResponse = await this.callExpert(detectedIndustry, message, context);
        if (expertResponse) {
          logger.info(`[ExpertRouter] Routed to ${detectedIndustry} expert`);
          return expertResponse;
        }
      } catch (error) {
        logger.warn(`[ExpertRouter] Expert ${detectedIndustry} failed, falling back to copilot`);
      }
    }

    // Step 3: Fallback to REZ-support-copilot
    return this.callCopilot(message, context);
  }

  /**
   * Detect industry from message keywords
   */
  private detectIndustry(message: string): string | null {
    for (const [industry, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (message.includes(keyword)) {
          return industry;
        }
      }
    }
    return null;
  }

  /**
   * Call industry expert
   */
  private async callExpert(
    expertType: string,
    message: string,
    context: ExpertContext
  ): Promise<ExpertResponse | null> {
    const expertUrl = EXPERT_URLS[expertType as keyof typeof EXPERT_URLS];
    if (!expertUrl) return null;

    try {
      const response = await axios.post(
        `${expertUrl}/chat`,
        {
          message,
          context: {
            customerId: context.customerId,
            sessionId: context.sessionId,
            platform: context.platform,
          },
        },
        {
          timeout: 8000,
        }
      );

      if (response.data) {
        return {
          success: true,
          response: response.data.message || response.data.response || response.data.reply,
          suggestions: response.data.suggestions,
          actions: response.data.actions,
          escalate: response.data.escalate || false,
          source: 'expert',
          expertType,
          confidence: response.data.confidence || 0.8,
        };
      }

      return null;
    } catch (error: any) {
      logger.warn(`[ExpertRouter] ${expertType} expert error: ${error.message}`);
      return null;
    }
  }

  /**
   * Call REZ-support-copilot as fallback
   */
  private async callCopilot(
    message: string,
    context: ExpertContext
  ): Promise<ExpertResponse> {
    try {
      const response = await axios.post(
        `${COPILOT_URL}/chat`,
        {
          message,
          context: {
            customerId: context.customerId,
            sessionId: context.sessionId,
            platform: context.platform,
          },
        },
        {
          timeout: 10000,
        }
      );

      if (response.data) {
        return {
          success: true,
          response: response.data.message || response.data.response || response.data.reply,
          suggestions: response.data.suggestions,
          actions: response.data.actions,
          escalate: response.data.escalate || false,
          source: 'copilot',
          confidence: response.data.confidence || 0.7,
        };
      }

      return {
        success: false,
        response: "I'm having trouble processing your request. Please try again.",
        source: 'copilot',
        confidence: 0,
      };
    } catch (error: any) {
      logger.error(`[ExpertRouter] Copilot error: ${error.message}`);
      return {
        success: false,
        response: "Service temporarily unavailable. Our team will contact you shortly.",
        source: 'copilot',
        confidence: 0,
      };
    }
  }

  /**
   * Check health of all experts
   */
  async checkExpertsHealth(): Promise<ExpertHealth[]> {
    const results: ExpertHealth[] = [];

    for (const [expert, url] of Object.entries(EXPERT_URLS)) {
      const start = Date.now();
      try {
        const response = await axios.get(`${url}/health`, { timeout: 3000 });
        results.push({
          expert,
          healthy: response.status === 200,
          latency: Date.now() - start,
        });
      } catch {
        results.push({ expert, healthy: false });
      }
    }

    return results;
  }

  /**
   * Get expert by industry
   */
  getExpertForIndustry(industry: string): string | null {
    return INDUSTRY_EXPERT_MAP[industry.toLowerCase()] || null;
  }
}

// Singleton instance
let routerInstance: ExpertRouter | null = null;

export function getExpertRouter(): ExpertRouter {
  if (!routerInstance) {
    routerInstance = new ExpertRouter();
  }
  return routerInstance;
}
