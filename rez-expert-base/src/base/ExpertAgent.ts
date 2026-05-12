/**
 * ExpertAgent - Abstract base class for all industry experts
 * Provides common functionality for intent processing, caching, and metrics
 */

import { v4 as uuidv4 } from 'uuid';
import {
  IExpert,
  IExpertRegistry,
  IExpertFactory
} from '../interfaces/IExpert';
import {
  IIntent,
  IntentPriority,
  IntentStatus
} from '../interfaces/IIntent';
import {
  IResponse,
  ResponseType,
  ResponseFormat,
  ResponseConfidence,
  ResponseContext,
  ResponseAction,
  SuggestedFollowUp,
  ResponseError
} from '../interfaces/IResponse';
import {
  ExpertConfig,
  ExpertCapability,
  ExpertMetrics,
  ExpertState,
  ExpertiseLevel
} from '../types/expert.types';
import { SystemPromptGenerator } from './SystemPrompt';
import { ToneEngine } from './ToneEngine';
import { KnowledgeBase } from './KnowledgeBase';
import { WorkflowService } from '../services/workflowService';
import { RecommendationService } from '../services/recommendationService';
import { Logger } from '../utils/logger';

export abstract class ExpertAgent implements IExpert {
  protected readonly expertId: string;
  protected readonly name: string;
  protected readonly industry: string;
  protected readonly version: string;
  protected readonly config: ExpertConfig;

  protected state: ExpertState;
  protected metrics: ExpertMetrics;
  protected systemPromptGenerator: SystemPromptGenerator;
  protected toneEngine: ToneEngine;
  protected knowledgeBase: KnowledgeBase;
  protected workflowService: WorkflowService;
  protected recommendationService: RecommendationService;
  protected logger: Logger;

  constructor(config: ExpertConfig, logger: Logger) {
    this.expertId = config.expertId;
    this.name = config.name;
    this.industry = config.industry;
    this.version = config.version;
    this.config = config;

    this.state = {
      expertId: config.expertId,
      status: 'initializing',
      currentRequests: 0,
      metrics: this.initMetrics()
    };
    this.metrics = this.initMetrics();

    this.logger = logger;
    this.systemPromptGenerator = new SystemPromptGenerator(this);
    this.toneEngine = new ToneEngine(config.tone, config.expertiseLevel);
    this.knowledgeBase = new KnowledgeBase(config.knowledgeBase || {
      enabled: true,
      provider: 'redis',
      cacheTtlSeconds: 3600,
      maxResults: 5,
      similarityThreshold: 0.7,
      namespace: `rez:expert:${config.expertId}`
    }, logger);
    this.workflowService = new WorkflowService(config.workflowConfig, logger);
    this.recommendationService = new RecommendationService(config.expertId, logger);
  }

