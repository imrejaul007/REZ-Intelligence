"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextService = exports.ContextService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const GlobalPersonalization_1 = require("../models/GlobalPersonalization");
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
class ContextService {
    redis = null;
    contextKeyPrefix = 'context:';
    sharedKeyPrefix = 'shared:';
    defaultTTL = 3600; // 1 hour
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
                logger_1.logger.error('Redis connection error in ContextService', { error: err.message });
            });
            logger_1.logger.info('ContextService Redis initialized');
        }
        catch (error) {
            logger_1.logger.warn('Redis not available for ContextService');
        }
    }
    /**
     * Get contextual data for a user
     */
    async getContextualData(userId) {
        return GlobalPersonalization_1.ContextualData.findOne({ userId });
    }
    /**
     * Get or create contextual data for a user
     */
    async getOrCreateContextualData(userId) {
        let data = await GlobalPersonalization_1.ContextualData.findOne({ userId });
        if (!data) {
            // Update temporal context on creation
            const now = new Date();
            const dayOfWeek = now.getDay();
            const hour = now.getHours();
            let timeOfDay;
            if (hour >= 5 && hour < 12) {
                timeOfDay = 'morning';
            }
            else if (hour >= 12 && hour < 17) {
                timeOfDay = 'afternoon';
            }
            else if (hour >= 17 && hour < 21) {
                timeOfDay = 'evening';
            }
            else {
                timeOfDay = 'night';
            }
            const month = now.getMonth();
            let season;
            if (month >= 2 && month <= 4)
                season = 'spring';
            else if (month >= 5 && month <= 7)
                season = 'summer';
            else if (month >= 8 && month <= 10)
                season = 'autumn';
            else
                season = 'winter';
            data = await GlobalPersonalization_1.ContextualData.create({
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
            logger_1.logger.info(`Created contextual data for user: ${userId}`);
        }
        return data;
    }
    /**
     * Update contextual data for a user
     */
    async updateContextualData(userId, update) {
        const data = await this.getOrCreateContextualData(userId);
        if (update.location)
            data.currentContext.location = update.location;
        if (update.device)
            data.currentContext.device = update.device;
        if (update.browser)
            data.currentContext.browser = update.browser;
        if (update.os)
            data.currentContext.os = update.os;
        if (update.appVersion)
            data.currentContext.appVersion = update.appVersion;
        if (update.sessionId)
            data.currentContext.sessionId = update.sessionId;
        await data.save();
        logger_1.logger.info(`Updated contextual data for user: ${userId}`);
        return data;
    }
    /**
     * Update recent activity
     */
    async updateRecentActivity(userId, action, agent, topic, search) {
        const data = await this.getOrCreateContextualData(userId);
        if (action)
            data.recentActivity.lastAction = action;
        if (agent)
            data.recentActivity.lastAgent = agent;
        if (topic)
            data.recentActivity.lastTopic = topic;
        if (search)
            data.recentActivity.lastSearch = search;
        await data.save();
    }
    /**
     * Add an active agent for a user
     */
    async addActiveAgent(userId, agentId) {
        const data = await this.getOrCreateContextualData(userId);
        await data.addActiveAgent(agentId);
        logger_1.logger.info(`Added active agent ${agentId} for user: ${userId}`);
    }
    /**
     * Remove an active agent for a user
     */
    async removeActiveAgent(userId, agentId) {
        const data = await GlobalPersonalization_1.ContextualData.findOne({ userId });
        if (data) {
            await data.removeActiveAgent(agentId);
            logger_1.logger.info(`Removed active agent ${agentId} for user: ${userId}`);
        }
    }
    /**
     * Add a pending task for a user
     */
    async addPendingTask(userId, taskId) {
        const data = await this.getOrCreateContextualData(userId);
        if (!data.relationships.pendingTasks.includes(taskId)) {
            data.relationships.pendingTasks.push(taskId);
            await data.save();
        }
    }
    /**
     * Remove a pending task for a user
     */
    async removePendingTask(userId, taskId) {
        const data = await GlobalPersonalization_1.ContextualData.findOne({ userId });
        if (data) {
            data.relationships.pendingTasks = data.relationships.pendingTasks.filter((t) => t !== taskId);
            await data.save();
        }
    }
    // Shared context operations (Redis)
    /**
     * Store shared context (accessible by multiple agents)
     */
    async setSharedContext(input) {
        const { userId, agentId, sessionId, data, expiresIn } = input;
        if (!this.redis) {
            logger_1.logger.warn('Redis not available for shared context');
            return;
        }
        const key = this.buildSharedKey(userId, sessionId, agentId);
        const ttl = expiresIn || this.defaultTTL;
        await this.redis.setex(key, ttl, JSON.stringify(data));
        logger_1.logger.info(`Set shared context for ${key}`, { ttl });
    }
    /**
     * Get shared context
     */
    async getSharedContext(userId, sessionId, agentId) {
        if (!this.redis) {
            logger_1.logger.warn('Redis not available for shared context');
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
    async updateSharedContext(userId, updates, sessionId, agentId) {
        if (!this.redis) {
            logger_1.logger.warn('Redis not available for shared context');
            return null;
        }
        const key = this.buildSharedKey(userId, sessionId, agentId);
        const existing = await this.redis.get(key);
        let data = existing ? JSON.parse(existing) : {};
        data = { ...data, ...updates };
        await this.redis.setex(key, this.defaultTTL, JSON.stringify(data));
        return data;
    }
    /**
     * Delete shared context
     */
    async deleteSharedContext(userId, sessionId, agentId) {
        if (!this.redis)
            return;
        const key = this.buildSharedKey(userId, sessionId, agentId);
        await this.redis.del(key);
        logger_1.logger.info(`Deleted shared context: ${key}`);
    }
    /**
     * Get all shared contexts for a user
     */
    async getAllUserContexts(userId) {
        if (!this.redis)
            return [];
        const pattern = `${this.sharedKeyPrefix}${userId}:*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length === 0)
            return [];
        const values = await this.redis.mget(keys);
        return values
            .filter((v) => v !== null)
            .map((v) => JSON.parse(v));
    }
    /**
     * Share context between agents
     */
    async shareBetweenAgents(fromAgentId, toAgentId, userId, data) {
        const key = `${this.contextKeyPrefix}agent_transfer:${userId}:${fromAgentId}:${toAgentId}`;
        if (this.redis) {
            await this.redis.setex(key, 300, JSON.stringify(data)); // 5 min TTL for agent transfers
            logger_1.logger.info(`Shared context from ${fromAgentId} to ${toAgentId}`);
        }
    }
    /**
     * Get context transferred between agents
     */
    async getAgentTransfer(fromAgentId, toAgentId, userId) {
        if (!this.redis)
            return null;
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
    async updateTemporalContext(userId) {
        const data = await this.getOrCreateContextualData(userId);
        const now = new Date();
        const dayOfWeek = now.getDay();
        const hour = now.getHours();
        let timeOfDay;
        if (hour >= 5 && hour < 12)
            timeOfDay = 'morning';
        else if (hour >= 12 && hour < 17)
            timeOfDay = 'afternoon';
        else if (hour >= 17 && hour < 21)
            timeOfDay = 'evening';
        else
            timeOfDay = 'night';
        data.temporalContext.dayOfWeek = dayOfWeek;
        data.temporalContext.timeOfDay = timeOfDay;
        await data.save();
    }
    /**
     * Build shared context key
     */
    buildSharedKey(userId, sessionId, agentId) {
        let key = `${this.sharedKeyPrefix}${userId}`;
        if (sessionId)
            key += `:session:${sessionId}`;
        if (agentId)
            key += `:agent:${agentId}`;
        return key;
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
exports.ContextService = ContextService;
// Export singleton instance
exports.contextService = new ContextService();
exports.default = exports.contextService;
//# sourceMappingURL=contextService.js.map