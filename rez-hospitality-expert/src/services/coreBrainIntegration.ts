/**
 * Core Brain Integration Service
 * Provides integration with the central Core Brain service for context, memory, and personalization
 */

import { logger } from '../utils/logger';

// ============================================
// TYPES
// ============================================

export interface CoreBrainConfig {
  baseUrl: string;
  internalToken: string;
  serviceName: string;
  timeout: number;
  retryAttempts: number;
}

export interface UserContext {
  userId: string;
  sessionId: string;
  preferences?: UserPreferences;
  loyaltyProfile?: LoyaltyProfile;
  recentActivity?: ActivityRecord[];
  contextData?: Record<string, unknown>;
}

export interface UserPreferences {
  tone?: 'formal' | 'casual' | 'friendly' | 'professional';
  language?: string;
  timezone?: string;
  notificationPreferences?: {
    email?: boolean;
    push?: boolean;
    sms?: boolean;
  };
  privacyLevel?: 'strict' | 'balanced' | 'open';
  accessibilityNeeds?: string[];
  preferredContentTypes?: string[];
}

export interface LoyaltyProfile {
  points: number;
  tier: string;
  benefits: string[];
  favoriteCategories?: string[];
  totalPurchases?: number;
  totalSpent?: number;
}

export interface ActivityRecord {
  action: string;
  agent?: string;
  topic?: string;
  timestamp: string;
}

export interface SessionContext {
  id: string;
  userId: string;
  agentId?: string;
  state: 'active' | 'paused' | 'ended';
  context: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastActivity: string;
}

export interface MerchantContext {
  merchantId: string;
  name: string;
  type: string;
  amenities?: string[];
  services?: string[];
  policies?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface MemoryEntry {
  id: string;
  type: 'short_term' | 'long_term' | 'episodic' | 'semantic';
  content: string;
  importance?: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IntelligenceData {
  preferences?: UserPreferences;
  loyaltyProfile?: LoyaltyProfile;
  recentMemories?: MemoryEntry[];
  recentActivity?: ActivityRecord[];
  engagementScore?: number;
  contextData?: Record<string, unknown>;
}

interface CoreBrainResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================
// CORE BRAIN CLIENT
// ============================================

export class CoreBrainClient {
  private config: CoreBrainConfig;
  private healthCheckCache: { status: 'healthy' | 'unhealthy' | 'unknown'; lastCheck: number } = {
    status: 'unknown',
    lastCheck: 0,
  };

  constructor(config: CoreBrainConfig) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:4072',
      internalToken: config.internalToken,
      serviceName: config.serviceName || 'rez-hospitality-expert',
      timeout: config.timeout || 5000,
      retryAttempts: config.retryAttempts || 3,
    };
  }

  /**
   * Create default config from environment variables
   */
  static fromEnv(): CoreBrainClient {
    const internalTokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}';
    let internalTokens: Record<string, string> = {};

    try {
      internalTokens = JSON.parse(internalTokensJson);
    } catch {
      logger.warn('Failed to parse INTERNAL_SERVICE_TOKENS_JSON');
    }

