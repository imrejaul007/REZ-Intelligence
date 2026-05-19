/**
 * REZ Care Service - Upsell Routes
 *
 * Endpoints for upsell/cross-sell during support interactions
 */

import express, { Request, Response } from 'express';
import { upsellEngine, UpsellOffer } from '../services/upsellEngine';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Get upsell offers for a support context
 * POST /api/upsell/offers
 */
router.post('/offers', async (req: Request, res: Response) => {
  try {
    const { customerId, category, orderId, productId, merchantId, platform } = req.body;

    if (!customerId || !category) {
      return res.status(400).json({
        success: false,
        error: 'customerId and category are required'
      });
    }

    const offers = await upsellEngine.getOffers({
      customerId,
      category,
      orderId,
      productId,
      merchantId,
      platform: platform || 'support',
    });

    // Track impressions
    await upsellEngine.trackConversion('offers_generated', customerId, 'shown');

    res.json({
      success: true,
      offers,
      message: offers.length > 0 ? upsellEngine.generateUpsellMessage(offers) : null,
    });
  } catch (error: any) {
    logger.error('[Upsell] Failed to get offers', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get offers for current ticket
 * POST /api/upsell/ticket/:ticketId
 */
router.post('/ticket/:ticketId', async (req: Request, res: Response) => {
  try {
    const { ticketId } = req.params;
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'customerId is required'
      });
    }

    // Get ticket context from ticket (would need to fetch from DB)
    // For now, use provided context
    const offers = await upsellEngine.getOffers({
      customerId,
      category: req.body.category || 'general',
      orderId: req.body.orderId,
      productId: req.body.productId,
      platform: 'support',
    });

    res.json({
      success: true,
      ticketId,
      offers,
      message: offers.length > 0 ? upsellEngine.generateUpsellMessage(offers) : null,
    });
  } catch (error: any) {
    logger.error('[Upsell] Failed to get ticket offers', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Track upsell interaction
 * POST /api/upsell/track
 */
router.post('/track', async (req: Request, res: Response) => {
  try {
    const { offerId, customerId, action } = req.body;

    if (!offerId || !customerId || !action) {
      return res.status(400).json({
        success: false,
        error: 'offerId, customerId, and action are required'
      });
    }

    await upsellEngine.trackConversion(offerId, customerId, action);

    res.json({
      success: true,
      message: action === 'accepted'
        ? 'Offer accepted! We will process your request shortly.'
        : 'Thanks for your response!'
    });
  } catch (error: any) {
    logger.error('[Upsell] Failed to track', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get all offer templates
 * GET /api/upsell/templates
 */
router.get('/templates', async (req: Request, res: Response) => {
  const templates = [
    {
      id: 'payment_protection',
      type: 'addon',
      category: 'payment',
      title: 'Payment Protection Plan',
      description: 'Never worry about failed payments again',
      offer: '₹99/month - Unlimited retries',
    },
    {
      id: 'priority_delivery',
      type: 'upsell',
      category: 'delivery',
      title: 'Priority Delivery',
      description: 'Get orders 2x faster',
      offer: '₹199/month',
    },
    {
      id: 'order_guarantee',
      type: 'addon',
      category: 'order',
      title: 'Order Guarantee',
      description: 'Auto-refund for wrong/missing items',
      offer: '₹49/month',
    },
    {
      id: 'premium_support',
      type: 'subscription',
      category: 'technical',
      title: 'Premium Support',
      description: '24/7 dedicated support',
      offer: '₹299/month',
    },
    {
      id: 'prime_membership',
      type: 'subscription',
      category: 'all',
      title: 'REZ Prime',
      description: 'Free delivery + exclusive deals',
      offer: '₹499/year',
    },
    {
      id: 'concierge',
      type: 'subscription',
      category: 'all',
      title: 'Personal Concierge',
      description: 'Dedicated relationship manager',
      offer: '₹1999/month',
    },
  ];

  res.json({ success: true, templates });
});

export default router;
