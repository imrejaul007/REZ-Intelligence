/**
 * ROI Routes
 */

import { Router, Request, Response } from 'express';
import { Spend } from '../models/attribution.js';
import { getChannelROI } from '../services/attribution.js';
import { logger } from '../services/logger.js';

export const roiRouter = Router();

/**
 * GET /api/v1/roi
 * Get ROI metrics
 */
roiRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { merchantId, startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const roi = await getChannelROI(
      merchantId as string,
      start,
      end
    );

    res.json({ success: true, data: roi });
  } catch (error: any) {
    logger.error('ROI fetch failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/roi/summary
 * Get ROI summary
 */
roiRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const { merchantId, startDate, endDate } = req.query;

    const match: any = {};
    if (merchantId) match.merchantId = merchantId;
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate as string);
      if (endDate) match.date.$lte = new Date(endDate as string);
    }

    const spendSummary = await Spend.aggregate([
      { $match: match },
      { $group: {
        _id: null,
        totalSpend: { $sum: '$amount' }
      }}
    ]);

    res.json({
      success: true,
      data: {
        totalSpend: spendSummary[0]?.totalSpend || 0,
        period: {
          start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: endDate || new Date()
        }
      }
    });
  } catch (error: any) {
    logger.error('ROI summary failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});
