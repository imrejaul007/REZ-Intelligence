import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { merchantService } from '../services/merchantService.js';
import { aiAssistantService } from '../services/aiAssistantService.js';
import { whatsAppService } from '../services/whatsappService.js';
import { logger } from './utils/logger';
import type {
  MerchantSchema,
  SendMessageRequestSchema,
  CreateWorkflowRequestSchema,
  BookSlotRequestSchema,
  KnowledgeItemSchema,
  ApprovalRequestSchema,
} from '../types/index.js';

const router = Router();

// ============================================
// Health
// ============================================

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'rezops-ai',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// Merchant Routes
// ============================================

router.post('/merchants', async (req: Request, res: Response) => {
  try {
    const merchant = await merchantService.registerMerchant(req.body);
    res.status(201).json({ success: true, data: merchant });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      logger.error('Register merchant error', { error });
      res.status(500).json({ success: false, error: 'Failed to register merchant' });
    }
  }
});

router.get('/merchants/:merchantId', async (req: Request, res: Response) => {
  try {
    const merchant = await merchantService.getMerchant(req.params.merchantId);
    if (!merchant) {
      return res.status(404).json({ success: false, error: 'Merchant not found' });
    }
    res.json({ success: true, data: merchant });
  } catch (error) {
    logger.error('Get merchant error', { error });
    res.status(500).json({ success: false, error: 'Failed to get merchant' });
  }
});

router.put('/merchants/:merchantId', async (req: Request, res: Response) => {
  try {
    const merchant = await merchantService.updateMerchant(req.params.merchantId, req.body);
    if (!merchant) {
      return res.status(404).json({ success: false, error: 'Merchant not found' });
    }
    res.json({ success: true, data: merchant });
  } catch (error) {
    logger.error('Update merchant error', { error });
    res.status(500).json({ success: false, error: 'Failed to update merchant' });
  }
});

router.get('/merchants', async (req: Request, res: Response) => {
  try {
    const businessType = req.query.businessType as string | undefined;
    const merchants = await merchantService.listMerchants(businessType as any);
    res.json({ success: true, data: merchants, count: merchants.length });
  } catch (error) {
    logger.error('List merchants error', { error });
    res.status(500).json({ success: false, error: 'Failed to list merchants' });
  }
});

// ============================================
// Customer Routes
// ============================================

router.post('/customers', async (req: Request, res: Response) => {
  try {
    const { merchantId, phone, name } = req.body;
    const customer = await merchantService.registerCustomer(merchantId, phone, name);
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    logger.error('Register customer error', { error });
    res.status(500).json({ success: false, error: 'Failed to register customer' });
  }
});

router.get('/customers/:customerId', async (req: Request, res: Response) => {
  try {
    const customer = await merchantService.getCustomer(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    res.json({ success: true, data: customer });
  } catch (error) {
    logger.error('Get customer error', { error });
    res.status(500).json({ success: false, error: 'Failed to get customer' });
  }
});

router.get('/merchants/:merchantId/customers', async (req: Request, res: Response) => {
  try {
    const customers = await merchantService.listCustomers(req.params.merchantId);
    res.json({ success: true, data: customers, count: customers.length });
  } catch (error) {
    logger.error('List customers error', { error });
    res.status(500).json({ success: false, error: 'Failed to list customers' });
  }
});

// ============================================
// Conversation Routes
// ============================================

router.get('/merchants/:merchantId/conversations', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const conversations = await merchantService.listConversations(
      req.params.merchantId,
      status as any
    );
    res.json({ success: true, data: conversations, count: conversations.length });
  } catch (error) {
    logger.error('List conversations error', { error });
    res.status(500).json({ success: false, error: 'Failed to list conversations' });
  }
});

