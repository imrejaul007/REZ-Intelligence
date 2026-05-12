/**
 * Message Routes
 * API endpoints for message operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ChannelType, ApiResponse, PaginatedResponse } from '../types';
import { Message, MessageDocument } from '../models/Message';
import { ConversationService } from '../services/conversationLogger';
import { logger } from '../config/logger';

const messageRouter = Router();
const messageLogger = logger.child({ component: 'MessageRoutes' });

const conversationService = new ConversationService();

// Request validation schemas
const sendMessageSchema = z.object({
  sessionId: z.string(),
  conversationId: z.string().optional(),
  message: z.string().min(1),
  channel: z.enum(['whatsapp', 'voice', 'copilot', 'web']),
  userId: z.string().optional(),
  attachments: z.array(z.object({
    type: z.enum(['image', 'video', 'audio', 'document']),
    url: z.string().url(),
    name: z.string().optional(),
    size: z.number().optional(),
    mimeType: z.string().optional(),
  })).optional(),
});

const getMessagesSchema = z.object({
  sessionId: z.string().optional(),
  conversationId: z.string().optional(),
  limit: z.string().transform(Number).default('50'),
  before: z.string().optional(),
});

const updateMessageStatusSchema = z.object({
  messageId: z.string(),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
});

// Get messages
messageRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryParams = getMessagesSchema.parse(req.query);

    let messages: MessageDocument[];

    if (queryParams.sessionId) {
      messages = await Message.find({ sessionId: queryParams.sessionId })
        .sort({ createdAt: -1 })
        .limit(queryParams.limit)
        .lean();
    } else if (queryParams.conversationId) {
      messages = await Message.find({ conversationId: queryParams.conversationId })
        .sort({ createdAt: -1 })
        .limit(queryParams.limit)
        .lean();
    } else {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'sessionId or conversationId required' },
      });
      return;
    }

    const response: PaginatedResponse<MessageDocument> = {
      items: messages.reverse(),
      total: messages.length,
      page: 1,
      pageSize: queryParams.limit,
      hasMore: messages.length === queryParams.limit,
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

// Get single message
messageRouter.get('/:messageId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const message = await Message.findOne({ messageId: req.params.messageId }).lean();

    if (!message) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Message not found' },
      });
      return;
    }

    const response: ApiResponse<MessageDocument> = {
      success: true,
      data: message,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Search messages
messageRouter.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, conversationId, sessionId, limit = '50' } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'Search query required' },
      });
      return;
    }

    const messages = await conversationService.searchMessages(q, {
      conversationId: conversationId as string,
      sessionId: sessionId as string,
      limit: parseInt(limit as string, 10),
    });

    const response: PaginatedResponse<MessageDocument> = {
      items: messages,
      total: messages.length,
      page: 1,
      pageSize: messages.length,
      hasMore: false,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Send message
messageRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = sendMessageSchema.parse(req.body);

    messageLogger.info('Sending message via API', {
      sessionId: body.sessionId,
      channel: body.channel,
      messageLength: body.message.length,
    });

    // Get or create session
    const { Session } = await import('../models/Session');
    const { Conversation } = await import('../models/Conversation');

    let session = await Session.findOne({ sessionId: body.sessionId });
    let conversationId = body.conversationId;

    if (!session) {
      // Need to create session first
      res.status(400).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found. Please create a session first.',
        },
      });
      return;
    }

    conversationId = session.conversationId;

    // Create incoming message payload
    const incomingMessage = {
      sessionId: body.sessionId,
      conversationId,
      message: body.message,
      channel: body.channel as ChannelType,
      userId: body.userId,
      attachments: body.attachments?.map((att, idx) => ({
        id: `att_${idx}`,
        type: att.type,
        url: att.url,
        mimeType: att.mimeType || 'application/octet-stream',
        size: att.size,
        filename: att.name,
      })),
    };

    // Process through conversation service
    const message = await conversationService.logIncomingMessage(
      incomingMessage,
      conversationId,
      body.sessionId
    );

    messageLogger.info('Message logged', { messageId: message.messageId });

    const response: ApiResponse<MessageDocument> = {
      success: true,
      data: message,
    };

    res.status(201).json(response);
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

// Update message status
messageRouter.patch('/:messageId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = updateMessageStatusSchema.parse(req.body);

    const { MessageStatus } = await import('../types');
    const statusMap: Record<string, MessageStatus> = {
      sent: MessageStatus.SENT,
      delivered: MessageStatus.DELIVERED,
      read: MessageStatus.READ,
      failed: MessageStatus.FAILED,
    };

    const message = await conversationService.updateMessageStatus(
      body.messageId,
      statusMap[body.status]
    );

    if (!message) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Message not found' },
      });
      return;
    }

    const response: ApiResponse<MessageDocument> = {
      success: true,
      data: message,
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

// Get message statistics
messageRouter.get('/stats/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channel } = req.query;

    const stats = await Message.getStatistics(channel as ChannelType | undefined);

    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export { messageRouter };
