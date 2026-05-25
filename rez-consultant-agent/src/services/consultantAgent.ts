import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
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
      filename: 'logs/consultant-agent-error.log',
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/consultant-agent.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

export enum ConsultationType {
  TRAVEL_PLANNING = 'travel_planning',
  DESTINATION_RECOMMENDATION = 'destination_recommendation',
  BUDGET_OPTIMIZATION = 'budget_optimization',
  ITINERARY_CREATION = 'itinerary_creation',
  ACTIVITY_SUGGESTION = 'activity_suggestion',
  ACCOMMODATION_GUIDANCE = 'accommodation_guidance',
  SEASONAL_ADVICE = 'seasonal_advice',
  GROUP_TRAVEL = 'group_travel'
}

export enum TravelStyle {
  BUDGET = 'budget',
  MID_RANGE = 'mid_range',
  LUXURY = 'luxury',
  ADVENTURE = 'adventure',
  RELAXATION = 'relaxation',
  CULTURAL = 'cultural',
  FAMILY = 'family',
  ROMANTIC = 'romantic',
  SOLO = 'solo',
  BUSINESS = 'business'
}

export enum ExperienceLevel {
  FIRST_TIME = 'first_time',
  OCCASIONAL = 'occasional',
  REGULAR = 'regular',
  FREQUENT = 'frequent',
  EXPERT = 'expert'
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  travelStyle: TravelStyle;
  experienceLevel: ExperienceLevel;
  budgetRange: { min: number; max: number };
  preferredDestinations: string[];
  preferredActivities: string[];
  travelFrequency: 'rarely' | 'occasionally' | 'frequently';
  groupSize: number;
  specialRequirements: string[];
  allergies: string[];
  accessibilityNeeds: string[];
  pastTrips: PastTrip[];
  loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface PastTrip {
  destination: string;
  date: Date;
  rating: number;
  budget: number;
  activities: string[];
}

export interface ConsultationContext {
  customer: CustomerProfile | null;
  currentDestination: string | null;
  travelDates: { start: Date; end: Date } | null;
  budget: number;
  tripType: string;
  specialOccasions: string[];
  preferences: Record<string, unknown>;
}

export interface ConsultantResponse {
  success: boolean;
  message: string;
  recommendations: Recommendation[];
  insights: Insight[];
  nextSteps: NextStep[];
  data?: Record<string, unknown>;
  processingTime?: number;
}

export interface Recommendation {
  type: 'destination' | 'activity' | 'accommodation' | 'restaurant' | 'transport' | 'experience';
  id: string;
  name: string;
  description: string;
  rationale: string;
  matchScore: number;
  priceRange: { min: number; max: number };
  estimatedDuration?: string;
  bookingUrl?: string;
  images?: string[];
  tags: string[];
  highlights: string[];
  considerations: string[];
}

export interface Insight {
  category: 'budget' | 'timing' | 'crowds' | 'weather' | 'local_events' | 'safety' | 'value';
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  actionable: boolean;
}

export interface NextStep {
  action: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedTime: string;
}

export interface Itinerary {
  id: string;
  title: string;
  days: ItineraryDay[];
  totalBudget: number;
  estimatedCost: number;
  tips: string[];
  warnings: string[];
  createdAt: Date;
}

export interface ItineraryDay {
  day: number;
  date: string;
  title: string;
  activities: ItineraryActivity[];
  meals: MealRecommendation[];
  transportNotes: string[];
  tips: string[];
}

export interface ItineraryActivity {
  time: string;
  name: string;
  duration: string;
  location: string;
  cost: number;
  bookingRequired: boolean;
  notes: string;
}

export interface MealRecommendation {
  meal: 'breakfast' | 'lunch' | 'dinner';
  recommendedVenue: string;
  cuisine: string;
  priceRange: string;
  distance: string;
  notes: string;
}

class ConsultantAgent {
  private readonly agentId: string;
  private readonly agentName: string;
  private consultationHistory: Map<string, ConsultationSession>;

  constructor(agentId?: string, agentName?: string) {
    this.agentId = agentId || uuidv4();
    this.agentName = agentName || 'Travel Consultant';
    this.consultationHistory = new Map();
    logger.info('Consultant Agent initialized', { agentId: this.agentId, agentName: this.agentName });
  }

