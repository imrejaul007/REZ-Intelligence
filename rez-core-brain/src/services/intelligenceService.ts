import {
  IntelligenceMetrics,
  IIntelligenceMetricsDocument,
  ContextualData,
  IContextualDataDocument,
} from '../models/GlobalPersonalization';
import { memoryService } from './memoryService';
import { sessionService } from './sessionService';
import { personalizationService } from './personalizationService';
import { MemoryType } from '../models/UserMemory';
import { logger } from '../utils/logger';
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

export class IntelligenceService {
  /**
   * Get comprehensive intelligence data for a user
   */
  async getIntelligenceData(input: IntelligenceContext): Promise<{
    metrics?: IIntelligenceMetrics;
    contextualData?: IContextualData;
    preferences?: Record<string, unknown>;
    recentMemories?: Array<{ id: string; content: string; type: string }>;
    sessionContext?: Record<string, unknown>;
  }> {
    const { userId } = input;
    const result: Record<string, unknown> = {};

    if (input.includeMetrics !== false) {
      const metrics = await IntelligenceMetrics.findOne({ userId });
      if (metrics) {
        result.metrics = metrics.toObject();
      }
    }

    if (input.includeContext !== false) {
      let contextualData = await ContextualData.findOne({ userId });
      if (!contextualData) {
        contextualData = await ContextualData.create({
          userId,
          currentContext: {},
          recentActivity: {},
          temporalContext: {},
          relationships: { activeAgents: [], recentIntents: [], pendingTasks: [] },
        });
      }
      result.contextualData = contextualData.toObject();
    }

    if (input.includePreferences) {
      const preferences = await personalizationService.getOrCreatePreferences(userId);
      result.preferences = preferences.toObject();
    }

    if (input.includeRecentMemories) {
      const memories = await memoryService.getUserMemories({
        userId,
        limit: 10,
      });
      result.recentMemories = memories.map((m) => ({
        id: m.id,
        content: m.content,
        type: m.type,
      }));
    }

    if (input.includeSessionContext) {
      const session = await sessionService.getOrCreateSession(userId);
      result.sessionContext = {
        sessionId: session.id,
        state: session.state,
        context: session.context,
        startTime: session.startTime,
      };
    }

    return result as {
      metrics?: IIntelligenceMetrics;
      contextualData?: IContextualData;
      preferences?: Record<string, unknown>;
      recentMemories?: Array<{ id: string; content: string; type: string }>;
      sessionContext?: Record<string, unknown>;
    };
  }

  /**
   * Get or create intelligence metrics for a user
   */
  async getOrCreateMetrics(userId: string): Promise<IIntelligenceMetricsDocument> {
    return IntelligenceMetrics.getOrCreate(userId);
  }

  /**
   * Update intelligence metrics based on user activity
   */
  async updateMetricsFromActivity(
    userId: string,
    activity: {
      sessionDuration?: number;
      interactions?: number;
      agentUsed?: string;
      actionType?: string;
    }
  ): Promise<void> {
    let metrics = await IntelligenceMetrics.findOne({ userId });

    if (!metrics) {
      metrics = await IntelligenceMetrics.create({ userId });
    }

    // Update engagement metrics
    if (activity.sessionDuration !== undefined) {
      // Update rolling average
      const currentAvg = metrics.engagement.averageSessionLength;
      const sessions = metrics.engagement.dailyActiveDays || 1;
      metrics.engagement.averageSessionLength =
        (currentAvg * (sessions - 1) + activity.sessionDuration) / sessions;
    }

    if (activity.interactions !== undefined) {
      metrics.engagement.interactionFrequency += activity.interactions;
    }

    // Update behavior metrics
    if (activity.agentUsed) {
      const agents = metrics.behavior.preferredAgents;
      if (!agents.includes(activity.agentUsed)) {
        agents.push(activity.agentUsed);
        // Keep only top 5 preferred agents
        metrics.behavior.preferredAgents = agents.slice(0, 5);
      }
    }

    metrics.calculatedAt = new Date();
    await metrics.save();

    logger.info(`Updated intelligence metrics for user: ${userId}`);
  }

