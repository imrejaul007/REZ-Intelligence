/**
 * Fallback Service - Production-Ready Resilience Layer
 *
 * Provides comprehensive fallback mechanisms for AI service failures:
 * - Circuit breaker pattern for each AI provider
 * - Deterministic fallback responses
 * - Cost limit enforcement
 * - Rate limiting with queueing
 * - Graceful degradation
 *
 * Usage:
 * import { fallbackService } from './services/fallbackService';
 */

import { logger } from '../utils/logger';
import {
  PROVIDERS,
  MODEL_TIERS,
  DEFAULT_MODELS,
  MODEL_COSTS,
} from '../constants';
import type { AIProvider, ModelTier, ProviderResult } from '../types';
import {
  CircuitBreaker,
  CircuitState,
  RateLimitGuard,
  RateLimitError,
  RedisLike,
  calculateCost,
  estimateTokens,
  InMemoryCostStorage,
  CostStorage,
} from '@rez/ai-guardrails';

// ============================================================================
// TYPES
// ============================================================================

export interface FallbackConfig {
  maxRetries: number;
  retryDelayMs: number;
  circuitBreakerThreshold: number;
  circuitResetTimeoutMs: number;
  enableFallbackResponses: boolean;
  fallbackResponses: Record<string, string>;
}

export interface FallbackMetrics {
  totalRequests: number;
  fallbackCount: number;
  circuitBreakerTrips: number;
  rateLimitRejections: number;
  costLimitRejections: number;
  avgFallbackLatencyMs: number;
}

export interface FallbackContext {
  requestId: string;
  userId?: string;
  prompt: string;
  systemPrompt?: string;
  tier: ModelTier;
  provider: AIProvider;
  startTime: number;
}

// ============================================================================
// DETERMINISTIC FALLBACK RESPONSES
// ============================================================================

const DETERMINISTIC_RESPONSES: Record<string, string> = {
  greeting: "Hello! I'm here to help. Could you please rephrase your question?",

  order_status: JSON.stringify({
    status: 'unknown',
    message: 'Unable to retrieve order status. Please check the app for the latest information.',
  }),

  product_recommendation: JSON.stringify({
    recommendations: [],
    message: 'Showing popular items based on general preferences.',
    source: 'deterministic_fallback',
  }),

  price_query: JSON.stringify({
    price: null,
    message: 'Price information temporarily unavailable. Please check the product page.',
  }),

  general: `I understand you're looking for help. Unfortunately, the AI service is temporarily unavailable.

Here's what I can suggest:
1. Try again in a few moments
2. Check our help center at help.rez.money
3. Contact support at support@rez.money

Thank you for your patience!`,

  error: 'An error occurred while processing your request. Please try again.',

  timeout: 'The request took too long. Please try a simpler query or try again later.',

  rate_limited: 'Too many requests. Please wait a moment and try again.',

  cost_exceeded: 'This request exceeds the allowed cost limit. Please simplify your query.',

  service_unavailable: 'The AI service is currently unavailable. Our team has been notified and is working on it.',
};

/**
 * Deterministic response generator for fallback scenarios
 */
export class DeterministicFallback {
  private responseCache: Map<string, string> = new Map();

  /**
   * Generate a deterministic response based on prompt analysis
   */
  generate(prompt: string, context?: Partial<FallbackContext>): string {
    const lowerPrompt = prompt.toLowerCase();

    // Intent-based routing
    if (this.matchesIntent(lowerPrompt, ['hello', 'hi', 'hey', 'greetings'])) {
      return DETERMINISTIC_RESPONSES.greeting;
    }

    if (this.matchesIntent(lowerPrompt, ['order', 'delivery', 'tracking', 'shipment'])) {
      return DETERMINISTIC_RESPONSES.order_status;
    }

    if (this.matchesIntent(lowerPrompt, ['recommend', 'suggest', 'similar', 'also like'])) {
      return DETERMINISTIC_RESPONSES.product_recommendation;
    }

    if (this.matchesIntent(lowerPrompt, ['price', 'cost', 'how much', ' rupees', ' INR'])) {
      return DETERMINISTIC_RESPONSES.price_query;
    }

    if (this.matchesIntent(lowerPrompt, ['help', 'support', 'assist'])) {
      return DETERMINISTIC_RESPONSES.general;
    }

    // Check cache for repeated prompts
    const cacheKey = this.hashPrompt(prompt);
    if (this.responseCache.has(cacheKey)) {
      return this.responseCache.get(cacheKey)!;
    }

    // Generate and cache a response
    const response = this.generateContextualResponse(prompt, context);
    this.responseCache.set(cacheKey, response);

    // Limit cache size
    if (this.responseCache.size > 1000) {
      const firstKey = this.responseCache.keys().next().value;
      if (firstKey) this.responseCache.delete(firstKey);
    }

    return response;
  }