router.get('/conversations/:conversationId', async (req: Request, res: Response) => {
  try {
    const conversation = await merchantService.getConversation(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    res.json({ success: true, data: conversation });
  } catch (error) {
    logger.error('Get conversation error', { error });
    res.status(500).json({ success: false, error: 'Failed to get conversation' });
  }
});

// ============================================
// Knowledge Base Routes
// ============================================

router.post('/knowledge', async (req: Request, res: Response) => {
  try {
    const item = await merchantService.addKnowledgeItem(req.body.merchantId, {
      category: req.body.category,
      question: req.body.question,
      answer: req.body.answer,
      keywords: req.body.keywords || [],
      isActive: true,
    });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    logger.error('Add knowledge item error', { error });
    res.status(500).json({ success: false, error: 'Failed to add knowledge item' });
  }
});

router.get('/merchants/:merchantId/knowledge', async (req: Request, res: Response) => {
  try {
    const knowledge = await merchantService.getKnowledgeBase(req.params.merchantId);
    res.json({ success: true, data: knowledge, count: knowledge.length });
  } catch (error) {
    logger.error('Get knowledge base error', { error });
    res.status(500).json({ success: false, error: 'Failed to get knowledge base' });
  }
});

router.get('/merchants/:merchantId/knowledge/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query parameter q is required' });
    }
    const results = await merchantService.searchKnowledge(req.params.merchantId, query);
    res.json({ success: true, data: results, count: results.length });
  } catch (error) {
    logger.error('Search knowledge error', { error });
    res.status(500).json({ success: false, error: 'Failed to search knowledge' });
  }
});

// ============================================
// Booking Routes
// ============================================

router.post('/bookings', async (req: Request, res: Response) => {
  try {
    const booking = await merchantService.createBooking({
      merchantId: req.body.merchantId,
      customerId: req.body.customerId,
      service: req.body.service,
      date: req.body.date,
      time: req.body.time,
      duration: req.body.duration,
      staff: req.body.staff,
      status: 'pending',
      notes: req.body.notes,
      customerPhone: req.body.customerPhone,
      customerName: req.body.customerName,
    });
    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    logger.error('Create booking error', { error });
    res.status(500).json({ success: false, error: 'Failed to create booking' });
  }
});

