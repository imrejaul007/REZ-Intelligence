import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { DESTINATIONS, ACCOMMODATION_TYPES, TRANSPORT_MODES, SEASONAL_TIPS, Destination } from '../config/knowledge';

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
      filename: 'logs/travel-agent-error.log',
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/travel-agent.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

export enum TravelStyle {
  ADVENTURE = 'adventure',
  RELAXATION = 'relaxation',
  CULTURAL = 'cultural',
  ROMANTIC = 'romantic',
  FAMILY = 'family',
  BUDGET = 'budget',
  LUXURY = 'luxury',
  FOODIE = 'foodie',
  NATURE = 'nature'
}

export enum BudgetLevel {
  BUDGET = 'budget',
  MODERATE = 'moderate',
  LUXURY = 'luxury'
}

export enum TripDuration {
  WEEKEND = 'weekend',
  WEEK = 'week',
  TWO_WEEKS = 'two_weeks',
  MONTH = 'month',
  LONG_TERM = 'long_term'
}

export interface Traveler {
  id: string;
  name: string;
  email: string;
  preferences: TravelStyle[];
  budgetLevel: BudgetLevel;
  tier: 'basic' | 'premium' | 'enterprise';
}

export interface Trip {
  id: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  travelers: number;
  budget: number;
  styles: TravelStyle[];
  accommodations: string[];
  transport: string[];
  itinerary: ItineraryDay[];
  estimatedCost: number;
  status: 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface ItineraryDay {
  day: number;
  date: Date;
  activities: ItineraryActivity[];
  notes: string;
}

export interface ItineraryActivity {
  id: string;
  time: string;
  title: string;
  description: string;
  location: string;
  duration: string;
  cost: number;
  bookingRequired: boolean;
  booked: boolean;
  category: 'sightseeing' | 'dining' | 'adventure' | 'relaxation' | 'shopping' | 'transport' | 'other';
}

export interface Booking {
  id: string;
  tripId: string;
  type: 'flight' | 'hotel' | 'car' | 'tour' | 'activity' | 'restaurant';
  provider: string;
  details: Record<string, unknown>;
  cost: number;
  confirmationNumber: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: Date;
}

export interface TravelContext {
  traveler: Traveler | null;
  tripId: string | null;
  sessionId: string;
  conversationHistory: string[];
  currentDestination: string | null;
  budget: number | null;
  travelDates: { start: Date | null; end: Date | null } | null;
}

export class TravelExpert {
  private readonly agentId: string;
  private readonly agentName: string;
  private trips: Map<string, Trip>;
  private bookings: Map<string, Booking>;
  private tripCounter: number;

  constructor(agentId?: string, agentName?: string) {
    this.agentId = agentId || uuidv4();
    this.agentName = agentName || 'Travel Expert';
    this.trips = new Map();
    this.bookings = new Map();
    this.tripCounter = 1000;
    logger.info('Travel Expert initialized', { agentId: this.agentId, agentName: this.agentName });
  }

  async processTravelQuery(
    context: TravelContext,
    message: string
  ): Promise<TravelResponse> {
    const startTime = Date.now();
    logger.info('Processing travel query', { sessionId: context.sessionId, messageLength: message.length });

    try {
      const intent = this.identifyIntent(message);
      const entities = this.extractEntities(message);

      let response: TravelResponse;

      switch (intent) {
        case 'search_destination':
          response = await this.handleDestinationSearch(context, entities, message);
          break;
        case 'plan_itinerary':
          response = await this.handleItineraryPlanning(context, entities);
          break;
        case 'book_transport':
          response = await this.handleTransportBooking(context, entities);
          break;
        case 'book_accommodation':
          response = await this.handleAccommodationBooking(context, entities);
          break;
        case 'destination_info':
          response = await this.handleDestinationInfo(context, entities);
          break;
        case 'budget_estimate':
          response = await this.handleBudgetEstimate(context, entities);
          break;
        case 'seasonal_advice':
          response = await this.handleSeasonalAdvice(context, entities);
          break;
        case 'packing_tips':
          response = await this.handlePackingTips(context);
          break;
        default:
          response = await this.handleGeneralTravel(context, message);
      }

      response.processingTime = Date.now() - startTime;
      return response;

    } catch (error) {
      logger.error('Error processing travel query', { error, sessionId: context.sessionId });
      throw error;
    }
  }

