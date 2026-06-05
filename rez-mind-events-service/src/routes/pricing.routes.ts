import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { PricingOptimization } from '../models';
import { PricingOptimizer } from '../services/pricingOptimizer';
import { validateRequest } from '../middleware/validation';
import { errorHandler } from '../middleware/errorHandler';
import { EventType, DemandLevel } from '../types';
import { logger } from '../utils/logger';

const router = Router();
const pricingOptimizer = new PricingOptimizer();

const optimizeRequestSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.nativeEnum(EventType),
  currentPrice: z.number().min(0),
  targetAttendance: z.number().int().positive().optional(),
  competitorsPrices: z.array(z.number()).optional(),
});

router.get('/:eventId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    logger.info('Fetching pricing optimization', { eventId });
    const optimizations = await PricingOptimization.findByEvent(eventId);
    const latest = optimizations[0];
    res.status(200).json({ success: true, data: { currentPrice: latest?.currentPrice, optimizedPrice: latest?.optimizedPrice, demandLevel: latest?.demandLevel, confidence: latest?.confidence, priceRange: latest?.priceRange, factors: latest?.factors } });
  } catch (error) { next(error); }
});

router.post('/:eventId/optimize', validateRequest(optimizeRequestSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId, eventType, currentPrice, targetAttendance, competitorsPrices } = req.body;
    logger.info('Optimizing pricing', { eventId, currentPrice });

    const optimization = await pricingOptimizer.optimizePrice({
      eventId, eventType, currentPrice, targetAttendance, competitorsPrices,
    });

    const pricingDoc = new PricingOptimization({
      optimizationId: optimization.optimizationId,
      eventId, eventType, currentPrice, optimizedPrice: optimization.optimizedPrice,
      demandLevel: optimization.demandLevel, confidence: optimization.confidence,
      factors: optimization.factors, priceRange: optimization.priceRange,
      optimizationDate: optimization.optimizationDate,
      expectedRevenue: optimization.expectedRevenue,
    });
    await pricingDoc.save();

    res.status(201).json({ success: true, data: optimization });
  } catch (error) { next(error); }
});

router.get('/:eventId/demand', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventId } = req.params;
    logger.info('Getting demand forecast', { eventId });
    const demand = await pricingOptimizer.forecastDemand(eventId);
    res.status(200).json({ success: true, data: demand });
  } catch (error) { next(error); }
});

router.use(errorHandler);
export default router;