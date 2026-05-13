"use strict";
/**
 * Culinary Expertise Service
 * Core food knowledge and expertise capabilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CulinaryExpertiseService = void 0;
exports.getCulinaryExpertiseService = getCulinaryExpertiseService;
const logger_js_1 = require("../utils/logger.js");
const knowledge_js_1 = require("../config/knowledge.js");
class CulinaryExpertiseService {
    db = null;
    redis = null;
    cuisineCache = new Map();
    initialized = false;
    async initialize(mongoClient, redis) {
        this.db = mongoClient.db('rez_culinary');
        this.redis = redis;
        await this.loadCuisineCache();
        this.initialized = true;
        logger_js_1.logger.info('CulinaryExpertiseService initialized');
    }
    async loadCuisineCache() {
        for (const [key, cuisine] of Object.entries(knowledge_js_1.CUISINES)) {
            this.cuisineCache.set(cuisine.name.toLowerCase(), {
                id: key,
                name: cuisine.name,
                description: `Traditional ${cuisine.name} cuisine`,
                keyIngredients: cuisine.keyIngredients,
                signatureDishes: cuisine.signatureDishes,
                cookingStyles: cuisine.cookingStyles,
                commonAllergens: cuisine.commonAllergens,
            });
        }
    }
    /**
     * Get information about a specific cuisine
     */
    getCuisineInfo(cuisineName) {
        const normalized = cuisineName.toLowerCase().trim();
        return this.cuisineCache.get(normalized) || null;
    }
    /**
     * Get all available cuisines
     */
    getAllCuisines() {
        return Array.from(this.cuisineCache.values());
    }
    /**
     * Search cuisines by keyword
     */
    searchCuisines(query) {
        const normalizedQuery = query.toLowerCase();
        const results = [];
        for (const cuisine of this.cuisineCache.values()) {
            const matchesName = cuisine.name.toLowerCase().includes(normalizedQuery);
            const matchesIngredient = cuisine.keyIngredients.some(ing => ing.toLowerCase().includes(normalizedQuery));
            const matchesDish = cuisine.signatureDishes.some(dish => dish.toLowerCase().includes(normalizedQuery));
            if (matchesName || matchesIngredient || matchesDish) {
                results.push(cuisine);
            }
        }
        return results;
    }
    /**
     * Get dietary tag information
     */
    getDietaryTagInfo(tagId) {
        const tag = knowledge_js_1.DIETARY_TAGS[tagId];
        return tag || null;
    }
    /**
     * Get all dietary tags
     */
    getAllDietaryTags() {
        return Object.values(knowledge_js_1.DIETARY_TAGS);
    }
    /**
     * Get allergen information
     */
    getAllergenInfo(allergenId) {
        const allergen = knowledge_js_1.MAJOR_ALLERGENS[allergenId];
        return allergen || null;
    }
    /**
     * Check text for allergen mentions
     */
    detectAllergens(text) {
        return (0, knowledge_js_1.containsAllergen)(text);
    }
    /**
     * Get ingredient information
     */
    getIngredientInfo(ingredientName) {
        const normalized = ingredientName.toLowerCase();
        const allIngredients = Object.entries(knowledge_js_1.INGREDIENT_CATEGORIES).flatMap(([category, subcategories]) => Object.entries(subcategories).map(([subcategory, items]) => items.map(item => ({ item, category, subcategory }))).flat());
        const found = allIngredients.find(i => i.item.toLowerCase() === normalized);
        if (!found)
            return null;
        const allergens = this.detectAllergens(found.item);
        const dietaryFlags = [];
        // Check if vegan
        const nonVegan = ['chicken', 'beef', 'pork', 'fish', 'egg', 'cheese', 'milk', 'butter', 'cream', 'honey'];
        if (!nonVegan.some(item => found.item.includes(item))) {
            dietaryFlags.push('vegan');
        }
        // Check if vegetarian
        if (!nonVegan.some(item => found.item.includes(item))) {
            dietaryFlags.push('vegetarian');
        }
        // Check if gluten-free
        const glutenItems = ['wheat', 'barley', 'rye', 'flour', 'pasta', 'bread', 'couscous'];
        if (!glutenItems.some(item => found.item.includes(item))) {
            dietaryFlags.push('gluten-free');
        }
        return {
            name: found.item,
            category: found.category,
            subcategory: found.subcategory,
            flavors: [], // Would need more detailed mapping
            dietaryFlags,
            allergens,
        };
    }
    /**
     * Get food pairings for a dish type
     */
    getPairings(dishType, pairingType) {
        const category = knowledge_js_1.PAIRING_GUIDE[pairingType];
        const normalizedDish = dishType.toLowerCase();
        for (const [types, dishes] of Object.entries(category)) {
            if (Array.isArray(dishes)) {
                const matches = dishes.some(d => normalizedDish.includes(d.toLowerCase()));
                if (matches) {
                    return dishes;
                }
            }
        }
        return [];
    }
    /**
     * Get flavor profile information
     */
    getFlavorProfile(profileId) {
        return knowledge_js_1.FLAVOR_PROFILES[profileId] || null;
    }
    /**
     * Generate cuisine comparison
     */
    compareCuisines(cuisine1Name, cuisine2Name) {
        const cuisine1 = this.getCuisineInfo(cuisine1Name);
        const cuisine2 = this.getCuisineInfo(cuisine2Name);
        if (!cuisine1 || !cuisine2)
            return null;
        const shared = cuisine1.keyIngredients.filter(ing => cuisine2.keyIngredients.includes(ing));
        const unique1 = cuisine1.keyIngredients.filter(ing => !cuisine2.keyIngredients.includes(ing));
        const unique2 = cuisine2.keyIngredients.filter(ing => !cuisine1.keyIngredients.includes(ing));
        return {
            cuisine1,
            cuisine2,
            sharedIngredients: shared,
            uniqueToCuisine1: unique1,
            uniqueToCuisine2: unique2,
        };
    }
    /**
     * Get cooking style recommendations for a cuisine
     */
    getCookingStyles(cuisineName) {
        const cuisine = this.getCuisineInfo(cuisineName);
        return cuisine?.cookingStyles || [];
    }
    /**
     * Generate expertise summary for a user
     */
    getExpertiseSummary() {
        return {
            cuisines: Object.values(knowledge_js_1.CUISINES).map(c => c.name),
            dietarySpecialties: Object.values(knowledge_js_1.DIETARY_TAGS).map(t => t.name),
            allergenExpertise: Object.values(knowledge_js_1.MAJOR_ALLERGENS).map(a => a.name),
            flavorProfiles: Object.values(knowledge_js_1.FLAVOR_PROFILES).map(f => f.name),
        };
    }
    /**
     * Store user preference in cache
     */
    async storeUserPreference(userId, preference) {
        if (!this.redis)
            return;
        const key = `culinary:preferences:${userId}`;
        await this.redis.set(key, JSON.stringify(preference), 'EX', 86400 * 30); // 30 days
    }
    /**
     * Get user preferences from cache
     */
    async getUserPreferences(userId) {
        if (!this.redis)
            return null;
        const key = `culinary:preferences:${userId}`;
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
    }
    /**
     * Analyze dish description for dietary compatibility
     */
    analyzeDietaryCompatibility(dishDescription, userDietaryRestrictions) {
        const description = dishDescription.toLowerCase();
        const conflicts = [];
        const compatibleTags = [];
        // Check each dietary restriction
        for (const restriction of userDietaryRestrictions) {
            const dietaryTag = (0, knowledge_js_1.matchDietaryTag)(restriction);
            if (!dietaryTag)
                continue;
            // Check if any excluded items are in the description
            const hasConflict = dietaryTag.excludes.some(excluded => description.includes(excluded.toLowerCase()));
            if (hasConflict) {
                conflicts.push(dietaryTag.name);
            }
            else {
                compatibleTags.push(dietaryTag.name);
            }
        }
        return {
            isCompatible: conflicts.length === 0,
            conflicts,
            compatibleTags,
        };
    }
}
exports.CulinaryExpertiseService = CulinaryExpertiseService;
// Singleton instance
let expertiseService = null;
function getCulinaryExpertiseService() {
    if (!expertiseService) {
        expertiseService = new CulinaryExpertiseService();
    }
    return expertiseService;
}
//# sourceMappingURL=expertise.js.map