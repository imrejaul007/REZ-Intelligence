import { IIntelligenceMetricsDocument } from '../models/GlobalPersonalization';
import { IIntelligenceMetrics, IContextualData } from '../types';
export interface IntelligenceContext {
    userId: string;
    includeMetrics?: boolean;
    includeContext?: boolean;
    includePreferences?: boolean;
    includeRecentMemories?: boolean;
    includeSessionContext?: boolean;
}
export interface RecommendationInput {
    userId: string;
    context?: string;
    excludedItems?: string[];
    limit?: number;
}
export declare class IntelligenceService {
    /**
     * Get comprehensive intelligence data for a user
     */
    getIntelligenceData(input: IntelligenceContext): Promise<{
        metrics?: IIntelligenceMetrics;
        contextualData?: IContextualData;
        preferences?: Record<string, unknown>;
        recentMemories?: Array<{
            id: string;
            content: string;
            type: string;
        }>;
        sessionContext?: Record<string, unknown>;
    }>;
    /**
     * Get or create intelligence metrics for a user
     */
    getOrCreateMetrics(userId: string): Promise<IIntelligenceMetricsDocument>;
    /**
     * Update intelligence metrics based on user activity
     */
    updateMetricsFromActivity(userId: string, activity: {
        sessionDuration?: number;
        interactions?: number;
        agentUsed?: string;
        actionType?: string;
    }): Promise<void>;
    /**
     * Generate personalized recommendations based on user data
     */
    generateRecommendations(input: RecommendationInput): Promise<{
        recommendations: Array<{
            type: string;
            content: string;
            confidence: number;
            reason: string;
        }>;
    }>;
    /**
     * Calculate user intent based on context
     */
    calculateIntent(userId: string, currentAction: string, context?: Record<string, unknown>): Promise<{
        primaryIntent: string;
        confidence: number;
        alternativeIntents: Array<{
            intent: string;
            confidence: number;
        }>;
    }>;
    /**
     * Update user's recent intents
     */
    updateUserIntent(userId: string, intent: string): Promise<void>;
    /**
     * Analyze user behavior patterns
     */
    analyzeBehaviorPatterns(userId: string): Promise<{
        patterns: Array<{
            pattern: string;
            frequency: number;
            lastOccurrence: Date;
            confidence: number;
        }>;
        insights: string[];
        predictedNextActions: string[];
    }>;
    /**
     * Get user engagement score
     */
    getEngagementScore(userId: string): Promise<{
        score: number;
        level: 'low' | 'medium' | 'high' | 'very_high';
        factors: Record<string, number>;
    }>;
    /**
     * Calculate similarity between users (for collaborative filtering)
     */
    calculateUserSimilarity(userId1: string, userId2: string): Promise<{
        similarity: number;
        commonBehaviors: string[];
        commonPreferences: string[];
    }>;
}
export declare const intelligenceService: IntelligenceService;
export default intelligenceService;
//# sourceMappingURL=intelligenceService.d.ts.map