  protected initMetrics(): ExpertMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTimeMs: 0,
      averageConfidence: 0,
      cacheHitRate: 0,
      uptimeSeconds: 0,
      requestsByPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
      requestsByStatus: { pending: 0, processing: 0, completed: 0, failed: 0, escalated: 0 }
    };
  }

  /**
   * Abstract method for expertise-specific intent processing
   * Must be implemented by concrete expert classes
   */
  protected abstract processIntentCore(
    intent: IIntent,
    context: ResponseContext
  ): Promise<{
    content: string;
    confidence: ResponseConfidence;
    actions?: ResponseAction[];
    metadata?: Record<string, unknown>;
  }>;

  /**
   * Abstract method to determine if this expert can handle an intent
   */
  protected abstract canHandleCore(intent: IIntent): boolean;

  /**
   * Initialize the expert agent
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info(`Initializing expert: ${this.expertId}`);
      await this.knowledgeBase.connect();
      this.state.status = 'ready';
      this.logger.info(`Expert ${this.expertId} initialized successfully`);
    } catch (error) {
      this.state.status = 'error';
      this.state.lastError = error instanceof Error ? error.message : 'Unknown initialization error';
      this.logger.error(`Failed to initialize expert ${this.expertId}:`, error);
      throw error;
    }
  }

  /**
   * Process a user intent and return a response
   */
  async processIntent(intent: IIntent): Promise<IResponse> {
    const startTime = Date.now();
    this.state.status = 'processing';
    this.state.currentRequests++;
    this.metrics.totalRequests++;
    this.incrementPriorityMetric(intent.priority);

    try {
      // Update intent status
      intent.updateStatus('processing');

      // Generate context for response
      const responseContext: ResponseContext = {
        expertId: this.expertId,
        expertName: this.name,
        processingTimeMs: 0,
        cacheHit: false
      };

      // Check cache first
      const cachedResponse = await this.knowledgeBase.getCachedResponse(intent.intentId);
      if (cachedResponse) {
        this.metrics.cacheHitRate++;
        responseContext.cacheHit = true;
        this.state.status = 'ready';
        this.state.currentRequests--;
        return this.applyTone(cachedResponse, intent);
      }

      // Process the intent using expertise-specific logic
      const result = await this.processIntentCore(intent, responseContext);

      // Generate follow-up suggestions
      const suggestedFollowUps = await this.recommendationService.generateFollowUps(
        intent,
        result.content
      );

      // Create response
      const response = this.createResponse(
        intent.intentId,
        result.content,
        result.confidence,
        {
          ...responseContext,
          processingTimeMs: Date.now() - startTime,
          modelUsed: this.config.modelConfig?.modelName
        },
        result.actions || [],
        suggestedFollowUps,
        result.metadata
      );

      // Cache the response
      await this.knowledgeBase.cacheResponse(intent.intentId, response);

      // Update metrics
      this.updateSuccessMetrics(responseContext.processingTimeMs, result.confidence);

      // Update intent status
      intent.updateStatus('completed');

      this.state.status = 'ready';
      this.state.currentRequests--;

      return this.applyTone(response, intent);
    } catch (error) {
      this.metrics.failedRequests++;
      this.state.status = 'ready';
      this.state.currentRequests--;
      this.state.lastError = error instanceof Error ? error.message : 'Unknown error';

      const errorResponse = this.createErrorResponse(
        intent.intentId,
        {
          expertId: this.expertId,
          expertName: this.name,
          processingTimeMs: Date.now() - startTime
        },
        {
          code: 'PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'An unknown error occurred',
          recoverable: true
        }
      );

      intent.updateStatus('failed');
      return errorResponse;
    }
  }

  /**
   * Validate if this expert can handle a given intent
   */
  canHandle(intent: IIntent): boolean {
    // First check the domain matches
    if (intent.classification.domain !== this.industry) {
      return false;
    }

    // Then check expertise-specific logic
    return this.canHandleCore(intent);
  }

  /**
   * Get the expert's capabilities
   */
  getCapabilities(): ExpertCapability[] {
    return this.config.capabilities;
  }

  /**
   * Get current metrics and statistics
   */
  async getMetrics(): Promise<ExpertMetrics> {
    return {
      ...this.metrics,
      uptimeSeconds: Math.floor((Date.now() - this.state.metrics.uptimeSeconds) / 1000),
      lastRequestAt: this.state.metrics.lastRequestAt
    };
  }

  /**
   * Update expert configuration
   */
  updateConfig(config: Partial<ExpertConfig>): void {
    Object.assign(this.config, config);
    if (config.tone) {
      this.toneEngine.updateTone(config.tone);
    }
    this.logger.info(`Expert ${this.expertId} config updated`);
  }

  /**
   * Get the system prompt for this expert
   */
  getSystemPrompt(): string {
    return this.systemPromptGenerator.generate();
  }

  /**
   * Health check for the expert service
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latencyMs: number;
    details?: Record<string, unknown>;
  }> {
    const startTime = Date.now();

    try {
      const [dbHealth, cacheHealth] = await Promise.all([
        this.knowledgeBase.healthCheck(),
        Promise.resolve({ healthy: true, latencyMs: 0 })
      ]);

      const latencyMs = Date.now() - startTime;
      const healthy = dbHealth.healthy && cacheHealth.healthy && this.state.status !== 'error';

      return {
        healthy,
        latencyMs,
        details: {
          state: this.state.status,
          currentRequests: this.state.currentRequests,
          database: dbHealth,
          cache: cacheHealth,
          lastError: this.state.lastError
        }
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Shutdown the expert gracefully
   */
  async shutdown(): Promise<void> {
    this.logger.info(`Shutting down expert: ${this.expertId}`);
    this.state.status = 'shutdown';
    await this.knowledgeBase.disconnect();
    this.logger.info(`Expert ${this.expertId} shutdown complete`);
  }

  // Helper methods

  protected createResponse(
    intentId: string,
    content: string,
    confidence: ResponseConfidence,
    context: ResponseContext,
    actions: ResponseAction[],
    suggestedFollowUps: SuggestedFollowUp[],
    metadata: Record<string, unknown> = {}
  ): IResponse {
    return {
      responseId: uuidv4(),
      intentId,
      type: 'text',
      content,
      format: 'markdown',
      confidence,
      context,
      timestamp: new Date().toISOString(),
      actions,
      suggestedFollowUps,
      metadata,
      addAction: function(action: ResponseAction): void {
        this.actions.push(action);
      },
      addFollowUp: function(suggestion: SuggestedFollowUp): void {
        this.suggestedFollowUps.push(suggestion);
      },
      setMetadata: function(key: string, value: unknown): void {
        this.metadata[key] = value;
      },
      getMetadata: function<T = unknown>(key: string): T | undefined {
        return this.metadata[key] as T | undefined;
      },
      toJSON: function(): Record<string, unknown> {
        return { ...this };
      }
    } as IResponse;
  }

  protected createErrorResponse(
    intentId: string,
    context: ResponseContext,
    error: ResponseError
  ): IResponse {
    return {
      responseId: uuidv4(),
      intentId,
      type: 'error',
      content: error.message,
      format: 'plain',
      confidence: 'uncertain',
      context,
      timestamp: new Date().toISOString(),
      actions: [],
      suggestedFollowUps: [],
      error,
      metadata: {},
      addAction: function(_action: ResponseAction): void {
        // No-op for error responses
      },
      addFollowUp: function(_suggestion: SuggestedFollowUp): void {
        // No-op for error responses
      },
      setMetadata: function(_key: string, _value: unknown): void {
        // No-op for error responses
      },
      getMetadata: function<T = unknown>(_key: string): T | undefined {
        return undefined;
      },
      toJSON: function(): Record<string, unknown> {
        return { ...this };
      }
    } as IResponse;
  }

  protected applyTone(response: IResponse, intent: IIntent): IResponse {
    const toneAdjustedContent = this.toneEngine.adjustContent(
      response.content,
      intent.classification.action
    );

    return {
      ...response,
      content: toneAdjustedContent
    };
  }

  protected incrementPriorityMetric(priority: IntentPriority): void {
    this.metrics.requestsByPriority[priority]++;
    this.state.metrics.requestsByPriority[priority]++;
  }

  protected updateSuccessMetrics(responseTimeMs: number, confidence: ResponseConfidence): void {
    const confidenceValue = confidence === 'high' ? 1 : confidence === 'medium' ? 0.7 : confidence === 'low' ? 0.4 : 0.2;

    // Running average calculation
    const n = this.metrics.successfulRequests + 1;
    this.metrics.averageResponseTimeMs =
      (this.metrics.averageResponseTimeMs * (n - 1) + responseTimeMs) / n;
    this.metrics.averageConfidence =
      (this.metrics.averageConfidence * (n - 1) + confidenceValue) / n;
    this.metrics.successfulRequests++;
    this.state.metrics = { ...this.metrics, lastRequestAt: new Date().toISOString() };
  }
}

