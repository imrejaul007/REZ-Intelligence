/**
 * REZ Care - WhatsApp Routes
 *
 * Handles WhatsApp Business API webhook and messaging endpoints.
 * Implements full integration with support services, AI, and RABTUL platform.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { whatsappService, WhatsAppWebhook } from '../services/whatsappService';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../middleware/errorHandler';
import { getAIIntegration } from '../services/aiIntegrationService';

// ============================================
// SERVICE CONFIGURATION
// ============================================

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token';
const SUPPORT_DASHBOARD_URL = process.env.SUPPORT_DASHBOARD_URL || 'https://rez-support-dashboard.onrender.com';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || process.env.REZ_ORDER_SERVICE_URL || 'http://localhost:4006';
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service-36vo.onrender.com';
const PROFILE_SERVICE_URL = process.env.PROFILE_SERVICE_URL || 'http://localhost:4013';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATIONS_SERVICE_URL || 'https://rez-notifications-service.onrender.com';

// Initialize AI integration
const aiIntegration = getAIIntegration();

// ============================================
// TYPES
// ============================================

interface WhatsAppTicket {
  ticketNumber: string;
  customerId: string;
  phoneNumber: string;
  source: 'whatsapp';
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  subject: string;
  description: string;
  messages: WhatsAppTicketMessage[];
  createdAt: Date;
  updatedAt: Date;
  metadata: {
    whatsappMessageId?: string;
    customerName?: string;
    userId?: string;
  };
}

interface WhatsAppTicketMessage {
  sender: 'customer' | 'agent' | 'system';
  senderType: 'user' | 'bot' | 'agent';
  message: string;
  timestamp: Date;
  isRead: boolean;
  whatsappMessageId?: string;
}

interface OrderInfo {
  orderId: string;
  status: string;
  estimatedDelivery?: string;
  items?: string[];
  total?: number;
}

interface CustomerInfo {
  customerId: string;
  name?: string;
  email?: string;
  totalOrders: number;
  lifetimeValue: number;
  karmaPoints: number;
}

const router = Router();

// ============================================
// RATE LIMITING
// ============================================

// General API rate limiter - 100 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiter for sending messages - 60 requests per 15 minutes (prevent abuse)
const sendMessageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // Limit each IP to 60 message sends per window
  message: { success: false, error: 'Rate limit exceeded for message sending. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes (webhook endpoints are excluded for WhatsApp compatibility)
router.use('/send', sendMessageLimiter);
router.use('/menu', sendMessageLimiter);
router.use('/list', sendMessageLimiter);
router.use('/templates', apiLimiter);

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
  templateParams: z.record(z.string(), z.string()).optional(),
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
    })).min(1).max(10),
  })).min(1).max(10),
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

  // Generate customer ID from WhatsApp number
  const customerId = `wa_${message.from}`;

  // Handle different message types
  if (message.type === 'text') {
    await handleTextMessage(customerId, message);
  } else if (message.type === 'interactive') {
    await handleInteractiveMessage(customerId, message);
  }
}

/**
 * Handle text message with full ticket service integration
 */
