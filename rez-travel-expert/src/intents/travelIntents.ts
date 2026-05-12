import { TravelStyle, BudgetLevel, TripDuration } from '../services/travelExpert';

export interface TravelIntent {
  id: string;
  name: string;
  patterns: string[];
  requiredEntities: string[];
  optionalEntities: string[];
  priority: number;
}

export const TRAVEL_INTENTS: TravelIntent[] = [
  {
    id: 'destination_search',
    name: 'Search Destination',
    patterns: [
      'where should i go',
      'recommend a destination',
      'looking for travel ideas',
      'suggest a place',
      'best destinations',
      'show me destinations',
      'what places should i visit',
      'find me a destination',
      'i want to travel somewhere',
      'need travel inspiration'
    ],
    requiredEntities: [],
    optionalEntities: ['budget', 'travelers', 'styles', 'duration'],
    priority: 10
  },
  {
    id: 'destination_info',
    name: 'Get Destination Info',
    patterns: [
      'tell me about {destination}',
      'info on {destination}',
      'what is {destination} like',
      '{destination} details',
      'about {destination}',
      'learn about {destination}',
      'information on {destination}'
    ],
    requiredEntities: ['destination'],
    optionalEntities: [],
    priority: 9
  },
  {
    id: 'itinerary_planning',
    name: 'Plan Itinerary',
    patterns: [
      'plan my trip',
      'create an itinerary',
      'what should i do',
      'suggest activities',
      'day by day plan',
      'schedule for my trip',
      'plan my days',
      'help me plan',
      'create a schedule',
      'make an itinerary'
    ],
    requiredEntities: [],
    optionalEntities: ['destination', 'duration', 'styles'],
    priority: 8
  },
  {
    id: 'transport_search',
    name: 'Search Transport',
    patterns: [
      'how do i get to {destination}',
      'flights to {destination}',
      'train to {destination}',
      'transportation options',
      'book a flight',
      'find flights',
      'cheapest way to get there',
      'get to {destination}',
      'travel options'
    ],
    requiredEntities: ['destination'],
    optionalEntities: ['date', 'travelers'],
    priority: 7
  },
  {
    id: 'accommodation_search',
    name: 'Search Accommodation',
    patterns: [
      'find a hotel in {destination}',
      'where should i stay',
      'book accommodation',
      'hotels in {destination}',
      'accommodation options',
      'resort in {destination}',
      'vacation rental',
      'best areas to stay',
      'hotel recommendations'
    ],
    requiredEntities: ['destination'],
    optionalEntities: ['budget', 'dates'],
    priority: 7
  },
  {
    id: 'budget_planning',
    name: 'Budget Planning',
    patterns: [
      'how much does it cost',
      'budget for {destination}',
      'estimate the cost',
      'how expensive is {destination}',
      'trip cost',
      'price range',
      'affordable options',
      'is it expensive',
      'cost breakdown'
    ],
    requiredEntities: ['destination'],
    optionalEntities: ['duration', 'travelers', 'styles'],
    priority: 6
  },
  {
    id: 'seasonal_advice',
    name: 'Seasonal Advice',
    patterns: [
      'when is the best time',
      'weather in {destination}',
      'best season for {destination}',
      'should i go in {month}',
      'is it rainy season',
      'is it tourist season',
      'off season',
      'peak season',
      'climate information'
    ],
    requiredEntities: ['destination'],
    optionalEntities: ['date'],
    priority: 5
  },
  {
    id: 'packing_guidance',
    name: 'Packing Guidance',
    patterns: [
      'what should i pack',
      'packing list',
      'what to bring',
      'essentials to pack',
      'luggage tips',
      'clothing recommendations',
      'gear suggestions'
    ],
    requiredEntities: [],
    optionalEntities: ['destination', 'duration', 'styles'],
    priority: 4
  },
  {
    id: 'visa_requirements',
    name: 'Visa Requirements',
    patterns: [
      'do i need a visa',
      'visa requirements',
      'travel documents',
      'passport requirements',
      'entry requirements',
      'visa for {destination}'
    ],
    requiredEntities: ['destination'],
    optionalEntities: ['nationality'],
    priority: 5
  },
  {
    id: 'safety_advisory',
    name: 'Safety Advisory',
    patterns: [
      'is it safe',
      'safety concerns',
      'travel warnings',
      'dangerous areas',
      'safety tips',
      'is {destination} safe'
    ],
    requiredEntities: ['destination'],
    optionalEntities: [],
    priority: 4
  },
  {
    id: 'booking_assistance',
    name: 'Booking Assistance',
    patterns: [
      'help me book',
      'make a reservation',
      'book for me',
      'i want to book',
      'complete my booking',
      'confirm my reservation'
    ],
    requiredEntities: [],
    optionalEntities: ['destination', 'date', 'type'],
    priority: 8
  },
  {
    id: 'local_recommendations',
    name: 'Local Recommendations',
    patterns: [
      'best restaurants',
      'local food',
      'where to eat',
      'hidden gems',
      'off the beaten path',
      'local tips',
      'authentic experiences',
      'recommendations from locals'
    ],
    requiredEntities: ['destination'],
    optionalEntities: ['category'],
    priority: 4
  }
];

