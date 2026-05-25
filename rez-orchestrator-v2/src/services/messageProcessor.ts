import { v4 as uuidv4 } from 'uuid';
import {
  OrchestrationRequest,
  ProcessedOrchestrationRequest,
  processOrchestrationRequest,
} from '../models/OrchestrationRequest';
import {
  OrchestrationResponse,
  OrchestrationResponseBuilder,
  ResponseStatus,
} from '../models/OrchestrationResponse';
import { AgentRegistry, AgentInfo } from './agentRegistry';
import { ExpertSelector } from './expertSelector';
import { AgentSwitcher } from './agentSwitcher';
import { CollaborationManager } from './collaborationManager';
import { EscalationService } from './escalationService';
import { ResponseGenerator } from './responseGenerator';
import { appConfig } from '../config';
import { logger } from '../utils/logger';
import { ErrorDetails } from '../models/OrchestrationResponse';

// Service URLs with environment variable overrides
const CONTEXT_ENGINE_URL = process.env.CONTEXT_ENGINE_URL || 'http://localhost:4071';
const CORE_BRAIN_URL = process.env.CORE_BRAIN_URL || 'http://localhost:4072';

/**
 * External service client for making HTTP requests
 */
async function fetchFromService<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000
): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '',
        'X-Service-Name': 'rez-orchestrator',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn(`Service request failed: ${url}`, { status: response.status });
      return null;
    }

    return await response.json() as T;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn(`Service request timeout: ${url}`);
    } else {
      logger.warn(`Service request failed: ${url}`, { error });
    }
    return null;
  }
}

export interface ProcessingContext {
  requestId: string;
  startTime: number;
  agentSelectionStartTime?: number;
  collaborationStartTime?: number;
  responseGenerationStartTime?: number;
  retries: number;
  selectedAgent?: AgentInfo;
  fallbackAgent?: AgentInfo;
  warnings: string[];
  // External service context
  contextEngineData?: Record<string, unknown>;
  userContext?: Record<string, unknown>;
  personalization?: Record<string, unknown>;
  enrichedContext?: Record<string, unknown>;
}

export interface ProcessingResult {
  response: OrchestrationResponse;
  context: ProcessingContext;
}

/**
 * Enriched context from external services
 */
export interface EnrichedContext {
  sessionId?: string;
  merchantId?: string;
  entryPoint?: string;
  userId?: string;
  contextEngineData: Record<string, unknown>;
  userContext: Record<string, unknown>;
  personalization: Record<string, unknown>;
}

export class MessageProcessor {
  private agentRegistry: AgentRegistry;
  private expertSelector: ExpertSelector;
  private agentSwitcher: AgentSwitcher;
  private collaborationManager: CollaborationManager;
  private escalationService: EscalationService;
  private responseGenerator: ResponseGenerator;

  constructor(
    agentRegistry: AgentRegistry,
    expertSelector: ExpertSelector,
    agentSwitcher: AgentSwitcher,
    collaborationManager: CollaborationManager,
    escalationService: EscalationService,
    responseGenerator: ResponseGenerator
  ) {
    this.agentRegistry = agentRegistry;
    this.expertSelector = expertSelector;
    this.agentSwitcher = agentSwitcher;
    this.collaborationManager = collaborationManager;
    this.escalationService = escalationService;
    this.responseGenerator = responseGenerator;
  }

