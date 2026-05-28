"use strict";
/**
 * Menu Service
 * Handles menu navigation, item information, and categorization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuService = void 0;
exports.getMenuService = getMenuService;
const logger_1 = require("../utils/logger");
const knowledge_1 = require("../config/knowledge");
class MenuService {
    db = null;
    redis = null;
    itemsCollection = null;
    menuCollection = null;
    initialized = false;
    async initialize(db, redis) {
        this.db = db;
        this.redis = redis;
        this.itemsCollection = db.collection('menu_items');
        this.menuCollection = db.collection('menus');
        // Create indexes
        await this.itemsCollection.createIndex({ id: 1 }, { unique: true });
        await this.itemsCollection.createIndex({ category: 1 });
        await this.itemsCollection.createIndex({ cuisine: 1 });
        await this.itemsCollection.createIndex({ dietaryTags: 1 });
        await this.itemsCollection.createIndex({ allergens: 1 });
        await this.itemsCollection.createIndex({ name: 'text', description: 'text' });
        this.initialized = true;
        logger_1.logger.info('MenuService initialized');
    }
    /**
     * Get full menu for a restaurant
     */
    async getRestaurantMenu(restaurantId) {
        if (!this.menuCollection)
            return null;
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
    async searchMenuItems(restaurantId, filters) {
        if (!this.itemsCollection) {
            return { items: [], totalCount: 0, filters };
        }
        const query = { restaurantId };
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
                query.price.$gte = filters.minPrice;
            }
            if (filters.maxPrice !== undefined) {
                query.price.$lte = filters.maxPrice;
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
    async getMenuItem(restaurantId, itemId) {
        if (!this.itemsCollection)
            return null;
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
    async getItemsByCategory(restaurantId, category) {
        if (!this.itemsCollection)
            return [];
        return this.itemsCollection
            .find({ restaurantId, category, available: true })
            .toArray();
    }
    /**
     * Get signature/specialty items
     */
    async getSignatureItems(restaurantId) {
        if (!this.itemsCollection)
            return [];
        return this.itemsCollection
            .find({ restaurantId, isSignature: true, available: true })
            .toArray();
    }
    /**
     * Get items by cuisine type
     */
    async getItemsByCuisine(restaurantId, cuisine) {
        if (!this.itemsCollection)
            return [];
        return this.itemsCollection
            .find({ restaurantId, cuisine: { $regex: new RegExp(cuisine, 'i') }, available: true })
            .toArray();
    }
    /**
     * Add menu item
     */
    async addMenuItem(restaurantId, item) {
        if (!this.itemsCollection) {
            throw new Error('MenuService not initialized');
        }
        const result = await this.itemsCollection.insertOne(item);
        const insertedItem = { ...item, _id: result.insertedId };
        // Invalidate cache
        await this.invalidateMenuCache(restaurantId);
        return insertedItem;
    }
    /**
     * Update menu item
     */
    async updateMenuItem(restaurantId, itemId, updates) {
        if (!this.itemsCollection)
            return null;
        const result = await this.itemsCollection.findOneAndUpdate({ restaurantId, id: itemId }, { $set: { ...updates, lastUpdated: new Date() } }, { returnDocument: 'after' });
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
    async getCategories(restaurantId) {
        if (!this.itemsCollection)
            return [];
        const categories = await this.itemsCollection.distinct('category', {
            restaurantId,
            available: true,
        });
        return categories;
    }
    /**
     * Get item count by category
     */
    async getCategoryItemCounts(restaurantId) {
        if (!this.itemsCollection)
            return new Map();
        const pipeline = [
            { $match: { restaurantId, available: true } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
        ];
        const results = await this.itemsCollection.aggregate(pipeline).toArray();
        const counts = new Map();
        for (const result of results) {
            counts.set(result._id, result.count);
        }
        return counts;
    }
    /**
     * Check item availability
     */
    async checkAvailability(restaurantId, itemId) {
        const item = await this.getMenuItem(restaurantId, itemId);
        return item?.available ?? false;
    }
    /**
     * Get similar items
     */
    async getSimilarItems(restaurantId, itemId, limit = 5) {
        if (!this.itemsCollection)
            return [];
        const item = await this.getMenuItem(restaurantId, itemId);
        if (!item)
            return [];
        const query = {
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
    generateSuggestions(items, filters) {
        if (items.length === 0 && filters.searchQuery) {
            const matchedCuisine = (0, knowledge_1.matchCuisine)(filters.searchQuery);
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
    async invalidateMenuCache(restaurantId) {
        if (this.redis) {
            await this.redis.del(`menu:${restaurantId}`);
        }
    }
    /**
     * Get menu statistics
     */
    async getMenuStats(restaurantId) {
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
        const dietaryOptions = new Map();
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
exports.MenuService = MenuService;
// Singleton instance
let menuService = null;
function getMenuService() {
    if (!menuService) {
        menuService = new MenuService();
    }
    return menuService;
}
//# sourceMappingURL=menuService.js.map