async function handleTextMessage(customerId: string, message: { from: string; id: string; text: string; timestamp: string; name?: string }) {
  const text = message.text.toLowerCase().trim();
  const aiAnalysis = await analyzeCustomerMessage(message.text);

  // Quick replies menu
  if (text === 'menu' || text === 'help') {
    await sendMainMenu(message.from);
    return;
  }

  // Create support ticket for help requests - INTEGRATED WITH TICKET SERVICE
  if (text.includes('help') || text.includes('support') || text.includes('issue') || text.includes('problem')) {
    await createSupportTicketFromWhatsApp(
      message.from,
      message.name,
      message.text,
      aiAnalysis,
      message.id
    );
    return;
  }

  // Handle order tracking requests
  if (text.includes('track') || text.includes('order status') || text.includes('where is my order')) {
    await handleOrderTrackingRequest(message.from, message.text, aiAnalysis);
    return;
  }

  // Handle cancel requests
  if (text.includes('cancel')) {
    await handleCancelRequest(message.from, message.text, aiAnalysis);
    return;
  }

  // Handle wallet/balance requests
  if (text.includes('balance') || text.includes('coins') || text.includes('wallet')) {
    await handleWalletRequest(message.from, message.name);
    return;
  }

  // Handle escalation request
  if (text.includes('agent') || text.includes('representative') || text.includes('human')) {
    await handleAgentRequest(message.from, message.name, message.text, aiAnalysis);
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
 * Analyze customer message using AI integration
 */
async function analyzeCustomerMessage(messageText: string): Promise<{
  sentiment: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}> {
  try {
    const aiResult = await aiIntegration.analyzeSentiment(messageText);

    if (aiResult) {
      // Determine category from keywords
      let category = 'general';
      const lower = messageText.toLowerCase();

      if (lower.includes('order') || lower.includes('delivery') || lower.includes('track')) {
        category = 'order';
      } else if (lower.includes('payment') || lower.includes('refund') || lower.includes('money')) {
        category = 'payment';
      } else if (lower.includes('account') || lower.includes('login') || lower.includes('password')) {
        category = 'account';
      } else if (lower.includes('cancel')) {
        category = 'cancellation';
      }

      // Determine priority from sentiment
      let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
      if (aiResult.sentiment === 'critical_negative') {
        priority = 'urgent';
      } else if (aiResult.sentiment === 'negative') {
        priority = 'high';
      }

      return {
        sentiment: aiResult.sentiment,
        category,
        priority
      };
    }
  } catch (error) {
    logger.warn('[WhatsApp] AI analysis failed, using keyword-based fallback');
  }

  // Fallback keyword-based analysis
  return analyzeFallback(messageText);
}

/**
 * Fallback sentiment analysis when AI is unavailable
 */
function analyzeFallback(messageText: string): {
  sentiment: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
} {
  const lower = messageText.toLowerCase();

  let sentiment = 'neutral';
  if (lower.includes('terrible') || lower.includes('worst') || lower.includes('angry') || lower.includes('hate')) {
    sentiment = 'critical_negative';
  } else if (lower.includes('frustrated') || lower.includes('unacceptable') || lower.includes('disappointed')) {
    sentiment = 'negative';
  } else if (lower.includes('thank') || lower.includes('great') || lower.includes('love')) {
    sentiment = 'positive';
  }

  let category = 'general';
  if (lower.includes('order') || lower.includes('delivery')) category = 'order';
  else if (lower.includes('payment') || lower.includes('refund')) category = 'payment';
  else if (lower.includes('account') || lower.includes('login')) category = 'account';
  else if (lower.includes('cancel')) category = 'cancellation';

  let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
  if (sentiment === 'critical_negative') priority = 'urgent';
  else if (sentiment === 'negative') priority = 'high';

  return { sentiment, category, priority };
}

/**
 * Create support ticket via Support Dashboard API - FULLY INTEGRATED
 */
async function createSupportTicketFromWhatsApp(
  phoneNumber: string,
  customerName: string | undefined,
  message: string,
  analysis: { sentiment: string; category: string; priority: 'low' | 'medium' | 'high' | 'urgent' },
  whatsappMessageId: string
): Promise<{ success: boolean; ticketNumber?: string; error?: string }> {
  const ticketNumber = `TKT-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`;

  // First try to identify customer via phone number
  let customerId = `wa_${phoneNumber}`;
  let userId: string | undefined;

  try {
    // Look up user by phone number via Profile service
    const profileResponse = await axios.get(
      `${PROFILE_SERVICE_URL}/api/profiles/phone/${encodeURIComponent(phoneNumber)}`,
      {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
        timeout: 5000
      }
    );

    if (profileResponse.data?.userId) {
      userId = profileResponse.data.userId;
      customerId = profileResponse.data.userId;
    }
  } catch (error) {
    logger.info('[WhatsApp] Customer not found in profile service, using WhatsApp ID');
  }

  // Create ticket in Support Dashboard
  const ticketPayload = {
    sourceService: 'whatsapp',
    ticketNumber,
    source: 'whatsapp',
    platform: 'consumer',
    customerId,
    phoneNumber,
    customerName: customerName || 'WhatsApp User',
    category: analysis.category,
    priority: analysis.priority,
    status: 'open',
    subject: `WhatsApp Support Request: ${analysis.category}`,
    description: message,
    messages: [{
      sender: customerId,
      senderType: 'user',
      senderChannel: 'whatsapp',
      message,
      timestamp: new Date().toISOString(),
      isRead: true,
      whatsappMessageId
    }],
    tags: ['whatsapp', analysis.category, analysis.sentiment],
    aiAnalysis: {
      sentiment: analysis.sentiment,
      priority: analysis.priority,
      category: analysis.category
    },
    metadata: {
      whatsappMessageId,
      customerName,
      userId,
      channel: 'whatsapp'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    // Create ticket in Support Dashboard
    await axios.post(
      `${SUPPORT_DASHBOARD_URL}/api/tickets`,
      ticketPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': INTERNAL_TOKEN
        },
        timeout: 10000
      }
    );

    logger.info('[WhatsApp] Support ticket created', { ticketNumber, phoneNumber, category: analysis.category });

    // Send confirmation to customer
    const confirmationMessage = customerName
      ? `Thanks for reaching out, ${customerName}! Your support request has been registered.\n\nTicket Number: ${ticketNumber}\n\nOur support team will respond shortly. You can also call us at +91 98765 43210.`
      : `Thanks for reaching out! Your support request has been registered.\n\nTicket Number: ${ticketNumber}\n\nOur support team will respond shortly. You can also call us at +91 98765 43210.`;

    await whatsappService.sendText(phoneNumber, confirmationMessage);

    // If urgent, notify support team
    if (analysis.priority === 'urgent') {
      await notifySupportTeam(ticketNumber, phoneNumber, message, 'urgent');
    }

    return { success: true, ticketNumber };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to create ticket';
    logger.error('[WhatsApp] Failed to create support ticket', { error: errorMsg, phoneNumber });

    // Still acknowledge customer but inform about delay
    await whatsappService.sendText(
      phoneNumber,
      `Thanks for reaching out! Our support team is experiencing high volume. Please call us at +91 98765 43210 for immediate assistance, or wait for a callback within 30 minutes.`
    );

    return { success: false, error: errorMsg };
  }
}

/**
 * Notify support team about new ticket
 */
async function notifySupportTeam(ticketNumber: string, phoneNumber: string, message: string, priority: string): Promise<void> {
  try {
    await axios.post(
      `${NOTIFICATION_SERVICE_URL}/api/notifications/send`,
      {
        userId: 'support-team',
        type: 'new_ticket',
        channel: 'slack',
        title: `New WhatsApp Ticket: ${priority.toUpperCase()}`,
        body: `Ticket: ${ticketNumber}\nPhone: ${phoneNumber}\nMessage: ${message.substring(0, 200)}`
      },
      {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
        timeout: 5000
      }
    );
  } catch (error) {
    logger.warn('[WhatsApp] Failed to notify support team', { error });
  }
}

/**
 * Handle order tracking request - INTEGRATED WITH ORDER SERVICE
 */
async function handleOrderTrackingRequest(phoneNumber: string, message: string, analysis: { sentiment: string; category: string; priority: 'low' | 'medium' | 'high' | 'urgent' }): Promise<void> {
  // Extract order ID from message (pattern: ORD-XXXXX or order ID in message)
  const orderIdMatch = message.match(/ORD[-\s]?\w+/i) || message.match(/order[:\s]+(\w+)/i);

  if (orderIdMatch) {
    const orderId = orderIdMatch[0].replace(/[-\s]/g, '').toUpperCase();

    try {
      // Get order details from Order Service
      const orderResponse = await axios.get(
        `${ORDER_SERVICE_URL}/api/orders/${orderId}`,
        {
          headers: { 'X-Internal-Token': INTERNAL_TOKEN },
          timeout: 5000
        }
      );

      const order: OrderInfo = orderResponse.data;

      if (order) {
        const statusEmoji = getStatusEmoji(order.status);
        let response = `${statusEmoji} Order ${order.orderId || orderId}\n`;
        response += `Status: ${formatOrderStatus(order.status)}\n`;

        if (order.estimatedDelivery) {
          response += `Estimated: ${order.estimatedDelivery}\n`;
        }

        if (order.items && order.items.length > 0) {
          response += `Items: ${order.items.slice(0, 3).join(', ')}${order.items.length > 3 ? ` +${order.items.length - 3} more` : ''}`;
        }

        await whatsappService.sendText(phoneNumber, response);
        return;
      }
    } catch (error) {
      logger.info('[WhatsApp] Order not found', { orderId, error });
    }

    // Order not found
    await whatsappService.sendText(
      phoneNumber,
      `I couldn't find order ${orderId}. Please check the order ID and try again, or provide more details.`
    );
  } else {
    // No order ID found, ask for it
    await whatsappService.sendText(
      phoneNumber,
      `To track your order, please provide your order ID (e.g., ORD-12345) or the phone number used for the order.`
    );
  }
}

/**
 * Get emoji for order status
 */
function getStatusEmoji(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': '⏳',
    'confirmed': '✅',
    'processing': '📦',
    'shipped': '🚚',
    'out_for_delivery': '🏃',
    'delivered': '🎉',
    'cancelled': '❌',
    'refunded': '💰'
  };
  return statusMap[status.toLowerCase()] || '📋';
}

