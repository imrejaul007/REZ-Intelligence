/**
 * Menu Service
 * Handles menu navigation, item information, and categorization
 */
import { Db, ObjectId } from 'mongodb';
import Redis from 'ioredis';
export interface MenuItem {
    _id?: ObjectId;
    id: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    category: string;
    subcategory?: string;
    cuisine?: string;
    ingredients: string[];
    dietaryTags: string[];
    allergens: string[];
    calories?: number;
    available: boolean;
    prepTime?: number;
    imageUrl?: string;
    customizations?: MenuCustomization[];
    pairings?: string[];
    spiceLevel?: 'mild' | 'medium' | 'hot' | 'extra-hot';
    isSignature?: boolean;
    tags?: string[];
}
export interface MenuCustomization {
    id: string;
    name: string;
    options: {
        id: string;
        name: string;
        priceAdjustment: number;
        available: boolean;
    }[];
    required: boolean;
    maxSelections?: number;
}
export interface MenuCategory {
    id: string;
    name: string;
    description?: string;
    items: MenuItem[];
    sortOrder: number;
}
export interface Menu {
    id: string;
    restaurantId: string;
    name: string;
    categories: MenuCategory[];
    lastUpdated: Date;
    version: string;
}
export interface MenuSearchFilters {
    category?: string;
    cuisine?: string;
    dietaryTags?: string[];
    excludeAllergens?: string[];
    maxPrice?: number;
    minPrice?: number;
    available?: boolean;
    searchQuery?: string;
}
export interface MenuSearchResult {
    items: MenuItem[];
    totalCount: number;
    filters: MenuSearchFilters;
    suggestions?: string[];
}
export declare class MenuService {
    private db;
    private redis;
    private itemsCollection;
    private menuCollection;
    private initialized;
    initialize(db: Db, redis: Redis): Promise<void>;
    /**
     * Get full menu for a restaurant
     */
    getRestaurantMenu(restaurantId: string): Promise<Menu | null>;
    /**
     * Search menu items with filters
     */
    searchMenuItems(restaurantId: string, filters: MenuSearchFilters): Promise<MenuSearchResult>;
    /**
     * Get menu item by ID
     */
    getMenuItem(restaurantId: string, itemId: string): Promise<MenuItem | null>;
    /**
     * Get items by category
     */
    getItemsByCategory(restaurantId: string, category: string): Promise<MenuItem[]>;
    /**
     * Get signature/specialty items
     */
    getSignatureItems(restaurantId: string): Promise<MenuItem[]>;
    /**
     * Get items by cuisine type
     */
    getItemsByCuisine(restaurantId: string, cuisine: string): Promise<MenuItem[]>;
    /**
     * Add menu item
     */
    addMenuItem(restaurantId: string, item: Omit<MenuItem, '_id'>): Promise<MenuItem>;
    /**
     * Update menu item
     */
    updateMenuItem(restaurantId: string, itemId: string, updates: Partial<MenuItem>): Promise<MenuItem | null>;
    /**
     * Get categories for a restaurant
     */
    getCategories(restaurantId: string): Promise<string[]>;
    /**
     * Get item count by category
     */
    getCategoryItemCounts(restaurantId: string): Promise<Map<string, number>>;
    /**
     * Check item availability
     */
    checkAvailability(restaurantId: string, itemId: string): Promise<boolean>;
    /**
     * Get similar items
     */
    getSimilarItems(restaurantId: string, itemId: string, limit?: number): Promise<MenuItem[]>;
    /**
     * Generate search suggestions based on results
     */
    private generateSuggestions;
    /**
     * Invalidate menu cache
     */
    private invalidateMenuCache;
    /**
     * Get menu statistics
     */
    getMenuStats(restaurantId: string): Promise<{
        totalItems: number;
        categories: number;
        avgPrice: number;
        dietaryOptions: Map<string, number>;
    }>;
}
export declare function getMenuService(): MenuService;
export type { MenuService };
//# sourceMappingURL=menuService.d.ts.map