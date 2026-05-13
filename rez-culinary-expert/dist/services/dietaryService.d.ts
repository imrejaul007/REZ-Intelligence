/**
 * Dietary Service
 * Handles dietary filtering, allergen awareness, and nutritional information
 */
import { Db } from 'mongodb';
import Redis from 'ioredis';
import { type DietaryTag, type Allergen } from '../config/knowledge.js';
export interface UserDietaryProfile {
    id: string;
    userId: string;
    restrictions: string[];
    allergies: AllergyProfile[];
    preferences: {
        preferredCuisines: string[];
        dislikedIngredients: string[];
        spiceTolerance: 'none' | 'mild' | 'medium' | 'hot' | 'extra-hot';
    };
    lastUpdated: Date;
}
export interface AllergyProfile {
    allergenId: Allergen;
    severity: 'mild' | 'moderate' | 'severe';
    notes?: string;
}
export interface DietaryFilter {
    includeTags: string[];
    excludeAllergens: string[];
    excludeIngredients: string[];
}
export interface DietaryCheckResult {
    isCompatible: boolean;
    conflicts: {
        type: 'allergen' | 'restriction';
        id: string;
        name: string;
        severity?: 'mild' | 'moderate' | 'severe';
    }[];
    warnings: string[];
    safeTags: string[];
}
export interface NutrientInfo {
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
}
export declare class DietaryService {
    private db;
    private redis;
    private profilesCollection;
    private initialized;
    initialize(db: Db, redis: Redis): Promise<void>;
    /**
     * Create or update user dietary profile
     */
    saveUserProfile(profile: UserDietaryProfile): Promise<void>;
    /**
     * Get user dietary profile
     */
    getUserProfile(userId: string): Promise<UserDietaryProfile | null>;
    /**
     * Check if a dish is compatible with user dietary profile
     */
    checkDishCompatibility(userId: string, dishDescription: string, dishAllergens?: string[], dishDietaryTags?: string[]): Promise<DietaryCheckResult>;
    /**
     * Filter menu items based on dietary profile
     */
    filterMenuItems(userId: string, items: Array<{
        id: string;
        name: string;
        description: string;
        allergens: string[];
        dietaryTags: string[];
    }>): Promise<{
        compatible: typeof items;
        incompatible: typeof items;
        needsReview: typeof items;
    }>;
    /**
     * Build dietary filter from user preferences
     */
    buildDietaryFilter(userId: string): Promise<DietaryFilter>;
    /**
     * Get allergen info for display
     */
    getAllergenInformation(allergenId: string): {
        name: string;
        description: string;
        aliases: string[];
        notes?: string;
    } | null;
    /**
     * Get dietary tag info for display
     */
    getDietaryTagInformation(tagId: string): {
        name: string;
        description: string;
        excludes: string[];
    } | null;
    /**
     * Scan text for allergen mentions
     */
    scanForAllergens(text: string): string[];
    /**
     * Generate allergen warning message
     */
    generateAllergenWarning(allergies: AllergyProfile[]): string;
    /**
     * Validate dietary filter input
     */
    validateDietaryFilter(filter: Partial<DietaryFilter>): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Add allergy to profile
     */
    addAllergy(userId: string, allergenId: Allergen, severity?: 'mild' | 'moderate' | 'severe', notes?: string): Promise<void>;
    /**
     * Remove allergy from profile
     */
    removeAllergy(userId: string, allergenId: Allergen): Promise<void>;
    /**
     * Add dietary restriction to profile
     */
    addRestriction(userId: string, restrictionId: DietaryTag): Promise<void>;
    /**
     * Remove dietary restriction from profile
     */
    removeRestriction(userId: string, restrictionId: DietaryTag): Promise<void>;
    /**
     * Create empty profile
     */
    private createEmptyProfile;
}
export declare function getDietaryService(): DietaryService;
export type { DietaryService };
//# sourceMappingURL=dietaryService.d.ts.map