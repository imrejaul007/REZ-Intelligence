/**
 * Menu Service
 * Handles menu navigation, item information, and categorization
 */

import { Db, Collection, ObjectId } from 'mongodb';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { matchCuisine, CUISINES } from '../config/knowledge';

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

export class MenuService {
  private db: Db | null = null;
  private redis: Redis | null = null;
  private itemsCollection: Collection<MenuItem> | null = null;
  private menuCollection: Collection<Menu> | null = null;
  private initialized = false;

  async initialize(db: Db, redis: Redis): Promise<void> {
    this.db = db;
    this.redis = redis;

    this.itemsCollection = db.collection<MenuItem>('menu_items');
    this.menuCollection = db.collection<Menu>('menus');

    // Create indexes
    await this.itemsCollection.createIndex({ id: 1 }, { unique: true });
    await this.itemsCollection.createIndex({ category: 1 });
    await this.itemsCollection.createIndex({ cuisine: 1 });
    await this.itemsCollection.createIndex({ dietaryTags: 1 });
    await this.itemsCollection.createIndex({ allergens: 1 });
    await this.itemsCollection.createIndex({ name: 'text', description: 'text' });

    this.initialized = true;
    logger.info('MenuService initialized');
  }

  /**
   * Get full menu for a restaurant
   */
  async getRestaurantMenu(restaurantId: string): Promise<Menu | null> {
    if (!this.menuCollection) return null;

    const cacheKey = `menu:${restaurantId}`;
    const cached = await this.redis?.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const menu = await this.menuCollection.findOne({ restaurantId });

    if (menu && this.redis) {
      await this.redis.set(cacheKey, JSON.stringify(menu), 'EX', 3600); // 1 hour
    }

    return menu;
  }

  /**
   * Search menu items with filters
   */
  async searchMenuItems(
    restaurantId: string,
    filters: MenuSearchFilters
  ): Promise<MenuSearchResult> {
    if (!this.itemsCollection) {
      return { items: [], totalCount: 0, filters };
    }

    const query: Record<string, unknown> = { restaurantId };

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.cuisine) {
      query.cuisine = { $regex: new RegExp(filters.cuisine, 'i') };
    }

    if (filters.dietaryTags && filters.dietaryTags.length > 0) {
      query.dietaryTags = { $all: filters.dietaryTags };
    }

    if (filters.excludeAllergens && filters.excludeAllergens.length > 0) {
      query.allergens = { $nin: filters.excludeAllergens };
    }

    if (filters.maxPrice !== undefined || filters.minPrice !== undefined) {
      query.price = {};
      if (filters.minPrice !== undefined) {
        (query.price as Record<string, number>).$gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        (query.price as Record<string, number>).$lte = filters.maxPrice;
      }
    }

    if (filters.available !== undefined) {
      query.available = filters.available;
    }

    if (filters.searchQuery) {
      query.$text = { $search: filters.searchQuery };
    }

    const items = await this.itemsCollection.find(query).limit(50).toArray();

