import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import {
  CustomerProfile,
  TravelStyle,
  Recommendation,
  Itinerary,
  ItineraryDay,
  ItineraryActivity,
  MealRecommendation
} from './consultantAgent';

/**
 * Generate a random number between 0 and 1 using crypto
 */
function cryptoRandom(): number {
  return Number(randomBytes(4).readUInt32BE(0)) / 0xFFFFFFFF;
}

interface DestinationRecommendationParams {
  budget?: number;
  travelStyle?: TravelStyle;
  preferredActivities?: string[];
  groupSize?: number;
  travelDates?: { start: Date; end: Date } | null;
}

interface ItineraryParams {
  destination: string;
  startDate: Date;
  endDate: Date;
  travelStyle: TravelStyle;
  budget: number;
  groupSize: number;
  preferences: string[];
}

interface ActivityRecommendationParams {
  destination: string;
  travelStyle: TravelStyle;
  budget: number;
  groupSize: number;
  preferences: string[];
}

interface AccommodationParams {
  destination: string;
  travelStyle: TravelStyle;
  budget: number;
  groupSize: number;
  amenities?: string[];
}

interface BudgetParams {
  totalBudget: number;
  duration: number;
  travelStyle: TravelStyle;
  groupSize: number;
  destination: string;
}

const DESTINATIONS = [
  {
    id: 'dest_001',
    name: 'Bali, Indonesia',
    country: 'Indonesia',
    description: 'A tropical paradise with stunning beaches, ancient temples, lush rice terraces, and a vibrant arts scene.',
    priceRange: { min: 800, max: 2500 },
    bestMonths: ['April', 'May', 'June', 'September', 'October'],
    tags: ['beach', 'culture', 'nature', 'adventure', 'spiritual'],
    activities: ['surfing', 'temple visits', 'rice terrace walks', 'yoga', 'diving'],
    matchProfiles: ['adventure', 'cultural', 'relaxation'],
    highlights: ['Ubud rice terraces', 'Tanah Lot temple', 'Beach clubs', 'Traditional dances'],
    considerations: ['Can be crowded during peak season', 'Traffic in south Bali can be bad', 'Some areas have limited infrastructure']
  },
  {
    id: 'dest_002',
    name: 'Tokyo, Japan',
    country: 'Japan',
    description: 'A fascinating blend of ultra-modern and traditional, from neon-lit skyscrapers to historic temples.',
    priceRange: { min: 1500, max: 4000 },
    bestMonths: ['March', 'April', 'May', 'October', 'November'],
    tags: ['culture', 'food', 'technology', 'urban', 'history'],
    activities: ['temple visits', 'food tours', 'shopping', 'anime culture', 'gardens'],
    matchProfiles: ['cultural', 'mid_range', 'business'],
    highlights: ['Senso-ji temple', 'Shibuya crossing', 'Tsukiji market', 'Mt. Fuji day trip'],
    considerations: ['Language barrier outside tourist areas', 'Expensive compared to SE Asia', 'Crowded during cherry blossom season']
  },
  {
    id: 'dest_003',
    name: 'Santorini, Greece',
    country: 'Greece',
    description: 'Iconic white-washed buildings, stunning sunsets, crystal-clear waters, and world-class cuisine.',
    priceRange: { min: 1200, max: 3500 },
    bestMonths: ['May', 'June', 'September', 'October'],
    tags: ['romantic', 'beach', 'luxury', 'scenic', 'food'],
    activities: ['sunset viewing', 'wine tasting', 'boat tours', 'beach hopping', 'hiking'],
    matchProfiles: ['romantic', 'luxury', 'relaxation'],
    highlights: ['Oia sunset', 'Red Beach', 'Ancient Akrotiri', 'Local wineries'],
    considerations: ['Very expensive during peak season', 'Very crowded at sunset spots', 'Steep terrain - wear good shoes']
  },
  {
    id: 'dest_004',
    name: 'Marrakech, Morocco',
    country: 'Morocco',
    description: 'An exotic blend of ancient medinas, vibrant souks, stunning palaces, and the Atlas Mountains.',
    priceRange: { min: 600, max: 1800 },
    bestMonths: ['March', 'April', 'May', 'October', 'November'],
    tags: ['culture', 'adventure', 'food', 'history', 'markets'],
    activities: ['souk shopping', 'desert tours', 'cooking classes', 'hammam spa', 'architecture tours'],
    matchProfiles: ['cultural', 'adventure', 'budget', 'mid_range'],
    highlights: ['Jemaa el-Fna square', 'Majorelle Garden', 'Atlas Mountains day trip', 'Traditional riad stay'],
    considerations: ['Bargaining expected in souks', 'Can be overwhelming for first-timers', 'Hottest in summer months']
  },
  {
    id: 'dest_005',
    name: 'Queenstown, New Zealand',
    country: 'New Zealand',
    description: 'The adventure capital of the world, surrounded by stunning alpine scenery and pristine lakes.',
    priceRange: { min: 1800, max: 4500 },
    bestMonths: ['December', 'January', 'February', 'June', 'July'],
    tags: ['adventure', 'nature', 'scenic', 'wine', 'extreme'],
    activities: ['bungee jumping', 'skiing', 'hiking', 'jet boating', 'wine tours'],
    matchProfiles: ['adventure', 'family'],
    highlights: ['Milford Sound', 'Bungee jumping', 'Ski resorts', 'Lord of the Rings filming locations'],
    considerations: ['Expensive destination', 'Remote locations require planning', 'Weather can change quickly']
  },
  {
    id: 'dest_006',
    name: 'Lisbon, Portugal',
    country: 'Portugal',
    description: 'A charming coastal city with stunning architecture, rich history, delicious cuisine, and vibrant nightlife.',
    priceRange: { min: 900, max: 2200 },
    bestMonths: ['April', 'May', 'June', 'September', 'October'],
    tags: ['culture', 'food', 'beach', 'history', 'nightlife'],
    activities: ['tram rides', 'fado music', 'pastel de nata tasting', 'beach days', 'day trips'],
    matchProfiles: ['cultural', 'budget', 'mid_range', 'solo'],
    highlights: ['Belem Tower', 'Alfama district', 'Sintra day trip', 'Local wine bars'],
    considerations: ['Hilly city - prepare for walking', 'Getting more popular = more crowds', 'Many stairs in historic areas']
  },
  {
    id: 'dest_007',
    name: 'Machu Picchu, Peru',
    country: 'Peru',
    description: 'The legendary Incan citadel set high in the Andes, one of the New Seven Wonders of the World.',
    priceRange: { min: 1200, max: 3500 },
    bestMonths: ['April', 'May', 'June', 'July', 'August', 'September'],
    tags: ['adventure', 'history', 'nature', 'cultural', 'hiking'],
    activities: ['trekking', 'ruins exploration', 'cultural tours', 'local markets', 'mountain biking'],
    matchProfiles: ['adventure', 'cultural', 'expert'],
    highlights: ['Sun Gate viewpoint', 'Inca Trail trek', 'Sacred Valley', 'Local Andean communities'],
    considerations: ['Altitude sickness risk', 'Permits required for Inca Trail', 'Weather unpredictable']
  },
  {
    id: 'dest_008',
    name: 'Phuket, Thailand',
    country: 'Thailand',
    description: 'Thailand largest island with beautiful beaches, vibrant nightlife, and excellent Thai cuisine.',
    priceRange: { min: 500, max: 1800 },
    bestMonths: ['November', 'December', 'January', 'February', 'March'],
    tags: ['beach', 'nightlife', 'food', 'adventure', 'budget'],
    activities: ['beach hopping', 'island tours', 'thai cooking', 'night markets', 'muay thai'],
    matchProfiles: ['budget', 'mid_range', 'family', 'solo'],
    highlights: ['Patong Beach', 'Phi Phi Islands', 'Big Buddha', 'Old Phuket Town'],
    considerations: ['Monsoon season (May-October)', 'Can be overpriced in tourist areas', 'Be aware of tuk-tuk pricing']
  }
];