  private matchesIntent(prompt: string, keywords: string[]): boolean {
    return keywords.some(keyword => prompt.includes(keyword));
  }

  private hashPrompt(prompt: string): string {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private generateContextualResponse(prompt: string, context?: Partial<FallbackContext>): string {
    const truncatedPrompt = prompt.slice(0, 100);

    return `I've received your message: "${truncatedPrompt}${prompt.length > 100 ? '...' : ''}"

The AI service is currently experiencing high demand. Here's what I can help with:

- Check order status in the Orders section
- Browse products in the Explore tab
- Contact support for urgent issues

A team member will follow up if needed. Thank you for your patience!`;
  }

  /**
   * Get response for specific error types
   */
  getErrorResponse(errorType: string): string {
    switch (errorType) {
      case 'timeout':
        return DETERMINISTIC_RESPONSES.timeout;
      case 'rate_limit':
        return DETERMINISTIC_RESPONSES.rate_limited;
      case 'cost_limit':
        return DETERMINISTIC_RESPONSES.cost_exceeded;
      case 'service_unavailable':
        return DETERMINISTIC_RESPONSES.service_unavailable;
      default:
        return DETERMINISTIC_RESPONSES.error;
    }
  }
}

// ============================================================================
// CIRCUIT BREAKER MANAGER
// ============================================================================

interface CircuitBreakerEntry {
  breaker: CircuitBreaker;
  failures: number;
  lastFailure: number;
  state: CircuitState;
}

export class CircuitBreakerManager {
  private circuits: Map<AIProvider, CircuitBreakerEntry> = new Map();
  private config: FallbackConfig;

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      circuitBreakerThreshold: config.circuitBreakerThreshold ?? 5,
      circuitResetTimeoutMs: config.circuitResetTimeoutMs ?? 60000,
      enableFallbackResponses: config.enableFallbackResponses ?? true,
      fallbackResponses: { ...DETERMINISTIC_RESPONSES, ...config.fallbackResponses },
    };

    this.initializeCircuits();
  }

  private initializeCircuits(): void {
    for (const provider of Object.values(PROVIDERS)) {
      this.circuits.set(provider, {
        breaker: new CircuitBreaker(provider, {
          failureThreshold: this.config.circuitBreakerThreshold,
          resetTimeoutMs: this.config.circuitResetTimeoutMs,
          halfOpenMaxCalls: 2,
        }),
        failures: 0,
        lastFailure: 0,
        state: 'CLOSED',
      });
    }
  }

  /**
   * Execute with circuit breaker protection
   */
  async executeWithProtection<T>(
    provider: AIProvider,
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const entry = this.circuits.get(provider);
    if (!entry) {
      throw new Error(`No circuit breaker for provider: ${provider}`);
    }

    try {
      const result = await entry.breaker.execute(fn, fallback);

      // Reset failure count on success
      if (entry.failures > 0) {
        logger.info(`[CircuitBreaker] Provider ${provider} recovered`, {
          previousFailures: entry.failures,
        });
        entry.failures = 0;
      }

      return result;
    } catch (error) {
      entry.failures++;
      entry.lastFailure = Date.now();
      entry.state = entry.breaker.getState();

      logger.warn(`[CircuitBreaker] Provider ${provider} failed`, {
        failureCount: entry.failures,
        state: entry.state,
        error: error instanceof Error ? error.message : 'Unknown',
      });

      throw error;
    }
  }

  /**
   * Get circuit breaker state for a provider
   */
  getState(provider: AIProvider): CircuitState {
    return this.circuits.get(provider)?.state ?? 'UNKNOWN';
  }

  /**
   * Get all circuit states
   */
  getAllStates(): Record<AIProvider, CircuitState> {
    const states: Record<string, CircuitState> = {};
    for (const [provider, entry] of this.circuits) {
      states[provider] = entry.breaker.getState();
    }
    return states as Record<AIProvider, CircuitState>;
  }

  /**
   * Reset a specific circuit
   */
  reset(provider: AIProvider): void {
    const entry = this.circuits.get(provider);
    if (entry) {
      entry.breaker.reset();
      entry.failures = 0;
      entry.state = 'CLOSED';
      logger.info(`[CircuitBreaker] Provider ${provider} manually reset`);
    }
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    for (const [provider, entry] of this.circuits) {
      entry.breaker.reset();
      entry.failures = 0;
      entry.state = 'CLOSED';
    }
    logger.info('[CircuitBreaker] All circuits manually reset');
  }

  /**
   * Get metrics
   */
  getMetrics(): { provider: AIProvider; state: CircuitState; failures: number; lastFailure: number }[] {
    return Array.from(this.circuits.entries()).map(([provider, entry]) => ({
      provider,
      state: entry.breaker.getState(),
      failures: entry.failures,
      lastFailure: entry.lastFailure,
    }));
  }
}

