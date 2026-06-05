import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { EventsMindSession } from '../models';
import { EventsIntelligence } from '../services/eventsIntelligence';
import { validateRequest } from '../middleware/validation';
import { errorHandler } from '../middleware/errorHandler';
import { EventType } from '../types';
import { logger } from '../utils/logger';

const router = Router();
const eventsIntelligence = new EventsIntelligence();

const consultRequestSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  organizerId: z.string().optional(),
  eventDetails: z.object({
    type: z.nativeEnum(EventType),
    name: z.string().optional(),
    date: z.string().datetime().or(z.date()),
    venue: z.string().optional(),
    capacity: z.number().int().positive().optional(),
    budget: z.number().optional(),
  }).optional(),
});

router.post('/', validateRequest(consultRequestSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startTime = Date.now();
    const { eventId, organizerId, eventDetails } = req.body;
    logger.info('Processing events consultation', { eventId, organizerId });

    const sessionId = uuidv4();
    const analysis = await eventsIntelligence.analyzeEvent(eventId, eventDetails);

    try {
      const session = new EventsMindSession({
        sessionId, eventId, organizerId, intent: 'events_consultation',
        context: eventDetails ? { eventType: eventDetails.type, eventDate: new Date(eventDetails.date), venue: eventDetails.venue, capacity: eventDetails.capacity } : {},
        analysis, sentiment: 0.5,
      });
      await session.save();
    } catch (dbError) {
      logger.warn('Failed to save session', { sessionId, error: dbError });
    }

    const duration = Date.now() - startTime;
    res.status(200).json({ success: true, data: { sessionId, ...analysis, confidence: 0.82 }, meta: { sessionId, duration, timestamp: new Date().toISOString() } });
  } catch (error) { next(error); }
});

router.get('/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) { res.status(400).json({ success: false, error: { code: 'INVALID_SESSION_ID', message: 'Session ID is required' } }); return; }
    const session = await EventsMindSession.findOne({ sessionId });
    if (!session) { res.status(404).json({ success: false, error: { code: 'SESSION_NOT_FOUND', message: 'Consultation session not found' } }); return; }
    res.status(200).json({ success: true, data: { sessionId: session.sessionId, eventId: session.eventId, organizerId: session.organizerId, context: session.context, analysis: session.analysis, sentiment: session.sentiment, createdAt: session.createdAt, updatedAt: session.updatedAt } });
  } catch (error) { next(error); }
});

router.use(errorHandler);
export default router;