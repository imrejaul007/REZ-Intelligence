/**
 * REZ Care - WhatsApp Routes
 *
 * Handles WhatsApp Business API webhook and messaging endpoints.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { whatsappService, WhatsAppWebhook } from '../services/whatsappService';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/errorHandler';
import { ticketService } from '../services/ticketService';
import { customer360Service } from '../services/customer360Service';

const router = Router();

// ============================================
// WEBHOOK VERIFICATION
// ============================================

/**
 * GET /api/whatsapp/webhook
 * Facebook webhook verification endpoint
 */
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  if (whatsappService.verifyWebhook(mode, token, challenge)) {
    logger.info('[WhatsApp] Webhook verified');
    res.status(200).send(challenge);
  } else {
    logger.warn('[WhatsApp] Webhook verification failed', { mode, token });
    res.sendStatus(403);
  }
});

// ============================================
// WEBHOOK EVENTS
// ============================================

/**
 * POST /api/whatsapp/webhook
 * Handle incoming WhatsApp messages and status updates
 */
router.post('/webhook', asyncHandler(async (req: Request, res: Response) => {
  // Verify signature in production
  if (process.env.NODE_ENV === 'production') {
    const signature = req.headers['x-hub-signature-256'] as string;
    const rawBody = JSON.stringify(req.body);

    if (!whatsappService.verifySignature(rawBody, signature)) {
      logger.warn('[WhatsApp] Invalid webhook signature');
      return res.sendStatus(403);
    }
  }

  const payload = req.body as WhatsAppWebhook;
  const { messages, statuses } = whatsappService.parseWebhook(payload);

  logger.info('[WhatsApp] Webhook received', {
    messageCount: messages.length,
    statusCount: statuses.length,
  });

  // Process messages
  for (const message of messages) {
    try {
      await processIncomingMessage(message);
    } catch (error) {
      logger.error('[WhatsApp] Message processing failed', { messageId: message.id, error });
    }
  }

  // Process status updates
  for (const status of statuses) {
    try {
      await processStatusUpdate(status);
    } catch (error) {
      logger.error('[WhatsApp] Status update failed', { statusId: status.id, error });
    }
  }

  res.status(200).send('OK');
}));

// ============================================
// SEND MESSAGE ENDPOINTS
// ============================================

const sendMessageSchema = z.object({
  to: z.string().min(10),
  message: z.string().min(1).max(4096),
  type: z.enum(['text', 'template']).default('text'),
  templateName: z.string().optional(),
  templateParams: z.record(z.string()).optional(),
});

/**
 * POST /api/whatsapp/send
 * Send a WhatsApp message to a customer
 */
