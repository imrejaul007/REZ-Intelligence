/**
 * Recommendations Service
 * Handles food recommendations, pairing suggestions, and personalization
 */
import { Db } from 'mongodb';
import Redis from 'ioredis';
import { type MenuItem } from './menuService';
export interface RecommendationContext {
    userId?: string;
    occasion?: 'casual' | 'date' | 'business' | 'family' | 'celebration' | 'quick';
    timeOfDay?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'late-night';
    budget?: 'budget' | 'moderate' | 'premium' | 'luxury';
    mood?: 'adventurous' | 'comfort' | 'healthy' | 'indulgent' | 'light' | 'hearty';
    cuisinePreference?: string;
    groupSize?: number;
}
export interface Recommendation {
    item: MenuItem;
    score: number;
    reasons: string[];
    pairings: string[];
    matchFactors: string[];
}
export interface MealPlan {
    name: string;
    items: MenuItem[];
    totalPrice: number;
    totalCalories?: number;
    dietaryTags: string[];
}
export declare class RecommendationsService {
    private db;
    private redis;
    private dietaryService;
    private recommendationsCollection;
    private initialized;
    constructor();
    initialize(db: Db, redis: Redis): Promise<void>;
    /**
     * Get personalized recommendations for a user
     */
    getPersonalizedRecommendations(userId: string, menuItems: MenuItem[], context: RecommendationContext, limit?: number): Promise<Recommendation[]>;
    /**
     * Get pairing suggestions for an item
     */
    getPairingSuggestions(item: MenuItem): string[];
    /**
     * Build a complete meal plan
     */
    buildMealPlan(userId: string, menuItems: MenuItem[], context: RecommendationContext): Promise<MealPlan>;
    /**
     * Generate complementary item suggestions
     */
    getComplementaryItems(userId: string, selectedItem: MenuItem, menuItems: MenuItem[]): Promise<Recommendation[]>;
    /**
     * Get wine recommendation for a dish
     */
    getWineRecommendation(item: MenuItem): string;
    private getMoodScore;
    private getOccasionScore;
    private getTimeOfDayScore;
    private getBudgetScore;
    private getWineForCategory;
    private getBeerForCategory;
    private getCuisineDefaultPairing;
    private getDefaultWinePairing;
    private generateMealPlanName;
}
export declare function getRecommendationsService(): RecommendationsService;
//# sourceMappingURL=recommendations.d.ts.map