import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  consultantAgent,
  ConsultationContext,
  CustomerProfile,
  TravelStyle,
  ExperienceLevel,
  ConsultantResponse
} from '../services/consultantAgent';
import {
  getDestinationRecommendations,
  generateItinerary,
  getActivityRecommendations,
  getAccommodationRecommendations,
  optimizeBudget
} from '../services/recommendationEngine';
import { logger } from '../services/consultantAgent';

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

const consultationSchema = z.object({
  sessionId: z.string().optional(),
  query: z.string().min(1).max(5000),
  context: z.object({
    customer: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
      travelStyle: z.nativeEnum(TravelStyle),
      experienceLevel: z.nativeEnum(ExperienceLevel),
      budgetRange: z.object({ min: z.number(), max: z.number() }),
      preferredDestinations: z.array(z.string()),
      preferredActivities: z.array(z.string()),
      travelFrequency: z.enum(['rarely', 'occasionally', 'frequently']),
      groupSize: z.number().int().min(1),
      specialRequirements: z.array(z.string()),
      allergies: z.array(z.string()),
      accessibilityNeeds: z.array(z.string()),
      pastTrips: z.array(z.object({
        destination: z.string(),
        date: z.string(),
        rating: z.number(),
        budget: z.number(),
        activities: z.array(z.string())
      })),
      loyaltyTier: z.enum(['bronze', 'silver', 'gold', 'platinum'])
    }).nullable().optional(),
    currentDestination: z.string().nullable().optional(),
    travelDates: z.object({
      start: z.string(),
      end: z.string()
    }).nullable().optional(),
    budget: z.number().min(0).optional(),
    tripType: z.string().optional(),
    specialOccasions: z.array(z.string()).optional(),
    preferences: z.record(z.unknown()).optional()
  }).optional()
});

const itinerarySchema = z.object({
  destination: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  travelStyle: z.nativeEnum(TravelStyle),
  budget: z.number().min(0),
  groupSize: z.number().int().min(1).optional().default(2),
  preferences: z.array(z.string()).optional()
});

const budgetOptimizationSchema = z.object({
  totalBudget: z.number().min(0),
  duration: z.number().int().min(1),
  travelStyle: z.nativeEnum(TravelStyle),
  groupSize: z.number().int().min(1).optional().default(2),
  destination: z.string().optional()
});

const destinationSearchSchema = z.object({
  budget: z.number().min(0).optional(),
  travelStyle: z.nativeEnum(TravelStyle).optional(),
  preferredActivities: z.array(z.string()).optional(),
  groupSize: z.number().int().min(1).optional(),
  travelDates: z.object({
    start: z.string(),
    end: z.string()
  }).optional()
});

const activitiesSchema = z.object({
  destination: z.string().min(1),
  travelStyle: z.nativeEnum(TravelStyle),
  budget: z.number().min(0),
  groupSize: z.number().int().min(1).optional().default(2),
  preferences: z.array(z.string()).optional()
});

const accommodationSchema = z.object({
  destination: z.string().min(1),
  travelStyle: z.nativeEnum(TravelStyle),
  budget: z.number().min(0),
  groupSize: z.number().int().min(1).optional().default(2),
  amenities: z.array(z.string()).optional()
});

