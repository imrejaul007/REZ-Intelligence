import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  supportAgent,
  SupportContext,
  TicketPriority,
  TicketCategory,
  TicketSource,
  Customer,
  SupportResponse
} from '../services/supportAgent';
import { ticketService, TicketFilter } from '../services/ticketService';
import { refundService, RefundReason, RefundStatus, RefundMethod } from '../services/refundService';
import { logger } from '../services/supportAgent';

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

const chatSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1).max(5000),
  context: z.object({
    customerId: z.string().optional(),
    customer: z.object({
      id: z.string(),
      email: z.string().email(),
      name: z.string(),
      phone: z.string().optional(),
      tier: z.enum(['basic', 'premium', 'enterprise']),
      accountAge: z.number().min(0),
      totalSpent: z.number().min(0),
      totalTickets: z.number().int().min(0),
      satisfactionScore: z.number().min(0).max(5)
    }).nullable().optional(),
    ticketId: z.string().optional(),
    conversationHistory: z.array(z.string()).optional(),
    relatedOrders: z.array(z.string()).optional(),
    previousTickets: z.array(z.string()).optional()
  }).optional()
});

const createTicketSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  category: z.nativeEnum(TicketCategory).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  customerId: z.string(),
  customerName: z.string(),
  customerEmail: z.string().email(),
  source: z.nativeEnum(TicketSource).optional(),
  orderId: z.string().optional(),
  tags: z.array(z.string()).optional()
});

const updateTicketSchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  assignedTo: z.string().nullable().optional(),
  assignedTeam: z.string().nullable().optional(),
  tags: z.array(z.string()).optional()
});

const addMessageSchema = z.object({
  authorId: z.string(),
  authorName: z.string(),
  authorType: z.enum(['customer', 'agent', 'system', 'bot']),
  content: z.string().min(1).max(10000),
  attachments: z.array(z.object({
    filename: z.string(),
    url: z.string(),
    mimeType: z.string(),
    size: z.number()
  })).optional(),
  isInternal: z.boolean().optional()
});

const createRefundSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  customerEmail: z.string().email(),
  customerName: z.string(),
  amount: z.number().min(0),
  reason: z.nativeEnum(RefundReason),
  description: z.string().min(1).max(2000),
  evidence: z.object({
    screenshots: z.array(z.string()).optional(),
    descriptions: z.array(z.string()).optional(),
    emailThread: z.string().optional()
  }).optional(),
  ticketId: z.string().optional()
});

const ticketFilterSchema = z.object({
  status: z.array(z.nativeEnum(TicketStatus)).optional(),
  priority: z.array(z.nativeEnum(TicketPriority)).optional(),
  category: z.array(z.nativeEnum(TicketCategory)).optional(),
  customerId: z.string().optional(),
  assignedTo: z.string().optional(),
  assignedTeam: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  searchQuery: z.string().optional()
});

router.post('/chat', validateRequest(chatSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId: providedSessionId, message, context } = req.body;
    const sessionId = providedSessionId || uuidv4();

    logger.info('Chat request received', { sessionId, messageLength: message.length });

    const supportContext: SupportContext = {
      customer: context?.customer || null,
      ticketId: context?.ticketId || null,
      conversationHistory: context?.conversationHistory || [],
      relatedOrders: context?.relatedOrders || [],
      previousTickets: context?.previousTickets || []
    };

    const response: SupportResponse = await supportAgent.processCustomerMessage(
      supportContext,
      message,
      sessionId
    );

    res.json({
      success: true,
      data: {
        response: response.message,
        actions: response.actions,
        data: response.data
      },
      meta: {
        sessionId,
        processingTimeMs: response.processingTime,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Chat endpoint error', { error });
    next(error);
  }
});

router.post('/tickets', validateRequest(createTicketSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticketData = req.body;

    logger.info('Creating new ticket', { subject: ticketData.subject, customerId: ticketData.customerId });

    const ticket = await ticketService.createTicket(ticketData);

    res.status(201).json({
      success: true,
      data: { ticket }
    });

  } catch (error) {
    logger.error('Ticket creation error', { error });
    next(error);
  }
});

