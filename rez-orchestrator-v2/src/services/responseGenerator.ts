import {
  OrchestrationResponse,
  OrchestrationResponseBuilder,
  AgentAttribution,
} from '../models/OrchestrationResponse';
import { CollaborationResult, SynthesisResult } from '../models/CollaborationDetails';
import { ProcessingContext } from './messageProcessor';
import { logger } from '../utils/logger.js';

export interface GeneratedResponse {
  content: string;
  format: 'text' | 'json' | 'html' | 'markdown' | 'code';
  metadata?: Record<string, unknown>;
}

export class ResponseGenerator {
  constructor() {
    // No dependencies needed
  }

  generateFromSingleAgent(
    agentResponse: string,
    agent: AgentAttribution,
    context: ProcessingContext
  ): OrchestrationResponse {
    const builder = new OrchestrationResponseBuilder(context.requestId);

    builder
      .setStatus('success')
      .setPrimaryResponse(agentResponse, 'text')
      .addAttribution(agent)
      .setCollaboration(1, 'single')
      .setTiming({
        totalProcessingTimeMs: Date.now() - context.startTime,
        agentSelectionTimeMs: context.agentSelectionStartTime
          ? context.agentSelectionStartTime - context.startTime
          : undefined,
        responseGenerationTimeMs: Date.now() - (context.responseGenerationStartTime || context.startTime),
      });

    if (context.warnings.length > 0) {
      builder.setWarnings(context.warnings);
    }

    return builder.build();
  }

  generateFromCollaboration(
    collaborationResult: CollaborationResult,
    context: ProcessingContext
  ): OrchestrationResponse {
    const builder = new OrchestrationResponseBuilder(context.requestId);

    const status = collaborationResult.success ? 'success' : 'partial';

    builder
      .setStatus(status)
      .setCollaboration(
        collaborationResult.participants.length,
        collaborationResult.strategy
      )
      .setTiming({
        totalProcessingTimeMs: Date.now() - context.startTime,
        agentSelectionTimeMs: context.agentSelectionStartTime
          ? context.agentSelectionStartTime - context.startTime
          : undefined,
        collaborationTimeMs: context.collaborationStartTime
          ? Date.now() - context.collaborationStartTime
          : undefined,
        responseGenerationTimeMs: Date.now() - (context.responseGenerationStartTime || context.startTime),
      });

    // Add all participant attributions
    for (const participant of collaborationResult.participants) {
      if (participant.status === 'completed' && participant.contribution) {
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

    // Set synthesized content if available
    if (collaborationResult.synthesis) {
      builder.setPrimaryResponse(
        collaborationResult.synthesis.synthesizedContent,
        'text'
      );
    }

    // Add warnings if task completion rate is low
    if (collaborationResult.taskCompletionRate < 0.75) {
      builder.setWarnings([
        `Only ${(collaborationResult.taskCompletionRate * 100).toFixed(0)}% of tasks completed successfully`,
      ]);
    }

    return builder.build();
  }

  generateErrorResponse(
    error: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
    },
    context: ProcessingContext
  ): OrchestrationResponse {
    const builder = new OrchestrationResponseBuilder(context.requestId);

    builder
      .setStatus('failed')
      .setPrimaryResponse(
        `Failed to process request: ${error.message}`,
        'text'
      )
      .setError({
        code: error.code,
        message: error.message,
        details: error.details,
        recoverable: true,
        agentsAttempted: context.selectedAgent
          ? [context.selectedAgent.agentId]
          : undefined,
      })
      .setTiming({
        totalProcessingTimeMs: Date.now() - context.startTime,
      })
      .setRetryCount(context.retries);

    if (context.warnings.length > 0) {
      builder.setWarnings(context.warnings);
    }

    return builder.build();
  }

  generateTimeoutResponse(context: ProcessingContext): OrchestrationResponse {
    const builder = new OrchestrationResponseBuilder(context.requestId);

    builder
      .setStatus('timeout')
      .setPrimaryResponse(
        'Request timed out. Please try again or contact support.',
        'text'
      )
      .setError({
        code: 'TIMEOUT',
        message: 'Request processing exceeded maximum allowed time',
        recoverable: true,
      })
      .setTiming({
        totalProcessingTimeMs: Date.now() - context.startTime,
      });

    return builder.build();
  }

  formatResponse(
    response: OrchestrationResponse,
    format: 'text' | 'json' | 'html' | 'markdown'
  ): string {
    switch (format) {
      case 'json':
        return JSON.stringify(response, null, 2);

      case 'html':
        return this.generateHtml(response);

      case 'markdown':
        return this.generateMarkdown(response);

      case 'text':
      default:
        return this.generateText(response);
    }
  }

  private generateText(response: OrchestrationResponse): string {
    let output = response.primaryResponse.content;

    if (response.attribution.length > 1) {
      output += '\n\n---\nProcessed by: ';
      output += response.attribution.map(a => a.agentName).join(', ');
    }

    return output;
  }

  private generateMarkdown(response: OrchestrationResponse): string {
    let output = `## Response\n\n${response.primaryResponse.content}\n\n`;

    if (response.attribution.length > 0) {
      output += '### Attribution\n\n';
      for (const attr of response.attribution) {
        output += `- **${attr.agentName}** (${attr.processingTimeMs}ms)\n`;
      }
      output += '\n';
    }

    output += `**Processing Time:** ${response.timing.totalProcessingTimeMs}ms\n`;

    if (response.warnings && response.warnings.length > 0) {
      output += '\n### Warnings\n\n';
      for (const warning of response.warnings) {
        output += `- ${warning}\n`;
      }
    }

    return output;
  }

  private generateHtml(response: OrchestrationResponse): string {
    const attributionList = response.attribution
      .map(a => `<li><strong>${a.agentName}</strong> - ${a.processingTimeMs}ms</li>`)
      .join('');

    const warningList = response.warnings
      ? response.warnings.map(w => `<li>${w}</li>`).join('')
      : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <title>REZ Orchestrator Response</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .content { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .meta { color: #666; font-size: 14px; }
    .attribution { margin-top: 20px; }
    .warnings { background: #fff3cd; padding: 10px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="content">
    <p>${response.primaryResponse.content.replace(/\n/g, '<br>')}</p>
  </div>
  <div class="meta">
    <p><strong>Processing Time:</strong> ${response.timing.totalProcessingTimeMs}ms</p>
    <p><strong>Status:</strong> ${response.status}</p>
  </div>
  ${response.attribution.length > 0 ? `
  <div class="attribution">
    <h3>Attribution</h3>
    <ul>${attributionList}</ul>
  </div>
  ` : ''}
  ${warningList ? `
  <div class="warnings">
    <h3>Warnings</h3>
    <ul>${warningList}</ul>
  </div>
  ` : ''}
</body>
</html>
    `.trim();
  }

  mergeAgentResponses(
    responses: Array<{ agentId: string; content: string; confidence: number }>
  ): string {
    if (responses.length === 0) {
      return 'No responses received';
    }

    if (responses.length === 1) {
      return responses[0].content;
    }

    // Sort by confidence
    responses.sort((a, b) => b.confidence - a.confidence);

    // Merge with confidence weighting
    const highConfidenceContent = responses[0].content;
    const lowConfidenceContent = responses
      .slice(1)
      .map(r => `[From ${r.agentId}]: ${r.content}`)
      .join('\n\n');

    return `${highConfidenceContent}\n\n---\nAdditional insights:\n${lowConfidenceContent}`;
  }
}

export const createResponseGenerator = (): ResponseGenerator => {
  return new ResponseGenerator();
};
