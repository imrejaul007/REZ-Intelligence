import {
  UserPreferences,
  IUserPreferencesDocument,
  LoyaltyProfile,
  ILoyaltyProfileDocument,
  Tone,
  PrivacyLevel,
  LoyaltyTier,
} from '../models/GlobalPersonalization';
import { logger } from '../utils/logger';

export interface UpdatePreferencesInput {
  tone?: Tone;
  language?: string;
  timezone?: string;
  notificationPreferences?: {
    email?: boolean;
    push?: boolean;
    sms?: boolean;
  };
  privacyLevel?: PrivacyLevel;
  accessibilityNeeds?: string[];
  preferredContentTypes?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateLoyaltyInput {
  points?: number;
  addPoints?: number;
  deductPoints?: number;
  preferences?: {
    favoriteCategories?: string[];
    preferredBrands?: string[];
    communicationStyle?: string;
  };
  history?: {
    totalPurchases?: number;
    totalSpent?: number;
    lastPurchaseDate?: Date;
    favoriteStore?: string;
  };
}

export class PersonalizationService {
  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<IUserPreferencesDocument | null> {
    return UserPreferences.findOne({ userId });
  }

  /**
   * Get or create user preferences with defaults
   */
  async getOrCreatePreferences(userId: string): Promise<IUserPreferencesDocument> {
    let preferences = await UserPreferences.findOne({ userId });

    if (!preferences) {
      preferences = await UserPreferences.create({
        userId,
        tone: Tone.FRIENDLY,
        language: 'en',
        timezone: 'UTC',
        notificationPreferences: { email: true, push: true, sms: false },
        privacyLevel: PrivacyLevel.BALANCED,
        accessibilityNeeds: [],
        preferredContentTypes: [],
      });
      logger.info(`Created default preferences for user: ${userId}`);
    }

    return preferences;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    input: UpdatePreferencesInput
  ): Promise<IUserPreferencesDocument | null> {
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
        } else {
          (preferences as Record<string, unknown>)[key] = value;
        }
      }
    }

    await preferences.save();
    logger.info(`Updated preferences for user: ${userId}`);

    return preferences;
  }

  /**
   * Get loyalty profile
   */
  async getLoyaltyProfile(userId: string): Promise<ILoyaltyProfileDocument | null> {
    return LoyaltyProfile.findOne({ userId });
  }

  /**
   * Get or create loyalty profile with defaults
   */
  async getOrCreateLoyaltyProfile(userId: string): Promise<ILoyaltyProfileDocument> {
    let profile = await LoyaltyProfile.findOne({ userId });

    if (!profile) {
      profile = await LoyaltyProfile.create({
        userId,
        tier: LoyaltyTier.BRONZE,
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
      logger.info(`Created default loyalty profile for user: ${userId}`);
    }

    return profile;
  }

  /**
   * Update loyalty profile
   */
  async updateLoyaltyProfile(
    userId: string,
    input: UpdateLoyaltyInput
  ): Promise<ILoyaltyProfileDocument | null> {
    const profile = await this.getOrCreateLoyaltyProfile(userId);

    // Handle points separately
    if (input.addPoints !== undefined) {
      await profile.addPoints(input.addPoints);
    } else if (input.deductPoints !== undefined) {
      const success = await profile.deductPoints(input.deductPoints);
      if (!success) {
        throw new Error('Insufficient points');
      }
    } else if (input.points !== undefined) {
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
    logger.info(`Updated loyalty profile for user: ${userId}`);

    return profile;
  }

  /**
   * Add points to loyalty profile
   */
  async addPoints(userId: string, points: number): Promise<ILoyaltyProfileDocument | null> {
    const profile = await this.getOrCreateLoyaltyProfile(userId);
    await profile.addPoints(points);
    logger.info(`Added ${points} points for user: ${userId}`);
    return profile;
  }

  /**
   * Redeem points from loyalty profile
   */
  async redeemPoints(userId: string, points: number): Promise<boolean> {
    const profile = await this.getOrCreateLoyaltyProfile(userId);
    const success = await profile.deductPoints(points);
    if (success) {
      logger.info(`Redeemed ${points} points for user: ${userId}`);
    }
    return success;
  }

  /**
   * Get tier benefits for a user
   */
  async getTierBenefits(userId: string): Promise<{
    tier: LoyaltyTier;
    benefits: string[];
    points: number;
    nextTier?: {
      tier: LoyaltyTier;
      pointsNeeded: number;
    };
  } | null> {
    const profile = await this.getLoyaltyProfile(userId);
    if (!profile) {
      return null;
    }

    const tiers = Object.values(LoyaltyTier);
    const currentIndex = tiers.indexOf(profile.tier);
    const nextTier = currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : undefined;

    let nextTierInfo;
    if (nextTier) {
      const thresholds: Record<string, number> = {
        [LoyaltyTier.BRONZE]: 0,
        [LoyaltyTier.SILVER]: 1000,
        [LoyaltyTier.GOLD]: 5000,
        [LoyaltyTier.PLATINUM]: 15000,
        [LoyaltyTier.DIAMOND]: 50000,
      };
      nextTierInfo = {
        tier: nextTier,
        pointsNeeded: thresholds[nextTier] - profile.points,
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
  async recordPurchase(
    userId: string,
    amount: number,
    categories?: string[]
  ): Promise<ILoyaltyProfileDocument> {
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
      const categoryCounts: Record<string, number> = {};
      [...existing, ...categories].forEach((cat) => {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
      profile.preferences.favoriteCategories = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([cat]) => cat);
    }

    await profile.save();
    logger.info(`Recorded purchase of ${amount} for user: ${userId}, earned ${pointsEarned} points`);

    return profile;
  }

  /**
   * Get communication style for a user
   */
  async getCommunicationStyle(userId: string): Promise<{
    tone: Tone;
    language: string;
    privacyLevel: PrivacyLevel;
  }> {
    const preferences = await this.getOrCreatePreferences(userId);

    const loyaltyProfile = await this.getLoyaltyProfile(userId);
    const loyaltyStyle = loyaltyProfile?.preferences.communicationStyle;

    // Combine preferences for communication style
    let tone = preferences.tone;
    if (loyaltyStyle === 'formal') {
      tone = Tone.FORMAL;
    } else if (loyaltyStyle === 'casual') {
      tone = Tone.CASUAL;
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
  async resetPreferences(userId: string): Promise<IUserPreferencesDocument | null> {
    const preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      return null;
    }

    await preferences.resetToDefaults();
    logger.info(`Reset preferences for user: ${userId}`);
    return preferences;
  }

  /**
   * Get personalized greeting based on user profile
   */
  async getPersonalizedGreeting(
    userId: string,
    defaultGreeting: string = 'Hello'
  ): Promise<string> {
    const preferences = await this.getOrCreatePreferences(userId);
    const loyalty = await this.getLoyaltyProfile(userId);

    const hour = new Date().getHours();
    let timeGreeting: string;

    if (hour < 12) {
      timeGreeting = 'Good morning';
    } else if (hour < 17) {
      timeGreeting = 'Good afternoon';
    } else {
      timeGreeting = 'Good evening';
    }

    // Adjust based on tier
    let tierModifier = '';
    if (loyalty?.tier === LoyaltyTier.GOLD ||
        loyalty?.tier === LoyaltyTier.PLATINUM ||
        loyalty?.tier === LoyaltyTier.DIAMOND) {
      tierModifier = ' valued ';
    } else {
      tierModifier = ' ';
    }

    if (preferences.tone === Tone.CASUAL || preferences.tone === Tone.FRIENDLY) {
      return `${timeGreeting}${tierModifier}friend!`;
    }

    return `${timeGreeting}${tierModifier}${defaultGreeting}`;
  }

  /**
   * Bulk update preferences for multiple users (admin function)
   */
  async bulkUpdatePreferences(
    userIds: string[],
    updates: UpdatePreferencesInput
  ): Promise<{ updated: number; failed: number }> {
    let updated = 0;
    let failed = 0;

    for (const userId of userIds) {
      try {
        await this.updatePreferences(userId, updates);
        updated++;
      } catch (error) {
        logger.error(`Failed to update preferences for user: ${userId}`, { error });
        failed++;
      }
    }

    logger.info(`Bulk updated preferences: ${updated} updated, ${failed} failed`);
    return { updated, failed };
  }
}

// Export singleton instance
export const personalizationService = new PersonalizationService();
export default personalizationService;
