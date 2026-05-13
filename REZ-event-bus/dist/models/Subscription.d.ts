/**
 * Subscription Model
 * Manages event subscriptions for the REZ Event Bus
 */
import { z } from 'zod';
/**
 * Subscription Status
 */
export declare enum SubscriptionStatus {
    ACTIVE = "active",
    PAUSED = "paused",
    FAILED = "failed",
    EXPIRED = "expired"
}
/**
 * Delivery Strategy
 */
export declare enum DeliveryStrategy {
    FIRE_AND_FORGET = "fire_and_forget",
    AT_LEAST_ONCE = "at_least_once",
    EXACTLY_ONCE = "exactly_once"
}
/**
 * Subscription Schema using Zod
 */
export declare const SubscriptionSchema: z.ZodObject<{
    subscriptionId: z.ZodOptional<z.ZodString>;
    subscriberId: z.ZodString;
    eventTypes: z.ZodArray<z.ZodString, "many">;
    url: z.ZodOptional<z.ZodString>;
    webhookUrl: z.ZodOptional<z.ZodString>;
    callbackUrl: z.ZodOptional<z.ZodString>;
    filter: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    status: z.ZodDefault<z.ZodNativeEnum<typeof SubscriptionStatus>>;
    deliveryStrategy: z.ZodDefault<z.ZodNativeEnum<typeof DeliveryStrategy>>;
    metadata: z.ZodOptional<z.ZodObject<{
        description: z.ZodOptional<z.ZodString>;
        owner: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        maxRetries: z.ZodDefault<z.ZodNumber>;
        retryDelayMs: z.ZodDefault<z.ZodNumber>;
        timeoutMs: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        maxRetries: number;
        retryDelayMs: number;
        timeoutMs: number;
        tags?: string[] | undefined;
        description?: string | undefined;
        owner?: string | undefined;
    }, {
        tags?: string[] | undefined;
        description?: string | undefined;
        owner?: string | undefined;
        maxRetries?: number | undefined;
        retryDelayMs?: number | undefined;
        timeoutMs?: number | undefined;
    }>>;
    createdAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
    lastEventAt: z.ZodOptional<z.ZodString>;
    lastSuccessfulDeliveryAt: z.ZodOptional<z.ZodString>;
    lastFailedDeliveryAt: z.ZodOptional<z.ZodString>;
    failureCount: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: SubscriptionStatus;
    subscriberId: string;
    eventTypes: string[];
    deliveryStrategy: DeliveryStrategy;
    failureCount: number;
    filter?: Record<string, unknown> | undefined;
    metadata?: {
        maxRetries: number;
        retryDelayMs: number;
        timeoutMs: number;
        tags?: string[] | undefined;
        description?: string | undefined;
        owner?: string | undefined;
    } | undefined;
    subscriptionId?: string | undefined;
    url?: string | undefined;
    webhookUrl?: string | undefined;
    callbackUrl?: string | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    lastEventAt?: string | undefined;
    lastSuccessfulDeliveryAt?: string | undefined;
    lastFailedDeliveryAt?: string | undefined;
}, {
    subscriberId: string;
    eventTypes: string[];
    filter?: Record<string, unknown> | undefined;
    status?: SubscriptionStatus | undefined;
    metadata?: {
        tags?: string[] | undefined;
        description?: string | undefined;
        owner?: string | undefined;
        maxRetries?: number | undefined;
        retryDelayMs?: number | undefined;
        timeoutMs?: number | undefined;
    } | undefined;
    subscriptionId?: string | undefined;
    url?: string | undefined;
    webhookUrl?: string | undefined;
    callbackUrl?: string | undefined;
    deliveryStrategy?: DeliveryStrategy | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    lastEventAt?: string | undefined;
    lastSuccessfulDeliveryAt?: string | undefined;
    lastFailedDeliveryAt?: string | undefined;
    failureCount?: number | undefined;
}>;
/**
 * Subscription Interface
 */
export interface ISubscription {
    subscriptionId: string;
    subscriberId: string;
    eventTypes: string[];
    url?: string;
    webhookUrl?: string;
    callbackUrl?: string;
    filter?: Record<string, unknown>;
    status: SubscriptionStatus;
    deliveryStrategy: DeliveryStrategy;
    metadata?: SubscriptionMetadata;
    createdAt: Date;
    updatedAt: Date;
    lastEventAt?: Date;
    lastSuccessfulDeliveryAt?: Date;
    lastFailedDeliveryAt?: Date;
    failureCount: number;
}
/**
 * Subscription Metadata Interface
 */
export interface SubscriptionMetadata {
    description?: string;
    owner?: string;
    tags?: string[];
    maxRetries?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
}
/**
 * Subscription Create Payload
 */
export interface SubscriptionCreatePayload {
    subscriberId: string;
    eventTypes: string[];
    url?: string;
    webhookUrl?: string;
    callbackUrl?: string;
    filter?: Record<string, unknown>;
    deliveryStrategy?: DeliveryStrategy;
    metadata?: Partial<SubscriptionMetadata>;
}
/**
 * Subscription Update Payload
 */
export interface SubscriptionUpdatePayload {
    eventTypes?: string[];
    url?: string;
    webhookUrl?: string;
    callbackUrl?: string;
    filter?: Record<string, unknown>;
    status?: SubscriptionStatus;
    deliveryStrategy?: DeliveryStrategy;
    metadata?: Partial<SubscriptionMetadata>;
}
/**
 * Subscription Query Options
 */
export interface SubscriptionQueryOptions {
    subscriberId?: string;
    eventType?: string;
    status?: SubscriptionStatus;
    limit?: number;
    offset?: number;
}
/**
 * Subscription Response
 */
export interface SubscriptionResponse {
    success: boolean;
    subscription: ISubscription;
}
/**
 * Delivery Result
 */
export interface DeliveryResult {
    success: boolean;
    subscriptionId: string;
    eventId: string;
    statusCode?: number;
    error?: string;
    attempts: number;
    durationMs: number;
    timestamp: string;
}
/**
 * Subscription Statistics
 */
export interface SubscriptionStats {
    totalSubscriptions: number;
    activeSubscriptions: number;
    pausedSubscriptions: number;
    failedSubscriptions: number;
    subscriptionsByEventType: Record<string, number>;
    avgFailureRate: number;
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
}
/**
 * Helper function to create a new subscription
 */
export declare function createSubscription(payload: SubscriptionCreatePayload): ISubscription;
/**
 * Helper to check if subscription should retry
 */
export declare function shouldRetry(subscription: ISubscription, error: unknown): boolean;
/**
 * Helper to calculate retry delay with exponential backoff
 */
export declare function calculateRetryDelay(subscription: ISubscription, attemptNumber: number): number;
export default SubscriptionSchema;
//# sourceMappingURL=Subscription.d.ts.map