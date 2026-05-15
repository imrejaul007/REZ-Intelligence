/**
 * DOOH Intelligence - Targeting Service
 * Find and target users for DOOH screens based on intent and demographics
 */

import axios from 'axios';
import {
  DOOHTargetingRequest,
  DOOHTargetedUser,
  DOOHScreenType,
  getCaptivityIndex,
  SCREEN_CAPTIVITY_MAP,
} from '../types';

// ============================================================================
// SERVICE URLs
// ============================================================================

const INTENT_GRAPH_URL = process.env.INTENT_GRAPH_URL || 'http://localhost:3001';
const IDENTITY_GRAPH_URL = process.env.IDENTITY_GRAPH_URL || 'http://localhost:4050';
const RFM_SERVICE_URL = process.env.RFM_SERVICE_URL || 'http://localhost:4055';

// ============================================================================
// TARGETING HELPERS
// ============================================================================

/**
 * Get screen audience profile
 */
function getScreenAudienceProfile(screenType: DOOHScreenType) {
  const captivity = getCaptivityIndex(screenType);

  // Define typical audience profiles by screen type
  const profiles: Record<DOOHScreenType, {
    demographics: { ageRange: string[]; income: string[] };
    contexts: string[];
    intentCategories: string[];
  }> = {
    // L1: Personal
    app_feed: {
      demographics: { ageRange: ['18-24', '25-34', '35-44'], income: ['low', 'medium', 'high'] },
      contexts: ['social', 'entertainment', 'shopping'],
      intentCategories: ['looking_for_food', 'entertainment', 'shopping'],
    },
    app_banner: {
      demographics: { ageRange: ['18-24', '25-34', '35-44'], income: ['low', 'medium', 'high'] },
      contexts: ['social', 'entertainment', 'shopping'],
      intentCategories: ['looking_for_food', 'entertainment', 'shopping'],
    },
    app_search: {
      demographics: { ageRange: ['25-34', '35-44', '45-54'], income: ['medium', 'high'] },
      contexts: ['intent_search', 'planning'],
      intentCategories: ['looking_for_service', 'booking', 'shopping'],
    },
    website: {
      demographics: { ageRange: ['25-34', '35-44', '45-54'], income: ['medium', 'high'] },
      contexts: ['research', 'planning'],
      intentCategories: ['looking_for_service', 'booking'],
    },

    // L2: Captive Private
    hotel_tv: {
      demographics: { ageRange: ['25-34', '35-44', '45-54'], income: ['high'] },
      contexts: ['travel', 'business', 'leisure', 'dining'],
      intentCategories: ['looking_for_dining', 'entertainment', 'travel_services', 'local_services'],
    },
    cab_screen: {
      demographics: { ageRange: ['22-34', '35-44'], income: ['medium', 'high'] },
      contexts: ['commuting', 'travel', 'dining'],
      intentCategories: ['looking_for_food', 'nearby_services', 'entertainment'],
    },
    flight_seat: {
      demographics: { ageRange: ['28-45', '45-54'], income: ['medium', 'high'] },
      contexts: ['travel', 'business', 'leisure'],
      intentCategories: ['looking_for_travel', 'entertainment', 'shopping_duty_free'],
    },
    bus_seat: {
      demographics: { ageRange: ['18-24', '25-34', '35-44'], income: ['low', 'medium'] },
      contexts: ['commuting', 'daily_routine'],
      intentCategories: ['daily_needs', 'budget_shopping', 'local_services'],
    },
    train_seat: {
      demographics: { ageRange: ['22-44'], income: ['low', 'medium', 'high'] },
      contexts: ['travel', 'commuting'],
      intentCategories: ['looking_for_travel', 'entertainment', 'food'],
    },
    rental_car_screen: {
      demographics: { ageRange: ['28-45'], income: ['medium', 'high'] },
      contexts: ['travel', 'road_trip', 'exploration'],
      intentCategories: ['looking_for_travel', 'local_attractions', 'dining'],
    },
    ev_charger_screen: {
      demographics: { ageRange: ['30-50'], income: ['high'] },
      contexts: ['tech', 'eco_conscious', 'planning'],
      intentCategories: ['looking_for_services', 'charging_stations', 'local_services'],
    },
    cruise_ship: {
      demographics: { ageRange: ['40-60'], income: ['high'] },
      contexts: ['luxury', 'entertainment', 'dining'],
      intentCategories: ['looking_for_luxury', 'entertainment', 'dining', 'spa'],
    },

    // L3: Semi-Captive
    mall_kiosk: {
      demographics: { ageRange: ['22-44'], income: ['medium', 'high'] },
      contexts: ['shopping', 'entertainment', 'food'],
      intentCategories: ['shopping', 'looking_for_food', 'entertainment'],
    },
    office_lobby: {
      demographics: { ageRange: ['25-44'], income: ['medium', 'high'] },
      contexts: ['work', 'professional', 'business'],
      intentCategories: ['food_delivery', 'office_supplies', 'wellness', 'services'],
    },
    university_display: {
      demographics: { ageRange: ['18-25'], income: ['low', 'medium'] },
      contexts: ['education', 'social', 'campus'],
      intentCategories: ['food', 'entertainment', 'education', 'tech'],
    },
    gym_screen: {
      demographics: { ageRange: ['22-45'], income: ['medium', 'high'] },
      contexts: ['fitness', 'health', 'wellness'],
      intentCategories: ['health', 'nutrition', 'wellness', 'sportswear'],
    },
    cinema_screen: {
      demographics: { ageRange: ['18-34'], income: ['medium', 'high'] },
      contexts: ['entertainment', 'social', 'dining'],
      intentCategories: ['entertainment', 'dining', 'looking_for_movies'],
    },
    restaurant_tv: {
      demographics: { ageRange: ['25-54'], income: ['medium', 'high'] },
      contexts: ['dining', 'celebration', 'social'],
      intentCategories: ['looking_for_food', 'celebration', 'entertainment'],
    },
    salon_display: {
      demographics: { ageRange: ['22-45'], income: ['medium', 'high'] },
      contexts: ['beauty', 'self_care', 'wellness'],
      intentCategories: ['beauty', 'self_care', 'wellness'],
    },
    hospital_display: {
      demographics: { ageRange: ['25-65'], income: ['low', 'medium', 'high'] },
      contexts: ['health', 'family', 'care'],
      intentCategories: ['healthcare', 'pharmacy', 'wellness'],
    },

    // L4: Public
    billboard_led: {
      demographics: { ageRange: ['18-65'], income: ['low', 'medium', 'high'] },
      contexts: ['commuting', 'traveling'],
      intentCategories: ['awareness', 'brands'],
    },
    bus_shelter: {
      demographics: { ageRange: ['18-55'], income: ['low', 'medium'] },
      contexts: ['commuting', 'waiting'],
      intentCategories: ['daily_needs', 'budget_services'],
    },
    street_pole: {
      demographics: { ageRange: ['18-65'], income: ['low'] },
      contexts: ['local', 'neighborhood'],
      intentCategories: ['local_services', 'daily_needs'],
    },
    atm_screen: {
      demographics: { ageRange: ['25-65'], income: ['medium', 'high'] },
      contexts: ['banking', 'transaction'],
      intentCategories: ['financial_services', 'convenience'],
    },
    public_park: {
      demographics: { ageRange: ['18-65'], income: ['low', 'medium'] },
      contexts: ['leisure', 'family'],
      intentCategories: ['family_services', 'local_events'],
    },
  };

  return profiles[screenType] || profiles.app_feed;
}

