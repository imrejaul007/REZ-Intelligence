/**
 * REZ SaaS Runtime - Billing Service
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Subscription,
  Plan,
  PlanType,
  BillingCycle,
  SubscriptionStatus,
  CreateSubscriptionRequest,
  UsageMetrics,
} from '../types';
import { tenantService } from './tenantService';
import { logger } from '../utils/logger.js';

// In-memory stores
const subscriptions = new Map<string, Subscription>();
const usageMetrics = new Map<string, UsageMetrics>();

// Plan definitions
const PLANS: Record<PlanType, Plan> = {
  [PlanType.FREE]: {
    id: PlanType.FREE,
    name: 'Free',
    description: 'Perfect for getting started',
    price: { monthly: 0, yearly: 0 },
    features: [
      { name: 'API Requests', included: true, limit: 1000, unit: '/month' },
      { name: 'Workflows', included: true, limit: 5 },
      { name: 'Users', included: true, limit: 1 },
      { name: 'Storage', included: true, limit: 100, unit: 'MB' },
      { name: 'Support', included: false },
    ],
    limits: {
      apiRequestsPerMonth: 1000,
      workflows: 5,
      users: 1,
      storage: 100,
      support: 'email',
    },
  },
  [PlanType.STARTER]: {
    id: PlanType.STARTER,
    name: 'Starter',
    description: 'For small teams',
    price: { monthly: 999, yearly: 9999 },
    features: [
      { name: 'API Requests', included: true, limit: 50000, unit: '/month' },
      { name: 'Workflows', included: true, limit: 50 },
      { name: 'Users', included: true, limit: 10 },
      { name: 'Storage', included: true, limit: 1000, unit: 'MB' },
      { name: 'Support', included: true },
    ],
    limits: {
      apiRequestsPerMonth: 50000,
      workflows: 50,
      users: 10,
      storage: 1000,
      support: 'email',
    },
  },
  [PlanType.PROFESSIONAL]: {
    id: PlanType.PROFESSIONAL,
    name: 'Professional',
    description: 'For growing businesses',
    price: { monthly: 4999, yearly: 49999 },
    features: [
      { name: 'API Requests', included: true, limit: 500000, unit: '/month' },
      { name: 'Workflows', included: true, limit: 500 },
      { name: 'Users', included: true, limit: 100 },
      { name: 'Storage', included: true, limit: 10000, unit: 'MB' },
      { name: 'Priority Support', included: true },
    ],
    limits: {
      apiRequestsPerMonth: 500000,
      workflows: 500,
      users: 100,
      storage: 10000,
      support: 'chat',
    },
  },
  [PlanType.ENTERPRISE]: {
    id: PlanType.ENTERPRISE,
    name: 'Enterprise',
    description: 'For large organizations',
    price: { monthly: 19999, yearly: 199999 },
    features: [
      { name: 'Unlimited API Requests', included: true },
      { name: 'Unlimited Workflows', included: true },
      { name: 'Unlimited Users', included: true },
      { name: 'Unlimited Storage', included: true },
      { name: 'Dedicated Support', included: true },
      { name: 'Custom SLAs', included: true },
      { name: 'White-label', included: true },
    ],
    limits: {
      apiRequestsPerMonth: Infinity,
      workflows: Infinity,
      users: Infinity,
      storage: Infinity,
      support: 'phone',
    },
  },
};

export class BillingService {
  /**
   * Get all available plans
   */
  getPlans(): Plan[] {
    return Object.values(PLANS);
  }

  /**
   * Get plan by type
   */
  getPlan(planType: PlanType): Plan | undefined {
    return PLANS[planType];
  }

  /**
   * Create subscription
   */
  async createSubscription(request: CreateSubscriptionRequest): Promise<Subscription> {
    const tenant = tenantService.getTenant(request.tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const plan = PLANS[request.plan];
    if (!plan) {
      throw new Error('Invalid plan');
    }

    const now = new Date();
    const periodEnd = this.calculatePeriodEnd(now, request.billingCycle);

    const subscription: Subscription = {
      id: uuidv4(),
      tenantId: request.tenantId,
      plan: request.plan,
      billingCycle: request.billingCycle,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    };

    subscriptions.set(request.tenantId, subscription);
    logger.info('Subscription created', { tenantId: request.tenantId, plan: request.plan });

    return subscription;
  }

  /**
   * Get subscription for tenant
   */
  getSubscription(tenantId: string): Subscription | undefined {
    return subscriptions.get(tenantId);
  }

  /**
   * Cancel subscription
   */
  cancelSubscription(tenantId: string, immediate = false): Subscription | undefined {
    const subscription = subscriptions.get(tenantId);
    if (!subscription) return undefined;

    if (immediate) {
      subscription.status = SubscriptionStatus.CANCELLED;
    } else {
      subscription.cancelAtPeriodEnd = true;
    }
    subscription.updatedAt = new Date();

    subscriptions.set(tenantId, subscription);
    logger.info('Subscription cancelled', { tenantId, immediate });

    return subscription;
  }

  /**
   * Pause subscription
   */
  pauseSubscription(tenantId: string): Subscription | undefined {
    const subscription = subscriptions.get(tenantId);
    if (!subscription) return undefined;

    subscription.status = SubscriptionStatus.PAUSED;
    subscription.updatedAt = new Date();

    subscriptions.set(tenantId, subscription);
    return subscription;
  }

  /**
   * Resume subscription
   */
  resumeSubscription(tenantId: string): Subscription | undefined {
    const subscription = subscriptions.get(tenantId);
    if (!subscription) return undefined;

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.updatedAt = new Date();

    subscriptions.set(tenantId, subscription);
    return subscription;
  }

  /**
   * Check quota
   */
  checkQuota(tenantId: string): { allowed: boolean; exceeded: string[] } {
    const subscription = subscriptions.get(tenantId);
    if (!subscription) {
      return { allowed: true, exceeded: [] };
    }

    const plan = PLANS[subscription.plan];
    const usage = this.getUsageMetrics(tenantId);
    const exceeded: string[] = [];

    if (usage.apiRequests > plan.limits.apiRequestsPerMonth) {
      exceeded.push('apiRequests');
    }
    if (usage.storageUsed > plan.limits.storage) {
      exceeded.push('storage');
    }

    return { allowed: exceeded.length === 0, exceeded };
  }

  /**
   * Record API usage
   */
  recordApiUsage(tenantId: string, endpoint: string): void {
    let usage = usageMetrics.get(tenantId);
    if (!usage) {
      const now = new Date();
      usage = {
        tenantId,
        period: { start: now, end: new Date(now.getFullYear(), now.getMonth() + 1, 1) },
        apiRequests: 0,
        workflowExecutions: 0,
        activeUsers: 0,
        storageUsed: 0,
        apiCallsByEndpoint: {},
      };
      usageMetrics.set(tenantId, usage);
    }

    usage.apiRequests++;
    usage.apiCallsByEndpoint[endpoint] = (usage.apiCallsByEndpoint[endpoint] || 0) + 1;
  }

  /**
   * Get usage metrics
   */
  getUsageMetrics(tenantId: string): UsageMetrics {
    return (
      usageMetrics.get(tenantId) || {
        tenantId,
        period: { start: new Date(), end: new Date() },
        apiRequests: 0,
        workflowExecutions: 0,
        activeUsers: 0,
        storageUsed: 0,
        apiCallsByEndpoint: {},
      }
    );
  }

  /**
   * Calculate period end date
   */
  private calculatePeriodEnd(start: Date, cycle: BillingCycle): Date {
    const end = new Date(start);
    if (cycle === BillingCycle.MONTHLY) {
      end.setMonth(end.getMonth() + 1);
    } else {
      end.setFullYear(end.getFullYear() + 1);
    }
    return end;
  }
}

export const billingService = new BillingService();
