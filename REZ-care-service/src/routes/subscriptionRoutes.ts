/**
 * REZ Care - Subscription Routes
 *
 * API endpoints for subscription management, billing, and usage
 * Part of Revenue Layer (Priority 5)
 */

import express, { Request, Response } from 'express';
import { subscriptionService, SubscriptionTier, BillingCycle, PRICING_PLANS } from '../services/subscriptionService';
import { rabtulPayment } from '../rabtulPayment';
import { logger } from '../utils/logger.js';

const router = express.Router();

// ============================================
// PRICING & PLANS
// ============================================

/**
 * Get all pricing plans
 * GET /api/subscription/plans
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = subscriptionService.getPlans();

    res.json({
      success: true,
      plans: plans.map(plan => ({
        tier: plan.tier,
        name: plan.name,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        currency: plan.currency,
        limits: plan.limits,
        features: plan.features,
      })),
    });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to get plans', error);
    res.status(500).json({ success: false, error: 'Failed to get plans' });
  }
});

/**
 * Get single plan details
 * GET /api/subscription/plans/:tier
 */
router.get('/plans/:tier', async (req: Request, res: Response) => {
  try {
    const { tier } = req.params;
    const plan = subscriptionService.getPlan(tier as SubscriptionTier);

    if (!plan) {
      res.status(404).json({ success: false, error: 'Plan not found' });
      return;
    }

    res.json({ success: true, plan });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to get plan', error);
    res.status(500).json({ success: false, error: 'Failed to get plan' });
  }
});

// ============================================
// SUBSCRIPTIONS
// ============================================

/**
 * Create new subscription (start trial)
 * POST /api/subscription
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { clientId, tier } = req.body;

    if (!clientId || !tier) {
      res.status(400).json({ success: false, error: 'clientId and tier required' });
      return;
    }

    // Check if already has subscription
    const existing = await subscriptionService.getSubscription(clientId);
    if (existing) {
      res.status(400).json({ success: false, error: 'Subscription already exists' });
      return;
    }

    const subscription = await subscriptionService.createSubscription(clientId, tier as SubscriptionTier);

    logger.info('[SubscriptionRoutes] Created subscription', { clientId, tier });

    res.json({
      success: true,
      subscription,
      message: `Trial started! ${14} days free, ${25} tickets to try.`,
    });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to create subscription', error);
    res.status(500).json({ success: false, error: 'Failed to create subscription' });
  }
});

/**
 * Get subscription for client
 * GET /api/subscription/:clientId
 */
router.get('/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const subscription = await subscriptionService.getSubscription(clientId);

    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    // Get current usage
    const usage = subscriptionService.getCurrentMonthUsage(clientId);
    const { withinLimits, overages } = await subscriptionService.checkLimits(clientId);

    res.json({
      success: true,
      subscription,
      usage,
      withinLimits,
      overages,
    });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to get subscription', error);
    res.status(500).json({ success: false, error: 'Failed to get subscription' });
  }
});

/**
 * Get all subscriptions (admin)
 * GET /api/subscription
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const subscriptions = await subscriptionService.getAllSubscriptions();

    res.json({
      success: true,
      count: subscriptions.length,
      subscriptions,
    });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to get subscriptions', error);
    res.status(500).json({ success: false, error: 'Failed to get subscriptions' });
  }
});

/**
 * Upgrade subscription tier
 * POST /api/subscription/:clientId/upgrade
 */
router.post('/:clientId/upgrade', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { tier } = req.body;

    if (!tier) {
      res.status(400).json({ success: false, error: 'tier required' });
      return;
    }

    const subscription = await subscriptionService.upgradeTier(clientId, tier as SubscriptionTier);

    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    logger.info('[SubscriptionRoutes] Upgraded subscription', { clientId, tier });

    res.json({
      success: true,
      subscription,
      message: `Upgraded to ${tier} successfully!`,
    });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to upgrade', error);
    res.status(500).json({ success: false, error: 'Failed to upgrade subscription' });
  }
});

/**
 * Change billing cycle
 * POST /api/subscription/:clientId/billing
 */
router.post('/:clientId/billing', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { cycle } = req.body;

    if (!cycle) {
      res.status(400).json({ success: false, error: 'billing cycle required' });
      return;
    }

    const subscription = await subscriptionService.changeBillingCycle(clientId, cycle as BillingCycle);

    if (!subscription) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    const savings = cycle === BillingCycle.YEARLY ? 'Save 17%!' : '';

    res.json({
      success: true,
      subscription,
      message: `Billing cycle changed to ${cycle}. ${savings}`,
    });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to change billing', error);
    res.status(500).json({ success: false, error: 'Failed to change billing cycle' });
  }
});

/**
 * Cancel subscription
 * POST /api/subscription/:clientId/cancel
 */
