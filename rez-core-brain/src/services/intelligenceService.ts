import {
  IntelligenceMetrics,
  IIntelligenceMetricsDocument,
  ContextualData,
} from '../models/GlobalPersonalization';
import { memoryService } from './memoryService';
import { sessionService } from './sessionService';
import { personalizationService } from './personalizationService';
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
    let metrics = await IntelligenceMetrics.findOne({ userId });
    if (!metrics) {
      metrics = await IntelligenceMetrics.create({ userId });
    }
    return metrics;
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
  }

  /**
   * Update session duration in metrics
   */
  async recordSessionDuration(userId: string, duration: number): Promise<void> {
    const metrics = await this.getOrCreateMetrics(userId);
    metrics.engagement.totalSessions += 1;
    metrics.engagement.averageSessionLength =
      (metrics.engagement.averageSessionLength * (metrics.engagement.totalSessions - 1) + duration) /
      metrics.engagement.totalSessions;
    await metrics.save();
  }

  /**
   * Generate personalized recommendations
   */
  async generateRecommendations(input: RecommendationInput): Promise<Array<{
    itemId: string;
    score: number;
    reason: string;
  }>> {
    const { userId, context, excludedItems = [], limit = 5 } = input;

    // Get user preferences and metrics
    const preferences = await personalizationService.getOrCreatePreferences(userId);
    const metrics = await this.getOrCreateMetrics(userId);

    // Get recent memories to understand context
    const memories = await memoryService.getUserMemories({
      userId,
      type: undefined,
      limit: 10,
    });

    // Simple recommendation logic based on preferences
    const recommendations: Array<{ itemId: string; score: number; reason: string }> = [];

    // Generate mock recommendations based on user context
    const toneMap: Record<string, string> = {
      formal: 'Professional content',
      casual: 'Relaxed content',
      friendly: 'Community content',
      professional: 'Business content',
    };

    const baseReason = toneMap[preferences.tone] || 'Personalized content';

    for (let i = 0; i < limit; i++) {
      const itemId = `rec_${i}_${Date.now()}`;
      if (!excludedItems.includes(itemId)) {
        recommendations.push({
          itemId,
          score: 0.9 - i * 0.1,
          reason: `${baseReason} based on your ${context || 'interests'}`,
        });
      }
    }

    return recommendations;
  }

  /**
   * Get engagement score for a user
   */
  async getEngagementScore(userId: string): Promise<{
    score: number;
    level: 'low' | 'medium' | 'high';
    factors: Record<string, number>;
  }> {
    const metrics = await this.getOrCreateMetrics(userId);
    const contextualData = await ContextualData.findOne({ userId });

    const sessionFrequency = Math.min(metrics.engagement.totalSessions / 10, 1);
    const sessionDuration = Math.min(metrics.engagement.averageSessionLength / 1800, 1);
    const interactionFrequency = Math.min(metrics.engagement.interactionFrequency / 100, 1);
    const diversity = metrics.behavior.preferredAgents.length / 5;
    const recentActivity = contextualData ? 0.5 : 0;

    const factors: Record<string, number> = {
      sessionFrequency,
      sessionDuration,
      interactionFrequency,
      diversity,
      recentActivity,
    };

    const score =
      sessionFrequency * 0.2 +
      sessionDuration * 0.3 +
      interactionFrequency * 0.2 +
      diversity * 0.15 +
      recentActivity * 0.15;

    let level: 'low' | 'medium' | 'high' = 'low';
    if (score >= 0.6) level = 'high';
    else if (score >= 0.3) level = 'medium';

    return { score, level, factors };
  }

  /**
   * Calculate user intent from activity
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
    patterns: Array<{ type: string; description: string; confidence: number }>;
    preferredTime: string;
    preferredAgents: string[];
  }> {
    const metrics = await this.getOrCreateMetrics(userId);
    const contextualData = await ContextualData.findOne({ userId });

    const patterns: Array<{ type: string; description: string; confidence: number }> = [];

    // Analyze session patterns
    if (metrics.engagement.averageSessionLength > 1800) {
      patterns.push({
        type: 'deep_engagement',
        description: 'User tends to have longer sessions',
        confidence: 0.8,
      });
    }

    if (metrics.engagement.interactionFrequency > 50) {
      patterns.push({
        type: 'high_activity',
        description: 'User is highly active on the platform',
        confidence: 0.75,
      });
    }

    // Analyze agent preferences
    const preferredAgents = metrics.behavior.preferredAgents;
    if (preferredAgents.length > 0) {
      patterns.push({
        type: 'agent_loyalty',
        description: `User prefers: ${preferredAgents.slice(0, 2).join(', ')}`,
        confidence: 0.7,
      });
    }

    // Analyze temporal patterns
    const recentIntents = contextualData?.relationships?.recentIntents || [];
    const preferredTime = recentIntents.length > 0 ? 'evening' : 'unknown';

    return {
      patterns,
      preferredTime,
      preferredAgents,
    };
  }

  /**
   * Predict next action based on history
   */
  async predictNextAction(userId: string): Promise<{
    action: string;
    confidence: number;
    reason: string;
  }> {
    const contextualData = await ContextualData.findOne({ userId });
    const recentIntents = contextualData?.relationships?.recentIntents || [];

    if (recentIntents.length === 0) {
      return {
        action: 'explore',
        confidence: 0.5,
        reason: 'No history available',
      };
    }

    // Simple prediction based on last action
    const lastIntent = recentIntents[0];
    const predictions: Record<string, { action: string; confidence: number }> = {
      search: { action: 'view', confidence: 0.7 },
      view: { action: 'book', confidence: 0.6 },
      book: { action: 'review', confidence: 0.5 },
    };

    const prediction = predictions[lastIntent] || { action: 'explore', confidence: 0.4 };

    return {
      action: prediction.action,
      confidence: prediction.confidence,
      reason: `Based on recent activity: ${lastIntent}`,
    };
  }
}

export default new IntelligenceService();
