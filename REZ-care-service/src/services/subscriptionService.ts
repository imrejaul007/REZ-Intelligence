/**
 * REZ Care - Subscription Service (MongoDB Version)
 *
 * Manages subscription tiers, billing, and usage for multi-tenant SaaS
 * Part of Revenue Layer (Priority 5)
 *
 * INTEGRATION: Uses RABTUL Payment Service (Port 4001) for:
 * - Payment initiation (Razorpay)
 * - Refund processing
 * - Invoice generation
 */

import { Subscription, ISubscription, SubscriptionTier, BillingCycle, SubscriptionStatus } from '../models/Subscription';
export { SubscriptionTier, BillingCycle, SubscriptionStatus } from '../models/Subscription';
import { invoiceGenerator, Invoice, rabtulPayment } from '../rabtulPayment';
import { UsageMetrics, IUsageMetrics } from '../models/UsageMetrics';
import { logger } from '../utils/logger.js';

// ============================================
// TYPES
// ============================================

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
    monthlyPrice: 999,
    yearlyPrice: 9990,
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
    monthlyPrice: 4999,
    yearlyPrice: 49990,
    currency: 'INR',
    limits: {
      ticketsPerMonth: -1,
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
    monthlyPrice: 0,
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

export const OVERAGE_PRICING = {
  tickets: 10,
  apiCalls: 0.01,
  storage: 1,
  additionalAgent: 499,
  additionalBrand: 999,
};

const TRIAL_DAYS = 14;

// ============================================
// SUBSCRIPTION SERVICE (MongoDB Version)
// ============================================

class SubscriptionServiceMongo {
  /**
   * Create a new subscription with trial
   */
  async createSubscription(clientId: string, tier: SubscriptionTier, razorpayCustomerId?: string): Promise<ISubscription> {
    const plan = PRICING_PLANS[tier];
    const now = new Date();

    const subscription = new Subscription({
      clientId,
      tier,
      status: SubscriptionStatus.TRIAL,
      billingCycle: BillingCycle.MONTHLY,
      startedAt: now,
      trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      features: plan.features,
      limits: plan.limits,
      razorpayCustomerId,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
    });

    await subscription.save();
    logger.info('[Subscription] Created trial subscription', { clientId, tier });

    return subscription;
  }

  /**
   * Get subscription for client
   */
  async getSubscription(clientId: string): Promise<ISubscription | null> {
    return Subscription.findOne({ clientId }).sort({ createdAt: -1 });
  }

  /**
   * Get all subscriptions
   */
  async getAllSubscriptions(): Promise<ISubscription[]> {
    return Subscription.find().sort({ createdAt: -1 });
  }

  /**
   * Get subscription by Razorpay customer ID
   */
  async getByRazorpayCustomer(razorpayCustomerId: string): Promise<ISubscription | null> {
    return Subscription.findOne({ razorpayCustomerId }).sort({ createdAt: -1 });
  }

  /**
   * Update subscription tier
   */
  async updateTier(clientId: string, newTier: SubscriptionTier): Promise<ISubscription | null> {
    const subscription = await Subscription.findOne({ clientId }).sort({ createdAt: -1 });
    if (!subscription) return null;

    const plan = PRICING_PLANS[newTier];
    subscription.tier = newTier;
    subscription.limits = plan.limits;
    subscription.features = plan.features;
    await subscription.save();

    logger.info('[Subscription] Updated tier', { clientId, newTier });
    return subscription;
  }

  /**
   * Change billing cycle
   */
  async changeBillingCycle(clientId: string, cycle: BillingCycle): Promise<ISubscription | null> {
    const subscription = await Subscription.findOne({ clientId }).sort({ createdAt: -1 });
    if (!subscription) return null;

    subscription.billingCycle = cycle;
    await subscription.save();

    logger.info('[Subscription] Changed billing cycle', { clientId, cycle });
    return subscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(clientId: string, reason?: string): Promise<boolean> {
    const subscription = await Subscription.findOne({ clientId }).sort({ createdAt: -1 });
    if (!subscription) return false;

    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    subscription.cancelledReason = reason;
    await subscription.save();

    logger.info('[Subscription] Cancelled subscription', { clientId, reason });
    return true;
  }

  /**
   * Check if client has access to feature
   */
  async hasFeature(clientId: string, feature: string): Promise<boolean> {
    const subscription = await Subscription.findOne({ clientId }).sort({ createdAt: -1 });
    if (!subscription) return false;

    return subscription.features.includes(feature);
  }

  /**
   * Check if client is within limits
   */
  async checkLimits(clientId: string): Promise<{
    withinLimits: boolean;
    overages: OverageMetrics;
    currentUsage: IUsageMetrics | null;
  }> {
    const subscription = await Subscription.findOne({ clientId }).sort({ createdAt: -1 });
    if (!subscription) {
      return {
        withinLimits: false,
        overages: { ticketsOverage: 0, apiCallsOverage: 0, storageOverage: 0 },
        currentUsage: null
      };
    }

    const currentUsage = await this.getCurrentMonthUsage(clientId);
    const overages: OverageMetrics = {
      ticketsOverage: subscription.limits.ticketsPerMonth === -1
        ? 0
        : Math.max(0, (currentUsage?.ticketsUsed || 0) - subscription.limits.ticketsPerMonth),
      apiCallsOverage: subscription.limits.apiCalls === -1
        ? 0
        : Math.max(0, (currentUsage?.apiCalls || 0) - subscription.limits.apiCalls),
      storageOverage: subscription.limits.storage === -1
        ? 0
        : Math.max(0, (currentUsage?.storageUsed || 0) - subscription.limits.storage),
    };

    if (subscription.tier === SubscriptionTier.ENTERPRISE) {
      return { withinLimits: true, overages: { ticketsOverage: 0, apiCallsOverage: 0, storageOverage: 0 }, currentUsage };
    }

    const withinLimits = overages.ticketsOverage === 0 &&
                         overages.apiCallsOverage === 0 &&
                         overages.storageOverage === 0;

    return { withinLimits, overages, currentUsage };
  }

  /**
   * Get current month usage
   */
  async getCurrentMonthUsage(clientId: string): Promise<IUsageMetrics | null> {
    const month = new Date().toISOString().slice(0, 7);
    return UsageMetrics.findOne({ clientId, month });
  }

  /**
   * Get usage history
   */
  async getUsageHistory(clientId: string): Promise<IUsageMetrics[]> {
    return UsageMetrics.find({ clientId }).sort({ month: -1 });
  }

  /**
   * Record usage
   */
  async recordUsage(clientId: string, metric: Partial<UsageMetrics>): Promise<IUsageMetrics> {
    const month = new Date().toISOString().slice(0, 7);

    let usage = await UsageMetrics.findOne({ clientId, month });
    if (!usage) {
      usage = new UsageMetrics({
        clientId,
        month,
        ticketsUsed: 0,
        agentsUsed: 0,
        brandsUsed: 0,
        apiCalls: 0,
        storageUsed: 0,
        overage: { ticketsOverage: 0, apiCallsOverage: 0, storageOverage: 0 },
      });
    }

    if (metric.ticketsUsed) usage.ticketsUsed += metric.ticketsUsed;
    if (metric.agentsUsed !== undefined) usage.agentsUsed = Math.max(usage.agentsUsed, metric.agentsUsed);
    if (metric.brandsUsed !== undefined) usage.brandsUsed = Math.max(usage.brandsUsed, metric.brandsUsed);
    if (metric.apiCalls) usage.apiCalls += metric.apiCalls;
    if (metric.storageUsed !== undefined) usage.storageUsed = metric.storageUsed;

    usage.lastUpdated = new Date();
    await usage.save();

    return usage;
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
   * Get subscription statistics
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    trial: number;
    cancelled: number;
    byTier: Record<SubscriptionTier, number>;
  }> {
    const subscriptions = await Subscription.find();
    const stats = {
      total: subscriptions.length,
      active: 0,
      trial: 0,
      cancelled: 0,
      byTier: {
        [SubscriptionTier.LITE]: 0,
        [SubscriptionTier.PRO]: 0,
        [SubscriptionTier.ENTERPRISE]: 0,
      } as Record<SubscriptionTier, number>,
    };

    for (const sub of subscriptions) {
      if (sub.status === SubscriptionStatus.ACTIVE) stats.active++;
      else if (sub.status === SubscriptionStatus.TRIAL) stats.trial++;
      else if (sub.status === SubscriptionStatus.CANCELLED) stats.cancelled++;
      stats.byTier[sub.tier]++;
    }

    return stats;
  }

  /**
   * Upgrade subscription tier (alias for updateTier)
   */
  async upgradeTier(clientId: string, newTier: SubscriptionTier): Promise<ISubscription | null> {
    return this.updateTier(clientId, newTier);
  }

  /**
   * Convert trial to paid (initiates payment via RABTUL)
   */
  async convertTrialToPaid(clientId: string): Promise<{
    success: boolean;
    subscription?: ISubscription;
    paymentOrderId?: string;
    razorpayOrderId?: string;
    error?: string;
  }> {
    const subscription = await Subscription.findOne({ clientId }).sort({ createdAt: -1 });
    if (!subscription || subscription.status !== SubscriptionStatus.TRIAL) {
      return { success: false, error: 'No trial subscription found' };
    }

    const plan = PRICING_PLANS[subscription.tier];
    const amount = subscription.billingCycle === BillingCycle.MONTHLY
      ? plan.monthlyPrice
      : plan.yearlyPrice;

    const invoice = invoiceGenerator.generateInvoice({
      subscriptionId: subscription.id,
      clientId,
      amount,
      description: `REZ Care ${plan.name} - ${subscription.billingCycle} subscription`,
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + (subscription.billingCycle === BillingCycle.YEARLY ? 365 : 30) * 24 * 60 * 60 * 1000),
    });

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
    subscription?: ISubscription;
    invoice?: Invoice;
    error?: string;
  }> {
    const subscription = await Subscription.findOne({ clientId }).sort({ createdAt: -1 });
    if (!subscription) {
      return { success: false, error: 'Subscription not found' };
    }

    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.trialEndsAt = undefined;
    subscription.currentPeriodStart = new Date();
    subscription.currentPeriodEnd = new Date(
      Date.now() + (subscription.billingCycle === BillingCycle.YEARLY ? 365 : 30) * 24 * 60 * 60 * 1000
    );
    await subscription.save();

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
    const subscription = await Subscription.findOne({ clientId }).sort({ createdAt: -1 });
    if (!subscription) {
      return { success: false, error: 'Subscription not found' };
    }

    const invoices = invoiceGenerator.getClientInvoices(clientId);
    const paidInvoice = invoices.find(inv => inv.status === 'paid' && inv.paymentId);
    if (!paidInvoice) {
      return { success: false, error: 'No paid invoice found' };
    }

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
   * Calculate billing amount
   */
  async calculateBillingAmount(clientId: string): Promise<{
    baseAmount: number;
    overageAmount: number;
    totalAmount: number;
    currency: string;
  }> {
    const subscription = await Subscription.findOne({ clientId }).sort({ createdAt: -1 });
    if (!subscription) {
      return { baseAmount: 0, overageAmount: 0, totalAmount: 0, currency: 'INR' };
    }

    const plan = PRICING_PLANS[subscription.tier];
    const baseAmount = subscription.billingCycle === BillingCycle.MONTHLY
      ? plan.monthlyPrice
      : plan.yearlyPrice;

    const { overages } = await this.checkLimits(clientId);
    const overageAmount =
      overages.ticketsOverage * OVERAGE_PRICING.tickets +
      overages.apiCallsOverage * OVERAGE_PRICING.apiCalls +
      overages.storageOverage * OVERAGE_PRICING.storage;

    return {
      baseAmount,
      overageAmount,
      totalAmount: baseAmount + overageAmount,
      currency: 'INR',
    };
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionServiceMongo();
