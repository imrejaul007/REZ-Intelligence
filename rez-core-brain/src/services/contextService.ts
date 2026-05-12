import Redis from 'ioredis';
import {
  ContextualData,
  IContextualDataDocument,
} from '../models/GlobalPersonalization';
import { getRedisConfig } from '../config';
import { logger } from '../utils/logger';

export interface SharedContext {
  userId: string;
  agentId?: string;
  sessionId?: string;
  data: Record<string, unknown>;
  expiresIn?: number;
}

export interface ContextUpdate {
  location?: string;
  device?: string;
  browser?: string;
  os?: string;
  appVersion?: string;
  sessionId?: string;
}

export class ContextService {
  private redis: Redis | null = null;
  private contextKeyPrefix = 'context:';
  private sharedKeyPrefix = 'shared:';
  private defaultTTL = 3600; // 1 hour

  constructor() {
    this.initRedis();
  }

  private async initRedis(): Promise<void> {
    try {
      const redisConfig = getRedisConfig();
      this.redis = new Redis({
        host: redisConfig.url.replace('redis://', '').split(':')[0],
        port: parseInt(redisConfig.url.split(':')[2] || '6379', 10),
        password: redisConfig.password || undefined,
        db: redisConfig.db,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });

      this.redis.on('error', (err) => {
        logger.error('Redis connection error in ContextService', { error: err.message });
      });

      logger.info('ContextService Redis initialized');
    } catch (error) {
      logger.warn('Redis not available for ContextService');
    }
  }

  /**
   * Get contextual data for a user
   */
  async getContextualData(userId: string): Promise<IContextualDataDocument | null> {
    return ContextualData.findOne({ userId });
  }

  /**
   * Get or create contextual data for a user
   */
  async getOrCreateContextualData(userId: string): Promise<IContextualDataDocument> {
    let data = await ContextualData.findOne({ userId });

    if (!data) {
      // Update temporal context on creation
      const now = new Date();
      const dayOfWeek = now.getDay();
      const hour = now.getHours();
      let timeOfDay: string;

      if (hour >= 5 && hour < 12) {
        timeOfDay = 'morning';
      } else if (hour >= 12 && hour < 17) {
        timeOfDay = 'afternoon';
      } else if (hour >= 17 && hour < 21) {
        timeOfDay = 'evening';
      } else {
        timeOfDay = 'night';
      }

      const month = now.getMonth();
      let season: string;
      if (month >= 2 && month <= 4) season = 'spring';
      else if (month >= 5 && month <= 7) season = 'summer';
      else if (month >= 8 && month <= 10) season = 'autumn';
      else season = 'winter';

      data = await ContextualData.create({
        userId,
        currentContext: {},
        recentActivity: {},
        temporalContext: {
          dayOfWeek,
          timeOfDay,
          isHoliday: false,
          season,
        },
        relationships: {
          activeAgents: [],
          recentIntents: [],
          pendingTasks: [],
        },
      });

      logger.info(`Created contextual data for user: ${userId}`);
    }

    return data;
  }

  /**
   * Update contextual data for a user
   */
  async updateContextualData(
    userId: string,
    update: ContextUpdate
  ): Promise<IContextualDataDocument | null> {
    const data = await this.getOrCreateContextualData(userId);

    if (update.location) data.currentContext.location = update.location;
    if (update.device) data.currentContext.device = update.device;
    if (update.browser) data.currentContext.browser = update.browser;
    if (update.os) data.currentContext.os = update.os;
    if (update.appVersion) data.currentContext.appVersion = update.appVersion;
    if (update.sessionId) data.currentContext.sessionId = update.sessionId;

    await data.save();
    logger.info(`Updated contextual data for user: ${userId}`);

    return data;
  }

  /**
   * Update recent activity
   */
  async updateRecentActivity(
    userId: string,
    action: string,
    agent?: string,
    topic?: string,
    search?: string
  ): Promise<void> {
    const data = await this.getOrCreateContextualData(userId);

    if (action) data.recentActivity.lastAction = action;
    if (agent) data.recentActivity.lastAgent = agent;
    if (topic) data.recentActivity.lastTopic = topic;
    if (search) data.recentActivity.lastSearch = search;

    await data.save();
  }

  /**
   * Add an active agent for a user
   */
  async addActiveAgent(userId: string, agentId: string): Promise<void> {
    const data = await this.getOrCreateContextualData(userId);
    await data.addActiveAgent(agentId);
    logger.info(`Added active agent ${agentId} for user: ${userId}`);
  }

  /**
   * Remove an active agent for a user
   */
  async removeActiveAgent(userId: string, agentId: string): Promise<void> {
    const data = await ContextualData.findOne({ userId });
    if (data) {
      await data.removeActiveAgent(agentId);
      logger.info(`Removed active agent ${agentId} for user: ${userId}`);
    }
  }

