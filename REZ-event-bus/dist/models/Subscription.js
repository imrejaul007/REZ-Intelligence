"use strict";
/**
 * Subscription Model
 * Manages event subscriptions for the REZ Event Bus
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionSchema = exports.DeliveryStrategy = exports.SubscriptionStatus = void 0;
exports.createSubscription = createSubscription;
exports.shouldRetry = shouldRetry;
exports.calculateRetryDelay = calculateRetryDelay;
const zod_1 = require("zod");
/**
 * Subscription Status
 */
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["ACTIVE"] = "active";
    SubscriptionStatus["PAUSED"] = "paused";
    SubscriptionStatus["FAILED"] = "failed";
    SubscriptionStatus["EXPIRED"] = "expired";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
/**
 * Delivery Strategy
 */
var DeliveryStrategy;
(function (DeliveryStrategy) {
    DeliveryStrategy["FIRE_AND_FORGET"] = "fire_and_forget";
    DeliveryStrategy["AT_LEAST_ONCE"] = "at_least_once";
    DeliveryStrategy["EXACTLY_ONCE"] = "exactly_once";
})(DeliveryStrategy || (exports.DeliveryStrategy = DeliveryStrategy = {}));
/**
 * Subscription Schema using Zod
 */
exports.SubscriptionSchema = zod_1.z.object({
    subscriptionId: zod_1.z.string().uuid().optional(),
    subscriberId: zod_1.z.string().min(1).max(100),
    eventTypes: zod_1.z.array(zod_1.z.string().min(1).max(100)).min(1),
    url: zod_1.z.string().url().optional(),
    webhookUrl: zod_1.z.string().url().optional(),
    callbackUrl: zod_1.z.string().url().optional(),
    filter: zod_1.z.record(zod_1.z.unknown()).optional(),
    status: zod_1.z.nativeEnum(SubscriptionStatus).default(SubscriptionStatus.ACTIVE),
    deliveryStrategy: zod_1.z.nativeEnum(DeliveryStrategy).default(DeliveryStrategy.AT_LEAST_ONCE),
    metadata: zod_1.z.object({
        description: zod_1.z.string().max(500).optional(),
        owner: zod_1.z.string().optional(),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        maxRetries: zod_1.z.number().int().min(0).max(10).default(3),
        retryDelayMs: zod_1.z.number().int().min(0).max(60000).default(1000),
        timeoutMs: zod_1.z.number().int().min(1000).max(60000).default(30000),
    }).optional(),
    createdAt: zod_1.z.string().datetime().optional(),
    updatedAt: zod_1.z.string().datetime().optional(),
    lastEventAt: zod_1.z.string().datetime().optional(),
    lastSuccessfulDeliveryAt: zod_1.z.string().datetime().optional(),
    lastFailedDeliveryAt: zod_1.z.string().datetime().optional(),
    failureCount: zod_1.z.number().int().min(0).default(0),
});
/**
 * Helper function to create a new subscription
 */
function createSubscription(payload) {
    const { v4: uuidv4 } = require('uuid');
    const now = new Date();
    // Support multiple URL field names
    const deliveryUrl = payload.url || payload.webhookUrl || payload.callbackUrl;
    return {
        subscriptionId: uuidv4(),
        subscriberId: payload.subscriberId,
        eventTypes: payload.eventTypes,
        url: deliveryUrl,
        filter: payload.filter,
        status: SubscriptionStatus.ACTIVE,
        deliveryStrategy: payload.deliveryStrategy || DeliveryStrategy.AT_LEAST_ONCE,
        metadata: {
            maxRetries: payload.metadata?.maxRetries ?? 3,
            retryDelayMs: payload.metadata?.retryDelayMs ?? 1000,
            timeoutMs: payload.metadata?.timeoutMs ?? 30000,
            ...payload.metadata,
        },
        createdAt: now,
        updatedAt: now,
        failureCount: 0,
    };
}
/**
 * Helper to check if subscription should retry
 */
function shouldRetry(subscription, error) {
    if (subscription.status !== SubscriptionStatus.ACTIVE) {
        return false;
    }
    const maxRetries = subscription.metadata?.maxRetries ?? 3;
    return subscription.failureCount < maxRetries;
}
/**
 * Helper to calculate retry delay with exponential backoff
 */
function calculateRetryDelay(subscription, attemptNumber) {
    const baseDelay = subscription.metadata?.retryDelayMs ?? 1000;
    // Exponential backoff with max cap
    return Math.min(baseDelay * Math.pow(2, attemptNumber), 60000);
}
exports.default = exports.SubscriptionSchema;
//# sourceMappingURL=Subscription.js.map