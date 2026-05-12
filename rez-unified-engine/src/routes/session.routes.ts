/**
 * Session Routes
 * API endpoints for session operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ChannelType, ApiResponse } from '../types';
import { Session, SessionStatus, SessionDocument } from '../models/Session';
import { ConversationService } from '../services/conversationLogger';
import { getContextManager } from '../services/contextManager';
import { logger } from '../config/logger';

const sessionRouter = Router();
const sessionLogger = logger.child({ component: 'SessionRoutes' });

const conversationService = new ConversationService();
const contextManager = getContextManager();

// Request validation schemas
const createSessionSchema = z.object({
  userId: z.string().min(1),
  channel: z.enum(['whatsapp', 'voice', 'copilot', 'web']),
  conversationId: z.string().optional(),
  anonymousId: z.string().optional(),
  externalUserId: z.string().optional(),
  channelMetadata: z.object({
    platform: z.string().optional(),
    deviceType: z.string().optional(),
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
    location: z.object({
      country: z.string().optional(),
      city: z.string().optional(),
      timezone: z.string().optional(),
    }).optional(),
  }).optional(),
});

const updateSessionSchema = z.object({
  status: z.enum(['active', 'idle', 'ended', 'expired']).optional(),
  variables: z.record(z.unknown()).optional(),
  extendTTL: z.number().positive().optional(),
});

const getSessionsSchema = z.object({
  userId: z.string().optional(),
  channel: z.enum(['whatsapp', 'voice', 'copilot', 'web']).optional(),
  status: z.enum(['active', 'idle', 'ended', 'expired']).optional(),
  limit: z.string().transform(Number).default('20'),
  offset: z.string().transform(Number).default('0'),
});

// Get sessions with filters
sessionRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryParams = getSessionsSchema.parse(req.query);

    const query: Record<string, unknown> = {};

    if (queryParams.userId) {
      query.userId = queryParams.userId;
    }

    if (queryParams.channel) {
      query.channel = queryParams.channel;
    }

    if (queryParams.status) {
      query.status = queryParams.status;
    }

    const [sessions, total] = await Promise.all([
      Session.find(query)
        .sort({ lastActivityAt: -1 })
        .skip(queryParams.offset)
        .limit(queryParams.limit)
        .lean(),
      Session.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        items: sessions,
        total,
        page: Math.floor(queryParams.offset / queryParams.limit) + 1,
        pageSize: queryParams.limit,
        hasMore: queryParams.offset + sessions.length < total,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors },
      });
      return;
    }
    next(error);
  }
});

// Get session statistics
sessionRouter.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await Session.getStatistics();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

// Get single session
sessionRouter.get('/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.sessionId }).lean();

    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
      return;
    }

    const response: ApiResponse<SessionDocument & { _id: unknown }> = {
      success: true,
      data: session,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Create session
sessionRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSessionSchema.parse(req.body);

    sessionLogger.info('Creating session via API', {
      userId: body.userId,
      channel: body.channel,
    });

    // Find or create conversation
    const { Conversation } = await import('../models/Conversation');
    let conversation = await Conversation.findOne({
      userId: body.userId,
      status: 'active',
      primaryChannel: body.channel,
    });

    if (!conversation) {
      conversation = await Conversation.findOrCreate(body.userId, body.channel as ChannelType);
    }

    // Create session
    const session = await conversationService.createSession({
      conversationId: conversation.conversationId,
      userId: body.userId,
      channel: body.channel as ChannelType,
      anonymousId: body.anonymousId,
      externalUserId: body.externalUserId,
      channelMetadata: body.channelMetadata,
    });

    sessionLogger.info('Session created', { sessionId: session.sessionId });

    res.status(201).json({
      success: true,
      data: {
        session,
        conversationId: conversation.conversationId,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors },
      });
      return;
    }
    next(error);
  }
});

// Update session
sessionRouter.patch('/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateSessionSchema.parse(req.body);
    const { sessionId } = req.params;

    const updateFields: Record<string, unknown> = {};

    if (body.status) {
      updateFields.status = body.status.toUpperCase();
    }

    if (body.variables) {
      for (const [key, value] of Object.entries(body.variables)) {
        updateFields[`context.variables.${key}`] = value;
      }
    }

    if (body.extendTTL) {
      updateFields.expiresAt = new Date(Date.now() + body.extendTTL);
    }

    const session = await Session.findOneAndUpdate(
      { sessionId },
      { $set: updateFields },
      { new: true }
    );

    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
      return;
    }

    // Clear context cache if variables were updated
    if (body.variables) {
      await contextManager.clearContext(sessionId);
    }

    const response: ApiResponse<SessionDocument> = {
      success: true,
      data: session,
    };

    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors },
      });
      return;
    }
    next(error);
  }
});

// End session
sessionRouter.post('/:sessionId/end', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    sessionLogger.info('Ending session via API', { sessionId });

    await conversationService.endSession(sessionId);

    res.json({
      success: true,
      data: { message: 'Session ended successfully' },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
      return;
    }
    next(error);
  }
});

// Get session context
sessionRouter.get('/:sessionId/context', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    const context = await contextManager.loadContext(sessionId);

    const response: ApiResponse<typeof context> = {
      success: true,
      data: context,
    };

    res.json(response);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
      return;
    }
    next(error);
  }
});

// Update session context
sessionRouter.patch('/:sessionId/context', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const { variables, intent, message } = req.body;

    // Update variables
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        await contextManager.setVariable(sessionId, key, value);
      }
    }

    // Update intent
    if (intent) {
      await contextManager.addIntentToContext(sessionId, intent);
    }

    // Add message to history
    if (message) {
      await contextManager.addMessageToHistory(sessionId, message);
    }

    const context = await contextManager.loadContext(sessionId);

    res.json({
      success: true,
      data: context,
    });
  } catch (error) {
    next(error);
  }
});

// Get session metrics
sessionRouter.get('/:sessionId/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    const metrics = await conversationService.getSessionMessageCount(sessionId);
    const session = await Session.findOne({ sessionId }).lean();

    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        messageCount: metrics,
        userMessageCount: session.metrics.userMessageCount,
        agentMessageCount: session.metrics.agentMessageCount,
        averageResponseTimeMs: session.metrics.averageResponseTimeMs,
        handoffsToAgent: session.metrics.handoffsToAgent,
        duration: session.getDurationMs(),
        idleTimeMs: session.getIdleTimeMs(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export { sessionRouter };
