/**
 * ExpertiseService - Manages industry-specific expertise
 * Handles expertise retrieval, validation, and matching
 */

import { IIntent, IntentClassification } from '../interfaces/IIntent';
import { IResponse, ResponseConfidence, ResponseAction } from '../interfaces/IResponse';
import { ResponseContext } from '../interfaces/IResponse';
import { ExpertCapability, ExpertiseLevel } from '../types/expert.types';
import { Logger } from '../utils/logger';

export interface ExpertiseMatch {
  capability: ExpertCapability;
  confidence: number;
  relevanceScore: number;
}

export interface ExpertiseQuery {
  intent: IIntent;
  requiredLevel?: ExpertiseLevel;
  maxResults?: number;
}

export interface ExpertiseResult {
  content: string;
  confidence: ResponseConfidence;
  actions: ResponseAction[];
  sources?: string[];
  metadata: Record<string, unknown>;
}

export class ExpertiseService {
  private logger: Logger;
  private capabilities: Map<string, ExpertCapability>;
  private knowledgeMap: Map<string, string>;

  constructor(logger: Logger) {
    this.logger = logger;
    this.capabilities = new Map();
    this.knowledgeMap = new Map();
  }

  /**
   * Register a capability
   */
  registerCapability(domain: string, capability: ExpertCapability): void {
    this.capabilities.set(domain, capability);
    this.logger.info(`Registered capability for domain: ${domain}`);
  }

  /**
   * Get capability for a domain
   */
  getCapability(domain: string): ExpertCapability | undefined {
    return this.capabilities.get(domain);
  }

