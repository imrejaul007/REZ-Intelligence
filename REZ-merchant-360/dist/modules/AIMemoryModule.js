"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIMemoryModule = void 0;
const logger_js_1 = __importDefault(require("./utils/logger.js"));
/**
 * AIMemoryModule.ts - AI Memory & Preferences for Merchant360
 * Integrates with AgentDB for intelligent merchant memory
 */
const axios_1 = __importDefault(require("axios"));
class AIMemoryModule {
    client;
    agentDBClient;
    cache = new Map();
    cacheTTL = 120000; // 2 minutes default
    constructor(baseURL, agentDBURL) {
        this.client = axios_1.default.create({
            baseURL: baseURL || process.env.MEMORY_SERVICE_URL || 'http://localhost:4009',
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (agentDBURL || process.env.AGENTDB_HOST) {
            this.agentDBClient = axios_1.default.create({
                baseURL: agentDBURL || `http://${process.env.AGENTDB_HOST}:${process.env.AGENTDB_PORT}`,
                timeout: 15000,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        }
    }
    setCacheTTL(ttl) {
        this.cacheTTL = ttl;
    }
    /**
     * Get AI memory summary for a merchant
     */
    async getAIMemory(merchantId) {
        const cacheKey = `ai_memory:${merchantId}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }
        try {
            const summary = await this.getAIMemorySummary(merchantId);
            const aiMemory = {
                preferences_set: summary.preferences_set,
                automation_rules: summary.automation_rules,
                last_interaction: summary.last_interaction,
                conversation_count: summary.conversation_count,
                tags: summary.tags,
                sentiment_trend: summary.sentiment_trend,
            };
            this.cache.set(cacheKey, { data: aiMemory, timestamp: Date.now() });
            return aiMemory;
        }
        catch (error) {
            console.error(`Failed to fetch AI memory for merchant ${merchantId}:`, error);
            return this.getDefaultAIMemory();
        }
    }
    /**
     * Get detailed AI memory summary
     */
    async getAIMemorySummary(merchantId) {
        try {
            const [preferences, rules, lastConversation] = await Promise.all([
                this.getPreferences(merchantId),
                this.getAutomationRules(merchantId),
                this.getLastConversation(merchantId),
            ]);
            const tags = await this.getMerchantTags(merchantId);
            const sentiment = await this.analyzeSentimentTrend(merchantId);
            return {
                preferences_set: preferences.length > 0,
                automation_rules: rules.filter(r => r.is_active).length,
                last_interaction: lastConversation?.updated_at,
                conversation_count: lastConversation ? 1 : 0,
                tags,
                sentiment_trend: sentiment,
                active_integrations: [],
            };
        }
        catch (error) {
            console.error(`Failed to fetch AI memory summary for merchant ${merchantId}:`, error);
            return this.getDefaultAIMemorySummary();
        }
    }
    // ============================================
    // PREFERENCES
    // ============================================
    /**
     * Get all preferences for a merchant
     */
    async getPreferences(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/preferences`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch preferences:`, error);
            return [];
        }
    }
    /**
     * Get preference by key
     */
    async getPreference(merchantId, category, key) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/preferences/${category}/${key}`);
            return response.data;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Set preference
     */
    async setPreference(merchantId, preference) {
        try {
            const response = await this.client.put(`/merchants/${merchantId}/preferences`, preference);
            this.cache.delete(`ai_memory:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to set preference:`, error);
            throw error;
        }
    }
    /**
     * Delete preference
     */
    async deletePreference(merchantId, category, key) {
        try {
            await this.client.delete(`/merchants/${merchantId}/preferences/${category}/${key}`);
            this.cache.delete(`ai_memory:${merchantId}`);
            return true;
        }
        catch (error) {
            console.error(`Failed to delete preference:`, error);
            return false;
        }
    }
    // ============================================
    // AUTOMATION RULES
    // ============================================
    /**
     * Get automation rules
     */
    async getAutomationRules(merchantId, options = {}) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/automation/rules`, { params: options });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch automation rules:`, error);
            return [];
        }
    }
    /**
     * Create automation rule
     */
    async createAutomationRule(merchantId, rule) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/automation/rules`, rule);
            this.cache.delete(`ai_memory:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to create automation rule:`, error);
            throw error;
        }
    }
    /**
     * Update automation rule
     */
    async updateAutomationRule(merchantId, ruleId, updates) {
        try {
            const response = await this.client.patch(`/merchants/${merchantId}/automation/rules/${ruleId}`, updates);
            this.cache.delete(`ai_memory:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to update automation rule:`, error);
            throw error;
        }
    }
    /**
     * Delete automation rule
     */
    async deleteAutomationRule(merchantId, ruleId) {
        try {
            await this.client.delete(`/merchants/${merchantId}/automation/rules/${ruleId}`);
            this.cache.delete(`ai_memory:${merchantId}`);
            return true;
        }
        catch (error) {
            console.error(`Failed to delete automation rule:`, error);
            return false;
        }
    }
    /**
     * Toggle automation rule
     */
    async toggleAutomationRule(merchantId, ruleId, is_active) {
        return this.updateAutomationRule(merchantId, ruleId, { is_active });
    }
    // ============================================
    // CONVERSATIONS
    // ============================================
    /**
     * Get conversations
     */
    async getConversations(merchantId, options = {}) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/conversations`, { params: options });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to fetch conversations:`, error);
            return [];
        }
    }
    /**
     * Get conversation by ID
     */
    async getConversation(merchantId, conversationId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/conversations/${conversationId}`);
            return response.data;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Get last conversation
     */
    async getLastConversation(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/conversations/last`);
            return response.data;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Create/update conversation
     */
    async upsertConversation(merchantId, sessionId, messages) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/conversations`, { session_id: sessionId, messages });
            this.cache.delete(`ai_memory:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to upsert conversation:`, error);
            throw error;
        }
    }
    // ============================================
    // SEMANTIC SEARCH (AgentDB Integration)
    // ============================================
    /**
     * Search memories semantically using AgentDB
     */
    async semanticSearch(merchantId, query, options = {}) {
        if (!this.agentDBClient) {
            logger_js_1.default.warn('AgentDB not configured, falling back to basic search');
            return this.basicSearch(merchantId, query, options);
        }
        try {
            const response = await this.agentDBClient.post('/search', {
                collection: `merchant_${merchantId}`,
                query,
                limit: options.limit || 10,
                min_score: options.min_score || 0.7,
                filter: options.type ? { type: options.type } : undefined,
            });
            return response.data.results;
        }
        catch (error) {
            console.error(`Semantic search failed:`, error);
            return this.basicSearch(merchantId, query, options);
        }
    }
    /**
     * Store memory in AgentDB
     */
    async storeMemory(merchantId, content, metadata = {}) {
        if (!this.agentDBClient) {
            logger_js_1.default.warn('AgentDB not configured, memory not stored');
            return false;
        }
        try {
            await this.agentDBClient.post('/vectors', {
                collection: `merchant_${merchantId}`,
                vectors: [
                    {
                        id: `${merchantId}_${Date.now()}`,
                        content,
                        metadata: {
                            ...metadata,
                            merchant_id: merchantId,
                            stored_at: new Date().toISOString(),
                        },
                    },
                ],
            });
            return true;
        }
        catch (error) {
            console.error(`Failed to store memory:`, error);
            return false;
        }
    }
    /**
     * Fallback basic search
     */
    async basicSearch(merchantId, query, options) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/search`, { params: { q: query, limit: options.limit, type: options.type } });
            return response.data;
        }
        catch (error) {
            console.error(`Basic search failed:`, error);
            return [];
        }
    }
    // ============================================
    // TAGS
    // ============================================
    /**
     * Get merchant tags
     */
    async getMerchantTags(merchantId) {
        try {
            const response = await this.client.get(`/merchants/${merchantId}/tags`);
            return response.data;
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Add tags to merchant
     */
    async addTags(merchantId, tags) {
        try {
            const response = await this.client.post(`/merchants/${merchantId}/tags`, { tags });
            this.cache.delete(`ai_memory:${merchantId}`);
            return response.data;
        }
        catch (error) {
            console.error(`Failed to add tags:`, error);
            throw error;
        }
    }
    /**
     * Remove tags from merchant
     */
    async removeTags(merchantId, tags) {
        try {
            await this.client.delete(`/merchants/${merchantId}/tags`, { data: { tags } });
            this.cache.delete(`ai_memory:${merchantId}`);
            return true;
        }
        catch (error) {
            console.error(`Failed to remove tags:`, error);
            return false;
        }
    }
    // ============================================
    // SENTIMENT ANALYSIS
    // ============================================
    /**
     * Analyze sentiment trend from recent conversations
     */
    async analyzeSentimentTrend(merchantId) {
        try {
            const conversations = await this.getConversations(merchantId, { limit: 10 });
            if (conversations.length === 0)
                return 'neutral';
            const sentiments = conversations
                .filter(c => c.sentiment)
                .map(c => c.sentiment);
            if (sentiments.length === 0)
                return 'neutral';
            const counts = {
                positive: sentiments.filter(s => s === 'positive').length,
                neutral: sentiments.filter(s => s === 'neutral').length,
                negative: sentiments.filter(s => s === 'negative').length,
            };
            if (counts.positive > counts.negative && counts.positive > counts.neutral)
                return 'positive';
            if (counts.negative > counts.positive && counts.negative > counts.neutral)
                return 'negative';
            return 'neutral';
        }
        catch (error) {
            return 'neutral';
        }
    }
    // ============================================
    // CONTEXT BUILDING
    // ============================================
    /**
     * Build merchant context for AI interactions
     */
    async buildMerchantContext(merchantId) {
        try {
            const [preferences, rules, tags, sentiment] = await Promise.all([
                this.getPreferences(merchantId),
                this.getAutomationRules(merchantId),
                this.getMerchantTags(merchantId),
                this.analyzeSentimentTrend(merchantId),
            ]);
            return {
                preferences: Object.fromEntries(preferences.map(p => [`${p.category}.${p.key}`, p.value])),
                automation_rules: rules.map(r => ({
                    name: r.name,
                    is_active: r.is_active,
                    trigger_count: r.trigger_count,
                })),
                tags,
                sentiment_trend: sentiment,
                last_updated: new Date().toISOString(),
            };
        }
        catch (error) {
            console.error(`Failed to build merchant context:`, error);
            return {};
        }
    }
    /**
     * Sync AI memory from external source
     */
    async syncAIMemory(merchantId, sourceData) {
        const current = await this.getAIMemory(merchantId);
        const updated = {
            ...current,
            ...sourceData,
        };
        this.cache.delete(`ai_memory:${merchantId}`);
        return updated;
    }
    getDefaultAIMemory() {
        return {
            preferences_set: false,
            automation_rules: 0,
        };
    }
    getDefaultAIMemorySummary() {
        return {
            preferences_set: false,
            automation_rules: 0,
            conversation_count: 0,
            tags: [],
            sentiment_trend: 'neutral',
            active_integrations: [],
        };
    }
    clearCache(merchantId) {
        if (merchantId) {
            this.cache.delete(`ai_memory:${merchantId}`);
        }
        else {
            this.cache.clear();
        }
    }
}
exports.AIMemoryModule = AIMemoryModule;
//# sourceMappingURL=AIMemoryModule.js.map