"use strict";
/**
 * Culinary Intents
 * Defines all possible user intents for the culinary expert agent
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetCuisineInfoSchema = exports.ExplainDishSchema = exports.GetIngredientsSchema = exports.GetNutritionSchema = exports.ModifyOrderSchema = exports.PlaceOrderSchema = exports.CustomizeItemSchema = exports.AddToOrderSchema = exports.UpdateAllergyProfileSchema = exports.FilterByDietSchema = exports.CheckAllergensSchema = exports.SetDietaryRestrictionSchema = exports.GetSimilarItemsSchema = exports.GetMealPlanSchema = exports.GetPairingSchema = exports.GetRecommendationSchema = exports.GetItemDetailsSchema = exports.SearchItemsSchema = exports.BrowseCategorySchema = exports.ViewMenuSchema = exports.CulinaryIntent = void 0;
exports.classifyIntent = classifyIntent;
const zod_1 = require("zod");
// ============================================================================
// INTENT DEFINITIONS
// ============================================================================
var CulinaryIntent;
(function (CulinaryIntent) {
    // Menu Intents
    CulinaryIntent["VIEW_MENU"] = "VIEW_MENU";
    CulinaryIntent["BROWSE_CATEGORY"] = "BROWSE_CATEGORY";
    CulinaryIntent["SEARCH_ITEMS"] = "SEARCH_ITEMS";
    CulinaryIntent["GET_ITEM_DETAILS"] = "GET_ITEM_DETAILS";
    // Recommendation Intents
    CulinaryIntent["GET_RECOMMENDATION"] = "GET_RECOMMENDATION";
    CulinaryIntent["GET_PAIRING"] = "GET_PAIRING";
    CulinaryIntent["GET_MEAL_PLAN"] = "GET_MEAL_PLAN";
    CulinaryIntent["GET_SIMILAR_ITEMS"] = "GET_SIMILAR_ITEMS";
    // Dietary Intents
    CulinaryIntent["SET_DIETARY_RESTRICTION"] = "SET_DIETARY_RESTRICTION";
    CulinaryIntent["CHECK_ALLERGENS"] = "CHECK_ALLERGENS";
    CulinaryIntent["FILTER_BY_DIET"] = "FILTER_BY_DIET";
    CulinaryIntent["UPDATE_ALLERGY_PROFILE"] = "UPDATE_ALLERGY_PROFILE";
    // Order Intents
    CulinaryIntent["ADD_TO_ORDER"] = "ADD_TO_ORDER";
    CulinaryIntent["CUSTOMIZE_ITEM"] = "CUSTOMIZE_ITEM";
    CulinaryIntent["VIEW_CART"] = "VIEW_CART";
    CulinaryIntent["PLACE_ORDER"] = "PLACE_ORDER";
    CulinaryIntent["MODIFY_ORDER"] = "MODIFY_ORDER";
    CulinaryIntent["CANCEL_ORDER"] = "CANCEL_ORDER";
    // Information Intents
    CulinaryIntent["GET_NUTRITION"] = "GET_NUTRITION";
    CulinaryIntent["GET_INGREDIENTS"] = "GET_INGREDIENTS";
    CulinaryIntent["EXPLAIN_DISH"] = "EXPLAIN_DISH";
    CulinaryIntent["GET_CUISINE_INFO"] = "GET_CUISINE_INFO";
    // General
    CulinaryIntent["GREETING"] = "GREETING";
    CulinaryIntent["FAREWELL"] = "FAREWELL";
    CulinaryIntent["HELP"] = "HELP";
    CulinaryIntent["UNKNOWN"] = "UNKNOWN";
})(CulinaryIntent || (exports.CulinaryIntent = CulinaryIntent = {}));
// ============================================================================
// INTENT SCHEMAS (Zod)
// ============================================================================
exports.ViewMenuSchema = zod_1.z.object({
    restaurantId: zod_1.z.string(),
    category: zod_1.z.string().optional(),
    page: zod_1.z.number().int().positive().default(1),
    pageSize: zod_1.z.number().int().min(1).max(50).default(20),
});
exports.BrowseCategorySchema = zod_1.z.object({
    restaurantId: zod_1.z.string(),
    category: zod_1.z.string(),
    filters: zod_1.z.object({
        dietaryTags: zod_1.z.array(zod_1.z.string()).optional(),
        excludeAllergens: zod_1.z.array(zod_1.z.string()).optional(),
        priceRange: zod_1.z.object({
            min: zod_1.z.number().optional(),
            max: zod_1.z.number().optional(),
        }).optional(),
        sortBy: zod_1.z.enum(['price', 'name', 'popularity', 'rating']).optional(),
    }).optional(),
});
exports.SearchItemsSchema = zod_1.z.object({
    restaurantId: zod_1.z.string(),
    query: zod_1.z.string().min(1),
    filters: exports.BrowseCategorySchema.shape.filters.optional(),
});
exports.GetItemDetailsSchema = zod_1.z.object({
    restaurantId: zod_1.z.string(),
    itemId: zod_1.z.string(),
    includeNutrition: zod_1.z.boolean().default(false),
    includePairings: zod_1.z.boolean().default(true),
});
exports.GetRecommendationSchema = zod_1.z.object({
    restaurantId: zod_1.z.string(),
    userId: zod_1.z.string(),
    context: zod_1.z.object({
        occasion: zod_1.z.enum(['casual', 'date', 'business', 'family', 'celebration', 'quick']).optional(),
        timeOfDay: zod_1.z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'late-night']).optional(),
        budget: zod_1.z.enum(['budget', 'moderate', 'premium', 'luxury']).optional(),
        mood: zod_1.z.enum(['adventurous', 'comfort', 'healthy', 'indulgent', 'light', 'hearty']).optional(),
        cuisinePreference: zod_1.z.string().optional(),
        groupSize: zod_1.z.number().int().positive().optional(),
    }).optional(),
    limit: zod_1.z.number().int().min(1).max(20).default(5),
});
exports.GetPairingSchema = zod_1.z.object({
    restaurantId: zod_1.z.string(),
    itemId: zod_1.z.string(),
    pairingType: zod_1.z.enum(['wine', 'beer', 'cocktail', 'non-alcoholic', 'side', 'dessert']).optional(),
});
exports.GetMealPlanSchema = zod_1.z.object({
    restaurantId: zod_1.z.string(),
    userId: zod_1.z.string(),
    context: exports.GetRecommendationSchema.shape.context,
    dietaryTags: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.GetSimilarItemsSchema = zod_1.z.object({
    restaurantId: zod_1.z.string(),
    itemId: zod_1.z.string(),
    limit: zod_1.z.number().int().min(1).max(10).default(5),
});
exports.SetDietaryRestrictionSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    restriction: zod_1.z.enum(['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'keto', 'paleo', 'low-carb', 'whole30', 'halal', 'kosher']),
    enabled: zod_1.z.boolean().default(true),
});
exports.CheckAllergensSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    itemId: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
});
exports.FilterByDietSchema = zod_1.z.object({
    restaurantId: zod_1.z.string(),
    userId: zod_1.z.string(),
    dietaryTags: zod_1.z.array(zod_1.z.string()),
    includeUnavailable: zod_1.z.boolean().default(false),
});
exports.UpdateAllergyProfileSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    allergies: zod_1.z.array(zod_1.z.object({
        allergenId: zod_1.z.enum(['milk', 'eggs', 'fish', 'shellfish', 'tree-nuts', 'peanuts', 'wheat', 'soybeans', 'sesame']),
        severity: zod_1.z.enum(['mild', 'moderate', 'severe']),
        notes: zod_1.z.string().optional(),
    })),
});
exports.AddToOrderSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    restaurantId: zod_1.z.string(),
    itemId: zod_1.z.string(),
    quantity: zod_1.z.number().int().positive().default(1),
    customizations: zod_1.z.array(zod_1.z.object({
        customizationId: zod_1.z.string(),
        optionId: zod_1.z.string(),
    })).optional(),
    specialInstructions: zod_1.z.string().max(500).optional(),
});
exports.CustomizeItemSchema = zod_1.z.object({
    restaurantId: zod_1.z.string(),
    itemId: zod_1.z.string(),
    customizations: zod_1.z.array(zod_1.z.object({
        customizationId: zod_1.z.string(),
        selectedOptions: zod_1.z.array(zod_1.z.string()),
    })),
});
exports.PlaceOrderSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    restaurantId: zod_1.z.string(),
    deliveryAddress: zod_1.z.object({
        street: zod_1.z.string(),
        city: zod_1.z.string(),
        state: zod_1.z.string(),
        zipCode: zod_1.z.string(),
        instructions: zod_1.z.string().optional(),
    }).optional(),
    pickup: zod_1.z.boolean().default(false),
    paymentMethod: zod_1.z.enum(['card', 'wallet', 'cash']),
    tip: zod_1.z.number().min(0).optional(),
});
exports.ModifyOrderSchema = zod_1.z.object({
    orderId: zod_1.z.string(),
    userId: zod_1.z.string(),
    modifications: zod_1.z.object({
        items: zod_1.z.array(zod_1.z.object({
            itemId: zod_1.z.string(),
            quantity: zod_1.z.number().int().min(0),
            customizations: zod_1.z.array(zod_1.z.object({
                customizationId: zod_1.z.string(),
                optionId: zod_1.z.string(),
            })).optional(),
        })).optional(),
        deliveryAddress: exports.PlaceOrderSchema.shape.deliveryAddress.optional(),
        specialInstructions: zod_1.z.string().optional(),
    }),
});
exports.GetNutritionSchema = zod_1.z.object({
    restaurantId: zod_1.z.string(),
    itemId: zod_1.z.string(),
});
exports.GetIngredientsSchema = zod_1.z.object({
    restaurantId: zod_1.z.string(),
    itemId: zod_1.z.string(),
    includeAllergens: zod_1.z.boolean().default(true),
});
exports.ExplainDishSchema = zod_1.z.object({
    restaurantId: zod_1.z.string(),
    itemId: zod_1.z.string(),
    detailLevel: zod_1.z.enum(['brief', 'moderate', 'detailed']).default('moderate'),
});
exports.GetCuisineInfoSchema = zod_1.z.object({
    cuisineName: zod_1.z.string(),
    includeHistory: zod_1.z.boolean().default(false),
    includeDishes: zod_1.z.boolean().default(true),
});
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
function classifyIntent(query, context) {
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
    let bestMatch = {
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
function extractOrderEntities(query) {
    const entities = {};
    // Extract quantity if present
    const quantityMatch = query.match(/(\d+)\s*(?:of|qty)?/i);
    if (quantityMatch) {
        entities.quantity = parseInt(quantityMatch[1], 10);
    }
    return entities;
}
function extractDietaryEntities(query) {
    const entities = { restrictions: [] };
    if (/vegetarian/i.test(query) && !/non[\s-]?vegetarian/i.test(query)) {
        entities.restrictions.push('vegetarian');
    }
    if (/vegan/i.test(query)) {
        entities.restrictions.push('vegan');
    }
    if (/gluten[\s-]?free/i.test(query)) {
        entities.restrictions.push('gluten-free');
    }
    if (/dairy[\s-]?free/i.test(query)) {
        entities.restrictions.push('dairy-free');
    }
    if (/keto/i.test(query)) {
        entities.restrictions.push('keto');
    }
    if (/paleo/i.test(query)) {
        entities.restrictions.push('paleo');
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
function extractRecommendationEntities(query, context) {
    const entities = {};
    // Extract occasion
    if (/date/i.test(query)) {
        entities.occasion = 'date';
    }
    else if (/family/i.test(query)) {
        entities.occasion = 'family';
    }
    else if (/celebration|birthday|anniversary/i.test(query)) {
        entities.occasion = 'celebration';
    }
    else if (/business|work/i.test(query)) {
        entities.occasion = 'business';
    }
    else if (/quick|lunch|fast/i.test(query)) {
        entities.occasion = 'quick';
    }
    // Extract mood
    if (/healthy/i.test(query)) {
        entities.mood = 'healthy';
    }
    else if (/comfort/i.test(query)) {
        entities.mood = 'comfort';
    }
    else if (/indulgent|treat/i.test(query)) {
        entities.mood = 'indulgent';
    }
    else if (/adventurous|bold/i.test(query)) {
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
function extractPairingEntities(query) {
    const entities = {};
    if (/wine/i.test(query)) {
        entities.pairingType = 'wine';
    }
    else if (/beer/i.test(query)) {
        entities.pairingType = 'beer';
    }
    else if (/cocktail/i.test(query)) {
        entities.pairingType = 'cocktail';
    }
    else if (/non[\s-]?alcoholic|juice|soda/i.test(query)) {
        entities.pairingType = 'non-alcoholic';
    }
    return entities;
}
//# sourceMappingURL=culinaryIntents.js.map