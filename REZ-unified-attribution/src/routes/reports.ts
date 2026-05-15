/**
 * Report Routes
 */

import { Router, Request, Response } from 'express';
import { Conversion, ConversionStatus } from '../models/attribution.js';
import { getChannelAttributionSummary } from '../services/attribution.js';
import { AttributionModel } from '../models/attribution.js';
import { logger } from '../services/logger.js';

export const reportRouter = Router();

/**
 * GET /api/v1/reports/attribution
 * Get attribution report
 */
reportRouter.get('/attribution', async (req: Request, res: Response) => {
  try {
    const { merchantId, startDate, endDate, model } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const attribution = await getChannelAttributionSummary(
      merchantId as string,
      start,
      end,
      (model as AttributionModel) || AttributionModel.LAST_TOUCH
    );

    res.json({ success: true, data: attribution });
  } catch (error: any) {
    logger.error('Attribution report failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/reports/funnel
 * Get conversion funnel
 */
reportRouter.get('/funnel', async (req: Request, res: Response) => {
  try {
    const { merchantId, startDate, endDate } = req.query;

    const match: any = {};
    if (merchantId) match.merchantId = merchantId;
    if (startDate || endDate) {
      match.timestamp = {};
      if (startDate) match.timestamp.$gte = new Date(startDate as string);
      if (endDate) match.timestamp.$lte = new Date(endDate as string);
    }

    const funnel = await Conversion.aggregate([
      { $match: match },
      { $group: {
        _id: '$status',
        count: { $sum: 1 }
      }}
    ]);

    const funnelData = {
      total: 0,
      stages: {} as Record<string, number>
    };

    funnel.forEach((stage: any) => {
      funnelData.total += stage.count;
      funnelData.stages[stage._id] = stage.count;
    });

    res.json({ success: true, data: funnelData });
  } catch (error: any) {
    logger.error('Funnel report failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/reports/dashboard
 * Get dashboard metrics
 */
reportRouter.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const { merchantId, startDate, endDate } = req.query;

    const match: any = { status: ConversionStatus.COMPLETED };
    if (merchantId) match.merchantId = merchantId;
    if (startDate || endDate) {
      match.timestamp = {};
      if (startDate) match.timestamp.$gte = new Date(startDate as string);
      if (endDate) match.timestamp.$lte = new Date(endDate as string);
    }

    const [summary, byChannel] = await Promise.all([
      Conversion.aggregate([
        { $match: match },
        { $group: {
          _id: null,
          totalConversions: { $sum: 1 },
          totalRevenue: { $sum: '$value.amount' },
          avgOrderValue: { $avg: '$value.amount' }
        }}
      ]),
      Conversion.aggregate([
        { $match: match },
        { $unwind: '$attributedChannels' },
        { $group: {
          _id: '$attributedChannels',
          count: { $sum: 1 },
          revenue: { $sum: '$value.amount' }
        }},
        { $sort: { revenue: -1 } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        overview: summary[0] || { totalConversions: 0, totalRevenue: 0, avgOrderValue: 0 },
        byChannel: byChannel
      }
    });
  } catch (error: any) {
    logger.error('Dashboard report failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});
