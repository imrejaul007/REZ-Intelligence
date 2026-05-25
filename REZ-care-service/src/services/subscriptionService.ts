/**
 * REZ Care - Subscription Service
 *
 * Manages subscription tiers, billing, and usage for multi-tenant SaaS
 * Part of Revenue Layer (Priority 5)
 *
 * INTEGRATION: Uses RABTUL Payment Service (Port 4001) for:
 * - Payment initiation (Razorpay)
 * - Refund processing
 * - Invoice generation
 */

import { logger } from '../utils/logger';
import { rabtulPayment, invoiceGenerator, Invoice } from '../rabtulPayment';

// ============================================
// TYPES
// ============================================

export enum SubscriptionTier {
  LITE = 'lite',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum SubscriptionStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
  PAST_DUE = 'past_due',
}

export interface Subscription {
  id: string;
  clientId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  startedAt: Date;
  expiresAt: Date;
  trialEndsAt?: Date;
  features: string[];
  limits: SubscriptionLimits;
  // Payment fields
  razorpayCustomerId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}

export interface SubscriptionLimits {
  ticketsPerMonth: number;
  agents: number;
  brands: number;
  apiCalls: number;
  storage: number; // in MB
}

export interface UsageMetrics {
  clientId: string;
  month: string; // YYYY-MM
  ticketsUsed: number;
  agentsUsed: number;
  brandsUsed: number;
  apiCalls: number;
  storageUsed: number;
  overage: OverageMetrics;
}

export interface OverageMetrics {
  ticketsOverage: number;
  apiCallsOverage: number;
  storageOverage: number;
}

export interface PricingPlan {
  tier: SubscriptionTier;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  limits: SubscriptionLimits;
  features: string[];
}

// ============================================
// PRICING CONFIG
// ============================================

export const PRICING_PLANS: Record<SubscriptionTier, PricingPlan> = {
  [SubscriptionTier.LITE]: {
    tier: SubscriptionTier.LITE,
    name: 'REZ Care Lite',
    monthlyPrice: 999, // ₹999/month
    yearlyPrice: 9990, // ₹9990/year (17% off)
    currency: 'INR',
    limits: {
      ticketsPerMonth: 100,
      agents: 2,
      brands: 1,
      apiCalls: 10000,
      storage: 100,
    },
    features: [
      '100 tickets/month',
      '2 agents',
      '1 brand',
      'WhatsApp integration',
      'Basic analytics',
      'Email support',
      'API access',
    ],
  },
  [SubscriptionTier.PRO]: {
    tier: SubscriptionTier.PRO,
    name: 'REZ Care Pro',
    monthlyPrice: 4999, // ₹4,999/month
    yearlyPrice: 49990, // ₹49,990/year
    currency: 'INR',
    limits: {
      ticketsPerMonth: -1, // unlimited
      agents: 10,
      brands: 3,
      apiCalls: 100000,
      storage: 1000,
    },
    features: [
      'Unlimited tickets',
      '10 agents',
      '3 brands',
      'WhatsApp + SMS',
      'Advanced analytics',
      'Priority support',
      'Full API access',
      'AI suggestions',
      'Custom workflows',
    ],
  },
  [SubscriptionTier.ENTERPRISE]: {
    tier: SubscriptionTier.ENTERPRISE,
    name: 'REZ Care Enterprise',
    monthlyPrice: 0, // Custom pricing
    yearlyPrice: 0,
    currency: 'INR',
    limits: {
      ticketsPerMonth: -1,
      agents: -1,
      brands: -1,
      apiCalls: -1,
      storage: -1,
    },
    features: [
      'Everything in Pro',
      'Unlimited everything',
      'White-label',
      'Dedicated SLA',
      'Custom integrations',
      'Priority feature requests',
      'Account manager',
      'Training sessions',
    ],
  },
};

// ============================================
// OVERAGE PRICING
// ============================================

export const OVERAGE_PRICING = {
  tickets: 10, // ₹10 per ticket over limit
  apiCalls: 0.01, // ₹0.01 per API call over limit
  storage: 1, // ₹1 per MB over limit
  additionalAgent: 499, // ₹499/month per additional agent
  additionalBrand: 999, // ₹999/month per additional brand
};

// ============================================
// TRIAL CONFIG
// ============================================

const TRIAL_DAYS = 14;
const TRIAL_TICKETS = 25;

// ============================================
// SUBSCRIPTION SERVICE
// ============================================

class SubscriptionService {
  private subscriptions: Map<string, Subscription> = new Map();
  private usageMetrics: Map<string, UsageMetrics[]> = new Map();

  constructor() {
    // Initialize demo subscriptions
    this.initDemoData();
  }

