/**
 * REZ Care - Merchant Support Portal Routes
 *
 * Each merchant gets their own:
 * - Support inbox
 * - Ticket management
 * - Knowledge base
 * - Team management
 * - Analytics
 */

import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { mlIntelligence } from '../services/mlIntelligence';

const router = express.Router();

// In-memory stores (replace with MongoDB in production)
const merchantTickets: Map<string, any[]> = new Map();
const merchantFAQs: Map<string, any[]> = new Map();
const merchantTeams: Map<string, any[]> = new Map();

// ============================================
// MERCHANT TICKETS
// ============================================

/**
 * Get merchant tickets
 * GET /api/merchant/:merchantId/tickets
 */
router.get('/:merchantId/tickets', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const { status, category, page = 1, limit = 20 } = req.query;

    let tickets = merchantTickets.get(merchantId) || [];

    // Filter
    if (status && status !== 'all') {
      tickets = tickets.filter(t => t.status === status);
    }
    if (category && category !== 'all') {
      tickets = tickets.filter(t => t.category === category);
    }

    // Sort by updatedAt
    tickets.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Paginate
    const start = (Number(page) - 1) * Number(limit);
    const paginated = tickets.slice(start, start + Number(limit));

    res.json({
      success: true,
      tickets: paginated,
      total: tickets.length,
      page: Number(page),
      pages: Math.ceil(tickets.length / Number(limit)),
    });
  } catch (error: any) {
    logger.error('Failed to get tickets', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get single ticket
 * GET /api/merchant/:merchantId/tickets/:ticketId
 */
router.get('/:merchantId/tickets/:ticketId', async (req: Request, res: Response) => {
  try {
    const { merchantId, ticketId } = req.params;
    const tickets = merchantTickets.get(merchantId) || [];
    const ticket = tickets.find(t => t.id === ticketId);

    if (!ticket) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }

    res.json({ success: true, ticket });
  } catch (error: any) {
    logger.error('Failed to get ticket', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create ticket (from customer)
 * POST /api/merchant/:merchantId/tickets
 */
router.post('/:merchantId/tickets', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const { customerId, customerName, customerEmail, customerPhone, subject, category, message, priority, platform } = req.body;

    // Analyze sentiment
    const sentimentResult = await mlIntelligence.analyzeSentiment(message);

    const ticket = {
      id: uuidv4(),
      ticketNumber: `TKT-${merchantId.substring(0, 4).toUpperCase()}-${Date.now()}`,
      merchantId,
      customerId,
      customerName,
      customerEmail,
      customerPhone,
      subject,
      category,
      priority: priority || (sentimentResult.sentiment === 'critical_negative' ? 'urgent' : 'medium'),
      status: 'open',
      platform,
      channel: platform === 'email' ? 'email' : platform === 'whatsapp' ? 'whatsapp' : 'in_app',
      sentiment: sentimentResult.sentiment,
      messages: [{
        id: uuidv4(),
        sender: 'customer',
        senderName: customerName,
        content: message,
        timestamp: new Date().toISOString(),
        isRead: false,
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save
    const tickets = merchantTickets.get(merchantId) || [];
    tickets.push(ticket);
    merchantTickets.set(merchantId, tickets);

    logger.info('[Merchant] Ticket created', { merchantId, ticketId: ticket.id });

    res.status(201).json({
      success: true,
      ticket,
      message: 'Your support request has been submitted. We will respond soon.',
    });
  } catch (error: any) {
    logger.error('Failed to create ticket', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Respond to ticket
 * POST /api/merchant/:merchantId/tickets/:ticketId/respond
 */
router.post('/:merchantId/tickets/:ticketId/respond', async (req: Request, res: Response) => {
  try {
    const { merchantId, ticketId } = req.params;
    const { message, agentName } = req.body;

    const tickets = merchantTickets.get(merchantId) || [];
    const ticketIndex = tickets.findIndex(t => t.id === ticketId);

    if (ticketIndex === -1) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }

    const ticket = tickets[ticketIndex];
    ticket.messages.push({
      id: uuidv4(),
      sender: 'agent',
      senderName: agentName,
      content: message,
      timestamp: new Date().toISOString(),
      isRead: true,
    });
    ticket.status = 'in_progress';
    ticket.updatedAt = new Date().toISOString();

    tickets[ticketIndex] = ticket;
    merchantTickets.set(merchantId, tickets);

    logger.info('[Merchant] Ticket responded', { merchantId, ticketId });

    res.json({ success: true, message: 'Response sent' });
  } catch (error: any) {
    logger.error('Failed to respond', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Resolve ticket
 * POST /api/merchant/:merchantId/tickets/:ticketId/resolve
 */
router.post('/:merchantId/tickets/:ticketId/resolve', async (req: Request, res: Response) => {
  try {
    const { merchantId, ticketId } = req.params;
    const { resolution } = req.body;

    const tickets = merchantTickets.get(merchantId) || [];
    const ticketIndex = tickets.findIndex(t => t.id === ticketId);

    if (ticketIndex === -1) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }

    const ticket = tickets[ticketIndex];
    ticket.status = 'resolved';
    ticket.resolution = resolution;
    ticket.resolvedAt = new Date().toISOString();
    ticket.updatedAt = new Date().toISOString();

    tickets[ticketIndex] = ticket;
    merchantTickets.set(merchantId, tickets);

    res.json({ success: true, message: 'Ticket resolved' });
  } catch (error: any) {
    logger.error('Failed to resolve', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MERCHANT KNOWLEDGE BASE
// ============================================

/**
 * Get merchant FAQs
 * GET /api/merchant/:merchantId/kb
 */
router.get('/:merchantId/kb', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const { category, search } = req.query;

    let faqs = merchantFAQs.get(merchantId) || [];

    // Filter by category
    if (category && category !== 'all') {
      faqs = faqs.filter(f => f.category === category);
    }

    // Filter by search
    if (search) {
      const searchLower = String(search).toLowerCase();
      faqs = faqs.filter(f =>
        f.question.toLowerCase().includes(searchLower) ||
        f.answer.toLowerCase().includes(searchLower)
      );
    }

    // Only published
    faqs = faqs.filter(f => f.isPublished);

    res.json({ success: true, faqs });
  } catch (error: any) {
    logger.error('Failed to get FAQs', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create FAQ
 * POST /api/merchant/:merchantId/kb
 */
router.post('/:merchantId/kb', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const { question, answer, category, language = 'en', order = 0 } = req.body;

    const faq = {
      id: uuidv4(),
      merchantId,
      question,
      answer,
      category,
      language,
      order,
      viewCount: 0,
      helpfulCount: 0,
      notHelpfulCount: 0,
      isPublished: false,
      createdAt: new Date().toISOString(),
    };

    const faqs = merchantFAQs.get(merchantId) || [];
    faqs.push(faq);
    merchantFAQs.set(merchantId, faqs);

    res.status(201).json({ success: true, id: faq.id });
  } catch (error: any) {
    logger.error('Failed to create FAQ', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update FAQ
 * PUT /api/merchant/:merchantId/kb/:faqId
 */
router.put('/:merchantId/kb/:faqId', async (req: Request, res: Response) => {
  try {
    const { merchantId, faqId } = req.params;
    const updates = req.body;

    const faqs = merchantFAQs.get(merchantId) || [];
    const faqIndex = faqs.findIndex(f => f.id === faqId);

    if (faqIndex === -1) {
      res.status(404).json({ success: false, error: 'FAQ not found' });
      return;
    }

    faqs[faqIndex] = { ...faqs[faqIndex], ...updates };
    merchantFAQs.set(merchantId, faqs);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to update FAQ', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete FAQ
 * DELETE /api/merchant/:merchantId/kb/:faqId
 */
router.delete('/:merchantId/kb/:faqId', async (req: Request, res: Response) => {
  try {
    const { merchantId, faqId } = req.params;

    const faqs = merchantFAQs.get(merchantId) || [];
    const filtered = faqs.filter(f => f.id !== faqId);
    merchantFAQs.set(merchantId, filtered);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to delete FAQ', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Track FAQ view
 * POST /api/merchant/:merchantId/kb/:faqId/view
 */
router.post('/:merchantId/kb/:faqId/view', async (req: Request, res: Response) => {
  try {
    const { merchantId, faqId } = req.params;

    const faqs = merchantFAQs.get(merchantId) || [];
    const faqIndex = faqs.findIndex(f => f.id === faqId);

    if (faqIndex !== -1) {
      faqs[faqIndex].viewCount++;
      merchantFAQs.set(merchantId, faqs);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

/**
 * Mark FAQ helpful
 * POST /api/merchant/:merchantId/kb/:faqId/helpful
 */
router.post('/:merchantId/kb/:faqId/helpful', async (req: Request, res: Response) => {
  try {
    const { merchantId, faqId } = req.params;
    const { helpful } = req.body;

    const faqs = merchantFAQs.get(merchantId) || [];
    const faqIndex = faqs.findIndex(f => f.id === faqId);

    if (faqIndex !== -1) {
      if (helpful) {
        faqs[faqIndex].helpfulCount++;
      } else {
        faqs[faqIndex].notHelpfulCount++;
      }
      merchantFAQs.set(merchantId, faqs);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// ============================================
// MERCHANT STATS
// ============================================

/**
 * Get merchant stats
 * GET /api/merchant/:merchantId/stats
 */
router.get('/:merchantId/stats', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const tickets = merchantTickets.get(merchantId) || [];

    const open = tickets.filter(t => t.status === 'open').length;
    const resolved = tickets.filter(t => t.status === 'resolved').length;
    const total = tickets.length;

    // Category breakdown
    const byCategory: Record<string, number> = {};
    tickets.forEach(t => {
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    });

    // Priority breakdown
    const byPriority: Record<string, number> = {};
    tickets.forEach(t => {
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    });

    // Status breakdown
    const byStatus: Record<string, number> = {};
    tickets.forEach(t => {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    });

    // Today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ticketsToday = tickets.filter(t => new Date(t.createdAt) >= today).length;

    res.json({
      success: true,
      stats: {
        openTickets: open,
        resolvedTickets: resolved,
        totalTickets: total,
        ticketsToday,
        resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
        avgResponseTime: 45, // Placeholder
        csatScore: 4.2, // Placeholder
        byCategory,
        byPriority,
        byStatus,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get stats', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