// ============================================================================
// SCORING
// ============================================================================

/**
 * Score a user for a DOOH screen
 */
function scoreUserForScreen(
  user: {
    userId: string;
    rfmSegment?: string;
    interests?: string[];
    recentIntents?: { intent: string; category: string }[];
  },
  screenType: DOOHScreenType
): { score: number; reasons: string[] } {
  const profile = getScreenAudienceProfile(screenType);
  let score = 50;
  const reasons: string[] = [];

  // RFM scoring
  if (user.rfmSegment) {
    if (user.rfmSegment === 'champions' || user.rfmSegment === 'loyal') {
      score += 20;
      reasons.push('High-value customer');
    } else if (user.rfmSegment === 'potential') {
      score += 10;
      reasons.push('Growth potential');
    }
  }

  // Interest matching
  if (user.interests) {
    const matchingInterests = user.interests.filter(interest =>
      profile.contexts.some(ctx =>
        ctx.toLowerCase().includes(interest.toLowerCase())
      )
    );
    score += matchingInterests.length * 10;
    reasons.push(...matchingInterests.map(i => `Interest: ${i}`));
  }

  // Intent matching
  if (user.recentIntents) {
    const matchingIntents = user.recentIntents.filter(intent =>
      profile.intentCategories.some(cat =>
        intent.category?.toLowerCase().includes(cat.toLowerCase()) ||
        intent.intent?.toLowerCase().includes(cat.toLowerCase())
      )
    );
    score += matchingIntents.length * 15;
    reasons.push(...matchingIntents.map(i => `Intent: ${i.intent || i.category}`));
  }

  // Normalize score
  score = Math.min(100, Math.max(0, score));

  return { score, reasons };
}