  async processMessage(
    request: OrchestrationRequest,
    requestContext?: Record<string, unknown>
  ): Promise<ProcessingResult> {
    const processedRequest = processOrchestrationRequest(request);
    const context: ProcessingContext = {
      requestId: processedRequest.requestId,
      startTime: Date.now(),
      retries: 0,
      warnings: [],
    };

    logger.info('Processing orchestration request', {
      requestId: processedRequest.requestId,
      messageLength: processedRequest.message.length,
      hasRoutingHints: !!processedRequest.routingHints,
    });

    try {
      // Step 0: Enrich context from external services (Context Engine and Core Brain)
      const enrichedContext = await this.enrichContextFromExternalServices(processedRequest, requestContext);
      context.contextEngineData = enrichedContext.contextEngineData;
      context.userContext = enrichedContext.userContext;
      context.personalization = enrichedContext.personalization;
      context.enrichedContext = enrichedContext.contextEngineData; // Backward compatibility

      // Step 1: Select the best agent(s)
      context.agentSelectionStartTime = Date.now();
      const agentSelectionResult = await this.expertSelector.selectAgent(processedRequest);

      if (!agentSelectionResult.selectedAgent) {
        throw this.createError('NO_AGENT_AVAILABLE', 'No suitable agent found for this request');
      }

      context.selectedAgent = agentSelectionResult.selectedAgent;
      context.fallbackAgent = agentSelectionResult.fallbackAgent;

      if (agentSelectionResult.warnings.length > 0) {
        context.warnings.push(...agentSelectionResult.warnings);
      }

      // Step 2: Determine if collaboration is needed
      const collaborationMode = processedRequest.routingHints?.collaborationMode || 'single';
      const requiresCollaboration = collaborationMode === 'collaborative' ||
        await this.collaborationManager.shouldCollaborate(processedRequest);

      let response: OrchestrationResponse;

      if (requiresCollaboration) {
        response = await this.processWithCollaboration(processedRequest, context);
      } else {
        response = await this.processWithSingleAgent(processedRequest, context);
      }

      return { response, context };
    } catch (error) {
      return this.handleProcessingError(error, processedRequest, context);
    }
  }

  /**
   * Enrich request context by calling external services:
   * - Context Engine: Provides session, merchant, and entry point context
   * - Core Brain: Provides user memory and personalization data
   */
  private async enrichContextFromExternalServices(
    request: ProcessedOrchestrationRequest,
    requestContext?: Record<string, unknown>
  ): Promise<{
    contextEngineData: Record<string, unknown>;
    userContext: Record<string, unknown>;
    personalization: Record<string, unknown>;
  }> {
    const sessionId = request.sessionId || (requestContext?.sessionId as string);
    const merchantId = request.merchantId || (requestContext?.merchantId as string);
    const userId = request.userId || (requestContext?.userId as string);
    const entryPoint = request.routingHints?.entryPoint || (requestContext?.entryPoint as string);

    // Parallel calls to external services for better latency
    const [contextEngineResult, coreBrainMemoryResult, coreBrainPersonalizationResult] = await Promise.allSettled([
      // Call Context Engine for session/merchant context
      sessionId || merchantId || entryPoint
        ? this.fetchContextEngineContext({ sessionId, merchantId, entryPoint })
        : Promise.resolve({}),

      // Call Core Brain for user memory/context
      userId
        ? this.fetchCoreBrainMemory(userId)
        : Promise.resolve({}),

      // Call Core Brain for personalization
      userId
        ? this.fetchCoreBrainPersonalization(userId)
        : Promise.resolve({}),
    ]);

    const contextEngineData = contextEngineResult.status === 'fulfilled'
      ? (contextEngineResult.value as Record<string, unknown>) || {}
      : {};

    const userContext = coreBrainMemoryResult.status === 'fulfilled'
      ? (coreBrainMemoryResult.value as Record<string, unknown>) || {}
      : {};

    const personalization = coreBrainPersonalizationResult.status === 'fulfilled'
      ? (coreBrainPersonalizationResult.value as Record<string, unknown>) || {}
      : {};

    // Log enrichment results
    logger.info('Context enrichment completed', {
      requestId: request.requestId,
      hasContextEngine: Object.keys(contextEngineData).length > 0,
      hasUserContext: Object.keys(userContext).length > 0,
      hasPersonalization: Object.keys(personalization).length > 0,
    });

    return { contextEngineData, userContext, personalization };
  }

