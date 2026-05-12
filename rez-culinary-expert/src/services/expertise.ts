/**
 * Culinary Expertise Service
 * Core food knowledge and expertise capabilities
 */

import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { logger } from '../utils/logger.js';
import {
  CUISINES,
  DIETARY_TAGS,
  MAJOR_ALLERGENS,
  INGREDIENT_CATEGORIES,
  FLAVOR_PROFILES,
  PAIRING_GUIDE,
  matchCuisine,
  matchDietaryTag,
  containsAllergen,
  type Cuisine,
  type DietaryTag,
  type Allergen,
  type FlavorProfile,
} from '../config/knowledge.js';

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

export class CulinaryExpertiseService {
  private db: Db | null = null;
  private redis: Redis | null = null;
  private cuisineCache: Map<string, CuisineInfo> = new Map();
  private initialized = false;

  async initialize(mongoClient: MongoClient, redis: Redis): Promise<void> {
    this.db = mongoClient.db('rez_culinary');
    this.redis = redis;
    await this.loadCuisineCache();
    this.initialized = true;
    logger.info('CulinaryExpertiseService initialized');
  }

  private async loadCuisineCache(): Promise<void> {
    for (const [key, cuisine] of Object.entries(CUISINES)) {
      this.cuisineCache.set(cuisine.name.toLowerCase(), {
        id: key as Cuisine,
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
  getCuisineInfo(cuisineName: string): CuisineInfo | null {
    const normalized = cuisineName.toLowerCase().trim();
    return this.cuisineCache.get(normalized) || null;
  }

  /**
   * Get all available cuisines
   */
  getAllCuisines(): CuisineInfo[] {
    return Array.from(this.cuisineCache.values());
  }

  /**
   * Search cuisines by keyword
   */
  searchCuisines(query: string): CuisineInfo[] {
    const normalizedQuery = query.toLowerCase();
    const results: CuisineInfo[] = [];

    for (const cuisine of this.cuisineCache.values()) {
      const matchesName = cuisine.name.toLowerCase().includes(normalizedQuery);
      const matchesIngredient = cuisine.keyIngredients.some(ing =>
        ing.toLowerCase().includes(normalizedQuery)
      );
      const matchesDish = cuisine.signatureDishes.some(dish =>
        dish.toLowerCase().includes(normalizedQuery)
      );

      if (matchesName || matchesIngredient || matchesDish) {
        results.push(cuisine);
      }
    }

    return results;
  }

  /**
   * Get dietary tag information
   */
  getDietaryTagInfo(tagId: string): typeof DIETARY_TAGS[keyof typeof DIETARY_TAGS] | null {
    const tag = DIETARY_TAGS[tagId as DietaryTag];
    return tag || null;
  }

  /**
   * Get all dietary tags
   */
  getAllDietaryTags(): typeof DIETARY_TAGS[keyof typeof DIETARY_TAGS][] {
    return Object.values(DIETARY_TAGS);
  }

  /**
   * Get allergen information
   */
  getAllergenInfo(allergenId: string): typeof MAJOR_ALLERGENS[keyof typeof MAJOR_ALLERGENS] | null {
    const allergen = MAJOR_ALLERGENS[allergenId as Allergen];
    return allergen || null;
  }

  /**
   * Check text for allergen mentions
   */
  detectAllergens(text: string): string[] {
    return containsAllergen(text);
  }

  /**
   * Get ingredient information
   */
  getIngredientInfo(ingredientName: string): IngredientInfo | null {
    const normalized = ingredientName.toLowerCase();
    const allIngredients = Object.entries(INGREDIENT_CATEGORIES).flatMap(([category, subcategories]) =>
      Object.entries(subcategories).map(([subcategory, items]) =>
        items.map(item => ({ item, category, subcategory }))
      ).flat()
    );

    const found = allIngredients.find(i => i.item.toLowerCase() === normalized);
    if (!found) return null;

    const allergens = this.detectAllergens(found.item);
    const dietaryFlags: string[] = [];

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
  getPairings(dishType: string, pairingType: keyof typeof PAIRING_GUIDE): string[] {
    const category = PAIRING_GUIDE[pairingType];
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
  getFlavorProfile(profileId: string): typeof FLAVOR_PROFILES[keyof typeof FLAVOR_PROFILES] | null {
    return FLAVOR_PROFILES[profileId as FlavorProfile] || null;
  }

  /**
   * Generate cuisine comparison
   */
  compareCuisines(cuisine1Name: string, cuisine2Name: string): {
    cuisine1: CuisineInfo;
    cuisine2: CuisineInfo;
    sharedIngredients: string[];
    uniqueToCuisine1: string[];
    uniqueToCuisine2: string[];
  } | null {
    const cuisine1 = this.getCuisineInfo(cuisine1Name);
    const cuisine2 = this.getCuisineInfo(cuisine2Name);

    if (!cuisine1 || !cuisine2) return null;

    const shared = cuisine1.keyIngredients.filter(ing =>
      cuisine2.keyIngredients.includes(ing)
    );
    const unique1 = cuisine1.keyIngredients.filter(ing =>
      !cuisine2.keyIngredients.includes(ing)
    );
    const unique2 = cuisine2.keyIngredients.filter(ing =>
      !cuisine1.keyIngredients.includes(ing)
    );

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
  getCookingStyles(cuisineName: string): string[] {
    const cuisine = this.getCuisineInfo(cuisineName);
    return cuisine?.cookingStyles || [];
  }

  /**
   * Generate expertise summary for a user
   */
  getExpertiseSummary(): FoodExpertise {
    return {
      cuisines: Object.values(CUISINES).map(c => c.name),
      dietarySpecialties: Object.values(DIETARY_TAGS).map(t => t.name),
      allergenExpertise: Object.values(MAJOR_ALLERGENS).map(a => a.name),
      flavorProfiles: Object.values(FLAVOR_PROFILES).map(f => f.name),
    };
  }

  /**
   * Store user preference in cache
   */
  async storeUserPreference(
    userId: string,
    preference: {
      cuisines?: string[];
      dietaryRestrictions?: string[];
      allergies?: string[];
      favoriteIngredients?: string[];
    }
  ): Promise<void> {
    if (!this.redis) return;

    const key = `culinary:preferences:${userId}`;
    await this.redis.set(key, JSON.stringify(preference), 'EX', 86400 * 30); // 30 days
  }

  /**
   * Get user preferences from cache
   */
  async getUserPreferences(userId: string): Promise<{
    cuisines?: string[];
    dietaryRestrictions?: string[];
    allergies?: string[];
    favoriteIngredients?: string[];
  } | null> {
    if (!this.redis) return null;

    const key = `culinary:preferences:${userId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Analyze dish description for dietary compatibility
   */
  analyzeDietaryCompatibility(
    dishDescription: string,
    userDietaryRestrictions: string[]
  ): {
    isCompatible: boolean;
    conflicts: string[];
    compatibleTags: string[];
  } {
    const description = dishDescription.toLowerCase();
    const conflicts: string[] = [];
    const compatibleTags: string[] = [];

    // Check each dietary restriction
    for (const restriction of userDietaryRestrictions) {
      const dietaryTag = matchDietaryTag(restriction);
      if (!dietaryTag) continue;

      // Check if any excluded items are in the description
      const hasConflict = dietaryTag.excludes.some(excluded =>
        description.includes(excluded.toLowerCase())
      );

      if (hasConflict) {
        conflicts.push(dietaryTag.name);
      } else {
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

// Singleton instance
let expertiseService: CulinaryExpertiseService | null = null;

export function getCulinaryExpertiseService(): CulinaryExpertiseService {
  if (!expertiseService) {
    expertiseService = new CulinaryExpertiseService();
  }
  return expertiseService;
}