/**
 * Format order status for display
 */
function formatOrderStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'Order Pending',
    'confirmed': 'Order Confirmed',
    'processing': 'Processing',
    'shipped': 'Shipped',
    'out_for_delivery': 'Out for Delivery',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled',
    'refunded': 'Refunded'
  };
  return statusMap[status.toLowerCase()] || status;
}

/**
 * Handle cancel request
 */
async function handleCancelRequest(phoneNumber: string, message: string, analysis: { sentiment: string; category: string; priority: 'low' | 'medium' | 'high' | 'urgent' }): Promise<void> {
  const orderIdMatch = message.match(/ORD[-\s]?\w+/i);

  if (orderIdMatch) {
    const orderId = orderIdMatch[0].replace(/[-\s]/g, '').toUpperCase();

    try {
      // Check order status via Order Service
      const orderResponse = await axios.get(
        `${ORDER_SERVICE_URL}/api/orders/${orderId}`,
        {
          headers: { 'X-Internal-Token': INTERNAL_TOKEN },
          timeout: 5000
        }
      );

      const order = orderResponse.data;

      if (order) {
        // Check if order can be cancelled
        const cancellableStatuses = ['pending', 'confirmed', 'processing'];
        if (cancellableStatuses.includes(order.status?.toLowerCase())) {
          await whatsappService.sendButtons(
            phoneNumber,
            `Your order ${orderId} can be cancelled. Would you like to proceed?`,
            [
              { type: 'reply', title: 'Yes, Cancel It' },
              { type: 'reply', title: 'Keep Order' }
            ]
          );
        } else {
          await whatsappService.sendText(
            phoneNumber,
            `Unfortunately, order ${orderId} cannot be cancelled as it's already ${formatOrderStatus(order.status)}. Please contact support for assistance.`
          );
        }
        return;
      }
    } catch (error) {
      logger.info('[WhatsApp] Order check failed for cancellation', { orderId });
    }
  }

  // Create cancellation ticket
  await createSupportTicketFromWhatsApp(
    phoneNumber,
    undefined,
    `Cancellation Request: ${message}`,
    { ...analysis, category: 'cancellation' },
    ''
  );
}

