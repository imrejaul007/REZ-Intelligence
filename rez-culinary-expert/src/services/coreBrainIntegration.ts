/**
 * Core Brain Integration Service for Culinary Expert
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
  dietaryProfile?: DietaryProfile;
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
  lastPurchaseDate?: string;
}

export interface DietaryProfile {
  restrictions: string[];
  allergies: AllergyInfo[];
  preferences: string[];
}

export interface AllergyInfo {
  allergenId: string;
  severity: 'mild' | 'moderate' | 'severe';
  notes?: string;
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

export interface RestaurantContext {
  restaurantId: string;
  name: string;
  cuisine: string;
  dietaryOptions?: string[];
  priceRange?: string;
  rating?: number;
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
      serviceName: config.serviceName || 'rez-culinary-expert',
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
      internalToken: internalTokens['rez-culinary-expert'] || process.env.CORE_BRAIN_INTERNAL_TOKEN || '',
      serviceName: 'rez-culinary-expert',
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

      const result: CoreBrainResponse<T> = await response.json();

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
   * Create a memory (e.g., for storing dining preferences)
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

  /**
   * Store dietary preference memory
   */
  async storeDietaryPreference(
    userId: string,
    preference: string,
    metadata?: Record<string, unknown>
  ): Promise<MemoryEntry> {
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
   * Record dining activity
   */
  async recordDiningActivity(
    userId: string,
    activity: {
      action: 'view_menu' | 'order' | 'recommendation' | 'dietary_check';
      restaurantId?: string;
      itemName?: string;
      topic?: string;
    }
  ): Promise<void> {
    await this.recordActivity(userId, {
      action: activity.action,
      agent: 'culinary-expert',
      topic: activity.topic || activity.restaurantId || activity.itemName,
    });
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

    return this.request<IntelligenceData>(`/internal/personalization/intelligence?${params.toString()}`);
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
   * Load complete user context for culinary expert
   */
  async loadUserContext(
    userId: string,
    sessionId: string,
    restaurantId?: string
  ): Promise<{
    session: SessionContext | null;
    preferences: UserPreferences | null;
    loyalty: LoyaltyProfile | null;
    memories: MemoryEntry[];
    context: Record<string, unknown>;
    diningHistory: MemoryEntry[];
  }> {
    const results = {
      session: null as SessionContext | null,
      preferences: null as UserPreferences | null,
      loyalty: null as LoyaltyProfile | null,
      memories: [] as MemoryEntry[],
      context: {} as Record<string, unknown>,
      diningHistory: [] as MemoryEntry[],
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

    const [session, preferences, loyalty, memories, contextData, intelligence, diningHistory] =
      await Promise.allSettled(promises);

    if (session.status === 'fulfilled') results.session = session.value;
    if (preferences.status === 'fulfilled') results.preferences = preferences.value;
    if (loyalty.status === 'fulfilled') results.loyalty = loyalty.value;
    if (memories.status === 'fulfilled') results.memories = memories.value;
    if (contextData.status === 'fulfilled') results.context = contextData.value;
    if (intelligence.status === 'fulfilled' && intelligence.value) {
      results.context = { ...results.context, ...intelligence.value };
    }
    if (diningHistory.status === 'fulfilled') results.diningHistory = diningHistory.value;

    return results;
  }

  /**
   * Load restaurant context
   */
  async loadRestaurantContext(restaurantId: string): Promise<RestaurantContext | null> {
    // This would typically call a restaurant/menu service
    // For now, return null as restaurant context is service-specific
    logger.debug('Restaurant context requested', { restaurantId });
    return null;
  }

  /**
   * Build culinary context for recommendations
   */
  buildCulinaryContext(context: {
    session: SessionContext | null;
    preferences: UserPreferences | null;
    loyalty: LoyaltyProfile | null;
    memories: MemoryEntry[];
    diningHistory: MemoryEntry[];
  }): {
    userTone: string;
    dietaryContext: string[];
    favoriteCuisines: string[];
    recentOrders: string[];
    loyaltyTier: string;
    pointsBalance: number;
  } {
    const dietaryContext: string[] = [];
    const favoriteCuisines: string[] = [];
    const recentOrders: string[] = [];

    // Extract dietary info from memories
    for (const memory of context.memories) {
      if (memory.tags?.includes('dietary')) {
        dietaryContext.push(memory.content);
      }
    }

    // Extract cuisine preferences from dining history
    for (const memory of context.diningHistory) {
      if (memory.metadata?.cuisine) {
        favoriteCuisines.push(memory.metadata.cuisine as string);
      }
      if (memory.metadata?.itemName) {
        recentOrders.push(memory.metadata.itemName as string);
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
    logger.info('Core Brain client initialized for culinary expert', {
      baseUrl: process.env.CORE_BRAIN_URL || 'http://localhost:4072',
    });
  }
  return coreBrainClientInstance;
}

export function initializeCoreBrainClient(config?: Partial<CoreBrainConfig>): CoreBrainClient {
  coreBrainClientInstance = new CoreBrainClient({
    baseUrl: config?.baseUrl || process.env.CORE_BRAIN_URL || 'http://localhost:4072',
    internalToken: config?.internalToken || '',
    serviceName: config?.serviceName || 'rez-culinary-expert',
    timeout: config?.timeout || 5000,
    retryAttempts: config?.retryAttempts || 3,
  });
  return coreBrainClientInstance;
}

export default CoreBrainClient;
