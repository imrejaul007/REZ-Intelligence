/**
 * REZ Memory Layer - Timeline Routes
 * Simple timeline API endpoints
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { TimelineEventModel } from '../models/TimelineEvent';
import { cacheService } from '../services/cacheService';
import { logger } from '../config/logger';

const router = Router();

router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = '100' } = req.query;

    const cached = await cacheService.getCachedTimeline(userId);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const events = await TimelineEventModel.find({ userId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit as string) || 100);

    await cacheService.cacheTimeline(userId, events);
    res.json({ success: true, data: events });
  } catch (error) {
    logger.error('Timeline fetch failed', { error: error.message });
    res.status(500).json({ success: false, error: { message: 'Failed to fetch timeline' } });
  }
});

router.get('/:userId/summary', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const events = await TimelineEventModel.countDocuments({ userId });
    const lastEvent = await TimelineEventModel.findOne({ userId }).sort({ timestamp: -1 });
    res.json({
      success: true,
      data: { totalEvents: events, lastActivity: lastEvent?.timestamp }
    });
  } catch (error) {
    logger.error('Summary failed', { error: error.message });
    res.status(500).json({ success: false, error: { message: 'Failed to fetch summary' } });
  }
});

router.post('/events', async (req: Request, res: Response) => {
  try {
    const { userId, type, category, source, data } = req.body;
    const event = await TimelineEventModel.create({
      userId,
      type,
      category: category || 'unknown',
      source: source || 'api',
      timestamp: new Date(),
      data: data || {},
      metadata: {}
    });
    await cacheService.invalidateUserCache(userId);
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    logger.error('Event creation failed', { error: error.message });
    res.status(500).json({ success: false, error: { message: 'Failed to create event' } });
  }
});

export default router;
