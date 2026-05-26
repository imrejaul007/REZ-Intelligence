import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { randomInt } from 'crypto';
import {
  ALL_SERVICES,
  HAIR_SERVICES,
  NAIL_SERVICES,
  SKINCARE_SERVICES,
  BODY_SERVICES,
  MAKEUP_SERVICES,
  BROW_LASH_SERVICES,
  SKIN_TYPES,
  SalonService
} from '../config/knowledge';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...metadata }: { level: string; message: string; timestamp?: string; [key: string]: unknown }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0 && metadata.stack === undefined) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  if (metadata.stack) {
    msg += `\n${metadata.stack}`;
  }
  return msg;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat)
    }),
    new winston.transports.File({
      filename: 'logs/salon-agent-error.log',
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/salon-agent.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

export enum ServiceCategory {
  HAIR = 'hair',
  NAILS = 'nails',
  SKINCARE = 'skincare',
  BODY = 'body',
  MAKEUP = 'makeup',
  BROW_LASH = 'brow-lash'
}

export interface Appointment {
  id: string;
  serviceId: string;
  service: SalonService;
  clientId: string;
  clientName: string;
  stylistId: string;
  stylistName: string;
  dateTime: Date;
  duration: number;
  price: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  skinType?: string;
  allergies: string[];
  preferences: string[];
  visitCount: number;
  lastVisit: Date | null;
  notes: string[];
  tier: 'basic' | 'premium' | 'vip';
}

export interface Stylist {
  id: string;
  name: string;
  specialties: ServiceCategory[];
  bio: string;
  rating: number;
  reviewCount: number;
  available: boolean;
}

export interface SalonContext {
  client: Client | null;
  sessionId: string;
  conversationHistory: string[];
  currentService: SalonService | null;
  currentCategory: ServiceCategory | null;
  appointments: Appointment[];
  budget: number | null;
  preferredDate: Date | null;
}

export class SalonExpert {
  private readonly agentId: string;
  private readonly agentName: string;
  private appointments: Map<string, Appointment>;
  private clients: Map<string, Client>;
  private stylists: Map<string, Stylist>;
  private appointmentCounter: number;

  constructor(agentId?: string, agentName?: string) {
    this.agentId = agentId || uuidv4();
    this.agentName = agentName || 'Salon Expert';
    this.appointments = new Map();
    this.clients = new Map();
    this.stylists = new Map();
    this.appointmentCounter = 1000;
    this.initializeStylists();
    logger.info('Salon Expert initialized', { agentId: this.agentId, agentName: this.agentName });
  }

  private initializeStylists(): void {
    const sampleStylists: Stylist[] = [
      {
        id: 'stylist-001',
        name: 'Maya Rodriguez',
        specialties: [ServiceCategory.HAIR],
        bio: 'Senior colorist with 12 years of experience specializing in balayage and lived-in color.',
        rating: 4.9,
        reviewCount: 234,
        available: true
      },
      {
        id: 'stylist-002',
        name: 'James Chen',
        specialties: [ServiceCategory.SKINCARE],
        bio: 'Licensed esthetician certified in medical-grade facials and advanced skin treatments.',
        rating: 4.8,
        reviewCount: 189,
        available: true
      },
      {
        id: 'stylist-003',
        name: 'Sofia Kim',
        specialties: [ServiceCategory.NAILS],
        bio: 'Nail artist known for intricate nail art and flawless gel extensions.',
        rating: 4.9,
        reviewCount: 312,
        available: true
      },
      {
        id: 'stylist-004',
        name: 'Marcus Thompson',
        specialties: [ServiceCategory.BODY, ServiceCategory.MAKEUP],
        bio: 'Massage therapist and makeup artist for weddings and special events.',
        rating: 4.7,
        reviewCount: 156,
        available: true
      }
    ];

    for (const stylist of sampleStylists) {
      this.stylists.set(stylist.id, stylist);
    }
  }

  async processSalonQuery(
    context: SalonContext,
    message: string
  ): Promise<SalonResponse> {
    const startTime = Date.now();
    logger.info('Processing salon query', { sessionId: context.sessionId, messageLength: message.length });

    try {
      const intent = this.identifyIntent(message);
      const entities = this.extractEntities(message);

      let response: SalonResponse;

      switch (intent) {
        case 'book_appointment':
          response = await this.handleBooking(context, entities);
          break;
        case 'explore_services':
          response = await this.handleServiceExploration(context, entities);
          break;
        case 'service_details':
          response = await this.handleServiceDetails(context, entities);
          break;
        case 'check_availability':
          response = await this.handleAvailability(context, entities);
          break;
        case 'recommend_treatment':
          response = await this.handleRecommendations(context, entities);
          break;
        case 'skincare_advice':
          response = await this.handleSkincareAdvice(context, entities);
          break;
        case 'cancel_reschedule':
          response = await this.handleReschedule(context, entities);
          break;
        case 'allergy_check':
          response = await this.handleAllergyCheck(context, entities);
          break;
        case 'prep_guidance':
          response = await this.handlePrepGuidance(context, entities);
          break;
        default:
          response = await this.handleGeneralSalon(context, message);
      }

      response.processingTime = Date.now() - startTime;
      return response;

    } catch (error) {
      logger.error('Error processing salon query', { error, sessionId: context.sessionId });
      throw error;
    }
  }

  private identifyIntent(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (this.matches(lowerMessage, ['book', 'appointment', 'schedule', 'reserve', 'get a time'])) {
      return 'book_appointment';
    }
    if (this.matches(lowerMessage, ['services', 'what do you offer', 'treatments', 'what services', 'explore'])) {
      return 'explore_services';
    }
    if (this.matches(lowerMessage, ['details', 'tell me about', 'description', 'what is', 'includes', 'how long'])) {
      return 'service_details';
    }
    if (this.matches(lowerMessage, ['available', 'availability', 'openings', 'time slots', 'when can i'])) {
      return 'check_availability';
    }
    if (this.matches(lowerMessage, ['recommend', 'suggest', 'what would be good', 'help me choose'])) {
      return 'recommend_treatment';
    }
    if (this.matches(lowerMessage, ['skin', 'skincare', 'facial', 'skin type', 'acne', 'wrinkles'])) {
      return 'skincare_advice';
    }
    if (this.matches(lowerMessage, ['cancel', 'reschedule', 'change', 'move my appointment'])) {
      return 'cancel_reschedule';
    }
    if (this.matches(lowerMessage, ['allergy', 'allergic', 'sensitive', 'reaction', 'intolerance'])) {
      return 'allergy_check';
    }
    if (this.matches(lowerMessage, ['prepare', 'before', 'what to do', 'tips', 'bring'])) {
      return 'prep_guidance';
    }

    return 'general';
  }

  private matches(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private extractEntities(message: string): Record<string, unknown> {
    const entities: Record<string, unknown> = {};

    for (const service of ALL_SERVICES) {
      if (message.toLowerCase().includes(service.name.toLowerCase()) ||
          message.toLowerCase().includes(service.subcategory)) {
        entities.serviceId = service.id;
        entities.serviceName = service.name;
        break;
      }
    }

    const categoryKeywords: Record<string, ServiceCategory> = {
      'hair': ServiceCategory.HAIR,
      'haircut': ServiceCategory.HAIR,
      'color': ServiceCategory.HAIR,
      'nails': ServiceCategory.NAILS,
      'manicure': ServiceCategory.NAILS,
      'pedicure': ServiceCategory.NAILS,
      'facial': ServiceCategory.SKINCARE,
      'skincare': ServiceCategory.SKINCARE,
      'skin': ServiceCategory.SKINCARE,
      'massage': ServiceCategory.BODY,
      'body': ServiceCategory.BODY,
      'spa': ServiceCategory.BODY,
      'makeup': ServiceCategory.MAKEUP,
      'bridal': ServiceCategory.MAKEUP,
      'brow': ServiceCategory.BROW_LASH,
      'lash': ServiceCategory.BROW_LASH,
      'eyebrow': ServiceCategory.BROW_LASH
    };

    for (const [keyword, category] of Object.entries(categoryKeywords)) {
      if (message.toLowerCase().includes(keyword)) {
        entities.category = category;
        break;
      }
    }

    const dateMatch = message.match(/(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)/i);
    if (dateMatch) {
      entities.date = dateMatch[1].toLowerCase();
    }

    const priceMatch = message.match(/\$?\s*(\d{2,3})(?:\s*(?:-|to)\s*\$?\s*(\d{2,3}))?/);
    if (priceMatch) {
      entities.budget = parseInt(priceMatch[1]);
    }

    if (message.toLowerCase().includes('unknown') || message.toLowerCase().includes('no preference')) {
      entities.flexible = true;
    }

    return entities;
  }

  private async handleBooking(
    context: SalonContext,
    entities: Record<string, unknown>
  ): Promise<SalonResponse> {
    const serviceId = entities.serviceId as string;
    const service = serviceId ? ALL_SERVICES.find(s => s.id === serviceId) : null;

    if (!service) {
      return {
        success: true,
        message: "I'd be happy to help you book an appointment! Which service are you interested in?\n\nWe offer:\n- Hair Services (cuts, color, treatments)\n- Nail Services (manicures, pedicures, extensions)\n- Skin Care (facials, peels, microdermabrasion)\n- Body & Spa (massages, body wraps, waxing)\n- Makeup (bridal, special occasion)\n- Brow & Lash (shaping, tinting, extensions)",
        actions: [
          { type: 'show_categories', data: {} },
          { type: 'show_services', data: { category: entities.category } }
        ]
      };
    }

    let responseMessage = `Great choice! Let me tell you about our **${service.name}**:\n\n`;
    responseMessage += `**Duration:** ${service.duration} minutes\n`;
    responseMessage += `**Price:** $${service.price}`;
    if (service.priceRange) {
      responseMessage += ` ($${service.priceRange.min}-$${service.priceRange.max})`;
    }
    responseMessage += `\n\n**What's included:**\n`;
    for (const item of service.whatToExpect.slice(0, 4)) {
      responseMessage += `• ${item}\n`;
    }

    if (service.allergens && service.allergens.length > 0) {
      responseMessage += `\n**Please note:** This service may involve ${service.allergens.join(', ')}. Please inform us of unknown allergies before your appointment.\n`;
    }

    responseMessage += `\nWould you like me to find available times for this service?`;

    return {
      success: true,
      message: responseMessage,
      data: { service },
      actions: [
        { type: 'check_availability', data: { serviceId: service.id } },
        { type: 'show_stylists', data: { category: service.category } },
        { type: 'confirm_booking', data: { serviceId: service.id } }
      ]
    };
  }

  private async handleServiceExploration(
    context: SalonContext,
    entities: Record<string, unknown>
  ): Promise<SalonResponse> {
    const category = entities.category as ServiceCategory;
    let services: SalonService[];

    if (category) {
      switch (category) {
        case ServiceCategory.HAIR:
          services = HAIR_SERVICES;
          break;
        case ServiceCategory.NAILS:
          services = NAIL_SERVICES;
          break;
        case ServiceCategory.SKINCARE:
          services = SKINCARE_SERVICES;
          break;
        case ServiceCategory.BODY:
          services = BODY_SERVICES;
          break;
        case ServiceCategory.MAKEUP:
          services = MAKEUP_SERVICES;
          break;
        case ServiceCategory.BROW_LASH:
          services = BROW_LASH_SERVICES;
          break;
        default:
          services = ALL_SERVICES;
      }
    } else {
      services = ALL_SERVICES;
    }

    let responseMessage = '';

    if (category) {
      const categoryNames: Record<ServiceCategory, string> = {
        [ServiceCategory.HAIR]: 'Hair Services',
        [ServiceCategory.NAILS]: 'Nail Services',
        [ServiceCategory.SKINCARE]: 'Skin Care',
        [ServiceCategory.BODY]: 'Body & Spa',
        [ServiceCategory.MAKEUP]: 'Makeup',
        [ServiceCategory.BROW_LASH]: 'Brow & Lash'
      };
      responseMessage = `Here are our **${categoryNames[category]}**:\n\n`;
    } else {
      responseMessage = "Here's our full menu of services:\n\n";
    }

    const groupedServices = this.groupByCategory(services);

    for (const [cat, catServices] of Object.entries(groupedServices)) {
      responseMessage += `**${cat}:**\n`;
      for (const service of catServices) {
        responseMessage += `${service.name} - $${service.price} (${service.duration} min)\n`;
      }
      responseMessage += '\n';
    }

    responseMessage += "Which service catches your eye?";

    return {
      success: true,
      message: responseMessage,
      data: { services },
      actions: [
        { type: 'show_service_details', data: { services: services.map(s => s.id) } },
        { type: 'book_service', data: {} }
      ]
    };
  }

  private async handleServiceDetails(
    context: SalonContext,
    entities: Record<string, unknown>
  ): Promise<SalonResponse> {
    const serviceId = entities.serviceId as string;
    const service = serviceId ? ALL_SERVICES.find(s => s.id === serviceId) : null;

    if (!service) {
      return {
        success: true,
        message: "Which service would you like to know more about?",
        actions: [{ type: 'show_services', data: {} }]
      };
    }

    let responseMessage = `**${service.name}**\n\n`;
    responseMessage += `${service.description}\n\n`;
    responseMessage += `**Duration:** ${service.duration} minutes\n`;
    responseMessage += `**Price:** $${service.price}`;
    if (service.priceRange) {
      responseMessage += ` ($${service.priceRange.min}-$${service.priceRange.max})`;
    }
    responseMessage += `\n\n`;

    responseMessage += `**Benefits:**\n`;
    for (const benefit of service.benefits) {
      responseMessage += `• ${benefit}\n`;
    }
    responseMessage += `\n`;

    responseMessage += `**What to Expect:**\n`;
    for (const step of service.whatToExpect) {
      responseMessage += `• ${step}\n`;
    }
    responseMessage += `\n`;

    responseMessage += `**Aftercare Tips:**\n`;
    for (const tip of service.aftercareTips.slice(0, 4)) {
      responseMessage += `• ${tip}\n`;
    }

    if (service.allergens && service.allergens.length > 0) {
      responseMessage += `\n**Allergens/Ingredients:** ${service.allergens.join(', ')}\n`;
    }

    if (service.contraindications && service.contraindications.length > 0) {
      responseMessage += `\n**Not recommended for:** ${service.contraindications.join(', ')}\n`;
    }

    return {
      success: true,
      message: responseMessage,
      data: { service },
      actions: [
        { type: 'book_service', data: { serviceId: service.id } },
        { type: 'ask_about_allergies', data: {} },
        { type: 'show_similar_services', data: { category: service.category } }
      ]
    };
  }

  private async handleAvailability(
    context: SalonContext,
    entities: Record<string, unknown>
  ): Promise<SalonResponse> {
    const serviceId = entities.serviceId as string;
    const service = serviceId ? ALL_SERVICES.find(s => s.id === serviceId) : null;

    const availableSlots = this.generateAvailableSlots(service?.duration || 60);

    let responseMessage = '';

    if (service) {
      responseMessage = `**Available times for ${service.name} (${service.duration} minutes):**\n\n`;
    } else {
      responseMessage = `**Here are some available appointment slots:**\n\n`;
    }

    for (const slot of availableSlots) {
      const stylist = this.getRandomStylist(service?.category);
      responseMessage += `**${slot.day}, ${slot.date}**\n`;
      for (const time of slot.times) {
        responseMessage += `${time} with ${stylist?.name || 'Available Stylist'}\n`;
      }
      responseMessage += '\n';
    }

    responseMessage += "Which time works best for you?";

    return {
      success: true,
      message: responseMessage,
      data: { slots: availableSlots, service },
      actions: [
        { type: 'confirm_booking', data: {} },
        { type: 'show_stylists', data: {} }
      ]
    };
  }

  private async handleRecommendations(
    context: SalonContext,
    entities: Record<string, unknown>
  ): Promise<SalonResponse> {
    const category = entities.category as ServiceCategory;
    const budget = entities.budget as number;

    let services = category ? this.getServicesByCategory(category) : ALL_SERVICES;

    if (budget) {
      services = services.filter(s => s.price <= budget * 1.2);
    }

    if (context.client?.preferences) {
      services = services.sort((a, b) => {
        const aMatches = a.suitableFor.some(s => context.client!.preferences.some(p => p.includes(s)));
        const bMatches = b.suitableFor.some(s => context.client!.preferences.some(p => p.includes(s)));
        return bMatches ? 1 : -1;
      });
    }

    services = services.slice(0, 4);

    let responseMessage = "Based on what you've told me, here are my top recommendations:\n\n";

    for (const service of services) {
      responseMessage += `**${service.name}** - $${service.price}\n`;
      responseMessage += `${service.description.substring(0, 100)}...\n`;
      responseMessage += `Duration: ${service.duration} min\n\n`;
    }

    responseMessage += "Would you like to book unknown of these, or would you like more specific recommendations?";

    return {
      success: true,
      message: responseMessage,
      data: { services },
      actions: [
        { type: 'book_service', data: {} },
        { type: 'adjust_budget', data: {} },
        { type: 'show_more_options', data: {} }
      ]
    };
  }

  private async handleSkincareAdvice(
    context: SalonContext,
    entities: Record<string, unknown>
  ): Promise<SalonResponse> {
    const skinType = context.client?.skinType;
    const typeInfo = skinType ? SKIN_TYPES.find(t => t.id === skinType) : null;

    let responseMessage = '';

    if (typeInfo) {
      responseMessage = `Based on your ${typeInfo.name} skin, here's what I'd recommend:\n\n`;
      responseMessage += `**Your skin characteristics:**\n`;
      for (const char of typeInfo.characteristics) {
        responseMessage += `• ${char}\n`;
      }
      responseMessage += `\n**Common concerns:**\n`;
      for (const concern of typeInfo.concerns) {
        responseMessage += `• ${concern}\n`;
      }
      responseMessage += `\n**Recommended treatments:**\n`;

      const recommendedServices = SKINCARE_SERVICES.filter(service =>
        service.suitableFor.some(sf => sf.includes('All skin types') || typeInfo.name.includes('All'))
      ).slice(0, 3);

      for (const service of recommendedServices) {
        responseMessage += `• ${service.name} - $${service.price} (${service.duration} min)\n`;
      }
    } else {
      responseMessage = "I'd love to help you find the perfect skincare routine!\n\n";
      responseMessage += "First, let's understand your skin type. Which best describes your skin?\n\n";
      responseMessage += "**Normal:** Balanced, few imperfections\n";
      responseMessage += "**Dry:** Tight, dull, flaky patches\n";
      responseMessage += "**Oily:** Shiny, enlarged pores, prone to breakouts\n";
      responseMessage += "**Combination:** Oily T-zone, dry cheeks\n";
      responseMessage += "**Sensitive:** Easily irritated, redness\n\n";
      responseMessage += "Or tell me about your main skin concerns and I can recommend treatments!";

      return {
        success: true,
        message: responseMessage,
        data: { skinTypes: SKIN_TYPES },
        actions: [
          { type: 'identify_skin_type', data: {} },
          { type: 'recommend_treatment', data: {} }
        ]
      };
    }

    return {
      success: true,
      message: responseMessage,
      data: { skinType: typeInfo },
      actions: [
        { type: 'book_facial', data: {} },
        { type: 'show_skin_products', data: {} },
        { type: 'ask_about_concerns', data: {} }
      ]
    };
  }

  private async handleReschedule(
    context: SalonContext,
    entities: Record<string, unknown>
  ): Promise<SalonResponse> {
    const appointments = context.appointments.filter(a => a.status !== 'cancelled');

    if (appointments.length === 0) {
      return {
        success: true,
        message: "I don't see unknown appointments to reschedule. Would you like to book a new service?",
        actions: [
          { type: 'book_service', data: {} },
          { type: 'show_services', data: {} }
        ]
      };
    }

    let responseMessage = "Here are your current appointments:\n\n";
    for (const appt of appointments) {
      responseMessage += `**${appt.service.name}**\n`;
      responseMessage += `${new Date(appt.dateTime).toLocaleDateString()} at ${new Date(appt.dateTime).toLocaleTimeString()}\n`;
      responseMessage += `With ${appt.stylistName}\n\n`;
    }

    responseMessage += "Which appointment would you like to reschedule or cancel?";

    return {
      success: true,
      message: responseMessage,
      data: { appointments },
      actions: [
        { type: 'reschedule_appointment', data: {} },
        { type: 'cancel_appointment', data: {} }
      ]
    };
  }

  private async handleAllergyCheck(
    context: SalonContext,
    entities: Record<string, unknown>
  ): Promise<SalonResponse> {
    const serviceId = entities.serviceId as string;
    const service = serviceId ? ALL_SERVICES.find(s => s.id === serviceId) : null;

    if (!service) {
      return {
        success: true,
        message: "To help you understand unknown potential allergens in our services, could you tell me which service you're interested in?\n\nAlternatively, here are common allergens used in salon services:\n\n**Hair:** Ammonia, PPD (in hair color), Formaldehyde (in keratin treatments)\n\n**Nails:** Methacrylate, HEMA (in gel/acrylic), Acetone\n\n**Skincare:** Alpha Hydroxy Acids, Retinoids, Essential oils\n\n**General:** Latex (gloves), Fragrances",
        actions: [
          { type: 'check_service_allergens', data: {} },
          { type: 'show_allergen_free_options', data: {} }
        ]
      };
    }

    let responseMessage = `**${service.name} - Allergen Information:**\n\n`;

    if (service.allergens && service.allergens.length > 0) {
      responseMessage += `This service may involve:\n`;
      for (const allergen of service.allergens) {
        responseMessage += `• ${allergen}\n`;
      }
      responseMessage += `\nPlease inform us of unknown allergies before your appointment.\n`;
    } else {
      responseMessage += `This service has no common allergens to note.\n`;
    }

    if (context.client?.allergies.length) {
      responseMessage += `\n**Your recorded allergies:** ${context.client.allergies.join(', ')}\n`;
    }

    responseMessage += `\nIs there anything specific you're allergic to that we should know about?`;

    return {
      success: true,
      message: responseMessage,
      data: { service, allergens: service.allergens || [] },
      actions: [
        { type: 'book_with_allergy_note', data: { serviceId: service.id } },
        { type: 'find_alternative_service', data: { category: service.category } }
      ]
    };
  }

  private async handlePrepGuidance(
    context: SalonContext,
    entities: Record<string, unknown>
  ): Promise<SalonResponse> {
    const serviceId = entities.serviceId as string;
    const service = serviceId ? ALL_SERVICES.find(s => s.id === serviceId) : null;

    if (!service) {
      return {
        success: true,
        message: "For which service would you like preparation tips?",
        actions: [{ type: 'show_services', data: {} }]
      };
    }

    let responseMessage = `**Preparing for your ${service.name}:**\n\n`;

    if (service.category === 'hair') {
      responseMessage += `**Before your appointment:**\n`;
      responseMessage += `• Wash your hair the day before, not day of\n`;
      responseMessage += `• Avoid heavy styling products\n`;
      responseMessage += `• Bring reference photos if you have a specific look in mind\n`;
      responseMessage += `• Consider bringing your own hair accessories if desired\n\n`;
      responseMessage += `**Day of:**\n`;
      responseMessage += `• Don't wash your hair before coming\n`;
      responseMessage += `• Wear a shirt you can change out of easily\n`;
      responseMessage += `• Remove unknown hair clips or elastics\n`;
    } else if (service.category === 'skincare') {
      responseMessage += `**Before your appointment:**\n`;
      responseMessage += `• Avoid retinoids and exfoliants for 3-5 days\n`;
      responseMessage += `• Stay hydrated\n`;
      responseMessage += `• Remove makeup before arriving if possible\n`;
      responseMessage += `• Inform us of unknown skin changes since your last visit\n\n`;
      responseMessage += `**Day of:**\n`;
      responseMessage += `• Arrive with clean skin if possible\n`;
      responseMessage += `• Wear comfortable clothing\n`;
      responseMessage += `• Avoid applying makeup after your treatment\n`;
    } else if (service.category === 'nails') {
      responseMessage += `**Before your appointment:**\n`;
      responseMessage += `• Remove old nail polish at home if preferred\n`;
      responseMessage += `• Avoid cutting your own nails\n`;
      responseMessage += `• Bring inspiration photos for nail art if desired\n\n`;
      responseMessage += `**Day of:**\n`;
      responseMessage += `• Arrive with clean, product-free nails\n`;
      responseMessage += `• Wear comfortable, loose clothing\n`;
      responseMessage += `• Plan for dry time after gel or polish\n`;
    } else if (service.category === 'makeup') {
      responseMessage += `**Before your appointment:**\n`;
      responseMessage += `• Exfoliate and moisturize your skin\n`;
      responseMessage += `• Have your outfit and accessories ready to show\n`;
      responseMessage += `• Bring your regular makeup if you'd like us to enhance your routine\n`;
      responseMessage += `• For bridal, schedule a trial 2-4 weeks before the event\n\n`;
      responseMessage += `**Day of:**\n`;
      responseMessage += `• Wear a button-down or loose top\n`;
      responseMessage += `• Don't apply unknown makeup\n`;
      responseMessage += `• Have blotting papers ready for events\n`;
    }

    responseMessage += `**General tips:**\n`;
    responseMessage += `• Stay hydrated before and after\n`;
    responseMessage += `• Let us know if anything feels uncomfortable\n`;
    responseMessage += `• Plan to arrive 5-10 minutes early\n`;

    return {
      success: true,
      message: responseMessage,
      data: { service },
      actions: [
        { type: 'book_service', data: { serviceId: service.id } },
        { type: 'ask_questions', data: {} }
      ]
    };
  }

  private async handleGeneralSalon(
    context: SalonContext,
    entities: Record<string, unknown>,
    message: string
  ): Promise<SalonResponse> {
    const greeting = this.isGreeting(message);

    if (greeting) {
      return {
        success: true,
        message: "Hello, welcome! I'm your REZ Salon Expert, here to help you discover perfect beauty services and book appointments.\n\nI can help you with:\n- Finding the right services for you\n- Booking appointments\n- Understanding treatments and what to expect\n- Skincare recommendations\n- Preparation tips\n\nWhat brings you in today?",
        actions: [
          { type: 'show_categories', data: {} },
          { type: 'book_service', data: {} },
          { type: 'recommend_treatment', data: {} }
        ]
      };
    }

    return {
      success: true,
      message: "I'd love to help you find the perfect beauty treatment! Could you tell me:\n\n- What you're looking for (a specific service or just exploring)\n- Any occasion or event you're preparing for\n- Your budget range\n- Any allergies or sensitivities we should know about\n\nOr browse our services below!",
      actions: [
        { type: 'show_categories', data: {} },
        { type: 'show_popular_services', data: {} },
        { type: 'show_special_offers', data: {} }
      ]
    };
  }

  private getServicesByCategory(category: ServiceCategory): SalonService[] {
    switch (category) {
      case ServiceCategory.HAIR:
        return HAIR_SERVICES;
      case ServiceCategory.NAILS:
        return NAIL_SERVICES;
      case ServiceCategory.SKINCARE:
        return SKINCARE_SERVICES;
      case ServiceCategory.BODY:
        return BODY_SERVICES;
      case ServiceCategory.MAKEUP:
        return MAKEUP_SERVICES;
      case ServiceCategory.BROW_LASH:
        return BROW_LASH_SERVICES;
      default:
        return ALL_SERVICES;
    }
  }

  private groupByCategory(services: SalonService[]): Record<string, SalonService[]> {
    const groups: Record<string, SalonService[]> = {};

    for (const service of services) {
      if (!groups[service.category]) {
        groups[service.category] = [];
      }
      groups[service.category].push(service);
    }

    return groups;
  }

  private generateAvailableSlots(duration: number): Array<{ day: string; date: string; times: string[] }> {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const times = ['9:00 AM', '10:30 AM', '1:00 PM', '2:30 PM', '4:00 PM'];
    const slots: Array<{ day: string; date: string; times: string[] }> = [];

    const today = new Date();
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      if (date.getDay() !== 0) {
        const dayName = days[date.getDay() - 1] || 'Saturday';
        slots.push({
          day: dayName,
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          times: times.slice(0, 3)
        });
      }
    }

    return slots.slice(0, 3);
  }

  private getRandomStylist(category?: string): Stylist | undefined {
    const stylists = Array.from(this.stylists.values());

    if (category) {
      const matching = stylists.filter(s => s.specialties.includes(category as ServiceCategory));
      if (matching.length > 0) {
        return matching[randomInt(0, matching.length)];
      }
    }

    return stylists[randomInt(0, stylists.length)];
  }

  private isGreeting(message: string): boolean {
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'start'];
    return greetings.some(g => message.toLowerCase().includes(g));
  }

  async createAppointment(
    serviceId: string,
    clientId: string,
    clientName: string,
    dateTime: Date,
    stylistId: string
  ): Promise<Appointment | null> {
    const service = ALL_SERVICES.find(s => s.id === serviceId);
    const stylist = this.stylists.get(stylistId);

    if (!service || !stylist) {
      return null;
    }

    this.appointmentCounter++;
    const appointment: Appointment = {
      id: uuidv4(),
      serviceId,
      service,
      clientId,
      clientName,
      stylistId,
      stylistName: stylist.name,
      dateTime,
      duration: service.duration,
      price: service.price,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.appointments.set(appointment.id, appointment);
    logger.info('Appointment created', { appointmentId: appointment.id, serviceId, clientId });

    return appointment;
  }

  getAppointment(appointmentId: string): Appointment | undefined {
    return this.appointments.get(appointmentId);
  }

  getAppointmentsByClient(clientId: string): Appointment[] {
    return Array.from(this.appointments.values())
      .filter(a => a.clientId === clientId)
      .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());
  }

  getStylists(category?: ServiceCategory): Stylist[] {
    const stylists = Array.from(this.stylists.values());

    if (category) {
      return stylists.filter(s => s.specialties.includes(category));
    }

    return stylists;
  }
}

export interface SalonResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  actions: SalonAction[];
  processingTime?: number;
}

export interface SalonAction {
  type: 'show_categories' | 'show_services' | 'book_service' | 'check_availability' |
        'confirm_booking' | 'show_stylists' | 'show_service_details' | 'show_similar_services' |
        'recommend_treatment' | 'adjust_budget' | 'show_more_options' | 'identify_skin_type' |
        'book_facial' | 'show_skin_products' | 'ask_about_concerns' | 'reschedule_appointment' |
        'cancel_appointment' | 'check_service_allergens' | 'show_allergen_free_options' |
        'book_with_allergy_note' | 'find_alternative_service' | 'ask_questions' |
        'show_popular_services' | 'show_special_offers' | 'show_popular_services' |
        'show_special_offers';
  data: Record<string, unknown>;
}

export const salonExpert = new SalonExpert();
