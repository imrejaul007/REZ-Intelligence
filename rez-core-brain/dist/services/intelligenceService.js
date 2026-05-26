"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligenceService = void 0;
const GlobalPersonalization_1 = require("../models/GlobalPersonalization");
const memoryService_1 = require("./memoryService");
const sessionService_1 = require("./sessionService");
const personalizationService_1 = require("./personalizationService");
const logger_1 = require("../utils/logger");
class IntelligenceService {
    /**
     * Get comprehensive intelligence data for a user
     */
    async getIntelligenceData(input) {
        const { userId } = input;
        const result = {};
        if (input.includeMetrics !== false) {
            const metrics = await GlobalPersonalization_1.IntelligenceMetrics.findOne({ userId });
            if (metrics) {
                result.metrics = metrics.toObject();
            }
        }
        if (input.includeContext !== false) {
            let contextualData = await GlobalPersonalization_1.ContextualData.findOne({ userId });
            if (!contextualData) {
                contextualData = await GlobalPersonalization_1.ContextualData.create({
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
            const preferences = await personalizationService_1.personalizationService.getOrCreatePreferences(userId);
            result.preferences = preferences.toObject();
        }
        if (input.includeRecentMemories) {
            const memories = await memoryService_1.memoryService.getUserMemories({
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
            const session = await sessionService_1.sessionService.getOrCreateSession(userId);
            result.sessionContext = {
                sessionId: session.id,
                state: session.state,
                context: session.context,
                startTime: session.startTime,
            };
        }
        return result;
    }
    /**
     * Get or create intelligence metrics for a user
     */
    async getOrCreateMetrics(userId) {
        let metrics = await GlobalPersonalization_1.IntelligenceMetrics.findOne({ userId });
        if (!metrics) {
            metrics = await GlobalPersonalization_1.IntelligenceMetrics.create({ userId });
        }
        return metrics;
    }
    /**
     * Update intelligence metrics based on user activity
     */
    async updateMetricsFromActivity(userId, activity) {
        let metrics = await GlobalPersonalization_1.IntelligenceMetrics.findOne({ userId });
        if (!metrics) {
            metrics = await GlobalPersonalization_1.IntelligenceMetrics.create({ userId });
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
    async recordSessionDuration(userId, duration) {
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
    async generateRecommendations(input) {
        const { userId, context, excludedItems = [], limit = 5 } = input;
        // Get user preferences and metrics
        const preferences = await personalizationService_1.personalizationService.getOrCreatePreferences(userId);
        const metrics = await this.getOrCreateMetrics(userId);
        // Get recent memories to understand context
        const memories = await memoryService_1.memoryService.getUserMemories({
            userId,
            type: undefined,
            limit: 10,
        });
        // Simple recommendation logic based on preferences
        const recommendations = [];
        // Generate mock recommendations based on user context
        const toneMap = {
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
    async getEngagementScore(userId) {
        const metrics = await this.getOrCreateMetrics(userId);
        const contextualData = await GlobalPersonalization_1.ContextualData.findOne({ userId });
        const sessionFrequency = Math.min(metrics.engagement.totalSessions / 10, 1);
        const sessionDuration = Math.min(metrics.engagement.averageSessionLength / 1800, 1);
        const interactionFrequency = Math.min(metrics.engagement.interactionFrequency / 100, 1);
        const diversity = metrics.behavior.preferredAgents.length / 5;
        const recentActivity = contextualData ? 0.5 : 0;
        const factors = {
            sessionFrequency,
            sessionDuration,
            interactionFrequency,
            diversity,
            recentActivity,
        };
        const score = sessionFrequency * 0.2 +
            sessionDuration * 0.3 +
            interactionFrequency * 0.2 +
            diversity * 0.15 +
            recentActivity * 0.15;
        let level = 'low';
        if (score >= 0.6)
            level = 'high';
        else if (score >= 0.3)
            level = 'medium';
        return { score, level, factors };
    }
    /**
     * Calculate user intent from activity
     */
    async calculateIntent(userId, currentAction, context) {
        // Get recent activity
        const contextualData = await GlobalPersonalization_1.ContextualData.findOne({ userId });
        const recentIntents = contextualData?.relationships?.recentIntents || [];
        // Simple intent calculation based on patterns
        let primaryIntent = currentAction;
        let confidence = 0.5;
        const alternativeIntents = [];
        // Check for intent chains (common patterns)
        if (recentIntents.length >= 2) {
            const lastIntent = recentIntents[0];
            // Common intent chains
            const intentChains = {
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
    async updateUserIntent(userId, intent) {
        let contextualData = await GlobalPersonalization_1.ContextualData.findOne({ userId });
        if (!contextualData) {
            contextualData = await GlobalPersonalization_1.ContextualData.create({
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
        }
        else {
            await contextualData.addIntent(intent);
        }
        logger_1.logger.info(`Updated intent for user: ${userId}`, { intent });
    }
    /**
     * Analyze user behavior patterns
     */
    async analyzeBehaviorPatterns(userId) {
        const metrics = await this.getOrCreateMetrics(userId);
        const contextualData = await GlobalPersonalization_1.ContextualData.findOne({ userId });
        const patterns = [];
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
    async predictNextAction(userId) {
        const contextualData = await GlobalPersonalization_1.ContextualData.findOne({ userId });
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
        const predictions = {
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
exports.IntelligenceService = IntelligenceService;
exports.default = new IntelligenceService();
//# sourceMappingURL=intelligenceService.js.map