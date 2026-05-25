/**
 * REZ Care Service - Mobile App API Routes
 *
 * Handles all mobile SDK endpoints:
 * - Tickets CRUD
 * - CSAT surveys
 * - Knowledge base
 * - Live chat
 * - Order support
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { getExpertRouter } from '../services/expertRouter';

const router = express.Router();
const expertRouter = getExpertRouter();

// ============================================
// MIDDLEWARE
// ============================================

function extractCustomer(req: Request, res: Response, next: Function) {
  const customerId = req.headers['x-customer-id'] as string ||
    req.query.userId as string ||
    req.body?.userId as string;

  if (!customerId) {
    return res.status(401).json({ error: 'Customer ID required' });
  }

  (req as unknown).customerId = customerId;
  (req as unknown).userId = customerId;
  next();
}

// ============================================
// TICKETS
// ============================================

const createTicketSchema = z.object({
  userId: z.string(),
  category: z.string(),
  subject: z.string().min(1),
  message: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

router.post('/tickets', extractCustomer, async (req: Request, res: Response) => {
  try {
    const { userId } = req as unknown;
    const parseResult = createTicketSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors
      });
    }

    const { category, subject, message, priority } = parseResult.data;
    const ticketId = `TKT-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`;

    const ticket = {
      ticketId,
      status: 'open' as const,
      category,
      priority: priority || 'medium',
      subject,
      message,
      customerId: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      platform: 'mobile',
      messages: [{
        id: uuidv4(),
        role: 'customer' as const,
        content: message,
        timestamp: new Date().toISOString(),
      }],
    };

    logger.info('[Mobile] Ticket created', { ticketId, category });

    res.status(201).json({
      success: true,
      ticket,
    });
  } catch (error) {
    logger.error('[Mobile] Failed to create ticket', error);
    res.status(500).json({ success: false, error: 'Failed to create ticket' });
  }
});

router.get('/tickets', extractCustomer, async (req: Request, res: Response) => {
  try {
    const { userId } = req as unknown;
    const { status, limit = 20 } = req.query;

    // Mock tickets for demo
    const tickets = [
      {
        ticketId: 'TKT-001',
        status: 'open',
        category: 'payment',
        priority: 'high',
        subject: 'Payment issue',
        message: 'My payment failed',
        customerId: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        platform: 'mobile',
      },
    ];

    res.json({
      success: true,
      tickets: tickets.slice(0, Number(limit)),
      total: tickets.length,
    });
  } catch (error) {
    logger.error('[Mobile] Failed to get tickets', error);
    res.status(500).json({ success: false, error: 'Failed to get tickets' });
  }
});

router.get('/tickets/:id', extractCustomer, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const ticket = {
      ticketId: id,
      status: 'open',
      category: 'payment',
      priority: 'high',
      subject: 'Payment issue',
      message: 'My payment failed',
      customerId: req as unknown,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      platform: 'mobile',
      messages: [],
    };

    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get ticket' });
  }
});

router.post('/tickets/:id/respond', extractCustomer, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    const ticket = {
      ticketId: id,
      status: 'in_progress',
      updatedAt: new Date().toISOString(),
    };

    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to respond' });
  }
});

router.post('/tickets/:id/resolve', extractCustomer, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const ticket = {
      ticketId: id,
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to resolve' });
  }
});

// ============================================
// CSAT
// ============================================

const csatSchema = z.object({
  ticketId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
});

router.post('/csat', extractCustomer, async (req: Request, res: Response) => {
  try {
    const parseResult = csatSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid CSAT data',
      });
    }

    const { ticketId, rating, comment } = parseResult.data;

    logger.info('[Mobile] CSAT submitted', { ticketId, rating });

    res.json({
      success: true,
      message: 'Thank you for your feedback!',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to submit CSAT' });
  }
});

router.get('/csat/pending', extractCustomer, async (req: Request, res: Response) => {
  try {
    const { userId } = req as unknown;

    res.json({
      success: true,
      tickets: [],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get pending CSAT' });
  }
});

// ============================================
// KNOWLEDGE BASE
// ============================================

router.get('/knowledge/search', async (req: Request, res: Response) => {
  try {
    const { q, category, limit = 10 } = req.query;

    // Mock articles
    const articles = [
      {
        id: 'kb-001',
        title: 'How to track your order',
        content: 'You can track your order from the Orders section...',
        category: 'orders',
        helpful: 150,
        tags: ['tracking', 'orders'],
      },
      {
        id: 'kb-002',
        title: 'Payment methods accepted',
        content: 'We accept UPI, cards, wallets, and net banking...',
        category: 'payment',
        helpful: 200,
        tags: ['payment', 'upi'],
      },
    ];

    res.json({
      success: true,
      articles: articles.slice(0, Number(limit)),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

router.get('/knowledge/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const article = {
      id,
      title: 'Knowledge Base Article',
      content: 'Article content here...',
      category: 'general',
      helpful: 0,
      tags: [],
    };

    res.json({ success: true, article });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Article not found' });
  }
});

router.post('/knowledge/:id/helpful', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { helpful } = req.body;

    logger.info('[Mobile] KB helpful vote', { articleId: id, helpful });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to record feedback' });
  }
});

// ============================================
// FAQS
// ============================================

router.get('/faqs', async (req: Request, res: Response) => {
  try {
    const { category } = req.query;

    const faqs = [
      {
        id: 'faq-001',
        question: 'How do I track my order?',
        answer: 'Go to Orders > Select order > Track',
        category: 'orders',
        helpful: 500,
      },
      {
        id: 'faq-002',
        question: 'What payment methods are accepted?',
        answer: 'UPI, Credit/Debit cards, Net Banking, Wallets',
        category: 'payment',
        helpful: 300,
      },
      {
        id: 'faq-003',
        question: 'How long does refund take?',
        answer: 'Refunds are processed within 3-5 business days',
        category: 'refunds',
        helpful: 400,
      },
    ];

    res.json({
      success: true,
      faqs: category ? faqs.filter(f => f.category === category) : faqs,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get FAQs' });
  }
});

// ============================================
// LIVE CHAT
// ============================================

const chatSessions = new Map<string, {
  userId: string;
  messages: Array<{ role: string; content: string; timestamp: string }>;
  createdAt: Date;
}>();

router.post('/chat/start', extractCustomer, async (req: Request, res: Response) => {
  try {
    const { userId, message } = req.body;
    const sessionId = `chat-${Date.now()}-${uuidv4().substring(0, 8)}`;

    chatSessions.set(sessionId, {
      userId,
      messages: [],
      createdAt: new Date(),
    });

    // Auto-generate ticket
    const ticketId = `TKT-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`;

    // Route to expert if applicable
    let response = "Thanks for reaching out! How can we help you today?";
    try {
      const expertResult = await expertRouter.route(message || 'Hello', {
        customerId: userId,
        sessionId,
        platform: 'mobile',
      });
      if (expertResult.success) {
        response = expertResult.response;
      }
    } catch {
      // Use default response
    }

    res.json({
      success: true,
      sessionId,
      ticketId,
      response,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start chat' });
  }
});

router.post('/chat/send', extractCustomer, async (req: Request, res: Response) => {
  try {
    const { sessionId, message } = req.body;

    if (!chatSessions.has(sessionId)) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const session = chatSessions.get(sessionId)!;
    session.messages.push({
      role: 'customer',
      content: message,
      timestamp: new Date().toISOString(),
    });

    // Route to expert
    let response = "I understand. Let me check that for you.";
    try {
      const expertResult = await expertRouter.route(message, {
        customerId: session.userId,
        sessionId,
        platform: 'mobile',
      });

      if (expertResult.success) {
        response = expertResult.response;

        if (expertResult.ticketCreated) {
          session.messages.push({
            role: 'system',
            content: `Ticket created: ${expertResult.ticketNumber}`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch {
      // Use default response
    }

    session.messages.push({
      role: 'bot',
      content: response,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      response,
      intent: 'general',
      actions: [],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

router.get('/chat/:sessionId/history', extractCustomer, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    if (!chatSessions.has(sessionId)) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    res.json({
      success: true,
      messages: chatSessions.get(sessionId)!.messages,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get history' });
  }
});

router.post('/chat/:sessionId/end', extractCustomer, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    chatSessions.delete(sessionId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to end chat' });
  }
});

// ============================================
// ORDER SUPPORT
// ============================================

router.get('/orders/:orderId/support-options', extractCustomer, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    res.json({
      success: true,
      options: [
        { type: 'track', label: 'Track Order', description: 'View delivery status', available: true },
        { type: 'cancel', label: 'Cancel Order', description: 'Cancel before dispatch', available: true },
        { type: 'refund', label: 'Request Refund', description: 'Get money back', available: true },
      ],
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get options' });
  }
});

router.post('/orders/:orderId/cancel', extractCustomer, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    logger.info('[Mobile] Order cancellation requested', { orderId, reason });

    res.json({
      success: true,
      message: 'Cancellation request submitted',
      refundAmount: 0,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to cancel order' });
  }
});

router.post('/orders/:orderId/refund', extractCustomer, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { reason, amount } = req.body;

    logger.info('[Mobile] Refund requested', { orderId, reason, amount });

    res.json({
      success: true,
      ticketId: `TKT-${Date.now()}`,
      estimatedDays: 5,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to request refund' });
  }
});

export default router;
