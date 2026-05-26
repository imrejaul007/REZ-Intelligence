/**
 * REZ Agent Orchestrator - Marketing Hub Integration
 *
 * Bridges AI agent insights to the REZ-Media Marketing Hub for automated
 * campaign triggering. Maps agent events to marketing campaigns with:
 * - Timing-safe authentication via INTERNAL_SERVICE_TOKEN
 * - Exponential backoff retry logic with jitter
 * - Circuit breaker pattern for fault tolerance
 * - Structured logging for observability
 *
 * Environment Variables Required:
 * - MARKETING_SERVICE_URL: Base URL of REZ-Marketing service (default: http://localhost:4000)
 * - INTERNAL_SERVICE_TOKEN: Service authentication token
 */

import crypto from 'crypto';
import { randomInt } from 'crypto';
import { AgentTask, AgentType } from './AgentOrchestrator';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type AgentEventType =
  | 'ABANDONMENT_DETECTED'
  | 'WIN_BACK_TRIGGER'
  | 'RETENTION_TRIGGER'
  | 'REFERRAL_POTENTIAL'
  | 'URGENCY_TRIGGER'
  | 'CHURN_RISK'
  | 'HIGH_VALUE_ALERT'
  | 'CART_RECOVERY';

export interface AgentInsight {
  eventType: AgentEventType;
  userId: string;
  merchantId: string;
  agentType: AgentType;
  confidence: number;
  metadata: Record<string, unknown>;
  timestamp: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface MarketingCampaignPayload {
  merchantId: string;
  name: string;
  objective: 'cart_recovery' | 'win_back' | 'retention' | 'referral' | 'awareness' | 'urgency';
  channel: 'push' | 'sms' | 'email' | 'whatsapp' | 'in_app';
  message: string;
  audience: {
    segment: string;
    userIds?: string[];
    filters?: Record<string, unknown>;
  };
  scheduledAt?: string;
  source: 'agent_orchestrator';
  insight: {
    eventType: AgentEventType;
    confidence: number;
    metadata: Record<string, unknown>;
  };
}

export interface MarketingApiResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  campaignId?: string;
  broadcastId?: string;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Service connection
  MARKETING_SERVICE_URL: process.env.MARKETING_SERVICE_URL || 'http://localhost:4000',
  SERVICE_NAME: 'rez-agent-orchestrator',

  // Authentication
  getInternalToken(): string {
    const token = process.env.INTERNAL_SERVICE_TOKEN;
    if (!token) {
      throw new Error('INTERNAL_SERVICE_TOKEN environment variable is required');
    }
    return token;
  },

  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY_MS: 500,
    MAX_DELAY_MS: 5000,
    JITTER_MAX_MS: 500,
  },

  // Circuit breaker configuration
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: 5,
    RECOVERY_TIMEOUT_MS: 30000,
    HALF_OPEN_MAX_REQUESTS: 3,
  },

  // Timeout configuration
  TIMEOUT: {
    CONNECT_MS: 5000,
    REQUEST_MS: 15000,
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Logging
// ═══════════════════════════════════════════════════════════════════════════════

function createLogger(prefix: string) {
  return {
    info: (message: string, meta?: Record<string, unknown>) => {
      console.log(JSON.stringify({
        level: 'info',
        timestamp: new Date().toISOString(),
        service: CONFIG.SERVICE_NAME,
        component: prefix,
        message,
        ...meta,
      }));
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      console.warn(JSON.stringify({
        level: 'warn',
        timestamp: new Date().toISOString(),
        service: CONFIG.SERVICE_NAME,
        component: prefix,
        message,
        ...meta,
      }));
    },
    error: (message: string, meta?: Record<string, unknown>) => {
      console.error(JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        service: CONFIG.SERVICE_NAME,
        component: prefix,
        message,
        ...meta,
      }));
    },
    debug: (message: string, meta?: Record<string, unknown>) => {
      if (process.env.DEBUG === 'true') {
        console.log(JSON.stringify({
          level: 'debug',
          timestamp: new Date().toISOString(),
          service: CONFIG.SERVICE_NAME,
          component: prefix,
          message,
          ...meta,
        }));
      }
    },
  };
}

