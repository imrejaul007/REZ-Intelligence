/**
 * REZ Conversation Intelligence - Meeting Intelligence Routes
 *
 * API endpoints for meeting summarization, action items, and topic modeling.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import {
  summaryGenerator,
  actionItemExtractor,
  topicModeling,
  extractFromConversation,
  extractEntities,
  CallCoachingService,
  ActionItem,
  TopicClassification
} from '../services/index.js';
import { ConversationSample } from '../models/index.js';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const ConversationIdSchema = z.object({
  conversationId: z.string().min(1)
});

const MessageSchema = z.object({
  id: z.string(),
  content: z.string().min(1),
  senderType: z.enum(['user', 'agent', 'bot', 'system']),
  senderId: z.string(),
  timestamp: z.string().or(z.date()).transform(v => new Date(v))
});

const SummarizeRequestSchema = z.object({
  conversationId: z.string().optional(),
  messages: z.array(MessageSchema).min(1),
  format: z.enum(['summary', 'notes']).optional().default('summary')
});

const ActionItemsRequestSchema = z.object({
  conversationId: z.string(),
  messages: z.array(MessageSchema).min(1)
});

const TopicsRequestSchema = z.object({
  conversationId: z.string(),
  messages: z.array(MessageSchema).min(1)
});

const UpdateActionItemSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
  notes: z.string().optional()
});

const EntityExtractionSchema = z.object({
  conversationId: z.string(),
  messages: z.array(MessageSchema).min(1)
});

const CoachingAnalysisSchema = z.object({
  conversationId: z.string(),
  transcript: z.array(z.object({
    speaker: z.enum(['agent', 'prospect']),
    text: z.string().min(1),
    timestamp: z.number().optional()
  })).min(1)
});

// ============================================================================
// Middleware
// ============================================================================

const validateBody = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await schema.parseAsync(req.body);
      req.body = result;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
        return;
      }
      next(error);
    }
  };
};

const errorHandler = (error: Error, req: Request, res: Response) => {
  logger.error('Meeting routes error', {
    error: error.message,
    path: req.path
  });

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: config.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message
  });
};

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/v1/meeting/summarize
 * Generate conversation summary
 */