  private identifyIntent(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (this.matches(lowerMessage, ['where should i go', 'recommend', 'suggest', 'best destination', 'looking for a place'])) {
      return 'search_destination';
    }
    if (this.matches(lowerMessage, ['plan', 'itinerary', 'day by day', 'schedule', 'what should i do', 'activities'])) {
      return 'plan_itinerary';
    }
    if (this.matches(lowerMessage, ['flight', 'train', 'bus', 'car rental', 'transport', 'get there', 'travel to'])) {
      return 'book_transport';
    }
    if (this.matches(lowerMessage, ['hotel', 'stay', 'accommodation', 'resort', 'hostel', 'rent', 'villa'])) {
      return 'book_accommodation';
    }
    if (this.matches(lowerMessage, ['info', 'about', 'tell me about', 'what is', 'weather', 'currency'])) {
      return 'destination_info';
    }
    if (this.matches(lowerMessage, ['budget', 'cost', 'expensive', 'how much', 'price', 'afford'])) {
      return 'budget_estimate';
    }
    if (this.matches(lowerMessage, ['season', 'when to go', 'best time', 'weather', 'climate'])) {
      return 'seasonal_advice';
    }
    if (this.matches(lowerMessage, ['pack', 'bring', 'what to bring', 'luggage', 'clothing'])) {
      return 'packing_tips';
    }

    return 'general';
  }

