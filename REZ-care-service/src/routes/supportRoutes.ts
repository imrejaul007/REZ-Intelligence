/**
 * REZ Care Service - Unified Support Routes
 *
 * Combines all support features:
 * - Customer tickets (from rez-backend-master)
 * - Merchant tickets (from rez-merchant-service)
 * - AI features (from REZ-support-copilot)
 * - Industry Experts (rez-hospitality-expert, rez-salon-expert, etc.)
 * - NEW: CSAT, Escalation, Proactive, WhatsApp
 */

import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { getAIIntegration } from '../services/aiIntegrationService';
import { getExpertRouter } from '../services/expertRouter';
import { validate, schemas, fallbackSentiment } from '../middleware/errorHandler';
import { requireAuth, requireRole, optionalAuth, requireInternal } from '../middleware/auth';
import { supportService } from '../services/supportMetricsService';

const router = express.Router();
const aiIntegration = getAIIntegration();
const expertRouter = getExpertRouter();

// ============================================
// CUSTOMER SUPPORT
// ============================================

/**
 * Create support ticket
 * POST /api/support/tickets
 */
router.post('/tickets', async (req: Request, res: Response) => {
  try {
    // Validate request
    const validationResult = schemas.createTicket.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, errors: validationResult.error.issues });
    }

    const {
      userId,
      subject,
      category,
      message,
      relatedEntity,
      attachments,
      priority,
      platform
    } = validationResult.data;

    // Generate ticket number
    const ticketNumber = `TKT-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`;

    // Get AI analysis with fallback
    let aiAnalysis;
    try {
      aiAnalysis = await aiIntegration.analyzeSentiment(message);
    } catch (error) {
      logger.warn('[Tickets] AI analysis failed, using fallback');
      aiAnalysis = fallbackSentiment(message);
    }

    // Check for similar issues with fallback
    let similarIssues: unknown[] = [];
    try {
      similarIssues = await aiIntegration.searchKnowledge(message);
    } catch (error) {
      logger.warn('[Tickets] Knowledge search failed');
    }

    // Auto-assign based on sentiment
    const autoPriority = priority ||
      (aiAnalysis?.sentiment === 'critical_negative' ? 'urgent' :
       aiAnalysis?.sentiment === 'negative' ? 'high' : 'medium');

    const ticket = {
      ticketNumber,
      userId: userId || req.headers['x-customer-id'],
      subject,
      category,
      platform: platform || 'consumer',
      priority: autoPriority,
      status: 'open',
      messages: [{
        sender: userId || 'customer',
        senderType: 'user',
        message,
        timestamp: new Date().toISOString(),
        isRead: true
      }],
      relatedEntity,
      attachments: attachments || [],
      tags: [],
      aiAnalysis,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    logger.info('Ticket created', { ticketNumber, category, priority: autoPriority });

    res.status(201).json({
      success: true,
      ticketNumber,
      aiSuggestions: (aiAnalysis && 'suggestions' in aiAnalysis) ? aiAnalysis.suggestions : [],
      similarIssues: similarIssues.slice(0, 3),
      message: 'Support ticket created successfully'
    });
  } catch (error) {
    logger.error('Failed to create ticket', error);
    res.status(500).json({ success: false, error: 'Failed to create ticket' });
  }
});

/**
 * List tickets
 * GET /api/support/tickets
 */