const logger = createLogger('MarketingIntegration');

// ═══════════════════════════════════════════════════════════════════════════════
// Timing-Safe Authentication
// ═══════════════════════════════════════════════════════════════════════════════

function createAuthHeaders(): Record<string, string> {
  const token = CONFIG.getInternalToken();
  return {
    'Content-Type': 'application/json',
    'x-internal-token': token,
    'x-internal-service': CONFIG.SERVICE_NAME,
    'X-Request-ID': crypto.randomUUID(),
  };
}

function timingSafeCompare(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Circuit Breaker
// ═══════════════════════════════════════════════════════════════════════════════

class CircuitBreaker {
  private state: CircuitBreakerState = {
    failures: 0,
    lastFailure: 0,
    state: 'closed',
  };
  private halfOpenRequests = 0;

  private readonly failureThreshold: number;
  private readonly recoveryTimeout: number;
  private readonly halfOpenMaxRequests: number;

  constructor(
    failureThreshold = CONFIG.CIRCUIT_BREAKER.FAILURE_THRESHOLD,
    recoveryTimeout = CONFIG.CIRCUIT_BREAKER.RECOVERY_TIMEOUT_MS,
    halfOpenMaxRequests = CONFIG.CIRCUIT_BREAKER.HALF_OPEN_MAX_REQUESTS
  ) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeout;
    this.halfOpenMaxRequests = halfOpenMaxRequests;
  }

  isRequestAllowed(): boolean {
    const now = Date.now();

    switch (this.state.state) {
      case 'closed':
        return true;

      case 'open':
        if (now - this.state.lastFailure >= this.recoveryTimeout) {
          this.state.state = 'half-open';
          this.halfOpenRequests = 0;
          logger.info('Circuit breaker transitioning to half-open state');
          return true;
        }
        return false;

      case 'half-open':
        if (this.halfOpenRequests < this.halfOpenMaxRequests) {
          this.halfOpenRequests++;
          return true;
        }
        return false;

      default:
        return true;
    }
  }

  recordSuccess(): void {
    if (this.state.state === 'half-open') {
      logger.info('Circuit breaker closing after successful request');
    }
    this.state = {
      failures: 0,
      lastFailure: 0,
      state: 'closed',
    };
  }

  recordFailure(): void {
    this.state.failures++;
    this.state.lastFailure = Date.now();

    if (this.state.state === 'half-open') {
      this.state.state = 'open';
      logger.warn('Circuit breaker reopened after half-open failure');
    } else if (this.state.failures >= this.failureThreshold) {
      this.state.state = 'open';
      logger.error('Circuit breaker opened due to repeated failures', {
        failures: this.state.failures,
        threshold: this.failureThreshold,
      });
    }
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  reset(): void {
    this.state = {
      failures: 0,
      lastFailure: 0,
      state: 'closed',
    };
    this.halfOpenRequests = 0;
  }
}

const marketingCircuitBreaker = new CircuitBreaker();

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP Client with Retry Logic
// ═══════════════════════════════════════════════════════════════════════════════

interface RetryOptions {
  MAX_ATTEMPTS: number;
  BASE_DELAY_MS: number;
  MAX_DELAY_MS: number;
  JITTER_MAX_MS: number;
}

function calculateBackoff(attempt: number, options: RetryOptions): number {
  const expDelay = Math.min(
    options.BASE_DELAY_MS * Math.pow(2, attempt - 1),
    options.MAX_DELAY_MS
  );
  const jitterMs = randomInt(0, options.JITTER_MAX_MS);
  return expDelay + jitterMs;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  retryOptions: RetryOptions = CONFIG.RETRY
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retryOptions.MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        CONFIG.TIMEOUT.REQUEST_MS
      );

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      const data = await response.json() as MarketingApiResponse;

      // Check for application-level errors
      if (!data.success && !response.ok) {
        throw new Error(`Marketing API error: ${data.error || response.statusText}`);
      }

      return data as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on abort (timeout) or certain HTTP errors
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('Request timeout', { url, attempt });
      }

      if (attempt < retryOptions.MAX_ATTEMPTS) {
        const delay = calculateBackoff(attempt, retryOptions);
        logger.warn('Request failed, retrying', {
          url,
          attempt,
          maxAttempts: retryOptions.MAX_ATTEMPTS,
          delayMs: delay,
          error: lastError.message,
        });
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Request failed after all retries');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Campaign Trigger Mapping
// ═══════════════════════════════════════════════════════════════════════════════

interface TriggerMapping {
  campaignObjective: MarketingCampaignPayload['objective'];
  channel: MarketingCampaignPayload['channel'];
  template?: string;
  segment: string;
  messageBuilder: (insight: AgentInsight) => string;
}

const AGENT_TO_CAMPAIGN_MAP: Partial<Record<AgentEventType, TriggerMapping>> = {
  ABANDONMENT_DETECTED: {
    campaignObjective: 'cart_recovery',
    channel: 'push',
    segment: 'abandoned_cart',
    messageBuilder: (insight) =>
      `Looks like you left something behind! Complete your purchase within 24 hours to enjoy exclusive savings.`,
  },

  CART_RECOVERY: {
    campaignObjective: 'cart_recovery',
    channel: 'push',
    segment: 'abandoned_cart',
    messageBuilder: (insight) => {
      const items = insight.metadata.items as string[] | undefined;
      const itemCount = items?.length || 1;
      return `Your ${itemCount > 1 ? `${itemCount} items are` : 'item is'} waiting! Complete your order now with a special discount just for you.`;
    },
  },

  WIN_BACK_TRIGGER: {
    campaignObjective: 'win_back',
    channel: 'email',
    segment: 'lapsed',
    messageBuilder: (insight) =>
      `We miss you! It's been a while since your last visit. Here's an exclusive offer to welcome you back.`,
  },

  CHURN_RISK: {
    campaignObjective: 'win_back',
    channel: 'push',
    segment: 'at_risk',
    messageBuilder: (insight) =>
      `Don't miss out! Your favorite items are still waiting. Come back and save with a special offer just for you.`,
  },

  RETENTION_TRIGGER: {
    campaignObjective: 'retention',
    channel: 'push',
    segment: 'high_value',
    messageBuilder: (insight) => {
      const loyaltyTier = insight.metadata.loyaltyTier as string || 'loyal';
      return `Thank you for being a ${loyaltyTier} customer! Enjoy exclusive perks and early access to new arrivals.`;
    },
  },

  HIGH_VALUE_ALERT: {
    campaignObjective: 'retention',
    channel: 'push',
    segment: 'high_value',
    messageBuilder: (insight) => {
      const value = insight.metadata.totalValue as number || 0;
      return `As one of our valued customers, you have exclusive access to premium products and special pricing!`;
    },
  },

  REFERRAL_POTENTIAL: {
    campaignObjective: 'referral',
    channel: 'in_app',
    segment: 'loyal',
    messageBuilder: (insight) => {
      const rewardAmount = insight.metadata.rewardAmount as number || 100;
      return `Share the love! Invite friends and earn ${rewardAmount} coins for each successful referral.`;
    },
  },

  URGENCY_TRIGGER: {
    campaignObjective: 'urgency',
    channel: 'push',
    segment: 'all',
    messageBuilder: (insight) => {
      const discountPercent = insight.metadata.discountPercent as number || 20;
      const expiresIn = insight.metadata.expiresInHours as number || 24;
      return `Flash sale! ${discountPercent}% off for the next ${expiresIn} hours only. Don't miss out!`;
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Marketing Integration Service
// ═══════════════════════════════════════════════════════════════════════════════

export class MarketingIntegration {
  private readonly baseUrl: string;
  private circuitBreaker: CircuitBreaker;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || CONFIG.MARKETING_SERVICE_URL;
    this.circuitBreaker = marketingCircuitBreaker;
  }

  /**
   * Process an agent insight and trigger appropriate marketing campaign
   */
  async processAgentInsight(insight: AgentInsight): Promise<MarketingApiResponse> {
    logger.info('Processing agent insight', {
      eventType: insight.eventType,
      userId: insight.userId,
      merchantId: insight.merchantId,
      confidence: insight.confidence,
    });

    // Check circuit breaker
    if (!this.circuitBreaker.isRequestAllowed()) {
      logger.warn('Circuit breaker is open, request rejected', {
        eventType: insight.eventType,
        userId: insight.userId,
      });
      return {
        success: false,
        error: 'Marketing service temporarily unavailable (circuit breaker open)',
      };
    }

    // Get trigger mapping for this event type
    const mapping = AGENT_TO_CAMPAIGN_MAP[insight.eventType];
    if (!mapping) {
      logger.warn('No campaign mapping found for event type', {
        eventType: insight.eventType,
      });
      return {
        success: false,
        error: `No campaign mapping configured for event type: ${insight.eventType}`,
      };
    }

    // Build campaign payload
    const payload: MarketingCampaignPayload = {
      merchantId: insight.merchantId,
      name: `${insight.eventType.replace(/_/g, ' ')} Campaign - ${new Date().toISOString().slice(0, 10)}`,
      objective: mapping.campaignObjective,
      channel: mapping.channel,
      message: mapping.messageBuilder(insight),
      audience: {
        segment: mapping.segment,
        userIds: [insight.userId],
      },
      source: 'agent_orchestrator',
      insight: {
        eventType: insight.eventType,
        confidence: insight.confidence,
        metadata: insight.metadata,
      },
    };

    // Schedule based on priority
    if (insight.priority === 'high' || insight.priority === 'critical') {
      // Immediate delivery for high priority
      logger.info('High priority insight, immediate campaign dispatch', {
        eventType: insight.eventType,
        priority: insight.priority,
      });
    } else {
      // Schedule for 1 hour later for lower priority
      const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);
      payload.scheduledAt = scheduledAt.toISOString();
    }

    try {
      // Try campaign creation first, fall back to broadcast
      const response = await this.createCampaign(payload);

      if (response.success) {
        this.circuitBreaker.recordSuccess();
        logger.info('Marketing campaign created successfully', {
          campaignId: response.campaignId,
          eventType: insight.eventType,
        });
      } else {
        this.circuitBreaker.recordFailure();
      }

      return response;
    } catch (error) {
      this.circuitBreaker.recordFailure();
      logger.error('Failed to create marketing campaign', {
        eventType: insight.eventType,
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to broadcast
      return this.sendBroadcastFallback(insight, mapping);
    }
  }

  /**
   * Create a campaign via Marketing API
   */
  async createCampaign(
    payload: MarketingCampaignPayload
  ): Promise<MarketingApiResponse> {
    const url = `${this.baseUrl}/api/marketing/campaigns`;

    logger.debug('Creating campaign', {
      url,
      payload: {
        merchantId: payload.merchantId,
        name: payload.name,
        objective: payload.objective,
        channel: payload.channel,
      },
    });

    const response = await fetchWithRetry<MarketingApiResponse>(
      url,
      {
        method: 'POST',
        headers: createAuthHeaders(),
        body: JSON.stringify({
          ...payload,
          // Flatten audience for API compatibility
          audienceSegment: payload.audience.segment,
          audienceUserIds: payload.audience.userIds,
        }),
      },
      CONFIG.RETRY
    );

    return response;
  }

  /**
   * Fallback: Send broadcast notification
   */
  async sendBroadcastFallback(
    insight: AgentInsight,
    mapping: TriggerMapping
  ): Promise<MarketingApiResponse> {
    const url = `${this.baseUrl}/api/marketing/broadcasts/send`;

    const segmentMap: Record<string, string> = {
      abandoned_cart: 'at_risk',
      lapsed: 'at_risk',
      at_risk: 'at_risk',
      high_value: 'high_value',
      loyal: 'high_value',
      all: 'all',
    };

    logger.info('Attempting broadcast fallback', {
      eventType: insight.eventType,
      segment: segmentMap[mapping.segment] || mapping.segment,
    });

    try {
      const response = await fetchWithRetry<MarketingApiResponse>(
        url,
        {
          method: 'POST',
          headers: createAuthHeaders(),
          body: JSON.stringify({
            merchantId: insight.merchantId,
            segment: segmentMap[mapping.segment] || 'all',
            title: `REZ: ${insight.eventType.replace(/_/g, ' ')}`,
            body: mapping.messageBuilder(insight),
          }),
        },
        CONFIG.RETRY
      );

      if (response.success) {
        this.circuitBreaker.recordSuccess();
      } else {
        this.circuitBreaker.recordFailure();
      }

      return response;
    } catch (error) {
      this.circuitBreaker.recordFailure();
      logger.error('Broadcast fallback also failed', {
        eventType: insight.eventType,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: `All marketing channels failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check marketing service health
   */
  async checkHealth(): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT.CONNECT_MS);

      const response = await fetch(`${this.baseUrl}/healthz`, {
        method: 'GET',
        headers: createAuthHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        return { healthy: true, latencyMs };
      }

      return {
        healthy: false,
        latencyMs,
        error: `Health check returned ${response.status}`,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreaker.getState();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
    logger.info('Circuit breaker reset');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Convenience Functions for Common Agent Events
// ═══════════════════════════════════════════════════════════════════════════════

export function createAbandonmentInsight(
  userId: string,
  merchantId: string,
  items: string[],
  cartValue: number
): AgentInsight {
  return {
    eventType: 'ABANDONMENT_DETECTED',
    userId,
    merchantId,
    agentType: 'consumer_agent',
    confidence: 0.85,
    metadata: { items, cartValue },
    timestamp: new Date().toISOString(),
    priority: 'high',
  };
}

export function createWinBackInsight(
  userId: string,
  merchantId: string,
  daysSinceLastActivity: number
): AgentInsight {
  return {
    eventType: 'WIN_BACK_TRIGGER',
    userId,
    merchantId,
    agentType: 'merchant_agent',
    confidence: Math.min(0.95, 0.5 + (daysSinceLastActivity / 100)),
    metadata: { daysSinceLastActivity },
    timestamp: new Date().toISOString(),
    priority: daysSinceLastActivity > 60 ? 'high' : 'medium',
  };
}

export function createRetentionInsight(
  userId: string,
  merchantId: string,
  loyaltyTier: string,
  totalValue: number
): AgentInsight {
  return {
    eventType: 'RETENTION_TRIGGER',
    userId,
    merchantId,
    agentType: 'analytics_agent',
    confidence: 0.9,
    metadata: { loyaltyTier, totalValue },
    timestamp: new Date().toISOString(),
    priority: 'medium',
  };
}

export function createReferralInsight(
  userId: string,
  merchantId: string,
  referralScore: number,
  rewardAmount: number
): AgentInsight {
  return {
    eventType: 'REFERRAL_POTENTIAL',
    userId,
    merchantId,
    agentType: 'marketing_agent',
    confidence: Math.min(0.95, referralScore / 100),
    metadata: { referralScore, rewardAmount },
    timestamp: new Date().toISOString(),
    priority: 'low',
  };
}

export function createUrgencyInsight(
  userId: string,
  merchantId: string,
  discountPercent: number,
  expiresInHours: number,
  productId: string
): AgentInsight {
  return {
    eventType: 'URGENCY_TRIGGER',
    userId,
    merchantId,
    agentType: 'marketing_agent',
    confidence: 0.92,
    metadata: { discountPercent, expiresInHours, productId },
    timestamp: new Date().toISOString(),
    priority: 'critical',
  };
}

export function createChurnRiskInsight(
  userId: string,
  merchantId: string,
  churnProbability: number,
  riskFactors: string[]
): AgentInsight {
  return {
    eventType: 'CHURN_RISK',
    userId,
    merchantId,
    agentType: 'analytics_agent',
    confidence: churnProbability,
    metadata: { churnProbability, riskFactors },
    timestamp: new Date().toISOString(),
    priority: churnProbability > 0.7 ? 'high' : 'medium',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton Export
// ═══════════════════════════════════════════════════════════════════════════════

export const marketingIntegration = new MarketingIntegration();

// ═══════════════════════════════════════════════════════════════════════════════
// Orchestrator Integration Helper
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrchestratorAgentEvent {
  agentType: AgentType;
  eventType: string;
  userId: string;
  merchantId: string;
  taskContext: Record<string, unknown>;
}

/**
 * Map orchestrator agent events to marketing insights
 */
export function mapAgentTaskToMarketingInsight(task: AgentTask): AgentInsight | null {
  const { context } = task;

  if (!context?.userId || !context?.merchantId) {
    logger.warn('Agent task missing required context for marketing integration', {
      taskId: task.task_id,
    });
    return null;
  }

  // Map agent type to event type
  const eventTypeMap: Partial<Record<AgentType, AgentEventType>> = {
    consumer_agent: 'ABANDONMENT_DETECTED',
    merchant_agent: 'WIN_BACK_TRIGGER',
    analytics_agent: 'CHURN_RISK',
    marketing_agent: 'REFERRAL_POTENTIAL',
  };

  const eventType = eventTypeMap[context.agentType as AgentType] ||
    (context.eventType as AgentEventType) ||
    'HIGH_VALUE_ALERT';

  return {
    eventType,
    userId: context.userId as string,
    merchantId: context.merchantId as string,
    agentType: context.agentType as AgentType,
    confidence: (context.confidence as number) || 0.8,
    metadata: context.metadata as Record<string, unknown> || {},
    timestamp: new Date().toISOString(),
    priority: mapPriority(task.priority),
  };
}

function mapPriority(
  orchestratorPriority: 'low' | 'medium' | 'high' | 'critical'
): AgentInsight['priority'] {
  return orchestratorPriority;
}

/**
 * Process a completed agent task and trigger marketing campaigns
 */
export async function onAgentTaskCompleted(
  task: AgentTask
): Promise<MarketingApiResponse | null> {
  const insight = mapAgentTaskToMarketingInsight(task);

  if (!insight) {
    return null;
  }

  // Only trigger marketing for high-priority tasks with high confidence
  if (insight.confidence < 0.7 && insight.priority !== 'critical') {
    logger.debug('Skipping low confidence insight', {
      taskId: task.task_id,
      confidence: insight.confidence,
    });
    return null;
  }

  logger.info('Triggering marketing from agent task completion', {
    taskId: task.task_id,
    eventType: insight.eventType,
    confidence: insight.confidence,
  });

  return marketingIntegration.processAgentInsight(insight);
}

/**
 * Batch process multiple agent insights with rate limiting
 */
export async function batchProcessInsights(
  insights: AgentInsight[],
  maxConcurrent = 3
): Promise<MarketingApiResponse[]> {
  const results: MarketingApiResponse[] = [];
  const queue = [...insights];

  while (queue.length > 0) {
    const batch = queue.splice(0, maxConcurrent);
    const batchResults = await Promise.all(
      batch.map((insight) => marketingIntegration.processAgentInsight(insight))
    );
    results.push(...batchResults);
  }

  return results;
}