  private matches(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private extractEntities(message: string): Record<string, unknown> {
    const entities: Record<string, unknown> = {};

    const budgetMatch = message.match(/\$?\s*(\d{2,4})\s*(?:per day|night|person|pd)?/i);
    if (budgetMatch) {
      entities.budget = parseInt(budgetMatch[1]);
    }

    const durationMatch = message.match(/(\d+)\s*(?:days?|nights?|weeks?|months?)/i);
    if (durationMatch) {
      entities.duration = parseInt(durationMatch[1]);
      entities.durationUnit = message.toLowerCase().includes('week') ? 'week' :
                              message.toLowerCase().includes('month') ? 'month' : 'day';
    }

    const travelersMatch = message.match(/(\d+)\s*(?:people|travelers|adults?|kids?|children)/i);
    if (travelersMatch) {
      entities.travelers = parseInt(travelersMatch[1]);
    }

    for (const dest of DESTINATIONS) {
      if (message.toLowerCase().includes(dest.name.toLowerCase()) ||
          message.toLowerCase().includes(dest.country.toLowerCase())) {
        entities.destination = dest.id;
        break;
      }
    }

    const styleKeywords: Record<string, TravelStyle> = {
      'adventure': TravelStyle.ADVENTURE,
      'relaxing': TravelStyle.RELAXATION,
      'beach': TravelStyle.RELAXATION,
      'cultural': TravelStyle.CULTURAL,
      'romantic': TravelStyle.ROMANTIC,
      'honeymoon': TravelStyle.ROMANTIC,
      'family': TravelStyle.FAMILY,
      'budget': TravelStyle.BUDGET,
      'luxury': TravelStyle.LUXURY,
      'food': TravelStyle.FOODIE,
      'nature': TravelStyle.NATURE
    };

    for (const [keyword, style] of Object.entries(styleKeywords)) {
      if (message.toLowerCase().includes(keyword)) {
        if (!entities.styles) entities.styles = [];
        (entities.styles as TravelStyle[]).push(style);
      }
    }

    return entities;
  }

  private async handleDestinationSearch(
    context: TravelContext,
    entities: Record<string, unknown>,
    message: string
  ): Promise<TravelResponse> {
    let destinations = [...DESTINATIONS];

    if (entities.destination) {
      destinations = destinations.filter(d => d.id === entities.destination);
    }

    if (entities.styles && (entities.styles as TravelStyle[]).length > 0) {
      destinations = destinations.filter(d =>
        d.type.some(t => (entities.styles as TravelStyle[]).some(s => s.toLowerCase().includes(t)))
      );
    }

    if (entities.budget) {
      const budget = entities.budget as number;
      destinations = destinations.filter(d => {
        if (budget < 100) return d.budgetLevel === 'budget';
        if (budget < 300) return d.budgetLevel !== 'luxury';
        return true;
      });
    }

    let responseMessage = '';

    if (destinations.length === 0) {
      responseMessage = "I couldn't find destinations matching your criteria. Let me suggest some popular options:\n\n";
      const popular = DESTINATIONS.slice(0, 3);
      for (const dest of popular) {
        responseMessage += `**${dest.name}, ${dest.country}**\n${dest.description}\n\n`;
      }
    } else {
      responseMessage = "Here are some amazing destinations for you:\n\n";
      for (const dest of destinations.slice(0, 4)) {
        responseMessage += `**${dest.name}, ${dest.country}**\n`;
        responseMessage += `${dest.description}\n`;
        responseMessage += `Best time: ${dest.bestTimeToVisit}\n`;
        responseMessage += `Highlights: ${dest.highlights.slice(0, 2).join(', ')}\n\n`;
      }
    }

    responseMessage += "Which destination catches your eye? I can help you plan an incredible trip!";

    return {
      success: true,
      message: responseMessage,
      data: { destinations: destinations.slice(0, 4) },
      actions: [
        { type: 'select_destination', data: { destinations: destinations.map(d => ({ id: d.id, name: d.name })) } },
        { type: 'show_more_destinations', data: {} }
      ]
    };
  }

  private async handleItineraryPlanning(
    context: TravelContext,
    entities: Record<string, unknown>
  ): Promise<TravelResponse> {
    const destination = entities.destination as string || 'maldives';
    const duration = (entities.duration as number) || 7;
    const dest = DESTINATIONS.find(d => d.id === destination) || DESTINATIONS[0];

    const itinerary = this.generateItinerary(dest, duration);

    let responseMessage = `Here's your ${duration}-day adventure in ${dest.name}:\n\n`;

    for (const day of itinerary.slice(0, 5)) {
      responseMessage += `**Day ${day.day}**\n`;
      for (const activity of day.activities.slice(0, 2)) {
        responseMessage += `${activity.time}: ${activity.title} - ${activity.duration}\n`;
      }
      responseMessage += '\n';
    }

    if (duration > 5) {
      responseMessage += `*Want me to generate a complete ${duration}-day itinerary with all details?*`;
    }

    return {
      success: true,
      message: responseMessage,
      data: {
        destination: dest,
        itinerary: itinerary,
        duration
      },
      actions: [
        { type: 'download_itinerary', data: { destination: dest.id } },
        { type: 'customize_day', data: { itinerary } },
        { type: 'book_activities', data: {} }
      ]
    };
  }

  private async handleTransportBooking(
    context: TravelContext,
    entities: Record<string, unknown>
  ): Promise<TravelResponse> {
    const destination = entities.destination as string;
    const dest = destination ? DESTINATIONS.find(d => d.id === destination) : null;

    if (!dest) {
      return {
        success: true,
        message: "I'd love to help you find the best transport options! Which destination are you planning to visit?",
        actions: [{ type: 'select_destination', data: {} }]
      };
    }

    let responseMessage = `Getting to ${dest.name} is an adventure in itself! Here are your options:\n\n`;

    for (const transport of TRANSPORT_MODES.slice(0, 3)) {
      responseMessage += `**${transport.name}**\n`;
      responseMessage += `${transport.description}\n`;
      responseMessage += `Estimated cost: ${transport.avgCostRange}\n`;
      responseMessage += `Pros: ${transport.pros.slice(0, 2).join(', ')}\n\n`;
    }

    responseMessage += "Would you like me to help you book transportation, or do you need more details about a specific option?";

    return {
      success: true,
      message: responseMessage,
      data: { destination: dest, transportOptions: TRANSPORT_MODES.slice(0, 3) },
      actions: [
        { type: 'search_flights', data: { destination: dest.id } },
        { type: 'compare_transport', data: {} },
        { type: 'get_transport_tips', data: {} }
      ]
    };
  }

  private async handleAccommodationBooking(
    context: TravelContext,
    entities: Record<string, unknown>
  ): Promise<TravelResponse> {
    const destination = entities.destination as string;
    const dest = destination ? DESTINATIONS.find(d => d.id === destination) : null;

    if (!dest) {
      return {
        success: true,
        message: "I'd be happy to help you find the perfect stay! Which destination are you interested in?",
        actions: [{ type: 'select_destination', data: {} }]
      };
    }

    let responseMessage = `Finding your perfect home away from home in ${dest.name}...\n\n`;

    for (const accommodation of ACCOMMODATION_TYPES.slice(0, 3)) {
      responseMessage += `**${accommodation.name}**\n`;
      responseMessage += `${accommodation.description}\n`;
      responseMessage += `Price range: ${accommodation.priceRange}\n`;
      responseMessage += `Key amenities: ${accommodation.amenities.slice(0, 3).join(', ')}\n\n`;
    }

    responseMessage += "What's your accommodation preference? I can search for specific options that match your style and budget.";

    return {
      success: true,
      message: responseMessage,
      data: { destination: dest, accommodationTypes: ACCOMMODATION_TYPES.slice(0, 3) },
      actions: [
        { type: 'search_hotels', data: { destination: dest.id } },
        { type: 'search_vacation_rentals', data: {} },
        { type: 'compare_accommodations', data: {} }
      ]
    };
  }

  private async handleDestinationInfo(
    context: TravelContext,
    entities: Record<string, unknown>
  ): Promise<TravelResponse> {
    const destination = entities.destination as string;
    const dest = destination ? DESTINATIONS.find(d => d.id === destination) : DESTINATIONS[0];

    let responseMessage = `Here's everything you need to know about ${dest.name}:\n\n`;
    responseMessage += `**Overview**\n${dest.description}\n\n`;
    responseMessage += `**Quick Facts**\n`;
    responseMessage += `- Country: ${dest.country}\n`;
    responseMessage += `- Language: ${dest.language}\n`;
    responseMessage += `- Currency: ${dest.currency}\n`;
    responseMessage += `- Timezone: ${dest.timezone}\n`;
    responseMessage += `- Best Time to Visit: ${dest.bestTimeToVisit}\n`;
    responseMessage += `- Average Temperature: ${dest.avgTemperature}\n\n`;
    responseMessage += `**Must-See Highlights**\n`;
    for (const highlight of dest.highlights) {
      responseMessage += `- ${highlight}\n`;
    }

    return {
      success: true,
      message: responseMessage,
      data: { destination: dest },
      actions: [
        { type: 'plan_trip', data: { destination: dest.id } },
        { type: 'show_on_map', data: {} },
        { type: 'share_info', data: {} }
      ]
    };
  }

  private async handleBudgetEstimate(
    context: TravelContext,
    entities: Record<string, unknown>
  ): Promise<TravelResponse> {
    const destination = entities.destination as string;
    const duration = (entities.duration as number) || 7;
    const travelers = (entities.travelers as number) || 2;
    const dest = destination ? DESTINATIONS.find(d => d.id === destination) : null;

    if (!dest) {
      return {
        success: true,
        message: "I'd be happy to provide a budget estimate! Which destination are you considering?",
        actions: [{ type: 'select_destination', data: {} }]
      };
    }

    const dailyBudget = this.calculateDailyBudget(dest.budgetLevel, travelers);
    const totalBudget = dailyBudget * duration * travelers;

    let responseMessage = `Budget estimate for ${duration} days in ${dest.name} for ${travelers} traveler(s):\n\n`;
    responseMessage += `**Daily Budget Per Person:** $${dailyBudget.min}-$${dailyBudget.max}\n\n`;
    responseMessage += `**Estimated Total:** $${(totalBudget.min).toLocaleString()}-$${(totalBudget.max).toLocaleString()}\n\n`;
    responseMessage += `**Breakdown:**\n`;
    responseMessage += `- Accommodation: $${Math.round(totalBudget.min * 0.4)}-$新${Math.round(totalBudget.max * 0.4)}\n`;
    responseMessage += `- Food & Dining: $${Math.round(totalBudget.min * 0.25)}-$新${Math.round(totalBudget.max * 0.25)}\n`;
    responseMessage += `- Activities: $${Math.round(totalBudget.min * 0.2)}-$新${Math.round(totalBudget.max * 0.2)}\n`;
    responseMessage += `- Transport: $${Math.round(totalBudget.min * 0.15)}-$新${Math.round(totalBudget.max * 0.15)}\n\n`;
    responseMessage += `*Note: These are estimates. Actual costs may vary based on season, booking timing, and personal preferences.*`;

    return {
      success: true,
      message: responseMessage,
      data: {
        destination: dest,
        duration,
        travelers,
        budget: { daily: dailyBudget, total: totalBudget }
      },
      actions: [
        { type: 'adjust_budget', data: {} },
        { type: 'find_deals', data: {} },
        { type: 'plan_within_budget', data: {} }
      ]
    };
  }

  private async handleSeasonalAdvice(
    context: TravelContext,
    entities: Record<string, unknown>
  ): Promise<TravelResponse> {
    const destination = entities.destination as string;
    const dest = destination ? DESTINATIONS.find(d => d.id === destination) : null;

    if (!dest) {
      return {
        success: true,
        message: "I'd love to share seasonal insights! Which destination are you asking about?",
        actions: [{ type: 'select_destination', data: {} }]
      };
    }

    let responseMessage = `Planning your trip to ${dest.name}? Here's the seasonal guide:\n\n`;
    responseMessage += `**Best Time to Visit:** ${dest.bestTimeToVisit}\n\n`;
    responseMessage += `**Weather:** Average temperatures range from ${dest.avgTemperature}\n\n`;

    const tips = SEASONAL_TIPS.shoulder;
    responseMessage += `**Pro Tip:** The shoulder season is often ideal - fewer crowds, good weather, and better prices!\n\n`;
    responseMessage += `What aspect of timing would you like to know more about?`;

    return {
      success: true,
      message: responseMessage,
      data: {
        destination: dest,
        bestTime: dest.bestTimeToVisit,
        temperature: dest.avgTemperature
      },
      actions: [
        { type: 'check_weather', data: {} },
        { type: 'find_cheapest_time', data: {} },
        { type: 'plan_seasonal_activities', data: {} }
      ]
    };
  }

  private async handlePackingTips(
    context: TravelContext,
    entities: Record<string, unknown>
  ): Promise<TravelResponse> {
    const destination = entities.destination as string;
    const dest = destination ? DESTINATIONS.find(d => d.id === destination) : null;

    let responseMessage = "Here's your packing essential guide:\n\n";

    if (dest) {
      responseMessage += `**For ${dest.name}, don't forget:**\n`;
      responseMessage += `- Documents: Passport, visa (check requirements!), travel insurance\n`;
      responseMessage += `- Electronics: Phone charger, universal adapter, power bank\n`;
      responseMessage += `- Clothing: Check the weather - avg ${dest.avgTemperature}\n`;
      responseMessage += `- Comfortable walking shoes (trust me on this one)\n`;
      responseMessage += `- Reusable water bottle and small day bag\n\n`;
    } else {
      responseMessage += "**Universal Travel Essentials:**\n";
      responseMessage += "- Passport and copies (digital + physical)\n";
      responseMessage += "- Travel insurance documents\n";
      responseMessage += "- Phone and charger\n";
      responseMessage += "- Universal power adapter\n";
      responseMessage += "- Comfortable shoes\n";
      responseMessage += "- Basic toiletries kit\n";
      responseMessage += "- Reusable water bottle\n";
      responseMessage += "- Small daypack\n\n";
    }

    responseMessage += "Want me to create a custom packing list for your specific trip?";

    return {
      success: true,
      message: responseMessage,
      data: { destination: dest },
      actions: [
        { type: 'generate_packing_list', data: {} },
        { type: 'check_visa_requirements', data: {} },
        { type: 'print_checklist', data: {} }
      ]
    };
  }

  private async handleGeneralTravel(
    context: TravelContext,
    entities: Record<string, unknown>,
    message: string
  ): Promise<TravelResponse> {
    const greeting = this.isGreeting(message);

    if (greeting) {
      return {
        success: true,
        message: "Hello, adventurer! I'm your REZ Travel Expert, ready to help you plan unforgettable journeys.\n\nI can help you with:\n- Finding perfect destinations\n- Creating detailed itineraries\n- Booking flights, hotels, and activities\n- Budget planning and tips\n- Seasonal travel advice\n\nWhere would you like to go?",
        actions: [
          { type: 'show_popular_destinations', data: {} },
          { type: 'show_travel_styles', data: {} },
          { type: 'recent_trips', data: {} }
        ]
      };
    }

    return {
      success: true,
      message: "I'm here to help make your travel dreams come true! To give you the best recommendations, could you tell me:\n\n- Where you're dreaming of going\n- When you're planning to travel\n- How long you'd like to stay\n- Your travel style (adventure, relaxation, cultural immersion?)\n- Your budget range\n\nOr just say the word and I'll suggest some incredible destinations!",
      actions: [
        { type: 'show_popular_destinations', data: {} },
        { type: 'show_beach_destinations', data: {} },
        { type: 'show_adventure_destinations', data: {} }
      ]
    };
  }

  private generateItinerary(destination: Destination, days: number): ItineraryDay[] {
    const itinerary: ItineraryDay[] = [];
    const activityTemplates = this.getActivityTemplates(destination);

    for (let day = 1; day <= days; day++) {
      const activities: ItineraryActivity[] = [];

      if (day === 1) {
        activities.push({
          id: uuidv4(),
          time: '09:00 AM',
          title: 'Arrival & Hotel Check-in',
          description: 'Settle into your accommodation and freshen up',
          location: destination.name,
          duration: '2 hours',
          cost: 0,
          bookingRequired: false,
          booked: false,
          category: 'other'
        });
        activities.push({
          id: uuidv4(),
          time: '12:00 PM',
          title: 'Welcome Lunch',
          description: 'Try local cuisine at a recommended restaurant',
          location: 'Local restaurant',
          duration: '1.5 hours',
          cost: 30,
          bookingRequired: false,
          booked: false,
          category: 'dining'
        });
      }

      const templateIndex = (day - 1) % activityTemplates.length;
      const template = activityTemplates[templateIndex];

      activities.push({
        id: uuidv4(),
        time: template.time,
        title: template.title,
        description: template.description,
        location: template.location || destination.name,
        duration: template.duration,
        cost: template.cost,
        bookingRequired: template.bookingRequired,
        booked: false,
        category: template.category
      });

      if (templateIndex % 2 === 0) {
        activities.push({
          id: uuidv4(),
          time: '07:00 PM',
          title: 'Dinner Experience',
          description: `Enjoy ${destination.name}'s culinary delights`,
          location: 'Recommended dining spot',
          duration: '2 hours',
          cost: 50,
          bookingRequired: true,
          booked: false,
          category: 'dining'
        });
      }

      itinerary.push({
        day,
        date: new Date(Date.now() + day * 24 * 60 * 60 * 1000),
        activities,
        notes: `Day ${day} in ${destination.name}`
      });
    }

    return itinerary;
  }

  private getActivityTemplates(destination: Destination): Array<{
    time: string;
    title: string;
    description: string;
    location?: string;
    duration: string;
    cost: number;
    bookingRequired: boolean;
    category: ItineraryActivity['category'];
  }> {
    return [
      {
        time: '10:00 AM',
        title: 'City Walking Tour',
        description: `Discover the highlights of ${destination.name} with a local guide`,
        duration: '3 hours',
        cost: 40,
        bookingRequired: true,
        category: 'sightseeing'
      },
      {
        time: '09:00 AM',
        title: 'Adventure Activity',
        description: `Experience the thrill of ${destination.type[0] || 'exploration'}`,
        duration: '4 hours',
        cost: 80,
        bookingRequired: true,
        category: 'adventure'
      },
      {
        time: '11:00 AM',
        title: 'Local Market Visit',
        description: 'Immerse yourself in local culture and flavors',
        duration: '2 hours',
        cost: 20,
        bookingRequired: false,
        category: 'shopping'
      },
      {
        time: '02:00 PM',
        title: 'Beach/Relaxation Time',
        description: 'Unwind and enjoy the natural beauty',
        duration: '4 hours',
        cost: 0,
        bookingRequired: false,
        category: 'relaxation'
      },
      {
        time: '10:00 AM',
        title: 'Cultural Experience',
        description: `Learn about the history and traditions of ${destination.country}`,
        duration: '3 hours',
        cost: 35,
        bookingRequired: true,
        category: 'sightseeing'
      }
    ];
  }

  private calculateDailyBudget(budgetLevel: string, travelers: number): { min: number; max: number } {
    const baseBudget: Record<string, { min: number; max: number }> = {
      budget: { min: 60, max: 120 },
      moderate: { min: 120, max: 250 },
      luxury: { min: 250, max: 500 }
    };

    const base = baseBudget[budgetLevel] || baseBudget.moderate;
    return {
      min: base.min * Math.sqrt(travelers),
      max: base.max * Math.sqrt(travelers)
    };
  }

  private isGreeting(message: string): boolean {
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'start'];
    return greetings.some(g => message.toLowerCase().includes(g));
  }