router.post('/:clientId/cancel', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const success = await subscriptionService.cancelSubscription(clientId);

    if (!success) {
      res.status(404).json({ success: false, error: 'Subscription not found' });
      return;
    }

    logger.info('[SubscriptionRoutes] Cancelled subscription', { clientId });

    res.json({
      success: true,
      message: 'Subscription cancelled. You can continue using until the end of your billing period.',
    });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to cancel', error);
    res.status(500).json({ success: false, error: 'Failed to cancel subscription' });
  }
});

/**
 * Convert trial to paid (initiates payment via RABTUL)
 * POST /api/subscription/:clientId/convert
 */
router.post('/:clientId/convert', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const result = await subscriptionService.convertTrialToPaid(clientId);

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    logger.info('[SubscriptionRoutes] Initiated payment for trial conversion', {
      clientId,
      razorpayOrderId: result.razorpayOrderId,
    });

    res.json({
      success: true,
      subscription: result.subscription,
      paymentOrderId: result.paymentOrderId,
      razorpayOrderId: result.razorpayOrderId,
      message: 'Payment initiated. Complete payment to activate subscription.',
    });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to convert', error);
    res.status(500).json({ success: false, error: 'Failed to convert trial' });
  }
});

/**
 * Confirm payment (webhook callback)
 * POST /api/subscription/:clientId/confirm-payment
 */
router.post('/:clientId/confirm-payment', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { razorpayPaymentId } = req.body;

    if (!razorpayPaymentId) {
      res.status(400).json({ success: false, error: 'razorpayPaymentId required' });
      return;
    }

    const result = await subscriptionService.confirmPayment(clientId, razorpayPaymentId);

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    logger.info('[SubscriptionRoutes] Payment confirmed', { clientId, razorpayPaymentId });

    res.json({
      success: true,
      subscription: result.subscription,
      invoice: result.invoice,
      message: 'Welcome to paid subscription!',
    });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to confirm payment', error);
    res.status(500).json({ success: false, error: 'Failed to confirm payment' });
  }
});

/**
 * Process refund
 * POST /api/subscription/:clientId/refund
 */
router.post('/:clientId/refund', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, error: 'Valid amount required' });
      return;
    }

    const result = await subscriptionService.processRefund(clientId, amount, reason);

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    logger.info('[SubscriptionRoutes] Refund processed', { clientId, refundId: result.refundId });

    res.json({
      success: true,
      refundId: result.refundId,
      message: 'Refund processed successfully.',
    });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to process refund', error);
    res.status(500).json({ success: false, error: 'Failed to process refund' });
  }
});

/**
 * Get invoices for client
 * GET /api/subscription/:clientId/invoices
 */
router.get('/:clientId/invoices', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const invoices = subscriptionService.getInvoices(clientId);

    res.json({
      success: true,
      invoices,
    });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to get invoices', error);
    res.status(500).json({ success: false, error: 'Failed to get invoices' });
  }
});

/**
 * Get invoice by ID
 * GET /api/subscription/invoices/:invoiceId
 */
router.get('/invoices/:invoiceId', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const invoice = subscriptionService.getInvoice(invoiceId);

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    res.json({
      success: true,
      invoice,
    });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to get invoice', error);
    res.status(500).json({ success: false, error: 'Failed to get invoice' });
  }
});

// ============================================
// USAGE
// ============================================

/**
 * Get current month usage
 * GET /api/subscription/:clientId/usage
 */
router.get('/:clientId/usage', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const usage = subscriptionService.getCurrentMonthUsage(clientId);
    const { withinLimits, overages } = await subscriptionService.checkLimits(clientId);

    res.json({
      success: true,
      usage,
      withinLimits,
      overages,
    });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to get usage', error);
    res.status(500).json({ success: false, error: 'Failed to get usage' });
  }
});

/**
 * Get usage history
 * GET /api/subscription/:clientId/usage/history
 */
router.get('/:clientId/usage/history', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const history = await subscriptionService.getUsageHistory(clientId);

    res.json({
      success: true,
      history,
    });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to get usage history', error);
    res.status(500).json({ success: false, error: 'Failed to get usage history' });
  }
});

/**
 * Record usage
 * POST /api/subscription/:clientId/usage
 */
router.post('/:clientId/usage', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { tickets, agents, brands, apiCalls, storage } = req.body;

    await subscriptionService.recordUsage(clientId, {
      ticketsUsed: tickets || 0,
      agentsUsed: agents || 0,
      brandsUsed: brands || 0,
      apiCalls: apiCalls || 0,
      storageUsed: storage || 0,
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to record usage', error);
    res.status(500).json({ success: false, error: 'Failed to record usage' });
  }
});

// ============================================
// BILLING
// ============================================

/**
 * Get billing amount
 * GET /api/subscription/:clientId/billing/amount
 */