const ACTIVITIES = [
  { id: 'act_001', name: 'Temple & Cultural Tour', category: 'culture', duration: '4 hours', priceRange: { min: 35, max: 75 }, description: 'Visit key cultural landmarks with an expert guide.', tags: ['cultural', 'history', 'guided'] },
  { id: 'act_002', name: 'Cooking Class', category: 'food', duration: '3 hours', priceRange: { min: 45, max: 95 }, description: 'Learn to prepare local cuisine from a professional chef.', tags: ['food', 'hands-on', 'culinary'] },
  { id: 'act_003', name: 'Sunset Sailing Cruise', category: 'water', duration: '3 hours', priceRange: { min: 60, max: 150 }, description: 'Relax on a boat while watching the sunset.', tags: ['romantic', 'relaxation', 'scenic'] },
  { id: 'act_004', name: 'Adventure Hiking', category: 'adventure', duration: '6 hours', priceRange: { min: 40, max: 90 }, description: 'Explore nature trails with stunning views.', tags: ['adventure', 'nature', 'fitness'] },
  { id: 'act_005', name: 'Local Market Tour', category: 'food', duration: '2 hours', priceRange: { min: 20, max: 45 }, description: 'Discover local flavors and street food.', tags: ['food', 'culture', 'budget-friendly'] },
  { id: 'act_006', name: 'Spa & Wellness', category: 'wellness', duration: '2 hours', priceRange: { min: 50, max: 200 }, description: 'Traditional spa treatment and relaxation.', tags: ['relaxation', 'wellness', 'luxury'] },
  { id: 'act_007', name: 'Photography Tour', category: 'culture', duration: '4 hours', priceRange: { min: 55, max: 120 }, description: 'Capture the best spots with a professional photographer.', tags: ['photography', 'cultural', 'memorable'] },
  { id: 'act_008', name: 'Diving/ Snorkeling', category: 'water', duration: '4 hours', priceRange: { min: 70, max: 150 }, description: 'Explore underwater worlds and marine life.', tags: ['water', 'adventure', 'nature'] }
];