/**
 * Handle wallet balance request - INTEGRATED WITH WALLET SERVICE
 */
async function handleWalletRequest(phoneNumber: string, customerName: string | undefined): Promise<void> {
  // First try to identify customer
  let customerId = `wa_${phoneNumber}`;

  try {
    const profileResponse = await axios.get(
      `${PROFILE_SERVICE_URL}/api/profiles/phone/${encodeURIComponent(phoneNumber)}`,
      {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
        timeout: 5000
      }
    );

    if (profileResponse.data?.userId) {
      customerId = profileResponse.data.userId;
    }
  } catch {
    logger.info('[WhatsApp] Customer not found for wallet request');
  }

  try {
    // Get wallet balance from Wallet Service
    const walletResponse = await axios.get(
      `${WALLET_SERVICE_URL}/api/wallet/${customerId}/balance`,
      {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
        timeout: 5000
      }
    );

    const balance = walletResponse.data?.balance || 0;
    const greeting = customerName ? `Hi ${customerName}!` : 'Hi there!';

    await whatsappService.sendText(
      phoneNumber,
      `${greeting}\n\nYour REZ Wallet Balance: ₹${balance.toFixed(2)}\n\nYou can earn more coins by shopping on REZ!`
    );
  } catch (error) {
    logger.error('[WhatsApp] Wallet balance fetch failed', { customerId, error });

    await whatsappService.sendText(
      phoneNumber,
      `I couldn't fetch your wallet balance right now. Please try again later or call +91 98765 43210 for assistance.`
    );
  }
}