// ============================================================================
// MAIN TARGETING FUNCTION
// ============================================================================

export async function findTargetedUsers(
  request: DOOHTargetingRequest
): Promise<DOOHTargetedUser[]> {
  const { screenType, screenId, location, audienceCriteria, limit = 100 } = request;

  const profile = getScreenAudienceProfile(screenType);

  // Build search criteria
  const criteria: Record<string, unknown> = {};

  if (audienceCriteria?.rfmSegments?.length) {
    criteria.rfmSegments = audienceCriteria.rfmSegments;
  }

  if (audienceCriteria?.interests?.length) {
    criteria.interests = audienceCriteria.interests;
  }

  if (audienceCriteria?.ageRange) {
    criteria.ageRange = audienceCriteria.ageRange;
  }

  try {
    // Call RFM service to get users by segment
    let users: Array<{ userId: string; rfmSegment?: string; interests?: string[] }> = [];

    if (criteria.rfmSegments?.length) {
      const rfmResponse = await axios.get(`${RFM_SERVICE_URL}/api/rfm/segments`, {
        params: { segments: criteria.rfmSegments.join(',') },
        timeout: 5000,
      });
      users = rfmResponse.data.users || [];
    }

    // Get user intelligence for intent
    const targetedUsers: DOOHTargetedUser[] = [];

    for (const user of users.slice(0, limit)) {
      // Get user intents
      try {
        const intentResponse = await axios.get(
          `${INTENT_GRAPH_URL}/api/intent/active/${user.userId}`,
          { timeout: 3000 }
        );

        const intents = intentResponse.data.intents || [];
        const { score, reasons } = scoreUserForScreen(
          {
            ...user,
            recentIntents: intents.map((i: any) => ({
              intent: i.intentKey,
              category: i.category,
            })),
          },
          screenType
        );

        // Determine recommended ad categories based on match
        const recommendedAdCategories = profile.intentCategories.slice(0, 3);

        targetedUsers.push({
          userId: user.userId,
          matchScore: score,
          reasons,
          recommendedAdCategories,
          userContext: {
            rfmSegment: user.rfmSegment || 'unknown',
            topInterests: user.interests?.slice(0, 5) || [],
            recentIntents: intents.slice(0, 3).map((i: any) => i.intentKey),
          },
        });
      } catch {
        // User not found in intent graph - include with base score
        const { score, reasons } = scoreUserForScreen(user, screenType);

        targetedUsers.push({
          userId: user.userId,
          matchScore: score,
          reasons,
          recommendedAdCategories: profile.intentCategories.slice(0, 3),
          userContext: {
            rfmSegment: user.rfmSegment || 'unknown',
            topInterests: user.interests?.slice(0, 5) || [],
            recentIntents: [],
          },
        });
      }
    }

    // Sort by match score descending
    targetedUsers.sort((a, b) => b.matchScore - a.matchScore);

    return targetedUsers.slice(0, limit);
  } catch (error) {
    console.error('Error finding targeted users:', error);
    // Return mock data for development
    return generateMockTargetedUsers(screenType, limit);
  }
}

/**
 * Generate mock users for development
 */
function generateMockTargetedUsers(
  screenType: DOOHScreenType,
  limit: number
): DOOHTargetedUser[] {
  const profiles = getScreenAudienceProfile(screenType);
  const users: DOOHTargetedUser[] = [];

  const mockRfmSegments = ['champions', 'loyal', 'potential', 'at_risk'];

  for (let i = 0; i < Math.min(limit, 20); i++) {
    const score = Math.floor(Math.random() * 40) + 60; // 60-100
    const rfmSegment = mockRfmSegments[Math.floor(Math.random() * mockRfmSegments.length)];

    users.push({
      userId: `user_${screenType}_${i}`,
      matchScore: score,
      reasons: [
        `${rfmSegment === 'champions' || rfmSegment === 'loyal' ? 'High-value' : 'Potential'} customer`,
        `Likely interested in ${profiles.contexts[0]}`,
      ],
      recommendedAdCategories: profiles.intentCategories.slice(0, 3),
      userContext: {
        rfmSegment,
        topInterests: profiles.contexts.slice(0, 3),
        recentIntents: profiles.intentCategories.slice(0, 2),
      },
    });
  }

  return users.sort((a, b) => b.matchScore - a.matchScore);
}

// ============================================================================
// EXPORT SERVICE
// ============================================================================

export const doohTargetingService = {
  findTargetedUsers,
  getScreenAudienceProfile,
  scoreUserForScreen,
};

export default doohTargetingService;
