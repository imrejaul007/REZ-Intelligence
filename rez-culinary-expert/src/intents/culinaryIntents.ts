/**
 * Culinary Intents
 * Defines all possible user intents for the culinary expert agent
 */

import { z } from 'zod';

// ============================================================================
// INTENT DEFINITIONS
// ============================================================================

export enum CulinaryIntent {
  // Menu Intents
  VIEW_MENU = 'VIEW_MENU',
  BROWSE_CATEGORY = 'BROWSE_CATEGORY',
  SEARCH_ITEMS = 'SEARCH_ITEMS',
  GET_ITEM_DETAILS = 'GET_ITEM_DETAILS',

  // Recommendation Intents
  GET_RECOMMENDATION = 'GET_RECOMMENDATION',
  GET_PAIRING = 'GET_PAIRING',
  GET_MEAL_PLAN = 'GET_MEAL_PLAN',
  GET_SIMILAR_ITEMS = 'GET_SIMILAR_ITEMS',

  // Dietary Intents
  SET_DIETARY_RESTRICTION = 'SET_DIETARY_RESTRICTION',
  CHECK_ALLERGENS = 'CHECK_ALLERGENS',
  FILTER_BY_DIET = 'FILTER_BY_DIET',
  UPDATE_ALLERGY_PROFILE = 'UPDATE_ALLERGY_PROFILE',

  // Order Intents
  ADD_TO_ORDER = 'ADD_TO_ORDER',
  CUSTOMIZE_ITEM = 'CUSTOMIZE_ITEM',
  VIEW_CART = 'VIEW_CART',
  PLACE_ORDER = 'PLACE_ORDER',
  MODIFY_ORDER = 'MODIFY_ORDER',
  CANCEL_ORDER = 'CANCEL_ORDER',

  // Information Intents
  GET_NUTRITION = 'GET_NUTRITION',
  GET_INGREDIENTS = 'GET_INGREDIENTS',
  EXPLAIN_DISH = 'EXPLAIN_DISH',
  GET_CUISINE_INFO = 'GET_CUISINE_INFO',

  // General
  GREETING = 'GREETING',
  FAREWELL = 'FAREWELL',
  HELP = 'HELP',
  UNKNOWN = 'UNKNOWN',
}

// ============================================================================
// INTENT SCHEMAS (Zod)
// ============================================================================

export const ViewMenuSchema = z.object({
  restaurantId: z.string(),
  category: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

export const BrowseCategorySchema = z.object({
  restaurantId: z.string(),
  category: z.string(),
  filters: z.object({
    dietaryTags: z.array(z.string()).optional(),
    excludeAllergens: z.array(z.string()).optional(),
    priceRange: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional(),
    sortBy: z.enum(['price', 'name', 'popularity', 'rating']).optional(),
  }).optional(),
});

export const SearchItemsSchema = z.object({
  restaurantId: z.string(),
  query: z.string().min(1),
  filters: BrowseCategorySchema.shape.filters.optional(),
});

export const GetItemDetailsSchema = z.object({
  restaurantId: z.string(),
  itemId: z.string(),
  includeNutrition: z.boolean().default(false),
  includePairings: z.boolean().default(true),
});

export const GetRecommendationSchema = z.object({
  restaurantId: z.string(),
  userId: z.string(),
  context: z.object({
    occasion: z.enum(['casual', 'date', 'business', 'family', 'celebration', 'quick']).optional(),
    timeOfDay: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'late-night']).optional(),
    budget: z.enum(['budget', 'moderate', 'premium', 'luxury']).optional(),
    mood: z.enum(['adventurous', 'comfort', 'healthy', 'indulgent', 'light', 'hearty']).optional(),
    cuisinePreference: z.string().optional(),
    groupSize: z.number().int().positive().optional(),
  }).optional(),
  limit: z.number().int().min(1).max(20).default(5),
});

export const GetPairingSchema = z.object({
  restaurantId: z.string(),
  itemId: z.string(),
  pairingType: z.enum(['wine', 'beer', 'cocktail', 'non-alcoholic', 'side', 'dessert']).optional(),
});

export const GetMealPlanSchema = z.object({
  restaurantId: z.string(),
  userId: z.string(),
  context: GetRecommendationSchema.shape.context,
  dietaryTags: z.array(z.string()).optional(),
});

export const GetSimilarItemsSchema = z.object({
  restaurantId: z.string(),
  itemId: z.string(),
  limit: z.number().int().min(1).max(10).default(5),
});