/**
 * Expert Agent Factory
 * Factory for creating expert agent instances
 */
export class ExpertAgentFactory implements IExpertFactory {
  private experts: Map<string, (config: ExpertConfig) => IExpert> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  createExpert(config: ExpertConfig): IExpert {
    const factory = this.experts.get(config.industry);
    if (!factory) {
      throw new Error(`No factory registered for industry: ${config.industry}`);
    }
    return factory(config);
  }

  registerExpert(industry: string, factory: (config: ExpertConfig) => IExpert): void {
    this.experts.set(industry, factory);
    this.logger.info(`Registered expert factory for industry: ${industry}`);
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.experts.keys());
  }
}

/**
 * Expert Registry
 * Registry for managing multiple expert instances
 */
export class ExpertAgentRegistry implements IExpertRegistry {
  private experts: Map<string, IExpert> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async register(expert: IExpert): Promise<void> {
    this.experts.set(expert.expertId, expert);
    await expert.initialize();
    this.logger.info(`Registered expert: ${expert.expertId}`);
  }

  async unregister(expertId: string): Promise<void> {
    const expert = this.experts.get(expertId);
    if (expert) {
      await expert.shutdown();
      this.experts.delete(expertId);
      this.logger.info(`Unregistered expert: ${expertId}`);
    }
  }

  getExpert(expertId: string): IExpert | undefined {
    return this.experts.get(expertId);
  }

  getExpertsByIndustry(industry: string): IExpert[] {
    return Array.from(this.experts.values()).filter(e => e.industry === industry);
  }

  findBestExpert(intent: IIntent): IExpert | undefined {
    const candidates = this.getExpertsByIndustry(intent.classification.domain);
    if (candidates.length === 0) return undefined;

    return candidates.find(expert => expert.canHandle(intent));
  }

  getAllExperts(): IExpert[] {
    return Array.from(this.experts.values());
  }
}
