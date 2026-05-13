"use strict";
/**
 * Core Brain Integration Service for Fitness Expert
 * Provides integration with the central Core Brain service for context, memory, and personalization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreBrainError = exports.CoreBrainClient = void 0;
exports.getCoreBrainClient = getCoreBrainClient;
exports.initializeCoreBrainClient = initializeCoreBrainClient;
const fitnessExpert_js_1 = require("./fitnessExpert.js");
// ============================================
// CORE BRAIN CLIENT
// ============================================
class CoreBrainClient {
    config;
    healthCheckCache = {
        status: 'unknown',
        lastCheck: 0,
    };
    constructor(config) {
        this.config = {
            baseUrl: config.baseUrl || 'http://localhost:4072',
            internalToken: config.internalToken,
            serviceName: config.serviceName || 'rez-fitness-expert',
            timeout: config.timeout || 5000,
            retryAttempts: config.retryAttempts || 3,
        };
    }
    /**
     * Create default config from environment variables
     */
    static fromEnv() {
        const internalTokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
        let internalTokens = {};
        try {
            internalTokens = JSON.parse(internalTokensJson);
        }
        catch {
            fitnessExpert_js_1.logger.warn('Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
        }
        return new CoreBrainClient({
            baseUrl: process.env.CORE_BRAIN_URL || 'http://localhost:4072',
            internalToken: internalTokens['rez-fitness-expert'] || process.env.CORE_BRAIN_INTERNAL_TOKEN || '',
            serviceName: 'rez-fitness-expert',
            timeout: parseInt(process.env.CORE_BRAIN_TIMEOUT || '5000', 10),
            retryAttempts: parseInt(process.env.CORE_BRAIN_RETRY_ATTEMPTS || '3', 10),
        });
    }
    /**
     * Make authenticated request to Core Brain
     */
    async request(method, path, body) {
        const url = `${this.config.baseUrl}${path}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Token': this.config.internalToken,
                    'X-Service-Name': this.config.serviceName,
                },
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({ message: 'Unknown error' }));
                throw new CoreBrainError(`Core Brain request failed: ${response.status} ${response.statusText}`, response.status, errorBody);
            }
            const result = await response.json();
            if (!result.success) {
                throw new CoreBrainError(result.error?.message || 'Core Brain returned error', response.status, result.error);
            }
            return result.data;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof CoreBrainError) {
                throw error;
            }
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new CoreBrainError('Core Brain request timeout', 408);
                }
                throw new CoreBrainError(`Core Brain request failed: ${error.message}`, 500);
            }
            throw new CoreBrainError('Core Brain request failed with unknown error', 500);
        }
    }
    /**
     * Health check for Core Brain connection
     */
    async healthCheck() {
        const now = Date.now();
        // Cache health check for 10 seconds
        if (this.healthCheckCache.status !== 'unknown' &&
            now - this.healthCheckCache.lastCheck < 10000) {
            return this.healthCheckCache.status === 'healthy';
        }
        try {
            await this.request('GET', '/health');
            this.healthCheckCache = { status: 'healthy', lastCheck: now };
            return true;
        }
        catch {
            this.healthCheckCache = { status: 'unhealthy', lastCheck: now };
            return false;
        }
    }
    // ============================================
    // SESSION METHODS
    // ============================================
    /**
     * Get or create a session
     */
    async getOrCreateSession(userId, agentId) {
        return this.request('GET', `/internal/session?agentId=${agentId || ''}`, {
            userId,
        });
    }
    /**
     * Get session by ID
     */
    async getSession(sessionId, userId) {
        try {
            return await this.request('GET', `/internal/session/${sessionId}`);
        }
        catch (error) {
            if (error instanceof CoreBrainError && error.statusCode === 404) {
                return null;
            }
            throw error;
        }
    }
    /**
     * Update session context
     */
    async updateSession(sessionId, context, metadata) {
        return this.request('PATCH', `/internal/session/${sessionId}`, {
            context,
            metadata,
        });
    }
    /**
     * Add context to session
     */
    async addSessionContext(sessionId, userId, key, value) {
        return this.request('POST', `/internal/session/${sessionId}/context`, {
            key,
            value,
        });
    }
    /**
     * End a session
     */
    async endSession(sessionId, userId) {
        return this.request('POST', `/internal/session/${sessionId}/end`);
    }
    // ============================================
    // MEMORY METHODS
    // ============================================
    /**
     * Get user memories
     */
    async getMemories(userId, options) {
        const params = new URLSearchParams();
        if (options?.type)
            params.append('type', options.type);
        if (options?.tags)
            params.append('tags', options.tags.join(','));
        if (options?.limit)
            params.append('limit', options.limit.toString());
        return this.request('GET', `/internal/memory?${params.toString()}`);
    }
    /**
     * Get recent memories for context
     */
    async getRecentMemories(userId, limit = 10) {
        return this.getMemories(userId, { limit });
    }
    /**
     * Search memories
     */
    async searchMemories(userId, query, limit = 10) {
        return this.request('POST', '/internal/memory/search', {
            query,
            limit,
        });
    }
    /**
     * Create a memory
     */
    async createMemory(memory) {
        return this.request('POST', '/internal/memory', memory);
    }
    /**
     * Store workout completion memory
     */
    async storeWorkoutCompletion(userId, workout, metadata) {
        return this.createMemory({
            userId,
            type: 'episodic',
            content: `Completed ${workout.type} workout for ${workout.duration} minutes`,
            importance: 7,
            tags: ['workout', 'fitness', 'completed', workout.type],
            metadata: {
                workout,
                ...metadata,
            },
        });
    }
    /**
     * Store fitness goal achievement
     */
    async storeGoalAchievement(userId, goal, achievement, metadata) {
        return this.createMemory({
            userId,
            type: 'long_term',
            content: `Achieved fitness goal: ${goal} - ${achievement.milestone}`,
            importance: 9,
            tags: ['goal', 'achievement', 'fitness'],
            metadata: {
                goal,
                achievement,
                ...metadata,
            },
        });
    }
    // ============================================
    // PERSONALIZATION METHODS
    // ============================================
    /**
     * Get user preferences
     */
    async getPreferences(userId) {
        return this.request('GET', '/internal/personalization/preferences');
    }
    /**
     * Update user preferences
     */
    async updatePreferences(userId, preferences) {
        return this.request('PATCH', '/internal/personalization/preferences', preferences);
    }
    /**
     * Get loyalty profile
     */
    async getLoyaltyProfile(userId) {
        return this.request('GET', '/internal/personalization/loyalty');
    }
    /**
     * Get contextual data
     */
    async getContextualData(userId) {
        return this.request('GET', '/internal/personalization/context');
    }
    /**
     * Update contextual data
     */
    async updateContextualData(userId, context) {
        return this.request('PATCH', '/internal/personalization/context', context);
    }
    /**
     * Record user activity
     */
    async recordActivity(userId, activity) {
        await this.request('POST', '/internal/personalization/context/activity', activity);
    }
    /**
     * Record fitness activity
     */
    async recordFitnessActivity(userId, activity) {
        await this.recordActivity(userId, {
            action: activity.action,
            agent: 'fitness-expert',
            topic: activity.topic || activity.workoutType,
        });
    }
    /**
     * Get comprehensive intelligence data
     */
    async getIntelligence(userId, options) {
        const params = new URLSearchParams();
        params.append('includeMetrics', String(options?.includeMetrics ?? true));
        params.append('includeContext', String(options?.includeContext ?? true));
        params.append('includePreferences', String(options?.includePreferences ?? false));
        params.append('includeRecentMemories', String(options?.includeRecentMemories ?? true));
        return this.request(`/internal/personalization/intelligence?${params.toString()}`);
    }
    /**
     * Get personalized greeting
     */
    async getGreeting(userId, defaultGreeting) {
        return this.request('POST', '/internal/personalization/greeting', {
            defaultGreeting,
        });
    }
    // ============================================
    // CONVENIENCE METHODS
    // ============================================
    /**
     * Load complete user context for fitness expert
     */
    async loadUserContext(userId, sessionId) {
        const results = {
            session: null,
            preferences: null,
            loyalty: null,
            memories: [],
            context: {},
            workoutHistory: [],
        };
        // Load all context in parallel
        const promises = [
            this.getSession(sessionId, userId).catch(() => null),
            this.getPreferences(userId).catch(() => null),
            this.getLoyaltyProfile(userId).catch(() => null),
            this.getRecentMemories(userId, 20),
            this.getContextualData(userId).catch(() => ({})),
            this.getIntelligence(userId, { includeRecentMemories: true }).catch(() => null),
            this.searchMemories(userId, 'workout fitness exercise training', 10).catch(() => []),
        ];
        const [session, preferences, loyalty, memories, contextData, intelligence, workoutHistory] = await Promise.allSettled(promises);
        if (session.status === 'fulfilled')
            results.session = session.value;
        if (preferences.status === 'fulfilled')
            results.preferences = preferences.value;
        if (loyalty.status === 'fulfilled')
            results.loyalty = loyalty.value;
        if (memories.status === 'fulfilled')
            results.memories = memories.value;
        if (contextData.status === 'fulfilled')
            results.context = contextData.value;
        if (intelligence.status === 'fulfilled' && intelligence.value) {
            results.context = { ...results.context, ...intelligence.value };
        }
        if (workoutHistory.status === 'fulfilled')
            results.workoutHistory = workoutHistory.value;
        return results;
    }
    /**
     * Build fitness context for workout recommendations
     */
    buildFitnessContext(context) {
        const recentWorkouts = [];
        const fitnessAchievements = [];
        const preferredWorkoutTypes = [];
        // Extract workout history from memories
        for (const memory of context.workoutHistory) {
            if (memory.metadata?.workout) {
                recentWorkouts.push(memory.metadata.workout);
            }
            if (memory.tags?.includes('achievement')) {
                fitnessAchievements.push(memory.content);
            }
            if (memory.tags?.includes('workout')) {
                const workoutType = memory.tags.find((t) => t !== 'workout' && t !== 'fitness');
                if (workoutType && !preferredWorkoutTypes.includes(workoutType)) {
                    preferredWorkoutTypes.push(workoutType);
                }
            }
        }
        // Calculate engagement level based on recent activity
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const recentCount = recentWorkouts.filter((w) => new Date(w.date) > weekAgo).length;
        let engagementLevel = 'low';
        if (recentCount >= 4)
            engagementLevel = 'high';
        else if (recentCount >= 2)
            engagementLevel = 'medium';
        return {
            userTone: context.preferences?.tone || 'friendly',
            recentWorkouts,
            fitnessAchievements,
            preferredWorkoutTypes,
            engagementLevel,
        };
    }
    /**
     * Attach context to response
     */
    attachContext(response, context) {
        return {
            ...response,
            context: {
                preferences: context.preferences || undefined,
                loyalty: context.loyalty || undefined,
                tone: context.preferences?.tone || 'friendly',
            },
        };
    }
}
exports.CoreBrainClient = CoreBrainClient;
// ============================================
// ERROR CLASS
// ============================================
class CoreBrainError extends Error {
    statusCode;
    error;
    constructor(message, statusCode, error) {
        super(message);
        this.statusCode = statusCode;
        this.error = error;
        this.name = 'CoreBrainError';
    }
}
exports.CoreBrainError = CoreBrainError;
// ============================================
// SINGLETON INSTANCE
// ============================================
let coreBrainClientInstance = null;
function getCoreBrainClient() {
    if (!coreBrainClientInstance) {
        coreBrainClientInstance = CoreBrainClient.fromEnv();
        fitnessExpert_js_1.logger.info('Core Brain client initialized for fitness expert', {
            baseUrl: process.env.CORE_BRAIN_URL || 'http://localhost:4072',
        });
    }
    return coreBrainClientInstance;
}
function initializeCoreBrainClient(config) {
    coreBrainClientInstance = new CoreBrainClient({
        baseUrl: config?.baseUrl || process.env.CORE_BRAIN_URL || 'http://localhost:4072',
        internalToken: config?.internalToken || '',
        serviceName: config?.serviceName || 'rez-fitness-expert',
        timeout: config?.timeout || 5000,
        retryAttempts: config?.retryAttempts || 3,
    });
    return coreBrainClientInstance;
}
exports.default = CoreBrainClient;
//# sourceMappingURL=coreBrainIntegration.js.map