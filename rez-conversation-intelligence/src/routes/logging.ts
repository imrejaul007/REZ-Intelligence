import { Router, Request, Response, NextFunction } from 'express';
import { conversationLogger } from '../services/conversationLogger.js';
import { ConversationCreateSchema, ConversationUpdateSchema, MessageCreateSchema } from '../utils/validators.js';
import { ValidationError } from '../utils/errors.js';
import { z } from 'zod';
import logger from '../utils/logger.js';

const router = Router();

// Validation middleware
const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        throw new ValidationError('Invalid request body', {
          errors: result.error.errors,
        });
      }
      req.body = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
};

const validateQuery = (schema: z.ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.query);
      if (!result.success) {
        throw new ValidationError('Invalid query parameters', {
          errors: result.error.errors,
        });
      }
      req.query = result.data as Record<string, string>;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Create conversation
router.post(
  '/',
  validateBody(ConversationCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const options = {
        extractIntents: req.query.extractIntents !== 'false',
        analyzeSentiment: req.query.analyzeSentiment !== 'false',
      };

      const conversation = await conversationLogger.createConversation(req.body, options);

      res.status(201).json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get conversation by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversation = await conversationLogger.getConversation(req.params.id);

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
});

// List conversations
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = {
      sessionId: req.query.sessionId as string | undefined,
      channel: req.query.channel as string | undefined,
      status: req.query.status as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    };

    const result = await conversationLogger.listConversations(filters);

    res.json({
      success: true,
      data: result.conversations,
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update conversation
router.patch(
  '/:id',
  validateBody(ConversationUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conversation = await conversationLogger.updateConversation(
        req.params.id,
        req.body
      );

      res.json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Add message to conversation
router.post(
  '/:id/messages',
  validateBody(MessageCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const options = {
        extractIntents: req.query.extractIntents !== 'false',
        analyzeSentiment: req.query.analyzeSentiment !== 'false',
      };

      const conversation = await conversationLogger.addMessage(
        req.params.id,
        req.body,
        options
      );

      res.status(201).json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Set outcome for conversation
router.post(
  '/:id/outcome',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, success, resolutionTime, satisfaction, notes } = req.body;

      if (!type || success === undefined) {
        throw new ValidationError('Outcome requires type and success');
      }

      const conversation = await conversationLogger.setOutcome(req.params.id, {
        type,
        success,
        resolutionTime,
        satisfaction,
        notes,
      });

      res.json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Archive conversation
router.post('/:id/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversation = await conversationLogger.archiveConversation(req.params.id);

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
});

// Close conversation
router.post('/:id/close', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const conversation = await conversationLogger.closeConversation(req.params.id);

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
