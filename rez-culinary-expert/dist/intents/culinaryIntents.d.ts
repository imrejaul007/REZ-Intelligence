/**
 * Culinary Intents
 * Defines all possible user intents for the culinary expert agent
 */
import { z } from 'zod';
export declare enum CulinaryIntent {
    VIEW_MENU = "VIEW_MENU",
    BROWSE_CATEGORY = "BROWSE_CATEGORY",
    SEARCH_ITEMS = "SEARCH_ITEMS",
    GET_ITEM_DETAILS = "GET_ITEM_DETAILS",
    GET_RECOMMENDATION = "GET_RECOMMENDATION",
    GET_PAIRING = "GET_PAIRING",
    GET_MEAL_PLAN = "GET_MEAL_PLAN",
    GET_SIMILAR_ITEMS = "GET_SIMILAR_ITEMS",
    SET_DIETARY_RESTRICTION = "SET_DIETARY_RESTRICTION",
    CHECK_ALLERGENS = "CHECK_ALLERGENS",
    FILTER_BY_DIET = "FILTER_BY_DIET",
    UPDATE_ALLERGY_PROFILE = "UPDATE_ALLERGY_PROFILE",
    ADD_TO_ORDER = "ADD_TO_ORDER",
    CUSTOMIZE_ITEM = "CUSTOMIZE_ITEM",
    VIEW_CART = "VIEW_CART",
    PLACE_ORDER = "PLACE_ORDER",
    MODIFY_ORDER = "MODIFY_ORDER",
    CANCEL_ORDER = "CANCEL_ORDER",
    GET_NUTRITION = "GET_NUTRITION",
    GET_INGREDIENTS = "GET_INGREDIENTS",
    EXPLAIN_DISH = "EXPLAIN_DISH",
    GET_CUISINE_INFO = "GET_CUISINE_INFO",
    GREETING = "GREETING",
    FAREWELL = "FAREWELL",
    HELP = "HELP",
    UNKNOWN = "UNKNOWN"
}
export declare const ViewMenuSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    category: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const BrowseCategorySchema: z.ZodObject<{
    restaurantId: z.ZodString;
    category: z.ZodString;
    filters: z.ZodOptional<z.ZodObject<{
        dietaryTags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        excludeAllergens: z.ZodOptional<z.ZodArray<z.ZodString>>;
        priceRange: z.ZodOptional<z.ZodObject<{
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        sortBy: z.ZodOptional<z.ZodEnum<{
            price: "price";
            name: "name";
            popularity: "popularity";
            rating: "rating";
        }>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const SearchItemsSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    query: z.ZodString;
    filters: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        dietaryTags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        excludeAllergens: z.ZodOptional<z.ZodArray<z.ZodString>>;
        priceRange: z.ZodOptional<z.ZodObject<{
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        sortBy: z.ZodOptional<z.ZodEnum<{
            price: "price";
            name: "name";
            popularity: "popularity";
            rating: "rating";
        }>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const GetItemDetailsSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    itemId: z.ZodString;
    includeNutrition: z.ZodDefault<z.ZodBoolean>;
    includePairings: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const GetRecommendationSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    userId: z.ZodString;
    context: z.ZodOptional<z.ZodObject<{
        occasion: z.ZodOptional<z.ZodEnum<{
            date: "date";
            casual: "casual";
            business: "business";
            family: "family";
            celebration: "celebration";
            quick: "quick";
        }>>;
        timeOfDay: z.ZodOptional<z.ZodEnum<{
            breakfast: "breakfast";
            lunch: "lunch";
            dinner: "dinner";
            snack: "snack";
            "late-night": "late-night";
        }>>;
        budget: z.ZodOptional<z.ZodEnum<{
            budget: "budget";
            moderate: "moderate";
            premium: "premium";
            luxury: "luxury";
        }>>;
        mood: z.ZodOptional<z.ZodEnum<{
            adventurous: "adventurous";
            comfort: "comfort";
            healthy: "healthy";
            indulgent: "indulgent";
            light: "light";
            hearty: "hearty";
        }>>;
        cuisinePreference: z.ZodOptional<z.ZodString>;
        groupSize: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    limit: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const GetPairingSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    itemId: z.ZodString;
    pairingType: z.ZodOptional<z.ZodEnum<{
        wine: "wine";
        beer: "beer";
        cocktail: "cocktail";
        "non-alcoholic": "non-alcoholic";
        side: "side";
        dessert: "dessert";
    }>>;
}, z.core.$strip>;
export declare const GetMealPlanSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    userId: z.ZodString;
    context: z.ZodOptional<z.ZodObject<{
        occasion: z.ZodOptional<z.ZodEnum<{
            date: "date";
            casual: "casual";
            business: "business";
            family: "family";
            celebration: "celebration";
            quick: "quick";
        }>>;
        timeOfDay: z.ZodOptional<z.ZodEnum<{
            breakfast: "breakfast";
            lunch: "lunch";
            dinner: "dinner";
            snack: "snack";
            "late-night": "late-night";
        }>>;
        budget: z.ZodOptional<z.ZodEnum<{
            budget: "budget";
            moderate: "moderate";
            premium: "premium";
            luxury: "luxury";
        }>>;
        mood: z.ZodOptional<z.ZodEnum<{
            adventurous: "adventurous";
            comfort: "comfort";
            healthy: "healthy";
            indulgent: "indulgent";
            light: "light";
            hearty: "hearty";
        }>>;
        cuisinePreference: z.ZodOptional<z.ZodString>;
        groupSize: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    dietaryTags: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const GetSimilarItemsSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    itemId: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const SetDietaryRestrictionSchema: z.ZodObject<{
    userId: z.ZodString;
    restriction: z.ZodEnum<{
        vegetarian: "vegetarian";
        vegan: "vegan";
        "gluten-free": "gluten-free";
        "dairy-free": "dairy-free";
        "nut-free": "nut-free";
        keto: "keto";
        paleo: "paleo";
        "low-carb": "low-carb";
        whole30: "whole30";
        halal: "halal";
        kosher: "kosher";
    }>;
    enabled: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const CheckAllergensSchema: z.ZodObject<{
    userId: z.ZodString;
    itemId: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const FilterByDietSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    userId: z.ZodString;
    dietaryTags: z.ZodArray<z.ZodString>;
    includeUnavailable: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const UpdateAllergyProfileSchema: z.ZodObject<{
    userId: z.ZodString;
    allergies: z.ZodArray<z.ZodObject<{
        allergenId: z.ZodEnum<{
            milk: "milk";
            eggs: "eggs";
            fish: "fish";
            shellfish: "shellfish";
            "tree-nuts": "tree-nuts";
            peanuts: "peanuts";
            wheat: "wheat";
            soybeans: "soybeans";
            sesame: "sesame";
        }>;
        severity: z.ZodEnum<{
            moderate: "moderate";
            mild: "mild";
            severe: "severe";
        }>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const AddToOrderSchema: z.ZodObject<{
    userId: z.ZodString;
    restaurantId: z.ZodString;
    itemId: z.ZodString;
    quantity: z.ZodDefault<z.ZodNumber>;
    customizations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        customizationId: z.ZodString;
        optionId: z.ZodString;
    }, z.core.$strip>>>;
    specialInstructions: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const CustomizeItemSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    itemId: z.ZodString;
    customizations: z.ZodArray<z.ZodObject<{
        customizationId: z.ZodString;
        selectedOptions: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const PlaceOrderSchema: z.ZodObject<{
    userId: z.ZodString;
    restaurantId: z.ZodString;
    deliveryAddress: z.ZodOptional<z.ZodObject<{
        street: z.ZodString;
        city: z.ZodString;
        state: z.ZodString;
        zipCode: z.ZodString;
        instructions: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    pickup: z.ZodDefault<z.ZodBoolean>;
    paymentMethod: z.ZodEnum<{
        card: "card";
        wallet: "wallet";
        cash: "cash";
    }>;
    tip: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const ModifyOrderSchema: z.ZodObject<{
    orderId: z.ZodString;
    userId: z.ZodString;
    modifications: z.ZodObject<{
        items: z.ZodOptional<z.ZodArray<z.ZodObject<{
            itemId: z.ZodString;
            quantity: z.ZodNumber;
            customizations: z.ZodOptional<z.ZodArray<z.ZodObject<{
                customizationId: z.ZodString;
                optionId: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>>>;
        deliveryAddress: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            street: z.ZodString;
            city: z.ZodString;
            state: z.ZodString;
            zipCode: z.ZodString;
            instructions: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        specialInstructions: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const GetNutritionSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    itemId: z.ZodString;
}, z.core.$strip>;
export declare const GetIngredientsSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    itemId: z.ZodString;
    includeAllergens: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const ExplainDishSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    itemId: z.ZodString;
    detailLevel: z.ZodDefault<z.ZodEnum<{
        moderate: "moderate";
        brief: "brief";
        detailed: "detailed";
    }>>;
}, z.core.$strip>;
export declare const GetCuisineInfoSchema: z.ZodObject<{
    cuisineName: z.ZodString;
    includeHistory: z.ZodDefault<z.ZodBoolean>;
    includeDishes: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export interface ClassifiedIntent {
    intent: CulinaryIntent;
    confidence: number;
    entities: Record<string, unknown>;
    rawQuery: string;
}
export declare function classifyIntent(query: string, context?: Record<string, unknown>): ClassifiedIntent;
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
//# sourceMappingURL=culinaryIntents.d.ts.map