  async processConsultation(
    context: ConsultationContext,
    query: string,
    sessionId: string
  ): Promise<ConsultantResponse> {
    const startTime = Date.now();
    logger.info('Processing consultation request', { sessionId, queryLength: query.length });

    try {
      const consultationType = this.identifyConsultationType(query);
      let response: ConsultantResponse;

      switch (consultationType) {
        case ConsultationType.DESTINATION_RECOMMENDATION:
          response = await this.handleDestinationRecommendation(context, query);
          break;
        case ConsultationType.ITINERARY_CREATION:
          response = await this.handleItineraryCreation(context, query);
          break;
        case ConsultationType.BUDGET_OPTIMIZATION:
          response = await this.handleBudgetOptimization(context, query);
          break;
        case ConsultationType.ACTIVITY_SUGGESTION:
          response = await this.handleActivitySuggestion(context, query);
          break;
        case ConsultationType.ACCOMMODATION_GUIDANCE:
          response = await this.handleAccommodationGuidance(context, query);
          break;
        case ConsultationType.SEASONAL_ADVICE:
          response = await this.handleSeasonalAdvice(context, query);
          break;
        case ConsultationType.GROUP_TRAVEL:
          response = await this.handleGroupTravel(context, query);
          break;
        default:
          response = await this.handleGeneralConsultation(context, query);
      }

      this.recordSession(sessionId, consultationType, query, response);
      response.processingTime = Date.now() - startTime;

      return response;

    } catch (error) {
      logger.error('Error processing consultation', { error, sessionId });
      throw error;
    }
  }

  private identifyConsultationType(query: string): ConsultationType {
    const lowerQuery = query.toLowerCase();

    if (this.matches(lowerQuery, ['where should i go', 'best destination', 'recommend', 'suggest places', 'which destination'])) {
      return ConsultationType.DESTINATION_RECOMMENDATION;
    }
    if (this.matches(lowerQuery, ['itinerary', 'day by day', 'schedule', 'plan my days', 'what should i do'])) {
      return ConsultationType.ITINERARY_CREATION;
    }
    if (this.matches(lowerQuery, ['budget', 'cost', 'spend', 'save money', 'affordable', 'price'])) {
      return ConsultationType.BUDGET_OPTIMIZATION;
    }
    if (this.matches(lowerQuery, ['activities', 'things to do', 'experiences', 'adventure', 'tours'])) {
      return ConsultationType.ACTIVITY_SUGGESTION;
    }
    if (this.matches(lowerQuery, ['hotel', 'accommodation', 'stay', 'resort', ' lodging'])) {
      return ConsultationType.ACCOMMODATION_GUIDANCE;
    }
    if (this.matches(lowerQuery, ['when to go', 'best time', 'season', 'weather', 'crowds'])) {
      return ConsultationType.SEASONAL_ADVICE;
    }
    if (this.matches(lowerQuery, ['group', 'family', 'friends', 'team', 'corporate'])) {
      return ConsultationType.GROUP_TRAVEL;
    }

    return ConsultationType.TRAVEL_PLANNING;
  }

