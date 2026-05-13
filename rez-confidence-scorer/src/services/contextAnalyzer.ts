import { AgentMetrics } from '../models/AgentMetrics';
import { ContextAnalysisResult } from '../types';
import logger from '../utils/logger';

interface ContextInput {
  domain?: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Context Analyzer Service
 *
 * Analyzes the relevance of an agent's capabilities to the given context.
 * Factors include:
 * 1. Domain match between context and agent capabilities
 * 2. Urgency adjustment for time-sensitive tasks
 * 3. Session context continuity
 * 4. Metadata relevance scoring
 */
export class ContextAnalyzerService {
  /**
   * Analyze context relevance for an agent
   */
  async analyzeContext(
    agentId: string,
    context: ContextInput
  ): Promise<ContextAnalysisResult> {
    try {
      // Get agent metrics
      const agent = await AgentMetrics.findOne({ agentId }).lean().exec();

      if (!agent) {
        logger.warn(`Agent not found for context analysis: ${agentId}`);
        return this.createZeroResult('Agent not found');
      }

      const factors = this.computeRelevanceFactors(context, agent.capabilities);

      // Calculate overall score
      const weights = {
        domainMatch: 0.5,
        urgencyAdjustment: 0.3,
        sessionContext: 0.2,
      };

      const score =
        factors.domainMatch * weights.domainMatch +
        factors.urgencyAdjustment * weights.urgencyAdjustment +
        factors.sessionContext * weights.sessionContext;

      return {
        score: Math.min(1, Math.max(0, score)),
        relevanceFactors: factors,
        explanation: this.generateExplanation(factors, agent.capabilities.domains),
      };
    } catch (error) {
      logger.error('Error analyzing context', {
        agentId,
        context,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.createZeroResult('Error analyzing context');
    }
  }

  /**
   * Compute individual relevance factors
   */
  private computeRelevanceFactors(
    context: ContextInput,
    capabilities: { domains: string[]; specializations: string[] }
  ) {
    return {
      domainMatch: this.calculateDomainMatch(context.domain, capabilities),
      urgencyAdjustment: this.calculateUrgencyAdjustment(context.urgency, capabilities),
      sessionContext: this.calculateSessionContext(context.sessionId, context.userId),
    };
  }

  /**
   * Calculate domain match score
   */
  private calculateDomainMatch(
    contextDomain: string | undefined,
    capabilities: { domains: string[]; specializations: string[] }
  ): number {
    if (!contextDomain) {
      // No specific domain requested - neutral score
      return 0.7;
    }

    const normalizedDomain = contextDomain.toLowerCase();
    const domains = capabilities.domains.map((d) => d.toLowerCase());
    const specializations = capabilities.specializations.map((s) => s.toLowerCase());

    // Check for exact domain match
    if (domains.includes(normalizedDomain)) {
      return 1.0;
    }

    // Check for partial domain match
    for (const domain of domains) {
      if (domain.includes(normalizedDomain) || normalizedDomain.includes(domain)) {
        return 0.85;
      }
    }

    // Check if domain matches any specialization
    for (const spec of specializations) {
      if (spec.includes(normalizedDomain) || normalizedDomain.includes(spec)) {
        return 0.7;
      }
    }

    // No match
    return 0.3;
  }

  /**
   * Calculate urgency adjustment score
   *
   * Certain agents may be better suited for high-urgency tasks
   * based on their response time history and current load.
   */
  private calculateUrgencyAdjustment(
    urgency: 'low' | 'medium' | 'high' | 'critical' | undefined,
    capabilities: { specializations: string[] }
  ): number {
    if (!urgency || urgency === 'medium') {
      return 0.8; // Neutral baseline
    }

    // Check for agents with high-urgency specialization
    const hasUrgentCapability = capabilities.specializations.some(
      (s) =>
        s.toLowerCase().includes('urgent') ||
        s.toLowerCase().includes('priority') ||
        s.toLowerCase().includes('realtime')
    );

    switch (urgency) {
      case 'low':
        // Low urgency tasks are less sensitive
        return 0.6;

      case 'high':
        // High urgency benefits from capable agents
        return hasUrgentCapability ? 1.0 : 0.75;

      case 'critical':
        // Critical tasks require top performers
        if (hasUrgentCapability) {
          return 1.0;
        }
        // Check for general high-capability indicators
        const isHighCapability =
          capabilities.specializations.length > 3 ||
          capabilities.specializations.some(
            (s) =>
              s.toLowerCase().includes('senior') ||
              s.toLowerCase().includes('expert') ||
              s.toLowerCase().includes('priority')
          );
        return isHighCapability ? 0.9 : 0.7;

      default:
        return 0.8;
    }
  }

  /**
   * Calculate session context score
   *
   * Rewards agents that have been handling the same session,
   * as they have continuity of context.
   */
  private calculateSessionContext(
    sessionId: string | undefined,
    userId: string | undefined
  ): number {
    if (!sessionId && !userId) {
      return 0.5; // No session context available
    }

    // Session continuity would typically involve checking historical data
    // For now, we give a baseline score and note this would be enhanced
    // with session history tracking

    if (sessionId) {
      // Fresh session - moderate continuity expected
      return 0.7;
    }

    if (userId) {
      // User-level context available
      return 0.65;
    }

    return 0.5;
  }

  /**
   * Generate explanation for the analysis result
   */
  private generateExplanation(
    factors: {
      domainMatch: number;
      urgencyAdjustment: number;
      sessionContext: number;
    },
    agentDomains: string[]
  ): string {
    const parts: string[] = [];

    // Domain match explanation
    if (factors.domainMatch >= 0.85) {
      parts.push('Strong domain alignment.');
    } else if (factors.domainMatch >= 0.5) {
      parts.push('Partial domain match.');
    } else {
      parts.push('Limited domain relevance.');
    }

    // Urgency explanation
    if (factors.urgencyAdjustment >= 0.9) {
      parts.push('Highly suitable for urgency level.');
    } else if (factors.urgencyAdjustment >= 0.7) {
      parts.push('Adequately handles urgency requirements.');
    } else {
      parts.push('May not be optimal for urgency requirements.');
    }

    // Context explanation
    if (factors.sessionContext >= 0.6) {
      parts.push('Good session continuity.');
    } else {
      parts.push('Limited session history.');
    }

    parts.push(`Agent domains: ${agentDomains.slice(0, 3).join(', ')}${agentDomains.length > 3 ? '...' : ''}`);

    return parts.join(' ');
  }

  /**
   * Create zero-score result
   */
  private createZeroResult(reason: string): ContextAnalysisResult {
    return {
      score: 0,
      relevanceFactors: {
        domainMatch: 0,
        urgencyAdjustment: 0,
        sessionContext: 0,
      },
      explanation: `No context match: ${reason}`,
    };
  }

  /**
   * Batch analyze context for multiple agents
   */
  async batchAnalyzeContext(
    agentIds: string[],
    context: ContextInput
  ): Promise<Map<string, ContextAnalysisResult>> {
    const results = new Map<string, ContextAnalysisResult>();

    // Process in parallel for efficiency
    const promises = agentIds.map(async (agentId) => {
      const result = await this.analyzeContext(agentId, context);
      results.set(agentId, result);
    });

    await Promise.all(promises);
    return results;
  }
}

export const contextAnalyzerService = new ContextAnalyzerService();
export default contextAnalyzerService;