/**
 * Handle request to talk to agent - CREATES TICKET WITH HIGH PRIORITY
 */
async function handleAgentRequest(phoneNumber: string, customerName: string | undefined, message: string, analysis: { sentiment: string; category: string; priority: 'low' | 'medium' | 'high' | 'urgent' }): Promise<void> {
  // Create high priority ticket for agent request
  const result = await createSupportTicketFromWhatsApp(
    phoneNumber,
    customerName,
    message || 'Customer requested to speak with an agent',
    { ...analysis, priority: 'high' },
    ''
  );

  if (result.success) {
    await whatsappService.sendText(
      phoneNumber,
      `I've connected you with our support team. An agent will respond shortly!\n\nYour ticket number: ${result.ticketNumber}\n\nFor immediate assistance, call: +91 98765 43210`
    );
  } else {
    await whatsappService.sendText(
      phoneNumber,
      `I'm connecting you with our support team. Please hold on for a moment. For immediate assistance, call: +91 98765 43210`
    );
  }
}

/**
 * Handle interactive button response - FULLY INTEGRATED WITH TICKET SERVICE
 */
async function handleInteractiveMessage(customerId: string, message: { from: string; id: string; text: string }) {
  const replyText = message.text?.toLowerCase() || '';

  // Track Order
  if (replyText.includes('track') || replyText.includes('order')) {
    await whatsappService.sendText(
      message.from,
      'To track your order, please provide your order ID (e.g., ORD-12345) or the phone number used for the order.'
    );
    return;
  }

  // Cancel Order
  if (replyText.includes('cancel')) {
    await whatsappService.sendText(
      message.from,
      'To cancel your order, please provide your order ID (e.g., ORD-12345). Our team will process the cancellation.'
    );
    return;
  }

  // Help/FAQ
  if (replyText.includes('faq') || replyText.includes('help')) {
    await sendFaqMenu(message.from);
    return;
  }

  // Agent Request - INTEGRATED WITH TICKET SERVICE
  if (replyText.includes('agent') || replyText.includes('talk')) {
    await handleAgentRequest(
      message.from,
      undefined,
      'Customer selected "Talk to Agent" from menu',
      { sentiment: 'neutral', category: 'general', priority: 'high' }
    );
    return;
  }

  // Wallet Balance - INTEGRATED WITH WALLET SERVICE
  if (replyText.includes('wallet') || replyText.includes('balance')) {
    await handleWalletRequest(message.from, undefined);
    return;
  }

  // Profile Update
  if (replyText.includes('profile')) {
    await whatsappService.sendText(
      message.from,
      'To update your profile, please visit the REZ app > Settings > Profile, or tell me what you\'d like to update (name, email, phone).'
    );
    return;
  }

  // Fallback
  await sendMainMenu(message.from);
}

/**
 * Send FAQ menu
 */