const ACCOMMODATIONS = [
  { id: 'acc_001', name: 'Luxury Resort', category: 'luxury', priceRange: { min: 200, max: 800 }, description: 'Premium amenities, ocean views, and world-class service.', tags: ['luxury', 'spa', 'beachfront'] },
  { id: 'acc_002', name: 'Boutique Hotel', category: 'mid_range', priceRange: { min: 80, max: 200 }, description: 'Stylish rooms with local character and personalized service.', tags: ['boutique', 'charming', 'central'] },
  { id: 'acc_003', name: 'Guesthouse/ Homestay', category: 'budget', priceRange: { min: 25, max: 60 }, description: 'Local hospitality and authentic cultural experiences.', tags: ['budget', 'local', 'homely'] },
  { id: 'acc_004', name: 'Vacation Rental', category: 'varied', priceRange: { min: 60, max: 300 }, description: 'Full apartment or villa with kitchen and living space.', tags: ['family', 'group', 'independent'] },
  { id: 'acc_005', name: 'Eco-Lodge', category: 'sustainable', priceRange: { min: 70, max: 180 }, description: 'Sustainable accommodations in natural settings.', tags: ['eco', 'nature', 'sustainable'] }
];

export async function getDestinationRecommendations(
  customer: CustomerProfile | null,
  params: DestinationRecommendationParams
): Promise<Recommendation[]> {
  const budget = params.budget || 2000;
  const travelStyle = params.travelStyle || TravelStyle.MID_RANGE;
  const groupSize = params.groupSize || 2;

  const scoredDestinations = DESTINATIONS.map(dest => {
    let score = 50;

    if (budget >= dest.priceRange.min && budget <= dest.priceRange.max) {
      score += 25;
    } else if (budget > dest.priceRange.max) {
      score += 10;
    }

    if (travelStyle === dest.matchProfiles.includes(travelStyle)) {
      score += 20;
    }

    if (params.preferredActivities && params.preferredActivities.length > 0) {
      const matchingActivities = dest.activities.filter(a =>
        params.preferredActivities!.some(p => a.includes(p))
      );
      score += matchingActivities.length * 5;
    }

    if (customer?.pastTrips) {
      const visitedDest = customer.pastTrips.find(t => t.destination === dest.name);
      if (visitedDest) {
        score -= 20;
      }
    }

    const perPersonBudget = budget / groupSize;
    if (perPersonBudget >= dest.priceRange.min && perPersonBudget <= dest.priceRange.max) {
      score += 15;
    }

    return { destination: dest, score: Math.min(100, Math.max(0, score)) };
  });

  return scoredDestinations
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ destination, score }) => ({
      type: 'destination' as const,
      id: destination.id,
      name: destination.name,
      description: destination.description,
      rationale: `Best match for ${travelStyle} travel within your budget of $${budget}`,
      matchScore: Math.round(score),
      priceRange: destination.priceRange,
      tags: destination.tags,
      highlights: destination.highlights,
      considerations: destination.considerations
    }));
}

