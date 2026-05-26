import { randomBytes } from 'crypto';
import { ProcessedOrchestrationRequest, AgentCapability } from '../models/OrchestrationRequest';
import { AgentInfo } from './agentRegistry';
import { appConfig } from '../config';
import { logger } from '../utils/logger';

/**
 * Generate a random number between 0 and 1 using crypto
 */
function cryptoRandom(): number {
  return Number(randomBytes(4).readUInt32BE(0)) / 0xFFFFFFFF;
}

export interface SelectionResult {
  selectedAgent: AgentInfo | null;
  fallbackAgent: AgentInfo | null;
  allCandidates: AgentInfo[];
  warnings: string[];
  selectionReason: string;
}

export class ExpertSelector {
  private agentRegistry; // Forward reference to avoid circular dependency

  setAgentRegistry(registry): void {
    this.agentRegistry = registry;
  }

  async selectAgent(
    request: ProcessedOrchestrationRequest
  ): Promise<SelectionResult> {
    const warnings: string[] = [];
    let selectedAgent: AgentInfo | null = null;
    let fallbackAgent: AgentInfo | null = null;

    const routingHints = request.routingHints || {};
    const {
      preferredAgents,
      excludedAgents,
      requiredCapabilities,
    } = routingHints;

    // Determine required capabilities
    const capabilities = this.inferCapabilities(request.message, requiredCapabilities);

    if (capabilities.length === 0) {
      warnings.push('No specific capabilities inferred; using default agent selection');
    }

    // Get agents matching capabilities
    let candidates = await this.agentRegistry.getAgentsByCapabilities(capabilities);

    // Filter out excluded agents
    if (excludedAgents && excludedAgents.length > 0) {
      const beforeCount = candidates.length;
      candidates = candidates.filter(
        (agent: AgentInfo) => !excludedAgents.includes(agent.agentId)
      );
      if (candidates.length < beforeCount) {
        warnings.push(`Excluded ${beforeCount - candidates.length} agent(s) as requested`);
      }
    }

    // Filter available agents
    candidates = candidates.filter((agent: AgentInfo) => {
      return agent.status === 'idle' && agent.health.isHealthy;
    });

    if (candidates.length === 0) {
      // Try fallback: get any agent with matching capabilities
      const fallbackCandidates = await this.agentRegistry.getAgentsByCapabilities(capabilities);
      if (fallbackCandidates.length > 0) {
        warnings.push('No idle agents available; using busy agent as fallback');
        fallbackAgent = fallbackCandidates[0];
      }
    }

    // Apply preferred agents ranking
    if (preferredAgents && preferredAgents.length > 0) {
      candidates = this.rankByPreference(candidates, preferredAgents);
    }

    // Select the best agent
    selectedAgent = this.selectBestAgent(candidates, request);

    if (!selectedAgent && fallbackAgent) {
      selectedAgent = fallbackAgent;
      warnings.push('Using fallback agent due to no optimal candidate');
    }

    // Select fallback if not already set
    if (!fallbackAgent && selectedAgent) {
      const remainingCandidates = candidates.filter(
        (c: AgentInfo) => c.agentId !== selectedAgent!.agentId
      );
      fallbackAgent = this.selectBestAgent(remainingCandidates, request);
    }

    if (!selectedAgent) {
      logger.warn('No suitable agent found', {
        requestId: request.requestId,
        requiredCapabilities: capabilities,
        candidateCount: candidates.length,
      });
    }

    return {
      selectedAgent,
      fallbackAgent,
      allCandidates: candidates,
      warnings,
      selectionReason: this.generateSelectionReason(selectedAgent, capabilities),
    };
  }

