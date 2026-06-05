import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { EventsIntelligence } from '../services/eventsIntelligence';
import { validateRequest } from '../middleware/validation';
import { errorHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const eventsIntelligence = new EventsIntelligence();

const campaignRequestSchema = z.object({
  eventId: z.string().min(1),
  budget: z.number().optional(),
  targetReach: z.number().optional(),
  timeline: z.object({ start: z.string().datetime(), end: z.string().datetime() }).optional(),
});

router.post('/:eventId/campaign', validateRequest(campaignRequestSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId, budget, targetReach, timeline } = req.body;
    logger.info('Generating marketing campaign', { eventId, budget });

    const campaign = await eventsIntelligence.generateMarketingCampaign({
      eventId, budget: budget || 5000, targetReach: targetReach || 10000, timeline,
    });

    res.status(201).json({ success: true, data: campaign });
  } catch (error) { next(error); }
});

router.get('/:eventId/insights', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    logger.info('Getting marketing insights', { eventId });
    const insights = await eventsIntelligence.getMarketingInsights(eventId);
    res.status(200).json({ success: true, data: insights });
  } catch (error) { next(error); }
});

router.use(errorHandler);
export default router;