router.get('/bookings/:bookingId', async (req: Request, res: Response) => {
  try {
    const booking = await merchantService.getBooking(req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    res.json({ success: true, data: booking });
  } catch (error) {
    logger.error('Get booking error', { error });
    res.status(500).json({ success: false, error: 'Failed to get booking' });
  }
});

router.put('/bookings/:bookingId', async (req: Request, res: Response) => {
  try {
    const booking = await merchantService.updateBooking(req.params.bookingId, req.body);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    res.json({ success: true, data: booking });
  } catch (error) {
    logger.error('Update booking error', { error });
    res.status(500).json({ success: false, error: 'Failed to update booking' });
  }
});

router.get('/merchants/:merchantId/bookings', async (req: Request, res: Response) => {
  try {
    const date = req.query.date as string | undefined;
    const bookings = await merchantService.listBookings(req.params.merchantId, date);
    res.json({ success: true, data: bookings, count: bookings.length });
  } catch (error) {
    logger.error('List bookings error', { error });
    res.status(500).json({ success: false, error: 'Failed to list bookings' });
  }
});

router.get('/merchants/:merchantId/bookings/availability', async (req: Request, res: Response) => {
  try {
    const { date, time, duration } = req.query as Record<string, string>;
    const available = await merchantService.checkAvailability(
      req.params.merchantId,
      date,
      time,
      duration ? parseInt(duration) : 60
    );
    res.json({ success: true, data: { available } });
  } catch (error) {
    logger.error('Check availability error', { error });
    res.status(500).json({ success: false, error: 'Failed to check availability' });
  }
});

// ============================================
// Workflow Routes
// ============================================

router.post('/workflows', async (req: Request, res: Response) => {
  try {
    const workflow = await merchantService.createWorkflow(req.body.merchantId, {
      name: req.body.name,
      type: req.body.type,
      trigger: req.body.trigger,
      actions: req.body.actions,
      isActive: true,
    });
    res.status(201).json({ success: true, data: workflow });
  } catch (error) {
    logger.error('Create workflow error', { error });
    res.status(500).json({ success: false, error: 'Failed to create workflow' });
  }
});

router.get('/merchants/:merchantId/workflows', async (req: Request, res: Response) => {
  try {
    const workflows = await merchantService.listWorkflows(req.params.merchantId);
    res.json({ success: true, data: workflows, count: workflows.length });
  } catch (error) {
    logger.error('List workflows error', { error });
    res.status(500).json({ success: false, error: 'Failed to list workflows' });
  }
});

// ============================================
// Approval Routes
// ============================================

router.post('/approvals', async (req: Request, res: Response) => {
  try {
    const approval = await merchantService.createApprovalRequest(req.body.merchantId, {
      type: req.body.type,
      customerId: req.body.customerId,
      description: req.body.description,
      originalValue: req.body.originalValue,
      requestedBy: req.body.requestedBy || 'ai',
    });
    res.status(201).json({ success: true, data: approval });
  } catch (error) {
    logger.error('Create approval error', { error });
    res.status(500).json({ success: false, error: 'Failed to create approval' });
  }
});

router.post('/approvals/:approvalId/resolve', async (req: Request, res: Response) => {
  try {
    const { resolvedBy, approved, resolution } = req.body;
    const approval = await merchantService.resolveApproval(
      req.params.approvalId,
      resolvedBy,
      approved,
      resolution
    );
    if (!approval) {
      return res.status(404).json({ success: false, error: 'Approval not found' });
    }
    res.json({ success: true, data: approval });
  } catch (error) {
    logger.error('Resolve approval error', { error });
    res.status(500).json({ success: false, error: 'Failed to resolve approval' });
  }
});

router.get('/merchants/:merchantId/approvals', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const approvals = await merchantService.listApprovals(
      req.params.merchantId,
      status as any
    );
    res.json({ success: true, data: approvals, count: approvals.length });
  } catch (error) {
    logger.error('List approvals error', { error });
    res.status(500).json({ success: false, error: 'Failed to list approvals' });
  }
});

// ============================================
// Analytics Routes
// ============================================

router.get('/merchants/:merchantId/analytics', async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query as Record<string, string>;
    const analytics = await merchantService.getAnalytics(
      req.params.merchantId,
      start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end || new Date().toISOString()
    );
    res.json({ success: true, data: analytics });
  } catch (error) {
    logger.error('Get analytics error', { error });
    res.status(500).json({ success: false, error: 'Failed to get analytics' });
  }
});

// ============================================
// WhatsApp Webhook Routes
// ============================================

router.get('/webhook/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

router.post('/webhook/whatsapp', async (req: Request, res: Response) => {
  try {
    await whatsAppService.processWebhook(req.body);
    res.sendStatus(200);
  } catch (error) {
    logger.error('WhatsApp webhook error', { error });
    res.sendStatus(500);
  }
});

// ============================================
// Message Routes
// ============================================

router.post('/send', async (req: Request, res: Response) => {
  try {
    const { merchantId, customerPhone, message, type } = req.body;
    
    // Find merchant
    const merchant = await merchantService.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({ success: false, error: 'Merchant not found' });
    }

    // Send message via WhatsApp
    const messageId = await whatsAppService.sendMessage(customerPhone, message);
    
    res.json({ success: true, data: { messageId } });
  } catch (error) {
    logger.error('Send message error', { error });
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { merchantId, customerPhone, message } = req.body;
    
    const response = await aiAssistantService.processMessage(
      merchantId,
      customerPhone,
      message
    );
    
    // Send AI response if needed
    if (response.action === 'send_message' || response.action === 'escalate') {
      await whatsAppService.sendMessage(customerPhone, response.message);
    }
    
    res.json({ 
      success: true, 
      data: {
        response: response.message,
        action: response.action,
        confidence: response.confidence,
      }
    });
  } catch (error) {
    logger.error('Chat error', { error });
    res.status(500).json({ success: false, error: 'Failed to process chat' });
  }
});

export default router;
