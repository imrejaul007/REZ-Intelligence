import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { refundService } from './refundService';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf((info: winston.Logform.TransformableInfo) => {
  const { level, message, timestamp, ...metadata } = info;
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0 && metadata.stack === undefined) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  if (metadata.stack) {
    msg += `\n${metadata.stack}`;
  }
  return msg;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat)
    }),
    new winston.transports.File({
      filename: 'logs/support-agent-error.log',
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/support-agent.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  PENDING_CUSTOMER = 'pending_customer',
  PENDING_INTERNAL = 'pending_internal',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  ESCALATED = 'escalated'
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
  CRITICAL = 'critical'
}

export enum TicketCategory {
  BILLING = 'billing',
  TECHNICAL = 'technical',
  BOOKING = 'booking',
  REFUND = 'refund',
  GENERAL = 'general',
  COMPLAINT = 'complaint',
  FEATURE_REQUEST = 'feature_request'
}

export enum TicketSource {
  CHAT = 'chat',
  EMAIL = 'email',
  PHONE = 'phone',
  MOBILE_APP = 'mobile_app',
  WEB_PORTAL = 'web_portal',
  SOCIAL_MEDIA = 'social_media'
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  tier: 'basic' | 'premium' | 'enterprise';
  accountAge: number;
  totalSpent: number;
  totalTickets: number;
  satisfactionScore: number;
}

export interface Ticket {
  id: string;
  displayId: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  source: TicketSource;
  customerId: string;
  customerName: string;
  customerEmail: string;
  assignedTo: string | null;
  assignedTeam: string | null;
  tags: string[];
  orderId: string | null;
  relatedTickets: string[];
  messages: TicketMessage[];
  resolution: TicketResolution | null;
  metadata: Record<string, unknown>;
  slaDeadline: Date | null;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorType: 'customer' | 'agent' | 'system' | 'bot';
  content: string;
  attachments: Attachment[];
  isInternal: boolean;
  createdAt: Date;
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface TicketResolution {
  type: 'resolved' | 'workaround_provided' | 'escalated' | 'refunded' | 'rejected';
  summary: string;
  resolvedBy: string;
  customerSatisfied: boolean | null;
  resolvedAt: Date;
}

export interface SupportContext {
  customer: Customer | null;
  ticketId: string | null;
  conversationHistory: string[];
  relatedOrders: string[];
  previousTickets: string[];
}

export class SupportAgent {
  private readonly agentId: string;
  private readonly agentName: string;
  private tickets: Map<string, Ticket>;
  private ticketCounter: number;

  constructor(agentId?: string, agentName?: string) {
    this.agentId = agentId || uuidv4();
    this.agentName = agentName || 'Support Agent';
    this.tickets = new Map();
    this.ticketCounter = 1000;
    logger.info('Support Agent initialized', { agentId: this.agentId, agentName: this.agentName });
  }

  async processCustomerMessage(
    context: SupportContext,
    message: string,
    sessionId: string
  ): Promise<SupportResponse> {
    const startTime = Date.now();
    logger.info('Processing customer message', { sessionId, messageLength: message.length });

    try {
      const intent = this.identifyIntent(message);
      const entities = this.extractEntities(message);

      let response: SupportResponse;

      switch (intent) {
        case 'create_ticket':
          response = await this.handleCreateTicket(context, entities, message);
          break;
        case 'check_ticket_status':
          response = await this.handleCheckTicketStatus(context, entities);
          break;
        case 'request_refund':
          response = await this.handleRefundRequest(context, entities);
          break;
        case 'cancel_booking':
          response = await this.handleCancellation(context, entities);
          break;
        case 'track_order':
          response = await this.handleTrackOrder(context, entities);
          break;
        case 'technical_issue':
          response = await this.handleTechnicalIssue(context, entities);
          break;
        case 'complaint':
          response = await this.handleComplaint(context, entities);
          break;
        case 'faq':
          response = await this.handleFaq(message);
          break;
        default:
          response = await this.handleGeneralSupport(context, {}, message);
      }

      response.processingTime = Date.now() - startTime;
      return response;

    } catch (error) {
      logger.error('Error processing message', { error, sessionId });
      throw error;
    }
  }

  private identifyIntent(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (this.matches(lowerMessage, ['where is my order', 'track', 'tracking', 'delivery status', 'shipped'])) {
      return 'track_order';
    }
    if (this.matches(lowerMessage, ['cancel', 'cancellation', 'stop order'])) {
      return 'cancel_booking';
    }
    if (this.matches(lowerMessage, ['refund', 'money back', 'get my money', 'return'])) {
      return 'request_refund';
    }
    if (this.matches(lowerMessage, ['not working', 'bug', 'error', 'broken', 'issue', 'problem'])) {
      return 'technical_issue';
    }
    if (this.matches(lowerMessage, ['unhappy', 'disappointed', 'terrible', 'worst', 'complaint', 'escalate'])) {
      return 'complaint';
    }
    if (this.matches(lowerMessage, ['ticket', 'support request', 'help me', 'need help'])) {
      return 'create_ticket';
    }
    if (this.matches(lowerMessage, ['status', 'when', 'update on', 'what\'s happening'])) {
      return 'check_ticket_status';
    }
    if (this.matches(lowerMessage, ['how do i', 'what is', 'can i', 'policy', 'faq', 'question'])) {
      return 'faq';
    }

    return 'general';
  }

  private matches(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private extractEntities(message: string): Record<string, unknown> {
    const entities: Record<string, unknown> = {};

    const orderMatch = message.match(/order[:#]?\s*([A-Z0-9]{6,})/i);
    if (orderMatch) {
      entities.orderId = orderMatch[1].toUpperCase();
    }

    const ticketMatch = message.match(/ticket[:#]?\s*([A-Z0-9]{4,})/i);
    if (ticketMatch) {
      entities.ticketId = ticketMatch[1].toUpperCase();
    }

    const amountMatch = message.match(/\$?(\d+(?:\.\d{2})?)/);
    if (amountMatch) {
      entities.amount = parseFloat(amountMatch[1]);
    }

    const categories = ['billing', 'technical', 'booking', 'refund', 'general', 'complaint'];
    for (const category of categories) {
      if (message.toLowerCase().includes(category)) {
        entities.category = category;
        break;
      }
    }

    const priorities = ['urgent', 'high', 'medium', 'low'];
    for (const priority of priorities) {
      if (message.toLowerCase().includes(priority)) {
        entities.priority = priority;
        break;
      }
    }

    return entities;
  }

  private async handleCreateTicket(
    context: SupportContext,
    entities: Record<string, unknown>,
    message: string
  ): Promise<SupportResponse> {
    const category = this.mapCategory(entities.category as string);
    const priority = this.mapPriority(entities.priority as string, context.customer);

    const ticket = await this.createTicket({
      subject: this.generateSubject(message),
      description: message,
      category,
      priority,
      customerId: context.customer?.id || 'anonymous',
      customerName: context.customer?.name || 'Customer',
      customerEmail: context.customer?.email || 'unknown@example.com',
      source: TicketSource.CHAT,
      orderId: entities.orderId as string || null,
      tags: this.extractTags(message)
    });

    let responseMessage = `I've created a support ticket for you.\n\n`;
    responseMessage += `**Ticket ID:** ${ticket.displayId}\n`;
    responseMessage += `**Category:** ${this.formatCategory(category)}\n`;
    responseMessage += `**Priority:** ${this.formatPriority(priority)}\n`;
    responseMessage += `**Subject:** ${ticket.subject}\n\n`;
    responseMessage += `Our team will respond within ${this.getResponseTime(priority)}. You can reference this ticket ID for unknown follow-ups.`;

    return {
      success: true,
      message: responseMessage,
      data: {
        ticket: {
          id: ticket.id,
          displayId: ticket.displayId,
          subject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
          createdAt: ticket.createdAt
        }
      },
      actions: [
        { type: 'show_ticket_details', data: { ticketId: ticket.id } },
        { type: 'track_ticket', data: { ticketId: ticket.id } }
      ]
    };
  }

  private async handleCheckTicketStatus(
    context: SupportContext,
    entities: Record<string, unknown>
  ): Promise<SupportResponse> {
    const ticketId = entities.ticketId as string;
    const ticket = ticketId ? this.getTicket(ticketId) : null;

    if (!ticket) {
      const customerTickets = this.getTicketsByCustomer(context.customer?.id || 'anonymous');

      if (customerTickets.length === 0) {
        return {
          success: true,
          message: "I couldn't find unknown tickets associated with your account. Would you like to create a new support ticket?",
          actions: [{ type: 'create_ticket', data: {} }]
        };
      }

      const openTickets = customerTickets.filter(t =>
        ![TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(t.status)
      );

      if (openTickets.length === 0) {
        return {
          success: true,
          message: "You don't have unknown open support tickets. All your previous tickets have been resolved. Is there anything else I can help you with?",
          actions: [{ type: 'show_ticket_history', data: { tickets: customerTickets } }]
        };
      }

      return {
        success: true,
        message: this.formatTicketList(openTickets),
        data: { tickets: openTickets },
        actions: [{ type: 'show_ticket_history', data: { tickets: openTickets } }]
      };
    }

    const statusEmoji = this.getStatusEmoji(ticket.status);
    let response = `${statusEmoji} **Ticket ${ticket.displayId}**\n\n`;
    response += `**Status:** ${this.formatStatus(ticket.status)}\n`;
    response += `**Subject:** ${ticket.subject}\n`;
    response += `**Priority:** ${this.formatPriority(ticket.priority)}\n`;

    if (ticket.assignedTo) {
      response += `**Assigned to:** ${ticket.assignedTo}\n`;
    }

    if (ticket.firstResponseAt) {
      response += `**First Response:** ${this.formatDate(ticket.firstResponseAt)}\n`;
    }

    if (ticket.slaDeadline) {
      response += `**SLA Deadline:** ${this.formatDate(ticket.slaDeadline)}\n`;
    }

    if (ticket.resolution) {
      response += `\n**Resolution:**\n${ticket.resolution.summary}`;
    } else if (ticket.messages.length > 1) {
      response += `\n**Latest Update:**\n${ticket.messages[ticket.messages.length - 1].content.substring(0, 200)}...`;
    }

    return {
      success: true,
      message: response,
      data: { ticket },
      actions: [
        { type: 'show_ticket_details', data: { ticketId: ticket.id } },
        { type: 'add_ticket_message', data: { ticketId: ticket.id } }
      ]
    };
  }

  private async handleRefundRequest(
    context: SupportContext,
    entities: Record<string, unknown>
  ): Promise<SupportResponse> {
    const orderId = entities.orderId as string || 'unknown';

    const eligibility = refundService.getRefundEligibility({
      orderId,
      customerId: context.customer?.id || 'anonymous',
      totalSpent: context.customer?.totalSpent || 0,
      totalTickets: context.customer?.totalTickets || 0
    });

    if (!eligibility.eligible) {
      let message = "I understand you'd like a refund. Unfortunately, based on our policy:\n\n";
      for (const reason of eligibility.reasons) {
        message += `• ${reason}\n`;
      }
      message += "\n";
      if (eligibility.alternatives.length > 0) {
        message += "Here are some alternatives available to you:\n";
        for (const alt of eligibility.alternatives) {
          message += `• ${alt}\n`;
        }
      }

      return {
        success: true,
        message,
        data: { eligible: false, reasons: eligibility.reasons },
        actions: [{ type: 'show_policy', data: { policyType: 'refund' } }]
      };
    }

    let message = "Great news! You're eligible for a refund.\n\n";
    message += `**Order ID:** ${orderId}\n`;
    message += `**Refund Amount:** $${eligibility.refundAmount.toFixed(2)}\n`;
    message += `**Refund Method:** ${eligibility.refundMethod}\n`;
    message += `**Processing Time:** ${eligibility.processingTime}\n\n`;

    if (eligibility.bonusRefund > 0) {
      message += `**Goodwill Bonus:** $${eligibility.bonusRefund.toFixed(2)} (Thank you for your patience!)\n\n`;
    }

    message += "Would you like me to process this refund request?";

    return {
      success: true,
      message,
      data: {
        eligible: true,
        refundAmount: eligibility.refundAmount,
        bonusRefund: eligibility.bonusRefund,
        totalRefund: eligibility.refundAmount + eligibility.bonusRefund,
        refundMethod: eligibility.refundMethod,
        processingTime: eligibility.processingTime
      },
      actions: [
        { type: 'process_refund', data: { orderId, amount: eligibility.refundAmount } },
        { type: 'show_refund_details', data: {} }
      ]
    };
  }

  private async handleCancellation(
    context: SupportContext,
    entities: Record<string, unknown>
  ): Promise<SupportResponse> {
    const orderId = entities.orderId as string;

    const cancellationPolicy = this.getCancellationPolicy(context.customer?.tier || 'basic');
    const isCancellable = this.checkCancellability(orderId);

    if (!isCancellable.cancellable) {
      return {
        success: true,
        message: `Unfortunately, this booking cannot be cancelled online.\n\n**Reason:** ${isCancellable.reason}\n\nPlease contact our support team at support@rez.com or call us directly for assistance.`,
        data: { cancellable: false, reason: isCancellable.reason },
        actions: [
          { type: 'contact_support', data: { method: 'phone' } },
          { type: 'schedule_callback', data: {} }
        ]
      };
    }

    let message = "Yes, this booking can be cancelled!\n\n";
    message += `**Order ID:** ${orderId}\n`;
    message += `**Cancellation Policy:** ${cancellationPolicy.policyName}\n`;
    message += `**Cancellation Fee:** ${cancellationPolicy.cancellationFee === 0 ? 'None' : `$${cancellationPolicy.cancellationFee.toFixed(2)}`}\n`;
    message += `**Refund Amount:** $${isCancellable.refundAmount.toFixed(2)}\n\n`;
    message += "Would you like me to proceed with the cancellation?";

    return {
      success: true,
      message,
      data: {
        cancellable: true,
        orderId,
        refundAmount: isCancellable.refundAmount,
        cancellationFee: cancellationPolicy.cancellationFee,
        policy: cancellationPolicy
      },
      actions: [
        { type: 'confirm_cancellation', data: { orderId } },
        { type: 'show_policy', data: { policyType: 'cancellation' } }
      ]
    };
  }

  private async handleTrackOrder(
    context: SupportContext,
    entities: Record<string, unknown>
  ): Promise<SupportResponse> {
    const orderId = entities.orderId as string || 'unknown';
    const trackingInfo = this.getOrderTracking(orderId);

    let message = `**Order ${orderId} Status**\n\n`;
    message += `**Current Status:** ${trackingInfo.status}\n`;
    message += `**Last Updated:** ${this.formatDate(trackingInfo.lastUpdate)}\n\n`;
    message += "**Timeline:**\n";

    for (const event of trackingInfo.events) {
      message += `• ${this.formatDate(event.timestamp)} - ${event.description}\n`;
    }

    if (trackingInfo.estimatedDelivery) {
      message += `\n**Estimated ${trackingInfo.deliveryType}:** ${this.formatDate(trackingInfo.estimatedDelivery)}\n`;
    }

    if (trackingInfo.trackingUrl) {
      message += `\n**Track your package:** ${trackingInfo.trackingUrl}`;
    }

    return {
      success: true,
      message,
      data: { tracking: trackingInfo },
      actions: trackingInfo.trackingUrl
        ? [{ type: 'open_tracking', data: { url: trackingInfo.trackingUrl } }]
        : []
    };
  }

  private async handleTechnicalIssue(
    context: SupportContext,
    entities: Record<string, unknown>
  ): Promise<SupportResponse> {
    const troubleshootingSteps = this.getTroubleshootingSteps(entities.category as string);

    let message = "I understand you're experiencing a technical issue. Let me help you troubleshoot.\n\n";

    if (troubleshootingSteps.length > 0) {
      message += "**Try these steps:**\n\n";
      for (let i = 0; i < troubleshootingSteps.length; i++) {
        message += `${i + 1}. ${troubleshootingSteps[i]}\n`;
      }
      message += "\n";
    }

    message += "If the issue persists after trying these steps, I'll create a support ticket for you.";

    return {
      success: true,
      message,
      data: { troubleshootingSteps },
      actions: [
        { type: 'create_ticket', data: { category: 'technical', priority: 'medium' } },
        { type: 'show_faq', data: { topic: 'technical' } }
      ]
    };
  }

  private async handleComplaint(
    context: SupportContext,
    entities: Record<string, unknown>
  ): Promise<SupportResponse> {
    const priority = TicketPriority.HIGH;

    const ticket = await this.createTicket({
      subject: 'Customer Complaint - Requires Immediate Attention',
      description: (entities.description as string) || 'Customer has filed a complaint',
      category: TicketCategory.COMPLAINT,
      priority,
      customerId: context.customer?.id || 'anonymous',
      customerName: context.customer?.name || 'Customer',
      customerEmail: context.customer?.email || 'unknown@example.com',
      source: TicketSource.CHAT,
      orderId: entities.orderId as string || null,
      tags: ['complaint', 'urgent-response']
    });

    let message = "I'm truly sorry to hear about your experience. Your concern is our top priority.\n\n";
    message += "I've created a high-priority ticket for immediate review:\n";
    message += `**Ticket ID:** ${ticket.displayId}\n\n`;
    message += "A dedicated team member will reach out to you within the next 2 hours to resolve this matter.\n\n";
    message += "In the meantime, is there anything else I can help clarify or assist with?";

    return {
      success: true,
      message,
      data: { ticket: { id: ticket.id, displayId: ticket.displayId, priority } },
      actions: [
        { type: 'escalate_ticket', data: { ticketId: ticket.id } },
        { type: 'notify_supervisor', data: {} }
      ]
    };
  }

  private async handleFaq(message: string): Promise<SupportResponse> {
    const faqs = this.getRelevantFaqs(message);

    if (faqs.length === 0) {
      return {
        success: true,
        message: "I couldn't find a specific answer to your question. Would you like me to create a support ticket for this?",
        actions: [{ type: 'create_ticket', data: {} }]
      };
    }

    let response = "Here are some frequently asked questions that might help:\n\n";

    for (const faq of faqs) {
      response += `**Q: ${faq.question}**\n${faq.answer}\n\n`;
    }

    return {
      success: true,
      message: response,
      data: { faqs },
      actions: [{ type: 'show_more_faqs', data: {} }]
    };
  }

  private async handleGeneralSupport(
    context: SupportContext,
    entities: Record<string, unknown>,
    message: string
  ): Promise<SupportResponse> {
    const greeting = this.isGreeting(message);

    if (greeting) {
      return {
        success: true,
        message: "Hello! Welcome to REZ support. How can I assist you today?\n\nI can help you with:\n• Order tracking and status updates\n• Refunds and cancellations\n• Technical issues\n• Billing questions\n• General inquiries",
        actions: [
          { type: 'quick_actions', data: { actions: ['track_order', 'refund', 'cancel', 'contact_support'] } }
        ]
      };
    }

    return {
      success: true,
      message: "Thank you for reaching out. To help you better, could you please provide more details about what you need assistance with?\n\nHere are some common topics I can help with:\n• Where is my order?\n• I need to cancel my booking\n• I'd like to request a refund\n• I'm having a technical issue\n• General questions",
      actions: [
        { type: 'show_help_options', data: {} }
      ]
    };
  }

  async createTicket(data: CreateTicketData): Promise<Ticket> {
    this.ticketCounter++;

    const priority = data.priority || this.mapPriority(undefined, null);
    const slaHours = this.getSlaHours(priority);

    const ticket: Ticket = {
      id: uuidv4(),
      displayId: `TKT-${this.ticketCounter}`,
      subject: data.subject,
      description: data.description,
      status: TicketStatus.OPEN,
      priority: data.priority || TicketPriority.MEDIUM,
      category: data.category || TicketCategory.GENERAL,
      source: data.source,
      customerId: data.customerId,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      assignedTo: null,
      assignedTeam: this.assignTeam(data.category || TicketCategory.GENERAL),
      tags: data.tags || [],
      orderId: data.orderId ?? null,
      relatedTickets: [],
      messages: [{
        id: uuidv4(),
        ticketId: '',
        authorId: 'system',
        authorName: 'System',
        authorType: 'system',
        content: `Ticket created: ${data.subject}`,
        attachments: [],
        isInternal: false,
        createdAt: new Date()
      }],
      resolution: null,
      metadata: {},
      slaDeadline: new Date(Date.now() + slaHours * 60 * 60 * 1000),
      firstResponseAt: null,
      resolvedAt: null,
      closedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    ticket.messages[0].ticketId = ticket.id;
    this.tickets.set(ticket.id, ticket);

    logger.info('Ticket created', { ticketId: ticket.id, displayId: ticket.displayId, category: ticket.category });

    return ticket;
  }

  getTicket(ticketId: string): Ticket | undefined {
    const normalizedId = ticketId.toUpperCase();

    for (const ticket of this.tickets.values()) {
      if (ticket.id === ticketId || ticket.displayId === normalizedId) {
        return ticket;
      }
    }

    return undefined;
  }

  getTicketsByCustomer(customerId: string): Ticket[] {
    return Array.from(this.tickets.values())
      .filter(t => t.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getAllTickets(): Ticket[] {
    return Array.from(this.tickets.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private mapCategory(category?: string): TicketCategory {
    const categoryMap: Record<string, TicketCategory> = {
      'billing': TicketCategory.BILLING,
      'payment': TicketCategory.BILLING,
      'technical': TicketCategory.TECHNICAL,
      'bug': TicketCategory.TECHNICAL,
      'booking': TicketCategory.BOOKING,
      'reservation': TicketCategory.BOOKING,
      'refund': TicketCategory.REFUND,
      'complaint': TicketCategory.COMPLAINT,
      'general': TicketCategory.GENERAL
    };

    if (category && categoryMap[category.toLowerCase()]) {
      return categoryMap[category.toLowerCase()];
    }

    return TicketCategory.GENERAL;
  }

  private mapPriority(priority?: string, customer?: Customer | null): TicketPriority {
    if (priority) {
      const priorityMap: Record<string, TicketPriority> = {
        'critical': TicketPriority.CRITICAL,
        'urgent': TicketPriority.URGENT,
        'high': TicketPriority.HIGH,
        'medium': TicketPriority.MEDIUM,
        'low': TicketPriority.LOW
      };

      if (priorityMap[priority.toLowerCase()]) {
        return priorityMap[priority.toLowerCase()];
      }
    }

    if (customer?.tier === 'enterprise') {
      return TicketPriority.HIGH;
    }

    return TicketPriority.MEDIUM;
  }

  private generateSubject(message: string): string {
    const words = message.split(' ').slice(0, 10);
    return words.join(' ') + (message.split(' ').length > 10 ? '...' : '');
  }

  private extractTags(message: string): string[] {
    const tags: string[] = [];
    const lowerMessage = message.toLowerCase();

    const tagKeywords: Record<string, string> = {
      'urgent': 'urgent',
      'asap': 'urgent',
      'important': 'urgent',
      'billing': 'billing',
      'payment': 'billing',
      'technical': 'technical',
      'bug': 'technical',
      'booking': 'booking',
      'cancel': 'cancellation',
      'refund': 'refund'
    };

    for (const [keyword, tag] of Object.entries(tagKeywords)) {
      if (lowerMessage.includes(keyword)) {
        tags.push(tag);
      }
    }

    return [...new Set(tags)];
  }

  private getResponseTime(priority: TicketPriority): string {
    const times: Record<TicketPriority, string> = {
      [TicketPriority.CRITICAL]: '15 minutes',
      [TicketPriority.URGENT]: '1 hour',
      [TicketPriority.HIGH]: '4 hours',
      [TicketPriority.MEDIUM]: '24 hours',
      [TicketPriority.LOW]: '48 hours'
    };
    return times[priority];
  }

  private getSlaHours(priority: TicketPriority): number {
    const hours: Record<TicketPriority, number> = {
      [TicketPriority.CRITICAL]: 1,
      [TicketPriority.URGENT]: 4,
      [TicketPriority.HIGH]: 8,
      [TicketPriority.MEDIUM]: 24,
      [TicketPriority.LOW]: 48
    };
    return hours[priority];
  }

  private assignTeam(category: TicketCategory): string {
    const teams: Record<TicketCategory, string> = {
      [TicketCategory.BILLING]: 'Billing Team',
      [TicketCategory.TECHNICAL]: 'Technical Support',
      [TicketCategory.BOOKING]: 'Reservations Team',
      [TicketCategory.REFUND]: 'Refunds Team',
      [TicketCategory.GENERAL]: 'General Support',
      [TicketCategory.COMPLAINT]: 'Customer Experience',
      [TicketCategory.FEATURE_REQUEST]: 'Product Team'
    };
    return teams[category];
  }

  private formatCategory(category: TicketCategory): string {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private formatPriority(priority: TicketPriority): string {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  }

  private formatStatus(status: TicketStatus): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private formatDate(date: Date): string {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  private getStatusEmoji(status: TicketStatus): string {
    const emojis: Record<TicketStatus, string> = {
      [TicketStatus.OPEN]: '🆕',
      [TicketStatus.IN_PROGRESS]: '🔄',
      [TicketStatus.PENDING_CUSTOMER]: '⏳',
      [TicketStatus.PENDING_INTERNAL]: '🔧',
      [TicketStatus.RESOLVED]: '✅',
      [TicketStatus.CLOSED]: '🔒',
      [TicketStatus.ESCALATED]: '🚨'
    };
    return emojis[status];
  }

  private formatTicketList(tickets: Ticket[]): string {
    let message = `You have ${tickets.length} open support ticket${tickets.length > 1 ? 's' : ''}:\n\n`;

    for (const ticket of tickets) {
      message += `**${ticket.displayId}** - ${ticket.subject}\n`;
      message += `Status: ${this.formatStatus(ticket.status)} | Priority: ${this.formatPriority(ticket.priority)}\n`;
      message += `Created: ${this.formatDate(ticket.createdAt)}\n\n`;
    }

    return message;
  }

  private getCancellationPolicy(tier: string): { policyName: string; cancellationFee: number } {
    const policies: Record<string, { policyName: string; cancellationFee: number }> = {
      'basic': { policyName: 'Standard Policy', cancellationFee: 25 },
      'premium': { policyName: 'Flexible Policy', cancellationFee: 10 },
      'enterprise': { policyName: 'Premium Policy', cancellationFee: 0 }
    };
    return policies[tier] || policies['basic'];
  }

  private checkCancellability(orderId: string): { cancellable: boolean; reason?: string; refundAmount: number } {
    return {
      cancellable: true,
      refundAmount: 199.99
    };
  }

  private getOrderTracking(orderId: string): {
    status: string;
    lastUpdate: Date;
    events: Array<{ timestamp: Date; description: string }>;
    estimatedDelivery?: Date;
    deliveryType?: string;
    trackingUrl?: string;
  } {
    return {
      status: 'In Transit',
      lastUpdate: new Date(),
      events: [
        { timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), description: 'Order placed' },
        { timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), description: 'Order confirmed and preparing' },
        { timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), description: 'Shipped from warehouse' },
        { timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), description: 'In transit to destination' }
      ],
      estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      deliveryType: 'Delivery',
      trackingUrl: `https://track.rez.com/${orderId}`
    };
  }

  private getTroubleshootingSteps(category?: string): string[] {
    const stepsByCategory: Record<string, string[]> = {
      'technical': [
        'Clear your browser cache and cookies',
        'Try using a different browser or incognito mode',
        'Restart your device and try again',
        'Check your internet connection',
        'Disable browser extensions temporarily'
      ],
      'billing': [
        'Verify your payment method is still valid',
        'Check if your card has sufficient funds',
        'Try a different payment method',
        'Contact your bank if the transaction was declined'
      ],
      'booking': [
        'Check your confirmation email for booking details',
        'Verify the dates and location of your booking',
        'Contact the property directly if needed',
        'Check your email spam folder for confirmations'
      ]
    };

    return stepsByCategory[category || 'technical'] || stepsByCategory['technical'];
  }

  private getRelevantFaqs(message: string): Array<{ question: string; answer: string }> {
    const faqs: Array<{ question: string; answer: string; keywords: string[] }> = [
      {
        question: 'How do I track my order?',
        answer: 'You can track your order by logging into your account and visiting the "My Orders" section, or by clicking the tracking link in your confirmation email.',
        keywords: ['track', 'order', 'where', 'delivery']
      },
      {
        question: 'What is your refund policy?',
        answer: 'We offer full refunds within 30 days of purchase for unused items. Partial refunds may be available for used items. Processing typically takes 5-7 business days.',
        keywords: ['refund', 'money back', 'return', 'policy']
      },
      {
        question: 'How do I cancel my booking?',
        answer: 'You can cancel most bookings up to 48 hours before the scheduled date through your account. Some bookings may have different cancellation policies. Contact support for assistance.',
        keywords: ['cancel', 'cancellation', 'stop']
      },
      {
        question: 'How long does shipping take?',
        answer: 'Standard shipping takes 5-7 business days. Express shipping takes 2-3 business days. International shipping varies by destination.',
        keywords: ['shipping', 'delivery', 'how long', 'when']
      }
    ];

    const lowerMessage = message.toLowerCase();
    return faqs
      .filter(faq => faq.keywords.some(keyword => lowerMessage.includes(keyword)))
      .slice(0, 3)
      .map(({ question, answer }) => ({ question, answer }));
  }

  private isGreeting(message: string): boolean {
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
    return greetings.some(g => message.toLowerCase().includes(g));
  }
}

export interface SupportResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  actions: SupportAction[];
  processingTime?: number;
}

export interface SupportAction {
  type: 'create_ticket' | 'show_ticket_details' | 'track_ticket' | 'show_ticket_history' |
        'process_refund' | 'show_refund_details' | 'show_policy' | 'contact_support' |
        'schedule_callback' | 'confirm_cancellation' | 'open_tracking' | 'escalate_ticket' |
        'notify_supervisor' | 'show_faq' | 'show_help_options' | 'quick_actions' | 'show_more_faqs' |
        'add_ticket_message';
  data: Record<string, unknown>;
}

export interface CreateTicketData {
  subject: string;
  description: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  customerId: string;
  customerName: string;
  customerEmail: string;
  source: TicketSource;
  orderId?: string | null;
  tags?: string[];
}

export const supportAgent = new SupportAgent();
