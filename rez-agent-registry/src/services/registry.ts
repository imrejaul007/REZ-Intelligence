import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';

export interface ExpertCapability {
  name: string;
  description: string;
  parameters?: Record<string, {
    type: string;
    required: boolean;
    default?: unknown;
  }>;
}

export interface ExpertMetrics {
  requestsHandled: number;
  avgResponseTimeMs: number;
  successRate: number;
  lastUsed: string;
  uptimeSeconds: number;
}

export interface ExpertInfo {
  id: string;
  name: string;
  type: string;
  description: string;
  version: string;
  capabilities: ExpertCapability[];
  endpoints: {
    health: string;
    process: string;
    metadata?: string;
  };
  metadata: {
    author?: string;
    tags?: string[];
    category?: string;
    industries?: string[];
  };
  status: 'active' | 'inactive' | 'draining' | 'error';
  health: {
    healthy: boolean;
    lastChecked: string;
    responseTimeMs?: number;
    error?: string;
  };
  metrics: ExpertMetrics;
  registeredAt: string;
  lastHeartbeat: string;
  ttlSeconds: number;
}

export interface RegistryConfig {
  redis: Redis;
  heartbeatIntervalMs: number;
  heartbeatTtlSeconds: number;
  staleThresholdMs: number;
}

export class Registry {
  private redis: Redis;
  private config: RegistryConfig;
  private registeredExperts: Map<string, ExpertInfo> = new Map();

  constructor(config: RegistryConfig) {
    this.redis = config.redis;
    this.config = config;
  }

  /**
   * Register a new expert agent
   */
  async registerExpert(expert: Omit<ExpertInfo, 'registeredAt' | 'lastHeartbeat'>): Promise<ExpertInfo> {
    const now = new Date().toISOString();

    const expertInfo: ExpertInfo = {
      ...expert,
      registeredAt: now,
      lastHeartbeat: now,
    };

    // Store in Redis
    const key = `registry:expert:${expert.id}`;
    await this.redis.setex(key, this.config.heartbeatTtlSeconds, JSON.stringify(expertInfo));

    // Add to in-memory cache
    this.registeredExperts.set(expert.id, expertInfo);

    // Add to sorted set by name for quick listing
    await this.redis.zadd('registry:experts:by_name', 0, expert.id);

    logger.info('Expert registered', { expertId: expert.id, name: expert.name, type: expert.type });

    return expertInfo;
  }

  /**
   * Unregister an expert agent
   */
  async unregisterExpert(expertId: string): Promise<boolean> {
    const key = `registry:expert:${expertId}`;

    // Check if exists
    const exists = await this.redis.exists(key);
    if (!exists) {
      logger.warn('Attempted to unregister non-existent expert', { expertId });
      return false;
    }

    // Remove from Redis
    await this.redis.del(key);
    await this.redis.zrem('registry:experts:by_name', expertId);

    // Remove from cache
    this.registeredExperts.delete(expertId);

    logger.info('Expert unregistered', { expertId });

    return true;
  }