    return new CoreBrainClient({
      baseUrl: process.env.CORE_BRAIN_URL || 'http://localhost:4072',
      internalToken: internalTokens['rez-hospitality-expert'] || process.env.CORE_BRAIN_INTERNAL_TOKEN || '',
      serviceName: 'rez-hospitality-expert',
      timeout: parseInt(process.env.CORE_BRAIN_TIMEOUT || '5000', 10),
      retryAttempts: parseInt(process.env.CORE_BRAIN_RETRY_ATTEMPTS || '3', 10),
    });
  }

  /**
   * Make authenticated request to Core Brain
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
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
        throw new CoreBrainError(
          `Core Brain request failed: ${response.status} ${response.statusText}`,
          response.status,
          errorBody
        );
      }

      const result = await response.json() as CoreBrainResponse<T>;

      if (!result.success) {
        throw new CoreBrainError(
          result.error?.message || 'Core Brain returned error',
          response.status,
          result.error
        );
      }

      return result.data as T;
    } catch (error) {
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
  async healthCheck(): Promise<boolean> {
    const now = Date.now();

    // Cache health check for 10 seconds
    if (
      this.healthCheckCache.status !== 'unknown' &&
      now - this.healthCheckCache.lastCheck < 10000
    ) {
      return this.healthCheckCache.status === 'healthy';
    }

    try {
      await this.request<{ status: string }>('GET', '/health');
      this.healthCheckCache = { status: 'healthy', lastCheck: now };
      return true;
    } catch {
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
  async getOrCreateSession(userId: string, agentId?: string): Promise<SessionContext> {
    return this.request<SessionContext>('GET', `/internal/session?agentId=${agentId || ''}`, {
      userId,
    });
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string, userId: string): Promise<SessionContext | null> {
    try {
      return await this.request<SessionContext>('GET', `/internal/session/${sessionId}`);
    } catch (error) {
      if (error instanceof CoreBrainError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update session context
   */
  async updateSession(
    sessionId: string,
    context: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<SessionContext> {
    return this.request<SessionContext>('PATCH', `/internal/session/${sessionId}`, {
      context,
      metadata,
    });
  }

  /**
   * Add context to session
   */
  async addSessionContext(
    sessionId: string,
    userId: string,
    key: string,
    value: unknown
  ): Promise<SessionContext> {
    return this.request<SessionContext>('POST', `/internal/session/${sessionId}/context`, {
      key,
      value,
    });
  }

  /**
   * End a session
   */
  async endSession(sessionId: string, userId: string): Promise<SessionContext> {
    return this.request<SessionContext>('POST', `/internal/session/${sessionId}/end`);
  }

  // ============================================
  // MEMORY METHODS
  // ============================================

  /**
   * Get user memories
   */
  async getMemories(
    userId: string,
    options?: {
      type?: 'short_term' | 'long_term' | 'episodic' | 'semantic';
      tags?: string[];
      limit?: number;
    }
  ): Promise<MemoryEntry[]> {
    const params = new URLSearchParams();
    if (options?.type) params.append('type', options.type);
    if (options?.tags) params.append('tags', options.tags.join(','));
    if (options?.limit) params.append('limit', options.limit.toString());

    return this.request<MemoryEntry[]>('GET', `/internal/memory?${params.toString()}`);
  }

  /**
   * Get recent memories for context
   */
  async getRecentMemories(userId: string, limit = 10): Promise<MemoryEntry[]> {
    return this.getMemories(userId, { limit });
  }

  /**
   * Search memories
   */
  async searchMemories(userId: string, query: string, limit = 10): Promise<MemoryEntry[]> {
    return this.request<MemoryEntry[]>('POST', '/internal/memory/search', {
      query,
      limit,
    });
  }

  /**
   * Create a memory
   */
  async createMemory(memory: {
    userId: string;
    type?: 'short_term' | 'long_term' | 'episodic' | 'semantic';
    content: string;
    importance?: number;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }): Promise<MemoryEntry> {
    return this.request<MemoryEntry>('POST', '/internal/memory', memory);
  }

  // ============================================
  // PERSONALIZATION METHODS
  // ============================================

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    return this.request<UserPreferences>('GET', '/internal/personalization/preferences');
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    return this.request<UserPreferences>('PATCH', '/internal/personalization/preferences', preferences);
  }

  /**
   * Get loyalty profile
   */
  async getLoyaltyProfile(userId: string): Promise<LoyaltyProfile> {
    return this.request<LoyaltyProfile>('GET', '/internal/personalization/loyalty');
  }

  /**
   * Get contextual data
   */
  async getContextualData(userId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/internal/personalization/context');
  }

  /**
   * Update contextual data
   */
  async updateContextualData(
    userId: string,
    context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('PATCH', '/internal/personalization/context', context);
  }

  /**
   * Record user activity
   */
  async recordActivity(
    userId: string,
    activity: {
      action: string;
      agent?: string;
      topic?: string;
    }
  ): Promise<void> {
    await this.request('POST', '/internal/personalization/context/activity', activity);
  }

  /**
   * Get comprehensive intelligence data
   */
  async getIntelligence(userId: string, options?: {
    includeMetrics?: boolean;
    includeContext?: boolean;
    includePreferences?: boolean;
    includeRecentMemories?: boolean;
  }): Promise<IntelligenceData> {
    const params = new URLSearchParams();
    params.append('includeMetrics', String(options?.includeMetrics ?? true));
    params.append('includeContext', String(options?.includeContext ?? true));
    params.append('includePreferences', String(options?.includePreferences ?? false));
    params.append('includeRecentMemories', String(options?.includeRecentMemories ?? true));

    return this.request<IntelligenceData>('GET', `/internal/personalization/intelligence?${params.toString()}`);
  }

  /**
   * Get personalized greeting
   */
  async getGreeting(userId: string, defaultGreeting?: string): Promise<{ greeting: string }> {
    return this.request<{ greeting: string }>('POST', '/internal/personalization/greeting', {
      defaultGreeting,
    });
  }

  // ============================================
  // CONVENIENCE METHODS
  // ============================================

  /**
   * Load complete user context for hospitality expert
   */
  async loadUserContext(
    userId: string,
    sessionId: string,
    merchantId?: string
  ): Promise<{
    session: SessionContext | null;
    preferences: UserPreferences | null;
    loyalty: LoyaltyProfile | null;
    memories: MemoryEntry[];
    context: Record<string, unknown>;
  }> {
    const results = {
      session: null as SessionContext | null,
      preferences: null as UserPreferences | null,
      loyalty: null as LoyaltyProfile | null,
      memories: [] as MemoryEntry[],
      context: {} as Record<string, unknown>,
    };

    // Load all context in parallel
    const [session, preferences, loyalty, memories, contextData, intelligence] = await Promise.allSettled([
      this.getSession(sessionId, userId),
      this.getPreferences(userId).catch(() => null),
      this.getLoyaltyProfile(userId).catch(() => null),
      this.getRecentMemories(userId, 20),
      this.getContextualData(userId).catch(() => ({})),
      this.getIntelligence(userId, { includeRecentMemories: true }).catch(() => null),
    ]);

    if (session.status === 'fulfilled') results.session = session.value;
    if (preferences.status === 'fulfilled') results.preferences = preferences.value;
    if (loyalty.status === 'fulfilled') results.loyalty = loyalty.value;
    if (memories.status === 'fulfilled') results.memories = memories.value;
    if (contextData.status === 'fulfilled') results.context = contextData.value;
    if (intelligence.status === 'fulfilled' && intelligence.value) {
      results.context = { ...results.context, ...intelligence.value };
    }

    return results;
  }

  /**
   * Load merchant context (for hospitality: hotel/property context)
   */
  async loadMerchantContext(merchantId: string): Promise<MerchantContext | null> {
    // This would typically call a merchant service
    // For now, return null as merchant context is service-specific
    logger.debug('Merchant context requested', { merchantId });
    return null;
  }

  /**
   * Attach context to response
   */
  attachContext<T extends Record<string, unknown>>(
    response: T,
    context: {
      preferences?: UserPreferences | null;
      loyalty?: LoyaltyProfile | null;
      session?: SessionContext | null;
    }
  ): T & { context: { preferences?: UserPreferences; loyalty?: LoyaltyProfile; tone?: string } } {
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

// ============================================
// ERROR CLASS
// ============================================

export class CoreBrainError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public error?: unknown
  ) {
    super(message);
    this.name = 'CoreBrainError';
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let coreBrainClientInstance: CoreBrainClient | null = null;

export function getCoreBrainClient(): CoreBrainClient {
  if (!coreBrainClientInstance) {
    coreBrainClientInstance = CoreBrainClient.fromEnv();
    logger.info('Core Brain client initialized', {
      baseUrl: process.env.CORE_BRAIN_URL || 'http://localhost:4072',
    });
  }
  return coreBrainClientInstance;
}

export function initializeCoreBrainClient(config?: Partial<CoreBrainConfig>): CoreBrainClient {
  coreBrainClientInstance = new CoreBrainClient({
    baseUrl: config?.baseUrl || process.env.CORE_BRAIN_URL || 'http://localhost:4072',
    internalToken: config?.internalToken || '',
    serviceName: config?.serviceName || 'rez-hospitality-expert',
    timeout: config?.timeout || 5000,
    retryAttempts: config?.retryAttempts || 3,
  });
  return coreBrainClientInstance;
}

export default CoreBrainClient;