router.get('/tickets', validateRequest(ticketFilterSchema), async (req: Request, res: Response) => {
  const filter: TicketFilter = {};

  if (req.query.status) {
    filter.status = Array.isArray(req.query.status) ? req.query.status as unknown : [req.query.status as unknown];
  }
  if (req.query.priority) {
    filter.priority = Array.isArray(req.query.priority) ? req.query.priority as unknown : [req.query.priority as unknown];
  }
  if (req.query.category) {
    filter.category = Array.isArray(req.query.category) ? req.query.category as unknown : [req.query.category as unknown];
  }
  if (req.query.customerId) filter.customerId = req.query.customerId as string;
  if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo as string;
  if (req.query.assignedTeam) filter.assignedTeam = req.query.assignedTeam as string;
  if (req.query.dateFrom) filter.dateFrom = new Date(req.query.dateFrom as string);
  if (req.query.dateTo) filter.dateTo = new Date(req.query.dateTo as string);
  if (req.query.tags) filter.tags = Array.isArray(req.query.tags) ? req.query.tags as string[] : [req.query.tags as string];
  if (req.query.searchQuery) filter.searchQuery = req.query.searchQuery as string;

  const tickets = ticketService.getTickets(filter);

  res.json({
    success: true,
    data: {
      tickets,
      count: tickets.length
    }
  });
});

router.get('/tickets/stats', async (req: Request, res: Response) => {
  const filter: TicketFilter = {};

  if (req.query.customerId) filter.customerId = req.query.customerId as string;
  if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo as string;
  if (req.query.assignedTeam) filter.assignedTeam = req.query.assignedTeam as string;

  const stats = ticketService.getStats(filter);

  res.json({
    success: true,
    data: stats
  });
});

router.get('/tickets/overdue', async (req: Request, res: Response) => {
  const overdueTickets = ticketService.getOverdueTickets();

  res.json({
    success: true,
    data: {
      tickets: overdueTickets,
      count: overdueTickets.length
    }
  });
});

router.get('/tickets/sla-upcoming', async (req: Request, res: Response) => {
  const hoursAhead = parseInt(req.query.hours as string) || 4;
  const upcomingTickets = ticketService.getUpcomingSlaDeadlines(hoursAhead);

  res.json({
    success: true,
    data: {
      tickets: upcomingTickets,
      count: upcomingTickets.length
    }
  });
});