router.post('/consult', validateRequest(consultationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId: providedSessionId, query, context } = req.body;
    const sessionId = providedSessionId || uuidv4();

    logger.info('Consultation request received', { sessionId, queryLength: query.length });

    const customerProfile: CustomerProfile | null = context?.customer ? {
      id: context.customer.id,
      name: context.customer.name,
      email: context.customer.email,
      travelStyle: context.customer.travelStyle,
      experienceLevel: context.customer.experienceLevel,
      budgetRange: context.customer.budgetRange,
      preferredDestinations: context.customer.preferredDestinations,
      preferredActivities: context.customer.preferredActivities,
      travelFrequency: context.customer.travelFrequency,
      groupSize: context.customer.groupSize,
      specialRequirements: context.customer.specialRequirements,
      allergies: context.customer.allergies,
      accessibilityNeeds: context.customer.accessibilityNeeds,
      pastTrips: context.customer.pastTrips.map(t => ({ ...t, date: new Date(t.date) })),
      loyaltyTier: context.customer.loyaltyTier
    } : null;

    const consultationContext: ConsultationContext = {
      customer: customerProfile,
      currentDestination: context?.currentDestination || null,
      travelDates: context?.travelDates ? {
        start: new Date(context.travelDates.start),
        end: new Date(context.travelDates.end)
      } : null,
      budget: context?.budget || 2000,
      tripType: context?.tripType || 'general',
      specialOccasions: context?.specialOccasions || [],
      preferences: context?.preferences || {}
    };

    const response: ConsultantResponse = await consultantAgent.processConsultation(
      consultationContext,
      query,
      sessionId
    );

    res.json({
      success: true,
      data: {
        response: response.message,
        recommendations: response.recommendations,
        insights: response.insights,
        nextSteps: response.nextSteps,
        data: response.data
      },
      meta: {
        sessionId,
        processingTimeMs: response.processingTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Consultation endpoint error', { error });
    next(error);
  }
});

router.post('/destinations', validateRequest(destinationSearchSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { budget, travelStyle, preferredActivities, groupSize, travelDates } = req.body;

    const customer: CustomerProfile | null = req.body.customer ? {
      id: req.body.customer.id,
      name: req.body.customer.name,
      email: req.body.customer.email,
      travelStyle: req.body.customer.travelStyle,
      experienceLevel: req.body.customer.experienceLevel,
      budgetRange: req.body.customer.budgetRange,
      preferredDestinations: req.body.customer.preferredDestinations,
      preferredActivities: req.body.customer.preferredActivities,
      travelFrequency: req.body.customer.travelFrequency,
      groupSize: req.body.customer.groupSize,
      specialRequirements: req.body.customer.specialRequirements,
      allergies: req.body.customer.allergies,
      accessibilityNeeds: req.body.customer.accessibilityNeeds,
      pastTrips: req.body.customer.pastTrips,
      loyaltyTier: req.body.customer.loyaltyTier
    } : null;

    const destinations = await getDestinationRecommendations(customer, {
      budget,
      travelStyle,
      preferredActivities,
      groupSize,
      travelDates: travelDates ? {
        start: new Date(travelDates.start),
        end: new Date(travelDates.end)
      } : null
    });

    res.json({
      success: true,
      data: {
        destinations,
        count: destinations.length
      }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/itinerary', validateRequest(itinerarySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { destination, startDate, endDate, travelStyle, budget, groupSize, preferences } = req.body;

    logger.info('Generating itinerary', { destination, days: Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) });

    const itinerary = await generateItinerary({
      destination,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      travelStyle,
      budget,
      groupSize,
      preferences: preferences || []
    });

    res.json({
      success: true,
      data: { itinerary }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/budget/optimize', validateRequest(budgetOptimizationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { totalBudget, duration, travelStyle, groupSize, destination } = req.body;

    const result = optimizeBudget({
      totalBudget,
      duration,
      travelStyle,
      groupSize,
      destination
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    next(error);
  }
});

router.post('/activities', validateRequest(activitiesSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { destination, travelStyle, budget, groupSize, preferences } = req.body;

    const activities = await getActivityRecommendations({
      destination,
      travelStyle,
      budget,
      groupSize,
      preferences: preferences || []
    });

    res.json({
      success: true,
      data: {
        activities,
        count: activities.length
      }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/accommodations', validateRequest(accommodationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { destination, travelStyle, budget, groupSize, amenities } = req.body;

    const accommodations = await getAccommodationRecommendations({
      destination,
      travelStyle,
      budget,
      groupSize,
      amenities: amenities || []
    });

    res.json({
      success: true,
      data: {
        accommodations,
        count: accommodations.length
      }
    });

  } catch (error) {
    next(error);
  }
});

export { router as consultantRouter };
