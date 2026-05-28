import { ConfidenceScore } from '../models/ConfidenceScore';
import { AgentMetrics } from '../models/AgentMetrics';
import { HistoryAccuracyResult, HistoryEntry } from '../types';
import logger from '../utils/logger.js';
import config from '../config';

// Lean document types for history tracking
interface LeanScore {
  overallScore: number;
  createdAt: Date;
  intent?: string;
}

interface LeanAgentMetrics {
  agentId: string;
  performance: {
    totalTasks: number;
    successfulTasks: number;
    averageConfidenceScore?: number;
  };
}

/**
 * History Tracker Service
 *
 * Tracks and analyzes agent performance history to calculate
 * historical accuracy scores based on:
 * 1. Past success rate for similar intents
 * 2. Recent trend analysis
 * 3. Intent-specific accuracy
 * 4. Confidence score consistency
 */
export class HistoryTrackerService {
  private readonly maxHistoryEntries: number;
  private readonly recentWindowHours: number;
  private readonly trendWindowHours: number;

  constructor() {
    this.maxHistoryEntries = config.scoring.limits.maxHistoryEntries;
    this.recentWindowHours = 24; // Look back 24 hours for recent performance
    this.trendWindowHours = 168; // 1 week for trend analysis
  }

  /**
   * Calculate history accuracy for an agent
   */
  async calculateHistoryAccuracy(
    agentId: string,
    intent: string,
    _domain?: string
  ): Promise<HistoryAccuracyResult> {
    try {
      // Get agent metrics
      const agent = await AgentMetrics.findOne({ agentId }).lean().exec() as LeanAgentMetrics | null;

      if (!agent) {
        logger.warn(`Agent not found for history tracking: ${agentId}`);
        return this.createZeroResult('Agent not found');
      }

      // Get historical scores
      const recentScores = await this.getRecentScores(agentId);
      const intentScores = await this.getIntentScores(agentId, intent);
      const trendData = await this.getTrendData(agentId);

      // Calculate metrics
      const successRate = this.calculateSuccessRate(agent);
      const intentAccuracy = this.calculateIntentAccuracy(intentScores);
      const scoreConsistency = this.calculateScoreConsistency(recentScores);
      const recentTrend = this.calculateRecentTrend(trendData);

      // Weighted score calculation
      const weights = {
        successRate: 0.4,
        intentAccuracy: 0.35,
        consistency: 0.15,
        trend: 0.1,
      };

      const score = Number(successRate) * weights.successRate +
        Number(intentAccuracy) * weights.intentAccuracy +
        Number(scoreConsistency) * weights.consistency +
        Number(recentTrend) * weights.trend;

      return {
        score: Math.min(1, Math.max(0, score)),
        totalAttempts: agent.performance.totalTasks,
        successRate,
        recentTrend,
        explanation: this.generateExplanation(
          successRate,
          intentAccuracy,
          scoreConsistency,
          recentTrend,
          agent.performance.totalTasks
        ),
      };
    } catch (error) {
      logger.error('Error calculating history accuracy', {
        agentId,
        intent,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.createZeroResult('Error calculating history');
    }
  }

  /**
   * Record a task outcome for history
   */
  async recordOutcome(
    entry: HistoryEntry
  ): Promise<void> {
    try {
      // Update agent metrics
      const agent = await AgentMetrics.findOne({ agentId: entry.agentId });

      if (agent) {
        agent.recordTaskCompletion(
          entry.success,
          entry.confidenceScore,
          entry.responseTimeMs
        );
        agent.updateIntentAccuracy(entry.intent, entry.success ? entry.confidenceScore : 0);
        await agent.save();
      }

      logger.debug('Recorded task outcome', {
        agentId: entry.agentId,
        intent: entry.intent,
        success: entry.success,
      });
    } catch (error) {
      logger.error('Error recording task outcome', {
        entry,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get recent scores for an agent
   */
  private async getRecentScores(agentId: string): Promise<LeanScore[]> {
    const since = new Date(Date.now() - this.recentWindowHours * 60 * 60 * 1000);

    return ConfidenceScore.find({
      agentId,
      createdAt: { $gte: since },
    })
      .sort({ createdAt: -1 })
      .limit(this.maxHistoryEntries)
      .lean()
      .exec() as unknown as LeanScore[];
  }

  /**
   * Get scores for a specific intent
   */
  private async getIntentScores(
    agentId: string,
    intent: string
  ): Promise<LeanScore[]> {
    const since = new Date(Date.now() - this.trendWindowHours * 60 * 60 * 1000);

    return ConfidenceScore.find({
      agentId,
      intent,
      createdAt: { $gte: since },
    })
      .sort({ createdAt: -1 })
      .limit(this.maxHistoryEntries)
      .lean()
      .exec() as unknown as LeanScore[];
  }

  /**
   * Get recent scores with intent field included
   */
  private async getIntentScoresWithIntent(agentId: string): Promise<LeanScore[]> {
    const since = new Date(Date.now() - this.recentWindowHours * 60 * 60 * 1000);

    return ConfidenceScore.find({
      agentId,
      createdAt: { $gte: since },
    })
      .select('overallScore intent createdAt')
      .sort({ createdAt: -1 })
      .limit(this.maxHistoryEntries)
      .lean()
      .exec() as unknown as LeanScore[];
  }

  /**
   * Get trend data for analysis
   */
  private async getTrendData(agentId: string): Promise<{
    recentAvg: number;
    olderAvg: number;
    recentCount: number;
    olderCount: number;
  }> {
    const now = Date.now();
    const recentSince = new Date(now - 72 * 60 * 60 * 1000); // Last 3 days
    const olderSince = new Date(now - this.trendWindowHours * 60 * 60 * 1000);
    const olderUntil = new Date(now - 72 * 60 * 60 * 1000);

    const [recentScoresResult, olderScoresResult]: [LeanScore[], LeanScore[]] = await Promise.all([
      ConfidenceScore.find({
        agentId,
        createdAt: { $gte: recentSince },
      })
        .select('overallScore')
        .lean()
        .exec() as unknown as LeanScore[],
      ConfidenceScore.find({
        agentId,
        createdAt: { $gte: olderSince, $lte: olderUntil },
      })
        .select('overallScore')
        .lean()
        .exec() as unknown as LeanScore[],
    ]);

    const recentAvg =
      recentScoresResult.length > 0
        ? recentScoresResult.reduce((sum, s) => sum + s.overallScore, 0) / recentScoresResult.length
        : 0;

    const olderAvg =
      olderScoresResult.length > 0
        ? olderScoresResult.reduce((sum, s) => sum + s.overallScore, 0) / olderScoresResult.length
        : 0;

    return {
      recentAvg,
      olderAvg,
      recentCount: recentScoresResult.length,
      olderCount: olderScoresResult.length,
    };
  }

  /**
   * Calculate success rate from agent metrics
   */
  private calculateSuccessRate(agent: {
    performance: { successfulTasks: number; totalTasks: number };
  }): number {
    const { successfulTasks, totalTasks } = agent.performance;

    if (totalTasks === 0) {
      // New agent with no history - give neutral score
      return 0.5;
    }

    return successfulTasks / totalTasks;
  }

  /**
   * Calculate intent-specific accuracy
   */
  private calculateIntentAccuracy(scores: LeanScore[]): number {
    if (scores.length === 0) {
      // No specific intent history - use baseline
      return 0.6;
    }

    // Weight recent scores more heavily
    let weightedSum = 0;
    let weightTotal = 0;

    scores.forEach((score, index) => {
      // More recent = higher weight
      const weight = 1 / (index + 1);
      weightedSum += score.overallScore * weight;
      weightTotal += weight;
    });

    const weightedAvg = weightedSum / weightTotal;

    return weightedAvg;
  }

  /**
   * Calculate score consistency (inverse of variance)
   */
  private calculateScoreConsistency(scores: LeanScore[]): number {
    if (scores.length < 2) {
      return 0.7; // Not enough data for consistency
    }

    const avg =
      scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length;

    const variance =
      scores.reduce((sum, s) => sum + Math.pow(s.overallScore - avg, 2), 0) /
      scores.length;

    // Convert variance to consistency score (lower variance = higher consistency)
    // Max variance of 0.25 (completely random) -> 0 score
    // Variance of 0 -> 1 score
    const consistency = Math.max(0, 1 - variance * 4);

    return consistency;
  }

  /**
   * Calculate recent trend
   */
  private calculateRecentTrend(trendData: {
    recentAvg: number;
    olderAvg: number;
    recentCount: number;
    olderCount: number;
  }): 'improving' | 'stable' | 'declining' {
    const { recentAvg, olderAvg, recentCount, olderCount } = trendData;

    // Need minimum data points for meaningful trend
    if (recentCount < 5 || olderCount < 5) {
      return 'stable';
    }

    const change = recentAvg - olderAvg;

    if (change > 0.1) {
      return 'improving';
    } else if (change < -0.1) {
      return 'declining';
    }

    return 'stable';
  }

  /**
   * Generate explanation for the result
   */
  private generateExplanation(
    successRate: number,
    intentAccuracy: number,
    consistency: number,
    trend: 'improving' | 'stable' | 'declining',
    totalTasks: number
  ): string {
    const parts: string[] = [];

    // Success rate
    if (successRate >= 0.9) {
      parts.push('Excellent success rate.');
    } else if (successRate >= 0.7) {
      parts.push('Good success rate.');
    } else if (successRate >= 0.5) {
      parts.push('Moderate success rate.');
    } else {
      parts.push('Below average success rate.');
    }

    // Intent accuracy
    if (intentAccuracy >= 0.8) {
      parts.push('High intent accuracy.');
    } else if (intentAccuracy >= 0.6) {
      parts.push('Average intent accuracy.');
    } else {
      parts.push('Variable intent accuracy.');
    }

    // Consistency
    if (consistency >= 0.8) {
      parts.push('Highly consistent performance.');
    } else if (consistency >= 0.5) {
      parts.push('Moderately consistent.');
    } else {
      parts.push('Variable performance.');
    }

    // Trend
    switch (trend) {
      case 'improving':
        parts.push('Performance is improving.');
        break;
      case 'declining':
        parts.push('Performance is declining.');
        break;
      default:
        parts.push('Performance is stable.');
    }

    // Total tasks
    if (totalTasks < 10) {
      parts.push('Limited history.');
    } else if (totalTasks > 100) {
      parts.push(`Extensive history: ${totalTasks} tasks.`);
    } else {
      parts.push(`${totalTasks} tasks tracked.`);
    }

    return parts.join(' ');
  }

  /**
   * Create zero-score result
   */
  private createZeroResult(reason: string): HistoryAccuracyResult {
    return {
      score: 0,
      totalAttempts: 0,
      successRate: 0,
      recentTrend: 'stable',
      explanation: `No history available: ${reason}`,
    };
  }

  /**
   * Get performance summary for an agent
   */
  async getPerformanceSummary(agentId: string): Promise<{
    totalTasks: number;
    successRate: number;
    averageScore: number;
    recentTrend: string;
    topIntents: Array<{ intent: string; successRate: number; avgScore: number }>;
  } | null> {
    try {
      const agent = await AgentMetrics.findOne({ agentId }).lean().exec() as LeanAgentMetrics | null;

      if (!agent) {
        return null;
      }

      const trendData = await this.getTrendData(agentId);
      const recentScores = await this.getIntentScoresWithIntent(agentId);

      // Calculate top intents
      const intentMap = new Map<
        string,
        { attempts: number; successes: number; scores: number[] }
      >();

      for (const score of recentScores) {
        const intentKey = score.intent || 'unknown';
        const existing = intentMap.get(intentKey) || {
          attempts: 0,
          successes: 0,
          scores: [],
        };
        existing.attempts += 1;
        existing.scores.push(score.overallScore);
        intentMap.set(intentKey, existing);
      }

      const topIntents = Array.from(intentMap.entries())
        .map(([intent, data]) => ({
          intent,
          successRate: data.attempts > 0 ? data.successes / data.attempts : 0,
          avgScore:
            data.scores.length > 0
              ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
              : 0,
        }))
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 5);

      return {
        totalTasks: agent.performance.totalTasks,
        successRate: agent.performance.totalTasks > 0
          ? agent.performance.successfulTasks / agent.performance.totalTasks
          : 0,
        averageScore: agent.performance.averageConfidenceScore ?? 0,
        recentTrend: this.calculateRecentTrend(trendData),
        topIntents,
      };
    } catch (error) {
      logger.error('Error getting performance summary', {
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }
}

export const historyTrackerService = new HistoryTrackerService();
export default historyTrackerService;
