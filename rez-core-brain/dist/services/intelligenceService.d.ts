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
     * Update session duration in metrics
     */
    recordSessionDuration(userId: string, duration: number): Promise<void>;
    /**
     * Generate personalized recommendations
     */
    generateRecommendations(input: RecommendationInput): Promise<Array<{
        itemId: string;
        score: number;
        reason: string;
    }>>;
    /**
     * Get engagement score for a user
     */
    getEngagementScore(userId: string): Promise<{
        score: number;
        level: 'low' | 'medium' | 'high';
        factors: Record<string, number>;
    }>;
    /**
     * Calculate user intent from activity
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
            type: string;
            description: string;
            confidence: number;
        }>;
        preferredTime: string;
        preferredAgents: string[];
    }>;
    /**
     * Predict next action based on history
     */
    predictNextAction(userId: string): Promise<{
        action: string;
        confidence: number;
        reason: string;
    }>;
}
declare const _default: IntelligenceService;
export default _default;
//# sourceMappingURL=intelligenceService.d.ts.map