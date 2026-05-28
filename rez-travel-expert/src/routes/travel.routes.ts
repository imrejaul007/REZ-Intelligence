import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  travelExpert,
  TravelContext,
  Traveler,
  TravelStyle,
  BudgetLevel,
  Trip
} from '../services/travelExpert';
import { logger } from '../services/travelExpert';

const router = Router();

const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          }
        });
      }
      next(error);
    }
  };
};

const chatSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1).max(5000),
  context: z.object({
    travelerId: z.string().optional(),
    traveler: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
      preferences: z.array(z.nativeEnum(TravelStyle)).optional(),
      budgetLevel: z.nativeEnum(BudgetLevel).optional(),
      tier: z.enum(['basic', 'premium', 'enterprise']).optional()
    }).nullable().optional(),
    tripId: z.string().optional(),
    destination: z.string().optional(),
    budget: z.number().optional(),
    travelDates: z.object({
      start: z.string().datetime().optional(),
      end: z.string().datetime().optional()
    }).nullable().optional(),
    conversationHistory: z.array(z.string()).optional()
  }).optional()
});

const createTripSchema = z.object({
  destination: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  travelers: z.number().int().min(1).default(1),
  budget: z.number().min(0).optional(),
  styles: z.array(z.nativeEnum(TravelStyle)).optional(),
  accommodations: z.array(z.string()).optional(),
  transport: z.array(z.string()).optional()
});

const updateTripSchema = z.object({
  destination: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  travelers: z.number().int().min(1).optional(),
  budget: z.number().min(0).optional(),
  styles: z.array(z.nativeEnum(TravelStyle)).optional(),
  accommodations: z.array(z.string()).optional(),
  transport: z.array(z.string()).optional(),
  status: z.enum(['planning', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional()
});

router.post('/chat', validateRequest(chatSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId: providedSessionId, message, context } = req.body;
    const sessionId = providedSessionId || uuidv4();

    logger.info('Travel chat request received', { sessionId, messageLength: message.length });

    const travelContext: TravelContext = {
      traveler: context?.traveler || null,
      tripId: context?.tripId || null,
      sessionId,
      conversationHistory: context?.conversationHistory || [],
      currentDestination: context?.destination || null,
      budget: context?.budget || null,
      travelDates: context?.travelDates ? {
        start: context.travelDates.start ? new Date(context.travelDates.start) : null,
        end: context.travelDates.end ? new Date(context.travelDates.end) : null
      } : null
    };

    const response = await travelExpert.processTravelQuery(travelContext, message);

    res.json({
      success: true,
      data: {
        response: response.message,
        actions: response.actions,
        data: response.data
      },
      meta: {
        sessionId,
        processingTimeMs: response.processingTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Travel chat endpoint error', { error });
    next(error);
  }
});

router.post('/trips', validateRequest(createTripSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { destination, startDate, endDate, travelers, budget, styles, accommodations, transport } = req.body;

    logger.info('Creating new trip', { destination, travelers });

    const trip = await travelExpert.createTrip(
      destination,
      new Date(startDate),
      new Date(endDate),
      travelers,
      budget || 0
    );

    trip.styles = styles || [];
    trip.accommodations = accommodations || [];
    trip.transport = transport || [];

    res.status(201).json({
      success: true,
      data: { trip }
    });

  } catch (error) {
    logger.error('Trip creation error', { error });
    next(error);
  }
});

router.get('/trips', async (req: Request, res: Response) => {
  const travelerId = req.query.travelerId as string;

  let trips: Trip[];
  if (travelerId) {
    trips = travelExpert.getTripsByTraveler(travelerId);
  } else {
    trips = [];
  }

  res.json({
    success: true,
    data: {
      trips,
      count: trips.length
    }
  });
});

router.get('/trips/:tripId', async (req: Request, res: Response) => {
  const { tripId } = req.params;

  const trip = travelExpert.getTrip(tripId);

  if (!trip) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Trip ${tripId} not found`
      }
    });
  }

  res.json({
    success: true,
    data: { trip }
  });
});

router.patch('/trips/:tripId', validateRequest(updateTripSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tripId } = req.params;
    const updates = req.body;

    let trip = travelExpert.getTrip(tripId);

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Trip ${tripId} not found`
        }
      });
    }

    if (updates.destination) trip.destination = updates.destination;
    if (updates.startDate) trip.startDate = new Date(updates.startDate);
    if (updates.endDate) trip.endDate = new Date(updates.endDate);
    if (updates.travelers) trip.travelers = updates.travelers;
    if (updates.budget !== undefined) trip.budget = updates.budget;
    if (updates.styles) trip.styles = updates.styles;
    if (updates.accommodations) trip.accommodations = updates.accommodations;
    if (updates.transport) trip.transport = updates.transport;
    if (updates.status) trip.status = updates.status as Trip['status'];
    trip.updatedAt = new Date();

    res.json({
      success: true,
      data: { trip }
    });

  } catch (error) {
    next(error);
  }
});