// ============================================================================
// COST LIMIT MANAGER
// ============================================================================

export class CostLimitManager {
  private dailyBudgetUSD: number;
  private perUserDailyBudgetUSD: number;
  private perRequestMaxUSD: number;
  private storage: CostStorage;
  private metrics: { totalCost: number; rejectedCount: number };

  constructor(config?: {
    dailyBudgetUSD?: number;
    perUserDailyBudgetUSD?: number;
    perRequestMaxUSD?: number;
    storage?: CostStorage;
  }) {
    this.dailyBudgetUSD = config?.dailyBudgetUSD ?? 100;
    this.perUserDailyBudgetUSD = config?.perUserDailyBudgetUSD ?? 10;
    this.perRequestMaxUSD = config?.perRequestMaxUSD ?? 1;
    this.storage = config?.storage ?? new InMemoryCostStorage();
    this.metrics = { totalCost: 0, rejectedCount: 0 };
  }

  /**
   * Check if a request can be processed based on cost limits
   */
  async canProcess(model: string, prompt: string, userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    estimatedCost?: number;
  }> {
    const inputTokens = estimateTokens(prompt);
    const estimatedOutputTokens = 1000;
    const estimatedCost = calculateCost(model, inputTokens, estimatedOutputTokens);

    // Check per-request limit
    if (estimatedCost > this.perRequestMaxUSD) {
      this.metrics.rejectedCount++;
      logger.warn('[CostLimit] Request rejected: per-request limit', { estimatedCost, limit: this.perRequestMaxUSD });
      return {
        allowed: false,
        reason: 'per_request_limit',
        estimatedCost,
      };
    }

    // Check user daily budget
    const userDailySpend = await this.storage.getUserDailySpend(userId);
    if (userDailySpend + estimatedCost > this.perUserDailyBudgetUSD) {
      this.metrics.rejectedCount++;
      logger.warn('[CostLimit] Request rejected: user daily budget', {
        userId,
        userDailySpend,
        estimatedCost,
        limit: this.perUserDailyBudgetUSD,
      });
      return {
        allowed: false,
        reason: 'user_daily_limit',
        estimatedCost,
      };
    }

    // Check global daily budget
    const globalDailySpend = await this.storage.getGlobalDailySpend();
    if (globalDailySpend + estimatedCost > this.dailyBudgetUSD) {
      this.metrics.rejectedCount++;
      logger.warn('[CostLimit] Request rejected: global daily budget', {
        globalDailySpend,
        estimatedCost,
        limit: this.dailyBudgetUSD,
      });
      return {
        allowed: false,
        reason: 'global_daily_limit',
        estimatedCost,
      };
    }

    return { allowed: true, estimatedCost };
  }

  /**
   * Track cost after request completion
   */
  async trackCost(userId: string, cost: number): Promise<void> {
    await this.storage.incrementUserDailySpend(userId, cost);
    await this.storage.incrementGlobalDailySpend(cost);
    this.metrics.totalCost += cost;
  }

