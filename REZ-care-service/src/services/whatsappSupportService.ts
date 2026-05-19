/**
 * REZ Care Service - WhatsApp Support Integration
 *
 * Handles WhatsApp conversations for customer support.
 * Connects to WhatsApp Business API via existing bridge.
 */

import mongoose, { Schema } from 'mongoose';
import axios from 'axios';
import { logger } from '../utils/logger';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-care';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token';
const WHATSAPP_BRIDGE_URL = process.env.WHATSAPP_BRIDGE_URL || 'http://localhost:4010';

// WhatsApp Conversation Schema
const WhatsAppConversationSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, unique: true, index: true },
  customerId: { type: String, required: true, index: true },
  customerPhone: { type: String, required: true },
  platform: {
    type: String,
    enum: ['hotel', 'restaurant', 'retail', 'delivery', 'ecommerce', 'other'],
    default: 'other'
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'waiting', 'assigned', 'resolved', 'closed'],
    default: 'active'
  },

  // Agent assignment
  assignedAgent: {
    agentId: String,
    agentName: String,
    assignedAt: Date
  },

  // Messages
  messages: [{
    messageId: String,
    direction: { type: String, enum: ['inbound', 'outbound'] },
    content: String,
    timestamp: Date,
    type: { type: String, enum: ['text', 'image', 'document', 'location', 'quick_reply'] },
    status: { type: String, enum: ['sent', 'delivered', 'read', 'failed'] },
    metadata: mongoose.Schema.Types.Mixed
  }],

  // Context
  context: {
    orderId: String,
    bookingId: String,
    ticketId: String,
    issueDescription: String,
    priority: String
  },

  // AI handling
  aiHandled: { type: Boolean, default: false },
  aiSummary: String,

  // Timestamps
  startedAt: { type: Date, default: Date.now },
  lastMessageAt: Date,
  resolvedAt: Date,
  closedAt: Date

}, { timestamps: true });

WhatsAppConversationSchema.index({ customerId: 1, status: 1 });
WhatsAppConversationSchema.index({ assignedAgent: 1, status: 1 });
WhatsAppConversationSchema.index({ status: 1, startedAt: -1 });

const WhatsAppConversation = mongoose.model('WhatsAppConversation', WhatsAppConversationSchema);

// Quick Reply Template Schema
const QuickReplyTemplateSchema = new mongoose.Schema({
  templateId: { type: String, required: true, unique: true },
  name: String,
  category: String,
  platform: String,

  buttons: [{
    title: String,
    payload: String,
    type: { type: String, enum: ['quick_reply', 'url'] }
  }],

  active: { type: Boolean, default: true }
});

const QuickReplyTemplate = mongoose.model('QuickReplyTemplate', QuickReplyTemplateSchema);

export class WhatsAppSupportService {
  private connected: boolean = false;

  async connect(): Promise<void> {
    if (!this.connected) {
      await mongoose.connect(MONGODB_URI);
      this.connected = true;
      logger.info('WhatsApp Support connected to MongoDB');
    }
  }

  // ============================================
  // INBOUND MESSAGE HANDLING
  // ============================================

  /**
   * Handle incoming WhatsApp message
   */
  async handleInboundMessage(message: {
    from: string;
    messageId: string;
    content: string;
    type: string;
    timestamp: string;
    context?: {
      orderId?: string;
      bookingId?: string;
    };
  }): Promise<{
    shouldRespond: boolean;
    response?: string;
    quickReplies?: any[];
    action?: string;
  }> {
    await this.connect();

    const phone = message.from.replace('91', ''); // Remove country code for storage
    const conversationId = `WA-${phone}-${new Date().toISOString().split('T')[0]}`;

    // Find or create conversation
    let conversation = await WhatsAppConversation.findOne({
      customerPhone: { $regex: phone },
      status: { $in: ['active', 'waiting', 'assigned'] }
    }).sort({ startedAt: -1 });

    if (!conversation) {
      conversation = new WhatsAppConversation({
        conversationId,
        customerId: phone,
        customerPhone: phone,
        status: 'active',
        context: {
          orderId: message.context?.orderId,
          bookingId: message.context?.bookingId
        }
      });
      await conversation.save();
    }

    // Add message to conversation
    conversation.messages.push({
      messageId: message.messageId,
      direction: 'inbound',
      content: message.content,
      timestamp: new Date(message.timestamp),
      type: message.type as any,
      status: 'delivered'
    });
    conversation.lastMessageAt = new Date();
    await conversation.save();

    // Analyze intent and respond
    return await this.generateResponse(conversation, message.content);
  }

