"use strict";
/**
 * Subscriber Service
 * Manages event subscriptions and delivery
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriberService = exports.SubscriberService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const Subscription_1 = require("../models/Subscription");
const config_1 = require("../config");
const logger_1 = require("./logger");
/**
 * Subscriber Service
 */
class SubscriberService {
    subscriptions;
    eventTypeSubscriptions;
    subscriberRedis;
    deliveryHandlers;
    isRunning;
    constructor() {
        this.subscriptions = new Map();
        this.eventTypeSubscriptions = new Map();
        this.deliveryHandlers = new Map();
        this.isRunning = false;
        // Create dedicated subscriber Redis client
        this.subscriberRedis = new ioredis_1.default(config_1.config.redis.url, {
            maxRetriesPerRequest: config_1.config.redis.maxRetriesPerRequest,
            retryStrategy: config_1.config.redis.retryStrategy,
            keyPrefix: config_1.config.redis.keyPrefix,
            name: 'subscriber',
        });
    }
    /**
     * Initialize the subscriber service
     */
    async initialize() {
        await this.loadSubscriptions();
        this.isRunning = true;
        logger_1.subscriptionLogger.info('Subscriber service initialized');
    }
    /**
     * Load subscriptions from Redis
     */
    async loadSubscriptions() {
        const pattern = `subscriptions:*`;
        let cursor = '0';
        do {
            const [newCursor, keys] = await this.subscriberRedis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = newCursor;
            for (const key of keys) {
                const data = await this.subscriberRedis.get(key);
                if (data) {
                    const subscription = JSON.parse(data);
                    this.addSubscriptionToMaps(subscription);
                }
            }
        } while (cursor !== '0');
        logger_1.subscriptionLogger.info('Loaded subscriptions', { count: this.subscriptions.size });
    }
    /**
     * Add subscription to internal maps
     */
    addSubscriptionToMaps(subscription) {
        this.subscriptions.set(subscription.subscriptionId, subscription);
        for (const eventType of subscription.eventTypes) {
            if (!this.eventTypeSubscriptions.has(eventType)) {
                this.eventTypeSubscriptions.set(eventType, new Set());
            }
            this.eventTypeSubscriptions.get(eventType).add(subscription.subscriptionId);
        }
    }
    /**
     * Create a new subscription
     */
    async subscribe(payload) {
        // Check max subscriptions limit
        const existingCount = Array.from(this.subscriptions.values()).filter((s) => s.subscriberId === payload.subscriberId).length;
        if (existingCount >= config_1.config.eventBus.maxSubscriptionsPerClient) {
            throw new Error(`Maximum subscriptions limit (${config_1.config.eventBus.maxSubscriptionsPerClient}) reached`);
        }
        const subscription = (0, Subscription_1.createSubscription)(payload);
        // Store in Redis
        const key = `subscriptions:${subscription.subscriptionId}`;
        await this.subscriberRedis.set(key, JSON.stringify(subscription));
        // Also add to sorted set for time-based queries
        await this.subscriberRedis.zadd('subscriptions:by-date', subscription.createdAt.getTime(), subscription.subscriptionId);
        // Add to maps
        this.addSubscriptionToMaps(subscription);
        logger_1.subscriptionLogger.info('Subscription created', {
            subscriptionId: subscription.subscriptionId,
            subscriberId: subscription.subscriberId,
            eventTypes: subscription.eventTypes,
        });
        return subscription;
    }
    /**
     * Update an existing subscription
     */
    async updateSubscription(subscriptionId, updates) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
            throw new Error(`Subscription not found: ${subscriptionId}`);
        }
        // Update fields
        const updatedSubscription = {
            ...subscription,
            ...updates,
            url: updates.url || subscription.url,
            updatedAt: new Date(),
        };
        // Update event type maps if eventTypes changed
        if (updates.eventTypes) {
            // Remove from old event type maps
            for (const eventType of subscription.eventTypes) {
                this.eventTypeSubscriptions.get(eventType)?.delete(subscriptionId);
            }
            // Add to new event type maps
            for (const eventType of updates.eventTypes) {
                if (!this.eventTypeSubscriptions.has(eventType)) {
                    this.eventTypeSubscriptions.set(eventType, new Set());
                }
                this.eventTypeSubscriptions.get(eventType).add(subscriptionId);
            }
        }
        // Store updated subscription
        const key = `subscriptions:${subscriptionId}`;
        await this.subscriberRedis.set(key, JSON.stringify(updatedSubscription));
        this.subscriptions.set(subscriptionId, updatedSubscription);
        logger_1.subscriptionLogger.info('Subscription updated', { subscriptionId });
        return updatedSubscription;
    }
    /**
     * Delete a subscription
     */
    async unsubscribe(subscriptionId) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription) {
            throw new Error(`Subscription not found: ${subscriptionId}`);
        }
        // Remove from event type maps
        for (const eventType of subscription.eventTypes) {
            this.eventTypeSubscriptions.get(eventType)?.delete(subscriptionId);
        }
        // Remove from Redis
        await this.subscriberRedis.del(`subscriptions:${subscriptionId}`);
        await this.subscriberRedis.zrem('subscriptions:by-date', subscriptionId);
        // Remove from memory
        this.subscriptions.delete(subscriptionId);
        logger_1.subscriptionLogger.info('Subscription deleted', { subscriptionId });
    }
    /**
     * Get subscription by ID
     */
    getSubscription(subscriptionId) {
        return this.subscriptions.get(subscriptionId);
    }
    /**
     * Get subscriptions by subscriber ID
     */
    getSubscriptionsBySubscriber(subscriberId) {
        return Array.from(this.subscriptions.values()).filter((s) => s.subscriberId === subscriberId);
    }
    /**
     * Get subscriptions by event type
     */
    getSubscriptionsByEventType(eventType) {
        const subscriptionIds = this.eventTypeSubscriptions.get(eventType);
        if (!subscriptionIds)
            return [];
        return Array.from(subscriptionIds)
            .map((id) => this.subscriptions.get(id))
            .filter((s) => s !== undefined && s.status === Subscription_1.SubscriptionStatus.ACTIVE);
    }
    /**
     * Register a delivery handler
     */
    registerDeliveryHandler(name, handler) {
        this.deliveryHandlers.set(name, handler);
        logger_1.subscriptionLogger.info('Delivery handler registered', { name });
    }
    /**
     * Handle incoming event
     */
    async handleEvent(event) {
        const subscriptions = this.getSubscriptionsByEventType(event.eventType);
        const results = [];
        for (const subscription of subscriptions) {
            // Check if event matches subscription filter
            if (subscription.filter && !this.matchesFilter(event, subscription.filter)) {
                continue;
            }
            const result = await this.deliverEvent(event, subscription);
            results.push(result);
        }
        return results;
    }
    /**
     * Deliver event to subscription
     */
    async deliverEvent(event, subscription) {
        const startTime = Date.now();
        const handler = this.deliveryHandlers.get('default');
        if (!handler || !subscription.url) {
            return {
                success: false,
                subscriptionId: subscription.subscriptionId,
                eventId: event.eventId,
                attempts: 1,
                durationMs: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                error: 'No delivery handler or URL configured',
            };
        }
        try {
            const result = await handler(event, subscription);
            // Update subscription last event time
            if (result.success) {
                subscription.lastSuccessfulDeliveryAt = new Date();
                subscription.failureCount = 0;
            }
            else {
                subscription.lastFailedDeliveryAt = new Date();
                subscription.failureCount++;
                // Check if should pause subscription
                if (!(0, Subscription_1.shouldRetry)(subscription, new Error(result.error))) {
                    subscription.status = Subscription_1.SubscriptionStatus.FAILED;
                    logger_1.subscriptionLogger.warn('Subscription marked as failed', {
                        subscriptionId: subscription.subscriptionId,
                        failureCount: subscription.failureCount,
                    });
                }
            }
            subscription.lastEventAt = new Date();
            await this.updateSubscriptionInRedis(subscription);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.subscriptionLogger.error('Delivery failed', {
                subscriptionId: subscription.subscriptionId,
                eventId: event.eventId,
                error: errorMessage,
            });
            return {
                success: false,
                subscriptionId: subscription.subscriptionId,
                eventId: event.eventId,
                attempts: 1,
                durationMs: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                error: errorMessage,
            };
        }
    }
    /**
     * Check if event matches subscription filter
     */
    matchesFilter(event, filter) {
        for (const [key, value] of Object.entries(filter)) {
            const eventValue = this.getNestedValue(event, key);
            if (eventValue !== value) {
                return false;
            }
        }
        return true;
    }
    /**
     * Get nested value from object
     */
    getNestedValue(obj, path) {
        const keys = path.split('.');
        let current = obj;
        for (const key of keys) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[key];
        }
        return current;
    }
    /**
     * Update subscription in Redis
     */
    async updateSubscriptionInRedis(subscription) {
        const key = `subscriptions:${subscription.subscriptionId}`;
        await this.subscriberRedis.set(key, JSON.stringify(subscription));
    }
    /**
     * Get service statistics
     */
    getStats() {
        const subscriptions = Array.from(this.subscriptions.values());
        return {
            totalSubscriptions: subscriptions.length,
            activeSubscriptions: subscriptions.filter((s) => s.status === Subscription_1.SubscriptionStatus.ACTIVE).length,
            pausedSubscriptions: subscriptions.filter((s) => s.status === Subscription_1.SubscriptionStatus.PAUSED).length,
            failedSubscriptions: subscriptions.filter((s) => s.status === Subscription_1.SubscriptionStatus.FAILED).length,
            subscriptionsByEventType: Object.fromEntries(Array.from(this.eventTypeSubscriptions.entries()).map(([type, ids]) => [
                type,
                ids.size,
            ])),
        };
    }
    /**
     * Shutdown service
     */
    async shutdown() {
        this.isRunning = false;
        await this.subscriberRedis.quit();
        logger_1.subscriptionLogger.info('Subscriber service shutdown');
    }
}
exports.SubscriberService = SubscriberService;
// Singleton instance
exports.subscriberService = new SubscriberService();
exports.default = exports.subscriberService;
//# sourceMappingURL=subscriber.js.map