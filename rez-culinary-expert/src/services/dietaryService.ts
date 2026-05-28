/**
 * Dietary Service
 * Handles dietary filtering, allergen awareness, and nutritional information
 */

import { Db, Collection } from 'mongodb';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import {
  DIETARY_TAGS,
  MAJOR_ALLERGENS,
  containsAllergen,
  type DietaryTag,
  type Allergen,
} from '../config/knowledge';

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

export class DietaryService {
  private db: Db | null = null;
  private redis: Redis | null = null;
  private profilesCollection: Collection<UserDietaryProfile> | null = null;
  private initialized = false;

  async initialize(db: Db, redis: Redis): Promise<void> {
    this.db = db;
    this.redis = redis;

    this.profilesCollection = db.collection<UserDietaryProfile>('dietary_profiles');

    // Create indexes
    await this.profilesCollection.createIndex({ userId: 1 }, { unique: true });
    await this.profilesCollection.createIndex({ 'allergies.allergenId': 1 });

    this.initialized = true;
    logger.info('DietaryService initialized');
  }

  /**
   * Create or update user dietary profile
   */
  async saveUserProfile(profile: UserDietaryProfile): Promise<void> {
    if (!this.profilesCollection) {
      throw new Error('DietaryService not initialized');
    }

    await this.profilesCollection.updateOne(
      { userId: profile.userId },
      {
        $set: {
          ...profile,
          lastUpdated: new Date(),
        },
      },
      { upsert: true }
    );

    // Cache the profile
    if (this.redis) {
      const cacheKey = `dietary:profile:${profile.userId}`;
      await this.redis.set(cacheKey, JSON.stringify(profile), 'EX', 86400 * 30); // 30 days
    }
  }

