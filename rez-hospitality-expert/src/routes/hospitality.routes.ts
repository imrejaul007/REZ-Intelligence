/**
 * Hospitality Expert Routes
 * Express routes for the hospitality expert agent API
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  ChatRequest,
  ChatResponse,
  ConversationContext,
  HospitalityIntent,
  ChatMessage,
} from '../types/index.js';
import { hospitalityIntents } from '../intents/hospitalityIntents.js';
import { expertiseService } from '../services/expertise.js';
import { recommendationsService } from '../services/recommendations.js';
import { workflowService } from '../services/workflows.js';
import { checkInOutService } from '../intents/checkInOut.js';
import { responseGenerator } from '../responses/templates.js';
import { logger } from '../utils/logger.js';
import { validateRequest, asyncHandler } from '../middleware/validation.js';
import { getCoreBrainClient } from '../services/coreBrainIntegration.js';

// ============================================
// ROUTER SETUP
// ============================================

const router = Router();

// In-memory session store (use Redis in production)
const sessions = new Map<string, ConversationContext>();

// ============================================
// REQUEST SCHEMAS
// ============================================

const chatRequestSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1).max(2000),
  guestId: z.string().optional(),
  reservationId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const startSessionSchema = z.object({
  guestId: z.string().optional(),
  reservationId: z.string().optional(),
  language: z.string().optional(),
});

const workflowActionSchema = z.object({
  sessionId: z.string().min(1),
  workflowType: z.enum(['checkin', 'checkout', 'roomservice', 'housekeeping']),
  action: z.string(),
  data: z.record(z.unknown()).optional(),
});

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/v1/hospitality/chat
 * Main chat endpoint for guest interactions
 */
router.post(
  '/chat',
  validateRequest(chatRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, message, guestId, reservationId, metadata } = req.body as ChatRequest;

    logger.info('Chat request received', { sessionId, message: message.substring(0, 50) });

    // Load Core Brain context if userId is provided
    const userContext = guestId ? await loadCoreBrainContext(guestId, sessionId) : null;

    // Get or create session context
    let context = sessions.get(sessionId);
    if (!context) {
      context = await createSession(sessionId, guestId, reservationId);
    }

    // Enhance context with Core Brain data
    if (userContext) {
      context.preferences = {
        ...context.preferences,
        tone: userContext.preferences?.tone || context.preferences?.tone,
        language: userContext.preferences?.language || context.language,
      };

      // Store Core Brain session for later use
      (context as any).coreBrainSession = userContext.session;
      (context as any).loyaltyProfile = userContext.loyalty;
    }

    // Add user message to history
    const userMessage: ChatMessage = {
      id: uuidv4(),
      sessionId,
      role: 'guest',
      content: message,
      timestamp: new Date().toISOString(),
    };
    context.conversationHistory.push(userMessage);

    // Detect intent
    const { intent, confidence } = hospitalityIntents.detectIntent(message, context);

    // Handle the intent
    const response = await hospitalityIntents.handleIntent(intent, context, message);

    // Add agent response to history
    const agentMessage: ChatMessage = {
      id: uuidv4(),
      sessionId,
      role: 'agent',
      content: response.message,
      intent,
      timestamp: new Date().toISOString(),
    };
    context.conversationHistory.push(agentMessage);

    // Update session
    context.currentIntent = intent;
    context.lastActivity = new Date().toISOString();
    sessions.set(sessionId, context);

    // Build response
    const chatResponse: ChatResponse = {
      sessionId,
      message: response.message,
      intent,
      confidence,
      suggestedActions: response.suggestedActions?.map(action => ({
        label: action,
        action: action.toLowerCase().replace(/\s+/g, '_'),
      })),
      quickReplies: response.quickReplies,
      metadata: {
        ...response.metadata,
        sentiment: metadata?.sentiment || 'neutral',
        loyaltyTier: userContext?.loyalty?.tier,
        loyaltyPoints: userContext?.loyalty?.points,
        hasCoreBrainContext: !!userContext,
      },
    };

    // Record activity in Core Brain
    if (guestId) {
      getCoreBrainClient().recordActivity(guestId, {
        action: intent,
        agent: 'hospitality-expert',
        topic: message.substring(0, 50),
      }).catch((err) => logger.warn('Failed to record activity', { error: err }));
    }

    logger.info('Chat response sent', { sessionId, intent, confidence });

    res.json(chatResponse);
  })
);

/**
 * POST /api/v1/hospitality/session
 * Create a new conversation session
 */
router.post(
  '/session',
  validateRequest(startSessionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { guestId, reservationId, language } = req.body;

    const sessionId = uuidv4();
    const context = await createSession(sessionId, guestId, reservationId, language);

    // Generate greeting
    const greeting = responseGenerator.generateGreeting(context.guest?.name);

    logger.info('New session created', { sessionId, guestId, reservationId });

    res.status(201).json({
      sessionId,
      message: greeting,
      quickReplies: ['Check-in', 'Check-out', 'Room Service', 'Concierge'],
      metadata: {
        language: context.language,
        createdAt: context.createdAt,
      },
    });
  })
);

/**
 * GET /api/v1/hospitality/session/:sessionId
 * Get session context
 */
router.get(
  '/session/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const context = sessions.get(sessionId);
    if (!context) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'The requested session does not exist or has expired.',
      });
    }

    res.json({
      sessionId: context.sessionId,
      guest: context.guest,
      reservation: context.reservation,
      currentIntent: context.currentIntent,
      messageCount: context.conversationHistory.length,
      createdAt: context.createdAt,
      lastActivity: context.lastActivity,
    });
  })
);

