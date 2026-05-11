/**
 * AIMemoryModule.ts - AI Memory & Preferences for Merchant360
 * Integrates with AgentDB for intelligent merchant memory
 */
import { AIMemory } from '../MerchantProfile';
export interface MerchantPreference {
    id: string;
    merchant_id: string;
    category: 'notifications' | 'display' | 'automation' | 'integrations' | 'custom';
    key: string;
    value: unknown;
    description?: string;
    is_system: boolean;
    updated_at: string;
}
export interface AutomationRule {
    id: string;
    merchant_id: string;
    name: string;
    description: string;
    trigger_type: 'event' | 'schedule' | 'condition';
    trigger_config: Record<string, unknown>;
    actions: {
        type: string;
        config: Record<string, unknown>;
    }[];
    is_active: boolean;
    last_triggered_at?: string;
    trigger_count: number;
    created_at: string;
    updated_at: string;
}
export interface Conversation {
    id: string;
    merchant_id: string;
    session_id: string;
    messages: {
        role: 'user' | 'assistant' | 'system';
        content: string;
        timestamp: string;
        metadata?: Record<string, unknown>;
    }[];
    sentiment?: 'positive' | 'neutral' | 'negative';
    summary?: string;
    created_at: string;
    updated_at: string;
}
export interface AIMemorySummary {
    preferences_set: boolean;
    automation_rules: number;
    last_interaction?: string;
    conversation_count: number;
    tags: string[];
    sentiment_trend: 'positive' | 'neutral' | 'negative';
    preferred_language?: string;
    timezone?: string;
    active_integrations: string[];
}
export interface SemanticSearchResult {
    id: string;
    type: 'conversation' | 'preference' | 'rule' | 'context';
    content: string;
    score: number;
    metadata?: Record<string, unknown>;
}
export declare class AIMemoryModule {
    private client;
    private agentDBClient?;
    private cache;
    private cacheTTL;
    constructor(baseURL?: string, agentDBURL?: string);
    setCacheTTL(ttl: number): void;
    /**
     * Get AI memory summary for a merchant
     */
    getAIMemory(merchantId: string): Promise<AIMemory>;
    /**
     * Get detailed AI memory summary
     */
    getAIMemorySummary(merchantId: string): Promise<AIMemorySummary>;
    /**
     * Get all preferences for a merchant
     */
    getPreferences(merchantId: string): Promise<MerchantPreference[]>;
    /**
     * Get preference by key
     */
    getPreference(merchantId: string, category: MerchantPreference['category'], key: string): Promise<MerchantPreference | null>;
    /**
     * Set preference
     */
    setPreference(merchantId: string, preference: {
        category: MerchantPreference['category'];
        key: string;
        value: unknown;
        description?: string;
    }): Promise<MerchantPreference>;
    /**
     * Delete preference
     */
    deletePreference(merchantId: string, category: MerchantPreference['category'], key: string): Promise<boolean>;
    /**
     * Get automation rules
     */
    getAutomationRules(merchantId: string, options?: {
        active_only?: boolean;
    }): Promise<AutomationRule[]>;
    /**
     * Create automation rule
     */
    createAutomationRule(merchantId: string, rule: Omit<AutomationRule, 'id' | 'merchant_id' | 'trigger_count' | 'created_at' | 'updated_at'>): Promise<AutomationRule>;
    /**
     * Update automation rule
     */
    updateAutomationRule(merchantId: string, ruleId: string, updates: Partial<AutomationRule>): Promise<AutomationRule>;
    /**
     * Delete automation rule
     */
    deleteAutomationRule(merchantId: string, ruleId: string): Promise<boolean>;
    /**
     * Toggle automation rule
     */
    toggleAutomationRule(merchantId: string, ruleId: string, is_active: boolean): Promise<AutomationRule>;
    /**
     * Get conversations
     */
    getConversations(merchantId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Conversation[]>;
    /**
     * Get conversation by ID
     */
    getConversation(merchantId: string, conversationId: string): Promise<Conversation | null>;
    /**
     * Get last conversation
     */
    getLastConversation(merchantId: string): Promise<Conversation | null>;
    /**
     * Create/update conversation
     */
    upsertConversation(merchantId: string, sessionId: string, messages: Conversation['messages']): Promise<Conversation>;
    /**
     * Search memories semantically using AgentDB
     */
    semanticSearch(merchantId: string, query: string, options?: {
        limit?: number;
        type?: SemanticSearchResult['type'];
        min_score?: number;
    }): Promise<SemanticSearchResult[]>;
    /**
     * Store memory in AgentDB
     */
    storeMemory(merchantId: string, content: string, metadata?: Record<string, unknown>): Promise<boolean>;
    /**
     * Fallback basic search
     */
    private basicSearch;
    /**
     * Get merchant tags
     */
    getMerchantTags(merchantId: string): Promise<string[]>;
    /**
     * Add tags to merchant
     */
    addTags(merchantId: string, tags: string[]): Promise<string[]>;
    /**
     * Remove tags from merchant
     */
    removeTags(merchantId: string, tags: string[]): Promise<boolean>;
    /**
     * Analyze sentiment trend from recent conversations
     */
    analyzeSentimentTrend(merchantId: string): Promise<'positive' | 'neutral' | 'negative'>;
    /**
     * Build merchant context for AI interactions
     */
    buildMerchantContext(merchantId: string): Promise<Record<string, unknown>>;
    /**
     * Sync AI memory from external source
     */
    syncAIMemory(merchantId: string, sourceData: Partial<AIMemory>): Promise<AIMemory>;
    private getDefaultAIMemory;
    private getDefaultAIMemorySummary;
    clearCache(merchantId?: string): void;
}
//# sourceMappingURL=AIMemoryModule.d.ts.map