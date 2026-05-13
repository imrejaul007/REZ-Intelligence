import { AgentMetrics } from '../models/AgentMetrics';
import { IntentMatchResult, AgentCapabilities } from '../types';
import logger from '../utils/logger';

/**
 * Intent Matcher Service
 *
 * Calculates how well an agent's capabilities match a given intent.
 * Uses multiple matching strategies:
 * 1. Exact capability match
 * 2. Semantic similarity (via keyword overlap)
 * 3. Domain alignment
 * 4. Specialization bonus
 */
export class IntentMatcherService {
  /**
   * Calculate intent match score for an agent
   */
  async calculateMatch(
    agentId: string,
    intent: string,
    requiredCapabilities?: string[]
  ): Promise<IntentMatchResult> {
    try {
      // Get agent metrics
      const agent = await AgentMetrics.findOne({ agentId }).lean().exec();

      if (!agent) {
        logger.warn(`Agent not found for intent matching: ${agentId}`);
        return this.createZeroScoreResult('Agent not found');
      }

      if (agent.status !== 'active') {
        return this.createZeroScoreResult(`Agent status is ${agent.status}`);
      }

      const capabilities = agent.capabilities;
      const score = this.computeMatchScore(intent, capabilities, requiredCapabilities);
      const { matched, unmatched } = this.getMatchedCapabilities(
        intent,
        capabilities,
        requiredCapabilities
      );

      return {
        score,
        matchedCapabilities: matched,
        unmatchedCapabilities: unmatched,
        confidenceLevel: this.getConfidenceLevel(score),
        explanation: this.generateExplanation(score, matched, unmatched, capabilities),
      };
    } catch (error) {
      logger.error('Error calculating intent match', {
        agentId,
        intent,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.createZeroScoreResult('Error calculating match');
    }
  }

  /**
   * Compute overall match score
   */
  private computeMatchScore(
    intent: string,
    capabilities: AgentCapabilities,
    requiredCapabilities?: string[]
  ): number {
    let score = 0;
    const weights = {
      capability: 0.4,
      domain: 0.3,
      specialization: 0.2,
      required: 0.1,
    };

    // 1. Capability matching (40%)
    const intentKeywords = this.extractKeywords(intent);
    const capabilityScore = this.calculateKeywordOverlap(
      intentKeywords,
      capabilities.specializations
    );
    score += capabilityScore * weights.capability;

    // 2. Domain matching (30%)
    const domainScore = this.calculateDomainMatch(intentKeywords, capabilities.domains);
    score += domainScore * weights.domain;

    // 3. Specialization bonus (20%)
    const specializationScore = this.calculateSpecializationBonus(
      intent,
      capabilities.specializations
    );
    score += specializationScore * weights.specialization;

    // 4. Required capabilities (10%)
    if (requiredCapabilities && requiredCapabilities.length > 0) {
      const requiredScore = this.calculateRequiredCapabilitiesScore(
        requiredCapabilities,
        capabilities
      );
      score += requiredScore * weights.required;
    }

    // Normalize to 0-1 range
    return Math.min(1, Math.max(0, score));
  }

  /**
   * Extract keywords from intent string
   */
  private extractKeywords(intent: string): string[] {
    // Normalize and split intent into words
    const normalized = intent
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2);

    // Remove common stop words
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
      'her', 'was', 'one', 'our', 'out', 'has', 'have', 'had', 'was',
      'this', 'that', 'with', 'from', 'they', 'been', 'were', 'what',
    ]);

