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
}, "strip", z.ZodTypeAny, {
    restaurantId: string;
    page: number;
    pageSize: number;
    category?: string | undefined;
}, {
    restaurantId: string;
    category?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export declare const BrowseCategorySchema: z.ZodObject<{
    restaurantId: z.ZodString;
    category: z.ZodString;
    filters: z.ZodOptional<z.ZodObject<{
        dietaryTags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        excludeAllergens: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        priceRange: z.ZodOptional<z.ZodObject<{
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            min?: number | undefined;
            max?: number | undefined;
        }, {
            min?: number | undefined;
            max?: number | undefined;
        }>>;
        sortBy: z.ZodOptional<z.ZodEnum<["price", "name", "popularity", "rating"]>>;
    }, "strip", z.ZodTypeAny, {
        dietaryTags?: string[] | undefined;
        excludeAllergens?: string[] | undefined;
        priceRange?: {
            min?: number | undefined;
            max?: number | undefined;
        } | undefined;
        sortBy?: "price" | "name" | "popularity" | "rating" | undefined;
    }, {
        dietaryTags?: string[] | undefined;
        excludeAllergens?: string[] | undefined;
        priceRange?: {
            min?: number | undefined;
            max?: number | undefined;
        } | undefined;
        sortBy?: "price" | "name" | "popularity" | "rating" | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    restaurantId: string;
    category: string;
    filters?: {
        dietaryTags?: string[] | undefined;
        excludeAllergens?: string[] | undefined;
        priceRange?: {
            min?: number | undefined;
            max?: number | undefined;
        } | undefined;
        sortBy?: "price" | "name" | "popularity" | "rating" | undefined;
    } | undefined;
}, {
    restaurantId: string;
    category: string;
    filters?: {
        dietaryTags?: string[] | undefined;
        excludeAllergens?: string[] | undefined;
        priceRange?: {
            min?: number | undefined;
            max?: number | undefined;
        } | undefined;
        sortBy?: "price" | "name" | "popularity" | "rating" | undefined;
    } | undefined;
}>;
export declare const SearchItemsSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    query: z.ZodString;
    filters: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        dietaryTags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        excludeAllergens: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        priceRange: z.ZodOptional<z.ZodObject<{
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            min?: number | undefined;
            max?: number | undefined;
        }, {
            min?: number | undefined;
            max?: number | undefined;
        }>>;
        sortBy: z.ZodOptional<z.ZodEnum<["price", "name", "popularity", "rating"]>>;
    }, "strip", z.ZodTypeAny, {
        dietaryTags?: string[] | undefined;
        excludeAllergens?: string[] | undefined;
        priceRange?: {
            min?: number | undefined;
            max?: number | undefined;
        } | undefined;
        sortBy?: "price" | "name" | "popularity" | "rating" | undefined;
    }, {
        dietaryTags?: string[] | undefined;
        excludeAllergens?: string[] | undefined;
        priceRange?: {
            min?: number | undefined;
            max?: number | undefined;
        } | undefined;
        sortBy?: "price" | "name" | "popularity" | "rating" | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    restaurantId: string;
    query: string;
    filters?: {
        dietaryTags?: string[] | undefined;
        excludeAllergens?: string[] | undefined;
        priceRange?: {
            min?: number | undefined;
            max?: number | undefined;
        } | undefined;
        sortBy?: "price" | "name" | "popularity" | "rating" | undefined;
    } | undefined;
}, {
    restaurantId: string;
    query: string;
    filters?: {
        dietaryTags?: string[] | undefined;
        excludeAllergens?: string[] | undefined;
        priceRange?: {
            min?: number | undefined;
            max?: number | undefined;
        } | undefined;
        sortBy?: "price" | "name" | "popularity" | "rating" | undefined;
    } | undefined;
}>;
export declare const GetItemDetailsSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    itemId: z.ZodString;
    includeNutrition: z.ZodDefault<z.ZodBoolean>;
    includePairings: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    restaurantId: string;
    itemId: string;
    includeNutrition: boolean;
    includePairings: boolean;
}, {
    restaurantId: string;
    itemId: string;
    includeNutrition?: boolean | undefined;
    includePairings?: boolean | undefined;
}>;
export declare const GetRecommendationSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    userId: z.ZodString;
    context: z.ZodOptional<z.ZodObject<{
        occasion: z.ZodOptional<z.ZodEnum<["casual", "date", "business", "family", "celebration", "quick"]>>;
        timeOfDay: z.ZodOptional<z.ZodEnum<["breakfast", "lunch", "dinner", "snack", "late-night"]>>;
        budget: z.ZodOptional<z.ZodEnum<["budget", "moderate", "premium", "luxury"]>>;
        mood: z.ZodOptional<z.ZodEnum<["adventurous", "comfort", "healthy", "indulgent", "light", "hearty"]>>;
        cuisinePreference: z.ZodOptional<z.ZodString>;
        groupSize: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        occasion?: "casual" | "date" | "business" | "family" | "celebration" | "quick" | undefined;
        timeOfDay?: "breakfast" | "lunch" | "dinner" | "snack" | "late-night" | undefined;
        budget?: "budget" | "moderate" | "premium" | "luxury" | undefined;
        mood?: "adventurous" | "comfort" | "healthy" | "indulgent" | "light" | "hearty" | undefined;
        cuisinePreference?: string | undefined;
        groupSize?: number | undefined;
    }, {
        occasion?: "casual" | "date" | "business" | "family" | "celebration" | "quick" | undefined;
        timeOfDay?: "breakfast" | "lunch" | "dinner" | "snack" | "late-night" | undefined;
        budget?: "budget" | "moderate" | "premium" | "luxury" | undefined;
        mood?: "adventurous" | "comfort" | "healthy" | "indulgent" | "light" | "hearty" | undefined;
        cuisinePreference?: string | undefined;
        groupSize?: number | undefined;
    }>>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    restaurantId: string;
    userId: string;
    limit: number;
    context?: {
        occasion?: "casual" | "date" | "business" | "family" | "celebration" | "quick" | undefined;
        timeOfDay?: "breakfast" | "lunch" | "dinner" | "snack" | "late-night" | undefined;
        budget?: "budget" | "moderate" | "premium" | "luxury" | undefined;
        mood?: "adventurous" | "comfort" | "healthy" | "indulgent" | "light" | "hearty" | undefined;
        cuisinePreference?: string | undefined;
        groupSize?: number | undefined;
    } | undefined;
}, {
    restaurantId: string;
    userId: string;
    context?: {
        occasion?: "casual" | "date" | "business" | "family" | "celebration" | "quick" | undefined;
        timeOfDay?: "breakfast" | "lunch" | "dinner" | "snack" | "late-night" | undefined;
        budget?: "budget" | "moderate" | "premium" | "luxury" | undefined;
        mood?: "adventurous" | "comfort" | "healthy" | "indulgent" | "light" | "hearty" | undefined;
        cuisinePreference?: string | undefined;
        groupSize?: number | undefined;
    } | undefined;
    limit?: number | undefined;
}>;
export declare const GetPairingSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    itemId: z.ZodString;
    pairingType: z.ZodOptional<z.ZodEnum<["wine", "beer", "cocktail", "non-alcoholic", "side", "dessert"]>>;
}, "strip", z.ZodTypeAny, {
    restaurantId: string;
    itemId: string;
    pairingType?: "wine" | "beer" | "cocktail" | "non-alcoholic" | "side" | "dessert" | undefined;
}, {
    restaurantId: string;
    itemId: string;
    pairingType?: "wine" | "beer" | "cocktail" | "non-alcoholic" | "side" | "dessert" | undefined;
}>;
export declare const GetMealPlanSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    userId: z.ZodString;
    context: z.ZodOptional<z.ZodObject<{
        occasion: z.ZodOptional<z.ZodEnum<["casual", "date", "business", "family", "celebration", "quick"]>>;
        timeOfDay: z.ZodOptional<z.ZodEnum<["breakfast", "lunch", "dinner", "snack", "late-night"]>>;
        budget: z.ZodOptional<z.ZodEnum<["budget", "moderate", "premium", "luxury"]>>;
        mood: z.ZodOptional<z.ZodEnum<["adventurous", "comfort", "healthy", "indulgent", "light", "hearty"]>>;
        cuisinePreference: z.ZodOptional<z.ZodString>;
        groupSize: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        occasion?: "casual" | "date" | "business" | "family" | "celebration" | "quick" | undefined;
        timeOfDay?: "breakfast" | "lunch" | "dinner" | "snack" | "late-night" | undefined;
        budget?: "budget" | "moderate" | "premium" | "luxury" | undefined;
        mood?: "adventurous" | "comfort" | "healthy" | "indulgent" | "light" | "hearty" | undefined;
        cuisinePreference?: string | undefined;
        groupSize?: number | undefined;
    }, {
        occasion?: "casual" | "date" | "business" | "family" | "celebration" | "quick" | undefined;
        timeOfDay?: "breakfast" | "lunch" | "dinner" | "snack" | "late-night" | undefined;
        budget?: "budget" | "moderate" | "premium" | "luxury" | undefined;
        mood?: "adventurous" | "comfort" | "healthy" | "indulgent" | "light" | "hearty" | undefined;
        cuisinePreference?: string | undefined;
        groupSize?: number | undefined;
    }>>;
    dietaryTags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    restaurantId: string;
    userId: string;
    dietaryTags?: string[] | undefined;
    context?: {
        occasion?: "casual" | "date" | "business" | "family" | "celebration" | "quick" | undefined;
        timeOfDay?: "breakfast" | "lunch" | "dinner" | "snack" | "late-night" | undefined;
        budget?: "budget" | "moderate" | "premium" | "luxury" | undefined;
        mood?: "adventurous" | "comfort" | "healthy" | "indulgent" | "light" | "hearty" | undefined;
        cuisinePreference?: string | undefined;
        groupSize?: number | undefined;
    } | undefined;
}, {
    restaurantId: string;
    userId: string;
    dietaryTags?: string[] | undefined;
    context?: {
        occasion?: "casual" | "date" | "business" | "family" | "celebration" | "quick" | undefined;
        timeOfDay?: "breakfast" | "lunch" | "dinner" | "snack" | "late-night" | undefined;
        budget?: "budget" | "moderate" | "premium" | "luxury" | undefined;
        mood?: "adventurous" | "comfort" | "healthy" | "indulgent" | "light" | "hearty" | undefined;
        cuisinePreference?: string | undefined;
        groupSize?: number | undefined;
    } | undefined;
}>;
export declare const GetSimilarItemsSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    itemId: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    restaurantId: string;
    itemId: string;
    limit: number;
}, {
    restaurantId: string;
    itemId: string;
    limit?: number | undefined;
}>;
export declare const SetDietaryRestrictionSchema: z.ZodObject<{
    userId: z.ZodString;
    restriction: z.ZodEnum<["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free", "keto", "paleo", "low-carb", "whole30", "halal", "kosher"]>;
    enabled: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    userId: string;
    restriction: "vegetarian" | "vegan" | "gluten-free" | "dairy-free" | "nut-free" | "keto" | "paleo" | "low-carb" | "whole30" | "halal" | "kosher";
    enabled: boolean;
}, {
    userId: string;
    restriction: "vegetarian" | "vegan" | "gluten-free" | "dairy-free" | "nut-free" | "keto" | "paleo" | "low-carb" | "whole30" | "halal" | "kosher";
    enabled?: boolean | undefined;
}>;
export declare const CheckAllergensSchema: z.ZodObject<{
    userId: z.ZodString;
    itemId: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    userId: string;
    itemId?: string | undefined;
    description?: string | undefined;
}, {
    userId: string;
    itemId?: string | undefined;
    description?: string | undefined;
}>;
export declare const FilterByDietSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    userId: z.ZodString;
    dietaryTags: z.ZodArray<z.ZodString, "many">;
    includeUnavailable: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    restaurantId: string;
    dietaryTags: string[];
    userId: string;
    includeUnavailable: boolean;
}, {
    restaurantId: string;
    dietaryTags: string[];
    userId: string;
    includeUnavailable?: boolean | undefined;
}>;
export declare const UpdateAllergyProfileSchema: z.ZodObject<{
    userId: z.ZodString;
    allergies: z.ZodArray<z.ZodObject<{
        allergenId: z.ZodEnum<["milk", "eggs", "fish", "shellfish", "tree-nuts", "peanuts", "wheat", "soybeans", "sesame"]>;
        severity: z.ZodEnum<["mild", "moderate", "severe"]>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        allergenId: "milk" | "eggs" | "fish" | "shellfish" | "tree-nuts" | "peanuts" | "wheat" | "soybeans" | "sesame";
        severity: "moderate" | "mild" | "severe";
        notes?: string | undefined;
    }, {
        allergenId: "milk" | "eggs" | "fish" | "shellfish" | "tree-nuts" | "peanuts" | "wheat" | "soybeans" | "sesame";
        severity: "moderate" | "mild" | "severe";
        notes?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    userId: string;
    allergies: {
        allergenId: "milk" | "eggs" | "fish" | "shellfish" | "tree-nuts" | "peanuts" | "wheat" | "soybeans" | "sesame";
        severity: "moderate" | "mild" | "severe";
        notes?: string | undefined;
    }[];
}, {
    userId: string;
    allergies: {
        allergenId: "milk" | "eggs" | "fish" | "shellfish" | "tree-nuts" | "peanuts" | "wheat" | "soybeans" | "sesame";
        severity: "moderate" | "mild" | "severe";
        notes?: string | undefined;
    }[];
}>;
export declare const AddToOrderSchema: z.ZodObject<{
    userId: z.ZodString;
    restaurantId: z.ZodString;
    itemId: z.ZodString;
    quantity: z.ZodDefault<z.ZodNumber>;
    customizations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        customizationId: z.ZodString;
        optionId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        customizationId: string;
        optionId: string;
    }, {
        customizationId: string;
        optionId: string;
    }>, "many">>;
    specialInstructions: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    restaurantId: string;
    itemId: string;
    userId: string;
    quantity: number;
    customizations?: {
        customizationId: string;
        optionId: string;
    }[] | undefined;
    specialInstructions?: string | undefined;
}, {
    restaurantId: string;
    itemId: string;
    userId: string;
    quantity?: number | undefined;
    customizations?: {
        customizationId: string;
        optionId: string;
    }[] | undefined;
    specialInstructions?: string | undefined;
}>;
export declare const CustomizeItemSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    itemId: z.ZodString;
    customizations: z.ZodArray<z.ZodObject<{
        customizationId: z.ZodString;
        selectedOptions: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        customizationId: string;
        selectedOptions: string[];
    }, {
        customizationId: string;
        selectedOptions: string[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    restaurantId: string;
    itemId: string;
    customizations: {
        customizationId: string;
        selectedOptions: string[];
    }[];
}, {
    restaurantId: string;
    itemId: string;
    customizations: {
        customizationId: string;
        selectedOptions: string[];
    }[];
}>;
export declare const PlaceOrderSchema: z.ZodObject<{
    userId: z.ZodString;
    restaurantId: z.ZodString;
    deliveryAddress: z.ZodOptional<z.ZodObject<{
        street: z.ZodString;
        city: z.ZodString;
        state: z.ZodString;
        zipCode: z.ZodString;
        instructions: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        instructions?: string | undefined;
    }, {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        instructions?: string | undefined;
    }>>;
    pickup: z.ZodDefault<z.ZodBoolean>;
    paymentMethod: z.ZodEnum<["card", "wallet", "cash"]>;
    tip: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    restaurantId: string;
    userId: string;
    pickup: boolean;
    paymentMethod: "card" | "wallet" | "cash";
    deliveryAddress?: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        instructions?: string | undefined;
    } | undefined;
    tip?: number | undefined;
}, {
    restaurantId: string;
    userId: string;
    paymentMethod: "card" | "wallet" | "cash";
    deliveryAddress?: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        instructions?: string | undefined;
    } | undefined;
    pickup?: boolean | undefined;
    tip?: number | undefined;
}>;
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
            }, "strip", z.ZodTypeAny, {
                customizationId: string;
                optionId: string;
            }, {
                customizationId: string;
                optionId: string;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            itemId: string;
            quantity: number;
            customizations?: {
                customizationId: string;
                optionId: string;
            }[] | undefined;
        }, {
            itemId: string;
            quantity: number;
            customizations?: {
                customizationId: string;
                optionId: string;
            }[] | undefined;
        }>, "many">>;
        deliveryAddress: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            street: z.ZodString;
            city: z.ZodString;
            state: z.ZodString;
            zipCode: z.ZodString;
            instructions: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            street: string;
            city: string;
            state: string;
            zipCode: string;
            instructions?: string | undefined;
        }, {
            street: string;
            city: string;
            state: string;
            zipCode: string;
            instructions?: string | undefined;
        }>>>;
        specialInstructions: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        specialInstructions?: string | undefined;
        deliveryAddress?: {
            street: string;
            city: string;
            state: string;
            zipCode: string;
            instructions?: string | undefined;
        } | undefined;
        items?: {
            itemId: string;
            quantity: number;
            customizations?: {
                customizationId: string;
                optionId: string;
            }[] | undefined;
        }[] | undefined;
    }, {
        specialInstructions?: string | undefined;
        deliveryAddress?: {
            street: string;
            city: string;
            state: string;
            zipCode: string;
            instructions?: string | undefined;
        } | undefined;
        items?: {
            itemId: string;
            quantity: number;
            customizations?: {
                customizationId: string;
                optionId: string;
            }[] | undefined;
        }[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    userId: string;
    orderId: string;
    modifications: {
        specialInstructions?: string | undefined;
        deliveryAddress?: {
            street: string;
            city: string;
            state: string;
            zipCode: string;
            instructions?: string | undefined;
        } | undefined;
        items?: {
            itemId: string;
            quantity: number;
            customizations?: {
                customizationId: string;
                optionId: string;
            }[] | undefined;
        }[] | undefined;
    };
}, {
    userId: string;
    orderId: string;
    modifications: {
        specialInstructions?: string | undefined;
        deliveryAddress?: {
            street: string;
            city: string;
            state: string;
            zipCode: string;
            instructions?: string | undefined;
        } | undefined;
        items?: {
            itemId: string;
            quantity: number;
            customizations?: {
                customizationId: string;
                optionId: string;
            }[] | undefined;
        }[] | undefined;
    };
}>;
export declare const GetNutritionSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    itemId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    restaurantId: string;
    itemId: string;
}, {
    restaurantId: string;
    itemId: string;
}>;
export declare const GetIngredientsSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    itemId: z.ZodString;
    includeAllergens: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    restaurantId: string;
    itemId: string;
    includeAllergens: boolean;
}, {
    restaurantId: string;
    itemId: string;
    includeAllergens?: boolean | undefined;
}>;
export declare const ExplainDishSchema: z.ZodObject<{
    restaurantId: z.ZodString;
    itemId: z.ZodString;
    detailLevel: z.ZodDefault<z.ZodEnum<["brief", "moderate", "detailed"]>>;
}, "strip", z.ZodTypeAny, {
    restaurantId: string;
    itemId: string;
    detailLevel: "moderate" | "brief" | "detailed";
}, {
    restaurantId: string;
    itemId: string;
    detailLevel?: "moderate" | "brief" | "detailed" | undefined;
}>;
export declare const GetCuisineInfoSchema: z.ZodObject<{
    cuisineName: z.ZodString;
    includeHistory: z.ZodDefault<z.ZodBoolean>;
    includeDishes: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    cuisineName: string;
    includeHistory: boolean;
    includeDishes: boolean;
}, {
    cuisineName: string;
    includeHistory?: boolean | undefined;
    includeDishes?: boolean | undefined;
}>;
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