export async function generateItinerary(params: ItineraryParams): Promise<Itinerary> {
  const { destination, startDate, endDate, travelStyle, budget, groupSize, preferences } = params;

  const daysCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const days: ItineraryDay[] = [];
  const activities = getActivitiesForStyle(travelStyle);
  const dailyBudget = budget / daysCount;

  for (let day = 1; day <= daysCount; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + day - 1);

    const dayActivities: ItineraryActivity[] = [];
    const selectedActivities = selectActivitiesForDay(activities, day, dailyBudget);

    for (const act of selectedActivities) {
      dayActivities.push({
        time: getTimeSlot(dayActivities.length),
        name: act.name,
        duration: act.duration,
        location: `${destination} - Location TBD`,
        cost: Math.round((cryptoRandom() * (act.priceRange.max - act.priceRange.min) + act.priceRange.min) * 100) / 100,
        bookingRequired: act.priceRange.max > 100,
        notes: `Suggested: Book in advance for best availability`
      });
    }

    const meals: MealRecommendation[] = [
      {
        meal: 'breakfast',
        recommendedVenue: 'Local cafe or hotel breakfast',
        cuisine: 'Local',
        priceRange: '$10-20',
        distance: 'Walking distance',
        notes: 'Start your day with local flavors'
      },
      {
        meal: 'lunch',
        recommendedVenue: 'Recommended restaurant',
        cuisine: 'Local/International',
        priceRange: '$15-30',
        distance: '10-15 min',
        notes: 'Try the local specialties'
      },
      {
        meal: 'dinner',
        recommendedVenue: 'Fine dining or local eatery',
        cuisine: 'Fine Local',
        priceRange: '$25-60',
        distance: '15-20 min',
        notes: 'End the day with a memorable meal'
      }
    ];

    days.push({
      day,
      date: date.toISOString().split('T')[0],
      title: getDayTheme(day, daysCount),
      activities: dayActivities,
      meals,
      transportNotes: ['Consider local transport or pre-booked transfers'],
      tips: [`Day ${day} tip: ${getDayTip(day)}`]
    });
  }

  const totalCost = days.reduce((sum, d) =>
    sum + d.activities.reduce((aSum, a) => aSum + a.cost, 0), 0
  );

  return {
    id: uuidv4(),
    title: `${daysCount}-Day ${destination} Adventure`,
    days,
    totalBudget: budget,
    estimatedCost: Math.round(totalCost * 100) / 100,
    tips: [
      'Book popular activities in advance',
      'Keep some flexibility for spontaneous discoveries',
      'Start each day early to maximize time'
    ],
    warnings: [
      'Check weather forecast before outdoor activities',
      'Confirm all bookings 24 hours in advance'
    ],
    createdAt: new Date()
  };
}

