/**
 * Touchpoint Routes
 */

import { Router, Request, Response } from 'express';
import { Touchpoint, ChannelType } from '../models/attribution.js';
import { logger } from '../services/logger.js';

export const touchpointRouter = Router();

/**
 * GET /api/v1/touchpoints
 * List touchpoints
 */
touchpointRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { merchantId, customerId, channel, sessionId, startDate, endDate, limit = 100 } = req.query;

    const query: any = {};
    if (merchantId) query.merchantId = merchantId;
    if (customerId) query.customerId = customerId;
    if (channel) query.channel = channel;
    if (sessionId) query.sessionId = sessionId;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }

    const touchpoints = await Touchpoint.find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit));

    res.json({ success: true, data: touchpoints, count: touchpoints.length });
  } catch (error: any) {
    logger.error('Touchpoints fetch failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/touchpoints/stats
 * Get touchpoint statistics
 */
touchpointRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const { merchantId, startDate, endDate } = req.query;

    const match: any = {};
    if (merchantId) match.merchantId = merchantId;
    if (startDate || endDate) {
      match.timestamp = {};
      if (startDate) match.timestamp.$gte = new Date(startDate as string);
      if (endDate) match.timestamp.$lte = new Date(endDate as string);
    }

    const stats = await Touchpoint.aggregate([
      { $match: match },
      { $group: {
        _id: '$channel',
        count: { $sum: 1 }
      }}
    ]);

    res.json({ success: true, data: stats });
  } catch (error: any) {
    logger.error('Touchpoint stats failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/touchpoints/distribution
 * Get channel distribution
 */
touchpointRouter.get('/distribution', async (req: Request, res: Response) => {
  try {
    const { merchantId, startDate, endDate } = req.query;

    const match: any = {};
    if (merchantId) match.merchantId = merchantId;
    if (startDate || endDate) {
      match.timestamp = {};
      if (startDate) match.timestamp.$gte = new Date(startDate as string);
      if (endDate) match.timestamp.$lte = new Date(endDate as string);
    }

    const distribution = await Touchpoint.aggregate([
      { $match: match },
      { $group: {
        _id: '$channel',
        count: { $sum: 1 }
      }},
      { $sort: { count: -1 } }
    ]);

    const total = distribution.reduce((sum: number, d: any) => sum + d.count, 0);

    res.json({
      success: true,
      data: distribution.map((d: any) => ({
        channel: d._id,
        count: d.count,
        percentage: total > 0 ? (d.count / total * 100).toFixed(2) : 0
      }))
    });
  } catch (error: any) {
    logger.error('Touchpoint distribution failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});
