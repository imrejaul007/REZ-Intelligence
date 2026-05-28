/**
 * Culinary Expertise Service
 * Core food knowledge and expertise capabilities
 */
import { MongoClient } from 'mongodb';
import Redis from 'ioredis';
import { DIETARY_TAGS, MAJOR_ALLERGENS, FLAVOR_PROFILES, PAIRING_GUIDE, type Cuisine, type FlavorProfile } from '../config/knowledge';
export interface FoodExpertise {
    cuisines: string[];
    dietarySpecialties: string[];
    allergenExpertise: string[];
    flavorProfiles: string[];
}
export interface CuisineInfo {
    id: Cuisine;
    name: string;
    description: string;
    keyIngredients: string[];
    signatureDishes: string[];
    cookingStyles: string[];
    commonAllergens: string[];
}
export interface IngredientInfo {
    name: string;
    category: string;
    subcategory?: string;
    flavors: FlavorProfile[];
    dietaryFlags: string[];
    allergens: string[];
    nutritionHighlights?: {
        calories?: number;
        protein?: number;
        carbs?: number;
        fat?: number;
    };
}
export declare class CulinaryExpertiseService {
    private db;
    private redis;
    private cuisineCache;
    private initialized;
    initialize(mongoClient: MongoClient, redis: Redis): Promise<void>;
    private loadCuisineCache;
    /**
     * Get information about a specific cuisine
     */
    getCuisineInfo(cuisineName: string): CuisineInfo | null;
    /**
     * Get all available cuisines
     */
    getAllCuisines(): CuisineInfo[];
    /**
     * Search cuisines by keyword
     */
    searchCuisines(query: string): CuisineInfo[];
    /**
     * Get dietary tag information
     */
    getDietaryTagInfo(tagId: string): typeof DIETARY_TAGS[keyof typeof DIETARY_TAGS] | null;
    /**
     * Get all dietary tags
     */
    getAllDietaryTags(): typeof DIETARY_TAGS[keyof typeof DIETARY_TAGS][];
    /**
     * Get allergen information
     */
    getAllergenInfo(allergenId: string): typeof MAJOR_ALLERGENS[keyof typeof MAJOR_ALLERGENS] | null;
    /**
     * Check text for allergen mentions
     */
    detectAllergens(text: string): string[];
    /**
     * Get ingredient information
     */
    getIngredientInfo(ingredientName: string): IngredientInfo | null;
    /**
     * Get food pairings for a dish type
     */
    getPairings(dishType: string, pairingType: keyof typeof PAIRING_GUIDE): string[];
    /**
     * Get flavor profile information
     */
    getFlavorProfile(profileId: string): typeof FLAVOR_PROFILES[keyof typeof FLAVOR_PROFILES] | null;
    /**
     * Generate cuisine comparison
     */
    compareCuisines(cuisine1Name: string, cuisine2Name: string): {
        cuisine1: CuisineInfo;
        cuisine2: CuisineInfo;
        sharedIngredients: string[];
        uniqueToCuisine1: string[];
        uniqueToCuisine2: string[];
    } | null;
    /**
     * Get cooking style recommendations for a cuisine
     */
    getCookingStyles(cuisineName: string): string[];
    /**
     * Generate expertise summary for a user
     */
    getExpertiseSummary(): FoodExpertise;
    /**
     * Store user preference in cache
     */
    storeUserPreference(userId: string, preference: {
        cuisines?: string[];
        dietaryRestrictions?: string[];
        allergies?: string[];
        favoriteIngredients?: string[];
    }): Promise<void>;
    /**
     * Get user preferences from cache
     */
    getUserPreferences(userId: string): Promise<{
        cuisines?: string[];
        dietaryRestrictions?: string[];
        allergies?: string[];
        favoriteIngredients?: string[];
    } | null>;
    /**
     * Analyze dish description for dietary compatibility
     */
    analyzeDietaryCompatibility(dishDescription: string, userDietaryRestrictions: string[]): {
        isCompatible: boolean;
        conflicts: string[];
        compatibleTags: string[];
    };
}
export declare function getCulinaryExpertiseService(): CulinaryExpertiseService;
//# sourceMappingURL=expertise.d.ts.map