export async function getActivityRecommendations(params: ActivityRecommendationParams): Promise<Array<{
  id: string;
  name: string;
  description: string;
  rationale: string;
  matchScore: number;
  priceRange: { min: number; max: number };
  estimatedDuration?: string;
  tags: string[];
  highlights: string[];
  considerations: string[];
}>> {
  const { destination, travelStyle, budget, groupSize, preferences } = params;

  const perPersonBudget = budget / groupSize;

  const scoredActivities = ACTIVITIES.map(act => {
    let score = 50;

    if (act.priceRange.max <= perPersonBudget * 0.3) {
      score += 25;
    }

    const styleMatch = getActivitiesForStyle(travelStyle);
    if (styleMatch.includes(act)) {
      score += 20;
    }

    if (preferences && preferences.length > 0) {
      const matchCount = act.tags.filter(t =>
        preferences.some(p => t.includes(p))
      ).length;
      score += matchCount * 10;
    }

    return { activity: act, score: Math.min(100, Math.max(0, score)) };
  });

  return scoredActivities
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ activity, score }) => ({
      id: activity.id,
      name: activity.name,
      description: activity.description,
      rationale: `Perfect for ${travelStyle.replace('_', ' ')} travelers`,
      matchScore: Math.round(score),
      priceRange: {
        min: activity.priceRange.min * groupSize,
        max: activity.priceRange.max * groupSize
      },
      estimatedDuration: activity.duration,
      tags: activity.tags,
      highlights: getActivityHighlights(activity),
      considerations: getActivityConsiderations(activity)
    }));
}

export async function getAccommodationRecommendations(params: AccommodationParams): Promise<Array<{
  id: string;
  name: string;
  description: string;
  rationale: string;
  matchScore: number;
  priceRange: { min: number; max: number };
  tags: string[];
  highlights: string[];
  considerations: string[];
}>> {
  const { destination, travelStyle, budget, groupSize, amenities } = params;

  const nightlyBudget = budget / 5;
  const perPersonBudget = nightlyBudget / groupSize;

  const scoredAccommodations = ACCOMMODATIONS.map(acc => {
    let score = 50;

    if (acc.category === 'luxury' && (travelStyle === TravelStyle.LUXURY || travelStyle === TravelStyle.ROMANTIC)) {
      score += 30;
    }
    if (acc.category === 'budget' && (travelStyle === TravelStyle.BUDGET || travelStyle === TravelStyle.SOLO)) {
      score += 30;
    }
    if (acc.category === 'mid_range' && travelStyle === TravelStyle.MID_RANGE) {
      score += 30;
    }
    if (acc.category === 'varied' && groupSize > 3) {
      score += 25;
    }

    if (acc.priceRange.max <= perPersonBudget) {
      score += 20;
    }

    if (amenities && amenities.length > 0) {
      const matchCount = acc.tags.filter(t =>
        amenities.some(a => t.includes(a))
      ).length;
      score += matchCount * 5;
    }

    return { accommodation: acc, score: Math.min(100, Math.max(0, score)) };
  });

  return scoredAccommodations
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ accommodation, score }) => ({
      id: accommodation.id,
      name: accommodation.name,
      description: accommodation.description,
      rationale: `Best ${accommodation.category} option for ${travelStyle.replace('_', ' ')}`,
      matchScore: Math.round(score),
      priceRange: {
        min: accommodation.priceRange.min * groupSize,
        max: accommodation.priceRange.max * groupSize
      },
      tags: accommodation.tags,
      highlights: getAccommodationHighlights(accommodation),
      considerations: getAccommodationConsiderations(accommodation)
    }));
}

