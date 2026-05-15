/**
 * Channel Routes
 */

import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { Channel, ChannelType } from '../models/attribution.js';
import { logger } from '../services/logger.js';

export const channelRouter = Router();

/**
 * GET /api/v1/channels
 * List all channels
 */
channelRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { merchantId, type, active } = req.query;

    const query: any = {};
    if (merchantId) query.merchantId = merchantId;
    if (type) query.type = type;
    if (active !== undefined) query.isActive = active === 'true';

    const channels = await Channel.find(query);
    res.json({ success: true, data: channels });
  } catch (error: any) {
    logger.error('Channels fetch failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/channels
 * Create channel
 */
channelRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { merchantId, name, type, category, costPerAcquisition, costPerClick, costPerThousand } = req.body;

    const channel = await Channel.create({
      channelId: `ch_${uuid()}`,
      merchantId,
      name,
      type: type || ChannelType.ORGANIC,
      category: category || 'owned',
      costPerAcquisition,
      costPerClick,
      costPerThousand
    });

    res.json({ success: true, data: channel });
  } catch (error: any) {
    logger.error('Channel create failed', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/channels/stats
 * Get channel statistics
 */
channelRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.query;

    const channels = await Channel.find(merchantId ? { merchantId } : {});

    const stats = channels.reduce((acc: any, ch: any) => {
      if (!acc[ch.type]) {
        acc[ch.type] = { count: 0, active: 0 };
      }
      acc[ch.type].count++;
      if (ch.isActive) acc[ch.type].active++;
      return acc;
    }, {});

    res.json({ success: true, data: stats });
  } catch (error: any) {
    logger.error('Channel stats failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});