router.post('/send', asyncHandler(async (req: Request, res: Response) => {
  const { to, message, type, templateName, templateParams } = sendMessageSchema.parse(req.body);

  let result;
  if (type === 'template' && templateName) {
    const components = templateParams
      ? [{ type: 'body', parameters: Object.values(templateParams).map(v => ({ type: 'text', text: String(v) })) }]
      : undefined;

    result = await whatsappService.sendTemplate(to, templateName, 'en', components);
  } else {
    result = await whatsappService.sendText(to, message);
  }

  if (result.success) {
    res.json({ success: true, messageId: result.messageId });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
}));

// ============================================
// MENU / BUTTONS
// ============================================

const menuSchema = z.object({
  to: z.string().min(10),
  header: z.string().optional(),
  body: z.string().min(1).max(1024),
  buttons: z.array(z.object({
    title: z.string().max(25),
    id: z.string().max(48),
  })).min(1).max(3),
});

/**
 * POST /api/whatsapp/menu
 * Send an interactive menu with buttons
 */
router.post('/menu', asyncHandler(async (req: Request, res: Response) => {
  const { to, header, body, buttons } = menuSchema.parse(req.body);

  const result = await whatsappService.sendButtons(
    to,
    body,
    buttons.map((btn, i) => ({
      type: 'reply',
      title: btn.title,
      id: btn.id || `btn_${i}`,
    })),
    header
  );

  if (result.success) {
    res.json({ success: true, messageId: result.messageId });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
}));

// ============================================
// LIST MESSAGE
// ============================================

const listSchema = z.object({
  to: z.string().min(10),
  header: z.string().max(60),
  body: z.string().min(1).max(1024),
  footer: z.string().max(72).optional(),
  buttonTitle: z.string().max(20).default('Menu'),
  sections: z.array(z.object({
    title: z.string().max(24),
    rows: z.array(z.object({
      id: z.string().max(200),
      title: z.string().max(24),
      description: z.string().max(72).optional(),
    })).min(1).max(10,
    ),
  })).min(1).max(10,
  ),
});

/**
 * POST /api/whatsapp/list
 * Send an interactive list message
 */
router.post('/list', asyncHandler(async (req: Request, res: Response) => {
  const { to, header, body, footer, buttonTitle, sections } = listSchema.parse(req.body);

  const result = await whatsappService.sendList(
    to,
    header,
    body,
    footer || '',
    buttonTitle,
    sections
  );

  if (result.success) {
    res.json({ success: true, messageId: result.messageId });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
}));

// ============================================
// TEMPLATES
// ============================================

/**
 * GET /api/whatsapp/templates
 * Get available message templates
 */
router.get('/templates', asyncHandler(async (req: Request, res: Response) => {
  const templates = await whatsappService.getTemplates();
  res.json({ success: true, templates });
}));

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Process incoming WhatsApp message
 */
async function processIncomingMessage(message: {
  from: string;
  id: string;
  text: string;
  timestamp: string;
  type: string;
  name?: string;
}) {
  logger.info('[WhatsApp] Incoming message', {
    from: message.from,
    type: message.type,
    text: message.text.substring(0, 100),
  });

  // Mark message as read
  await whatsappService.markRead(message.id);

  // Find or create customer
  const customer = await customer360Service.findByPhone(message.from);
  const customerId = customer?.customerId || `wa_${message.from}`;

  // Handle different message types
  if (message.type === 'text') {
    await handleTextMessage(customerId, message);
  } else if (message.type === 'interactive') {
    await handleInteractiveMessage(customerId, message);
  }
}

/**
 * Handle text message
 */
async function handleTextMessage(customerId: string, message: { from: string; id: string; text: string; timestamp: string; name?: string }) {
  const text = message.text.toLowerCase().trim();

  // Quick replies menu
  if (text === 'menu' || text === 'help') {
    await sendMainMenu(message.from);
    return;
  }

  // Create support ticket for help requests
  if (text.includes('help') || text.includes('support') || text.includes('issue')) {
    await ticketService.createTicket({
      customerId,
      category: 'whatsapp_inquiry',
      priority: 'medium',
      message: message.text,
      source: 'whatsapp',
      metadata: {
        phone: message.from,
        customerName: message.name,
      },
    });

    await whatsappService.sendText(
      message.from,
      `Thanks for reaching out, ${message.name || 'there'}! I've created a support ticket for you. Our team will respond shortly.`
    );
    return;
  }

  // Default: acknowledge and offer menu
  await whatsappService.sendButtons(
    message.from,
    `Got your message! How can I help you today?`,
    [
      { type: 'reply', title: 'Track Order 📦' },
      { type: 'reply', title: 'Get Help ❓' },
      { type: 'reply', title: 'Talk to Agent 👤' },
    ]
  );
}

/**
 * Handle interactive button response
 */
async function handleInteractiveMessage(customerId: string, message: { from: string; id: string; text: string }) {
  const replyText = message.text?.toLowerCase() || '';

  if (replyText.includes('track order') || replyText.includes('order')) {
    await whatsappService.sendText(
      message.from,
      'To track your order, please provide your order ID (e.g., ORD-12345) or the phone number used for the order.'
    );
  } else if (replyText.includes('help')) {
    await sendMainMenu(message.from);
  } else if (replyText.includes('agent')) {
    await ticketService.createTicket({
      customerId,
      category: 'agent_request',
      priority: 'medium',
      message: 'Customer requested to speak with a human agent via WhatsApp',
      source: 'whatsapp',
    });

    await whatsappService.sendText(
      message.from,
      'I\'ve connected you with our support team. An agent will respond shortly!'
    );
  }
}

/**
 * Send main menu
 */
async function sendMainMenu(phoneNumber: string) {
  await whatsappService.sendList(
    phoneNumber,
    'REZ Support',
    'How can we help you today?',
    'Select an option below',
    'Main Menu',
    [
      {
        title: 'Orders',
        rows: [
          { id: 'track', title: 'Track Order', description: 'Check your order status' },
          { id: 'cancel', title: 'Cancel Order', description: 'Cancel a pending order' },
        ],
      },
      {
        title: 'Account',
        rows: [
          { id: 'wallet', title: 'Wallet Balance', description: 'Check your REZ Coins' },
          { id: 'profile', title: 'Update Profile', description: 'Change your details' },
        ],
      },
      {
        title: 'General',
        rows: [
          { id: 'faq', title: 'FAQ', description: 'Frequently asked questions' },
          { id: 'agent', title: 'Talk to Agent', description: 'Connect with support' },
        ],
      },
    ]
  );
}

/**
 * Process status update
 */
async function processStatusUpdate(status: { id: string; status: string; timestamp: string; recipientId: string }) {
  logger.info('[WhatsApp] Status update', {
    messageId: status.id,
    status: status.status,
    recipientId: status.recipientId,
  });

  // Update ticket or conversation based on status
  // Could trigger follow-ups on failed messages, etc.
  if (status.status === 'failed') {
    logger.warn('[WhatsApp] Message delivery failed', {
      messageId: status.id,
      recipientId: status.recipientId,
    });
  }
}

export default router;
