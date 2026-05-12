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
}

export interface ProcessingResult {
  response: OrchestrationResponse;
  context: ProcessingContext;
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
    (error as any).code = code;
    return error;
  }

  private createErrorDetails(error: unknown): ErrorDetails {
    if (error instanceof Error) {
      return {
        code: (error as any).code || 'PROCESSING_ERROR',
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
