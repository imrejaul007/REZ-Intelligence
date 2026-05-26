import { v4 as uuidv4 } from 'uuid';
import { logger } from './utils/logger.js';

export type PlanTier = 'starter' | 'pro' | 'enterprise';

interface PlanLimits {
  maxCustomers: number;
  maxConversations: number;
  maxBookings: number;
  maxWorkflows: number;
  maxApprovals: number;
  aiMessagesPerMonth: number;
  whatsappTemplates: number;
  analyticsRetention: number;
  apiCallsPerMinute: number;
  customBranding: boolean;
  prioritySupport: boolean;
  advancedAnalytics: boolean;
  multiStaff: boolean;
  multiLocation: boolean;
}

const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  starter: {
    maxCustomers: 100,
    maxConversations: 500,
    maxBookings: 100,
    maxWorkflows: 5,
    maxApprovals: 10,
    aiMessagesPerMonth: 1000,
    whatsappTemplates: 1,
    analyticsRetention: 7,
    apiCallsPerMinute: 30,
    customBranding: false,
    prioritySupport: false,
    advancedAnalytics: false,
    multiStaff: false,
    multiLocation: false,
  },
  pro: {
    maxCustomers: 1000,
    maxConversations: 5000,
    maxBookings: 1000,
    maxWorkflows: 25,
    maxApprovals: 100,
    aiMessagesPerMonth: 10000,
    whatsappTemplates: 5,
    analyticsRetention: 30,
    apiCallsPerMinute: 100,
    customBranding: true,
    prioritySupport: true,
    advancedAnalytics: true,
    multiStaff: true,
    multiLocation: false,
  },
  enterprise: {
    maxCustomers: -1,
    maxConversations: -1,
    maxBookings: -1,
    maxWorkflows: -1,
    maxApprovals: -1,
    aiMessagesPerMonth: -1,
    whatsappTemplates: -1,
    analyticsRetention: 365,
    apiCallsPerMinute: 500,
    customBranding: true,
    prioritySupport: true,
    advancedAnalytics: true,
    multiStaff: true,
    multiLocation: true,
  },
};

interface UsageKey {
  customers: number;
  conversations: number;
  bookings: number;
  workflows: number;
  approvals: number;
  aiMessagesThisMonth: number;
}

interface Subscription {
  subscriptionId: string;
  merchantId: string;
  plan: PlanTier;
  status: 'active' | 'trial' | 'suspended' | 'cancelled';
  trialEndsAt?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  usage: UsageKey;
  createdAt: string;
  updatedAt: string;
}

interface UsageCheck {
  allowed: boolean;
  limit?: number;
  current: number;
  upgradeRequired?: boolean;
}

export class SubscriptionService {
  private subscriptions: Map<string, Subscription> = new Map();

  async createSubscription(merchantId: string, plan: PlanTier = 'starter'): Promise<Subscription> {
    const subscription: Subscription = {
      subscriptionId: uuidv4(),
      merchantId,
      plan,
      status: 'trial',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      usage: {
        customers: 0,
        conversations: 0,
        bookings: 0,
        workflows: 0,
        approvals: 0,
        aiMessagesThisMonth: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.subscriptions.set(merchantId, subscription);
    logger.info(`Subscription created for merchant ${merchantId}`, { plan, trialDays: 14 });
    return subscription;
  }

  async getSubscription(merchantId: string): Promise<Subscription | null> {
    return this.subscriptions.get(merchantId) || null;
  }

  async getPlanLimits(plan: PlanTier): Promise<PlanLimits> {
    return PLAN_LIMITS[plan];
  }

  async checkUsage(merchantId: string, type: keyof UsageKey): Promise<UsageCheck> {
    const subscription = await this.getSubscription(merchantId);
    if (!subscription) {
      return { allowed: false, current: 0 };
    }

    const limits = PLAN_LIMITS[subscription.plan];
    const current = subscription.usage[type];
    const limit = type === 'aiMessagesThisMonth' ? limits.aiMessagesPerMonth : limits[type as keyof PlanLimits] as number;

    if (limit === -1) {
      return { allowed: true, current, limit: -1 };
    }

    return {
      allowed: current < limit,
      limit,
      current,
      upgradeRequired: current >= limit,
    };
  }

  async incrementUsage(merchantId: string, type: keyof UsageKey, amount: number = 1): Promise<void> {
    const subscription = await this.subscriptions.get(merchantId);
    if (subscription) {
      subscription.usage[type] += amount;
      subscription.updatedAt = new Date().toISOString();
      this.subscriptions.set(merchantId, subscription);
    }
  }

  async upgradePlan(merchantId: string, newPlan: PlanTier): Promise<Subscription | null> {
    const subscription = await this.getSubscription(merchantId);
    if (!subscription) return null;

    subscription.plan = newPlan;
    subscription.updatedAt = new Date().toISOString();
    this.subscriptions.set(merchantId, subscription);
    
    logger.info(`Plan upgraded for merchant ${merchantId}`, { newPlan });
    return subscription;
  }

  async cancelSubscription(merchantId: string): Promise<void> {
    const subscription = await this.subscriptions.get(merchantId);
    if (subscription) {
      subscription.status = 'cancelled';
      subscription.updatedAt = new Date().toISOString();
      this.subscriptions.set(merchantId, subscription);
    }
  }

  async checkTrialStatus(merchantId: string): Promise<{ isTrial: boolean; daysRemaining?: number; expired?: boolean }> {
    const subscription = await this.getSubscription(merchantId);
    if (!subscription || subscription.status !== 'trial') {
      return { isTrial: false };
    }

    if (!subscription.trialEndsAt) {
      return { isTrial: true, daysRemaining: 14, expired: false };
    }

    const trialEnd = new Date(subscription.trialEndsAt).getTime();
    const now = Date.now();
    const daysRemaining = Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000));

    return {
      isTrial: true,
      daysRemaining: Math.max(0, daysRemaining),
      expired: daysRemaining <= 0,
    };
  }

  async getUsageSummary(merchantId: string): Promise<{
    plan: PlanTier;
    usage: UsageKey;
    limits: PlanLimits;
    percentages: Record<string, number>;
  } | null> {
    const subscription = await this.getSubscription(merchantId);
    if (!subscription) return null;

    const limits = PLAN_LIMITS[subscription.plan];
    const percentages: Record<string, number> = {};

    for (const [key, value] of Object.entries(subscription.usage)) {
      const limitKey = key === 'aiMessagesThisMonth' ? 'aiMessagesPerMonth' : key;
      const limit = limits[limitKey as keyof PlanLimits] as number;
      percentages[key] = limit === -1 ? 0 : Math.round((value / limit) * 100);
    }

    return {
      plan: subscription.plan,
      usage: subscription.usage,
      limits,
      percentages,
    };
  }
}

export const subscriptionService = new SubscriptionService();
