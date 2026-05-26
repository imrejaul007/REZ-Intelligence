import logger from './utils/logger.js';

/**
 * AIMemoryModule.ts - AI Memory & Preferences for Merchant360
 * Integrates with AgentDB for intelligent merchant memory
 */

import axios, { AxiosInstance } from 'axios';
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

export class AIMemoryModule {
  private client: AxiosInstance;
  private agentDBClient?: AxiosInstance;
  private cache: Map<string, { data: AIMemory; timestamp: number }> = new Map();
  private cacheTTL: number = 120000; // 2 minutes default

  constructor(
    baseURL?: string,
    agentDBURL?: string
  ) {
    this.client = axios.create({
      baseURL: baseURL || process.env.MEMORY_SERVICE_URL || 'http://localhost:4009',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (agentDBURL || process.env.AGENTDB_HOST) {
      this.agentDBClient = axios.create({
        baseURL: agentDBURL || `http://${process.env.AGENTDB_HOST}:${process.env.AGENTDB_PORT}`,
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  }

  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
  }

  /**
   * Get AI memory summary for a merchant
   */
  async getAIMemory(merchantId: string): Promise<AIMemory> {
    const cacheKey = `ai_memory:${merchantId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const summary = await this.getAIMemorySummary(merchantId);

      const aiMemory: AIMemory = {
        preferences_set: summary.preferences_set,
        automation_rules: summary.automation_rules,
        last_interaction: summary.last_interaction,
        conversation_count: summary.conversation_count,
        tags: summary.tags,
        sentiment_trend: summary.sentiment_trend,
      };

      this.cache.set(cacheKey, { data: aiMemory, timestamp: Date.now() });
      return aiMemory;
    } catch (error) {
      console.error(`Failed to fetch AI memory for merchant ${merchantId}:`, error);
      return this.getDefaultAIMemory();
    }
  }

  /**
   * Get detailed AI memory summary
   */
  async getAIMemorySummary(merchantId: string): Promise<AIMemorySummary> {
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
    } catch (error) {
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
  async getPreferences(merchantId: string): Promise<MerchantPreference[]> {
    try {
      const response = await this.client.get<MerchantPreference[]>(
        `/merchants/${merchantId}/preferences`
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch preferences:`, error);
      return [];
    }
  }

  /**
   * Get preference by key
   */
  async getPreference(
    merchantId: string,
    category: MerchantPreference['category'],
    key: string
  ): Promise<MerchantPreference | null> {
    try {
      const response = await this.client.get<MerchantPreference>(
        `/merchants/${merchantId}/preferences/${category}/${key}`
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Set preference
   */
  async setPreference(
    merchantId: string,
    preference: {
      category: MerchantPreference['category'];
      key: string;
      value: unknown;
      description?: string;
    }
  ): Promise<MerchantPreference> {
    try {
      const response = await this.client.put<MerchantPreference>(
        `/merchants/${merchantId}/preferences`,
        preference
      );
      this.cache.delete(`ai_memory:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to set preference:`, error);
      throw error;
    }
  }

  /**
   * Delete preference
   */
  async deletePreference(
    merchantId: string,
    category: MerchantPreference['category'],
    key: string
  ): Promise<boolean> {
    try {
      await this.client.delete(
        `/merchants/${merchantId}/preferences/${category}/${key}`
      );
      this.cache.delete(`ai_memory:${merchantId}`);
      return true;
    } catch (error) {
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
  async getAutomationRules(
    merchantId: string,
    options: { active_only?: boolean } = {}
  ): Promise<AutomationRule[]> {
    try {
      const response = await this.client.get<AutomationRule[]>(
        `/merchants/${merchantId}/automation/rules`,
        { params: options }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch automation rules:`, error);
      return [];
    }
  }

  /**
   * Create automation rule
   */
  async createAutomationRule(
    merchantId: string,
    rule: Omit<AutomationRule, 'id' | 'merchant_id' | 'trigger_count' | 'created_at' | 'updated_at'>
  ): Promise<AutomationRule> {
    try {
      const response = await this.client.post<AutomationRule>(
        `/merchants/${merchantId}/automation/rules`,
        rule
      );
      this.cache.delete(`ai_memory:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to create automation rule:`, error);
      throw error;
    }
  }

  /**
   * Update automation rule
   */
  async updateAutomationRule(
    merchantId: string,
    ruleId: string,
    updates: Partial<AutomationRule>
  ): Promise<AutomationRule> {
    try {
      const response = await this.client.patch<AutomationRule>(
        `/merchants/${merchantId}/automation/rules/${ruleId}`,
        updates
      );
      this.cache.delete(`ai_memory:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to update automation rule:`, error);
      throw error;
    }
  }

  /**
   * Delete automation rule
   */
  async deleteAutomationRule(merchantId: string, ruleId: string): Promise<boolean> {
    try {
      await this.client.delete(`/merchants/${merchantId}/automation/rules/${ruleId}`);
      this.cache.delete(`ai_memory:${merchantId}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete automation rule:`, error);
      return false;
    }
  }

  /**
   * Toggle automation rule
   */
  async toggleAutomationRule(
    merchantId: string,
    ruleId: string,
    is_active: boolean
  ): Promise<AutomationRule> {
    return this.updateAutomationRule(merchantId, ruleId, { is_active });
  }

  // ============================================
  // CONVERSATIONS
  // ============================================

  /**
   * Get conversations
   */
  async getConversations(
    merchantId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<Conversation[]> {
    try {
      const response = await this.client.get<Conversation[]>(
        `/merchants/${merchantId}/conversations`,
        { params: options }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch conversations:`, error);
      return [];
    }
  }

  /**
   * Get conversation by ID
   */
  async getConversation(merchantId: string, conversationId: string): Promise<Conversation | null> {
    try {
      const response = await this.client.get<Conversation>(
        `/merchants/${merchantId}/conversations/${conversationId}`
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get last conversation
   */
  async getLastConversation(merchantId: string): Promise<Conversation | null> {
    try {
      const response = await this.client.get<Conversation>(
        `/merchants/${merchantId}/conversations/last`
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create/update conversation
   */
  async upsertConversation(
    merchantId: string,
    sessionId: string,
    messages: Conversation['messages']
  ): Promise<Conversation> {
    try {
      const response = await this.client.post<Conversation>(
        `/merchants/${merchantId}/conversations`,
        { session_id: sessionId, messages }
      );
      this.cache.delete(`ai_memory:${merchantId}`);
      return response.data;
    } catch (error) {
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
  async semanticSearch(
    merchantId: string,
    query: string,
    options: {
      limit?: number;
      type?: SemanticSearchResult['type'];
      min_score?: number;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    if (!this.agentDBClient) {
      logger.warn('AgentDB not configured, falling back to basic search');
      return this.basicSearch(merchantId, query, options);
    }

    try {
      const response = await this.agentDBClient.post<{ results: SemanticSearchResult[] }>(
        '/search',
        {
          collection: `merchant_${merchantId}`,
          query,
          limit: options.limit || 10,
          min_score: options.min_score || 0.7,
          filter: options.type ? { type: options.type } : undefined,
        }
      );
      return response.data.results;
    } catch (error) {
      console.error(`Semantic search failed:`, error);
      return this.basicSearch(merchantId, query, options);
    }
  }

  /**
   * Store memory in AgentDB
   */
  async storeMemory(
    merchantId: string,
    content: string,
    metadata: Record<string, unknown> = {}
  ): Promise<boolean> {
    if (!this.agentDBClient) {
      logger.warn('AgentDB not configured, memory not stored');
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
    } catch (error) {
      console.error(`Failed to store memory:`, error);
      return false;
    }
  }

  /**
   * Fallback basic search
   */
  private async basicSearch(
    merchantId: string,
    query: string,
    options: { limit?: number; type?: SemanticSearchResult['type'] }
  ): Promise<SemanticSearchResult[]> {
    try {
      const response = await this.client.get<SemanticSearchResult[]>(
        `/merchants/${merchantId}/search`,
        { params: { q: query, limit: options.limit, type: options.type } }
      );
      return response.data;
    } catch (error) {
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
  async getMerchantTags(merchantId: string): Promise<string[]> {
    try {
      const response = await this.client.get<string[]>(
        `/merchants/${merchantId}/tags`
      );
      return response.data;
    } catch (error) {
      return [];
    }
  }

  /**
   * Add tags to merchant
   */
  async addTags(merchantId: string, tags: string[]): Promise<string[]> {
    try {
      const response = await this.client.post<string[]>(
        `/merchants/${merchantId}/tags`,
        { tags }
      );
      this.cache.delete(`ai_memory:${merchantId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to add tags:`, error);
      throw error;
    }
  }

  /**
   * Remove tags from merchant
   */
  async removeTags(merchantId: string, tags: string[]): Promise<boolean> {
    try {
      await this.client.delete(`/merchants/${merchantId}/tags`, { data: { tags } });
      this.cache.delete(`ai_memory:${merchantId}`);
      return true;
    } catch (error) {
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
  async analyzeSentimentTrend(merchantId: string): Promise<'positive' | 'neutral' | 'negative'> {
    try {
      const conversations = await this.getConversations(merchantId, { limit: 10 });
      if (conversations.length === 0) return 'neutral';

      const sentiments = conversations
        .filter(c => c.sentiment)
        .map(c => c.sentiment);

      if (sentiments.length === 0) return 'neutral';

      const counts = {
        positive: sentiments.filter(s => s === 'positive').length,
        neutral: sentiments.filter(s => s === 'neutral').length,
        negative: sentiments.filter(s => s === 'negative').length,
      };

      if (counts.positive > counts.negative && counts.positive > counts.neutral) return 'positive';
      if (counts.negative > counts.positive && counts.negative > counts.neutral) return 'negative';
      return 'neutral';
    } catch (error) {
      return 'neutral';
    }
  }

  // ============================================
  // CONTEXT BUILDING
  // ============================================

  /**
   * Build merchant context for AI interactions
   */
  async buildMerchantContext(merchantId: string): Promise<Record<string, unknown>> {
    try {
      const [preferences, rules, tags, sentiment] = await Promise.all([
        this.getPreferences(merchantId),
        this.getAutomationRules(merchantId),
        this.getMerchantTags(merchantId),
        this.analyzeSentimentTrend(merchantId),
      ]);

      return {
        preferences: Object.fromEntries(
          preferences.map(p => [`${p.category}.${p.key}`, p.value])
        ),
        automation_rules: rules.map(r => ({
          name: r.name,
          is_active: r.is_active,
          trigger_count: r.trigger_count,
        })),
        tags,
        sentiment_trend: sentiment,
        last_updated: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Failed to build merchant context:`, error);
      return {};
    }
  }

  /**
   * Sync AI memory from external source
   */
  async syncAIMemory(merchantId: string, sourceData: Partial<AIMemory>): Promise<AIMemory> {
    const current = await this.getAIMemory(merchantId);
    const updated: AIMemory = {
      ...current,
      ...sourceData,
    };

    this.cache.delete(`ai_memory:${merchantId}`);
    return updated;
  }

  private getDefaultAIMemory(): AIMemory {
    return {
      preferences_set: false,
      automation_rules: 0,
    };
  }

  private getDefaultAIMemorySummary(): AIMemorySummary {
    return {
      preferences_set: false,
      automation_rules: 0,
      conversation_count: 0,
      tags: [],
      sentiment_trend: 'neutral',
      active_integrations: [],
    };
  }

  clearCache(merchantId?: string): void {
    if (merchantId) {
      this.cache.delete(`ai_memory:${merchantId}`);
    } else {
      this.cache.clear();
    }
  }
}