  /**
   * Call Context Engine to get session/merchant context
   */
  private async fetchContextEngineContext(params: {
    sessionId?: string;
    merchantId?: string;
    entryPoint?: string;
  }): Promise<Record<string, unknown>> {
    const url = `${CONTEXT_ENGINE_URL}/api/context`;

    const result = await fetchFromService<{ success: boolean; data?: Record<string, unknown> }>(
      url,
      {
        method: 'POST',
        body: JSON.stringify({
          sessionId: params.sessionId,
          merchantId: params.merchantId,
          entryPoint: params.entryPoint,
        }),
      }
    );

    if (result && typeof result === 'object' && 'data' in result) {
      return (result as { data: Record<string, unknown> }).data;
    }

    return result || {};
  }

  /**
   * Call Core Brain to get user memory/context
   */
  private async fetchCoreBrainMemory(userId: string): Promise<Record<string, unknown>> {
    const url = `${CORE_BRAIN_URL}/internal/memory?userId=${encodeURIComponent(userId)}&limit=10`;

    const result = await fetchFromService<{ success: boolean; data?: Record<string, unknown> }>(
      url,
      { method: 'GET' }
    );

    if (result && typeof result === 'object' && 'data' in result) {
      return (result as { data: Record<string, unknown> }).data;
    }

    return result || {};
  }

  /**
   * Call Core Brain to get user personalization data
   */
  private async fetchCoreBrainPersonalization(userId: string): Promise<Record<string, unknown>> {
    const url = `${CORE_BRAIN_URL}/internal/personalization/intelligence?userId=${encodeURIComponent(userId)}`;

    const result = await fetchFromService<{ success: boolean; data?: Record<string, unknown> }>(
      url,
      { method: 'GET' }
    );

    if (result && typeof result === 'object' && 'data' in result) {
      return (result as { data: Record<string, unknown> }).data;
    }

    return result || {};
  }

  private async processWithSingleAgent(
    request: ProcessedOrchestrationRequest,
    context: ProcessingContext
  ): Promise<OrchestrationResponse> {
    const builder = new OrchestrationResponseBuilder(context.requestId);
    const agent = context.selectedAgent!;

    try {
      await this.agentRegistry.updateAgentStatus(agent.agentId, 'busy');

      const agentResponse = await this.agentSwitcher.routeToAgent(
        agent,
        request,
        context
      );

      const responseTimeMs = Date.now() - (context.agentSelectionStartTime || context.startTime);

      await this.agentRegistry.recordRequest(agent.agentId, true, responseTimeMs);
      await this.agentRegistry.updateAgentStatus(agent.agentId, 'idle');

      builder
        .setStatus('success')
        .setPrimaryResponse(agentResponse.content, agentResponse.format)
        .addAttribution({
          agentId: agent.agentId,
          agentName: agent.name,
          capabilities: agent.capabilities,
          confidence: 1.0,
          processingTimeMs: responseTimeMs,
          isFallback: agent === context.fallbackAgent,
        })
        .setCollaboration(1, 'single')
        .setTiming({
          totalProcessingTimeMs: Date.now() - context.startTime,
          agentSelectionTimeMs: context.agentSelectionStartTime
            ? context.agentSelectionStartTime - context.startTime
            : 0,
          responseGenerationTimeMs: Date.now() - (context.responseGenerationStartTime || context.startTime),
        });

      if (context.warnings.length > 0) {
        builder.setWarnings(context.warnings);
      }

      return builder.build();
    } catch (error) {
      await this.agentRegistry.updateAgentStatus(agent.agentId, 'idle');
      throw error;
    }
  }