  /**
   * Generate personalized recommendations based on user data
   */
  async generateRecommendations(input: RecommendationInput): Promise<{
    recommendations: Array<{
      type: string;
      content: string;
      confidence: number;
      reason: string;
    }>;
  }> {
    const { userId, context, excludedItems = [], limit = 5 } = input;
    const recommendations: Array<{
      type: string;
      content: string;
      confidence: number;
      reason: string;
    }> = [];

    // Get user context
    const intelligenceData = await this.getIntelligenceData({
      userId,
      includeMetrics: true,
      includeContext: true,
      includePreferences: true,
    });

    const contextualData = intelligenceData.contextualData;
    const metrics = intelligenceData.metrics;
    const preferences = intelligenceData.preferences as Record<string, unknown> | undefined;

    // Time-based recommendations
    if (contextualData?.temporalContext?.timeOfDay) {
      const timeOfDay = contextualData.temporalContext.timeOfDay as string;
      if (timeOfDay === 'morning' && !excludedItems.includes('morning_offer')) {
        recommendations.push({
          type: 'promotion',
          content: 'Start your day with exclusive morning deals',
          confidence: 0.8,
          reason: 'Based on your morning browsing patterns',
        });
      }
    }

    // Loyalty tier-based recommendations
    if (contextualData?.relationships?.recentIntents?.length) {
      const recentIntents = contextualData.relationships.recentIntents as string[];
      const lastIntent = recentIntents[0];

      if (lastIntent === 'booking' && !excludedItems.includes('loyalty_upgrade')) {
        recommendations.push({
          type: 'loyalty',
          content: 'Check out Gold tier benefits - exclusive hotel upgrades await',
          confidence: 0.75,
          reason: 'Based on your recent booking activity',
        });
      }
    }

    // Behavior-based recommendations
    if (metrics?.behavior?.preferredAgents?.length) {
      const preferredAgents = metrics.behavior.preferredAgents;
      if (preferredAgents.includes('hotel_assistant') && !excludedItems.includes('hotel_recommendation')) {
        recommendations.push({
          type: 'personalized',
          content: 'Explore trending hotels in your favorite destinations',
          confidence: 0.85,
          reason: 'Based on your hotel assistant usage patterns',
        });
      }
    }

    // Preference-based recommendations
    if (preferences?.preferredContentTypes) {
      const contentTypes = preferences.preferredContentTypes as string[];
      if (contentTypes.includes('deals') && !excludedItems.includes('deals')) {
        recommendations.push({
          type: 'deals',
          content: 'Exclusive deals matching your preferences are available',
          confidence: 0.9,
          reason: 'Based on your deal-seeking behavior',
        });
      }
    }

    // Sort by confidence and limit
    recommendations.sort((a, b) => b.confidence - a.confidence);
    return {
      recommendations: recommendations.slice(0, limit),
    };
  }

  /**
   * Calculate user intent based on context
   */
  async calculateIntent(
    userId: string,
    currentAction: string,
    context?: Record<string, unknown>
  ): Promise<{
    primaryIntent: string;
    confidence: number;
    alternativeIntents: Array<{ intent: string; confidence: number }>;
  }> {
    // Get recent activity
    const contextualData = await ContextualData.findOne({ userId });
    const recentIntents = contextualData?.relationships?.recentIntents || [];

    // Simple intent calculation based on patterns
    let primaryIntent = currentAction;
    let confidence = 0.5;
    const alternativeIntents: Array<{ intent: string; confidence: number }> = [];

    // Check for intent chains (common patterns)
    if (recentIntents.length >= 2) {
      const lastIntent = recentIntents[0];
      const secondLastIntent = recentIntents[1];

      // Common intent chains
      const intentChains: Record<string, Record<string, { intent: string; confidence: number }>> = {
        'search': {
          'view': { intent: 'comparison', confidence: 0.7 },
          'book': { intent: 'purchase_intent', confidence: 0.8 },
        },
        'view': {
          'search': { intent: 'exploration', confidence: 0.6 },
          'book': { intent: 'high_intent', confidence: 0.85 },
        },
        'book': {
          'review': { intent: 'feedback_intent', confidence: 0.75 },
          'cancel': { intent: 'support_needed', confidence: 0.8 },
        },
      };

      const chain = intentChains[lastIntent];
      if (chain && chain[currentAction]) {
        primaryIntent = chain[currentAction].intent;
        confidence = chain[currentAction].confidence;
      }
    }

    // Context-based adjustments
    if (context?.device === 'mobile') {
      alternativeIntents.push({
        intent: 'mobile_engagement',
        confidence: 0.7,
      });
    }

    if (context?.location) {
      alternativeIntents.push({
        intent: 'location_based',
        confidence: 0.65,
      });
    }

    // Update contextual data with new intent
    await this.updateUserIntent(userId, currentAction);

    return {
      primaryIntent,
      confidence,
      alternativeIntents: alternativeIntents.sort((a, b) => b.confidence - a.confidence),
    };
  }

  /**
   * Update user's recent intents
   */
  async updateUserIntent(userId: string, intent: string): Promise<void> {
    let contextualData = await ContextualData.findOne({ userId });

    if (!contextualData) {
      contextualData = await ContextualData.create({
        userId,
        currentContext: {},
        recentActivity: {},
        temporalContext: {},
        relationships: {
          activeAgents: [],
          recentIntents: [intent],
          pendingTasks: [],
        },
      });
    } else {
      await contextualData.addIntent(intent);
    }

    logger.info(`Updated intent for user: ${userId}`, { intent });
  }