export const SetDietaryRestrictionSchema = z.object({
  userId: z.string(),
  restriction: z.enum(['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'keto', 'paleo', 'low-carb', 'whole30', 'halal', 'kosher']),
  enabled: z.boolean().default(true),
});

export const CheckAllergensSchema = z.object({
  userId: z.string(),
  itemId: z.string().optional(),
  description: z.string().optional(),
});

export const FilterByDietSchema = z.object({
  restaurantId: z.string(),
  userId: z.string(),
  dietaryTags: z.array(z.string()),
  includeUnavailable: z.boolean().default(false),
});

export const UpdateAllergyProfileSchema = z.object({
  userId: z.string(),
  allergies: z.array(z.object({
    allergenId: z.enum(['milk', 'eggs', 'fish', 'shellfish', 'tree-nuts', 'peanuts', 'wheat', 'soybeans', 'sesame']),
    severity: z.enum(['mild', 'moderate', 'severe']),
    notes: z.string().optional(),
  })),
});

export const AddToOrderSchema = z.object({
  userId: z.string(),
  restaurantId: z.string(),
  itemId: z.string(),
  quantity: z.number().int().positive().default(1),
  customizations: z.array(z.object({
    customizationId: z.string(),
    optionId: z.string(),
  })).optional(),
  specialInstructions: z.string().max(500).optional(),
});

export const CustomizeItemSchema = z.object({
  restaurantId: z.string(),
  itemId: z.string(),
  customizations: z.array(z.object({
    customizationId: z.string(),
    selectedOptions: z.array(z.string()),
  })),
});

export const PlaceOrderSchema = z.object({
  userId: z.string(),
  restaurantId: z.string(),
  deliveryAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    instructions: z.string().optional(),
  }).optional(),
  pickup: z.boolean().default(false),
  paymentMethod: z.enum(['card', 'wallet', 'cash']),
  tip: z.number().min(0).optional(),
});

export const ModifyOrderSchema = z.object({
  orderId: z.string(),
  userId: z.string(),
  modifications: z.object({
    items: z.array(z.object({
      itemId: z.string(),
      quantity: z.number().int().min(0),
      customizations: z.array(z.object({
        customizationId: z.string(),
        optionId: z.string(),
      })).optional(),
    })).optional(),
    deliveryAddress: PlaceOrderSchema.shape.deliveryAddress.optional(),
    specialInstructions: z.string().optional(),
  }),
});

export const GetNutritionSchema = z.object({
  restaurantId: z.string(),
  itemId: z.string(),
});

export const GetIngredientsSchema = z.object({
  restaurantId: z.string(),
  itemId: z.string(),
  includeAllergens: z.boolean().default(true),
});

export const ExplainDishSchema = z.object({
  restaurantId: z.string(),
  itemId: z.string(),
  detailLevel: z.enum(['brief', 'moderate', 'detailed']).default('moderate'),
});

export const GetCuisineInfoSchema = z.object({
  cuisineName: z.string(),
  includeHistory: z.boolean().default(false),
  includeDishes: z.boolean().default(true),
});

// ============================================================================
// INTENT CLASSIFIER
// ============================================================================

export interface ClassifiedIntent {
  intent: CulinaryIntent;
  confidence: number;
  entities: Record<string, unknown>;
  rawQuery: string;
}

const GREETING_PATTERNS = [
  /^hi/i, /^hello/i, /^hey/i, /^good (morning|afternoon|evening)/i,
  /^howdy/i, /^what'?s up/i, /^greetings/i, /^welcome/i,
];

const FAREWELL_PATTERNS = [
  /^bye/i, /^goodbye/i, /^see (you|ya) later/i, /^take care/i,
  /^that'?s all/i, /^done/i, /^thanks?( for)? (the|your) help/i,
];

