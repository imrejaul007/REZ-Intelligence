import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { appConfig } from '../config';
import { AgentCapability, AgentStatus } from '../models/OrchestrationRequest';
import { logger } from '../utils/logger';

export interface AgentInfo {
  agentId: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  endpoint: string;
  status: AgentStatus;
  health: {
    lastCheck: string;
    isHealthy: boolean;
    responseTimeMs: number;
    errorCount: number;
    successCount: number;
    successRate: number;
  };
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTimeMs: number;
    lastUsed: string;
  };
  metadata: Record<string, unknown>;
  version: string;
  registeredAt: string;
  updatedAt: string;
}

export interface AgentRegistration {
  name: string;
  description: string;
  capabilities: AgentCapability[];
  endpoint: string;
  version?: string;
  metadata?: Record<string, unknown>;
}

export class AgentRegistry {
  private redis: Redis;
  private agents: Map<string, AgentInfo> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly AGENT_PREFIX = `${appConfig.redis.keyPrefix}agents:`;
  private readonly AGENT_LIST_KEY = `${appConfig.redis.keyPrefix}agent_list`;

  constructor(redis: Redis) {
    this.redis = redis;
    this.initializeHealthCheck();
  }

  async register(registration: AgentRegistration): Promise<AgentInfo> {
    const agentId = uuidv4();
    const now = new Date().toISOString();

    const agentInfo: AgentInfo = {
      agentId,
      name: registration.name,
      description: registration.description,
      capabilities: registration.capabilities,
      endpoint: registration.endpoint,
      status: 'idle',
      health: {
        lastCheck: now,
        isHealthy: true,
        responseTimeMs: 0,
        errorCount: 0,
        successCount: 0,
        successRate: 1.0,
      },
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTimeMs: 0,
        lastUsed: now,
      },
      metadata: registration.metadata || {},
      version: registration.version || '1.0.0',
      registeredAt: now,
      updatedAt: now,
    };

    await this.redis.hset(
      `${this.AGENT_PREFIX}${agentId}`,
      'data',
      JSON.stringify(agentInfo)
    );
    await this.redis.sadd(this.AGENT_LIST_KEY, agentId);

    this.agents.set(agentId, agentInfo);

    logger.info('Agent registered', {
      agentId,
      name: registration.name,
      capabilities: registration.capabilities,
    });