  /**
   * Analyze user behavior patterns
   */
  async analyzeBehaviorPatterns(userId: string): Promise<{
    patterns: Array<{
      pattern: string;
      frequency: number;
      lastOccurrence: Date;
      confidence: number;
    }>;
    insights: string[];
    predictedNextActions: string[];
  }> {
    const patterns: Array<{
      pattern: string;
      frequency: number;
      lastOccurrence: Date;
      confidence: number;
    }> = [];
    const insights: string[] = [];
    const predictedNextActions: string[] = [];

    // Get user's contextual data
    const contextualData = await ContextualData.findOne({ userId });
    const metrics = await IntelligenceMetrics.findOne({ userId });

    // Analyze temporal patterns
    if (contextualData?.temporalContext) {
      const dayOfWeek = contextualData.temporalContext.dayOfWeek;
      if (dayOfWeek !== undefined) {
        patterns.push({
          pattern: 'weekday_vs_weekend',
          frequency: dayOfWeek >= 1 && dayOfWeek <= 5 ? 0.7 : 0.3,
          lastOccurrence: new Date(),
          confidence: 0.8,
        });
        insights.push(
          dayOfWeek >= 1 && dayOfWeek <= 5
            ? 'User is most active on weekdays'
            : 'User is most active on weekends'
        );
      }
    }

    // Analyze agent preferences
    if (metrics?.behavior?.preferredAgents?.length) {
      const agents = metrics.behavior.preferredAgents;
      insights.push(`User prefers ${agents[0]} agent`);
      predictedNextActions.push(`${agents[0]}_quick_action`);
    }

    // Analyze exploration vs exploitation
    if (metrics?.behavior?.explorationVsExploitation !== undefined) {
      const ratio = metrics.behavior.explorationVsExploitation;
      if (ratio > 0.7) {
        insights.push('User tends to explore new options');
        predictedNextActions.push('discovery_mode');
      } else if (ratio < 0.3) {
        insights.push('User prefers familiar options');
        predictedNextActions.push('repeat_purchase');
      } else {
        insights.push('User balances exploration with familiar choices');
      }
    }

    return { patterns, insights, predictedNextActions };
  }

  /**
   * Get user engagement score
   */
  async getEngagementScore(userId: string): Promise<{
    score: number;
    level: 'low' | 'medium' | 'high' | 'very_high';
    factors: Record<string, number>;
  }> {
    const metrics = await IntelligenceMetrics.findOne({ userId });

    if (!metrics) {
      return {
        score: 0,
        level: 'low',
        factors: {},
      };
    }

    const factors: Record<string, number> = {};
    let totalScore = 0;
    let factorCount = 0;

    // Frequency factor
    factors.frequency = Math.min(1, metrics.engagement.interactionFrequency / 100);
    totalScore += factors.frequency;
    factorCount++;

    // Recency factor (based on daily active days)
    factors.recency = Math.min(1, metrics.engagement.dailyActiveDays / 7);
    totalScore += factors.recency;
    factorCount++;

    // Session length factor
    factors.sessionLength = Math.min(1, metrics.engagement.averageSessionLength / 1800); // 30 min baseline
    totalScore += factors.sessionLength;
    factorCount++;

    // Consistency factor
    factors.consistency = metrics.preferences.consistencyScore;
    totalScore += factors.consistency;
    factorCount++;

    const score = totalScore / factorCount;

    let level: 'low' | 'medium' | 'high' | 'very_high';
    if (score < 0.25) level = 'low';
    else if (score < 0.5) level = 'medium';
    else if (score < 0.75) level = 'high';
    else level = 'very_high';

    return { score, level, factors };
  }

  /**
   * Calculate similarity between users (for collaborative filtering)
   */
  async calculateUserSimilarity(
    userId1: string,
    userId2: string
  ): Promise<{
    similarity: number;
    commonBehaviors: string[];
    commonPreferences: string[];
  }> {
    const [metrics1, metrics2] = await Promise.all([
      IntelligenceMetrics.findOne({ userId: userId1 }),
      IntelligenceMetrics.findOne({ userId: userId2 }),
    ]);

    if (!metrics1 || !metrics2) {
      return { similarity: 0, commonBehaviors: [], commonPreferences: [] };
    }

    // Compare behavior metrics
    let similarityScore = 0;
    const commonBehaviors: string[] = [];
    const commonPreferences: string[] = [];

    // Preferred agents overlap
    const commonAgents = metrics1.behavior.preferredAgents.filter((a) =>
      metrics2.behavior.preferredAgents.includes(a)
    );
    if (commonAgents.length > 0) {
      similarityScore += 0.3;
      commonBehaviors.push(...commonAgents.map((a) => `agent:${a}`));
    }

    // Peak hours overlap
    const commonHours = metrics1.behavior.peakActivityHours.filter((h) =>
      metrics2.behavior.peakActivityHours.includes(h)
    );
    if (commonHours.length > 0) {
      similarityScore += 0.2;
    }

    // Consistency score similarity
    const consistencyDiff = Math.abs(
      metrics1.preferences.consistencyScore - metrics2.preferences.consistencyScore
    );
    if (consistencyDiff < 0.2) {
      similarityScore += 0.25;
      commonPreferences.push('consistency');
    }

    // Exploration vs exploitation similarity
    const explorationDiff = Math.abs(
      metrics1.behavior.explorationVsExploitation -
        metrics2.behavior.explorationVsExploitation
    );
    if (explorationDiff < 0.2) {
      similarityScore += 0.25;
      commonPreferences.push('exploration_style');
    }

    return {
      similarity: similarityScore,
      commonBehaviors,
      commonPreferences,
    };
  }
}

// Export singleton instance
export const intelligenceService = new IntelligenceService();
export default intelligenceService;