const VIEW_MENU_PATTERNS = [
  /show (me )?(the )?menu/i,
  /what('?s| is) on (the )?menu/i,
  /browse (the )?menu/i,
  /see (what |what'?s )?(we have|i can get|available)/i,
  /view (the )?menu/i,
  /^menu$/i,
];

const RECOMMENDATION_PATTERNS = [
  /(what|which) (would|should) (i|you) (recommend|suggest)/i,
  /(what|which) (is|are) (your |the )?(favorite|best|popular|recommend)/i,
  /recommend (me |us |something )?/i,
  /suggest (me |something )?/i,
  /what('?s| is) (good|good for|best for)/i,
  /surprise (me |us )?/i,
];

const PAIRING_PATTERNS = [
  /(what )?(wine|beer|drink) (pairs|goes) (well )?with/i,
  /(what should i|can i) (drink|have) (with|paired with)/i,
  /pairing/i,
  /goes well with/i,
];

const DIETARY_PATTERNS = [
  /i('?m| am) (a |an )?(vegetarian|vegan|gluten.free|glutenfree|dairy.free|dairyfree|keto|paleo)/i,
  /(no |don'?t want |can'?t have )?(meat|gluten|dairy|peanuts|tree nuts|fish|shellfish)/i,
  /(i have|i'?m allergic|allergy) (to |to: )/i,
  /is (this |it )?vegetarian\?/i,
  /contains (peanuts|nuts|dairy|gluten)/i,
];

const ORDER_PATTERNS = [
  /(add|put) (this |that |it )?(to|in) (my |the )?(order|cart|bag)/i,
  /order (this |that |these |it )?/i,
  /i('?d| would) like (to |)(order|have|get) /i,
  /checkout/i,
  /place (my |the )?order/i,
  /how much (is |are )?(this |that |it )?/i,
  /total (is |)cost/i,
];

const NUTRITION_PATTERNS = [
  /how many calories/i,
  /(what|what'?s) (the |is the )?nutrition/i,
  /(calories?|protein|carbs?|fat) (in |content)/i,
  /is this (healthy|good for me)/i,
];

const INGREDIENT_PATTERNS = [
  /what('?s| is) in (this |that |it )?/i,
  /ingredients/i,
  /what does (this |that |it )?contain/i,
  /how('?s| is) (this |that |it )?(made|cooked)/i,
];

// ============================================================================
// INTENT CLASSIFIER FUNCTION
// ============================================================================

export function classifyIntent(query: string, context?: Record<string, unknown>): ClassifiedIntent {
  const normalizedQuery = query.toLowerCase().trim();

  // Check for exact matches first
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      return {
        intent: CulinaryIntent.GREETING,
        confidence: 0.95,
        entities: {},
        rawQuery: query,
      };
    }
  }

  for (const pattern of FAREWELL_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      return {
        intent: CulinaryIntent.FAREWELL,
        confidence: 0.95,
        entities: {},
        rawQuery: query,
      };
    }
  }

  // Check for specific intents
  let bestMatch: { intent: CulinaryIntent; confidence: number; entities: Record<string, unknown> } = {
    intent: CulinaryIntent.UNKNOWN,
    confidence: 0,
    entities: {},
  };

  // Order intents (high priority)
  for (const pattern of ORDER_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      const confidence = pattern.test(normalizedQuery) ? 0.9 : 0.7;
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          intent: CulinaryIntent.ADD_TO_ORDER,
          confidence,
          entities: extractOrderEntities(normalizedQuery),
        };
      }
    }
  }

  // Dietary intents
  for (const pattern of DIETARY_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      const confidence = 0.85;
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          intent: CulinaryIntent.SET_DIETARY_RESTRICTION,
          confidence,
          entities: extractDietaryEntities(normalizedQuery),
        };
      }
    }
  }

  // Recommendation intents
  for (const pattern of RECOMMENDATION_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      const confidence = 0.85;
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          intent: CulinaryIntent.GET_RECOMMENDATION,
          confidence,
          entities: extractRecommendationEntities(normalizedQuery, context),
        };
      }
    }
  }

  // Pairing intents
  for (const pattern of PAIRING_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      const confidence = 0.9;
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          intent: CulinaryIntent.GET_PAIRING,
          confidence,
          entities: extractPairingEntities(normalizedQuery),
        };
      }
    }
  }

  // Menu intents
  for (const pattern of VIEW_MENU_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      const confidence = 0.85;
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          intent: CulinaryIntent.VIEW_MENU,
          confidence,
          entities: {},
        };
      }
    }
  }

  // Nutrition intents
  for (const pattern of NUTRITION_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      const confidence = 0.9;
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          intent: CulinaryIntent.GET_NUTRITION,
          confidence,
          entities: {},
        };
      }
    }
  }

  // Ingredient intents
  for (const pattern of INGREDIENT_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      const confidence = 0.9;
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          intent: CulinaryIntent.GET_INGREDIENTS,
          confidence,
          entities: {},
        };
      }
    }
  }

  return {
    ...bestMatch,
    rawQuery: query,
  };
}

// ============================================================================
// ENTITY EXTRACTORS
// ============================================================================

function extractOrderEntities(query: string): Record<string, unknown> {
  const entities: Record<string, unknown> = {};

  // Extract quantity if present
  const quantityMatch = query.match(/(\d+)\s*(?:of|qty)?/i);
  if (quantityMatch) {
    entities.quantity = parseInt(quantityMatch[1], 10);
  }

  return entities;
}