  private initDemoData() {
    // Demo subscription for testing
    const demoSub: Subscription = {
      id: 'sub_demo',
      clientId: 'demo_merchant',
      tier: SubscriptionTier.LITE,
      status: SubscriptionStatus.TRIAL,
      billingCycle: BillingCycle.MONTHLY,
      startedAt: new Date(),
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      features: PRICING_PLANS[SubscriptionTier.LITE].features,
      limits: PRICING_PLANS[SubscriptionTier.LITE].limits,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
    };

    this.subscriptions.set('demo_merchant', demoSub);

    // Demo usage
    const demoUsage: UsageMetrics = {
      clientId: 'demo_merchant',
      month: new Date().toISOString().slice(0, 7),
      ticketsUsed: 12,
      agentsUsed: 1,
      brandsUsed: 1,
      apiCalls: 1500,
      storageUsed: 45,
      overage: { ticketsOverage: 0, apiCallsOverage: 0, storageOverage: 0 },
    };

    this.usageMetrics.set('demo_merchant', [demoUsage]);

    logger.info('[Subscription] Demo data initialized');
  }

  /**
   * Create a new subscription with trial
   */
  async createSubscription(clientId: string, tier: SubscriptionTier): Promise<Subscription> {
    const plan = PRICING_PLANS[tier];
    const now = new Date();

    const subscription: Subscription = {
      id: `sub_${Date.now()}`,
      clientId,
      tier,
      status: SubscriptionStatus.TRIAL,
      billingCycle: BillingCycle.MONTHLY,
      startedAt: now,
      trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      features: plan.features,
      limits: plan.limits,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
    };

    this.subscriptions.set(clientId, subscription);
    this.usageMetrics.set(clientId, []);

    logger.info('[Subscription] Created trial subscription', { clientId, tier });

    return subscription;
  }

  /**
   * Get subscription for client
   */
  async getSubscription(clientId: string): Promise<Subscription | null> {
    return this.subscriptions.get(clientId) || null;
  }

  /**
   * Get all subscriptions
   */
  async getAllSubscriptions(): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Upgrade subscription tier
   */
  async upgradeTier(clientId: string, newTier: SubscriptionTier): Promise<Subscription | null> {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription) return null;

    const plan = PRICING_PLANS[newTier];
    subscription.tier = newTier;
    subscription.limits = plan.limits;
    subscription.features = plan.features;

    logger.info('[Subscription] Upgraded tier', { clientId, newTier });