export interface EntityExtraction {
  destination?: string;
  budget?: number;
  duration?: number;
  durationUnit?: string;
  travelers?: number;
  styles?: TravelStyle[];
  budgetLevel?: BudgetLevel;
  date?: Date;
  nationality?: string;
  category?: string;
}

export function extractEntities(message: string): EntityExtraction {
  const entities: EntityExtraction = {};

  const destinationPatterns = [
    { pattern: /maldives/i, id: 'maldives' },
    { pattern: /bali/i, id: 'bali' },
    { pattern: /swiss alps|switzerland/i, id: 'swiss-alps' },
    { pattern: /tokyo|japan/i, id: 'tokyo' },
    { pattern: /santorini|greece/i, id: 'santorini' },
    { pattern: /machu picchu|peru/i, id: 'machu-picchu' },
    { pattern: /dubai|uae/i, id: 'dubai' },
    { pattern: /patagonia/i, id: 'patagonia' }
  ];

  for (const { pattern, id } of destinationPatterns) {
    if (pattern.test(message)) {
      entities.destination = id;
      break;
    }
  }

  const budgetMatch = message.match(/\$?\s*(\d{2,5})(?:\s*(?:per day|night|person|pp|daily|nightly))?/i);
  if (budgetMatch) {
    entities.budget = parseInt(budgetMatch[1]);
  }

  const durationDayMatch = message.match(/(\d+)\s*(?:days?|nights?|days? trip|weeks? trip)/i);
  if (durationDayMatch) {
    const value = parseInt(durationDayMatch[1]);
    if (message.match(/week/i)) {
      entities.duration = value * 7;
      entities.durationUnit = 'week';
    } else {
      entities.duration = value;
      entities.durationUnit = 'day';
    }
  }

  const travelersMatch = message.match(/(\d+)\s*(?:people|travelers|adults?|kids?|children|passengers)/i);
  if (travelersMatch) {
    entities.travelers = parseInt(travelersMatch[1]);
  }

  const styleKeywords: Record<string, TravelStyle> = {
    'adventure': TravelStyle.ADVENTURE,
    'adventurous': TravelStyle.ADVENTURE,
    'relaxing': TravelStyle.RELAXATION,
    'relax': TravelStyle.RELAXATION,
    'beach': TravelStyle.RELAXATION,
    'cultural': TravelStyle.CULTURAL,
    'culture': TravelStyle.CULTURAL,
    'romantic': TravelStyle.ROMANTIC,
    'honeymoon': TravelStyle.ROMANTIC,
    'family': TravelStyle.FAMILY,
    'budget': TravelStyle.BUDGET,
    'budget-friendly': TravelStyle.BUDGET,
    'affordable': TravelStyle.BUDGET,
    'luxury': TravelStyle.LUXURY,
    'luxurious': TravelStyle.LUXURY,
    'upscale': TravelStyle.LUXURY,
    'food': TravelStyle.FOODIE,
    'foodie': TravelStyle.FOODIE,
    'culinary': TravelStyle.FOODIE,
    'nature': TravelStyle.NATURE,
    'outdoor': TravelStyle.NATURE,
    'eco': TravelStyle.NATURE
  };

  for (const [keyword, style] of Object.entries(styleKeywords)) {
    if (message.toLowerCase().includes(keyword)) {
      if (!entities.styles) entities.styles = [];
      if (!entities.styles.includes(style)) {
        entities.styles.push(style);
      }
    }
  }

  const budgetLevelKeywords: Record<string, BudgetLevel> = {
    'budget': BudgetLevel.BUDGET,
    'cheap': BudgetLevel.BUDGET,
    'affordable': BudgetLevel.BUDGET,
    'moderate': BudgetLevel.MODERATE,
    'mid-range': BudgetLevel.MODERATE,
    'average': BudgetLevel.MODERATE,
    'luxury': BudgetLevel.LUXURY,
    'luxurious': BudgetLevel.LUXURY,
    'expensive': BudgetLevel.LUXURY,
    'upscale': BudgetLevel.LUXURY,
    'premium': BudgetLevel.LUXURY
  };

  for (const [keyword, level] of Object.entries(budgetLevelKeywords)) {
    if (message.toLowerCase().includes(keyword)) {
      entities.budgetLevel = level;
      break;
    }
  }

  return entities;
}

export function matchIntent(message: string): TravelIntent | null {
  const lowerMessage = message.toLowerCase();

  let bestMatch: TravelIntent | null = null;
  let highestScore = 0;

  for (const intent of TRAVEL_INTENTS) {
    let matchCount = 0;

    for (const pattern of intent.patterns) {
      const patternLower = pattern.toLowerCase();

      if (patternLower.includes('{destination}') || patternLower.includes('{month}')) {
        const regexPattern = patternLower.replace(/\{[^}]+\}/g, '[^\\s]+');
        const regex = new RegExp(regexPattern, 'i');
        if (regex.test(lowerMessage)) {
          matchCount += 2;
        }
      } else {
        const words = patternLower.split(' ');
        const matchingWords = words.filter(word => lowerMessage.includes(word));
        matchCount += matchingWords.length / words.length;
      }
    }

    const score = (matchCount / intent.patterns.length) * intent.priority;

    if (score > highestScore) {
      highestScore = score;
      bestMatch = intent;
    }
  }

  return highestScore >= 0.3 ? bestMatch : null;
}
