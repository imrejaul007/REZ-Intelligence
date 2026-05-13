/**
 * Subscription Model
 * Manages event subscriptions for the REZ Event Bus
 */

import { z } from 'zod';

/**
 * Subscription Status
 */
export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

/**
 * Delivery Strategy
 */
export enum DeliveryStrategy {
  FIRE_AND_FORGET = 'fire_and_forget',
  AT_LEAST_ONCE = 'at_least_once',
  EXACTLY_ONCE = 'exactly_once',
}

/**
 * Subscription Schema using Zod
 */
export const SubscriptionSchema = z.object({
  subscriptionId: z.string().uuid().optional(),
  subscriberId: z.string().min(1).max(100),
  eventTypes: z.array(z.string().min(1).max(100)).min(1),
  url: z.string().url().optional(),
  webhookUrl: z.string().url().optional(),
  callbackUrl: z.string().url().optional(),
  filter: z.record(z.unknown()).optional(),
  status: z.nativeEnum(SubscriptionStatus).default(SubscriptionStatus.ACTIVE),
  deliveryStrategy: z.nativeEnum(DeliveryStrategy).default(DeliveryStrategy.AT_LEAST_ONCE),
  metadata: z.object({
    description: z.string().max(500).optional(),
    owner: z.string().optional(),
    tags: z.array(z.string()).optional(),
    maxRetries: z.number().int().min(0).max(10).default(3),
    retryDelayMs: z.number().int().min(0).max(60000).default(1000),
    timeoutMs: z.number().int().min(1000).max(60000).default(30000),
  }).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  lastEventAt: z.string().datetime().optional(),
  lastSuccessfulDeliveryAt: z.string().datetime().optional(),
  lastFailedDeliveryAt: z.string().datetime().optional(),
  failureCount: z.number().int().min(0).default(0),
});

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
export function createSubscription(payload: SubscriptionCreatePayload): ISubscription {
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
export function shouldRetry(subscription: ISubscription, error: unknown): boolean {
  if (subscription.status !== SubscriptionStatus.ACTIVE) {
    return false;
  }

  const maxRetries = subscription.metadata?.maxRetries ?? 3;
  return subscription.failureCount < maxRetries;
}

/**
 * Helper to calculate retry delay with exponential backoff
 */
export function calculateRetryDelay(
  subscription: ISubscription,
  attemptNumber: number
): number {
  const baseDelay = subscription.metadata?.retryDelayMs ?? 1000;
  // Exponential backoff with max cap
  return Math.min(baseDelay * Math.pow(2, attemptNumber), 60000);
}

export default SubscriptionSchema;