function extractDietaryEntities(query: string): Record<string, unknown> {
  const entities: Record<string, unknown> = { restrictions: [] };

  if (/vegetarian/i.test(query) && !/non[\s-]?vegetarian/i.test(query)) {
    (entities.restrictions as string[]).push('vegetarian');
  }
  if (/vegan/i.test(query)) {
    (entities.restrictions as string[]).push('vegan');
  }
  if (/gluten[\s-]?free/i.test(query)) {
    (entities.restrictions as string[]).push('gluten-free');
  }
  if (/dairy[\s-]?free/i.test(query)) {
    (entities.restrictions as string[]).push('dairy-free');
  }
  if (/keto/i.test(query)) {
    (entities.restrictions as string[]).push('keto');
  }
  if (/paleo/i.test(query)) {
    (entities.restrictions as string[]).push('paleo');
  }

  // Extract allergies
  if (/allergic/i.test(query)) {
    entities.isAllergy = true;
    const allergenMatch = query.match(/allergic (?:to |: )(.+)/i);
    if (allergenMatch) {
      entities.allergens = allergenMatch[1].split(/,|and/).map(s => s.trim());
    }
  }

  return entities;
}

function extractRecommendationEntities(query: string, context?: Record<string, unknown>): Record<string, unknown> {
  const entities: Record<string, unknown> = {};

  // Extract occasion
  if (/date/i.test(query)) {
    entities.occasion = 'date';
  } else if (/family/i.test(query)) {
    entities.occasion = 'family';
  } else if (/celebration|birthday|anniversary/i.test(query)) {
    entities.occasion = 'celebration';
  } else if (/business|work/i.test(query)) {
    entities.occasion = 'business';
  } else if (/quick|lunch|fast/i.test(query)) {
    entities.occasion = 'quick';
  }

  // Extract mood
  if (/healthy/i.test(query)) {
    entities.mood = 'healthy';
  } else if (/comfort/i.test(query)) {
    entities.mood = 'comfort';
  } else if (/indulgent|treat/i.test(query)) {
    entities.mood = 'indulgent';
  } else if (/adventurous|bold/i.test(query)) {
    entities.mood = 'adventurous';
  }

  // Extract cuisine preference
  const cuisines = ['italian', 'japanese', 'mexican', 'chinese', 'indian', 'thai', 'french', 'american', 'mediterranean'];
  for (const cuisine of cuisines) {
    if (query.includes(cuisine)) {
      entities.cuisinePreference = cuisine;
      break;
    }
  }

  // Merge with context
  if (context) {
    entities = { ...context, ...entities };
  }

  return entities;
}

function extractPairingEntities(query: string): Record<string, unknown> {
  const entities: Record<string, unknown> = {};

  if (/wine/i.test(query)) {
    entities.pairingType = 'wine';
  } else if (/beer/i.test(query)) {
    entities.pairingType = 'beer';
  } else if (/cocktail/i.test(query)) {
    entities.pairingType = 'cocktail';
  } else if (/non[\s-]?alcoholic|juice|soda/i.test(query)) {
    entities.pairingType = 'non-alcoholic';
  }

  return entities;
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ViewMenuInput = z.infer<typeof ViewMenuSchema>;
export type BrowseCategoryInput = z.infer<typeof BrowseCategorySchema>;
export type SearchItemsInput = z.infer<typeof SearchItemsSchema>;
export type GetItemDetailsInput = z.infer<typeof GetItemDetailsSchema>;
export type GetRecommendationInput = z.infer<typeof GetRecommendationSchema>;
export type GetPairingInput = z.infer<typeof GetPairingSchema>;
export type GetMealPlanInput = z.infer<typeof GetMealPlanSchema>;
export type GetSimilarItemsInput = z.infer<typeof GetSimilarItemsSchema>;
export type SetDietaryRestrictionInput = z.infer<typeof SetDietaryRestrictionSchema>;
export type CheckAllergensInput = z.infer<typeof CheckAllergensSchema>;
export type FilterByDietInput = z.infer<typeof FilterByDietInput>;
export type UpdateAllergyProfileInput = z.infer<typeof UpdateAllergyProfileSchema>;
export type AddToOrderInput = z.infer<typeof AddToOrderSchema>;
export type CustomizeItemInput = z.infer<typeof CustomizeItemSchema>;
export type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>;
export type ModifyOrderInput = z.infer<typeof ModifyOrderSchema>;
export type GetNutritionInput = z.infer<typeof GetNutritionSchema>;
export type GetIngredientsInput = z.infer<typeof GetIngredientsSchema>;
export type ExplainDishInput = z.infer<typeof ExplainDishSchema>;
export type GetCuisineInfoInput = z.infer<typeof GetCuisineInfoSchema>;