    return subscription;
  }

  /**
   * Change billing cycle
   */
  async changeBillingCycle(clientId: string, cycle: BillingCycle): Promise<Subscription | null> {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription) return null;

    subscription.billingCycle = cycle;

    logger.info('[Subscription] Changed billing cycle', { clientId, cycle });

    return subscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(clientId: string): Promise<boolean> {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription) return false;

    subscription.status = SubscriptionStatus.CANCELLED;

    logger.info('[Subscription] Cancelled subscription', { clientId });

    return true;
  }

  /**
   * Convert trial to paid (initiates payment via RABTUL)
   */
  async convertTrialToPaid(clientId: string): Promise<{
    success: boolean;
    subscription?: Subscription;
    paymentOrderId?: string;
    razorpayOrderId?: string;
    error?: string;
  }> {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription || subscription.status !== SubscriptionStatus.TRIAL) {
      return { success: false, error: 'No trial subscription found' };
    }

    // Calculate amount
    const plan = PRICING_PLANS[subscription.tier];
    const amount = subscription.billingCycle === BillingCycle.MONTHLY
      ? plan.monthlyPrice
      : plan.yearlyPrice;

    // Generate invoice
    const invoice = invoiceGenerator.generateInvoice({
      subscriptionId: subscription.id,
      clientId,
      amount,
      description: `REZ Care ${plan.name} - ${subscription.billingCycle} subscription`,
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + (subscription.billingCycle === BillingCycle.YEARLY ? 365 : 30) * 24 * 60 * 60 * 1000),
    });

    // Create payment order via RABTUL
    const paymentResult = await rabtulPayment.createPaymentOrder({
      clientId,
      amount,
      description: `REZ Care ${plan.name} subscription`,
      metadata: {
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        tier: subscription.tier,
        billingCycle: subscription.billingCycle,
      },
    });

    if (!paymentResult.success || !paymentResult.razorpayOrderId) {
      return { success: false, error: paymentResult.error || 'Payment initiation failed' };
    }

    logger.info('[Subscription] Initiated payment for trial conversion', {
      clientId,
      invoiceId: invoice.id,
      razorpayOrderId: paymentResult.razorpayOrderId,
      amount,
    });

    return {
      success: true,
      subscription,
      paymentOrderId: paymentResult.order?.id,
      razorpayOrderId: paymentResult.razorpayOrderId,
    };
  }

  /**
   * Confirm payment (called after webhook confirms payment success)
   */
  async confirmPayment(clientId: string, razorpayPaymentId: string): Promise<{
    success: boolean;
    subscription?: Subscription;
    invoice?: Invoice;
    error?: string;
  }> {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription) {
      return { success: false, error: 'Subscription not found' };
    }

    // Update subscription status
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.trialEndsAt = undefined;
    subscription.currentPeriodStart = new Date();
    subscription.currentPeriodEnd = new Date(
      Date.now() + (subscription.billingCycle === BillingCycle.YEARLY ? 365 : 30) * 24 * 60 * 60 * 1000
    );

    // Update invoice
    const invoices = invoiceGenerator.getSubscriptionInvoices(subscription.id);
    const latestInvoice = invoices[invoices.length - 1];
    if (latestInvoice) {
      invoiceGenerator.updateInvoiceStatus(latestInvoice.id, 'paid', razorpayPaymentId);
    }

    logger.info('[Subscription] Payment confirmed, subscription activated', {
      clientId,
      razorpayPaymentId,
      tier: subscription.tier,
    });

    return {
      success: true,
      subscription,
      invoice: latestInvoice || undefined,
    };
  }

  /**
   * Process refund
   */
  async processRefund(clientId: string, amount: number, reason?: string): Promise<{
    success: boolean;
    refundId?: string;
    error?: string;
  }> {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription) {
      return { success: false, error: 'Subscription not found' };
    }

    // Find the latest paid invoice
    const invoices = invoiceGenerator.getClientInvoices(clientId);
    const paidInvoice = invoices.find(inv => inv.status === 'paid' && inv.paymentId);
    if (!paidInvoice) {
      return { success: false, error: 'No paid invoice found' };
    }

    // Process refund via RABTUL
    const refundResult = await rabtulPayment.processRefund({
      paymentId: paidInvoice.paymentId!,
      amount,
      reason: reason || 'Customer requested refund',
    });

    if (!refundResult.success) {
      return { success: false, error: refundResult.error };
    }

    logger.info('[Subscription] Refund processed', {
      clientId,
      refundId: refundResult.refundId,
      amount,
    });

    return {
      success: true,
      refundId: refundResult.refundId,
    };
  }

  /**
   * Get invoices for client
   */
  getInvoices(clientId: string): Invoice[] {
    return invoiceGenerator.getClientInvoices(clientId);
  }

  /**
   * Get invoice by ID
   */
  getInvoice(invoiceId: string): Invoice | null {
    return invoiceGenerator.getInvoice(invoiceId);
  }

  /**
   * Get invoice statistics
   */
  getInvoiceStats(): {
    total: number;
    paid: number;
    open: number;
    draft: number;
    totalAmount: number;
    paidAmount: number;
  } {
    return invoiceGenerator.getInvoiceStats();
  }

  /**
   * Check if client has access to feature
   */
  async hasFeature(clientId: string, feature: string): Promise<boolean> {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription) return false;

    return subscription.features.includes(feature);
  }

  /**
   * Check if client is within limits
   */
  async checkLimits(clientId: string): Promise<{
    withinLimits: boolean;
    overages: OverageMetrics;
  }> {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription) {
      return { withinLimits: false, overages: { ticketsOverage: 0, apiCallsOverage: 0, storageOverage: 0 } };
    }

    const usage = this.getCurrentMonthUsage(clientId);
    const overages: OverageMetrics = {
      ticketsOverage: Math.max(0, usage.ticketsUsed - (subscription.limits.ticketsPerMonth || 0)),
      apiCallsOverage: Math.max(0, usage.apiCalls - (subscription.limits.apiCalls || 0)),
      storageOverage: Math.max(0, usage.storageUsed - (subscription.limits.storage || 0)),
    };

    // For enterprise, no limits
    if (subscription.tier === SubscriptionTier.ENTERPRISE) {
      return { withinLimits: true, overages: { ticketsOverage: 0, apiCallsOverage: 0, storageOverage: 0 } };
    }

    const withinLimits = overages.ticketsOverage === 0 &&
                         overages.apiCallsOverage === 0 &&
                         overages.storageOverage === 0;

    return { withinLimits, overages };
  }

  /**
   * Get current month usage
   */
  getCurrentMonthUsage(clientId: string): UsageMetrics {
    const month = new Date().toISOString().slice(0, 7);
    const allUsage = this.usageMetrics.get(clientId) || [];

    return allUsage.find(u => u.month === month) || {
      clientId,
      month,
      ticketsUsed: 0,
      agentsUsed: 0,
      brandsUsed: 0,
      apiCalls: 0,
      storageUsed: 0,
      overage: { ticketsOverage: 0, apiCallsOverage: 0, storageOverage: 0 },
    };
  }

  /**
   * Get usage history
   */
  async getUsageHistory(clientId: string): Promise<UsageMetrics[]> {
    return this.usageMetrics.get(clientId) || [];
  }

  /**
   * Record usage
   */
  async recordUsage(clientId: string, metric: Partial<UsageMetrics>): Promise<void> {
    const month = new Date().toISOString().slice(0, 7);
    const allUsage = this.usageMetrics.get(clientId) || [];

    let currentUsage = allUsage.find(u => u.month === month);
    if (!currentUsage) {
      currentUsage = {
        clientId,
        month,
        ticketsUsed: 0,
        agentsUsed: 0,
        brandsUsed: 0,
        apiCalls: 0,
        storageUsed: 0,
        overage: { ticketsOverage: 0, apiCallsOverage: 0, storageOverage: 0 },
      };
      allUsage.push(currentUsage);
    }

    // Update metrics
    if (metric.ticketsUsed) currentUsage.ticketsUsed += metric.ticketsUsed;
    if (metric.agentsUsed) currentUsage.agentsUsed = Math.max(currentUsage.agentsUsed, metric.agentsUsed);
    if (metric.brandsUsed) currentUsage.brandsUsed = Math.max(currentUsage.brandsUsed, metric.brandsUsed);
    if (metric.apiCalls) currentUsage.apiCalls += metric.apiCalls;
    if (metric.storageUsed) currentUsage.storageUsed = metric.storageUsed;

    this.usageMetrics.set(clientId, allUsage);
  }

  /**
   * Get available plans
   */
  getPlans(): PricingPlan[] {
    return Object.values(PRICING_PLANS);
  }

  /**
   * Get plan by tier
   */
  getPlan(tier: SubscriptionTier): PricingPlan {
    return PRICING_PLANS[tier];
  }

  /**
   * Calculate billing amount
   */
  async calculateBillingAmount(clientId: string): Promise<{
    baseAmount: number;
    overageAmount: number;
    totalAmount: number;
    currency: string;
  }> {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription) {
      return { baseAmount: 0, overageAmount: 0, totalAmount: 0, currency: 'INR' };
    }

    const plan = PRICING_PLANS[subscription.tier];
    const baseAmount = subscription.billingCycle === BillingCycle.MONTHLY
      ? plan.monthlyPrice
      : plan.yearlyPrice;

    // Calculate overage
    const usage = this.getCurrentMonthUsage(clientId);
    const { withinLimits, overages } = await this.checkLimits(clientId);

    let overageAmount = 0;
    if (!withinLimits) {
      overageAmount =
        overages.ticketsOverage * OVERAGE_PRICING.tickets +
        overages.apiCallsOverage * OVERAGE_PRICING.apiCalls +
        overages.storageOverage * OVERAGE_PRICING.storage;
    }

    return {
      baseAmount,
      overageAmount,
      totalAmount: baseAmount + overageAmount,
      currency: plan.currency,
    };
  }

  /**
   * Get subscription statistics
   */
  async getStats(): Promise<{
    totalSubscriptions: number;
    byTier: Record<SubscriptionTier, number>;
    byStatus: Record<string, number>;
    totalMRR: number;
    totalARR: number;
    invoiceStats: ReturnType<typeof invoiceGenerator.getInvoiceStats>;
  }> {
    const subscriptions = Array.from(this.subscriptions.values());

    const byTier: Record<SubscriptionTier, number> = {
      [SubscriptionTier.LITE]: 0,
      [SubscriptionTier.PRO]: 0,
      [SubscriptionTier.ENTERPRISE]: 0,
    };

    const byStatus: Record<string, number> = {};

    let totalMRR = 0;

    for (const sub of subscriptions) {
      byTier[sub.tier]++;
      byStatus[sub.status] = (byStatus[sub.status] || 0) + 1;

      if (sub.status === SubscriptionStatus.ACTIVE) {
        const plan = PRICING_PLANS[sub.tier];
        totalMRR += plan.monthlyPrice;
      }
    }

    return {
      totalSubscriptions: subscriptions.length,
      byTier,
      byStatus,
      totalMRR,
      totalARR: totalMRR * 12,
      invoiceStats: invoiceGenerator.getInvoiceStats(),
    };
  }
}

// ============================================
// EXPORTS
// ============================================

export const subscriptionService = new SubscriptionService();
export default subscriptionService;