    return {
      items,
      totalCount: items.length,
      filters,
      suggestions: this.generateSuggestions(items, filters),
    };
  }

  /**
   * Get menu item by ID
   */
  async getMenuItem(restaurantId: string, itemId: string): Promise<MenuItem | null> {
    if (!this.itemsCollection) return null;

    const cacheKey = `menuitem:${restaurantId}:${itemId}`;
    const cached = await this.redis?.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const item = await this.itemsCollection.findOne({ restaurantId, id: itemId });

    if (item && this.redis) {
      await this.redis.set(cacheKey, JSON.stringify(item), 'EX', 1800); // 30 minutes
    }

    return item;
  }

  /**
   * Get items by category
   */
  async getItemsByCategory(
    restaurantId: string,
    category: string
  ): Promise<MenuItem[]> {
    if (!this.itemsCollection) return [];

    return this.itemsCollection
      .find({ restaurantId, category, available: true })
      .toArray();
  }

  /**
   * Get signature/specialty items
   */
  async getSignatureItems(restaurantId: string): Promise<MenuItem[]> {
    if (!this.itemsCollection) return [];

    return this.itemsCollection
      .find({ restaurantId, isSignature: true, available: true })
      .toArray();
  }

  /**
   * Get items by cuisine type
   */
  async getItemsByCuisine(restaurantId: string, cuisine: string): Promise<MenuItem[]> {
    if (!this.itemsCollection) return [];

    return this.itemsCollection
      .find({ restaurantId, cuisine: { $regex: new RegExp(cuisine, 'i') }, available: true })
      .toArray();
  }

  /**
   * Add menu item
   */
  async addMenuItem(restaurantId: string, item: Omit<MenuItem, '_id'>): Promise<MenuItem> {
    if (!this.itemsCollection) {
      throw new Error('MenuService not initialized');
    }

    const result = await this.itemsCollection.insertOne(item as MenuItem);
    const insertedItem = { ...item, _id: result.insertedId };

    // Invalidate cache
    await this.invalidateMenuCache(restaurantId);

    return insertedItem;
  }

  /**
   * Update menu item
   */
  async updateMenuItem(
    restaurantId: string,
    itemId: string,
    updates: Partial<MenuItem>
  ): Promise<MenuItem | null> {
    if (!this.itemsCollection) return null;

    const result = await this.itemsCollection.findOneAndUpdate(
      { restaurantId, id: itemId },
      { $set: { ...updates, lastUpdated: new Date() } },
      { returnDocument: 'after' }
    );

    // Invalidate cache
    await this.invalidateMenuCache(restaurantId);
    if (this.redis) {
      await this.redis.del(`menuitem:${restaurantId}:${itemId}`);
    }

    return result;
  }

  /**
   * Get categories for a restaurant
   */
  async getCategories(restaurantId: string): Promise<string[]> {
    if (!this.itemsCollection) return [];

    const categories = await this.itemsCollection.distinct('category', {
      restaurantId,
      available: true,
    });

    return categories;
  }

  /**
   * Get item count by category
   */
  async getCategoryItemCounts(restaurantId: string): Promise<Map<string, number>> {
    if (!this.itemsCollection) return new Map();

    const pipeline = [
      { $match: { restaurantId, available: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ];

    const results = await this.itemsCollection.aggregate(pipeline).toArray();
    const counts = new Map<string, number>();

    for (const result of results) {
      counts.set(result._id, result.count);
    }

    return counts;
  }

  /**
   * Check item availability
   */
  async checkAvailability(restaurantId: string, itemId: string): Promise<boolean> {
    const item = await this.getMenuItem(restaurantId, itemId);
    return item?.available ?? false;
  }

  /**
   * Get similar items
   */
  async getSimilarItems(
    restaurantId: string,
    itemId: string,
    limit = 5
  ): Promise<MenuItem[]> {
    if (!this.itemsCollection) return [];

    const item = await this.getMenuItem(restaurantId, itemId);
    if (!item) return [];

    const query: Record<string, unknown> = {
      restaurantId,
      id: { $ne: itemId },
      available: true,
      $or: [
        { category: item.category },
        { cuisine: item.cuisine },
      ],
    };

    // Also match on dietary tags if item has them
    if (item.dietaryTags.length > 0) {
      query.dietaryTags = { $in: item.dietaryTags };
    }

    return this.itemsCollection.find(query).limit(limit).toArray();
  }

  /**
   * Generate search suggestions based on results
   */
  private generateSuggestions(
    items: MenuItem[],
    filters: MenuSearchFilters
  ): string[] | undefined {
    if (items.length === 0 && filters.searchQuery) {
      const matchedCuisine = matchCuisine(filters.searchQuery);
      if (matchedCuisine) {
        return [
          `Try browsing our ${matchedCuisine.name} specialties`,
          'Browse all categories',
          'Check our chef recommendations',
        ];
      }
    }
    return undefined;
  }

  /**
   * Invalidate menu cache
   */
  private async invalidateMenuCache(restaurantId: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(`menu:${restaurantId}`);
    }
  }

  /**
   * Get menu statistics
   */
  async getMenuStats(restaurantId: string): Promise<{
    totalItems: number;
    categories: number;
    avgPrice: number;
    dietaryOptions: Map<string, number>;
  }> {
    if (!this.itemsCollection) {
      return { totalItems: 0, categories: 0, avgPrice: 0, dietaryOptions: new Map() };
    }

    const pipeline = [
      { $match: { restaurantId, available: true } },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          avgPrice: { $avg: '$price' },
          categories: { $addToSet: '$category' },
        },
      },
    ];

    const results = await this.itemsCollection.aggregate(pipeline).toArray();

    if (results.length === 0) {
      return { totalItems: 0, categories: 0, avgPrice: 0, dietaryOptions: new Map() };
    }

    const result = results[0];
    const dietaryOptions = new Map<string, number>();

    // Count dietary tags
    const dietaryPipeline = [
      { $match: { restaurantId, available: true } },
      { $unwind: '$dietaryTags' },
      { $group: { _id: '$dietaryTags', count: { $sum: 1 } } },
    ];

    const dietaryResults = await this.itemsCollection.aggregate(dietaryPipeline).toArray();
    for (const r of dietaryResults) {
      dietaryOptions.set(r._id, r.count);
    }

    return {
      totalItems: result.totalItems,
      categories: result.categories.length,
      avgPrice: result.avgPrice || 0,
      dietaryOptions,
    };
  }
}

// Singleton instance
let menuService: MenuService | null = null;

export function getMenuService(): MenuService {
  if (!menuService) {
    menuService = new MenuService();
  }
  return menuService;
}