router.get('/tickets/:ticketId', async (req: Request, res: Response) => {
  const { ticketId } = req.params;

  const ticket = ticketService.getTicket(ticketId) || ticketService.getTicketByDisplayId(ticketId);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Ticket ${ticketId} not found`
      }
    });
  }

  res.json({
    success: true,
    data: { ticket }
  });
});

router.patch('/tickets/:ticketId', validateRequest(updateTicketSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ticketId } = req.params;
    const updates = req.body;

    const ticket = await ticketService.updateTicket(ticketId, updates);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Ticket ${ticketId} not found`
        }
      });
    }

    res.json({
      success: true,
      data: { ticket }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/tickets/:ticketId/messages', validateRequest(addMessageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ticketId } = req.params;
    const messageData = req.body;

    const message = await ticketService.addMessage(ticketId, messageData);

    if (!message) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Ticket ${ticketId} not found`
        }
      });
    }

    res.status(201).json({
      success: true,
      data: { message }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/tickets/:ticketId/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ticketId } = req.params;
    const resolution = req.body;

    const ticket = await ticketService.resolveTicket(ticketId, resolution);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Ticket ${ticketId} not found`
        }
      });
    }

    res.json({
      success: true,
      data: { ticket }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/tickets/:ticketId/close', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ticketId } = req.params;
    const resolution = req.body;

    const ticket = await ticketService.closeTicket(ticketId, resolution);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Ticket ${ticketId} not found`
        }
      });
    }

    res.json({
      success: true,
      data: { ticket }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/tickets/:ticketId/escalate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ticketId } = req.params;
    const { reason } = req.body;

    const ticket = await ticketService.escalateTicket(ticketId, reason || 'Escalated by support agent');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Ticket ${ticketId} not found`
        }
      });
    }

    res.json({
      success: true,
      data: { ticket }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/tickets/:ticketId/assign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ticketId } = req.params;
    const { agentId, agentName, team } = req.body;

    const ticket = await ticketService.assignTicket(ticketId, agentId, agentName, team);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Ticket ${ticketId} not found`
        }
      });
    }

    res.json({
      success: true,
      data: { ticket }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/tickets/:ticketId/link/:relatedTicketId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ticketId, relatedTicketId } = req.params;

    const success = await ticketService.linkTickets(ticketId, relatedTicketId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'One or both tickets not found'
        }
      });
    }

    res.json({
      success: true,
      data: { linked: true }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/refunds/eligibility', async (req: Request, res: Response) => {
  const { orderId, customerId, totalSpent, totalTickets } = req.body;

  const eligibility = refundService.getRefundEligibility({
    orderId,
    customerId,
    totalSpent,
    totalTickets
  });

  res.json({
    success: true,
    data: eligibility
  });
});

router.post('/refunds', validateRequest(createRefundSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refundData = req.body;

    logger.info('Creating refund request', { orderId: refundData.orderId, customerId: refundData.customerId });

    const refund = await refundService.createRefundRequest(refundData);

    res.status(201).json({
      success: true,
      data: { refund }
    });

  } catch (error) {
    logger.error('Refund creation error', { error });
    res.status(400).json({
      success: false,
      error: {
        code: 'REFUND_NOT_ELIGIBLE',
        message: error instanceof Error ? error.message : 'Failed to create refund request'
      }
    });
  }
});

router.get('/refunds', async (req: Request, res: Response) => {
  const refunds = refundService.getAllRefunds();

  res.json({
    success: true,
    data: {
      refunds,
      count: refunds.length
    }
  });
});

router.get('/refunds/stats', async (req: Request, res: Response) => {
  const stats = refundService.getRefundStats();

  res.json({
    success: true,
    data: stats
  });
});

router.get('/refunds/:refundId', async (req: Request, res: Response) => {
  const { refundId } = req.params;

  const refund = refundService.getRefundRequest(refundId) ||
                 refundService.getRefundByDisplayId(refundId);

  if (!refund) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Refund ${refundId} not found`
      }
    });
  }

  res.json({
    success: true,
    data: { refund }
  });
});

router.post('/refunds/:refundId/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refundId } = req.params;
    const { approvedBy } = req.body;

    const refund = await refundService.approveRefund(refundId, approvedBy);

    if (!refund) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Refund ${refundId} not found`
        }
      });
    }

    res.json({
      success: true,
      data: { refund }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/refunds/:refundId/process', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refundId } = req.params;

    const refund = await refundService.processRefund(refundId);

    if (!refund) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Refund ${refundId} not found`
        }
      });
    }

    res.json({
      success: true,
      data: { refund }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/refunds/:refundId/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refundId } = req.params;
    const { transactionId } = req.body;

    const refund = await refundService.completeRefund(refundId, transactionId);

    if (!refund) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Refund ${refundId} not found`
        }
      });
    }

    res.json({
      success: true,
      data: { refund }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/refunds/:refundId/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refundId } = req.params;
    const { reason, rejectedBy } = req.body;

    const refund = await refundService.rejectRefund(refundId, reason, rejectedBy);

    if (!refund) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Refund ${refundId} not found`
        }
      });
    }

    res.json({
      success: true,
      data: { refund }
    });

  } catch (error) {
    next(error);
  }
});

import { TicketStatus } from '../services/supportAgent';

export { router as supportRouter };
