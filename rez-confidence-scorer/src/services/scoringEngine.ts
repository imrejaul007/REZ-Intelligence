import { ConfidenceScore } from '../models/ConfidenceScore';
import { AgentMetrics } from '../models/AgentMetrics';
import { ScoringRequest, ConfidenceScoreResult, ScoreComponent } from '../types';
import { intentMatcherService } from './intentMatcher';
import { contextAnalyzerService } from './contextAnalyzer';
import { historyTrackerService } from './historyTracker';
import { loadBalancerService } from './loadBalancer';
import { redisClient } from '../utils/redis';
import logger from '../utils/logger';
import config from '../config';

/**
 * Main Scoring Engine Service
 *
 * Orchestrates the confidence scoring calculation by combining:
 * - Intent Match (35%)
 * - Context Relevance (30%)
 * - History Accuracy (25%)
 * - Load Factor (10%)
 */
export class ScoringEngineService {
  private readonly weights = config.scoring.weights;
  private readonly cacheEnabled = config.scoring.cache.enabled;
  private readonly cacheTTL = config.scoring.cache.ttlSeconds;

  /**
   * Calculate confidence score for an agent
   */
  async calculateScore(request: ScoringRequest): Promise<ConfidenceScoreResult> {
    const startTime = Date.now();
    const { agentId, intent, context, taskComplexity, requiredCapabilities } = request;

    try {
      // Check cache first
      if (this.cacheEnabled) {
        const cached = await this.getCachedScore(agentId, intent);
        if (cached) {
          logger.debug('Cache hit for scoring request', { agentId, intent });
          return {
            ...cached,
            metadata: {
              ...cached.metadata,
              cacheHit: true,
              processingTimeMs: Date.now() - startTime,
            },
          };
        }
      }

      // Calculate individual components in parallel
      const [intentMatchResult, contextAnalysisResult, historyAccuracyResult, loadFactorResult] =
        await Promise.all([
          intentMatcherService.calculateMatch(agentId, intent, requiredCapabilities),
          contextAnalyzerService.analyzeContext(agentId, context || {}),
          historyTrackerService.calculateHistoryAccuracy(
            agentId,
            intent,
            context?.domain
          ),
          loadBalancerService.calculateLoadFactor(agentId),
        ]);

      // Calculate overall score with weights
      const overallScore = this.calculateOverallScore(
        intentMatchResult.score,
        contextAnalysisResult.score,
        historyAccuracyResult.score,
        loadFactorResult.score
      );

      // Build components with detailed information
      const components = {
        intentMatch: this.buildScoreComponent(
          intentMatchResult.score,
          this.weights.intentMatch,
          {
            rawScore: intentMatchResult.score,
            factors: {
              capabilityMatch: intentMatchResult.score,
            },
            explanation: intentMatchResult.explanation,
          }
        ),
        contextRelevance: this.buildScoreComponent(
          contextAnalysisResult.score,
          this.weights.contextRelevance,
          {
            rawScore: contextAnalysisResult.score,
            factors: contextAnalysisResult.relevanceFactors,
            explanation: contextAnalysisResult.explanation,
          }
        ),
        historyAccuracy: this.buildScoreComponent(
          historyAccuracyResult.score,
          this.weights.historyAccuracy,
          {
            rawScore: historyAccuracyResult.score,
            factors: {
              successRate: historyAccuracyResult.successRate,
              totalAttempts: historyAccuracyResult.totalAttempts,
            },
            explanation: historyAccuracyResult.explanation,
          }
        ),
        loadFactor: this.buildScoreComponent(
          loadFactorResult.score,
          this.weights.loadFactor,
          {
            rawScore: loadFactorResult.score,
            factors: {
              currentLoadPercentage: loadFactorResult.currentLoadPercentage,
              queueDepth: loadFactorResult.queueDepth,
              availableCapacity: loadFactorResult.availableCapacity,
            },
            explanation: loadFactorResult.explanation,
          }
        ),
      };

      const processingTimeMs = Date.now() - startTime;

      const result: ConfidenceScoreResult = {
        overallScore,
        agentId,
        intent,
        components,
        timestamp: new Date(),
        metadata: {
          processingTimeMs,
          cacheHit: false,
          version: '1.0.0',
        },
      };

      // Store score in database and cache
      await Promise.all([
        this.storeScore(request, result),
        this.cacheScore(agentId, intent, result),
      ]);

      return result;
    } catch (error) {
      logger.error('Error calculating confidence score', {
        agentId,
        intent,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Calculate overall score using weighted sum
   */
  private calculateOverallScore(
    intentMatch: number,
    contextRelevance: number,
    historyAccuracy: number,
    loadFactor: number
  ): number {
    const score =
      intentMatch * this.weights.intentMatch +
      contextRelevance * this.weights.contextRelevance +
      historyAccuracy * this.weights.historyAccuracy +
      loadFactor * this.weights.loadFactor;

    // Apply task complexity adjustment
    // Higher complexity tasks may result in lower confidence
    return Math.min(1, Math.max(0, score));
  }

  /**
   * Build score component with details
   */
  private buildScoreComponent(
    score: number,
    weight: number,
    details: {
      rawScore: number;
      factors: Record<string, number>;
      explanation: string;
    }
  ): ScoreComponent {
    return {
      score,
      weight,
      weightedScore: score * weight,
      details,
    };
  }

  /**
   * Get cached score from Redis
   */
  private async getCachedScore(
    agentId: string,
    intent: string
  ): Promise<ConfidenceScoreResult | null> {
    try {
      const cacheKey = this.getCacheKey(agentId, intent);
      const cached = await redisClient.get(cacheKey);

      if (cached) {
        const parsed = JSON.parse(cached);
        // Convert timestamp string back to Date
        parsed.timestamp = new Date(parsed.timestamp);
        return parsed;
      }

      return null;
    } catch (error) {
      logger.warn('Error reading from cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Cache score in Redis
   */
  private async cacheScore(
    agentId: string,
    intent: string,
    result: ConfidenceScoreResult
  ): Promise<void> {
    if (!this.cacheEnabled) return;

    try {
      const cacheKey = this.getCacheKey(agentId, intent);
      // Don't cache metadata - serialize cleanly
      const toCache = {
        ...result,
        metadata: {
          ...result.metadata,
          cacheHit: false,
        },
      };
      await redisClient.setex(cacheKey, this.cacheTTL, JSON.stringify(toCache));
    } catch (error) {
      logger.warn('Error writing to cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Generate cache key
   */
  private getCacheKey(agentId: string, intent: string): string {
    // Normalize intent for cache key
    const normalizedIntent = intent
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .substring(0, 100);
    return `${config.redis.keyPrefix}score:${agentId}:${normalizedIntent}`;
  }

  /**
   * Store score in MongoDB
   */
  private async storeScore(
    request: ScoringRequest,
    result: ConfidenceScoreResult
  ): Promise<void> {
    try {
      const score = new ConfidenceScore({
        agentId: result.agentId,
        intent: result.intent,
        overallScore: result.overallScore,
        components: {
          intentMatch: result.components.intentMatch.score,
          contextRelevance: result.components.contextRelevance.score,
          historyAccuracy: result.components.historyAccuracy.score,
          loadFactor: result.components.loadFactor.score,
        },
        context: request.context || {},
        taskComplexity: request.taskComplexity || 0.5,
        requiredCapabilities: request.requiredCapabilities || [],
        metadata: result.metadata,
      });

      await score.save();
    } catch (error) {
      logger.error('Error storing score', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - caching failure shouldn't break scoring
    }
  }

  /**
   * Batch score multiple agents for the same task
   */
  async batchScoreAgents(
    agentIds: string[],
    intent: string,
    context?: ScoringRequest['context']
  ): Promise<Array<ConfidenceScoreResult & { rank: number }>> {
    const scores = await Promise.all(
      agentIds.map((agentId) =>
        this.calculateScore({
          agentId,
          intent,
          context,
          taskComplexity: context ? 0.5 : 0.5,
        })
      )
    );

    // Sort by overall score descending
    const sorted = scores.sort((a, b) => b.overallScore - a.overallScore);

    // Add rank
    return sorted.map((score, index) => ({
      ...score,
      rank: index + 1,
    }));
  }

  /**
   * Get top scoring agent for an intent
   */
  async getTopAgent(
    intent: string,
    domain?: string,
    excludeAgentIds: string[] = []
  ): Promise<{ agentId: string; score: number } | null> {
    try {
      // Find active agents
      const agents = await AgentMetrics.find({
        status: 'active',
        ...(domain && { 'capabilities.domains': domain }),
        ...(excludeAgentIds.length > 0 && {
          agentId: { $nin: excludeAgentIds },
        }),
      })
        .lean()
        .exec();

      if (agents.length === 0) {
        return null;
      }

      const scores = await this.batchScoreAgents(
        agents.map((a) => a.agentId),
        intent,
        domain ? { domain } : undefined
      );

      if (scores.length === 0) {
        return null;
      }

      const top = scores[0];
      return {
        agentId: top.agentId,
        score: top.overallScore,
      };
    } catch (error) {
      logger.error('Error getting top agent', {
        intent,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Record task outcome for learning
   */
  async recordTaskOutcome(
    agentId: string,
    intent: string,
    success: boolean,
    confidenceScore: number,
    responseTimeMs: number
  ): Promise<void> {
    try {
      await historyTrackerService.recordOutcome({
        agentId,
        intent,
        domain: 'unknown',
        success,
        confidenceScore,
        responseTimeMs,
        timestamp: new Date(),
      });

      // Invalidate cache for this agent/intent combination
      if (this.cacheEnabled) {
        const cacheKey = this.getCacheKey(agentId, intent);
        await redisClient.del(cacheKey);
      }
    } catch (error) {
      logger.error('Error recording task outcome', {
        agentId,
        intent,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get score breakdown explanation
   */
  getScoreBreakdown(result: ConfidenceScoreResult): {
    overall: string;
    components: Array<{
      name: string;
      score: number;
      weight: number;
      contribution: number;
      explanation: string;
    }>;
    recommendations: string[];
  } {
    const components = Object.entries(result.components).map(([name, component]) => ({
      name,
      score: component.score,
      weight: component.weight,
      contribution: component.weightedScore,
      explanation: component.details.explanation,
    }));

    const recommendations: string[] = [];

    // Add recommendations based on component scores
    if (result.components.intentMatch.score < 0.5) {
      recommendations.push(
        'Consider training agent on more intent patterns'
      );
    }

    if (result.components.contextRelevance.score < 0.5) {
      recommendations.push(
        'Agent may benefit from domain-specific training'
      );
    }

    if (result.components.historyAccuracy.score < 0.5) {
      recommendations.push(
        'Monitor agent performance - accuracy is below threshold'
      );
    }

    if (result.components.loadFactor.score < 0.3) {
      recommendations.push(
        'Agent is heavily loaded - consider routing to less busy agent'
      );
    }

    if (result.overallScore >= 0.75) {
      recommendations.push('Agent is highly suitable for this task');
    } else if (result.overallScore >= 0.5) {
      recommendations.push('Agent is moderately suitable - consider alternatives');
    } else {
      recommendations.push('Agent may not be the best fit - seek alternatives');
    }

    return {
      overall: `${(result.overallScore * 100).toFixed(1)}% confidence - ${
        result.overallScore >= 0.75
          ? 'High confidence'
          : result.overallScore >= 0.5
          ? 'Moderate confidence'
          : 'Low confidence'
      }`,
      components,
      recommendations,
    };
  }
}

export const scoringEngineService = new ScoringEngineService();
export default scoringEngineService;
