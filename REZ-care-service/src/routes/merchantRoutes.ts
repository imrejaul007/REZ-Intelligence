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
import { logger } from '../utils/logger.js';
import { mlIntelligence } from '../services/mlIntelligence';

const router = express.Router();

// Types for merchant data
interface TicketMessage {
  id: string;
  sender: string;
  senderName?: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

interface Ticket {
  id: string;
  ticketNumber: string;
  merchantId: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  platform?: string;
  channel?: string;
  sentiment?: string;
  messages: TicketMessage[];
  resolution?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface FAQ {
  id: string;
  merchantId: string;
  question: string;
  answer: string;
  category: string;
  language: string;
  order: number;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  isPublished: boolean;
  createdAt: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

// In-memory stores (replace with MongoDB in production)
const merchantTickets: Map<string, Ticket[]> = new Map();
const merchantFAQs: Map<string, FAQ[]> = new Map();
const merchantTeams: Map<string, TeamMember[]> = new Map();

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
      tickets = tickets.filter((t: Ticket) => t.status === status);
    }
    if (category && category !== 'all') {
      tickets = tickets.filter((t: Ticket) => t.category === category);
    }

    // Sort by updatedAt
    tickets.sort((a: Ticket, b: Ticket) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

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
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get tickets', error);
    res.status(500).json({ success: false, error: errorMsg });
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
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get ticket', error);
    res.status(500).json({ success: false, error: errorMsg });
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
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create ticket', error);
    res.status(500).json({ success: false, error: errorMsg });
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
    const ticketIndex = tickets.findIndex((t: Ticket) => t.id === ticketId);

    if (ticketIndex === -1) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }

    const ticket = tickets[ticketIndex] as Ticket;
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
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to respond', error);
    res.status(500).json({ success: false, error: errorMsg });
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
    const ticketIndex = tickets.findIndex((t: Ticket) => t.id === ticketId);

    if (ticketIndex === -1) {
      res.status(404).json({ success: false, error: 'Ticket not found' });
      return;
    }

    const ticket = tickets[ticketIndex] as Ticket;
    ticket.status = 'resolved';
    ticket.resolution = resolution;
    ticket.resolvedAt = new Date().toISOString();
    ticket.updatedAt = new Date().toISOString();

    tickets[ticketIndex] = ticket;
    merchantTickets.set(merchantId, tickets);

    res.json({ success: true, message: 'Ticket resolved' });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to resolve', error);
    res.status(500).json({ success: false, error: errorMsg });
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
      faqs = faqs.filter((f: FAQ) => f.category === category);
    }

    // Filter by search
    if (search) {
      const searchLower = String(search).toLowerCase();
      faqs = faqs.filter((f: FAQ) =>
        f.question.toLowerCase().includes(searchLower) ||
        f.answer.toLowerCase().includes(searchLower)
      );
    }

    // Only published
    faqs = faqs.filter((f: FAQ) => f.isPublished);

    res.json({ success: true, faqs });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get FAQs', error);
    res.status(500).json({ success: false, error: errorMsg });
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
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create FAQ', error);
    res.status(500).json({ success: false, error: errorMsg });
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
    const faqIndex = faqs.findIndex((f: FAQ) => f.id === faqId);

    if (faqIndex === -1) {
      res.status(404).json({ success: false, error: 'FAQ not found' });
      return;
    }

    faqs[faqIndex] = { ...faqs[faqIndex], ...updates };
    merchantFAQs.set(merchantId, faqs);

    res.json({ success: true });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update FAQ', error);
    res.status(500).json({ success: false, error: errorMsg });
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
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to delete FAQ', error);
    res.status(500).json({ success: false, error: errorMsg });
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
    const faqIndex = faqs.findIndex((f: FAQ) => f.id === faqId);

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
    const faqIndex = faqs.findIndex((f: FAQ) => f.id === faqId);

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

    const open = tickets.filter((t: Ticket) => t.status === 'open').length;
    const resolved = tickets.filter((t: Ticket) => t.status === 'resolved').length;
    const total = tickets.length;

    // Category breakdown
    const byCategory: Record<string, number> = {};
    tickets.forEach((t: Ticket) => {
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    });

    // Priority breakdown
    const byPriority: Record<string, number> = {};
    tickets.forEach((t: Ticket) => {
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    });

    // Status breakdown
    const byStatus: Record<string, number> = {};
    tickets.forEach((t: Ticket) => {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    });

    // Today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ticketsToday = tickets.filter((t: Ticket) => new Date(t.createdAt) >= today).length;

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
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get stats', error);
    res.status(500).json({ success: false, error: errorMsg });
  }
});

export default router;