  /**
   * Get expert by ID
   */
  async getExpert(expertId: string): Promise<ExpertInfo | null> {
    const key = `registry:expert:${expertId}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as ExpertInfo;
  }

  /**
   * Update expert heartbeat
   */
  async updateHeartbeat(expertId: string, metrics?: Partial<ExpertMetrics>): Promise<boolean> {
    const expert = await this.getExpert(expertId);

    if (!expert) {
      logger.warn('Heartbeat from unregistered expert', { expertId });
      return false;
    }

    const now = new Date().toISOString();

    const updatedExpert: ExpertInfo = {
      ...expert,
      lastHeartbeat: now,
      health: {
        ...expert.health,
        lastChecked: now,
        healthy: true,
      },
      metrics: metrics ? {
        ...expert.metrics,
        ...metrics,
      } : expert.metrics,
    };

    const key = `registry:expert:${expertId}`;
    await this.redis.setex(key, this.config.heartbeatTtlSeconds, JSON.stringify(updatedExpert));

    // Update cache
    this.registeredExperts.set(expertId, updatedExpert);

    return true;
  }

  /**
   * Update expert status
   */
  async updateExpertStatus(
    expertId: string,
    status: ExpertInfo['status'],
    error?: string
  ): Promise<boolean> {
    const expert = await this.getExpert(expertId);

    if (!expert) {
      return false;
    }

    const updatedExpert: ExpertInfo = {
      ...expert,
      status,
      health: {
        ...expert.health,
        healthy: status === 'active',
        error,
        lastChecked: new Date().toISOString(),
      },
    };

    const key = `registry:expert:${expertId}`;
    await this.redis.setex(key, this.config.heartbeatTtlSeconds, JSON.stringify(updatedExpert));

    this.registeredExperts.set(expertId, updatedExpert);

    logger.info('Expert status updated', { expertId, status, error });

    return true;
  }

  /**
   * Get all registered experts
   */
  async getAllExperts(filters?: {
    type?: string;
    status?: ExpertInfo['status'];
    category?: string;
  }): Promise<ExpertInfo[]> {
    const expertIds = await this.redis.zrange('registry:experts:by_name', 0, -1);

    const experts: ExpertInfo[] = [];

    for (const id of expertIds) {
      const expert = await this.getExpert(id);
      if (expert) {
        // Apply filters
        if (filters?.type && expert.type !== filters.type) continue;
        if (filters?.status && expert.status !== filters.status) continue;
        if (filters?.category && expert.metadata?.category !== filters.category) continue;

        experts.push(expert);
      }
    }

    return experts;
  }

  /**
   * Get experts by capability
   */
  async getExpertsByCapability(capabilityName: string): Promise<ExpertInfo[]> {
    const allExperts = await this.getAllExperts({ status: 'active' });

    return allExperts.filter(expert =>
      expert.capabilities.some(cap => cap.name === capabilityName)
    );
  }

  /**
   * Find best expert for a task
   */
  async findBestExpert(
    capability: string,
    criteria?: {
      minSuccessRate?: number;
      maxResponseTimeMs?: number;
    }
  ): Promise<ExpertInfo | null> {
    const capableExperts = await this.getExpertsByCapability(capability);

    if (capableExperts.length === 0) {
      return null;
    }

    // Filter by criteria
    let candidates = capableExperts;

    if (criteria?.minSuccessRate !== undefined) {
      candidates = candidates.filter(e => e.metrics.successRate >= criteria.minSuccessRate!);
    }

    if (criteria?.maxResponseTimeMs !== undefined) {
      candidates = candidates.filter(e => e.metrics.avgResponseTimeMs <= criteria.maxResponseTimeMs!);
    }

    // Sort by success rate, then by response time
    candidates.sort((a, b) => {
      const successDiff = b.metrics.successRate - a.metrics.successRate;
      if (successDiff !== 0) return successDiff;
      return a.metrics.avgResponseTimeMs - b.metrics.avgResponseTimeMs;
    });

    return candidates[0] || null;
  }

  /**
   * Get expert statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    avgSuccessRate: number;
    avgResponseTimeMs: number;
    totalRequestsHandled: number;
  }> {
    const experts = await this.getAllExperts();

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalSuccessRate = 0;
    let totalResponseTime = 0;
    let totalRequests = 0;

    for (const expert of experts) {
      byStatus[expert.status] = (byStatus[expert.status] || 0) + 1;
      byType[expert.type] = (byType[expert.type] || 0) + 1;
      totalSuccessRate += expert.metrics.successRate;
      totalResponseTime += expert.metrics.avgResponseTimeMs;
      totalRequests += expert.metrics.requestsHandled;
    }

    const activeCount = byStatus['active'] || 0;

    return {
      total: experts.length,
      byStatus,
      byType,
      avgSuccessRate: activeCount > 0 ? totalSuccessRate / activeCount : 0,
      avgResponseTimeMs: activeCount > 0 ? totalResponseTime / activeCount : 0,
      totalRequestsHandled: totalRequests,
    };
  }

  /**
   * Remove stale experts (those that haven't sent heartbeat)
   */
  async removeStaleExperts(): Promise<string[]> {
    const experts = await this.getAllExperts();
    const staleIds: string[] = [];
    const staleThreshold = Date.now() - this.config.staleThresholdMs;

    for (const expert of experts) {
      const lastHeartbeat = new Date(expert.lastHeartbeat).getTime();

      if (lastHeartbeat < staleThreshold) {
        await this.unregisterExpert(expert.id);
        staleIds.push(expert.id);

        logger.warn('Removed stale expert', {
          expertId: expert.id,
          name: expert.name,
          lastHeartbeat: expert.lastHeartbeat,
        });
      }
    }

    return staleIds;
  }

  /**
   * Sync cache from Redis
   */
  async syncCache(): Promise<void> {
    const expertIds = await this.redis.zrange('registry:experts:by_name', 0, -1);

    this.registeredExperts.clear();

    for (const id of expertIds) {
      const expert = await this.getExpert(id);
      if (expert) {
        this.registeredExperts.set(id, expert);
      }
    }

    logger.info('Registry cache synced', { count: this.registeredExperts.size });
  }

  /**
   * Get cached expert count
   */
  getCachedCount(): number {
    return this.registeredExperts.size;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, unknown> }> {
    const details: Record<string, unknown> = {};

    try {
      await this.redis.ping();
      details.redis = 'healthy';
    } catch (error) {
      details.redis = 'unhealthy';
    }

    const stats = await this.getStatistics();
    details.expertCount = stats.total;
    details.activeExperts = stats.byStatus['active'] || 0;

    const healthy = details.redis === 'healthy' && stats.total > 0;

    return { healthy, details };
  }

  /**
   * Shutdown the registry
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down registry');
    this.registeredExperts.clear();
  }
}
