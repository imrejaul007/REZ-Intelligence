/**
 * Attribution Routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { Touchpoint, Conversion, Channel, Spend, IncrementalityTest, ChannelType, AttributionModel, ConversionType, ConversionStatus } from '../models/attribution.js';
import { calculateAttribution, getChannelAttributionSummary, getChannelROI, trackDOOHAttribution, trackQRAttribution, trackCreatorAttribution, trackAggregatorAttribution } from '../services/attribution.js';
import { logger } from '../services/logger.js';

export const attributionRouter = Router();

// ============================================
// TOUCHPOINT ROUTES
// ============================================

/**
 * POST /api/v1/track/touchpoint
 * Track a touchpoint
 */
attributionRouter.post('/track/touchpoint', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      customerId: z.string(),
      merchantId: z.string(),
      channel: z.nativeEnum(ChannelType),
      sessionId: z.string().optional(),
      storeId: z.string().optional(),
      source: z.string().optional(),
      medium: z.string().optional(),
      campaign: z.string().optional(),
      content: z.string().optional(),
      keyword: z.string().optional(),
      campaignId: z.string().optional(),
      adId: z.string().optional(),
      dooh: z.object({
        screenId: z.string(),
        screenType: z.string().optional(),
        dwellTime: z.number().optional()
      }).optional(),
      qr: z.object({
        qrId: z.string(),
        context: z.enum(['menu', 'order', 'payment', 'feedback', 'general'])
      }).optional(),
      creator: z.object({
        creatorId: z.string(),
        platform: z.enum(['instagram', 'youtube', 'tiktok', 'twitter'])
      }).optional()
    });

    const data = schema.parse(req.body);

    const touchpoint = await Touchpoint.create({
      touchpointId: `tp_${Date.now()}_${uuid()}`,
      ...data,
      userId: data.customerId,
      timestamp: new Date()
    });

    res.json({ success: true, data: touchpoint });
  } catch (error) {
    logger.error('Touchpoint track failed', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/track/touchpoint/batch
 * Batch track touchpoints
 */
attributionRouter.post('/track/touchpoint/batch', async (req: Request, res: Response) => {
  try {
    const schema = z.array(z.object({
      customerId: z.string(),
      merchantId: z.string(),
      channel: z.nativeEnum(ChannelType),
      sessionId: z.string().optional()
    }));

    const data = schema.parse(req.body);

    const touchpoints = await Touchpoint.insertMany(data.map((d, i) => ({
      touchpointId: `tp_${Date.now()}_${i}_${uuid()}`,
      ...d,
      userId: d.customerId,
      timestamp: new Date()
    })));

    res.json({ success: true, count: touchpoints.length });
  } catch (error) {
    logger.error('Batch touchpoint track failed', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/track/touchpoints
 * List touchpoints
 */
attributionRouter.get('/track/touchpoints', async (req: Request, res: Response) => {
  try {
    const { merchantId, customerId, channel, startDate, endDate, limit = 50 } = req.query;

    const query: unknown = {};
    if (merchantId) query.merchantId = merchantId;
    if (customerId) query.customerId = customerId;
    if (channel) query.channel = channel;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }

    const touchpoints = await Touchpoint.find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit));

    res.json({ success: true, data: touchpoints });
  } catch (error) {
    logger.error('Touchpoints fetch failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CONVERSION ROUTES
// ============================================

/**
 * POST /api/v1/track/conversion
 * Track a conversion
 */
attributionRouter.post('/track/conversion', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      customerId: z.string(),
      merchantId: z.string(),
      orderId: z.string().optional(),
      type: z.nativeEnum(ConversionType),
      amount: z.number(),
      currency: z.string().optional(),
      sessionId: z.string().optional(),
      storeId: z.string().optional(),
      items: z.array(z.object({
        productId: z.string(),
        name: z.string(),
        quantity: z.number(),
        price: z.number()
      })).optional(),
      aggregator: z.object({
        platform: z.enum(['swiggy', 'zomato', 'dunzo']),
        commission: z.number().optional(),
        profit: z.number().optional()
      }).optional()
    });

    const data = schema.parse(req.body);

    const conversion = await Conversion.create({
      conversionId: `conv_${Date.now()}_${uuid()}`,
      ...data,
      userId: data.customerId,
      value: {
        amount: data.amount,
        currency: data.currency || 'INR'
      },
      status: ConversionStatus.PENDING,
      timestamp: new Date()
    });

    // Calculate attribution
    const attribution = await calculateAttribution(
      data.customerId,
      conversion.conversionId,
      AttributionModel.LAST_TOUCH
    );

    // Update conversion with attribution
    conversion.attributedChannels = attribution.map(a => a.channel);
    conversion.attributionModel = AttributionModel.LAST_TOUCH;
    await conversion.save();

    res.json({
      success: true,
      data: {
        conversion,
        attribution
      }
    });
  } catch (error) {
    logger.error('Conversion track failed', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/track/conversions
 * List conversions
 */
attributionRouter.get('/track/conversions', async (req: Request, res: Response) => {
  try {
    const { merchantId, customerId, status, startDate, endDate, limit = 50 } = req.query;

    const query: unknown = {};
    if (merchantId) query.merchantId = merchantId;
    if (customerId) query.customerId = customerId;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }

    const conversions = await Conversion.find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit));

    res.json({ success: true, data: conversions });
  } catch (error) {
    logger.error('Conversions fetch failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/v1/track/conversion/:id/status
 * Update conversion status (for refunds)
 */
attributionRouter.patch('/track/conversion/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const conversion = await Conversion.findOneAndUpdate(
      { conversionId: req.params.id },
      { status },
      { new: true }
    );

    if (!conversion) {
      return res.status(404).json({ success: false, error: 'Conversion not found' });
    }

    res.json({ success: true, data: conversion });
  } catch (error) {
    logger.error('Conversion status update failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DOOH ROUTES
// ============================================

/**
 * POST /api/v1/dooh/impression
 * Record DOOH impression
 */
attributionRouter.post('/dooh/impression', async (req: Request, res: Response) => {
  try {
    const { merchantId, screenId, customerId, dwellTime } = req.body;

    await Touchpoint.create({
      touchpointId: `dooh_${Date.now()}_${uuid()}`,
      merchantId,
      customerId,
      channel: ChannelType.DOOH,
      dooh: {
        screenId,
        dwellTime: dwellTime || 0,
        impressionCount: 1
      },
      timestamp: new Date()
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('DOOH impression failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/dooh/visit
 * Record DOOH → store visit
 */
attributionRouter.post('/dooh/visit', async (req: Request, res: Response) => {
  try {
    const { merchantId, screenId, customerId, storeId, dwellTime } = req.body;

    await Touchpoint.create({
      touchpointId: `dooh_visit_${Date.now()}_${uuid()}`,
      merchantId,
      customerId,
      storeId,
      channel: ChannelType.DOOH,
      dooh: {
        screenId,
        dwellTime: dwellTime || 0,
        visited: true
      },
      timestamp: new Date()
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('DOOH visit failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// QR ROUTES
// ============================================

/**
 * POST /api/v1/qr/scan
 * Record QR scan
 */
attributionRouter.post('/qr/scan', async (req: Request, res: Response) => {
  try {
    const { merchantId, qrId, customerId, context } = req.body;

    await Touchpoint.create({
      touchpointId: `qr_${Date.now()}_${uuid()}`,
      merchantId,
      customerId,
      channel: ChannelType.QR,
      qr: {
        qrId,
        context: context || 'general'
      },
      timestamp: new Date()
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('QR scan failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CREATOR ROUTES
// ============================================

/**
 * POST /api/v1/creator/view
 * Record creator content view
 */
attributionRouter.post('/creator/view', async (req: Request, res: Response) => {
  try {
    const { merchantId, creatorId, platform, customerId, contentType } = req.body;

    await Touchpoint.create({
      touchpointId: `creator_${Date.now()}_${uuid()}`,
      merchantId,
      customerId,
      channel: ChannelType.CREATOR,
      creator: {
        creatorId,
        platform: platform || 'instagram',
        contentType: contentType || 'post',
        engagement: 0
      },
      timestamp: new Date()
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Creator view failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/creator/coupon
 * Record creator coupon usage
 */
attributionRouter.post('/creator/coupon', async (req: Request, res: Response) => {
  try {
    const { merchantId, creatorId, platform, customerId, couponCode } = req.body;

    await Touchpoint.create({
      touchpointId: `creator_coupon_${Date.now()}_${uuid()}`,
      merchantId,
      customerId,
      channel: ChannelType.CREATOR,
      creator: {
        creatorId,
        platform: platform || 'instagram',
        contentType: 'post',
        engagement: 0,
        couponUsed: true
      },
      metadata: { couponCode },
      timestamp: new Date()
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Creator coupon failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// AGGREGATOR ROUTES
// ============================================

/**
 * POST /api/v1/aggregator/order
 * Record aggregator order
 */
attributionRouter.post('/aggregator/order', async (req: Request, res: Response) => {
  try {
    const { merchantId, platform, customerId, orderId, commission, profit, amount } = req.body;

    // Create touchpoint
    await Touchpoint.create({
      touchpointId: `agg_${Date.now()}_${uuid()}`,
      merchantId,
      customerId,
      channel: ChannelType.AGGREGATOR,
      aggregator: {
        platform,
        listingVisits: 1,
        orderPlaced: true
      },
      timestamp: new Date()
    });

    // Create conversion
    const conversion = await Conversion.create({
      conversionId: `agg_conv_${Date.now()}_${uuid()}`,
      merchantId,
      customerId,
      orderId,
      type: ConversionType.PURCHASE,
      value: {
        amount,
        currency: 'INR'
      },
      aggregator: {
        platform,
        commission: commission || 0,
        revenue: amount,
        profit: profit || amount
      },
      attributedChannels: [ChannelType.AGGREGATOR],
      attributionModel: AttributionModel.LAST_TOUCH,
      timestamp: new Date()
    });

    res.json({ success: true, data: conversion });
  } catch (error) {
    logger.error('Aggregator order failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});