async function sendFaqMenu(phoneNumber: string): Promise<void> {
  await whatsappService.sendList(
    phoneNumber,
    'REZ Help',
    'What do you need help with?',
    'Select a topic',
    'FAQ Topics',
    [
      {
        title: 'Orders',
        rows: [
          { id: 'faq_order_track', title: 'How to track order?', description: 'Track your order status' },
          { id: 'faq_order_cancel', title: 'Cancel order', description: 'How to cancel an order' },
          { id: 'faq_order_return', title: 'Return/Refund', description: 'Return policy and refunds' },
        ],
      },
      {
        title: 'Payments',
        rows: [
          { id: 'faq_pay_method', title: 'Payment methods', description: 'Accepted payment options' },
          { id: 'faq_pay_wallet', title: 'Wallet & Coins', description: 'REZ Coins and wallet' },
          { id: 'faq_pay_offer', title: 'Offers & Cashback', description: 'Available offers' },
        ],
      },
      {
        title: 'Account',
        rows: [
          { id: 'faq_acc_login', title: 'Login issues', description: 'Cannot login' },
          { id: 'faq_acc_register', title: 'Create account', description: 'How to sign up' },
          { id: 'faq_acc_forgot', title: 'Forgot password', description: 'Reset your password' },
        ],
      },
    ]
  );
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
 * Process status update - Updates ticket messages and triggers follow-ups
 */
async function processStatusUpdate(status: { id: string; status: string; timestamp: string; recipientId: string }) {
  logger.info('[WhatsApp] Status update', {
    messageId: status.id,
    status: status.status,
    recipientId: status.recipientId,
  });

  const { id: messageId, status: messageStatus, recipientId } = status;

  // Handle message delivery failure
  if (messageStatus === 'failed') {
    logger.warn('[WhatsApp] Message delivery failed', {
      messageId,
      recipientId,
    });

    // Update ticket message status in Support Dashboard
    await updateTicketMessageStatus(messageId, 'failed').catch(err => {
      logger.error('[WhatsApp] Failed to update ticket message status', { error: err.message });
    });

    // Notify support team about delivery failure for important messages
    await notifyDeliveryFailure(recipientId, messageId).catch(err => {
      logger.error('[WhatsApp] Failed to notify delivery failure', { error: err.message });
    });
  }

  // Handle message delivered successfully
  if (messageStatus === 'delivered') {
    logger.debug('[WhatsApp] Message delivered', {
      messageId,
      recipientId,
    });

    // Update ticket message status
    await updateTicketMessageStatus(messageId, 'delivered').catch(() => {
      // Silently ignore - not critical
    });
  }

  // Handle message read by customer
  if (messageStatus === 'read') {
    logger.debug('[WhatsApp] Message read', {
      messageId,
      recipientId,
    });

    // Update ticket message status
    await updateTicketMessageStatus(messageId, 'read').catch(() => {
      // Silently ignore - not critical
    });
  }
}

/**
 * Update ticket message status in Support Dashboard
 */
async function updateTicketMessageStatus(
  whatsappMessageId: string,
  status: 'sent' | 'delivered' | 'read' | 'failed'
): Promise<void> {
  try {
    await axios.patch(
      `${SUPPORT_DASHBOARD_URL}/api/tickets/messages/${encodeURIComponent(whatsappMessageId)}`,
      {
        whatsappStatus: status,
        updatedAt: new Date().toISOString()
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': INTERNAL_TOKEN
        },
        timeout: 5000
      }
    );
    logger.info('[WhatsApp] Ticket message status updated', { whatsappMessageId, status });
  } catch (error) {
    // Don't throw - this is non-critical
    logger.debug('[WhatsApp] Could not update ticket message status', { whatsappMessageId });
  }
}

/**
 * Notify support team about message delivery failure
 */
async function notifyDeliveryFailure(phoneNumber: string, messageId: string): Promise<void> {
  try {
    // Look up customer info
    let customerInfo: CustomerInfo | null = null;
    try {
      const profileResponse = await axios.get(
        `${PROFILE_SERVICE_URL}/api/profiles/phone/${encodeURIComponent(phoneNumber)}`,
        {
          headers: { 'X-Internal-Token': INTERNAL_TOKEN },
          timeout: 3000
        }
      );
      if (profileResponse.data) {
        customerInfo = profileResponse.data;
      }
    } catch {
      // Customer not found in profile
    }

    const customerDesc = customerInfo
      ? `${customerInfo.name || 'Unknown'} (${phoneNumber})`
      : phoneNumber;

    await axios.post(
      `${NOTIFICATION_SERVICE_URL}/api/notifications/send`,
      {
        userId: 'support-team',
        type: 'whatsapp_delivery_failed',
        channel: 'slack',
        priority: 'high',
        title: 'WhatsApp Message Delivery Failed',
        body: `Customer: ${customerDesc}\nMessage ID: ${messageId}\nCustomer may not receive notifications.`,
        data: {
          phoneNumber,
          messageId,
          customerId: customerInfo?.customerId
        }
      },
      {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
        timeout: 5000
      }
    );
  } catch {
    // Silently fail - not critical
  }
}

export default router;
