import axios, { AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { createClient, RedisClientType } from 'redis';
import {
  AIProvider,
  ModelTier,
  ProviderResult,
  RouteOptions,
  UsageAnalytics,
  AnalyticsQuery,
} from '../types';
import {
  PROVIDERS,
  MODEL_TIERS,
  DEFAULT_MODELS,
  MODEL_COSTS,
  PROVIDER_ENDPOINTS,
  DEFAULT_TIMEOUT,
} from '../constants';
import { logger } from '../utils/logger.js';
import { RequestLog } from '../models/RequestLog';

interface ProviderKeyConfig {
  keys: string[];
  current: number;
}

// Simple guardrail implementations
function sanitizeUserContent(prompt: string): string {
  // Basic sanitization - remove potential injection patterns
  return prompt.replace(/[<>]/g, '');
}

function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

export class AIRouter {
  private redis: RedisClientType | null = null;
  private keyIndex: Record<string, ProviderKeyConfig> = {};
  private dailyCostUSD = 0;
  private userCosts: Record<string, number> = {};
  private circuitBreakers: Map<string, { state: string; failures: number }> = new Map();
  private initialized = false;

  async init(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redis = createClient({ url: redisUrl });

      this.redis.on('error', (err) => {
        logger.error('Redis error', { error: err.message });
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected', { url: redisUrl });
      });

      await this.redis.connect();

      // Load API keys from env
      this.loadKeys();

      // Initialize guardrails
      this.initializeGuardrails();

      logger.info('AI Router initialized with guardrails');
    } catch (err) {
      logger.warn('Redis connection failed, continuing without cache', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  private loadKeys(): void {
    // Support multiple keys for rotation
    const anthropicKeys = this.parseKeys(
      process.env['ANTHROPIC_API_KEYS'] || process.env['ANTHROPIC_API_KEY']
    );
    const openaiKeys = this.parseKeys(
      process.env['OPENAI_API_KEYS'] || process.env['OPENAI_API_KEY']
    );

    this.keyIndex = {
      [PROVIDERS.ANTHROPIC]: { keys: anthropicKeys, current: 0 },
      [PROVIDERS.OPENAI]: { keys: openaiKeys, current: 0 },
    };

    logger.info('API keys loaded', {
      anthropicCount: anthropicKeys.length,
      openaiCount: openaiKeys.length,
      hasGoogleKey: !!process.env['GOOGLE_API_KEY'],
    });
  }

  private initializeGuardrails(): void {
    // Initialize circuit breakers per provider
    this.circuitBreakers.set(PROVIDERS.ANTHROPIC, { state: 'CLOSED', failures: 0 });
    this.circuitBreakers.set(PROVIDERS.OPENAI, { state: 'CLOSED', failures: 0 });
    this.circuitBreakers.set(PROVIDERS.GOOGLE, { state: 'CLOSED', failures: 0 });

    this.initialized = true;
    logger.info('Guardrails initialized');
  }

  private parseKeys(keys: string | undefined): string[] {
    if (!keys) return [];
    if (typeof keys === 'string') {
      return keys.split(',').map((k) => k.trim()).filter(Boolean);
    }
    return keys;
  }

  // Get next key (round-robin)
  private getNextKeyInternal(provider: AIProvider): string | null {
    const providerKeys = this.keyIndex[provider];
    if (!providerKeys || providerKeys.keys.length === 0) {
      return null;
    }
    const key = providerKeys.keys[providerKeys.current];
    providerKeys.current = (providerKeys.current + 1) % providerKeys.keys.length;
    return key;
  }

  // Public method to get next API key
  getNextKey(provider: AIProvider): string | null {
    return this.getNextKeyInternal(provider);
  }

  // Get next available provider (for circuit breaker fallback)
  private getNextAvailableProvider(excludeProvider: AIProvider): AIProvider {
    const providers = Object.values(PROVIDERS).filter(
      (p) => p !== excludeProvider && this.isProviderConfigured(p)
    );

    for (const provider of providers) {
      const cb = this.circuitBreakers.get(provider);
      if (!cb || cb.state !== 'OPEN') {
        return provider;
      }
    }

    // If all circuits are open, return the first one anyway
    return providers[0] || PROVIDERS.ANTHROPIC;
  }

  // Get circuit breaker state for a provider
  getCircuitState(provider: AIProvider): string {
    const cb = this.circuitBreakers.get(provider);
    return cb?.state || 'UNKNOWN';
  }

  // Route request to appropriate model
  async route(options: RouteOptions): Promise<ProviderResult> {
    const {
      userId,
      prompt,
      systemPrompt,
      tier = MODEL_TIERS.BALANCED,
      preferredProvider,
      fallback = true,
      maxCost = 1.0,
      timeout = DEFAULT_TIMEOUT,
    } = options;

    const requestId = uuidv4();
    const startTime = Date.now();

    // Sanitize inputs
    const sanitizedPrompt = sanitizeUserContent(prompt);
    const sanitizedSystemPrompt = systemPrompt ? sanitizeUserContent(systemPrompt) : undefined;

    // Guard: Cost estimation and enforcement
    let provider = preferredProvider || PROVIDERS.ANTHROPIC;
    let model = DEFAULT_MODELS[provider]?.[tier];
    if (!model) {
      throw new Error(`No model configured for provider ${provider} and tier ${tier}`);
    }

    const estimatedCost = this.estimateCost(model, sanitizedPrompt, 4096);

    // Check daily cost budget
    const dailyBudgetUSD = parseFloat(process.env['AI_DAILY_BUDGET_USD'] || '100');
    if (this.dailyCostUSD + estimatedCost > dailyBudgetUSD) {
      logger.error('[AIRouter] Daily cost budget exceeded', { dailyCostUSD: this.dailyCostUSD, estimatedCost, dailyBudgetUSD });
      throw new Error('Daily cost budget exceeded');
    }

    // Check user cost budget
    const userIdKey = userId || 'anonymous';
    const userBudgetUSD = parseFloat(process.env['AI_USER_DAILY_BUDGET_USD'] || '10');
    if ((this.userCosts[userIdKey] || 0) + estimatedCost > userBudgetUSD) {
      logger.warn('[AIRouter] User daily cost budget exceeded', { userId: userIdKey, userCostUSD: this.userCosts[userIdKey], estimatedCost, userBudgetUSD });
      throw new Error('User daily cost budget exceeded');
    }

    await this.enforceCostLimit(estimatedCost, maxCost, userId);

    // Check circuit breaker
    const circuitBreaker = this.circuitBreakers.get(provider);
    if (circuitBreaker && circuitBreaker.state === 'OPEN') {
      if (!fallback) throw new Error(`Circuit breaker open for ${provider}`);
      provider = this.getNextAvailableProvider(provider);
      model = DEFAULT_MODELS[provider]?.[tier];
      logger.info('[AIRouter] Circuit open, switching provider', { from: preferredProvider, to: provider });
    }

    // If preferred provider fails, try fallback
    if (fallback) {
      const providers = [
        provider,
        ...Object.values(PROVIDERS).filter((p) => p !== provider),
      ] as AIProvider[];

      for (const p of providers) {
        try {
          const result = await this.callProvider(p, model!, sanitizedPrompt, sanitizedSystemPrompt, {
            requestId,
            userId,
            timeout,
          });

          // Track cost
          this.dailyCostUSD += result.cost;
          this.userCosts[userIdKey] = (this.userCosts[userIdKey] || 0) + result.cost;

          // Log success
          await this.logRequest({
            ...result,
            requestId,
            userId,
            provider: p,
            model: model!,
            tier,
            latency: Date.now() - startTime,
            status: 'success',
          });

          return result;
        } catch (err) {
          logger.warn(`Provider ${p} failed, trying fallback`, {
            requestId,
            error: err instanceof Error ? err.message : 'Unknown error',
          });

          // Try next provider
          const nextModel = DEFAULT_MODELS[p]?.[tier];
          if (nextModel && p !== provider) {
            model = nextModel;
          }
        }
      }
    } else {
      try {
        const result = await this.callProvider(provider, model!, prompt, systemPrompt, {
          requestId,
          userId,
          timeout,
        });

        // Track cost
        this.dailyCostUSD += result.cost;
        this.userCosts[userIdKey] = (this.userCosts[userIdKey] || 0) + result.cost;

        await this.logRequest({
          ...result,
          requestId,
          userId,
          provider,
          model: model!,
          tier,
          latency: Date.now() - startTime,
          status: 'success',
        });

        return result;
      } catch (err) {
        await this.logRequest({
          requestId,
          userId,
          provider,
          model: model!,
          tier,
          latency: Date.now() - startTime,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
        });
        throw err;
      }
    }

    throw new Error('All AI providers failed');
  }

  // Call specific provider
  private async callProvider(
    provider: AIProvider,
    model: string,
    prompt: string,
    systemPrompt: string | undefined,
    options: { requestId: string; userId?: string; timeout: number }
  ): Promise<ProviderResult> {
    const { requestId, userId, timeout } = options;

    switch (provider) {
      case PROVIDERS.ANTHROPIC:
        return this.callAnthropic(model, prompt, systemPrompt, requestId, timeout);
      case PROVIDERS.OPENAI:
        return this.callOpenAI(model, prompt, systemPrompt, requestId, timeout);
      case PROVIDERS.GOOGLE:
        return this.callGoogle(model, prompt, systemPrompt, requestId, timeout);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private async callAnthropic(
    model: string,
    prompt: string,
    systemPrompt: string | undefined,
    requestId: string,
    timeout: number
  ): Promise<ProviderResult> {
    const apiKey = this.getNextKey(PROVIDERS.ANTHROPIC);
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await axios.post(
      PROVIDER_ENDPOINTS[PROVIDERS.ANTHROPIC],
      {
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'Content-Type': 'application/json',
        },
        timeout,
      }
    );

    const usage = response.data.usage;
    const cost = this.calculateCost(model, usage.input_tokens, usage.output_tokens);

    return {
      content: response.data.content[0].text,
      provider: PROVIDERS.ANTHROPIC,
      model,
      promptTokens: usage.input_tokens,
      completionTokens: usage.output_tokens,
      totalTokens: usage.input_tokens + usage.output_tokens,
      cost,
      stopReason: response.data.stop_reason,
    };
  }

  private async callOpenAI(
    model: string,
    prompt: string,
    systemPrompt: string | undefined,
    requestId: string,
    timeout: number
  ): Promise<ProviderResult> {
    const apiKey = this.getNextKey(PROVIDERS.OPENAI);
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await axios.post(
      PROVIDER_ENDPOINTS[PROVIDERS.OPENAI],
      { model, messages, max_tokens: 4096 },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout,
      }
    );

    const usage = response.data.usage;
    const cost = this.calculateCost(
      model,
      usage.prompt_tokens,
      usage.completion_tokens
    );

    return {
      content: response.data.choices[0].message.content,
      provider: PROVIDERS.OPENAI,
      model,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      cost,
      stopReason: response.data.choices[0].finish_reason,
    };
  }

  private async callGoogle(
    model: string,
    prompt: string,
    systemPrompt: string | undefined,
    requestId: string,
    timeout: number
  ): Promise<ProviderResult> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Google API key not configured');
    }

    const response = await axios.post(
      `${PROVIDER_ENDPOINTS[PROVIDERS.GOOGLE]}/${model}:generateContent`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        generationConfig: { maxOutputTokens: 4096 },
      },
      {
        params: { key: apiKey },
        timeout,
      }
    );

    const usage = response.data.usageMetadata;
    const promptTokenCount = usage.promptTokenCount || 0;
    const candidatesTokenCount = usage.candidatesTokenCount || 0;

    const cost = this.calculateCost(model, promptTokenCount, candidatesTokenCount);

    return {
      content: response.data.candidates[0].content.parts[0].text,
      provider: PROVIDERS.GOOGLE,
      model,
      promptTokens: promptTokenCount,
      completionTokens: candidatesTokenCount,
      totalTokens: promptTokenCount + candidatesTokenCount,
      cost,
      stopReason: response.data.candidates[0].finishReason,
    };
  }

  calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const costs = MODEL_COSTS[model] || { input: 1, output: 5 };
    return (
      (promptTokens / 1000000) * costs.input +
      (completionTokens / 1000000) * costs.output
    );
  }

  // PRODUCTION FIX: Estimate cost BEFORE making API call
  estimateCost(model: string, prompt: string, maxTokens?: number): number {
    // Rough estimate: ~4 characters per token
    const promptTokens = Math.ceil(prompt.length / 4);
    const completionTokens = maxTokens || 1000; // Default max completion

    const costs = MODEL_COSTS[model] || { input: 1, output: 5 };
    return (
      (promptTokens / 1000000) * costs.input +
      (completionTokens / 1000000) * costs.output
    );
  }

  // PRODUCTION FIX: Enforce max cost limit
  async enforceCostLimit(
    estimatedCost: number,
    maxCost: number | undefined,
    userId?: string
  ): Promise<void> {
    if (maxCost && estimatedCost > maxCost) {
      logger.error('[AIRouter] Cost limit exceeded', {
        estimatedCost,
        maxCost,
        userId,
      });
      throw new Error(
        `Estimated cost ${estimatedCost.toFixed(4)} exceeds maximum allowed ${maxCost}`
      );
    }
  }

  private async logRequest(data: {
    requestId: string;
    userId?: string;
    provider: AIProvider;
    model: string;
    tier: ModelTier;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    latency: number;
    status: 'success' | 'error' | 'fallback';
    error?: string;
    fallbackFrom?: string;
    fallbackTo?: string;
  }): Promise<void> {
    try {
      await RequestLog.create({
        requestId: data.requestId,
        userId: data.userId,
        provider: data.provider,
        model: data.model,
        tier: data.tier,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens: data.totalTokens,
        cost: data.cost,
        latency: data.latency,
        status: data.status,
        error: data.error,
        fallbackUsed: data.status === 'fallback',
        fallbackFrom: data.fallbackFrom,
        fallbackTo: data.fallbackTo,
      });
    } catch (err) {
      logger.error('Failed to log request', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Get usage analytics
  async getUsageAnalytics(options: AnalyticsQuery = {}): Promise<UsageAnalytics> {
    const { startDate, endDate, userId, provider } = options;

    const match: Record<string, unknown> = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) (match.createdAt as Record<string, Date>).$gte = new Date(startDate);
      if (endDate) (match.createdAt as Record<string, Date>).$lte = new Date(endDate);
    }
    if (userId) match.userId = userId;
    if (provider) match.provider = provider;

    const [summary, byProvider, byModel, byUser] = await Promise.all([
      RequestLog.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            totalCost: { $sum: '$cost' },
            totalTokens: { $sum: '$totalTokens' },
            avgLatency: { $avg: '$latency' },
            errorRate: {
              $avg: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] },
            },
          },
        },
      ]),
      RequestLog.aggregate([
        { $match: match },
        { $group: { _id: '$provider', count: { $sum: 1 }, cost: { $sum: '$cost' } } },
      ]),
      RequestLog.aggregate([
        { $match: match },
        { $group: { _id: '$model', count: { $sum: 1 }, cost: { $sum: '$cost' } } },
      ]),
      RequestLog.aggregate([
        { $match: { ...match, userId: { $exists: true } } },
        { $group: { _id: '$userId', count: { $sum: 1 }, cost: { $sum: '$cost' } } },
        { $sort: { cost: -1 } },
        { $limit: 10 },
      ]),
    ]);

    return {
      summary: summary[0] || {
        totalRequests: 0,
        totalCost: 0,
        totalTokens: 0,
        avgLatency: 0,
        errorRate: 0,
      },
      byProvider,
      byModel,
      topUsers: byUser,
    };
  }

  // Check if provider keys are configured
  isProviderConfigured(provider: AIProvider): boolean {
    if (provider === PROVIDERS.GOOGLE) {
      return !!process.env.GOOGLE_API_KEY;
    }
    const config = this.keyIndex[provider];
    return (config?.keys.length ?? 0) > 0;
  }

  // Health check for specific provider
  async checkProviderHealth(provider: AIProvider): Promise<{
    healthy: boolean;
    latency: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      let healthy = false;

      switch (provider) {
        case PROVIDERS.ANTHROPIC: {
          const apiKey = this.getNextKey(PROVIDERS.ANTHROPIC);
          if (apiKey) {
            await axios.post(
              PROVIDER_ENDPOINTS[PROVIDERS.ANTHROPIC],
              {
                model: 'claude-3-5-haiku-20241022',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'hi' }],
              },
              {
                headers: {
                  'x-api-key': apiKey,
                  'anthropic-version': '2023-06-01',
                  'Content-Type': 'application/json',
                },
                timeout: 5000,
              }
            );
            healthy = true;
          }
          break;
        }
        case PROVIDERS.OPENAI: {
          const apiKey = this.getNextKey(PROVIDERS.OPENAI);
          if (apiKey) {
            await axios.post(
              PROVIDER_ENDPOINTS[PROVIDERS.OPENAI],
              {
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: 'hi' }],
                max_tokens: 10,
              },
              {
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                timeout: 5000,
              }
            );
            healthy = true;
          }
          break;
        }
        case PROVIDERS.GOOGLE: {
          const apiKey = process.env.GOOGLE_API_KEY;
          if (apiKey) {
            await axios.post(
              `${PROVIDER_ENDPOINTS[PROVIDERS.GOOGLE]}/gemini-1.5-flash:generateContent`,
              {
                contents: [{ parts: [{ text: 'hi' }] }],
                generationConfig: { maxOutputTokens: 10 },
              },
              {
                params: { key: apiKey },
                timeout: 5000,
              }
            );
            healthy = true;
          }
          break;
        }
      }

      return {
        healthy,
        latency: Date.now() - startTime,
      };
    } catch (err) {
      const error = err as Error | AxiosError;
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: error.message,
      };
    }
  }
}

export const aiRouter = new AIRouter();
