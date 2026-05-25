/**
 * Conversion Routes
 */

import { Router, Request, Response } from 'express';
import { Conversion, ConversionStatus } from '../models/attribution.js';
import { logger } from '../services/logger.js';

export const conversionRouter = Router();

/**
 * GET /api/v1/conversions
 * List conversions
 */
conversionRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { merchantId, customerId, type, status, startDate, endDate, limit = 100 } = req.query;

    const query: unknown = {};
    if (merchantId) query.merchantId = merchantId;
    if (customerId) query.customerId = customerId;
    if (type) query.type = type;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }

    const conversions = await Conversion.find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit));

    res.json({ success: true, data: conversions, count: conversions.length });
  } catch (error) {
    logger.error('Conversions fetch failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/conversions/summary
 * Get conversion summary
 */
conversionRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const { merchantId, startDate, endDate } = req.query;

    const match: unknown = { status: ConversionStatus.COMPLETED };
    if (merchantId) match.merchantId = merchantId;
    if (startDate || endDate) {
      match.timestamp = {};
      if (startDate) match.timestamp.$gte = new Date(startDate as string);
      if (endDate) match.timestamp.$lte = new Date(endDate as string);
    }

    const summary = await Conversion.aggregate([
      { $match: match },
      { $group: {
        _id: null,
        totalConversions: { $sum: 1 },
        totalRevenue: { $sum: '$value.amount' },
        avgOrderValue: { $avg: '$value.amount' }
      }}
    ]);

    res.json({
      success: true,
      data: summary[0] || {
        totalConversions: 0,
        totalRevenue: 0,
        avgOrderValue: 0
      }
    });
  } catch (error) {
    logger.error('Conversion summary failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/conversions/breakdown
 * Get conversion breakdown by channel
 */
conversionRouter.get('/breakdown', async (req: Request, res: Response) => {
  try {
    const { merchantId, startDate, endDate } = req.query;

    const match: unknown = { status: ConversionStatus.COMPLETED };
    if (merchantId) match.merchantId = merchantId;
    if (startDate || endDate) {
      match.timestamp = {};
      if (startDate) match.timestamp.$gte = new Date(startDate as string);
      if (endDate) match.timestamp.$lte = new Date(endDate as string);
    }

    const breakdown = await Conversion.aggregate([
      { $match: match },
      { $unwind: '$attributedChannels' },
      { $group: {
        _id: '$attributedChannels',
        count: { $sum: 1 },
        revenue: { $sum: '$value.amount' }
      }},
      { $sort: { revenue: -1 } }
    ]);

    const totalRevenue = breakdown.reduce((sum: number, b) => sum + b.revenue, 0);

    res.json({
      success: true,
      data: breakdown.map((b) => ({
        channel: b._id,
        conversions: b.count,
        revenue: b.revenue,
        percentage: totalRevenue > 0 ? (b.revenue / totalRevenue * 100).toFixed(2) : 0
      }))
    });
  } catch (error) {
    logger.error('Conversion breakdown failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});