    return agentInfo;
  }

  async unregister(agentId: string): Promise<boolean> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      return false;
    }

    await this.redis.del(`${this.AGENT_PREFIX}${agentId}`);
    await this.redis.srem(this.AGENT_LIST_KEY, agentId);
    this.agents.delete(agentId);

    logger.info('Agent unregistered', { agentId, name: agent.name });

    return true;
  }

  async getAgent(agentId: string): Promise<AgentInfo | null> {
    const cached = this.agents.get(agentId);
    if (cached) {
      return cached;
    }

    const data = await this.redis.hget(`${this.AGENT_PREFIX}${agentId}`, 'data');
    if (!data) {
      return null;
    }

    const agent = JSON.parse(data) as AgentInfo;
    this.agents.set(agentId, agent);
    return agent;
  }

  async getAllAgents(): Promise<AgentInfo[]> {
    const agentIds = await this.redis.smembers(this.AGENT_LIST_KEY);
    const agents: AgentInfo[] = [];

    for (const agentId of agentIds) {
      const agent = await this.getAgent(agentId);
      if (agent) {
        agents.push(agent);
      }
    }

    return agents;
  }

  async getAgentsByCapabilities(
    requiredCapabilities: AgentCapability[]
  ): Promise<AgentInfo[]> {
    const allAgents = await this.getAllAgents();
    return allAgents.filter((agent) => {
      if (agent.status === 'unavailable' || agent.status === 'error') {
        return false;
      }
      return requiredCapabilities.every((cap) =>
        agent.capabilities.includes(cap)
      );
    });
  }

  async getAvailableAgents(): Promise<AgentInfo[]> {
    const allAgents = await this.getAllAgents();
    return allAgents.filter(
      (agent) =>
        agent.status === 'idle' && agent.health.isHealthy
    );
  }

  async updateAgentStatus(
    agentId: string,
    status: AgentStatus
  ): Promise<AgentInfo | null> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      return null;
    }

    agent.status = status;
    agent.updatedAt = new Date().toISOString();

    await this.saveAgent(agent);

    logger.debug('Agent status updated', { agentId, status });

    return agent;
  }

  async updateAgentHealth(
    agentId: string,
    health: Partial<AgentInfo['health']>
  ): Promise<AgentInfo | null> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      return null;
    }

    agent.health = { ...agent.health, ...health };
    agent.updatedAt = new Date().toISOString();

    await this.saveAgent(agent);

    return agent;
  }

  async recordRequest(
    agentId: string,
    success: boolean,
    responseTimeMs: number
  ): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      return;
    }

    agent.metrics.totalRequests++;
    if (success) {
      agent.metrics.successfulRequests++;
      agent.health.successCount++;
    } else {
      agent.metrics.failedRequests++;
      agent.health.errorCount++;
    }

    agent.health.successRate =
      agent.health.successCount /
      (agent.health.successCount + agent.health.errorCount);

    const totalResponseTime =
      agent.metrics.averageResponseTimeMs * (agent.metrics.totalRequests - 1) +
      responseTimeMs;
    agent.metrics.averageResponseTimeMs = totalResponseTime / agent.metrics.totalRequests;

    agent.metrics.lastUsed = new Date().toISOString();

    await this.saveAgent(agent);
  }

  async findBestAgent(
    requiredCapabilities: AgentCapability[],
    preferredAgentIds?: string[],
    excludedAgentIds?: string[]
  ): Promise<AgentInfo | null> {
    let candidates = await this.getAgentsByCapabilities(requiredCapabilities);

    if (excludedAgentIds && excludedAgentIds.length > 0) {
      candidates = candidates.filter(
        (agent) => !excludedAgentIds.includes(agent.agentId)
      );
    }

    if (preferredAgentIds && preferredAgentIds.length > 0) {
      candidates.sort((a, b) => {
        const aPreferred = preferredAgentIds.includes(a.agentId) ? 1 : 0;
        const bPreferred = preferredAgentIds.includes(b.agentId) ? 1 : 0;
        return bPreferred - aPreferred;
      });
    }

    candidates.sort((a, b) => {
      const aScore = this.calculateAgentScore(a);
      const bScore = this.calculateAgentScore(b);
      return bScore - aScore;
    });

    return candidates[0] || null;
  }

  private calculateAgentScore(agent: AgentInfo): number {
    let score = 100;

    // Penalize high error rates
    score -= (1 - agent.health.successRate) * 50;

    // Penalize slow response times
    const avgResponseTime = agent.metrics.averageResponseTimeMs;
    if (avgResponseTime > appConfig.agent.maxResponseTimeMs) {
      score -= 30;
    } else if (avgResponseTime > appConfig.responseTime.thresholdMs) {
      score -= 15;
    }

    // Penalize busy agents
    if (agent.status === 'busy') {
      score -= 20;
    }

    // Bonus for recent activity (keeps agents warm)
    const lastUsed = new Date(agent.metrics.lastUsed).getTime();
    const now = Date.now();
    const minutesSinceLastUse = (now - lastUsed) / (1000 * 60);
    if (minutesSinceLastUse < 5) {
      score += 10;
    }

    return Math.max(0, score);
  }

  private async saveAgent(agent: AgentInfo): Promise<void> {
    await this.redis.hset(
      `${this.AGENT_PREFIX}${agent.agentId}`,
      'data',
      JSON.stringify(agent)
    );
    this.agents.set(agent.agentId, agent);
  }

  private initializeHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, appConfig.agent.healthCheckIntervalMs);
  }

  private async performHealthChecks(): Promise<void> {
    const agents = await this.getAllAgents();

    for (const agent of agents) {
      try {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), appConfig.agent.healthCheckTimeoutMs);

        const response = await fetch(`${agent.endpoint}/health`, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const responseTimeMs = Date.now() - startTime;
        const isHealthy = response.ok;

        await this.updateAgentHealth(agent.agentId, {
          lastCheck: new Date().toISOString(),
          isHealthy,
          responseTimeMs,
        });

        if (!isHealthy) {
          await this.updateAgentStatus(agent.agentId, 'error');
        }
      } catch (error) {
        await this.updateAgentHealth(agent.agentId, {
          lastCheck: new Date().toISOString(),
          isHealthy: false,
        });
        await this.updateAgentStatus(agent.agentId, 'error');

        logger.warn('Agent health check failed', {
          agentId: agent.agentId,
          name: agent.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  getMetrics(): {
    totalAgents: number;
    availableAgents: number;
    agentsByStatus: Record<AgentStatus, number>;
  } {
    const agents = Array.from(this.agents.values());
    const agentsByStatus: Record<AgentStatus, number> = {
      idle: 0,
      busy: 0,
      unavailable: 0,
      error: 0,
      maintenance: 0,
    };

    agents.forEach((agent) => {
      agentsByStatus[agent.status]++;
    });

    return {
      totalAgents: agents.length,
      availableAgents: agents.filter(
        (a) => a.status === 'idle' && a.health.isHealthy
      ).length,
      agentsByStatus,
    };
  }
}

export const createAgentRegistry = (redis: Redis): AgentRegistry => {
  return new AgentRegistry(redis);
};