/**
 * DELETE /api/v1/hospitality/session/:sessionId
 * End a conversation session
 */
router.delete(
  '/session/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const context = sessions.get(sessionId);
    if (!context) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'The requested session does not exist or has expired.',
      });
    }

    const farewell = responseGenerator.generateFarewell(context.guest?.name);

    // Remove session
    sessions.delete(sessionId);

    logger.info('Session ended', { sessionId });

    res.json({
      sessionId,
      message: farewell,
    });
  })
);

/**
 * POST /api/v1/hospitality/workflow
 * Start a specific workflow (check-in, check-out, etc.)
 */
router.post(
  '/workflow',
  validateRequest(workflowActionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, workflowType, action, data } = req.body;

    const context = sessions.get(sessionId);
    if (!context) {
      return res.status(404).json({
        error: 'Session not found',
        message: 'Please start a new session first.',
      });
    }

    let response: Record<string, unknown>;

    switch (workflowType) {
      case 'checkin':
        if (action === 'start') {
          const result = await checkInOutService.startCheckIn(context);
          response = {
            workflow: 'checkin',
            state: result.session.state,
            message: result.message,
            nextStep: result.nextStep,
          };
        } else if (action === 'step') {
          const result = await checkInOutService.processCheckInStep(
            context,
            data as Record<string, unknown>
          );
          response = {
            workflow: 'checkin',
            state: result.session.state,
            message: result.message,
            nextStep: result.nextStep,
            completed: result.completed,
          };
        }
        break;

      case 'checkout':
        if (action === 'start') {
          const result = await checkInOutService.startCheckOut(context);
          response = {
            workflow: 'checkout',
            state: result.session.state,
            message: result.message,
            nextStep: result.nextStep,
          };
        } else if (action === 'step') {
          const result = await checkInOutService.processCheckOutStep(
            context,
            data as Record<string, unknown>
          );
          response = {
            workflow: 'checkout',
            state: result.session.state,
            message: result.message,
            nextStep: result.nextStep,
            completed: result.completed,
          };
        }
        break;

      default:
        return res.status(400).json({
          error: 'Invalid workflow type',
          message: `Workflow type "${workflowType}" is not supported.`,
        });
    }

    logger.info('Workflow action processed', { sessionId, workflowType, action });

    res.json(response);
  })
);

/**
 * GET /api/v1/hospitality/amenities
 * Get available amenities
 */
router.get(
  '/amenities',
  asyncHandler(async (req: Request, res: Response) => {
    const { category } = req.query;
    const amenities = expertiseService.getAmenityInfo(
      category as string as any
    );

    res.json({
      amenities: amenities.map(a => ({
        name: a.name,
        category: a.category,
        description: a.description,
        location: a.location,
        hours: a.hours,
        bookingRequired: a.bookingRequired,
        price: a.price,
      })),
    });
  })
);

/**
 * GET /api/v1/hospitality/recommendations
 * Get recommendations (rooms, dining, local)
 */
router.get(
  '/recommendations',
  asyncHandler(async (req: Request, res: Response) => {
    const { type, sessionId } = req.query;

    let recommendations: unknown[] = [];

    switch (type) {
      case 'rooms':
        const context = sessions.get(sessionId as string);
        recommendations = recommendationsService.generateRoomRecommendations({
          reservation: context?.reservation,
          stayDuration: 1,
        });
        break;
      case 'dining':
        recommendations = recommendationsService.generateDiningRecommendations({
          timeOfDay: 'evening',
        });
        break;
      case 'local':
        recommendations = recommendationsService.generateLocalRecommendations({
          timeOfDay: 'afternoon',
        });
        break;
      default:
        return res.status(400).json({
          error: 'Invalid recommendation type',
          message: 'Please specify: rooms, dining, or local',
        });
    }

    res.json({ recommendations });
  })
);

/**
 * GET /api/v1/hospitality/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rez-hospitality-expert',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /api/v1/hospitality/intents
 * Get supported intents
 */
router.get('/intents', (req: Request, res: Response) => {
  const intents = Object.values(HospitalityIntent).map(intent => ({
    name: intent,
    handler: intent.toLowerCase().replace(/_([a-z])/g, (_, l) => l.toUpperCase()),
  }));

  res.json({ intents });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Load user context from Core Brain
 */
async function loadCoreBrainContext(userId: string, sessionId?: string): Promise<{
  session: any;
  preferences: any;
  loyalty: any;
  memories: any[];
  context: Record<string, unknown>;
} | null> {
  try {
    const coreBrain = getCoreBrainClient();
    const context = await coreBrain.loadUserContext(userId, sessionId || '');
    return context;
  } catch (error) {
    logger.warn('Failed to load Core Brain context', { error, userId });
    return null;
  }
}

async function createSession(
  sessionId: string,
  guestId?: string,
  reservationId?: string,
  language = 'en'
): Promise<ConversationContext> {
  // In production, this would fetch guest and reservation data from database
  const context: ConversationContext = {
    sessionId,
    guest: guestId ? { id: guestId, name: 'Guest' } : undefined,
    reservation: reservationId ? { id: reservationId } as any : undefined,
    currentIntent: undefined,
    conversationHistory: [],
    recentRequests: [],
    preferences: {},
    language,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
  };

  sessions.set(sessionId, context);
  return context;
}

// ============================================
// EXPORT
// ============================================

export default router;