  private inferCapabilities(
    message: string,
    explicitCapabilities?: AgentCapability[]
  ): AgentCapability[] {
    if (explicitCapabilities && explicitCapabilities.length > 0) {
      return explicitCapabilities;
    }

    const capabilities: AgentCapability[] = [];
    const lowerMessage = message.toLowerCase();

    // Intent classification keywords
    if (this.matchesKeywords(lowerMessage, [
      'what is', 'who is', 'where is', 'when is', 'how to',
      'explain', 'define', 'describe', 'tell me about'
    ])) {
      capabilities.push('intent_classification', 'natural_language');
    }

    // Code generation keywords
    if (this.matchesKeywords(lowerMessage, [
      'write code', 'create function', 'implement', 'generate code',
      'build', 'develop', 'code for'
    ])) {
      capabilities.push('code_generation', 'natural_language');
    }

    // Code analysis keywords
    if (this.matchesKeywords(lowerMessage, [
      'analyze code', 'review code', 'debug', 'fix error',
      'optimize code', 'refactor'
    ])) {
      capabilities.push('code_analysis', 'natural_language');
    }

    // Data processing keywords
    if (this.matchesKeywords(lowerMessage, [
      'process data', 'analyze data', 'transform data', 'clean data',
      'aggregate', 'statistics'
    ])) {
      capabilities.push('data_processing');
    }

    // Image analysis keywords
    if (this.matchesKeywords(lowerMessage, [
      'image', 'picture', 'photo', 'visual', 'screenshot',
      'identify', 'recognize'
    ])) {
      capabilities.push('image_analysis');
    }

    // Translation keywords
    if (this.matchesKeywords(lowerMessage, [
      'translate', 'translation', 'convert to', 'in language'
    ])) {
      capabilities.push('translation', 'natural_language');
    }

    // Default to natural language if nothing matched
    if (capabilities.length === 0) {
      capabilities.push('natural_language');
    }

    return [...new Set(capabilities)]; // Remove duplicates
  }

  private matchesKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private rankByPreference(agents: AgentInfo[], preferredIds: string[]): AgentInfo[] {
    return agents.sort((a, b) => {
      const aIndex = preferredIds.indexOf(a.agentId);
      const bIndex = preferredIds.indexOf(b.agentId);

      // If both are preferred, sort by preference order
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      // Prioritize preferred agents
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      return 0;
    });
  }

  private selectBestAgent(candidates: AgentInfo[], request: ProcessedOrchestrationRequest): AgentInfo | null {
    if (candidates.length === 0) {
      return null;
    }

    // Score each candidate
    const scoredCandidates = candidates.map(agent => ({
      agent,
      score: this.calculateScore(agent, request),
    }));

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    return scoredCandidates[0].agent;
  }

  private calculateScore(agent: AgentInfo, request: ProcessedOrchestrationRequest): number {
    let score = 0;

    // Base score: 50 points for being available
    score += 50;

    // Capability match bonus: 20 points per matching capability
    const requiredCaps = request.routingHints?.requiredCapabilities || ['natural_language'];
    const matchingCaps = agent.capabilities.filter(cap => requiredCaps.includes(cap));
    score += matchingCaps.length * 20;

    // Health bonus: up to 15 points based on success rate
    score += agent.health.successRate * 15;

    // Performance bonus: up to 15 points based on response time
    const maxAcceptableTime = appConfig.agent.maxResponseTimeMs;
    if (agent.metrics.averageResponseTimeMs <= appConfig.responseTime.thresholdMs) {
      score += 15;
    } else if (agent.metrics.averageResponseTimeMs <= maxAcceptableTime) {
      score += 10;
    } else {
      score += 5;
    }

    // Recency bonus: agents used recently are kept warm
    const lastUsed = new Date(agent.metrics.lastUsed).getTime();
    const now = Date.now();
    const minutesSinceLastUse = (now - lastUsed) / (1000 * 60);

    if (minutesSinceLastUse < 1) {
      score += 5;
    } else if (minutesSinceLastUse < 5) {
      score += 3;
    }

    // Small random factor to prevent always selecting the same agent
    score += cryptoRandom() * 5;

    return score;
  }

  private generateSelectionReason(agent: AgentInfo | null, capabilities: AgentCapability[]): string {
    if (!agent) {
      return 'No suitable agent found';
    }

    const matchingCaps = agent.capabilities.filter(cap => capabilities.includes(cap));
    return `Selected ${agent.name} (confidence: ${(agent.health.successRate * 100).toFixed(0)}%) ` +
      `based on capabilities: ${matchingCaps.join(', ') || 'general'}`;
  }
}

export const createExpertSelector = (): ExpertSelector => {
  return new ExpertSelector();
};