  /**
   * Generate AI response for WhatsApp message
   */
  private async generateResponse(conversation: any, message: string): Promise<{
    shouldRespond: boolean;
    response?: string;
    quickReplies?: any[];
    action?: string;
  }> {
    const lowerMessage = message.toLowerCase();

    // Intent detection
    if (lowerMessage.includes('order') && (lowerMessage.includes('issue') || lowerMessage.includes('problem'))) {
      return {
        shouldRespond: true,
        response: "I understand you're having an issue with your order. Let me help you right away. Can you tell me:\n1. What was the issue?\n2. Your order number (if known)",
        action: 'create_order_ticket',
        quickReplies: [
          { title: 'Wrong item', payload: 'issue_wrong_item' },
          { title: 'Late delivery', payload: 'issue_late_delivery' },
          { title: 'Quality issue', payload: 'issue_quality' }
        ]
      };
    }

    if (lowerMessage.includes('refund')) {
      return {
        shouldRespond: true,
        response: "I can help you with a refund. Your request has been noted and our team will process it within 24 hours. You'll receive a confirmation SMS.",
        action: 'create_refund_ticket'
      };
    }

    if (lowerMessage.includes('booking') && lowerMessage.includes('cancel')) {
      return {
        shouldRespond: true,
        response: "I can help you cancel your booking. Please confirm:\n1. Booking reference number\n2. Reason for cancellation",
        action: 'create_booking_ticket',
        quickReplies: [
          { title: 'Change dates', payload: 'booking_change' },
          { title: 'Cancel booking', payload: 'booking_cancel' }
        ]
      };
    }

    if (lowerMessage.includes('payment') && (lowerMessage.includes('fail') || lowerMessage.includes('issue'))) {
      return {
        shouldRespond: true,
        response: "I'm sorry you're facing a payment issue. Let me connect you with our payments team. Please share your order number.",
        action: 'create_payment_ticket'
      };
    }

    // Check if customer needs human
    if (lowerMessage.includes('speak') || lowerMessage.includes('agent') || lowerMessage.includes('human')) {
      return {
        shouldRespond: true,
        response: "I'll connect you with a support agent right away. Please hold for a moment.",
        action: 'escalate_to_agent'
      };
    }

    // Greeting
    if (lowerMessage.match(/^(hi|hello|hey|help)/)) {
      return {
        shouldRespond: true,
        response: "Hi! 👋 I'm your REZ support assistant. How can I help you today?\n\nI can help with:\n• Order issues\n• Payment problems\n• Booking changes\n• Refunds\n• General queries",
        quickReplies: [
          { title: 'Order Issue', payload: 'order_issue' },
          { title: 'Payment Help', payload: 'payment_help' },
          { title: 'Refund Status', payload: 'refund_status' },
          { title: 'Talk to Agent', payload: 'escalate' }
        ]
      };
    }

    // Default
    return {
      shouldRespond: false
    };
  }

  // ============================================
  // OUTBOUND MESSAGE SENDING
  // ============================================