  async createTrip(destination: string, startDate: Date, endDate: Date, travelers: number, budget: number): Promise<Trip> {
    this.tripCounter++;
    const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const trip: Trip = {
      id: uuidv4(),
      destination,
      startDate,
      endDate,
      travelers,
      budget,
      styles: [],
      accommodations: [],
      transport: [],
      itinerary: [],
      estimatedCost: 0,
      status: 'planning',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.trips.set(trip.id, trip);
    logger.info('Trip created', { tripId: trip.id, destination, duration });

    return trip;
  }

  getTrip(tripId: string): Trip | undefined {
    return this.trips.get(tripId);
  }

  getTripsByTraveler(travelerId: string): Trip[] {
    return Array.from(this.trips.values())
      .filter(t => t.status !== 'cancelled')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export interface TravelResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  actions: TravelAction[];
  processingTime?: number;
}

export interface TravelAction {
  type: 'select_destination' | 'show_more_destinations' | 'download_itinerary' | 'customize_day' |
        'book_activities' | 'search_flights' | 'compare_transport' | 'get_transport_tips' |
        'search_hotels' | 'search_vacation_rentals' | 'compare_accommodations' | 'plan_trip' |
        'show_on_map' | 'share_info' | 'adjust_budget' | 'find_deals' | 'plan_within_budget' |
        'check_weather' | 'find_cheapest_time' | 'plan_seasonal_activities' | 'generate_packing_list' |
        'check_visa_requirements' | 'print_checklist' | 'show_popular_destinations' |
        'show_travel_styles' | 'recent_trips' | 'show_beach_destinations' | 'show_adventure_destinations' |
        'show_help_options';
  data: Record<string, unknown>;
}

export const travelExpert = new TravelExpert();
