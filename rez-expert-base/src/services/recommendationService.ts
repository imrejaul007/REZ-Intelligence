/**
 * RecommendationService - Generates follow-up suggestions
 * Provides intelligent recommendations based on context
 */

import { IIntent } from '../interfaces/IIntent';
import { SuggestedFollowUp } from '../interfaces/IResponse';
import { Logger } from '../utils/logger';

export interface RecommendationConfig {
  enabled: boolean;
  maxSuggestions: number;
  similarityThreshold: number;
  personalizationEnabled: boolean;
}

export interface RecommendationContext {
  expertId: string;
  domain: string;
  action: string;
  userPreferences?: Record<string, unknown>;
  history?: RecommendationHistoryItem[];
}

export interface RecommendationHistoryItem {
  intentId: string;
  action: string;
  timestamp: string;
  wasHelpful?: boolean;
}

export interface RecommendationPattern {
  trigger: {
    action?: string;
    keywords?: string[];
    intentPattern?: RegExp;
  };
  suggestions: {
    label: string;
    intent: Partial<{
      input: string;
      classification: { domain: string; action: string };
    }>;
    priority: number;
  }[];
}

export class RecommendationService {
  private logger: Logger;
  private expertId: string;
  private config: RecommendationConfig;
  private patterns: RecommendationPattern[];
  private history: Map<string, RecommendationHistoryItem[]>;

  constructor(expertId: string, logger: Logger) {
    this.expertId = expertId;
    this.logger = logger;
    this.config = {
      enabled: true,
      maxSuggestions: 5,
      similarityThreshold: 0.7,
      personalizationEnabled: true
    };
    this.patterns = this.initializeDefaultPatterns();
    this.history = new Map();
  }

  /**
   * Generate follow-up suggestions
   */
  async generateFollowUps(
    intent: IIntent,
    responseContent: string
  ): Promise<SuggestedFollowUp[]> {
    if (!this.config.enabled) {
      return [];
    }

    const suggestions: SuggestedFollowUp[] = [];

    // Get matched patterns
    const matchedPatterns = this.matchPatterns(intent);

    // Add suggestions from matched patterns
    for (const pattern of matchedPatterns) {
      for (const suggestion of pattern.suggestions) {
        suggestions.push({
          label: suggestion.label,
          intent: suggestion.intent,
          confidence: pattern.trigger.action === intent.classification.action ? 0.9 : 0.7
        });
      }
    }

    // Add context-aware suggestions
    const contextSuggestions = await this.generateContextSuggestions(intent, responseContent);
    suggestions.push(...contextSuggestions);

    // Add personalized suggestions based on history
    if (this.config.personalizationEnabled) {
      const personalizedSuggestions = this.generatePersonalizedSuggestions(intent);
      suggestions.push(...personalizedSuggestions);
    }

    // Deduplicate and limit
    const uniqueSuggestions = this.deduplicateSuggestions(suggestions);
    return uniqueSuggestions.slice(0, this.config.maxSuggestions);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RecommendationConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info(`Recommendation config updated: ${JSON.stringify(config)}`);
  }

  /**
   * Add a recommendation pattern
   */
  addPattern(pattern: RecommendationPattern): void {
    this.patterns.push(pattern);
    this.logger.info(`Added recommendation pattern for: ${pattern.trigger.action || 'keywords'}`);
  }

  /**
   * Record feedback for a suggestion
   */
  recordFeedback(
    intentId: string,
    suggestion: SuggestedFollowUp,
    helpful: boolean
  ): void {
    const historyItem: RecommendationHistoryItem = {
      intentId,
      action: suggestion.intent.classification?.action || 'unknown',
      timestamp: new Date().toISOString(),
      wasHelpful: helpful
    };

    const existingHistory = this.history.get(this.expertId) || [];
    existingHistory.push(historyItem);

    // Keep only last 100 items per expert
    if (existingHistory.length > 100) {
      existingHistory.shift();
    }

    this.history.set(this.expertId, existingHistory);

    // Adjust pattern priority based on feedback
    this.adjustPatternPriorities(suggestion, helpful);

    this.logger.info(`Recorded feedback for suggestion: ${suggestion.label}, helpful: ${helpful}`);
  }

  /**
   * Get recommendation statistics
   */
  getStats(): {
    totalPatterns: number;
    totalSuggestions: number;
    averageSuggestionsPerIntent: number;
    helpfulRate: number;
  } {
    const allHistory = this.history.get(this.expertId) || [];
    const helpfulCount = allHistory.filter(h => h.wasHelpful).length;

    return {
      totalPatterns: this.patterns.length,
      totalSuggestions: allHistory.length,
      averageSuggestionsPerIntent: allHistory.length / Math.max(1, this.getUniqueIntents()),
      helpfulRate: helpfulCount / Math.max(1, allHistory.length)
    };
  }

