import { AgentMetrics } from '../models/AgentMetrics';
import { AgentStatus, LoadFactorResult } from '../types';
import logger from '../utils/logger.js';

interface LeanAgentMetrics {
  agentId: string;
  status: 'online' | 'offline' | 'active' | 'inactive' | 'draining' | 'overloaded' | 'maintenance';
  loadMetrics: {
    currentLoad: number;
    maxLoad: number;
    queueDepth: number;
    averageResponseTimeMs: number;
    successRate: number;
  };
  capabilities: {
    maxConcurrentTasks: number;
  };
}

/**
 * Load Balancer Service
 *
 * Calculates load factor scores for agent selection based on:
 * 1. Current load percentage
 * 2. Queue depth
 * 3. Available capacity
 * 4. Historical performance under load
 */
export class LoadBalancerService {
  /**
   * Calculate load factor for an agent
   *
   * Lower load = higher score (more available capacity)
   */
  async calculateLoadFactor(agentId: string): Promise<LoadFactorResult> {
    try {
      // Get agent metrics
      const agent = await AgentMetrics.findOne({ agentId }).lean().exec() as LeanAgentMetrics | null;

      if (!agent) {
        logger.warn(`Agent not found for load calculation: ${agentId}`);
        return this.createZeroResult('Agent not found');
      }

      // Check agent status
      if (agent.status !== AgentStatus.ACTIVE) {
        return {
          score: 0,
          currentLoadPercentage: 100,
          queueDepth: 0,
          availableCapacity: 0,
          recommendation: 'decrease',
          explanation: `Agent is ${agent.status} - not available for tasks`,
        };
      }

      const { loadMetrics, capabilities } = agent;
      const currentLoadPercentage = this.calculateLoadPercentage(loadMetrics);
      const queueDepth = loadMetrics.queueDepth;
      const availableCapacity = this.calculateAvailableCapacity(
        loadMetrics,
        capabilities.maxConcurrentTasks
      );

      // Calculate overall load factor score
      const score = this.computeLoadScore(
        currentLoadPercentage,
        queueDepth,
        loadMetrics.averageResponseTimeMs,
        capabilities.maxConcurrentTasks
      );

      // Determine recommendation
      const recommendation = this.getRecommendation(
        currentLoadPercentage,
        queueDepth,
        availableCapacity
      );

      return {
        score,
        currentLoadPercentage,
        queueDepth,
        availableCapacity,
        recommendation,
        explanation: this.generateExplanation(
          currentLoadPercentage,
          queueDepth,
          availableCapacity,
          recommendation,
          loadMetrics
        ),
      };
    } catch (error) {
      logger.error('Error calculating load factor', {
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.createZeroResult('Error calculating load');
    }
  }

  /**
   * Calculate load percentage
   */
  private calculateLoadPercentage(loadMetrics: {
    currentLoad: number;
    maxLoad: number;
  }): number {
    if (loadMetrics.maxLoad === 0) return 100;
    return (loadMetrics.currentLoad / loadMetrics.maxLoad) * 100;
  }

  /**
   * Calculate available capacity
   */
  private calculateAvailableCapacity(
    loadMetrics: { currentLoad: number; maxLoad: number },
    maxConcurrentTasks: number
  ): number {
    const capacityBasedOnLoad = loadMetrics.maxLoad - loadMetrics.currentLoad;
    const capacityBasedOnTasks = maxConcurrentTasks - loadMetrics.currentLoad;
    return Math.max(0, Math.min(capacityBasedOnLoad, capacityBasedOnTasks));
  }

  /**
   * Compute load score
   */
  private computeLoadScore(
    loadPercentage: number,
    queueDepth: number,
    averageResponseTimeMs: number,
    maxConcurrentTasks: number
  ): number {
    // Base score from load percentage (inverse relationship)
    // 0% load = 1.0 score, 100% load = 0.0 score
    const loadScore = 1 - loadPercentage / 100;

    // Queue penalty
    // More queue depth = lower score
    const maxQueuePenalty = 0.3;
    const queueScore = Math.max(0, 1 - (queueDepth / (maxConcurrentTasks * 2)) - maxQueuePenalty);

    // Response time penalty
    // Higher response time = lower score
    const maxAcceptableResponseTime = 5000; // 5 seconds
    const responseTimeScore = Math.max(
      0,
      1 - averageResponseTimeMs / maxAcceptableResponseTime
    );

    // Weighted combination
    const weights = {
      load: 0.5,
      queue: 0.3,
      responseTime: 0.2,
    };

    const score =
      loadScore * weights.load +
      queueScore * weights.queue +
      responseTimeScore * weights.responseTime;

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Get recommendation based on load
   */
  private getRecommendation(
    loadPercentage: number,
    queueDepth: number,
    availableCapacity: number
  ): 'increase' | 'maintain' | 'decrease' {
    if (loadPercentage < 30 && availableCapacity > 5) {
      return 'increase'; // Agent can handle more tasks
    }

    if (loadPercentage > 80 || queueDepth > 10) {
      return 'decrease'; // Agent is overloaded
    }

    return 'maintain'; // Agent load is optimal
  }

  /**
   * Generate explanation for the result
   */
  private generateExplanation(
    loadPercentage: number,
    queueDepth: number,
    availableCapacity: number,
    recommendation: 'increase' | 'maintain' | 'decrease',
    loadMetrics: {
      currentLoad: number;
      maxLoad: number;
      averageResponseTimeMs: number;
      successRate: number;
    }
  ): string {
    const parts: string[] = [];

    // Load explanation
    if (loadPercentage < 20) {
      parts.push('Very low load - significant capacity available.');
    } else if (loadPercentage < 50) {
      parts.push('Moderate load - good capacity.');
    } else if (loadPercentage < 80) {
      parts.push('High load - limited capacity.');
    } else {
      parts.push('Critical load - near capacity.');
    }

    // Queue explanation
    if (queueDepth === 0) {
      parts.push('No queued tasks.');
    } else if (queueDepth < 3) {
      parts.push(`Light queue: ${queueDepth} task(s).`);
    } else if (queueDepth < 10) {
      parts.push(`Moderate queue: ${queueDepth} task(s).`);
    } else {
      parts.push(`Heavy queue: ${queueDepth} task(s).`);
    }

    // Available capacity
    parts.push(`Available capacity: ${availableCapacity} task(s).`);

    // Response time
    if (loadMetrics.averageResponseTimeMs < 1000) {
      parts.push('Fast response times.');
    } else if (loadMetrics.averageResponseTimeMs < 3000) {
      parts.push('Normal response times.');
    } else {
      parts.push('Slower than average response times.');
    }

    // Success rate
    if (loadMetrics.successRate >= 0.95) {
      parts.push('Excellent reliability under load.');
    } else if (loadMetrics.successRate >= 0.85) {
      parts.push('Good reliability.');
    } else {
      parts.push('Reliability concerns under load.');
    }

    // Recommendation
    switch (recommendation) {
      case 'increase':
        parts.push('Recommend routing more tasks.');
        break;
      case 'decrease':
        parts.push('Recommend reducing task routing.');
        break;
      default:
        parts.push('Current routing level is optimal.');
    }

    return parts.join(' ');
  }

  /**
   * Create zero-score result
   */
  private createZeroResult(reason: string): LoadFactorResult {
    return {
      score: 0,
      currentLoadPercentage: 100,
      queueDepth: 0,
      availableCapacity: 0,
      recommendation: 'decrease',
      explanation: `No load data available: ${reason}`,
    };
  }

  /**
   * Find best agent by load among multiple candidates
   */
  async findBestAgentByLoad(agentIds: string[]): Promise<string | null> {
    try {
      if (agentIds.length === 0) {
        return null;
      }

      const agents = await AgentMetrics.find({
        agentId: { $in: agentIds },
        status: AgentStatus.ACTIVE,
      })
        .lean()
        .exec() as unknown as LeanAgentMetrics[];

      if (agents.length === 0) {
        return null;
      }

      // Score each agent and find the best
      let bestAgentId: string | null = null;
      let bestScore = -1;

      for (const agent of agents) {
        const loadPercentage = this.calculateLoadPercentage(agent.loadMetrics);
        const score = 1 - loadPercentage / 100; // Higher score = lower load

        if (score > bestScore) {
          bestScore = score;
          bestAgentId = agent.agentId;
        }
      }

      return bestAgentId;
    } catch (error) {
      logger.error('Error finding best agent by load', {
        agentIds,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get load distribution across agents
   */
  async getLoadDistribution(agentIds?: string[]): Promise<{
    agents: Array<{
      agentId: string;
      loadPercentage: number;
      queueDepth: number;
      status: string;
    }>;
    summary: {
      averageLoad: number;
      totalCapacity: number;
      totalUsed: number;
      overloadedCount: number;
    };
  }> {
    try {
      const query = agentIds
        ? { agentId: { $in: agentIds } }
        : { status: { $ne: AgentStatus.INACTIVE } };

      const agents = await AgentMetrics.find(query).lean().exec() as unknown as LeanAgentMetrics[];

      const agentLoads = agents.map((agent) => ({
        agentId: agent.agentId,
        loadPercentage: this.calculateLoadPercentage(agent.loadMetrics),
        queueDepth: agent.loadMetrics.queueDepth,
        status: agent.status,
      }));

      const totalCapacity = agents.reduce(
        (sum, a) => sum + a.loadMetrics.maxLoad,
        0
      );
      const totalUsed = agents.reduce(
        (sum, a) => sum + a.loadMetrics.currentLoad,
        0
      );
      const overloadedCount = agents.filter(
        (a) => a.loadMetrics.currentLoad / a.loadMetrics.maxLoad > 0.9
      ).length;

      return {
        agents: agentLoads,
        summary: {
          averageLoad:
            agents.length > 0
              ? agentLoads.reduce((sum, a) => sum + a.loadPercentage, 0) /
                agents.length
              : 0,
          totalCapacity,
          totalUsed,
          overloadedCount,
        },
      };
    } catch (error) {
      logger.error('Error getting load distribution', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Check if agent is available for new tasks
   */
  async isAgentAvailable(agentId: string, requiredCapacity: number = 1): Promise<boolean> {
    try {
      const agent = await AgentMetrics.findOne({ agentId }).lean().exec() as LeanAgentMetrics | null;

      if (!agent) {
        return false;
      }

      if (agent.status !== AgentStatus.ACTIVE) {
        return false;
      }

      const availableCapacity = this.calculateAvailableCapacity(
        agent.loadMetrics,
        agent.capabilities.maxConcurrentTasks
      );

      return availableCapacity >= requiredCapacity;
    } catch (error) {
      logger.error('Error checking agent availability', {
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

export const loadBalancerService = new LoadBalancerService();
export default loadBalancerService;