    return normalized.filter((word) => !stopWords.has(word));
  }

  /**
   * Calculate keyword overlap score
   */
  private calculateKeywordOverlap(
    intentKeywords: string[],
    capabilities: string[]
  ): number {
    if (intentKeywords.length === 0) return 0.5; // Neutral score for no keywords

    const capabilitySet = new Set(capabilities.map((c) => c.toLowerCase()));
    let matches = 0;

    for (const keyword of intentKeywords) {
      // Exact match
      if (capabilitySet.has(keyword)) {
        matches += 1;
        continue;
      }

      // Partial match (keyword contained in capability or vice versa)
      for (const cap of capabilitySet) {
        if (cap.includes(keyword) || keyword.includes(cap)) {
          matches += 0.5;
          break;
        }
      }
    }

    return matches / intentKeywords.length;
  }

  /**
   * Calculate domain match score
   */
  private calculateDomainMatch(
    intentKeywords: string[],
    domains: string[]
  ): number {
    if (domains.length === 0) return 0;

    const domainSet = new Set(domains.map((d) => d.toLowerCase()));
    let matches = 0;

    for (const keyword of intentKeywords) {
      for (const domain of domainSet) {
        if (domain.includes(keyword) || keyword.includes(domain)) {
          matches += 1;
          break;
        }
      }
    }

    // Score based on coverage
    return Math.min(1, matches / Math.max(1, intentKeywords.length));
  }

  /**
   * Calculate specialization bonus
   */
  private calculateSpecializationBonus(
    intent: string,
    specializations: string[]
  ): number {
    if (specializations.length === 0) return 0;

    const normalizedIntent = intent.toLowerCase();
    let maxMatch = 0;

    for (const spec of specializations) {
      const normalizedSpec = spec.toLowerCase();

      // Check for exact containment
      if (normalizedIntent.includes(normalizedSpec)) {
        maxMatch = Math.max(maxMatch, 0.8 + 0.2 * (normalizedSpec.length / normalizedIntent.length));
        continue;
      }

      // Check for word overlap
      const specWords = new Set(normalizedSpec.split(/\s+/));
      const intentWords = new Set(normalizedIntent.split(/\s+/));

      let overlap = 0;
      for (const word of specWords) {
        if (intentWords.has(word) || intentWords.has(word.slice(0, -1))) {
          overlap += 1;
        }
      }

      if (specWords.size > 0) {
        maxMatch = Math.max(maxMatch, overlap / specWords.size);
      }
    }

    return maxMatch;
  }

  /**
   * Calculate required capabilities score
   */
  private calculateRequiredCapabilitiesScore(
    required: string[],
    capabilities: AgentCapabilities
  ): number {
    if (required.length === 0) return 1;

    const allCapabilities = [
      ...capabilities.domains,
      ...capabilities.specializations,
    ].map((c) => c.toLowerCase());

    const capabilitySet = new Set(allCapabilities);
    let matched = 0;

    for (const req of required) {
      const normalizedReq = req.toLowerCase();
      if (capabilitySet.has(normalizedReq)) {
        matched += 1;
      } else {
        // Check for partial match
        for (const cap of capabilitySet) {
          if (cap.includes(normalizedReq) || normalizedReq.includes(cap)) {
            matched += 0.5;
            break;
          }
        }
      }
    }

    return matched / required.length;
  }

  /**
   * Get matched and unmatched capabilities
   */
  private getMatchedCapabilities(
    intent: string,
    capabilities: AgentCapabilities,
    requiredCapabilities?: string[]
  ): { matched: string[]; unmatched: string[] } {
    const intentKeywords = this.extractKeywords(intent);
    const matched: string[] = [];
    const unmatched: string[] = [];

    const allCapabilities = [
      ...capabilities.domains,
      ...capabilities.specializations,
    ];

    for (const keyword of intentKeywords) {
      let found = false;
      for (const cap of allCapabilities) {
        const normalizedCap = cap.toLowerCase();
        if (
          normalizedCap.includes(keyword) ||
          keyword.includes(normalizedCap)
        ) {
          if (!matched.includes(cap)) {
            matched.push(cap);
          }
          found = true;
        }
      }
      if (!found && keyword.length > 2) {
        unmatched.push(keyword);
      }
    }

    // Check required capabilities
    if (requiredCapabilities) {
      const capSet = new Set(allCapabilities.map((c) => c.toLowerCase()));
      for (const req of requiredCapabilities) {
        if (!capSet.has(req.toLowerCase())) {
          unmatched.push(req);
        }
      }
    }

    return { matched, unmatched };
  }

  /**
   * Get confidence level from score
   */
  private getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 0.75) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * Generate explanation for the match result
   */
  private generateExplanation(
    score: number,
    matched: string[],
    unmatched: string[],
    capabilities: AgentCapabilities
  ): string {
    const level = this.getConfidenceLevel(score);
    const parts: string[] = [];

    parts.push(
      `Intent matching ${level}: score ${(score * 100).toFixed(1)}%.`
    );

    if (matched.length > 0) {
      parts.push(
        `Matched capabilities: ${matched.slice(0, 5).join(', ')}${matched.length > 5 ? '...' : ''}.`
      );
    }

    if (unmatched.length > 0) {
      parts.push(
        `Missing: ${unmatched.slice(0, 3).join(', ')}${unmatched.length > 3 ? '...' : ''}.`
      );
    }

    parts.push(
      `Agent supports ${capabilities.domains.length} domain(s) and ${capabilities.specializations.length} specialization(s).`
    );

    return parts.join(' ');
  }

  /**
   * Create zero-score result
   */
  private createZeroScoreResult(reason: string): IntentMatchResult {
    return {
      score: 0,
      matchedCapabilities: [],
      unmatchedCapabilities: [],
      confidenceLevel: 'low',
      explanation: `No match: ${reason}`,
    };
  }
}

export const intentMatcherService = new IntentMatcherService();
export default intentMatcherService;