router.get('/tickets', async (req: Request, res: Response) => {
  try {
    const { userId, status, category, platform, page = 1, limit = 20 } = req.query;

    // In real implementation, this would query MongoDB
    const tickets: unknown[] = [];
    const total = 0;

    res.json({
      success: true,
      tickets,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Failed to list tickets', error);
    res.status(500).json({ success: false, error: 'Failed to list tickets' });
  }
});

/**
 * Get ticket by number
 * GET /api/support/tickets/:ticketNumber
 */
router.get('/tickets/:ticketNumber', async (req: Request, res: Response) => {
  try {
    const { ticketNumber } = req.params;

    // Get AI suggestions for this ticket
    const customerId = req.headers['x-customer-id'] as string;
    const suggestions = customerId
      ? await aiIntegration.getTicketSuggestions(ticketNumber, customerId)
      : [];

    res.json({
      success: true,
      ticket: null,
      aiSuggestions: suggestions
    });
  } catch (error) {
    logger.error('Failed to get ticket', error);
    res.status(500).json({ success: false, error: 'Failed to get ticket' });
  }
});

/**
 * Add message to ticket
 * POST /api/support/tickets/:ticketNumber/messages
 */
router.post('/tickets/:ticketNumber/messages', async (req: Request, res: Response) => {
  try {
    const { ticketNumber } = req.params;
    const { message, attachments } = req.body;

    // Analyze sentiment
    const sentiment = await aiIntegration.analyzeSentiment(message);

    // If critical negative, trigger escalation
    if (sentiment?.sentiment === 'critical_negative') {
      logger.warn('Critical negative sentiment detected', { ticketNumber });
      // Would trigger escalation here
    }

    res.json({
      success: true,
      message: 'Message added',
      sentiment
    });
  } catch (error) {
    logger.error('Failed to add message', error);
    res.status(500).json({ success: false, error: 'Failed to add message' });
  }
});

/**
 * Close ticket (Agent only)
 * POST /api/support/tickets/:ticketNumber/close
 */
router.post('/tickets/:ticketNumber/close', requireAuth, async (req: Request, res: Response) => {
  try {
    const { ticketNumber } = req.params;
    const { resolution } = req.body;
    const agentId = (req as any).user?.id;

    // Update ticket status in database
    const ticket = await supportService.closeTicket(ticketNumber, {
      resolution,
      closedBy: agentId,
      closedAt: new Date(),
      status: 'closed'
    });

    logger.info('Ticket closed', { ticketNumber, resolution });

    res.json({
      success: true,
      message: 'Ticket closed',
      ticketNumber,
      resolution,
      closedAt: new Date()
    });
  } catch (error) {
    logger.error('Failed to close ticket', error);
    res.status(500).json({ success: false, error: 'Failed to close ticket' });
  }
});

/**
 * Rate ticket (Customer)
 * POST /api/support/tickets/:ticketNumber/rate
 */
router.post('/tickets/:ticketNumber/rate', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { ticketNumber } = req.params;
    const { score, comment } = req.body;
    const customerId = (req as any).user?.id;

    if (score === undefined || score < 1 || score > 5) {
      return res.status(400).json({ success: false, error: 'Score must be between 1 and 5' });
    }

    // Save rating to database
    await supportService.saveRating(ticketNumber, {
      score,
      comment,
      customerId,
      createdAt: new Date()
    });

    logger.info('Ticket rated', { ticketNumber, score, hasComment: !!comment });

    res.json({
      success: true,
      message: 'Rating submitted',
      ticketNumber,
      score
    });
  } catch (error) {
    logger.error('Failed to rate ticket', error);
    res.status(500).json({ success: false, error: 'Failed to rate ticket' });
  }
});

/**
 * Get ticket summary
 * GET /api/support/tickets/summary
 */
router.get('/tickets/summary', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      summary: {
        total: 0,
        open: 0,
        inProgress: 0,
        resolved: 0,
        byCategory: {},
        byPriority: {}
      }
    });
  } catch (error) {
    logger.error('Failed to get summary', error);
    res.status(500).json({ success: false, error: 'Failed to get summary' });
  }
});

// ============================================
// FAQ (From rez-backend-master)
// ============================================

/**
 * List FAQs
 * GET /api/support/faq
 */
router.get('/faq', async (req: Request, res: Response) => {
  try {
    const { category, query } = req.query;

    // Search knowledge base with AI
    const results = query
      ? await aiIntegration.searchKnowledge(query as string)
      : [];

    res.json({
      success: true,
      faqs: [],
      aiResults: results
    });
  } catch (error) {
    logger.error('Failed to get FAQs', error);
    res.status(500).json({ success: false, error: 'Failed to get FAQs' });
  }
});

/**
 * Search FAQs
 * GET /api/support/faq/search
 */
router.get('/faq/search', async (req: Request, res: Response) => {
  try {
    const { q, limit = 10 } = req.query;

    const results = await aiIntegration.searchKnowledge(q as string, Number(limit));

    res.json({
      success: true,
      results: results.map(r => ({
        id: r.id,
        question: r.question,
        answer: r.answer,
        confidence: r.confidence
      }))
    });
  } catch (error) {
    logger.error('Failed to search FAQs', error);
    res.status(500).json({ success: false, error: 'Failed to search FAQs' });
  }
});

/**
 * Get FAQ categories
 * GET /api/support/faq/categories
 */
router.get('/faq/categories', async (req: Request, res: Response) => {
  res.json({
    success: true,
    categories: [
      { id: 'payment', name: 'Payment Issues', count: 0 },
      { id: 'order', name: 'Order Issues', count: 0 },
      { id: 'account', name: 'Account', count: 0 },
      { id: 'technical', name: 'Technical Support', count: 0 },
      { id: 'refund', name: 'Refunds', count: 0 },
      { id: 'other', name: 'Other', count: 0 }
    ]
  });
});

/**
 * Mark FAQ helpful
 * POST /api/support/faq/:faqId/helpful
 */
router.post('/faq/:faqId/helpful', async (req: Request, res: Response) => {
  try {
    const { helpful } = req.body;
    res.json({ success: true, message: 'Feedback recorded' });
  } catch (error) {
    logger.error('Failed to mark FAQ helpful', error);
    res.status(500).json({ success: false, error: 'Failed to record feedback' });
  }
});

// ============================================
// CALLBACK (From rez-backend-master)
// ============================================

/**
 * Request callback
 * POST /api/support/callback
 */
router.post('/callback', async (req: Request, res: Response) => {
  try {
    const { phone, category, message } = req.body;

    // Create ticket for callback request
    const ticketNumber = `TKT-${Date.now()}-CB`;

    logger.info('Callback requested', { phone, category, ticketNumber });

    res.json({
      success: true,
      ticketNumber,
      message: 'Callback requested. Our team will call you within 30 minutes.'
    });
  } catch (error) {
    logger.error('Failed to request callback', error);
    res.status(500).json({ success: false, error: 'Failed to request callback' });
  }
});