  private initializeDefaultPatterns(): RecommendationPattern[] {
    return [
      // Query patterns
      {
        trigger: { action: 'query' },
        suggestions: [
          {
            label: 'Get more details',
            intent: {
              input: 'Can you provide more specific details?',
              classification: { domain: '', action: 'explain' }
            },
            priority: 1
          },
          {
            label: 'See related topics',
            intent: {
              input: 'What related topics should I know about?',
              classification: { domain: '', action: 'recommend' }
            },
            priority: 2
          }
        ]
      },
      // Recommendation patterns
      {
        trigger: { action: 'recommend' },
        suggestions: [
          {
            label: 'Compare alternatives',
            intent: {
              input: 'How do these options compare?',
              classification: { domain: '', action: 'compare' }
            },
            priority: 1
          },
          {
            label: 'Understand pros and cons',
            intent: {
              input: 'What are the advantages and disadvantages?',
              classification: { domain: '', action: 'explain' }
            },
            priority: 2
          }
        ]
      },
      // Explanation patterns
      {
        trigger: { action: 'explain' },
        suggestions: [
          {
            label: 'See practical example',
            intent: {
              input: 'Can you give me an example?',
              classification: { domain: '', action: 'query' }
            },
            priority: 1
          },
          {
            label: 'When to use',
            intent: {
              input: 'When should I use this approach?',
              classification: { domain: '', action: 'recommend' }
            },
            priority: 2
          }
        ]
      },
      // Troubleshooting patterns
      {
        trigger: { action: 'troubleshoot' },
        suggestions: [
          {
            label: 'Common issues',
            intent: {
              input: 'What are common issues to watch out for?',
              classification: { domain: '', action: 'query' }
            },
            priority: 1
          },
          {
            label: 'Prevention tips',
            intent: {
              input: 'How can I prevent this in the future?',
              classification: { domain: '', action: 'recommend' }
            },
            priority: 2
          }
        ]
      }
    ];
  }

  private matchPatterns(intent: IIntent): RecommendationPattern[] {
    const matched: RecommendationPattern[] = [];

    for (const pattern of this.patterns) {
      // Match by action
      if (pattern.trigger.action === intent.classification.action) {
        matched.push(pattern);
        continue;
      }

      // Match by keywords
      if (pattern.trigger.keywords) {
        const inputLower = intent.input.toLowerCase();
        if (pattern.trigger.keywords.some(kw => inputLower.includes(kw))) {
          matched.push(pattern);
          continue;
        }
      }

      // Match by pattern
      if (pattern.trigger.intentPattern) {
        if (pattern.trigger.intentPattern.test(intent.input)) {
          matched.push(pattern);
        }
      }
    }

    return matched;
  }

  private async generateContextSuggestions(
    intent: IIntent,
    _responseContent: string
  ): Promise<SuggestedFollowUp[]> {
    const suggestions: SuggestedFollowUp[] = [];

    // Generate suggestions based on the specific context
    const domain = intent.classification.domain;
    const action = intent.classification.action;

    // Add domain-specific suggestions
    if (domain) {
      suggestions.push({
        label: `Explore ${domain}`,
        intent: {
          input: `Tell me more about ${domain}`,
          classification: { domain, action: 'query' }
        },
        confidence: 0.6
      });
    }

    // Add action progression suggestions
    if (action === 'query') {
      suggestions.push({
        label: 'Get started',
        intent: {
          input: 'How do I get started with this?',
          classification: { domain, action: 'guide' }
        },
        confidence: 0.5
      });
    } else if (action === 'guide') {
      suggestions.push({
        label: 'Need more help',
        intent: {
          input: 'I still need help',
          classification: { domain, action: 'troubleshoot' }
        },
        confidence: 0.5
      });
    }

    return suggestions;
  }

  private generatePersonalizedSuggestions(intent: IIntent): SuggestedFollowUp[] {
    const suggestions: SuggestedFollowUp[] = [];
    const history = this.history.get(this.expertId) || [];

    // Find actions that user has engaged with before
    const userActions = new Set(history.map(h => h.action));
    const helpfulActions = history.filter(h => h.wasHelpful).map(h => h.action);

    // Suggest following actions in a common flow
    const flowSuggestions = this.getFlowSuggestions(intent.classification.action, helpfulActions);
    suggestions.push(...flowSuggestions);

    return suggestions;
  }

  private getFlowSuggestions(
    currentAction: string,
    helpfulActions: string[]
  ): SuggestedFollowUp[] {
    // Common action flows
    const flows: Record<string, string[]> = {
      query: ['explain', 'recommend', 'guide'],
      explain: ['example', 'guide', 'troubleshoot'],
      recommend: ['compare', 'explain', 'guide'],
      guide: ['troubleshoot', 'query', 'explain'],
      troubleshoot: ['query', 'recommend', 'explain']
    };

    const nextActions = flows[currentAction] || [];
    const suggestions: SuggestedFollowUp[] = [];

    for (const action of nextActions) {
      if (helpfulActions.includes(action) || helpfulActions.length === 0) {
        suggestions.push({
          label: `Continue to ${action}`,
          intent: {
            classification: { domain: '', action }
          },
          confidence: 0.4
        });
      }
    }

    return suggestions;
  }

  private deduplicateSuggestions(suggestions: SuggestedFollowUp[]): SuggestedFollowUp[] {
    const seen = new Set<string>();
    const unique: SuggestedFollowUp[] = [];

    for (const suggestion of suggestions) {
      const key = suggestion.label.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(suggestion);
      }
    }

    // Sort by confidence
    return unique.sort((a, b) => b.confidence - a.confidence);
  }

  private adjustPatternPriorities(suggestion: SuggestedFollowUp, helpful: boolean): void {
    const action = suggestion.intent.classification?.action;
    if (!action) return;

    for (const pattern of this.patterns) {
      if (pattern.trigger.action === action) {
        for (const s of pattern.suggestions) {
          if (s.label === suggestion.label) {
            // Adjust priority based on feedback
            s.priority = helpful
              ? Math.max(1, s.priority - 1)
              : s.priority + 1;
          }
        }
      }
    }
  }

  private getUniqueIntents(): number {
    const history = this.history.get(this.expertId) || [];
    return new Set(history.map(h => h.intentId)).size;
  }
}