  private matches(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private async handleDestinationRecommendation(
    context: ConsultationContext,
    query: string
  ): Promise<ConsultantResponse> {
    const { getDestinationRecommendations } = await import('./recommendationEngine');

    const destinations = await getDestinationRecommendations(context.customer, {
      budget: context.budget,
      travelStyle: context.customer?.travelStyle || TravelStyle.MID_RANGE,
      preferredActivities: context.customer?.preferredActivities || [],
      groupSize: context.customer?.groupSize || 2,
      travelDates: context.travelDates
    });

    const insights: Insight[] = [];
    const nextSteps: NextStep[] = [];

    for (const dest of destinations.slice(0, 3)) {
      insights.push({
        category: 'value',
        title: `${dest.name} for ${context.customer?.travelStyle || 'your style'}`,
        description: dest.rationale,
        importance: 'high',
        actionable: true
      });
    }

    nextSteps.push(
      { action: 'select_destination', description: 'Choose a destination from the recommendations', priority: 'high', estimatedTime: '5 minutes' },
      { action: 'check_availability', description: 'Verify accommodation and flight availability', priority: 'high', estimatedTime: '10 minutes' },
      { action: 'create_itinerary', description: 'Get a personalized itinerary for your chosen destination', priority: 'medium', estimatedTime: '15 minutes' }
    );

    return {
      success: true,
      message: this.formatDestinationRecommendations(destinations),
      recommendations: destinations,
      insights,
      nextSteps
    };
  }

  private async handleItineraryCreation(
    context: ConsultationContext,
    query: string
  ): Promise<ConsultantResponse> {
    const { generateItinerary } = await import('./recommendationEngine');

    const itinerary = await generateItinerary({
      destination: context.currentDestination || 'Bali',
      startDate: context.travelDates?.start || new Date(),
      endDate: context.travelDates?.end || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      travelStyle: context.customer?.travelStyle || TravelStyle.MID_RANGE,
      budget: context.budget || 2000,
      groupSize: context.customer?.groupSize || 2,
      preferences: context.customer?.preferredActivities || []
    });

    const recommendations: Recommendation[] = [];
    for (const day of itinerary.days) {
      for (const activity of day.activities) {
        recommendations.push({
          type: 'activity',
          id: uuidv4(),
          name: activity.name,
          description: activity.notes,
          rationale: `Day ${day.day} activity`,
          matchScore: 90,
          priceRange: { min: activity.cost, max: activity.cost * 1.2 },
          estimatedDuration: activity.duration,
          tags: [],
          highlights: [],
          considerations: []
        });
      }
    }

    const insights: Insight[] = [
      {
        category: 'timing',
        title: 'Optimal Timing',
        description: 'This itinerary is optimized for your travel dates to maximize experiences while allowing flexibility.',
        importance: 'high',
        actionable: true
      },
      {
        category: 'budget',
        title: 'Budget Allocation',
        description: `Estimated total cost: $${itinerary.estimatedCost.toFixed(2)} within your $${context.budget || 2000} budget.`,
        importance: 'high',
        actionable: true
      }
    ];

    const nextSteps: NextStep[] = [
      { action: 'review_itinerary', description: 'Review the detailed day-by-day itinerary', priority: 'high', estimatedTime: '10 minutes' },
      { action: 'book_activities', description: 'Book unknown activities marked as requiring reservation', priority: 'high', estimatedTime: '20 minutes' },
      { action: 'adjust_budget', description: 'Fine-tune budget allocation if needed', priority: 'medium', estimatedTime: '5 minutes' },
      { action: 'share_itinerary', description: 'Share the itinerary with travel companions', priority: 'low', estimatedTime: '2 minutes' }
    ];

    return {
      success: true,
      message: `I've created a personalized ${itinerary.days.length}-day itinerary for ${context.currentDestination || 'your destination'}. Here's the overview:\n\n${itinerary.days.map(d => `**Day ${d.day}: ${d.title}**\n${d.activities.slice(0, 2).map(a => `• ${a.time} - ${a.name}`).join('\n')}`).join('\n\n')}\n\n**Total Estimated Cost:** $${itinerary.estimatedCost.toFixed(2)}\n\nWould you like me to create a detailed day-by-day breakdown?`,
      recommendations,
      insights,
      nextSteps,
      data: { itinerary }
    };
  }

  private async handleBudgetOptimization(
    context: ConsultationContext,
    query: string
  ): Promise<ConsultantResponse> {
    const { optimizeBudget } = await import('./recommendationEngine');

    const budgetBreakdown = optimizeBudget({
      totalBudget: context.budget || 2000,
      duration: this.calculateDuration(context.travelDates),
      travelStyle: context.customer?.travelStyle || TravelStyle.MID_RANGE,
      groupSize: context.customer?.groupSize || 2,
      destination: context.currentDestination || 'general'
    });

    const recommendations: Recommendation[] = [];

    const categories = [
      { name: 'Accommodation', percent: 40, icon: '🏨' },
      { name: 'Activities', percent: 25, icon: '🎯' },
      { name: 'Food & Dining', percent: 20, icon: '🍽️' },
      { name: 'Transportation', percent: 10, icon: '🚗' },
      { name: 'Contingency', percent: 5, icon: '💰' }
    ];

    for (const cat of categories) {
      recommendations.push({
        type: 'activity',
        id: uuidv4(),
        name: `${cat.icon} ${cat.name}`,
        description: `${cat.percent}% of your budget ($${((context.budget || 2000) * cat.percent / 100).toFixed(2)})`,
        rationale: `Recommended allocation for ${cat.name.toLowerCase()} based on ${context.customer?.travelStyle || 'your travel style'}`,
        matchScore: 95,
        priceRange: {
          min: (context.budget || 2000) * (cat.percent - 5) / 100,
          max: (context.budget || 2000) * (cat.percent + 5) / 100
        },
        tags: ['budget', cat.name.toLowerCase()],
        highlights: [],
        considerations: []
      });
    }

    const insights: Insight[] = [
      {
        category: 'value',
        title: 'Best Value Opportunities',
        description: 'Based on your preferences, you can save up to 20% by booking accommodations with kitchen facilities and choosing free walking tours.',
        importance: 'high',
        actionable: true
      },
      {
        category: 'budget',
        title: 'Cost-Saving Tips',
        description: 'Travel during shoulder season, book activities in advance, and use local transportation to maximize your budget.',
        importance: 'medium',
        actionable: true
      }
    ];

    const nextSteps: NextStep[] = [
      { action: 'review_breakdown', description: 'Review detailed budget breakdown', priority: 'high', estimatedTime: '5 minutes' },
      { action: 'find_deals', description: 'Search for deals in each category', priority: 'medium', estimatedTime: '15 minutes' },
      { action: 'set_alerts', description: 'Set price alerts for flights and accommodations', priority: 'low', estimatedTime: '2 minutes' }
    ];

    return {
      success: true,
      message: `Based on your $${(context.budget || 2000).toFixed(2)} budget and ${this.calculateDuration(context.travelDates)} day trip, here's the recommended allocation:\n\n${categories.map(c => `**${c.name}:** $${((context.budget || 2000) * c.percent / 100).toFixed(2)} (${c.percent}%)`).join('\n')}\n\n**Potential Savings:** Up to 15% with advance booking and off-peak travel.`,
      recommendations,
      insights,
      nextSteps
    };
  }

  private async handleActivitySuggestion(
    context: ConsultationContext,
    query: string
  ): Promise<ConsultantResponse> {
    const { getActivityRecommendations } = await import('./recommendationEngine');

    const activities = await getActivityRecommendations({
      destination: context.currentDestination || 'Bali',
      travelStyle: context.customer?.travelStyle || TravelStyle.MID_RANGE,
      budget: context.budget || 2000,
      groupSize: context.customer?.groupSize || 2,
      preferences: context.customer?.preferredActivities || []
    });

    const recommendations: Recommendation[] = activities.map(act => ({
      type: 'activity' as const,
      id: act.id,
      name: act.name,
      description: act.description,
      rationale: act.rationale,
      matchScore: act.matchScore,
      priceRange: act.priceRange,
      estimatedDuration: act.estimatedDuration,
      tags: act.tags,
      highlights: act.highlights,
      considerations: act.considerations
    }));

    const insights: Insight[] = [
      {
        category: 'value',
        title: 'Must-Book Activities',
        description: 'Book these popular activities early to secure spots and often get early-bird discounts.',
        importance: 'high',
        actionable: true
      }
    ];

    const nextSteps: NextStep[] = [
      { action: 'select_activities', description: 'Select activities for your itinerary', priority: 'high', estimatedTime: '10 minutes' },
      { action: 'book_popular', description: 'Book must-do activities first', priority: 'high', estimatedTime: '15 minutes' },
      { action: 'add_flexibility', description: 'Leave room for spontaneous activities', priority: 'medium', estimatedTime: '2 minutes' }
    ];

    return {
      success: true,
      message: `Here are the top activities for ${context.currentDestination || 'your destination'} based on your ${context.customer?.travelStyle || 'travel style'} preferences:\n\n${activities.map((a, i) => `${i + 1}. **${a.name}** - $${a.priceRange.min.toFixed(0)}-${a.priceRange.max.toFixed(0)}\n   ${a.description.substring(0, 100)}...`).join('\n\n')}`,
      recommendations,
      insights,
      nextSteps
    };
  }

  private async handleAccommodationGuidance(
    context: ConsultationContext,
    query: string
  ): Promise<ConsultantResponse> {
    const { getAccommodationRecommendations } = await import('./recommendationEngine');

    const accommodations = await getAccommodationRecommendations({
      destination: context.currentDestination || 'Bali',
      travelStyle: context.customer?.travelStyle || TravelStyle.MID_RANGE,
      budget: (context.budget || 2000) * 0.4,
      groupSize: context.customer?.groupSize || 2,
      amenities: ['wifi', 'breakfast', 'pool']
    });

    const recommendations: Recommendation[] = accommodations.map(acc => ({
      type: 'accommodation' as const,
      id: acc.id,
      name: acc.name,
      description: acc.description,
      rationale: acc.rationale,
      matchScore: acc.matchScore,
      priceRange: acc.priceRange,
      tags: acc.tags,
      highlights: acc.highlights,
      considerations: acc.considerations
    }));

    const insights: Insight[] = [
      {
        category: 'value',
        title: 'Location Tip',
        description: 'Staying in the recommended area will save you an average of 30 minutes daily commute time.',
        importance: 'medium',
        actionable: true
      }
    ];

    const nextSteps: NextStep[] = [
      { action: 'compare_options', description: 'Compare accommodation options side-by-side', priority: 'high', estimatedTime: '10 minutes' },
      { action: 'check_reviews', description: 'Read verified guest reviews', priority: 'medium', estimatedTime: '5 minutes' },
      { action: 'book_accommodation', description: 'Secure your preferred option', priority: 'high', estimatedTime: '10 minutes' }
    ];

    return {
      success: true,
      message: `Based on your ${context.customer?.travelStyle || 'travel style'} preferences and budget, here are the best accommodation options:\n\n${accommodations.map((a, i) => `${i + 1}. **${a.name}**\n   Price: $${a.priceRange.min.toFixed(0)}-${a.priceRange.max.toFixed(0)}/night\n   ${a.description.substring(0, 150)}...`).join('\n\n')}`,
      recommendations,
      insights,
      nextSteps
    };
  }

  private async handleSeasonalAdvice(
    context: ConsultationContext,
    query: string
  ): Promise<ConsultantResponse> {
    const destination = context.currentDestination || 'general';

    const seasonalInfo = this.getSeasonalAdvice(destination);

    const recommendations: Recommendation[] = seasonalInfo.bestMonths.map(month => ({
      type: 'experience',
      id: uuidv4(),
      name: month.name,
      description: month.description,
      rationale: `Best time to visit for ${month.highlights[0]}`,
      matchScore: month.matchScore,
      priceRange: { min: 0, max: 0 },
      tags: ['seasonal', 'timing'],
      highlights: month.highlights,
      considerations: month.considerations
    }));

    const insights: Insight[] = [
      {
        category: 'weather',
        title: 'Weather Outlook',
        description: seasonalInfo.weatherSummary,
        importance: 'high',
        actionable: true
      },
      {
        category: 'crowds',
        title: 'Crowd Levels',
        description: seasonalInfo.crowdAdvice,
        importance: 'medium',
        actionable: true
      },
      {
        category: 'value',
        title: 'Price Trends',
        description: seasonalInfo.priceAdvice,
        importance: 'high',
        actionable: true
      }
    ];

    const nextSteps: NextStep[] = [
      { action: 'choose_timing', description: 'Decide on travel dates based on this advice', priority: 'high', estimatedTime: '5 minutes' },
      { action: 'check_weather', description: 'Get detailed weather forecast closer to travel', priority: 'low', estimatedTime: '2 minutes' }
    ];

    return {
      success: true,
      message: `**Seasonal Advice for ${destination}**\n\n${seasonalInfo.summary}\n\n**Best Months to Visit:**\n${seasonalInfo.bestMonths.map(m => `• ${m.name}: ${m.description}`).join('\n')}\n\n**Weather:** ${seasonalInfo.weatherSummary}\n\n**Crowds:** ${seasonalInfo.crowdAdvice}\n\n**Prices:** ${seasonalInfo.priceAdvice}`,
      recommendations,
      insights,
      nextSteps
    };
  }

  private async handleGroupTravel(
    context: ConsultationContext,
    query: string
  ): Promise<ConsultantResponse> {
    const groupSize = context.customer?.groupSize || 4;
    const activities = this.getGroupActivities(groupSize);

    const recommendations: Recommendation[] = activities.map(act => ({
      type: 'activity',
      id: act.id,
      name: act.name,
      description: act.description,
      rationale: act.rationale,
      matchScore: act.matchScore,
      priceRange: act.priceRange,
      tags: ['group', 'team'],
      highlights: act.highlights,
      considerations: act.considerations
    }));

    const insights: Insight[] = [
      {
        category: 'budget',
        title: 'Group Savings',
        description: `Booking for ${groupSize} people? You could save up to 25% with group discounts on accommodations and activities.`,
        importance: 'high',
        actionable: true
      },
      {
        category: 'planning',
        title: 'Coordination Tips',
        description: 'With a larger group, consider booking a central accommodation with common areas and planning at least one group activity per day.',
        importance: 'medium',
        actionable: true
      }
    ];

    const nextSteps: NextStep[] = [
      { action: 'get_group_quote', description: 'Request group pricing from providers', priority: 'high', estimatedTime: '10 minutes' },
      { action: 'plan_meetups', description: 'Plan group activities and free time', priority: 'medium', estimatedTime: '15 minutes' },
      { action: 'assign_responsibilities', description: 'Divide planning tasks among group members', priority: 'low', estimatedTime: '5 minutes' }
    ];

    return {
      success: true,
      message: `**Group Travel Planning for ${groupSize} People**\n\nWith a group of ${groupSize}, here are my recommendations:\n\n**Best Accommodation:** Large villa or apartment with multiple bedrooms and common areas.\n\n**Top Group Activities:**\n${activities.map((a, i) => `${i + 1}. ${a.name} - ${a.rationale}`).join('\n')}\n\n**Estimated Group Budget:** $${((context.budget || 2000) * Math.sqrt(groupSize)).toFixed(2)} total (per-person: $${(context.budget || 2000).toFixed(2)})`,
      recommendations,
      insights,
      nextSteps
    };
  }

  private async handleGeneralConsultation(
    context: ConsultationContext,
    query: string
  ): Promise<ConsultantResponse> {
    return {
      success: true,
      message: `Hello! I'm your REZ travel consultant. I'd be happy to help you plan your perfect trip.\n\nI can assist with:\n\n**Destination Recommendations** - Tell me your preferences and I'll suggest ideal destinations.\n\n**Itinerary Planning** - I can create detailed day-by-day plans for your trip.\n\n**Budget Optimization** - Get the most value from your travel budget.\n\n**Activity Suggestions** - Find the best experiences and tours.\n\n**Accommodation Guidance** - Choose the perfect place to stay.\n\n**Seasonal Advice** - Find the best time to visit your destination.\n\n**Group Travel** - Plan trips for families, friends, or teams.\n\nWhat would you like help with today?`,
      recommendations: [],
      insights: [],
      nextSteps: [
        { action: 'start_planning', description: 'Tell me about your travel preferences', priority: 'high', estimatedTime: '5 minutes' }
      ]
    };
  }

  private formatDestinationRecommendations(destinations: Recommendation[]): string {
    if (destinations.length === 0) {
      return "I couldn't find specific destination recommendations. Could you provide more details about your preferences, budget, or travel dates?";
    }

    let message = "Based on your preferences, here are my top destination recommendations:\n\n";

    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      message += `${i + 1}. **${dest.name}** (${dest.matchScore}% match)\n`;
      message += `   ${dest.description}\n`;
      message += `   Why: ${dest.rationale}\n`;
      message += `   Budget: $${dest.priceRange.min.toFixed(0)}-${dest.priceRange.max.toFixed(0)}/person\n`;
      if (dest.tags.length > 0) {
        message += `   Tags: ${dest.tags.join(', ')}\n`;
      }
      message += "\n";
    }

    message += "Would you like more details on unknown of these destinations?";
    return message;
  }

