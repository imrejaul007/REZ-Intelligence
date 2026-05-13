"use strict";
/**
 * Redis Pub/Sub Service
 * Handles real-time event distribution via Redis pub/sub
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisPubSubService = exports.RedisPubSubService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("../config");
const logger_1 = require("./logger");
/**
 * Redis Pub/Sub Service
 */
class RedisPubSubService {
    publisher;
    subscriber;
    subscriptionHandlers;
    patternHandlers;
    isConnected;
    constructor() {
        this.publisher = this.createRedisClient('publisher');
        this.subscriber = this.createRedisClient('subscriber');
        this.subscriptionHandlers = new Map();
        this.patternHandlers = new Map();
        this.isConnected = false;
    }
    /**
     * Create Redis client with configuration
     */
    createRedisClient(name) {
        const client = new ioredis_1.default(config_1.config.redis.url, {
            maxRetriesPerRequest: config_1.config.redis.maxRetriesPerRequest,
            retryStrategy: config_1.config.redis.retryStrategy,
            keyPrefix: config_1.config.redis.keyPrefix,
            name: name,
            lazyConnect: true,
        });
        client.on('error', (err) => {
            logger_1.logger.error('Redis client error', { name, error: err.message });
        });
        client.on('connect', () => {
            logger_1.logger.info('Redis client connected', { name });
        });
        client.on('ready', () => {
            logger_1.logger.info('Redis client ready', { name });
            this.isConnected = true;
        });
        client.on('close', () => {
            logger_1.logger.warn('Redis client disconnected', { name });
            this.isConnected = false;
        });
        return client;
    }
    /**
     * Connect to Redis
     */
    async connect() {
        try {
            await Promise.all([
                this.publisher.connect(),
                this.subscriber.connect(),
            ]);
            await this.setupSubscriber();
            logger_1.logger.info('Redis Pub/Sub service connected');
        }
        catch (error) {
            logger_1.logger.error('Failed to connect Redis Pub/Sub', { error });
            throw error;
        }
    }
    /**
     * Setup subscriber with message handlers
     */
    async setupSubscriber() {
        this.subscriber.on('message', (channel, message) => {
            this.handleMessage(channel, message);
        });
        this.subscriber.on('pmessage', (pattern, channel, message) => {
            this.handlePatternMessage(pattern, channel, message);
        });
    }
    /**
     * Handle incoming message
     */
    handleMessage(channel, message) {
        try {
            const event = JSON.parse(message);
            const handlers = this.subscriptionHandlers.get(channel);
            if (handlers) {
                handlers.forEach((handler) => {
                    try {
                        handler(event, channel);
                    }
                    catch (error) {
                        logger_1.logger.error('Handler error', { channel, error });
                    }
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to parse message', { channel, message });
        }
    }
    /**
     * Handle pattern-matched message
     */
    handlePatternMessage(pattern, channel, message) {
        try {
            const event = JSON.parse(message);
            const handlers = this.patternHandlers.get(pattern);
            if (handlers) {
                handlers.forEach((handler) => {
                    try {
                        handler(event, channel);
                    }
                    catch (error) {
                        logger_1.logger.error('Pattern handler error', { pattern, error });
                    }
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to parse pattern message', { pattern, message });
        }
    }
    /**
     * Publish event to a channel
     */
    async publish(channel, event) {
        const message = JSON.stringify(event);
        const subscriberCount = await this.publisher.publish(channel, message);
        logger_1.logger.debug('Event published', {
            channel,
            eventId: event.eventId,
            eventType: event.eventType,
            subscriberCount,
        });
        return subscriberCount;
    }
    /**
     * Publish to multiple channels
     */
    async publishToChannels(channels, event) {
        const results = await Promise.all(channels.map((channel) => this.publish(channel, event)));
        return results;
    }
    /**
     * Subscribe to a channel
     */
    async subscribe(channel, handler) {
        if (!this.subscriptionHandlers.has(channel)) {
            this.subscriptionHandlers.set(channel, new Set());
            await this.subscriber.subscribe(channel);
        }
        this.subscriptionHandlers.get(channel).add(handler);
        logger_1.logger.info('Subscribed to channel', { channel });
    }
    /**
     * Unsubscribe from a channel
     */
    async unsubscribe(channel, handler) {
        if (handler) {
            const handlers = this.subscriptionHandlers.get(channel);
            if (handlers) {
                handlers.delete(handler);
                if (handlers.size === 0) {
                    this.subscriptionHandlers.delete(channel);
                    await this.subscriber.unsubscribe(channel);
                }
            }
        }
        else {
            this.subscriptionHandlers.delete(channel);
            await this.subscriber.unsubscribe(channel);
        }
        logger_1.logger.info('Unsubscribed from channel', { channel });
    }
    /**
     * Subscribe to pattern
     */
    async psubscribe(pattern, handler) {
        if (!this.patternHandlers.has(pattern)) {
            this.patternHandlers.set(pattern, new Set());
            await this.subscriber.psubscribe(pattern);
        }
        this.patternHandlers.get(pattern).add(handler);
        logger_1.logger.info('Subscribed to pattern', { pattern });
    }
    /**
     * Unsubscribe from pattern
     */
    async punsubscribe(pattern, handler) {
        if (handler) {
            const handlers = this.patternHandlers.get(pattern);
            if (handlers) {
                handlers.delete(handler);
                if (handlers.size === 0) {
                    this.patternHandlers.delete(pattern);
                    await this.subscriber.punsubscribe(pattern);
                }
            }
        }
        else {
            this.patternHandlers.delete(pattern);
            await this.subscriber.punsubscribe(pattern);
        }
        logger_1.logger.info('Unsubscribed from pattern', { pattern });
    }
    /**
     * Get subscriber count for a channel
     */
    async getSubscriberCount(channel) {
        // PUBSUB NUMSUB returns count of subscribers per channel
        const result = await this.publisher.pubsub('NUMSUB', channel);
        if (Array.isArray(result)) {
            for (let i = 0; i < result.length; i += 2) {
                if (result[i] === channel) {
                    const count = result[i + 1];
                    return typeof count === 'number' ? count : 0;
                }
            }
        }
        return 0;
    }
    /**
     * Store event for replay capability
     */
    async storeEvent(event) {
        const key = `events:${event.eventType}:${event.eventId}`;
        const ttl = config_1.config.eventBus.retentionHours * 60 * 60; // Convert hours to seconds
        await this.publisher.setex(key, ttl, JSON.stringify(event));
        logger_1.logger.debug('Event stored', { eventId: event.eventId, eventType: event.eventType, ttl });
    }
    /**
     * Retrieve stored event
     */
    async getStoredEvent(eventId, eventType) {
        const key = `events:${eventType}:${eventId}`;
        const data = await this.publisher.get(key);
        if (data) {
            return JSON.parse(data);
        }
        return null;
    }
    /**
     * Get event history
     */
    async getEventHistory(eventType, limit = 100, offset = 0) {
        const pattern = eventType ? `events:${eventType}:*` : 'events:*';
        const keys = [];
        let cursor = '0';
        do {
            const [newCursor, batch] = await this.publisher.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = newCursor;
            keys.push(...batch);
            if (keys.length >= limit + offset) {
                break;
            }
        } while (cursor !== '0');
        const relevantKeys = keys.slice(offset, offset + limit);
        const events = [];
        for (const key of relevantKeys) {
            const data = await this.publisher.get(key);
            if (data) {
                events.push(JSON.parse(data));
            }
        }
        return events.sort((a, b) => new Date(b.metadata.timestamp).getTime() -
            new Date(a.metadata.timestamp).getTime());
    }
    /**
     * Check connection health
     */
    async healthCheck() {
        try {
            await this.publisher.ping();
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Disconnect from Redis
     */
    async disconnect() {
        await Promise.all([
            this.publisher.quit(),
            this.subscriber.quit(),
        ]);
        logger_1.logger.info('Redis Pub/Sub service disconnected');
    }
    /**
     * Get connection status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            publisher: this.publisher.status === 'ready',
            subscriber: this.subscriber.status === 'ready',
        };
    }
}
exports.RedisPubSubService = RedisPubSubService;
// Singleton instance
exports.redisPubSubService = new RedisPubSubService();
exports.default = exports.redisPubSubService;
//# sourceMappingURL=redisPubSub.js.map