  /**
   * Get current budget status
   */
  async getBudgetStatus(userId: string): Promise<{
    global: { spent: number; limit: number; remaining: number };
    user: { spent: number; limit: number; remaining: number };
  }> {
    const globalSpent = await this.storage.getGlobalDailySpend();
    const userSpent = await this.storage.getUserDailySpend(userId);

    return {
      global: {
        spent: globalSpent,
        limit: this.dailyBudgetUSD,
        remaining: Math.max(0, this.dailyBudgetUSD - globalSpent),
      },
      user: {
        spent: userSpent,
        limit: this.perUserDailyBudgetUSD,
        remaining: Math.max(0, this.perUserDailyBudgetUSD - userSpent),
      },
    };
  }

  /**
   * Get metrics
   */
  getMetrics(): { totalCost: number; rejectedCount: number } {
    return { ...this.metrics };
  }

  /**
   * Update budget limits
   */
  updateLimits(config: {
    dailyBudgetUSD?: number;
    perUserDailyBudgetUSD?: number;
    perRequestMaxUSD?: number;
  }): void {
    if (config.dailyBudgetUSD !== undefined) this.dailyBudgetUSD = config.dailyBudgetUSD;
    if (config.perUserDailyBudgetUSD !== undefined) this.perUserDailyBudgetUSD = config.perUserDailyBudgetUSD;
    if (config.perRequestMaxUSD !== undefined) this.perRequestMaxUSD = config.perRequestMaxUSD;
  }
}

// ============================================================================
// RATE LIMIT MANAGER
// ============================================================================

export class RateLimitManager {
  private guard: RateLimitGuard;
  private metrics: { totalRequests: number; rejectedCount: number };

  constructor(redis?: RedisLike) {
    this.guard = new RateLimitGuard(redis);
    this.metrics = { totalRequests: 0, rejectedCount: 0 };
  }

  /**
   * Check rate limit for a key
   */
  async check(key: string, config?: {
    windowMs?: number;
    maxRequests?: number;
  }): Promise<{
    allowed: boolean;
    remaining?: number;
    retryAfterMs?: number;
  }> {
    this.metrics.totalRequests++;

    const windowMs = config?.windowMs ?? 60000;
    const maxRequests = config?.maxRequests ?? 60;

    try {
      await this.guard.check(key, { windowMs, maxRequests });
      return { allowed: true, remaining: maxRequests - 1 };
    } catch (error) {
      if (error instanceof RateLimitError) {
        this.metrics.rejectedCount++;
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: error.details.retryAfterMs,
        };
      }
      throw error;
    }
  }

  /**
   * Get metrics
   */
  getMetrics(): { totalRequests: number; rejectedCount: number } {
    return { ...this.metrics };
  }
}

// ============================================================================
// MAIN FALLBACK SERVICE
// ============================================================================

export class FallbackService {
  private circuitBreakerManager: CircuitBreakerManager;
  private costLimitManager: CostLimitManager;
  private rateLimitManager: RateLimitManager;
  private deterministicFallback: DeterministicFallback;
  private config: FallbackConfig;
  private metrics: FallbackMetrics;

  constructor(config?: Partial<FallbackConfig> & {
    dailyBudgetUSD?: number;
    perUserDailyBudgetUSD?: number;
    perRequestMaxUSD?: number;
    redis?: RedisLike;
  }) {
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      retryDelayMs: config?.retryDelayMs ?? 1000,
      circuitBreakerThreshold: config?.circuitBreakerThreshold ?? 5,
      circuitResetTimeoutMs: config?.circuitResetTimeoutMs ?? 60000,
      enableFallbackResponses: config?.enableFallbackResponses ?? true,
      fallbackResponses: { ...DETERMINISTIC_RESPONSES, ...config?.fallbackResponses },
    };