  /**
   * Get all registered capabilities
   */
  getAllCapabilities(): ExpertCapability[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Match intent to best capability
   */
  matchIntent(intent: IIntent): ExpertiseMatch | null {
    const domain = intent.classification.domain;
    const capability = this.capabilities.get(domain);

    if (!capability) {
      this.logger.debug(`No capability found for domain: ${domain}`);
      return null;
    }

    // Check if the action is supported
    const action = intent.classification.action;
    if (!capability.actions.includes(action)) {
      // Find closest matching action
      const closestAction = this.findClosestAction(action, capability.actions);
      if (!closestAction) {
        return null;
      }
    }

    // Calculate confidence based on entity extraction
    const entityConfidence = intent.classification.entities.length > 0
      ? intent.classification.entities.reduce((sum, e) => sum + e.confidence, 0) / intent.classification.entities.length
      : 0.5;

    const baseConfidence = capability.confidenceRange.min +
      (capability.confidenceRange.max - capability.confidenceRange.min) * entityConfidence;

    return {
      capability,
      confidence: Math.min(baseConfidence, capability.confidenceRange.max),
      relevanceScore: baseConfidence
    };
  }

  /**
   * Process intent with expertise
   */
  async processWithExpertise(query: ExpertiseQuery): Promise<ExpertiseResult> {
    const match = this.matchIntent(query.intent);

    if (!match) {
      return this.generateNotFoundResponse(query.intent);
    }

    const { capability, confidence } = match;
    const confidenceLevel = this.getConfidenceLevel(confidence);

    // Generate response based on capability
    const content = await this.generateExpertiseContent(
      query.intent,
      capability
    );

    // Generate suggested actions
    const actions = this.generateActions(capability, query.intent);

    return {
      content,
      confidence: confidenceLevel,
      actions,
      metadata: {
        domain: capability.domain,
        expertiseLevel: capability.actions,
        matchConfidence: confidence
      }
    };
  }

  /**
   * Generate expertise-based content
   */
  private async generateExpertiseContent(
    intent: IIntent,
    capability: ExpertCapability
  ): Promise<string> {
    // In a real implementation, this would:
    // 1. Query the knowledge base
    // 2. Use AI model to generate response
    // 3. Combine with structured knowledge

    const action = intent.classification.action;
    const domain = capability.domain;

    // Generate contextual response based on action type
    switch (action) {
      case 'query':
        return this.generateQueryResponse(intent, domain);
      case 'recommend':
        return this.generateRecommendationResponse(intent, domain);
      case 'explain':
        return this.generateExplanationResponse(intent, domain);
      case 'troubleshoot':
        return this.generateTroubleshootingResponse(intent, domain);
      default:
        return this.generateGenericResponse(intent, domain);
    }
  }

  private generateQueryResponse(intent: IIntent, domain: string): string {
    return `Based on my expertise in ${domain}, here is what I can tell you about your query.

Your question regarding "${intent.input}" relates to the ${domain} domain. I have analyzed your intent and can provide guidance based on established ${domain} principles and best practices.

For more specific advice tailored to your situation, please provide additional context.`;
  }

  private generateRecommendationResponse(intent: IIntent, domain: string): string {
    return `In the ${domain} domain, I can offer the following recommendations based on your query.

After analyzing "${intent.input}", I recommend considering the following factors specific to ${domain}:

1. Industry best practices
2. Common pitfalls to avoid
3. Key considerations for your situation

Would you like me to elaborate on any of these recommendations?`;
  }

  private generateExplanationResponse(intent: IIntent, domain: string): string {
    return `Let me explain the ${domain} concept related to your query.

Regarding "${intent.input}":

In ${domain}, this relates to core principles that govern how professionals in this field approach challenges and solutions. Understanding these fundamentals can help you make more informed decisions.

Shall I provide more detailed explanations or examples?`;
  }

  private generateTroubleshootingResponse(intent: IIntent, domain: string): string {
    return `I'm here to help troubleshoot your ${domain} issue.

Based on "${intent.input}", let me walk you through some diagnostic steps:

Step 1: Identify the symptoms
Step 2: Check common causes
Step 3: Review recent changes
Step 4: Test potential solutions

What specific symptoms are you experiencing?`;
  }

  private generateGenericResponse(intent: IIntent, domain: string): string {
    return `As an expert in ${domain}, I'm ready to assist with your query.

Regarding "${intent.input}", I'm here to provide guidance based on my knowledge and experience in this field.

How can I help you further?`;
  }

  private generateNotFoundResponse(intent: IIntent): ExpertiseResult {
    return {
      content: `I don't have specific expertise in the area of "${intent.classification.domain}" related to "${intent.input}".

I can help with general queries, but for specialized assistance in this domain, I recommend consulting with a domain-specific expert.

Would you like me to help with something else?`,
      confidence: 'uncertain',
      actions: [
        {
          type: 'escalate',
          payload: {
            reason: 'No matching expertise',
            domain: intent.classification.domain
          },
          label: 'Escalate to Specialist'
        }
      ],
      metadata: {
        handled: false,
        reason: 'No matching capability'
      }
    };
  }

  private generateActions(
    capability: ExpertCapability,
    intent: IIntent
  ): ResponseAction[] {
    const actions: ResponseAction[] = [];

    for (const actionType of capability.actions) {
      actions.push({
        type: actionType,
        payload: {
          domain: capability.domain,
          intentId: intent.intentId
        },
        label: `Perform ${actionType}`
      });
    }

    return actions;
  }

  private getConfidenceLevel(confidence: number): ResponseConfidence {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.5) return 'medium';
    if (confidence >= 0.3) return 'low';
    return 'uncertain';
  }

  private findClosestAction(
    target: string,
    actions: string[]
  ): string | undefined {
    // Simple similarity matching
    const targetLower = target.toLowerCase();

    for (const action of actions) {
      if (action.toLowerCase().includes(targetLower) ||
          targetLower.includes(action.toLowerCase())) {
        return action;
      }
    }

    // Check for common action prefixes
    const prefixes = ['get', 'set', 'update', 'delete', 'create', 'find', 'list'];
    for (const prefix of prefixes) {
      if (targetLower.startsWith(prefix)) {
        const rest = targetLower.slice(prefix.length);
        for (const action of actions) {
          if (action.toLowerCase().startsWith(prefix) &&
              action.toLowerCase().includes(rest)) {
            return action;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Validate intent against capabilities
   */
  validateIntent(intent: IIntent): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!intent.classification.domain) {
      errors.push('Missing domain in intent classification');
    }

    if (!intent.classification.action) {
      errors.push('Missing action in intent classification');
    }

    if (intent.classification.confidence < 0.3) {
      warnings.push('Low confidence in intent classification');
    }

    const match = this.matchIntent(intent);
    if (!match) {
      warnings.push('No matching capability found for intent');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