// ============================================
// AI-POWERED (From REZ-support-copilot)
// ============================================

/**
 * Analyze sentiment (Agent only)
 * POST /api/support/ai/sentiment
 */
router.post('/ai/sentiment', requireAuth, async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    const analysis = await aiIntegration.analyzeSentiment(message);
    res.json({ success: true, analysis });
  } catch (error) {
    logger.error('Sentiment analysis failed', error);
    res.status(500).json({ success: false, error: 'Analysis failed' });
  }
});

/**
 * Detect intent (Agent only)
 * POST /api/support/ai/intent
 */
router.post('/ai/intent', requireAuth, async (req: Request, res: Response) => {
  try {
    const { message, context } = req.body;
    const intent = await aiIntegration.detectIntent(message, context);
    res.json({ success: true, intent });
  } catch (error) {
    logger.error('Intent detection failed', error);
    res.status(500).json({ success: false, error: 'Intent detection failed' });
  }
});

/**
 * Get user history (Agent only)
 * GET /api/support/ai/user-history/:userId
 */
router.get('/ai/user-history/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const history = await aiIntegration.getUserHistory(userId);
    res.json({ success: true, history });
  } catch (error) {
    logger.error('User history failed', error);
    res.status(500).json({ success: false, error: 'Failed to get user history' });
  }
});

/**
 * Get AI suggestions for ticket (Agent only)
 * GET /api/support/ai/suggestions/:ticketNumber
 */
router.get('/ai/suggestions/:ticketNumber', requireAuth, async (req: Request, res: Response) => {
  try {
    const { ticketNumber } = req.params;
    const customerId = req.headers['x-customer-id'] as string;
    const suggestions = await aiIntegration.getTicketSuggestions(ticketNumber, customerId);
    res.json({ success: true, suggestions });
  } catch (error) {
    logger.error('AI suggestions failed', error);
    res.status(500).json({ success: false, error: 'Failed to get suggestions' });
  }
});

/**
 * Unified customer view (Agent only)
 * GET /api/support/ai/unified/:userId
 */
router.get('/ai/unified/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const view = await aiIntegration.getUnifiedCustomerView(userId);
    res.json({ success: true, ...(view as object) });
  } catch (error) {
    logger.error('Unified view failed', error);
    res.status(500).json({ success: false, error: 'Failed to get unified view' });
  }
});

// ============================================
// CHAT (with Expert Routing)
// ============================================

/**
 * AI Chat with Expert Routing
 * POST /api/support/chat
 *
 * Routes to:
 * - Industry Expert (hotel, salon, fitness, etc.)
 * - REZ-support-copilot (fallback)
 */
router.post('/chat', requireAuth, async (req: Request, res: Response) => {
  try {
    const { message, context } = req.body;
    const customerId = req.headers['x-customer-id'] as string;

    // Route to industry expert or AI
    const response = await expertRouter.route(message, {
      customerId,
      platform: context?.platform || 'consumer',
      ...context
    });

    // If escalation needed, create ticket
    if (response.escalate) {
      const ticketNumber = `TKT-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`;
      logger.info('[Chat] Escalation detected, ticket created', { ticketNumber });
      response.ticketNumber = ticketNumber;
    }

    res.json({
      ...response,
      success: true
    });
  } catch (error) {
    logger.error('Chat failed', error);
    res.status(500).json({
      response: "An error occurred. Please try again.",
      success: false
    });
  }
});

/**
 * Check Expert Health (Internal)
 * GET /api/support/experts/health
 */
router.get('/experts/health', requireInternal, async (req: Request, res: Response) => {
  try {
    const health = await expertRouter.checkExpertsHealth();
    res.json({ success: true, experts: health });
  } catch (error) {
    logger.error('Expert health check failed', error);
    res.status(500).json({ success: false, error: 'Health check failed' });
  }
});

/**
 * Route to specific Expert (Agent only)
 * POST /api/support/experts/:expert/chat
 */
router.post('/experts/:expert/chat', requireAuth, async (req: Request, res: Response) => {
  try {
    const { expert } = req.params;
    const { message, context } = req.body;

    const response = await expertRouter.route(message, {
      customerId: req.headers['x-customer-id'] as string,
      platform: context?.platform || 'consumer',
      industry: expert,
      ...context
    });

    res.json({
      ...response,
      success: true
    });
  } catch (error) {
    logger.error('Expert chat failed', error);
    res.status(500).json({ error: 'Expert chat failed', success: false });
  }
});

// ============================================
// CONFIG
// ============================================

/**
 * Get public support config
 * GET /api/support/config
 */
router.get('/config', async (req: Request, res: Response) => {
  res.json({
    success: true,
    config: {
      categories: [
        'payment',
        'order',
        'account',
        'technical',
        'refund',
        'delivery',
        'other'
      ],
      workingHours: '24/7',
      phone: '+91-XXX-XXX-XXXX',
      email: 'support@rez.money',
      chat: true,
      callback: true,
      aiPowered: true
    }
  });
});

export default router;
