import { IUserPreferencesDocument, ILoyaltyProfileDocument, Tone, PrivacyLevel, LoyaltyTier } from '../models/GlobalPersonalization';
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
export declare class PersonalizationService {
    /**
     * Get user preferences
     */
    getPreferences(userId: string): Promise<IUserPreferencesDocument | null>;
    /**
     * Get or create user preferences with defaults
     */
    getOrCreatePreferences(userId: string): Promise<IUserPreferencesDocument>;
    /**
     * Update user preferences
     */
    updatePreferences(userId: string, input: UpdatePreferencesInput): Promise<IUserPreferencesDocument | null>;
    /**
     * Get loyalty profile
     */
    getLoyaltyProfile(userId: string): Promise<ILoyaltyProfileDocument | null>;
    /**
     * Get or create loyalty profile with defaults
     */
    getOrCreateLoyaltyProfile(userId: string): Promise<ILoyaltyProfileDocument>;
    /**
     * Update loyalty profile
     */
    updateLoyaltyProfile(userId: string, input: UpdateLoyaltyInput): Promise<ILoyaltyProfileDocument | null>;
    /**
     * Add points to loyalty profile
     */
    addPoints(userId: string, points: number): Promise<ILoyaltyProfileDocument | null>;
    /**
     * Redeem points from loyalty profile
     */
    redeemPoints(userId: string, points: number): Promise<boolean>;
    /**
     * Get tier benefits for a user
     */
    getTierBenefits(userId: string): Promise<{
        tier: LoyaltyTier;
        benefits: string[];
        points: number;
        nextTier?: {
            tier: LoyaltyTier;
            pointsNeeded: number;
        };
    } | null>;
    /**
     * Record a purchase and update loyalty
     */
    recordPurchase(userId: string, amount: number, categories?: string[]): Promise<ILoyaltyProfileDocument>;
    /**
     * Get communication style for a user
     */
    getCommunicationStyle(userId: string): Promise<{
        tone: Tone;
        language: string;
        privacyLevel: PrivacyLevel;
    }>;
    /**
     * Reset preferences to defaults
     */
    resetPreferences(userId: string): Promise<IUserPreferencesDocument | null>;
    /**
     * Get personalized greeting based on user profile
     */
    getPersonalizedGreeting(userId: string, defaultGreeting?: string): Promise<string>;
    /**
     * Bulk update preferences for multiple users (admin function)
     */
    bulkUpdatePreferences(userIds: string[], updates: UpdatePreferencesInput): Promise<{
        updated: number;
        failed: number;
    }>;
}
export declare const personalizationService: PersonalizationService;
export default personalizationService;
//# sourceMappingURL=personalizationService.d.ts.map