  private calculateDuration(dates: { start: Date; end: Date } | null): number {
    if (!dates) return 5;
    return Math.ceil((dates.end.getTime() - dates.start.getTime()) / (1000 * 60 * 60 * 24));
  }

  private getSeasonalAdvice(destination: string): {
    summary: string;
    bestMonths: Array<{ name: string; description: string; matchScore: number; highlights: string[]; considerations: string[] }>;
    weatherSummary: string;
    crowdAdvice: string;
    priceAdvice: string;
  } {
    const seasonalData: Record<string, unknown> = {
      'bali': {
        summary: 'Bali offers year-round travel opportunities, with the dry season (April-October) being ideal for beach activities and the wet season (November-March) offering lush landscapes at lower prices.',
        bestMonths: [
          { name: 'April-May', description: 'Best overall - dry weather, fewer crowds, good prices', matchScore: 95, highlights: ['Perfect weather', 'Lower prices'], considerations: [] },
          { name: 'June-August', description: 'Peak season - best weather but higher prices', matchScore: 85, highlights: ['Best weather', 'Many festivals'], considerations: ['Higher prices', 'More crowds'] },
          { name: 'September-October', description: 'Shoulder season - great value, good weather', matchScore: 90, highlights: ['Lower crowds', 'Good prices'], considerations: [] }
        ],
        weatherSummary: 'Tropical climate with average temperatures of 26-30C. Wet season brings daily short bursts of rain, usually in the afternoon.',
        crowdAdvice: 'Peak season (June-August) sees the most tourists. Shoulder seasons (April-May, September-October) offer a balance of good weather and fewer crowds.',
        priceAdvice: 'Prices are 20-30% higher during peak season. Book accommodations 2-3 months ahead for best rates during high season.'
      },
      'default': {
        summary: 'The best time to visit depends on your priorities. Consider weather, crowds, and prices when planning your trip.',
        bestMonths: [
          { name: 'Spring (Mar-May)', description: 'Pleasant weather, moderate crowds', matchScore: 80, highlights: ['Good weather', 'Beautiful scenery'], considerations: [] },
          { name: 'Fall (Sep-Nov)', description: 'Comfortable temperatures, fewer tourists', matchScore: 85, highlights: ['Lower crowds', 'Mild weather'], considerations: [] }
        ],
        weatherSummary: 'Weather varies by destination. Check specific location for accurate forecasts.',
        crowdAdvice: 'Avoid major holidays and school vacation periods for fewer crowds.',
        priceAdvice: 'Book in advance and be flexible with dates to find the best deals.'
      }
    };

    return seasonalData[destination.toLowerCase()] || seasonalData['default'];
  }

