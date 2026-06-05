import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { VendorMatch } from '../models';
import { VendorMatcher } from '../services/vendorMatcher';
import { validateRequest } from '../middleware/validation';
import { errorHandler } from '../middleware/errorHandler';
import { EventType, VendorCategory } from '../types';
import { logger } from '../utils/logger';

const router = Router();
const vendorMatcher = new VendorMatcher();

const recommendRequestSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.nativeEnum(EventType),
  requirements: z.array(z.string()).optional(),
  budget: z.number().optional(),
});

router.get('/:eventId/matches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    logger.info('Fetching vendor matches', { eventId });
    const matches = await VendorMatch.findByEvent(eventId, 20);
    res.status(200).json({ success: true, data: { matches: matches.map(m => ({ vendorId: m.vendorId, vendorName: m.vendorName, category: m.category, matchScore: m.matchScore, compatibility: m.compatibility, pricing: m.pricing, performance: m.performance })) } });
  } catch (error) { next(error); }
});

router.post('/recommend', validateRequest(recommendRequestSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId, eventType, requirements, budget } = req.body;
    logger.info('Getting vendor recommendations', { eventId, eventType });

    const matches = await vendorMatcher.findMatches({ eventId, eventType, requirements, budget });

    for (const match of matches) {
      const vendorDoc = new VendorMatch({
        matchId: match.matchId, eventId, vendorId: match.vendorId, vendorName: match.vendorName,
        category: match.category, matchScore: match.matchScore, compatibility: match.compatibility,
        pricing: match.pricing, performance: match.performance, recommendations: match.recommendations, eventType,
      });
      await vendorDoc.save();
    }

    res.status(201).json({ success: true, data: { matches } });
  } catch (error) { next(error); }
});

router.get('/:eventId/performance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    logger.info('Fetching vendor performance', { eventId });
    const performance = await vendorMatcher.getPerformanceMetrics(eventId);
    res.status(200).json({ success: true, data: performance });
  } catch (error) { next(error); }
});

router.use(errorHandler);
export default router;