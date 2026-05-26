"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.personalizationService = exports.PersonalizationService = void 0;
const GlobalPersonalization_1 = require("../models/GlobalPersonalization");
const logger_1 = require("../utils/logger");
class PersonalizationService {
    /**
     * Get user preferences
     */
    async getPreferences(userId) {
        return GlobalPersonalization_1.UserPreferences.findOne({ userId });
    }
    /**
     * Get or create user preferences with defaults
     */
    async getOrCreatePreferences(userId) {
        let preferences = await GlobalPersonalization_1.UserPreferences.findOne({ userId });
        if (!preferences) {
            preferences = await GlobalPersonalization_1.UserPreferences.create({
                userId,
                tone: GlobalPersonalization_1.Tone.FRIENDLY,
                language: 'en',
                timezone: 'UTC',
                notificationPreferences: { email: true, push: true, sms: false },
                privacyLevel: GlobalPersonalization_1.PrivacyLevel.BALANCED,
                accessibilityNeeds: [],
                preferredContentTypes: [],
            });
            logger_1.logger.info(`Created default preferences for user: ${userId}`);
        }
        return preferences;
    }
    /**
     * Update user preferences
     */
    async updatePreferences(userId, input) {
        const preferences = await this.getOrCreatePreferences(userId);
        const allowedUpdates = [
            'tone',
            'language',
            'timezone',
            'privacyLevel',
            'accessibilityNeeds',
            'preferredContentTypes',
            'metadata',
        ];
        for (const [key, value] of Object.entries(input)) {
            if (allowedUpdates.includes(key) && value !== undefined) {
                if (key === 'notificationPreferences' && typeof value === 'object') {
                    Object.assign(preferences.notificationPreferences, value);
                }
                else {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    preferences[key] = value;
                }
            }
        }
        await preferences.save();
        logger_1.logger.info(`Updated preferences for user: ${userId}`);
        return preferences;
    }
    /**
     * Get loyalty profile
     */
    async getLoyaltyProfile(userId) {
        return GlobalPersonalization_1.LoyaltyProfile.findOne({ userId });
    }
    /**
     * Get or create loyalty profile with defaults
     */
    async getOrCreateLoyaltyProfile(userId) {
        let profile = await GlobalPersonalization_1.LoyaltyProfile.findOne({ userId });
        if (!profile) {
            profile = await GlobalPersonalization_1.LoyaltyProfile.create({
                userId,
                tier: GlobalPersonalization_1.LoyaltyTier.BRONZE,
                points: 0,
                lifetimeValue: 0,
                memberSince: new Date(),
                benefits: ['Basic rewards', 'Email support'],
                preferences: {
                    favoriteCategories: [],
                    preferredBrands: [],
                },
                history: {
                    totalPurchases: 0,
                    totalSpent: 0,
                    averageOrderValue: 0,
                },
            });
            logger_1.logger.info(`Created default loyalty profile for user: ${userId}`);
        }
        return profile;
    }
    /**
     * Update loyalty profile
     */
    async updateLoyaltyProfile(userId, input) {
        const profile = await this.getOrCreateLoyaltyProfile(userId);
        // Handle points separately
        if (input.addPoints !== undefined) {
            await profile.addPoints(input.addPoints);
        }
        else if (input.deductPoints !== undefined) {
            const success = await profile.deductPoints(input.deductPoints);
            if (!success) {
                throw new Error('Insufficient points');
            }
        }
        else if (input.points !== undefined) {
            profile.points = input.points;
            await profile.upgradeTier();
        }
        // Update preferences
        if (input.preferences) {
            if (input.preferences.favoriteCategories) {
                profile.preferences.favoriteCategories = input.preferences.favoriteCategories;
            }
            if (input.preferences.preferredBrands) {
                profile.preferences.preferredBrands = input.preferences.preferredBrands;
            }
            if (input.preferences.communicationStyle) {
                profile.preferences.communicationStyle = input.preferences.communicationStyle;
            }
        }
        // Update history
        if (input.history) {
            if (input.history.totalPurchases !== undefined) {
                profile.history.totalPurchases = input.history.totalPurchases;
            }
            if (input.history.totalSpent !== undefined) {
                profile.history.totalSpent = input.history.totalSpent;
                profile.lifetimeValue = input.history.totalSpent;
            }
            if (input.history.lastPurchaseDate) {
                profile.history.lastPurchaseDate = input.history.lastPurchaseDate;
            }
            if (input.history.favoriteStore) {
                profile.history.favoriteStore = input.history.favoriteStore;
            }
            await profile.calculateLifetimeValue();
        }
        await profile.save();
        logger_1.logger.info(`Updated loyalty profile for user: ${userId}`);
        return profile;
    }
    /**
     * Add points to loyalty profile
     */
    async addPoints(userId, points) {
        const profile = await this.getOrCreateLoyaltyProfile(userId);
        await profile.addPoints(points);
        logger_1.logger.info(`Added ${points} points for user: ${userId}`);
        return profile;
    }
    /**
     * Redeem points from loyalty profile
     */
    async redeemPoints(userId, points) {
        const profile = await this.getOrCreateLoyaltyProfile(userId);
        const success = await profile.deductPoints(points);
        if (success) {
            logger_1.logger.info(`Redeemed ${points} points for user: ${userId}`);
        }
        return success;
    }
    /**
     * Get tier benefits for a user
     */
    async getTierBenefits(userId) {
        const profile = await this.getLoyaltyProfile(userId);
        if (!profile) {
            return null;
        }
        const tiers = Object.values(GlobalPersonalization_1.LoyaltyTier);
        const currentIndex = tiers.indexOf(profile.tier);
        const nextTierValue = currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : undefined;
        let nextTierInfo;
        if (nextTierValue) {
            const thresholds = {
                [GlobalPersonalization_1.LoyaltyTier.BRONZE]: 0,
                [GlobalPersonalization_1.LoyaltyTier.SILVER]: 1000,
                [GlobalPersonalization_1.LoyaltyTier.GOLD]: 5000,
                [GlobalPersonalization_1.LoyaltyTier.PLATINUM]: 15000,
                [GlobalPersonalization_1.LoyaltyTier.DIAMOND]: 50000,
            };
            const tierEnum = nextTierValue;
            nextTierInfo = {
                tier: tierEnum,
                pointsNeeded: (thresholds[nextTierValue] ?? 0) - profile.points,
            };
        }
        return {
            tier: profile.tier,
            benefits: profile.benefits,
            points: profile.points,
            nextTier: nextTierInfo,
        };
    }
    /**
     * Record a purchase and update loyalty
     */
    async recordPurchase(userId, amount, categories) {
        const profile = await this.getOrCreateLoyaltyProfile(userId);
        // Calculate points (1 point per dollar spent)
        const pointsEarned = Math.floor(amount);
        // Update history
        profile.history.totalPurchases += 1;
        profile.history.totalSpent += amount;
        profile.history.lastPurchaseDate = new Date();
        await profile.calculateLifetimeValue();
        // Add points
        await profile.addPoints(pointsEarned);
        // Update favorite categories if provided
        if (categories && categories.length > 0) {
            const existing = profile.preferences.favoriteCategories || [];
            // Add new categories, keeping track of frequency
            const categoryCounts = {};
            [...existing, ...categories].forEach((cat) => {
                categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
            });
            profile.preferences.favoriteCategories = Object.entries(categoryCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([cat]) => cat);
        }
        await profile.save();
        logger_1.logger.info(`Recorded purchase of ${amount} for user: ${userId}, earned ${pointsEarned} points`);
        return profile;
    }
    /**
     * Get communication style for a user
     */
    async getCommunicationStyle(userId) {
        const preferences = await this.getOrCreatePreferences(userId);
        const loyaltyProfile = await this.getLoyaltyProfile(userId);
        const loyaltyStyle = loyaltyProfile?.preferences.communicationStyle;
        // Combine preferences for communication style
        let tone = preferences.tone;
        if (loyaltyStyle === 'formal') {
            tone = GlobalPersonalization_1.Tone.FORMAL;
        }
        else if (loyaltyStyle === 'casual') {
            tone = GlobalPersonalization_1.Tone.CASUAL;
        }
        return {
            tone,
            language: preferences.language,
            privacyLevel: preferences.privacyLevel,
        };
    }
    /**
     * Reset preferences to defaults
     */
    async resetPreferences(userId) {
        const preferences = await GlobalPersonalization_1.UserPreferences.findOne({ userId });
        if (!preferences) {
            return null;
        }
        await preferences.resetToDefaults();
        logger_1.logger.info(`Reset preferences for user: ${userId}`);
        return preferences;
    }
    /**
     * Get personalized greeting based on user profile
     */
    async getPersonalizedGreeting(userId, defaultGreeting = 'Hello') {
        const preferences = await this.getOrCreatePreferences(userId);
        const loyalty = await this.getLoyaltyProfile(userId);
        const hour = new Date().getHours();
        let timeGreeting;
        if (hour < 12) {
            timeGreeting = 'Good morning';
        }
        else if (hour < 17) {
            timeGreeting = 'Good afternoon';
        }
        else {
            timeGreeting = 'Good evening';
        }
        // Adjust based on tier
        let tierModifier = '';
        if (loyalty?.tier === GlobalPersonalization_1.LoyaltyTier.GOLD ||
            loyalty?.tier === GlobalPersonalization_1.LoyaltyTier.PLATINUM ||
            loyalty?.tier === GlobalPersonalization_1.LoyaltyTier.DIAMOND) {
            tierModifier = ' valued ';
        }
        else {
            tierModifier = ' ';
        }
        if (preferences.tone === GlobalPersonalization_1.Tone.CASUAL || preferences.tone === GlobalPersonalization_1.Tone.FRIENDLY) {
            return `${timeGreeting}${tierModifier}friend!`;
        }
        return `${timeGreeting}${tierModifier}${defaultGreeting}`;
    }
    /**
     * Bulk update preferences for multiple users (admin function)
     */
    async bulkUpdatePreferences(userIds, updates) {
        let updated = 0;
        let failed = 0;
        for (const userId of userIds) {
            try {
                await this.updatePreferences(userId, updates);
                updated++;
            }
            catch (error) {
                logger_1.logger.error(`Failed to update preferences for user: ${userId}`, { error });
                failed++;
            }
        }
        logger_1.logger.info(`Bulk updated preferences: ${updated} updated, ${failed} failed`);
        return { updated, failed };
    }
}
exports.PersonalizationService = PersonalizationService;
// Export singleton instance
exports.personalizationService = new PersonalizationService();
exports.default = exports.personalizationService;
//# sourceMappingURL=personalizationService.js.map