  /**
   * Send message to customer via WhatsApp bridge
   */
  async sendMessage(params: {
    phone: string;
    message: string;
    quickReplies?: { title: string; payload: string }[];
    type?: 'text' | 'image' | 'document';
  }): Promise<boolean> {
    try {
      await axios.post(`${WHATSAPP_BRIDGE_URL}/api/send`, {
        to: `91${params.phone}`, // Add country code
        type: params.type || 'text',
        content: params.message,
        quickReplies: params.quickReplies
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': INTERNAL_TOKEN
        },
        timeout: 10000
      });

      return true;
    } catch (error) {
      logger.error('Failed to send WhatsApp message', error);
      return false;
    }
  }

  /**
   * Send template message
   */
  async sendTemplate(params: {
    phone: string;
    templateId: string;
    variables?: Record<string, string>;
  }): Promise<boolean> {
    try {
      await axios.post(`${WHATSAPP_BRIDGE_URL}/api/templates/send`, {
        to: `91${params.phone}`,
        templateId: params.templateId,
        variables: params.variables
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': INTERNAL_TOKEN
        },
        timeout: 10000
      });

      return true;
    } catch (error) {
      logger.error('Failed to send template', error);
      return false;
    }
  }

  // ============================================
  // CONVERSATION MANAGEMENT
  // ============================================

  /**
   * Assign conversation to agent
   */
  async assignToAgent(conversationId: string, agentId: string, agentName: string): Promise<void> {
    await this.connect();

    await WhatsAppConversation.findOneAndUpdate(
      { conversationId },
      {
        status: 'assigned',
        assignedAgent: {
          agentId,
          agentName,
          assignedAt: new Date()
        }
      }
    );
  }

  /**
   * Resolve conversation
   */
  async resolveConversation(conversationId: string, resolution: string): Promise<void> {
    await this.connect();

    await WhatsAppConversation.findOneAndUpdate(
      { conversationId },
      {
        status: 'resolved',
        resolvedAt: new Date(),
        'context.issueDescription': resolution
      }
    );

    // Send closing message
    const conversation = await WhatsAppConversation.findOne({ conversationId });
    if (conversation) {
      await this.sendMessage({
        phone: conversation.customerPhone,
        message: `Your issue has been resolved. ${resolution}\n\nThank you for reaching out! If you need more help, just send "Hi" again. 😊`
      });
    }
  }

  /**
   * Get agent's conversations
   */
  async getAgentConversations(agentId: string): Promise<any[]> {
    await this.connect();

    return WhatsAppConversation.find({
      'assignedAgent.agentId': agentId,
      status: { $in: ['assigned', 'active'] }
    }).sort({ lastMessageAt: -1 });
  }

  /**
   * Get waiting conversations (unassigned)
   */
  async getWaitingConversations(): Promise<any[]> {
    await this.connect();

    return WhatsAppConversation.find({
      status: 'waiting',
      assignedAgent: { $exists: false }
    }).sort({ startedAt: 1 });
  }

  /**
   * Get conversation by phone
   */
  async getConversationByPhone(phone: string): Promise<any | null> {
    await this.connect();

    return WhatsAppConversation.findOne({
      customerPhone: { $regex: phone }
    }).sort({ startedAt: -1 });
  }

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * Get WhatsApp support metrics
   */
  async getMetrics(): Promise<{
    totalConversations: number;
    activeConversations: number;
    avgResponseTime: number;
    resolutionRate: number;
    aiHandledRate: number;
  }> {
    await this.connect();

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [total, active, resolved, aiHandled] = await Promise.all([
      WhatsAppConversation.countDocuments({ startedAt: { $gte: yesterday } }),
      WhatsAppConversation.countDocuments({ status: 'active', startedAt: { $gte: yesterday } }),
      WhatsAppConversation.countDocuments({ status: 'resolved', resolvedAt: { $gte: yesterday } }),
      WhatsAppConversation.countDocuments({ aiHandled: true, startedAt: { $gte: yesterday } })
    ]);

    return {
      totalConversations: total,
      activeConversations: active,
      avgResponseTime: 5, // Would calculate from actual data
      resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
      aiHandledRate: total > 0 ? Math.round((aiHandled / total) * 100) : 0
    };
  }

  // ============================================
  // QUICK REPLY TEMPLATES
  // ============================================

  /**
   * Initialize default templates
   */
  async initializeTemplates(): Promise<void> {
    await this.connect();

    const defaultTemplates = [
      {
        templateId: 'greeting',
        name: 'Welcome Greeting',
        category: 'onboarding',
        platform: 'all',
        buttons: [
          { title: 'Order Help', payload: 'order_issue', type: 'quick_reply' },
          { title: 'Payment Help', payload: 'payment_help', type: 'quick_reply' },
          { title: 'Talk to Agent', payload: 'escalate', type: 'quick_reply' }
        ]
      },
      {
        templateId: 'order_issue_menu',
        name: 'Order Issue Menu',
        category: 'support',
        platform: 'restaurant',
        buttons: [
          { title: 'Wrong Item', payload: 'issue_wrong_item', type: 'quick_reply' },
          { title: 'Late Delivery', payload: 'issue_late_delivery', type: 'quick_reply' },
          { title: 'Quality Issue', payload: 'issue_quality', type: 'quick_reply' }
        ]
      },
      {
        templateId: 'booking_menu',
        name: 'Booking Menu',
        category: 'support',
        platform: 'hotel',
        buttons: [
          { title: 'Change Dates', payload: 'booking_change', type: 'quick_reply' },
          { title: 'Cancel', payload: 'booking_cancel', type: 'quick_reply' },
          { title: 'Issue', payload: 'booking_issue', type: 'quick_reply' }
        ]
      }
    ];

    for (const template of defaultTemplates) {
      await QuickReplyTemplate.findOneAndUpdate(
        { templateId: template.templateId },
        template,
        { upsert: true }
      );
    }

    logger.info('WhatsApp templates initialized');
  }
}
