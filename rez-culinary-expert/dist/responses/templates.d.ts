/**
 * Culinary Response Templates
 * Pre-built response templates for common scenarios
 */
import { MenuItem } from '../services/menuService';
import { Recommendation } from '../services/recommendations';
import { DietaryCheckResult } from '../services/dietaryService';
import { TonePreset } from '../config/tone';
export interface ResponseTemplate {
    type: 'greeting' | 'recommendation' | 'item_details' | 'dietary_warning' | 'pairing' | 'order_update' | 'help' | 'error';
    message: string;
    data?: Record<string, unknown>;
}
export interface FormattedMenuItem {
    name: string;
    description: string;
    price: string;
    dietaryTags: string[];
    allergens: string[];
    calories?: string;
    available: boolean;
}
/**
 * Format a menu item for display
 */
export declare function formatMenuItem(item: MenuItem, includeAllergens?: boolean): FormattedMenuItem;
/**
 * Format menu item as text response
 */
export declare function formatMenuItemText(item: MenuItem, tone?: TonePreset): string;
/**
 * Format recommendation response
 */
export declare function formatRecommendationResponse(recommendations: Recommendation[], tone?: TonePreset): string;
/**
 * Format dietary compatibility response
 */
export declare function formatDietaryCheckResponse(itemName: string, result: DietaryCheckResult): string;
/**
 * Format pairing response
 */
export declare function formatPairingResponse(itemName: string, pairings: string[], type: 'wine' | 'beer' | 'cocktail' | 'non-alcoholic'): string;
/**
 * Format allergen warning
 */
export declare function formatAllergenWarning(allergens: Array<{
    id: string;
    name: string;
    severity: 'mild' | 'moderate' | 'severe';
}>): string;
/**
 * Format order confirmation
 */
export declare function formatOrderConfirmation(orderId: string, items: Array<{
    name: string;
    quantity: number;
    subtotal: number;
}>, total: number, estimatedTime?: Date): string;
/**
 * Format menu browsing response
 */
export declare function formatMenuBrowseResponse(categories: Array<{
    name: string;
    itemCount: number;
    items: MenuItem[];
}>, tone?: TonePreset): string;
/**
 * Format ingredient list response
 */
export declare function formatIngredientsResponse(itemName: string, ingredients: string[], allergens: string[]): string;
/**
 * Format nutrition information
 */
export declare function formatNutritionResponse(itemName: string, nutrition: {
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
    fiber?: number;
    sodium?: number;
}): string;
/**
 * Format greeting response
 */
export declare function formatGreetingResponse(tone?: TonePreset): string;
/**
 * Format help response
 */
export declare function formatHelpResponse(): string;
/**
 * Format error response
 */
export declare function formatErrorResponse(error: string, context?: string): string;
/**
 * Format cuisine info response
 */
export declare function formatCuisineInfoResponse(cuisineName: string, description: string, signatureDishes: string[], keyIngredients: string[]): string;
/**
 * Build carousel of items
 */
export declare function buildItemCarousel(items: MenuItem[], maxItems?: number): Array<{
    title: string;
    description: string;
    price: string;
    tags: string[];
}>;
export type { FormattedMenuItem };
//# sourceMappingURL=templates.d.ts.map