    this.circuitBreakerManager = new CircuitBreakerManager(this.config);
    this.costLimitManager = new CostLimitManager({
      dailyBudgetUSD: config?.dailyBudgetUSD,
      perUserDailyBudgetUSD: config?.perUserDailyBudgetUSD,
      perRequestMaxUSD: config?.perRequestMaxUSD,
    });
    this.rateLimitManager = new RateLimitManager(config?.redis);
    this.deterministicFallback = new DeterministicFallback();
    this.metrics = {
      totalRequests: 0,
      fallbackCount: 0,
      circuitBreakerTrips: 0,
      rateLimitRejections: 0,
      costLimitRejections: 0,
      avgFallbackLatencyMs: 0,
    };
  }

  /**
   * Process request with full fallback protection
   */
  async processWithFallback(
    context: FallbackContext,
    fn: () => Promise<ProviderResult>
  ): Promise<ProviderResult | { fallback: true; response: string }> {
    this.metrics.totalRequests++;
    const startTime = Date.now();

    // Check rate limit
    const rateLimitResult = await this.rateLimitManager.check(context.userId || 'anonymous');
    if (!rateLimitResult.allowed) {
      this.metrics.rateLimitRejections++;
      logger.warn('[FallbackService] Rate limit exceeded', { userId: context.userId });

      return {
        fallback: true,
        response: this.deterministicFallback.getErrorResponse('rate_limit'),
      };
    }

    // Check cost limit
    const costResult = await this.costLimitManager.canProcess(
      DEFAULT_MODELS[context.provider]?.[context.tier] || 'claude-haiku-3',
      context.prompt,
      context.userId || 'anonymous'
    );

    if (!costResult.allowed) {
      this.metrics.costLimitRejections++;
      logger.warn('[FallbackService] Cost limit exceeded', {
        userId: context.userId,
        reason: costResult.reason,
        estimatedCost: costResult.estimatedCost,
      });

      return {
        fallback: true,
        response: this.deterministicFallback.getErrorResponse('cost_limit'),
      };
    }

    // Execute with circuit breaker
    try {
      const result = await this.circuitBreakerManager.executeWithProtection(
        context.provider,
        fn,
        this.config.enableFallbackResponses
          ? () => Promise.resolve(this.generateDeterministicResult(context))
          : undefined
      );

      // Track cost
      if (result && !('fallback' in result)) {
        await this.costLimitManager.trackCost(
          context.userId || 'anonymous',
          result.cost
        );
      }

      return result;
    } catch (error) {
      this.metrics.fallbackCount++;

      // Check circuit state
      const state = this.circuitBreakerManager.getState(context.provider);
      if (state === 'OPEN') {
        this.metrics.circuitBreakerTrips++;
      }

      if (this.config.enableFallbackResponses) {
        const latency = Date.now() - startTime;
        this.metrics.avgFallbackLatencyMs =
          (this.metrics.avgFallbackLatencyMs * (this.metrics.fallbackCount - 1) + latency) /
          this.metrics.fallbackCount;

        return {
          fallback: true,
          response: this.deterministicFallback.generate(context.prompt, context),
        };
      }

      throw error;
    }
  }

  /**
   * Generate deterministic fallback result
   */
  private generateDeterministicResult(context: FallbackContext): ProviderResult {
    const response = this.deterministicFallback.generate(context.prompt, context);

    return {
      content: response,
      provider: 'local' as AIProvider,
      model: 'deterministic-fallback',
      promptTokens: estimateTokens(context.prompt),
      completionTokens: estimateTokens(response),
      totalTokens: estimateTokens(context.prompt) + estimateTokens(response),
      cost: 0,
      stopReason: 'fallback',
    };
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics(): FallbackMetrics {
    return {
      ...this.metrics,
      circuitBreakerTrips: this.metrics.circuitBreakerTrips,
    };
  }

  /**
   * Get circuit breaker states
   */
  getCircuitStates(): Record<AIProvider, CircuitState> {
    return this.circuitBreakerManager.getAllStates();
  }

  /**
   * Get cost budget status
   */
  async getBudgetStatus(userId: string) {
    return this.costLimitManager.getBudgetStatus(userId);
  }

  /**
   * Reset all circuits (for maintenance)
   */
  resetCircuits(): void {
    this.circuitBreakerManager.resetAll();
  }

  /**
   * Reset specific circuit
   */
  resetCircuit(provider: AIProvider): void {
    this.circuitBreakerManager.reset(provider);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FallbackConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update cost limits
   */
  updateCostLimits(config: {
    dailyBudgetUSD?: number;
    perUserDailyBudgetUSD?: number;
    perRequestMaxUSD?: number;
  }): void {
    this.costLimitManager.updateLimits(config);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const fallbackService = new FallbackService();

// Named exports for DI/testing
export {
  DeterministicFallback,
  CircuitBreakerManager,
  CostLimitManager,
  RateLimitManager,
};
