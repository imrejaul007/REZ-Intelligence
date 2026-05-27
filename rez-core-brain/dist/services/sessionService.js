"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionService = exports.SessionService = void 0;
const uuid_1 = require("uuid");
const ioredis_1 = __importDefault(require("ioredis"));
const SessionContext_1 = require("../models/SessionContext");
const config_1 = require("../config");
const logger_js_1 = require("../utils/logger.js");
class SessionService {
    redis = null;
    redisKeyPrefix = 'session:';
    constructor() {
        this.initRedis();
    }
    async initRedis() {
        try {
            const redisConfig = (0, config_1.getRedisConfig)();
            this.redis = new ioredis_1.default(redisConfig.url, {
                password: redisConfig.password || undefined,
                db: redisConfig.db ?? 0,
                retryStrategy: (times) => Math.min(times * 100, 3000),
                maxRetriesPerRequest: 3,
            });
            this.redis.on('error', (err) => {
                logger_js_1.logger.error('Redis connection error in SessionService', { error: err.message });
            });
            logger_js_1.logger.info('SessionService Redis initialized');
        }
        catch (error) {
            logger_js_1.logger.warn('Redis not available, falling back to MongoDB only');
        }
    }
    /**
     * Create a new session
     */
    async createSession(input) {
        const { userId, agentId, context = {}, metadata } = input;
        // Check concurrent session limit
        const activeCount = await SessionContext_1.Session.getActiveCount(userId);
        if (activeCount >= config_1.config.MAX_CONCURRENT_SESSIONS) {
            // End oldest active session
            const oldestSession = await SessionContext_1.Session.findOne({ userId, state: SessionContext_1.SessionState.ACTIVE })
                .sort({ startTime: 1 });
            if (oldestSession) {
                await oldestSession.end();
                logger_js_1.logger.info(`Ended oldest session ${oldestSession.id} due to limit`);
            }
        }
        const sessionId = `sess_${(0, uuid_1.v4)()}`;
        const session = await SessionContext_1.Session.create({
            id: sessionId,
            userId,
            agentId,
            startTime: new Date(),
            state: SessionContext_1.SessionState.ACTIVE,
            context,
            metadata,
        });
        // Cache in Redis if available
        await this.cacheSession(session);
        logger_js_1.logger.info(`Session created: ${sessionId}`, { userId, agentId });
        return session;
    }
    /**
     * Get a session by ID
     */
    async getSession(sessionId, userId) {
        // Try Redis first
        if (this.redis) {
            const cached = await this.getCachedSession(sessionId);
            if (cached) {
                return cached;
            }
        }
        const filter = { id: sessionId };
        if (userId) {
            filter.userId = userId;
        }
        const session = await SessionContext_1.Session.findOne(filter);
        if (session) {
            await session.touch();
            await this.cacheSession(session);
        }
        return session;
    }
    /**
     * Get or create a session for a user
     */
    async getOrCreateSession(userId, agentId) {
        let session = await SessionContext_1.Session.findActiveByUser(userId);
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
    async getUserSessions(userId, options = {}) {
        return SessionContext_1.Session.findByUser(userId, options);
    }
    /**
     * Update session context
     */
    async updateSession(sessionId, userId, input) {
        const session = await SessionContext_1.Session.findOne({ id: sessionId, userId });
        if (!session) {
            return null;
        }
        if (input.context !== undefined) {
            session.context = { ...session.context, ...input.context };
        }
        if (input.metadata !== undefined) {
            session.metadata = input.metadata;
        }
        await session.save();
        await this.cacheSession(session);
        logger_js_1.logger.info(`Session updated: ${sessionId}`);
        return session;
    }
    /**
     * Add context to a session
     */
    async addContext(sessionId, userId, key, value) {
        const session = await SessionContext_1.Session.findOne({ id: sessionId, userId });
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
    async removeContext(sessionId, userId, key) {
        const session = await SessionContext_1.Session.findOne({ id: sessionId, userId });
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
    async pauseSession(sessionId, userId) {
        const session = await SessionContext_1.Session.findOne({ id: sessionId, userId });
        if (!session) {
            return null;
        }
        try {
            await session.pause();
            await this.invalidateCache(sessionId);
            logger_js_1.logger.info(`Session paused: ${sessionId}`);
            return session;
        }
        catch (error) {
            logger_js_1.logger.error(`Failed to pause session: ${sessionId}`, { error });
            return null;
        }
    }
    /**
     * Resume a session
     */
    async resumeSession(sessionId, userId) {
        const session = await SessionContext_1.Session.findOne({ id: sessionId, userId });
        if (!session) {
            return null;
        }
        try {
            await session.resume();
            await this.cacheSession(session);
            logger_js_1.logger.info(`Session resumed: ${sessionId}`);
            return session;
        }
        catch (error) {
            logger_js_1.logger.error(`Failed to resume session: ${sessionId}`, { error });
            return null;
        }
    }
    /**
     * End a session
     */
    async endSession(sessionId, userId) {
        const session = await SessionContext_1.Session.findOne({ id: sessionId, userId });
        if (!session) {
            return null;
        }
        try {
            await session.end();
            await this.invalidateCache(sessionId);
            logger_js_1.logger.info(`Session ended: ${sessionId}`);
            return session;
        }
        catch (error) {
            logger_js_1.logger.error(`Failed to end session: ${sessionId}`, { error });
            return null;
        }
    }
    /**
     * End all active sessions for a user
     */
    async endAllUserSessions(userId) {
        const count = await SessionContext_1.Session.endAllActive(userId);
        logger_js_1.logger.info(`Ended ${count} active sessions for user: ${userId}`);
        return count;
    }
    /**
     * Get active session count for a user
     */
    async getActiveSessionCount(userId) {
        return SessionContext_1.Session.getActiveCount(userId);
    }
    /**
     * Cleanup stale sessions
     */
    async cleanupStaleSessions() {
        const count = await SessionContext_1.Session.cleanupStaleSessions(config_1.config.SESSION_TTL);
        logger_js_1.logger.info(`Cleaned up ${count} stale sessions`);
        return count;
    }
    /**
     * Get session statistics
     */
    async getSessionStats(userId) {
        const sessions = await SessionContext_1.Session.find({ userId });
        let active = 0;
        let paused = 0;
        let totalDuration = 0;
        let durationCount = 0;
        for (const session of sessions) {
            if (session.state === SessionContext_1.SessionState.ACTIVE)
                active++;
            if (session.state === SessionContext_1.SessionState.PAUSED)
                paused++;
            if (session.endTime) {
                const endTime = session.endTime instanceof Date ? session.endTime : new Date(session.endTime);
                const startTime = session.startTime instanceof Date ? session.startTime : new Date(session.startTime);
                totalDuration += endTime.getTime() - startTime.getTime();
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
    async cacheSession(session) {
        if (!this.redis)
            return;
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
            await this.redis.setex(key, config_1.config.SESSION_TTL, data);
        }
        catch (error) {
            logger_js_1.logger.warn('Failed to cache session', { error, sessionId: session.id });
        }
    }
    async getCachedSession(sessionId) {
        if (!this.redis)
            return null;
        try {
            const key = `${this.redisKeyPrefix}${sessionId}`;
            const data = await this.redis.get(key);
            if (data) {
                const parsed = JSON.parse(data);
                // Update last accessed time in MongoDB
                await SessionContext_1.Session.findOneAndUpdate({ id: sessionId }, { $set: { startTime: new Date() } });
                return parsed;
            }
        }
        catch (error) {
            logger_js_1.logger.warn('Failed to get cached session', { error, sessionId });
        }
        return null;
    }
    async invalidateCache(sessionId) {
        if (!this.redis)
            return;
        try {
            const key = `${this.redisKeyPrefix}${sessionId}`;
            await this.redis.del(key);
        }
        catch (error) {
            logger_js_1.logger.warn('Failed to invalidate session cache', { error, sessionId });
        }
    }
    /**
     * Close Redis connection
     */
    async close() {
        if (this.redis) {
            await this.redis.quit();
        }
    }
}
exports.SessionService = SessionService;
// Export singleton instance
exports.sessionService = new SessionService();
exports.default = exports.sessionService;
//# sourceMappingURL=sessionService.js.map