router.delete('/trips/:tripId', async (req: Request, res: Response) => {
  const { tripId } = req.params;

  const trip = travelExpert.getTrip(tripId);

  if (!trip) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Trip ${tripId} not found`
      }
    });
  }

  trip.status = 'cancelled';
  trip.updatedAt = new Date();

  res.json({
    success: true,
    data: { trip }
  });
});

router.get('/destinations', async (req: Request, res: Response) => {
  const { DESTINATIONS } = await import('../config/knowledge');

  const style = req.query.style as string;
  const budget = req.query.budget as string;

  let destinations = [...DESTINATIONS];

  if (style) {
    destinations = destinations.filter(d => d.type.includes(style.toLowerCase()));
  }

  if (budget) {
    destinations = destinations.filter(d => d.budgetLevel === budget.toLowerCase());
  }

  res.json({
    success: true,
    data: {
      destinations,
      count: destinations.length
    }
  });
});

router.get('/destinations/:destinationId', async (req: Request, res: Response) => {
  const { destinationId } = req.params;
  const { DESTINATIONS } = await import('../config/knowledge');

  const destination = DESTINATIONS.find(d => d.id === destinationId);

  if (!destination) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Destination ${destinationId} not found`
      }
    });
  }

  res.json({
    success: true,
    data: { destination }
  });
});

router.get('/transport-options', async (req: Request, res: Response) => {
  const { TRANSPORT_MODES } = await import('../config/knowledge');

  res.json({
    success: true,
    data: {
      transportOptions: TRANSPORT_MODES
    }
  });
});

router.get('/accommodation-types', async (req: Request, res: Response) => {
  const { ACCOMMODATION_TYPES } = await import('../config/knowledge');

  res.json({
    success: true,
    data: {
      accommodationTypes: ACCOMMODATION_TYPES
    }
  });
});

router.post('/itinerary/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { destinationId, days, styles } = req.body;

    const { DESTINATIONS } = await import('../config/knowledge');
    const destination = DESTINATIONS.find(d => d.id === destinationId);

    if (!destination) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Destination ${destinationId} not found`
        }
      });
    }

    const { travelExpert } = await import('../services/travelExpert');
    const itinerary = travelExpert.generateItinerary(destination, days || 7);

    res.json({
      success: true,
      data: {
        destination,
        itinerary,
        duration: days || 7
      }
    });

  } catch (error) {
    logger.error('Itinerary generation error', { error });
    next(error);
  }
});

router.post('/budget/estimate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { destinationId, duration, travelers, budgetLevel } = req.body;

    const { DESTINATIONS } = await import('../config/knowledge');
    const destination = DESTINATIONS.find(d => d.id === destinationId);

    if (!destination) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Destination ${destinationId} not found`
        }
      });
    }

    const baseBudget = budgetLevel || destination.budgetLevel;
    const travelerCount = travelers || 1;
    const tripDuration = duration || 7;

    const dailyBudget: Record<string, { min: number; max: number }> = {
      budget: { min: 60, max: 120 },
      moderate: { min: 120, max: 250 },
      luxury: { min: 250, max: 500 }
    };

    const base = dailyBudget[baseBudget] || dailyBudget.moderate;
    const totalMin = Math.round(base.min * tripDuration * Math.sqrt(travelerCount));
    const totalMax = Math.round(base.max * tripDuration * Math.sqrt(travelerCount));

    res.json({
      success: true,
      data: {
        destination,
        duration: tripDuration,
        travelers: travelerCount,
        budgetLevel: baseBudget,
        estimate: {
          daily: { min: Math.round(base.min * Math.sqrt(travelerCount)), max: Math.round(base.max * Math.sqrt(travelerCount)) },
          total: { min: totalMin, max: totalMax },
          breakdown: {
            accommodation: { min: Math.round(totalMin * 0.4), max: Math.round(totalMax * 0.4) },
            food: { min: Math.round(totalMin * 0.25), max: Math.round(totalMax * 0.25) },
            activities: { min: Math.round(totalMin * 0.2), max: Math.round(totalMax * 0.2) },
            transport: { min: Math.round(totalMin * 0.15), max: Math.round(totalMax * 0.15) }
          }
        }
      }
    });

  } catch (error) {
    logger.error('Budget estimate error', { error });
    next(error);
  }
});

export { router as travelRouter };