export function optimizeBudget(params: BudgetParams): {
  breakdown: Record<string, { amount: number; percentage: number; tips: string[] }>;
  potentialSavings: number;
  recommendations: string[];
} {
  const { totalBudget, duration, travelStyle, groupSize, destination } = params;

  const perPersonBudget = totalBudget / groupSize;
  const dailyBudget = totalBudget / duration;

  const baseAllocation: Record<string, { percent: number; tips: string[] }> = {
    accommodation: {
      percent: travelStyle === TravelStyle.LUXURY ? 45 : travelStyle === TravelStyle.BUDGET ? 25 : 35,
      tips: ['Book directly for better rates', 'Consider longer stays for discounts', 'Check included amenities']
    },
    activities: {
      percent: travelStyle === TravelStyle.ADVENTURE ? 30 : travelStyle === TravelStyle.RELAXATION ? 15 : 25,
      tips: ['Book popular tours early', 'Look for combo deals', 'Some activities have student/senior discounts']
    },
    food: {
      percent: 20,
      tips: ['Eat where locals eat', 'Try street food for budget meals', 'Lunch specials are often cheaper']
    },
    transport: {
      percent: 10,
      tips: ['Use public transport when possible', 'Book airport transfers in advance', 'Consider renting for longer stays']
    },
    contingency: {
      percent: 5,
      tips: ['Keep as emergency fund', 'Useful for unexpected opportunities', 'Leftover can be saved for next trip']
    }
  };

  const breakdown: Record<string, { amount: number; percentage: number; tips: string[] }> = {};

  for (const [category, config] of Object.entries(baseAllocation)) {
    breakdown[category] = {
      amount: Math.round(totalBudget * config.percent / 100 * 100) / 100,
      percentage: config.percent,
      tips: config.tips
    };
  }

  const potentialSavings = totalBudget * 0.15;

  const recommendations: string[] = [];
  if (travelStyle !== TravelStyle.LUXURY) {
    recommendations.push('Travel during shoulder season for 20-30% savings');
  }
  recommendations.push('Book accommodations with free cancellation');
  recommendations.push('Use price comparison tools for flights');
  recommendations.push('Consider alternative airports for cheaper flights');

  return { breakdown, potentialSavings: Math.round(potentialSavings * 100) / 100, recommendations };
}

function getActivitiesForStyle(style: TravelStyle): typeof ACTIVITIES {
  const styleMap: Record<TravelStyle, string[]> = {
    [TravelStyle.BUDGET]: ['act_005', 'act_001'],
    [TravelStyle.MID_RANGE]: ['act_001', 'act_002', 'act_004', 'act_005'],
    [TravelStyle.LUXURY]: ['act_003', 'act_006', 'act_007'],
    [TravelStyle.ADVENTURE]: ['act_004', 'act_008'],
    [TravelStyle.RELAXATION]: ['act_003', 'act_006'],
    [TravelStyle.CULTURAL]: ['act_001', 'act_005', 'act_007'],
    [TravelStyle.FAMILY]: ['act_001', 'act_005'],
    [TravelStyle.ROMANTIC]: ['act_003', 'act_006'],
    [TravelStyle.SOLO]: ['act_005', 'act_004'],
    [TravelStyle.BUSINESS]: ['act_001']
  };

  const ids = styleMap[style] || styleMap[TravelStyle.MID_RANGE];
  return ACTIVITIES.filter(a => ids.includes(a.id));
}