  private async processWithCollaboration(
    request: ProcessedOrchestrationRequest,
    context: ProcessingContext
  ): Promise<OrchestrationResponse> {
    const builder = new OrchestrationResponseBuilder(context.requestId);
    context.collaborationStartTime = Date.now();

    try {
      const collaborationResult = await this.collaborationManager.orchestrate(
        request,
        context
      );

      const totalTimeMs = Date.now() - context.startTime;
      const agentSelectionTimeMs = context.agentSelectionStartTime
        ? context.agentSelectionStartTime - context.startTime
        : 0;
      const collaborationTimeMs = context.collaborationStartTime
        ? Date.now() - context.collaborationStartTime
        : 0;

      builder
        .setStatus(collaborationResult.success ? 'success' : 'partial')
        .setPrimaryResponse(
          collaborationResult.synthesis?.synthesizedContent || '',
          'text'
        )
        .setCollaboration(
          collaborationResult.participants.length,
          collaborationResult.strategy
        )
        .setTiming({
          totalProcessingTimeMs: totalTimeMs,
          agentSelectionTimeMs,
          collaborationTimeMs,
        });

      // Add attributions for all participants
      for (const participant of collaborationResult.participants) {
        if (participant.status === 'completed') {
          builder.addAttribution({
            agentId: participant.agentId,
            agentName: participant.agentName,
            capabilities: participant.capabilities,
            confidence: participant.confidence || 1.0,
            processingTimeMs: participant.processingTimeMs || 0,
            isFallback: false,
          });
        }
      }

      if (context.warnings.length > 0) {
        builder.setWarnings(context.warnings);
      }

      return builder.build();
    } catch (error) {
      throw error;
    }
  }

  private handleProcessingError(
    error: unknown,
    request: ProcessedOrchestrationRequest,
    context: ProcessingContext
  ): ProcessingResult {
    const builder = new OrchestrationResponseBuilder(context.requestId);

    const errorDetails = this.createErrorDetails(error);
    const maxRetries = request.options?.maxRetries || 3;

    logger.error('Error processing orchestration request', {
      requestId: context.requestId,
      error: errorDetails,
      retries: context.retries,
    });

    // Check if we should retry with fallback
    if (context.retries < maxRetries && errorDetails.recoverable) {
      if (context.fallbackAgent && context.selectedAgent !== context.fallbackAgent) {
        context.retries++;
        context.selectedAgent = context.fallbackAgent;
        context.warnings.push(`Retrying with fallback agent: ${context.fallbackAgent.name}`);

        // Retry logic would go here
      }
    }

    // Check if we should escalate
    if (context.retries >= maxRetries || !errorDetails.recoverable) {
      builder.setStatus('escalated');
      this.escalationService.escalate(request, errorDetails).catch((err) => {
        logger.error('Failed to escalate', { requestId: context.requestId, error: err });
      });
    }

    builder
      .setStatus('failed')
      .setPrimaryResponse(
        `Failed to process request: ${errorDetails.message}`,
        'text'
      )
      .setError(errorDetails)
      .setTiming({
        totalProcessingTimeMs: Date.now() - context.startTime,
      })
      .setRetryCount(context.retries);

    if (context.warnings.length > 0) {
      builder.setWarnings(context.warnings);
    }

    return { response: builder.build(), context };
  }

  private createError(code: string, message: string): Error {
    const error = new Error(message);
    (error as unknown).code = code;
    return error;
  }

  private createErrorDetails(error: unknown): ErrorDetails {
    if (error instanceof Error) {
      return {
        code: (error as unknown).code || 'PROCESSING_ERROR',
        message: error.message,
        details: { stack: error.stack },
        recoverable: true,
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      recoverable: false,
    };
  }
}

export const createMessageProcessor = (
  agentRegistry: AgentRegistry,
  expertSelector: ExpertSelector,
  agentSwitcher: AgentSwitcher,
  collaborationManager: CollaborationManager,
  escalationService: EscalationService,
  responseGenerator: ResponseGenerator
): MessageProcessor => {
  return new MessageProcessor(
    agentRegistry,
    expertSelector,
    agentSwitcher,
    collaborationManager,
    escalationService,
    responseGenerator
  );
};
