"use strict";
/**
 * Dietary Service
 * Handles dietary filtering, allergen awareness, and nutritional information
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DietaryService = void 0;
exports.getDietaryService = getDietaryService;
const logger_1 = require("../utils/logger");
const knowledge_1 = require("../config/knowledge");
class DietaryService {
    db = null;
    redis = null;
    profilesCollection = null;
    initialized = false;
    async initialize(db, redis) {
        this.db = db;
        this.redis = redis;
        this.profilesCollection = db.collection('dietary_profiles');
        // Create indexes
        await this.profilesCollection.createIndex({ userId: 1 }, { unique: true });
        await this.profilesCollection.createIndex({ 'allergies.allergenId': 1 });
        this.initialized = true;
        logger_1.logger.info('DietaryService initialized');
    }
    /**
     * Create or update user dietary profile
     */
    async saveUserProfile(profile) {
        if (!this.profilesCollection) {
            throw new Error('DietaryService not initialized');
        }
        await this.profilesCollection.updateOne({ userId: profile.userId }, {
            $set: {
                ...profile,
                lastUpdated: new Date(),
            },
        }, { upsert: true });
        // Cache the profile
        if (this.redis) {
            const cacheKey = `dietary:profile:${profile.userId}`;
            await this.redis.set(cacheKey, JSON.stringify(profile), 'EX', 86400 * 30); // 30 days
        }
    }
    /**
     * Get user dietary profile
     */
    async getUserProfile(userId) {
        if (!this.profilesCollection)
            return null;
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
    async checkDishCompatibility(userId, dishDescription, dishAllergens = [], dishDietaryTags = []) {
        const profile = await this.getUserProfile(userId);
        if (!profile) {
            return {
                isCompatible: true,
                conflicts: [],
                warnings: [],
                safeTags: dishDietaryTags,
            };
        }
        const conflicts = [];
        const warnings = [];
        const safeTags = [];
        // Check allergens
        for (const allergy of profile.allergies) {
            const allergen = knowledge_1.MAJOR_ALLERGENS[allergy.allergenId];
            if (allergen) {
                // Check if any allergen aliases appear in the dish
                const hasAllergen = allergen.aliases.some(alias => dishDescription.toLowerCase().includes(alias.toLowerCase()) ||
                    dishAllergens.some(dishAllergen => dishAllergen.toLowerCase() === allergy.allergenId.toLowerCase()));
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
            const dietaryTag = knowledge_1.DIETARY_TAGS[restriction];
            if (dietaryTag) {
                // Check if dish contains any excluded items
                const hasConflict = dietaryTag.excludes.some(excluded => dishDescription.toLowerCase().includes(excluded.toLowerCase()));
                if (hasConflict) {
                    conflicts.push({
                        type: 'restriction',
                        id: restriction,
                        name: dietaryTag.name,
                    });
                }
                else if (dishDietaryTags.includes(restriction)) {
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
    async filterMenuItems(userId, items) {
        const profile = await this.getUserProfile(userId);
        const compatible = [];
        const incompatible = [];
        const needsReview = [];
        for (const item of items) {
            const result = await this.checkDishCompatibility(userId, item.description, item.allergens, item.dietaryTags);
            if (result.isCompatible) {
                compatible.push(item);
            }
            else if (result.conflicts.some(c => c.severity === 'severe')) {
                incompatible.push(item);
            }
            else {
                needsReview.push(item);
            }
        }
        return { compatible, incompatible, needsReview };
    }
    /**
     * Build dietary filter from user preferences
     */
    async buildDietaryFilter(userId) {
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
            const dietaryTag = knowledge_1.DIETARY_TAGS[restriction];
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
    getAllergenInformation(allergenId) {
        const allergen = knowledge_1.MAJOR_ALLERGENS[allergenId];
        if (!allergen)
            return null;
        return {
            name: allergen.name,
            description: `${allergen.name} allergy`,
            aliases: [...allergen.aliases],
            notes: allergen.notes,
        };
    }
    /**
     * Get dietary tag info for display
     */
    getDietaryTagInformation(tagId) {
        const tag = knowledge_1.DIETARY_TAGS[tagId];
        if (!tag)
            return null;
        return {
            name: tag.name,
            description: tag.description,
            excludes: [...tag.excludes],
        };
    }
    /**
     * Scan text for allergen mentions
     */
    scanForAllergens(text) {
        return (0, knowledge_1.containsAllergen)(text);
    }
    /**
     * Generate allergen warning message
     */
    generateAllergenWarning(allergies) {
        if (allergies.length === 0)
            return '';
        const severe = allergies.filter(a => a.severity === 'severe');
        const moderate = allergies.filter(a => a.severity === 'moderate');
        const mild = allergies.filter(a => a.severity === 'mild');
        let warning = '';
        if (severe.length > 0) {
            const names = severe.map(a => knowledge_1.MAJOR_ALLERGENS[a.allergenId]?.name).filter(Boolean);
            warning += `WARNING: This dish contains ${names.join(', ')}. `;
        }
        if (moderate.length > 0) {
            const names = moderate.map(a => knowledge_1.MAJOR_ALLERGENS[a.allergenId]?.name).filter(Boolean);
            warning += `Note: Contains ${names.join(', ')}. `;
        }
        warning += 'Please confirm with restaurant staff about cross-contamination risks.';
        return warning;
    }
    /**
     * Validate dietary filter input
     */
    validateDietaryFilter(filter) {
        const errors = [];
        if (filter.excludeAllergens) {
            for (const allergen of filter.excludeAllergens) {
                if (!knowledge_1.MAJOR_ALLERGENS[allergen]) {
                    errors.push(`Unknown allergen: ${allergen}`);
                }
            }
        }
        if (filter.includeTags) {
            for (const tag of filter.includeTags) {
                if (!knowledge_1.DIETARY_TAGS[tag]) {
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
    async addAllergy(userId, allergenId, severity = 'moderate', notes) {
        const profile = await this.getUserProfile(userId) || this.createEmptyProfile(userId);
        // Check if allergy already exists
        const existingIndex = profile.allergies.findIndex(a => a.allergenId === allergenId);
        if (existingIndex >= 0) {
            profile.allergies[existingIndex] = { allergenId, severity, notes };
        }
        else {
            profile.allergies.push({ allergenId, severity, notes });
        }
        await this.saveUserProfile(profile);
    }
    /**
     * Remove allergy from profile
     */
    async removeAllergy(userId, allergenId) {
        const profile = await this.getUserProfile(userId);
        if (!profile)
            return;
        profile.allergies = profile.allergies.filter(a => a.allergenId !== allergenId);
        await this.saveUserProfile(profile);
    }
    /**
     * Add dietary restriction to profile
     */
    async addRestriction(userId, restrictionId) {
        const profile = await this.getUserProfile(userId) || this.createEmptyProfile(userId);
        if (!profile.restrictions.includes(restrictionId)) {
            profile.restrictions.push(restrictionId);
            await this.saveUserProfile(profile);
        }
    }
    /**
     * Remove dietary restriction from profile
     */
    async removeRestriction(userId, restrictionId) {
        const profile = await this.getUserProfile(userId);
        if (!profile)
            return;
        profile.restrictions = profile.restrictions.filter(r => r !== restrictionId);
        await this.saveUserProfile(profile);
    }
    /**
     * Create empty profile
     */
    createEmptyProfile(userId) {
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
exports.DietaryService = DietaryService;
// Singleton instance
let dietaryService = null;
function getDietaryService() {
    if (!dietaryService) {
        dietaryService = new DietaryService();
    }
    return dietaryService;
}
//# sourceMappingURL=dietaryService.js.map