  /**
   * Add a pending task for a user
   */
  async addPendingTask(userId: string, taskId: string): Promise<void> {
    const data = await this.getOrCreateContextualData(userId);
    if (!data.relationships.pendingTasks.includes(taskId)) {
      data.relationships.pendingTasks.push(taskId);
      await data.save();
    }
  }

  /**
   * Remove a pending task for a user
   */
  async removePendingTask(userId: string, taskId: string): Promise<void> {
    const data = await ContextualData.findOne({ userId });
    if (data) {
      data.relationships.pendingTasks = data.relationships.pendingTasks.filter(
        (t: string) => t !== taskId
      );
      await data.save();
    }
  }

  // Shared context operations (Redis)

  /**
   * Store shared context (accessible by multiple agents)
   */
  async setSharedContext(input: SharedContext): Promise<void> {
    const { userId, agentId, sessionId, data, expiresIn } = input;

    if (!this.redis) {
      logger.warn('Redis not available for shared context');
      return;
    }

    const key = this.buildSharedKey(userId, sessionId, agentId);
    const ttl = expiresIn || this.defaultTTL;

    await this.redis.setex(key, ttl, JSON.stringify(data));
    logger.info(`Set shared context for ${key}`, { ttl });
  }

  /**
   * Get shared context
   */
  async getSharedContext(
    userId: string,
    sessionId?: string,
    agentId?: string
  ): Promise<Record<string, unknown> | null> {
    if (!this.redis) {
      logger.warn('Redis not available for shared context');
      return null;
    }

    const key = this.buildSharedKey(userId, sessionId, agentId);
    const data = await this.redis.get(key);

    if (data) {
      return JSON.parse(data);
    }

    return null;
  }

  /**
   * Update shared context (merge with existing)
   */
  async updateSharedContext(
    userId: string,
    updates: Record<string, unknown>,
    sessionId?: string,
    agentId?: string
  ): Promise<Record<string, unknown> | null> {
    if (!this.redis) {
      logger.warn('Redis not available for shared context');
      return null;
    }

    const key = this.buildSharedKey(userId, sessionId, agentId);
    const existing = await this.redis.get(key);

    let data: Record<string, unknown> = existing ? JSON.parse(existing) : {};
    data = { ...data, ...updates };

    await this.redis.setex(key, this.defaultTTL, JSON.stringify(data));

    return data;
  }

  /**
   * Delete shared context
   */
  async deleteSharedContext(
    userId: string,
    sessionId?: string,
    agentId?: string
  ): Promise<void> {
    if (!this.redis) return;

    const key = this.buildSharedKey(userId, sessionId, agentId);
    await this.redis.del(key);
    logger.info(`Deleted shared context: ${key}`);
  }

  /**
   * Get all shared contexts for a user
   */
  async getAllUserContexts(userId: string): Promise<Record<string, unknown>[]> {
    if (!this.redis) return [];

    const pattern = `${this.sharedKeyPrefix}${userId}:*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length === 0) return [];

    const values = await this.redis.mget(keys);
    return values
      .filter((v): v is string => v !== null)
      .map((v) => JSON.parse(v));
  }

  /**
   * Share context between agents
   */
  async shareBetweenAgents(
    fromAgentId: string,
    toAgentId: string,
    userId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const key = `${this.contextKeyPrefix}agent_transfer:${userId}:${fromAgentId}:${toAgentId}`;

    if (this.redis) {
      await this.redis.setex(key, 300, JSON.stringify(data)); // 5 min TTL for agent transfers
      logger.info(`Shared context from ${fromAgentId} to ${toAgentId}`);
    }
  }

  /**
   * Get context transferred between agents
   */
  async getAgentTransfer(
    fromAgentId: string,
    toAgentId: string,
    userId: string
  ): Promise<Record<string, unknown> | null> {
    if (!this.redis) return null;

    const key = `${this.contextKeyPrefix}agent_transfer:${userId}:${fromAgentId}:${toAgentId}`;
    const data = await this.redis.get(key);

    if (data) {
      await this.redis.del(key); // Consume the transfer
      return JSON.parse(data);
    }

    return null;
  }

  /**
   * Update temporal context (called periodically or on request)
   */
  async updateTemporalContext(userId: string): Promise<void> {
    const data = await this.getOrCreateContextualData(userId);

    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();

    let timeOfDay: string;
    if (hour >= 5 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
    else timeOfDay = 'night';

    data.temporalContext.dayOfWeek = dayOfWeek;
    data.temporalContext.timeOfDay = timeOfDay;

    await data.save();
  }

  /**
   * Build shared context key
   */
  private buildSharedKey(
    userId: string,
    sessionId?: string,
    agentId?: string
  ): string {
    let key = `${this.sharedKeyPrefix}${userId}`;
    if (sessionId) key += `:session:${sessionId}`;
    if (agentId) key += `:agent:${agentId}`;
    return key;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

// Export singleton instance
export const contextService = new ContextService();
export default contextService;