router.post(
  '/summarize',
  validateBody(SummarizeRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId, messages, format } = req.body;

      logger.info('Generating summary', {
        conversationId: conversationId || 'ad-hoc',
        messageCount: messages.length,
        format
      });

      if (format === 'notes') {
        const notes = await summaryGenerator.generateMeetingNotes(
          conversationId || `adhoc_${Date.now()}`,
          messages
        );
        res.json({
          success: true,
          data: { notes }
        });
      } else {
        const summary = await summaryGenerator.generateSummary(
          conversationId || `adhoc_${Date.now()}`,
          messages
        );
        res.json({
          success: true,
          data: { summary }
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/meeting/action-items
 * Extract action items from conversation
 */
router.post(
  '/action-items',
  validateBody(ActionItemsRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId, messages } = req.body;

      logger.info('Extracting action items', {
        conversationId,
        messageCount: messages.length
      });

      const extraction = await actionItemExtractor.extractActionItems(
        conversationId,
        messages
      );

      res.json({
        success: true,
        data: {
          conversationId,
          actionItems: extraction.actionItems,
          stats: {
            total: extraction.totalTasks,
            pending: extraction.pendingTasks,
            completed: extraction.completedTasks,
            highPriority: extraction.highPriorityTasks
          },
          extractedAt: extraction.extractedAt
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/meeting/topics
 * Classify conversation topics
 */
router.post(
  '/topics',
  validateBody(TopicsRequestSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId, messages } = req.body;

      logger.info('Classifying topics', {
        conversationId,
        messageCount: messages.length
      });

      const classification = await topicModeling.classifyConversation(
        conversationId,
        messages.map(m => ({ content: m.content, senderType: m.senderType }))
      );

      res.json({
        success: true,
        data: {
          conversationId,
          topics: classification.topics,
          primaryTopic: classification.primaryTopic,
          topicDistribution: classification.topicDistribution,
          classifiedAt: classification.classifiedAt
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/meeting/:conversationId/action-items
 * Get action items for a conversation
 */
router.get(
  '/:conversationId/action-items',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.params;

      // Get conversation from database
      const conversation = await ConversationSample.findOne({ conversationId });

      if (!conversation) {
        res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
        return;
      }

      // Extract action items from stored messages
      const messages = conversation.messages.map(m => ({
        id: m.id,
        content: m.content,
        senderType: m.senderType,
        senderId: m.senderId,
        timestamp: m.timestamp
      }));

      const extraction = await actionItemExtractor.extractActionItems(
        conversationId,
        messages
      );

      res.json({
        success: true,
        data: {
          conversationId,
          actionItems: extraction.actionItems,
          stats: {
            total: extraction.totalTasks,
            pending: extraction.pendingTasks,
            completed: extraction.completedTasks,
            highPriority: extraction.highPriorityTasks
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/meeting/action-items/:actionItemId
 * Update action item status
 */
router.put(
  '/action-items/:actionItemId',
  validateBody(UpdateActionItemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { actionItemId } = req.params;
      const { status, notes } = req.body;

      // Find the action item in conversation
      // In production, this would be in a separate ActionItem collection
      const { conversationId } = req.body;

      logger.info('Updating action item', { actionItemId, status });

      // For now, return mock response
      // In production, update in database
      const updatedItem: ActionItem = {
        id: actionItemId,
        conversationId: conversationId || 'unknown',
        description: 'Updated action item',
        status,
        priority: 'medium',
        confidence: 0.8,
        sourceMessageId: 'unknown',
        sourceMessageContent: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        notes
      };

      res.json({
        success: true,
        data: { actionItem: updatedItem }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/meeting/topics/trends
 * Get topic trends over time
 */
router.get(
  '/topics/trends',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { period = 'day', startDate, endDate } = req.query;

      // Get all classified conversations
      const conversations = await ConversationSample.find({
        'metadata.classifiedAt': {
          $gte: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          $lte: endDate ? new Date(endDate as string) : new Date()
        }
      }).limit(1000);

      // Build mock classifications for demo
      // In production, use actual classifications stored with conversations
      const classifications: TopicClassification[] = conversations.map(c => ({
        conversationId: c.conversationId,
        topics: [],
        primaryTopic: null,
        topicDistribution: {},
        classifiedAt: c.metadata?.classifiedAt || c.updatedAt
      }));

      const trends = topicModeling.getTopicTrends(
        classifications,
        period as 'day' | 'week' | 'month'
      );

      res.json({
        success: true,
        data: { trends }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/meeting/topics/categories
 * Get available topic categories
 */
router.get(
  '/topics/categories',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = topicModeling.getTopicCategories();

      res.json({
        success: true,
        data: { categories }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/meeting/entities
 * Extract entities from conversation
 */
router.post(
  '/entities',
  validateBody(EntityExtractionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId, messages } = req.body;

      logger.info('Extracting entities', {
        conversationId,
        messageCount: messages.length
      });

      const result = extractFromConversation(
        messages.map(m => ({ role: m.senderType, content: m.content }))
      );

      res.json({
        success: true,
        data: {
          conversationId,
          entities: result.entities,
          stats: result.stats
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/meeting/coaching
 * Analyze sales call for coaching insights
 */
router.post(
  '/coaching',
  validateBody(CoachingAnalysisSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId, transcript } = req.body;

      logger.info('Analyzing call for coaching', {
        conversationId,
        messageCount: transcript.length
      });

      const report = CallCoachingService.analyzeCall(conversationId, transcript);

      res.json({
        success: true,
        data: { report }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/meeting/coaching/compare
 * Compare two coaching reports
 */
router.post(
  '/coaching/compare',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { baseline, current } = req.body;

      if (!baseline || !current) {
        res.status(400).json({
          success: false,
          error: 'baseline and current reports required'
        });
        return;
      }

      const comparison = CallCoachingService.compareCalls(baseline, current);

      res.json({
        success: true,
        data: { comparison }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/meeting/:conversationId/full-analysis
 * Run full analysis on a conversation
 */
router.post(
  '/:conversationId/full-analysis',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.params;

      // Get conversation from database
      const conversation = await ConversationSample.findOne({ conversationId });

      if (!conversation) {
        res.status(404).json({
          success: false,
          error: 'Conversation not found'
        });
        return;
      }

      const messages = conversation.messages.map(m => ({
        id: m.id,
        content: m.content,
        senderType: m.senderType,
        senderId: m.senderId,
        timestamp: m.timestamp
      }));

      // Run all analyses in parallel
      const [summary, actionItems, topics] = await Promise.all([
        summaryGenerator.generateSummary(conversationId, messages),
        actionItemExtractor.extractActionItems(conversationId, messages),
        topicModeling.classifyConversation(
          conversationId,
          messages.map(m => ({ content: m.content, senderType: m.senderType }))
        )
      ]);

      // Store results in conversation metadata
      conversation.metadata = {
        ...conversation.metadata,
        summary,
        actionItems: actionItems.actionItems,
        primaryTopic: topics.primaryTopic,
        analyzedAt: new Date()
      };
      await conversation.save();

      res.json({
        success: true,
        data: {
          conversationId,
          summary,
          actionItems: actionItems.actionItems,
          stats: {
            total: actionItems.totalTasks,
            pending: actionItems.pendingTasks,
            highPriority: actionItems.highPriorityTasks
          },
          topics: topics.topics,
          primaryTopic: topics.primaryTopic
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Error handler
router.use(errorHandler);

export default router;
