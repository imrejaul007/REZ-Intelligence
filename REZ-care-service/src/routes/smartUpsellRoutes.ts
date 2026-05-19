/**
 * REZ Care Service - Smart Upsell Routes
 *
 * Endpoints for product-based upselling:
 * - Product upgrades
 * - Accessories
 * - Complementary products
 * - Premium alternatives
 * - Agent suggestions
 */

import express, { Request, Response } from 'express';
import { smartUpsellEngine } from '../services/smartUpsellEngine';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Get all upsell opportunities
 * POST /api/smart-upsell/opportunities
 */
router.post('/opportunities', async (req: Request, res: Response) => {
  try {
    const { customerId, orderId, productId, category } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'customerId is required'
      });
    }

    const opportunities = await smartUpsellEngine.getUpsells({
      customerId,
      orderId,
      productId,
      category,
    });

    // Flatten all offers for response
    const allOffers = [
      ...opportunities.upgrades,
      ...opportunities.accessories,
      ...opportunities.complementary,
      ...opportunities.premium,
      ...opportunities.newArrivals,
    ].sort((a, b) => b.confidence - a.confidence);

    res.json({
      success: true,
      offers: allOffers,
      byType: opportunities,
      agentSuggestions: smartUpsellEngine.generateAgentSuggestions(opportunities),
    });
  } catch (error: any) {
    logger.error('[SmartUpsell] Failed to get opportunities', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get product upgrades
 * POST /api/smart-upsell/upgrades
 */
router.post('/upgrades', async (req: Request, res: Response) => {
  try {
    const { customerId, orderId, productId } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'customerId is required'
      });
    }

    const opportunities = await smartUpsellEngine.getUpsells({
      customerId,
      orderId,
      productId,
    });

    res.json({
      success: true,
      upgrades: opportunities.upgrades,
    });
  } catch (error: any) {
    logger.error('[SmartUpsell] Failed to get upgrades', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get accessories
 * POST /api/smart-upsell/accessories
 */
router.post('/accessories', async (req: Request, res: Response) => {
  try {
    const { customerId, orderId, productId } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'customerId is required'
      });
    }

    const opportunities = await smartUpsellEngine.getUpsells({
      customerId,
      orderId,
      productId,
    });

    res.json({
      success: true,
      accessories: opportunities.accessories,
    });
  } catch (error: any) {
    logger.error('[SmartUpsell] Failed to get accessories', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get complementary products
 * POST /api/smart-upsell/complementary
 */
router.post('/complementary', async (req: Request, res: Response) => {
  try {
    const { customerId, category } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'customerId is required'
      });
    }

    const opportunities = await smartUpsellEngine.getUpsells({
      customerId,
      category,
    });

    res.json({
      success: true,
      complementary: opportunities.complementary,
    });
  } catch (error: any) {
    logger.error('[SmartUpsell] Failed to get complementary', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get agent suggestions for conversation
 * POST /api/smart-upsell/agent-suggestions
 */
router.post('/agent-suggestions', async (req: Request, res: Response) => {
  try {
    const { customerId, orderId, productId, category } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'customerId is required'
      });
    }

    const opportunities = await smartUpsellEngine.getUpsells({
      customerId,
      orderId,
      productId,
      category,
    });

    res.json({
      success: true,
      suggestions: smartUpsellEngine.generateAgentSuggestions(opportunities),
      topOffers: opportunities.upgrades.slice(0, 2),
    });
  } catch (error: any) {
    logger.error('[SmartUpsell] Failed to get agent suggestions', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get personalized offers for customer
 * GET /api/smart-upsell/personalized/:customerId
 */
router.get('/personalized/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    const offers = await smartUpsellEngine.getPersonalizedOffers(customerId);

    res.json({
      success: true,
      offers,
    });
  } catch (error: any) {
    logger.error('[SmartUpsell] Failed to get personalized', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Track upsell interaction
 * POST /api/smart-upsell/track
 */
router.post('/track', async (req: Request, res: Response) => {
  try {
    const { customerId, offerId, offerType, productId, action } = req.body;

    if (!customerId || !offerId || !action) {
      return res.status(400).json({
        success: false,
        error: 'customerId, offerId, and action are required'
      });
    }

    await smartUpsellEngine.trackOffer(customerId, {
      id: offerId,
      type: offerType || 'complementary',
      title: 'Product',
      description: '',
      product: { id: productId || '', name: '', category: '', price: 0 },
      reason: '',
      confidence: 0.5,
    }, action);

    res.json({
      success: true,
      message: action === 'accepted'
        ? 'Great choice! We will add this to your order.'
        : 'No problem! Let us know if you need anything else.',
    });
  } catch (error: any) {
    logger.error('[SmartUpsell] Failed to track', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
