import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { Session, ISessionDocument, SessionState } from '../models/SessionContext';
import { config, getRedisConfig } from '../config';
import { logger } from '../utils/logger';

export interface CreateSessionInput {
  userId: string;
  agentId?: string;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateSessionInput {
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export class SessionService {
  private redis: Redis | null = null;
  private redisKeyPrefix = 'session:';

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
        logger.error('Redis connection error in SessionService', { error: err.message });
      });

      logger.info('SessionService Redis initialized');
    } catch (error) {
      logger.warn('Redis not available, falling back to MongoDB only');
    }
  }

  /**
   * Create a new session
   */
  async createSession(input: CreateSessionInput): Promise<ISessionDocument> {
    const { userId, agentId, context = {}, metadata } = input;

    // Check concurrent session limit
    const activeCount = await Session.getActiveCount(userId);
    if (activeCount >= config.MAX_CONCURRENT_SESSIONS) {
      // End oldest active session
      const oldestSession = await Session.findOne({ userId, state: SessionState.ACTIVE })
        .sort({ startTime: 1 });
      if (oldestSession) {
        await oldestSession.end();
        logger.info(`Ended oldest session ${oldestSession.id} due to limit`);
      }
    }

    const sessionId = `sess_${uuidv4()}`;

    const session = await Session.create({
      id: sessionId,
      userId,
      agentId,
      startTime: new Date(),
      state: SessionState.ACTIVE,
      context,
      metadata,
    });

    // Cache in Redis if available
    await this.cacheSession(session);

    logger.info(`Session created: ${sessionId}`, { userId, agentId });

    return session;
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string, userId?: string): Promise<ISessionDocument | null> {
    // Try Redis first
    if (this.redis) {
      const cached = await this.getCachedSession(sessionId);
      if (cached) {
        return cached;
      }
    }

    const filter: Record<string, unknown> = { id: sessionId };
    if (userId) {
      filter.userId = userId;
    }

    const session = await Session.findOne(filter);
    if (session) {
      await session.touch();
      await this.cacheSession(session);
    }

    return session;
  }

  /**
   * Get or create a session for a user
   */
  async getOrCreateSession(
    userId: string,
    agentId?: string
  ): Promise<ISessionDocument> {
    let session = await Session.findActiveByUser(userId);

    if (!session) {
      session = await this.createSession({ userId, agentId });
    }

    if (agentId && session.agentId !== agentId) {
      session.agentId = agentId;
      await session.save();
    }

    return session;
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(
    userId: string,
    options: {
      state?: SessionState;
      limit?: number;
      skip?: number;
    } = {}
  ): Promise<ISessionDocument[]> {
    return Session.findByUser(userId, options);
  }

  /**
   * Update session context
   */
  async updateSession(
    sessionId: string,
    userId: string,
    input: UpdateSessionInput
  ): Promise<ISessionDocument | null> {
    const session = await Session.findOne({ id: sessionId, userId });
    if (!session) {
      return null;
    }

    if (input.context !== undefined) {
      session.context = { ...(session.context as Record<string, unknown>), ...input.context };
    }
    if (input.metadata !== undefined) {
      session.metadata = input.metadata;
    }

    await session.save();
    await this.cacheSession(session);

    logger.info(`Session updated: ${sessionId}`);

    return session;
  }

  /**
   * Add context to a session
   */
  async addContext(
    sessionId: string,
    userId: string,
    key: string,
    value: unknown
  ): Promise<ISessionDocument | null> {
    const session = await Session.findOne({ id: sessionId, userId });
    if (!session) {
      return null;
    }

    await session.addContext(key, value);
    await this.cacheSession(session);

    return session;
  }

  /**
   * Remove context from a session
   */
  async removeContext(
    sessionId: string,
    userId: string,
    key: string
  ): Promise<ISessionDocument | null> {
    const session = await Session.findOne({ id: sessionId, userId });
    if (!session) {
      return null;
    }

    await session.removeContext(key);
    await this.cacheSession(session);

    return session;
  }

  /**
   * Pause a session
   */
  async pauseSession(sessionId: string, userId: string): Promise<ISessionDocument | null> {
    const session = await Session.findOne({ id: sessionId, userId });
    if (!session) {
      return null;
    }

    try {
      await session.pause();
      await this.invalidateCache(sessionId);
      logger.info(`Session paused: ${sessionId}`);
      return session;
    } catch (error) {
      logger.error(`Failed to pause session: ${sessionId}`, { error });
      return null;
    }
  }

  /**
   * Resume a session
   */
  async resumeSession(sessionId: string, userId: string): Promise<ISessionDocument | null> {
    const session = await Session.findOne({ id: sessionId, userId });
    if (!session) {
      return null;
    }

    try {
      await session.resume();
      await this.cacheSession(session);
      logger.info(`Session resumed: ${sessionId}`);
      return session;
    } catch (error) {
      logger.error(`Failed to resume session: ${sessionId}`, { error });
      return null;
    }
  }

  /**
   * End a session
   */
  async endSession(sessionId: string, userId: string): Promise<ISessionDocument | null> {
    const session = await Session.findOne({ id: sessionId, userId });
    if (!session) {
      return null;
    }

    try {
      await session.end();
      await this.invalidateCache(sessionId);
      logger.info(`Session ended: ${sessionId}`);
      return session;
    } catch (error) {
      logger.error(`Failed to end session: ${sessionId}`, { error });
      return null;
    }
  }

  /**
   * End all active sessions for a user
   */
  async endAllUserSessions(userId: string): Promise<number> {
    const count = await Session.endAllActive(userId);
    logger.info(`Ended ${count} active sessions for user: ${userId}`);
    return count;
  }

  /**
   * Get active session count for a user
   */
  async getActiveSessionCount(userId: string): Promise<number> {
    return Session.getActiveCount(userId);
  }

  /**
   * Cleanup stale sessions
   */
  async cleanupStaleSessions(): Promise<number> {
    const count = await Session.cleanupStaleSessions(config.SESSION_TTL);
    logger.info(`Cleaned up ${count} stale sessions`);
    return count;
  }

  /**
   * Get session statistics
   */
  async getSessionStats(userId: string): Promise<{
    total: number;
    active: number;
    paused: number;
    averageDuration: number;
  }> {
    const sessions = await Session.find({ userId });

    let active = 0;
    let paused = 0;
    let totalDuration = 0;
    let durationCount = 0;

    for (const session of sessions) {
      if (session.state === SessionState.ACTIVE) active++;
      if (session.state === SessionState.PAUSED) paused++;

      if (session.endTime) {
        totalDuration += session.duration as number;
        durationCount++;
      }
    }

    return {
      total: sessions.length,
      active,
      paused,
      averageDuration: durationCount > 0 ? totalDuration / durationCount : 0,
    };
  }

  // Redis caching methods
  private async cacheSession(session: ISessionDocument): Promise<void> {
    if (!this.redis) return;

    try {
      const key = `${this.redisKeyPrefix}${session.id}`;
      const data = JSON.stringify({
        id: session.id,
        userId: session.userId,
        agentId: session.agentId,
        state: session.state,
        context: session.context,
        startTime: session.startTime.toISOString(),
      });

      await this.redis.setex(key, config.SESSION_TTL, data);
    } catch (error) {
      logger.warn('Failed to cache session', { error, sessionId: session.id });
    }
  }

  private async getCachedSession(sessionId: string): Promise<ISessionDocument | null> {
    if (!this.redis) return null;

    try {
      const key = `${this.redisKeyPrefix}${sessionId}`;
      const data = await this.redis.get(key);

      if (data) {
        const parsed = JSON.parse(data);
        // Update last accessed time in MongoDB
        await Session.findOneAndUpdate(
          { id: sessionId },
          { $set: { startTime: new Date() } }
        );
        return parsed as unknown as ISessionDocument;
      }
    } catch (error) {
      logger.warn('Failed to get cached session', { error, sessionId });
    }

    return null;
  }

  private async invalidateCache(sessionId: string): Promise<void> {
    if (!this.redis) return;

    try {
      const key = `${this.redisKeyPrefix}${sessionId}`;
      await this.redis.del(key);
    } catch (error) {
      logger.warn('Failed to invalidate session cache', { error, sessionId });
    }
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
export const sessionService = new SessionService();
export default sessionService;