  /**
   * Get user dietary profile
   */
  async getUserProfile(userId: string): Promise<UserDietaryProfile | null> {
    if (!this.profilesCollection) return null;

    // Try cache first
    if (this.redis) {
      const cacheKey = `dietary:profile:${userId}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const profile = await this.profilesCollection.findOne({ userId });

    if (profile && this.redis) {
      const cacheKey = `dietary:profile:${userId}`;
      await this.redis.set(cacheKey, JSON.stringify(profile), 'EX', 86400 * 30);
    }

    return profile;
  }

  /**
   * Check if a dish is compatible with user dietary profile
   */
  async checkDishCompatibility(
    userId: string,
    dishDescription: string,
    dishAllergens: string[] = [],
    dishDietaryTags: string[] = []
  ): Promise<DietaryCheckResult> {
    const profile = await this.getUserProfile(userId);

    if (!profile) {
      return {
        isCompatible: true,
        conflicts: [],
        warnings: [],
        safeTags: dishDietaryTags,
      };
    }

    const conflicts: DietaryCheckResult['conflicts'] = [];
    const warnings: string[] = [];
    const safeTags: string[] = [];

    // Check allergens
    for (const allergy of profile.allergies) {
      const allergen = MAJOR_ALLERGENS[allergy.allergenId];

      if (allergen) {
        // Check if any allergen aliases appear in the dish
        const hasAllergen = allergen.aliases.some(alias =>
          dishDescription.toLowerCase().includes(alias.toLowerCase()) ||
          dishAllergens.some(dishAllergen =>
            dishAllergen.toLowerCase() === allergy.allergenId.toLowerCase()
          )
        );

        if (hasAllergen) {
          conflicts.push({
            type: 'allergen',
            id: allergy.allergenId,
            name: allergen.name,
            severity: allergy.severity,
          });
        }
      }
    }

    // Check dietary restrictions
    for (const restriction of profile.restrictions) {
      const dietaryTag = DIETARY_TAGS[restriction as DietaryTag];

      if (dietaryTag) {
        // Check if dish contains any excluded items
        const hasConflict = dietaryTag.excludes.some(excluded =>
          dishDescription.toLowerCase().includes(excluded.toLowerCase())
        );

        if (hasConflict) {
          conflicts.push({
            type: 'restriction',
            id: restriction,
            name: dietaryTag.name,
          });
        } else if (dishDietaryTags.includes(restriction)) {
          safeTags.push(restriction);
        }
      }
    }

    // Check disliked ingredients
    for (const disliked of profile.preferences.dislikedIngredients) {
      if (dishDescription.toLowerCase().includes(disliked.toLowerCase())) {
        warnings.push(`Contains ingredient you may dislike: ${disliked}`);
      }
    }

    return {
      isCompatible: conflicts.length === 0,
      conflicts,
      warnings,
      safeTags,
    };
  }

  /**
   * Filter menu items based on dietary profile
   */
  async filterMenuItems(
    userId: string,
    items: Array<{ id: string; name: string; description: string; allergens: string[]; dietaryTags: string[] }>
  ): Promise<{
    compatible: typeof items;
    incompatible: typeof items;
    needsReview: typeof items;
  }> {
    const profile = await this.getUserProfile(userId);

    const compatible: typeof items = [];
    const incompatible: typeof items = [];
    const needsReview: typeof items = [];

    for (const item of items) {
      const result = await this.checkDishCompatibility(
        userId,
        item.description,
        item.allergens,
        item.dietaryTags
      );

      if (result.isCompatible) {
        compatible.push(item);
      } else if (result.conflicts.some(c => c.severity === 'severe')) {
        incompatible.push(item);
      } else {
        needsReview.push(item);
      }
    }

    return { compatible, incompatible, needsReview };
  }

  /**
   * Build dietary filter from user preferences
   */
  async buildDietaryFilter(userId: string): Promise<DietaryFilter> {
    const profile = await this.getUserProfile(userId);

    if (!profile) {
      return {
        includeTags: [],
        excludeAllergens: [],
        excludeIngredients: [],
      };
    }

    const excludeAllergens = profile.allergies.map(a => a.allergenId);
    const excludeIngredients = [...profile.preferences.dislikedIngredients];

    // Add ingredients from dietary restrictions
    for (const restriction of profile.restrictions) {
      const dietaryTag = DIETARY_TAGS[restriction as DietaryTag];
      if (dietaryTag) {
        excludeIngredients.push(...dietaryTag.excludes);
      }
    }

    return {
      includeTags: profile.restrictions,
      excludeAllergens,
      excludeIngredients: [...new Set(excludeIngredients)],
    };
  }

  /**
   * Get allergen info for display
   */
  getAllergenInformation(allergenId: string): {
    name: string;
    description: string;
    aliases: string[];
    notes?: string;
  } | null {
    const allergen = MAJOR_ALLERGENS[allergenId as Allergen];
    if (!allergen) return null;

    return {
      name: allergen.name,
      description: `${allergen.name} allergy`,
      aliases: [...allergen.aliases],
      notes: 'notes' in allergen ? allergen.notes : undefined,
    };
  }

  /**
   * Get dietary tag info for display
   */
  getDietaryTagInformation(tagId: string): {
    name: string;
    description: string;
    excludes: string[];
  } | null {
    const tag = DIETARY_TAGS[tagId as DietaryTag];
    if (!tag) return null;

    return {
      name: tag.name,
      description: tag.description,
      excludes: [...tag.excludes],
    };
  }

  /**
   * Scan text for allergen mentions
   */
  scanForAllergens(text: string): string[] {
    return containsAllergen(text);
  }

  /**
   * Generate allergen warning message
   */
  generateAllergenWarning(allergies: AllergyProfile[]): string {
    if (allergies.length === 0) return '';

    const severe = allergies.filter(a => a.severity === 'severe');
    const moderate = allergies.filter(a => a.severity === 'moderate');
    const mild = allergies.filter(a => a.severity === 'mild');

    let warning = '';

    if (severe.length > 0) {
      const names = severe.map(a => MAJOR_ALLERGENS[a.allergenId]?.name).filter(Boolean);
      warning += `WARNING: This dish contains ${names.join(', ')}. `;
    }

    if (moderate.length > 0) {
      const names = moderate.map(a => MAJOR_ALLERGENS[a.allergenId]?.name).filter(Boolean);
      warning += `Note: Contains ${names.join(', ')}. `;
    }

    warning += 'Please confirm with restaurant staff about cross-contamination risks.';

    return warning;
  }

  /**
   * Validate dietary filter input
   */
  validateDietaryFilter(filter: Partial<DietaryFilter>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (filter.excludeAllergens) {
      for (const allergen of filter.excludeAllergens) {
        if (!MAJOR_ALLERGENS[allergen as Allergen]) {
          errors.push(`Unknown allergen: ${allergen}`);
        }
      }
    }

    if (filter.includeTags) {
      for (const tag of filter.includeTags) {
        if (!DIETARY_TAGS[tag as DietaryTag]) {
          errors.push(`Unknown dietary tag: ${tag}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Add allergy to profile
   */
  async addAllergy(
    userId: string,
    allergenId: Allergen,
    severity: 'mild' | 'moderate' | 'severe' = 'moderate',
    notes?: string
  ): Promise<void> {
    const profile = await this.getUserProfile(userId) || this.createEmptyProfile(userId);

    // Check if allergy already exists
    const existingIndex = profile.allergies.findIndex(a => a.allergenId === allergenId);
    if (existingIndex >= 0) {
      profile.allergies[existingIndex] = { allergenId, severity, notes };
    } else {
      profile.allergies.push({ allergenId, severity, notes });
    }

    await this.saveUserProfile(profile);
  }

  /**
   * Remove allergy from profile
   */
  async removeAllergy(userId: string, allergenId: Allergen): Promise<void> {
    const profile = await this.getUserProfile(userId);
    if (!profile) return;

    profile.allergies = profile.allergies.filter(a => a.allergenId !== allergenId);
    await this.saveUserProfile(profile);
  }

  /**
   * Add dietary restriction to profile
   */
  async addRestriction(userId: string, restrictionId: DietaryTag): Promise<void> {
    const profile = await this.getUserProfile(userId) || this.createEmptyProfile(userId);

    if (!profile.restrictions.includes(restrictionId)) {
      profile.restrictions.push(restrictionId);
      await this.saveUserProfile(profile);
    }
  }

  /**
   * Remove dietary restriction from profile
   */
  async removeRestriction(userId: string, restrictionId: DietaryTag): Promise<void> {
    const profile = await this.getUserProfile(userId);
    if (!profile) return;

    profile.restrictions = profile.restrictions.filter(r => r !== restrictionId);
    await this.saveUserProfile(profile);
  }

  /**
   * Create empty profile
   */
  private createEmptyProfile(userId: string): UserDietaryProfile {
    return {
      id: new Date().getTime().toString(),
      userId,
      restrictions: [],
      allergies: [],
      preferences: {
        preferredCuisines: [],
        dislikedIngredients: [],
        spiceTolerance: 'medium',
      },
      lastUpdated: new Date(),
    };
  }
}

// Singleton instance
let dietaryService: DietaryService | null = null;

export function getDietaryService(): DietaryService {
  if (!dietaryService) {
    dietaryService = new DietaryService();
  }
  return dietaryService;
}