router.get('/:clientId/billing/amount', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const billing = await subscriptionService.calculateBillingAmount(clientId);

    res.json({
      success: true,
      billing,
    });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to get billing', error);
    res.status(500).json({ success: false, error: 'Failed to get billing' });
  }
});

// ============================================
// FEATURES & LIMITS
// ============================================

/**
 * Check feature access
 * GET /api/subscription/:clientId/features/:feature
 */
router.get('/:clientId/features/:feature', async (req: Request, res: Response) => {
  try {
    const { clientId, feature } = req.params;
    const hasAccess = await subscriptionService.hasFeature(clientId, feature);

    res.json({
      success: true,
      feature,
      hasAccess,
    });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to check feature', error);
    res.status(500).json({ success: false, error: 'Failed to check feature' });
  }
});

/**
 * Check limits
 * POST /api/subscription/:clientId/check-limits
 */
router.post('/:clientId/check-limits', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const result = await subscriptionService.checkLimits(clientId);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to check limits', error);
    res.status(500).json({ success: false, error: 'Failed to check limits' });
  }
});

// ============================================
// ADMIN STATS
// ============================================

/**
 * Get subscription statistics (admin)
 * GET /api/subscription/admin/stats
 */
router.get('/admin/stats', async (req: Request, res: Response) => {
  try {
    const stats = await subscriptionService.getStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Failed to get stats', error);
    res.status(500).json({ success: false, error: 'Failed to get stats' });
  }
});

// ============================================
// WEBHOOKS
// ============================================

/**
 * Handle Razorpay webhook
 * POST /api/subscription/webhook/razorpay
 *
 * SECURITY: Verifies webhook signature to prevent fake payment events
 */
router.post('/webhook/razorpay', async (req: Request, res: Response) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-razorpay-signature'] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const isValid = rabtulPayment.verifyWebhookSignature(
        JSON.stringify(req.body),
        signature,
        webhookSecret
      );

      if (!isValid) {
        logger.warn('[SubscriptionRoutes] Invalid webhook signature rejected', {
          ip: req.ip,
          signature: signature.substring(0, 10) + '...',
        });
        res.status(401).json({ success: false, error: 'Invalid signature' });
        return;
      }
    } else if (!webhookSecret) {
      logger.warn('[SubscriptionRoutes] RAZORPAY_WEBHOOK_SECRET not set - skipping verification');
    }

    const webhookEvent = req.body;
    const event = webhookEvent.event;
    const payload = webhookEvent.payload;

    logger.info('[SubscriptionRoutes] Received Razorpay webhook', { event });

    switch (event) {
      case 'payment.captured': {
        const payment = payload.payment;
        if (payment?.metadata?.clientId && payment?.metadata?.subscriptionId) {
          await subscriptionService.confirmPayment(
            payment.metadata.clientId,
            payment.id
          );
          logger.info('[SubscriptionRoutes] Subscription activated via webhook', {
            clientId: payment.metadata.clientId,
            paymentId: payment.id,
          });
        }
        break;
      }

      case 'payment.failed': {
        const payment = payload.payment;
        logger.warn('[SubscriptionRoutes] Payment failed via webhook', {
          paymentId: payment?.id,
          status: payment?.status,
        });

        // Trigger dunning flow - retry payment with escalating notifications
        await subscriptionService.triggerDunning(clientId, payment);
        logger.info('[SubscriptionRoutes] Dunning flow triggered', { clientId, paymentId: payment?.id });
        break;
      }

      case 'refund.processed': {
        logger.info('[SubscriptionRoutes] Refund processed via webhook', {
          refundId: payload.refund?.id,
          amount: payload.refund?.amount,
        });
        break;
      }

      default:
        logger.info('[SubscriptionRoutes] Unhandled webhook event', { event });
    }

    res.json({ success: true, received: true });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Webhook processing failed', error);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

/**
 * Handle RABTUL payment webhook
 * POST /api/subscription/webhook/payment
 */
router.post('/webhook/payment', async (req: Request, res: Response) => {
  try {
    const { event, data } = req.body;

    logger.info('[SubscriptionRoutes] Received payment webhook', { event });

    switch (event) {
      case 'payment.completed': {
        if (data?.razorpayPaymentId && data?.clientId) {
          await subscriptionService.confirmPayment(data.clientId, data.razorpayPaymentId);
          logger.info('[SubscriptionRoutes] Subscription confirmed via webhook', {
            clientId: data.clientId,
          });
        }
        break;
      }

      case 'refund.completed': {
        logger.info('[SubscriptionRoutes] Refund completed', { data });
        break;
      }

      default:
        logger.info('[SubscriptionRoutes] Unhandled payment webhook', { event });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('[SubscriptionRoutes] Payment webhook failed', error);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

export default router;