  private getGroupActivities(groupSize: number): Array<{
    id: string;
    name: string;
    description: string;
    rationale: string;
    matchScore: number;
    priceRange: { min: number; max: number };
    highlights: string[];
    considerations: string[];
  }> {
    return [
      {
        id: uuidv4(),
        name: 'Private Group Tour',
        description: 'Customized tour designed specifically for your group with a dedicated guide.',
        rationale: `Perfect for ${groupSize} people - allows flexibility and personalized attention.`,
        matchScore: 92,
        priceRange: { min: 50 * groupSize, max: 100 * groupSize },
        highlights: ['Private guide', 'Customizable itinerary', 'Comfortable transport'],
        considerations: ['Book at least 1 week ahead']
      },
      {
        id: uuidv4(),
        name: 'Team Building Activity',
        description: 'Professional team-building exercises designed for groups.',
        rationale: 'Great for fostering teamwork and creating shared memories.',
        matchScore: 88,
        priceRange: { min: 30 * groupSize, max: 60 * groupSize },
        highlights: ['Professional facilitator', 'Various activities', 'Fun and engaging'],
        considerations: ['May require advance planning']
      },
      {
        id: uuidv4(),
        name: 'Cooking Class',
        description: 'Learn to prepare local cuisine as a group.',
        rationale: 'Interactive experience that everyone can enjoy together.',
        matchScore: 85,
        priceRange: { min: 40 * groupSize, max: 70 * groupSize },
        highlights: ['Hands-on', 'Includes meal', 'Take recipes home'],
        considerations: []
      }
    ];
  }

  private recordSession(sessionId: string, type: ConsultationType, query: string, response: ConsultantResponse): void {
    const session: ConsultationSession = {
      id: sessionId,
      type,
      query,
      response: response.message,
      recommendationsCount: response.recommendations.length,
      createdAt: new Date()
    };

    this.consultationHistory.set(sessionId, session);
  }
}

interface ConsultationSession {
  id: string;
  type: ConsultationType;
  query: string;
  response: string;
  recommendationsCount: number;
  createdAt: Date;
}

export const consultantAgent = new ConsultantAgent();
