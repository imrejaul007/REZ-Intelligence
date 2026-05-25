/**
 * REZ Memory Layer - Event Routes
 * API endpoints for event ingestion
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { normalizeEvent, toTimelineEvent } from '../utils/eventNormalizer';
import { TimelineEventModel } from '../models/TimelineEvent';
import { cacheService } from '../services/cacheService';
import { logger } from '../config/logger';

const router = Router();

const EventSchema = z.object({
  userId: z.string().min(1),
  type: z.string().min(1),
  category: z.string().optional(),
  source: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional()
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = EventSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const normalized = normalizeEvent(validation.data);
    const event = toTimelineEvent(normalized);
    await TimelineEventModel.create(event);
    await cacheService.invalidateUserCache(event.userId);

    res.status(201).json({ success: true, data: { id: event.userId } });
  } catch (error) {
    logger.error('Event ingestion failed', { error: error.message });
    res.status(500).json({ success: false, error: { code: 'INGESTION_FAILED', message: 'Internal error' } });
  }
});

export default router;