function selectActivitiesForDay(activities: typeof ACTIVITIES, day: number, dailyBudget: number): typeof ACTIVITIES {
  const selected: typeof ACTIVITIES = [];
  let budgetUsed = 0;

  for (const activity of activities) {
    const avgPrice = (activity.priceRange.min + activity.priceRange.max) / 2;
    if (budgetUsed + avgPrice <= dailyBudget * 0.4) {
      selected.push(activity);
      budgetUsed += avgPrice;
    }
    if (selected.length >= 2) break;
  }

  return selected;
}

function getTimeSlot(index: number): string {
  const slots = ['09:00', '11:30', '14:00', '16:30'];
  return slots[index] || '14:00';
}

function getDayTheme(day: number, totalDays: number): string {
  const themes = [
    'Arrival & Exploration',
    'Cultural Immersion',
    'Adventure Day',
    'Local Experience',
    'Relaxation & Leisure',
    'Hidden Gems',
    'Culinary Journey'
  ];

  if (day === 1) return 'Arrival & Exploration';
  if (day === totalDays) return 'Final Day & Departure';
  return themes[(day - 2) % themes.length] || 'Discovery Day';
}

function getDayTip(day: number): string {
  const tips = [
    'Start early to beat the crowds at popular spots',
    'Take breaks between activities to stay refreshed',
    'Try to interact with locals for authentic experiences',
    'Keep your camera ready for unexpected photo opportunities',
    'Stay hydrated and protect yourself from the sun'
  ];
  return tips[(day - 1) % tips.length];
}

function getActivityHighlights(activity: typeof ACTIVITIES[0]): string[] {
  const highlights: Record<string, string[]> = {
    'act_001': ['Expert local guide', 'Skip-the-line access', 'Cultural insights'],
    'act_002': ['Hands-on cooking', 'Recipe booklet included', 'Lunch of your creation'],
    'act_003': ['Drinks included', 'Stunning views', 'Swimming opportunities'],
    'act_004': ['All fitness levels welcome', 'Safety equipment provided', 'Breathtaking scenery'],
    'act_005': ['Local food expert', 'Hidden gems included', 'Great for food lovers'],
    'act_006': ['Premium products', 'Relaxing atmosphere', 'Traditional techniques'],
    'act_007': ['Professional photographer', 'Best photo spots', 'Editing tips included'],
    'act_008': ['Equipment provided', 'Marine life guaranteed', 'Beginners welcome']
  };
  return highlights[activity.id] || ['Professional guide', 'Small group'];
}

function getActivityConsiderations(activity: typeof ACTIVITIES[0]): string[] {
  const considerations: Record<string, string[]> = {
    'act_001': ['Comfortable walking shoes recommended'],
    'act_002': ['Dietary restrictions can be accommodated'],
    'act_003': ['Sunscreen and swimwear recommended'],
    'act_004': ['Moderate fitness level required'],
    'act_005': ['Bring an appetite'],
    'act_006': ['Book in advance for best times'],
    'act_007': ['Bring your own camera'],
    'act_008': ['Swimming ability required']
  };
  return considerations[activity.id] || [];
}

function getAccommodationHighlights(acc: typeof ACCOMMODATIONS[0]): string[] {
  const highlights: Record<string, string[]> = {
    'acc_001': ['Ocean views', 'Private beach', 'Butler service'],
    'acc_002': ['Central location', 'Local charm', 'Personalized service'],
    'acc_003': ['Local hosts', 'Authentic experience', 'Great value'],
    'acc_004': ['Full kitchen', 'Living space', 'Privacy'],
    'acc_005': ['Sustainable practices', 'Nature setting', 'Unique experience']
  };
  return highlights[acc.id] || ['Great amenities'];
}

function getAccommodationConsiderations(acc: typeof ACCOMMODATIONS[0]): string[] {
  const considerations: Record<string, string[]> = {
    'acc_001': ['Premium pricing'],
    'acc_002': ['Book early for best rooms'],
    'acc_003': ['Basic amenities'],
    'acc_004': ['Self-catering'],
    'acc_005': ['Remote locations']
  };
  return considerations[acc.id] || [];
}
