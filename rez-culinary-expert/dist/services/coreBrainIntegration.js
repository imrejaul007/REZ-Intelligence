"use strict";
/**
 * Core Brain Integration Service for Culinary Expert
 * Provides integration with the central Core Brain service for context, memory, and personalization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreBrainError = exports.CoreBrainClient = void 0;
exports.getCoreBrainClient = getCoreBrainClient;
exports.initializeCoreBrainClient = initializeCoreBrainClient;
const logger_js_1 = require("./utils/logger.js");
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
            serviceName: config.serviceName || 'rez-culinary-expert',
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
            logger_js_1.logger.warn('Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
        }
        return new CoreBrainClient({
            baseUrl: process.env.CORE_BRAIN_URL || 'http://localhost:4072',
            internalToken: internalTokens['rez-culinary-expert'] || process.env.CORE_BRAIN_INTERNAL_TOKEN || '',
            serviceName: 'rez-culinary-expert',
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
     * Create a memory (e.g., for storing dining preferences)
     */
    async createMemory(memory) {
        return this.request('POST', '/internal/memory', memory);
    }
    /**
     * Store dietary preference memory
     */
    async storeDietaryPreference(userId, preference, metadata) {
        return this.createMemory({
            userId,
            type: 'long_term',
            content: `Dietary preference: ${preference}`,
            importance: 8,
            tags: ['dietary', 'preference', 'culinary'],
            metadata,
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
     * Record dining activity
     */
    async recordDiningActivity(userId, activity) {
        await this.recordActivity(userId, {
            action: activity.action,
            agent: 'culinary-expert',
            topic: activity.topic || activity.restaurantId || activity.itemName,
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
     * Load complete user context for culinary expert
     */
    async loadUserContext(userId, sessionId, restaurantId) {
        const results = {
            session: null,
            preferences: null,
            loyalty: null,
            memories: [],
            context: {},
            diningHistory: [],
        };
        // Load all context in parallel
        const promises = [
            this.getSession(sessionId, userId).catch(() => null),
            this.getPreferences(userId).catch(() => null),
            this.getLoyaltyProfile(userId).catch(() => null),
            this.getRecentMemories(userId, 20),
            this.getContextualData(userId).catch(() => ({})),
            this.getIntelligence(userId, { includeRecentMemories: true }).catch(() => null),
            this.searchMemories(userId, 'food order dining restaurant', 10).catch(() => []),
        ];
        const [session, preferences, loyalty, memories, contextData, intelligence, diningHistory] = await Promise.allSettled(promises);
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
        if (diningHistory.status === 'fulfilled')
            results.diningHistory = diningHistory.value;
        return results;
    }
    /**
     * Load restaurant context
     */
    async loadRestaurantContext(restaurantId) {
        // This would typically call a restaurant/menu service
        // For now, return null as restaurant context is service-specific
        logger_js_1.logger.debug('Restaurant context requested', { restaurantId });
        return null;
    }
    /**
     * Build culinary context for recommendations
     */
    buildCulinaryContext(context) {
        const dietaryContext = [];
        const favoriteCuisines = [];
        const recentOrders = [];
        // Extract dietary info from memories
        for (const memory of context.memories) {
            if (memory.tags?.includes('dietary')) {
                dietaryContext.push(memory.content);
            }
        }
        // Extract cuisine preferences from dining history
        for (const memory of context.diningHistory) {
            if (memory.metadata?.cuisine) {
                favoriteCuisines.push(memory.metadata.cuisine);
            }
            if (memory.metadata?.itemName) {
                recentOrders.push(memory.metadata.itemName);
            }
        }
        return {
            userTone: context.preferences?.tone || 'friendly',
            dietaryContext,
            favoriteCuisines,
            recentOrders,
            loyaltyTier: context.loyalty?.tier || 'standard',
            pointsBalance: context.loyalty?.points || 0,
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
        logger_js_1.logger.info('Core Brain client initialized for culinary expert', {
            baseUrl: process.env.CORE_BRAIN_URL || 'http://localhost:4072',
        });
    }
    return coreBrainClientInstance;
}
function initializeCoreBrainClient(config) {
    coreBrainClientInstance = new CoreBrainClient({
        baseUrl: config?.baseUrl || process.env.CORE_BRAIN_URL || 'http://localhost:4072',
        internalToken: config?.internalToken || '',
        serviceName: config?.serviceName || 'rez-culinary-expert',
        timeout: config?.timeout || 5000,
        retryAttempts: config?.retryAttempts || 3,
    });
    return coreBrainClientInstance;
}
exports.default = CoreBrainClient;
//# sourceMappingURL=coreBrainIntegration.js.map