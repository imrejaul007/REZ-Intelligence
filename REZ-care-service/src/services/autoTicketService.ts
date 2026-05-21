/**
 * REZ Care Service - Auto-Ticket Service
 *
 * Automatically creates tickets for technical issues and system problems.
 * Reduces manual ticket creation and ensures no issue goes untracked.
 */

import mongoose from 'mongoose';
import axios from 'axios';
import { AutoTicket } from '../types';
import { logger } from '../utils/logger';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-care';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token';

const SERVICE_URLS = {
  support: process.env.SUPPORT_SERVICE_URL || 'https://rez-support-dashboard.onrender.com',
  notifications: process.env.NOTIFICATIONS_SERVICE_URL || 'https://rez-notifications-service.onrender.com',
};

// Auto-Ticket Schema
const AutoTicketSchema = new mongoose.Schema({
  ticketId: { type: String, required: true, unique: true, index: true },
  type: {
    type: String,
    enum: ['payment', 'qr', 'app', 'delivery', 'booking', 'merchant', 'technical'],
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['P1', 'P2', 'P3', 'P4'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['created', 'assigned', 'in_progress', 'resolved', 'auto_resolved'],
    default: 'created',
    index: true
  },
  detectedAt: { type: Date, default: Date.now, index: true },
  ruleId: String,
  description: String,

  customerId: String,
  merchantId: String,
  orderId: String,

  autoActions: [{
    type: String,
    timestamp: Date,
    result: String
  }],

  assignedTo: String,
  assignedAt: Date,
  resolvedAt: Date,
  resolution: String
}, { timestamps: true });

AutoTicketSchema.index({ status: 1, detectedAt: -1 });
AutoTicketSchema.index({ type: 1, severity: 1, status: 1 });

const AutoTicketModel = mongoose.model('AutoTicket', AutoTicketSchema);

// Ticket Rules Configuration
interface TicketRule {
  id: string;
  name: string;
  type: AutoTicket['type'];
  severity: AutoTicket['severity'];
  description: string;
  assignTo?: string;
  autoActions: string[];
}

const TICKET_RULES: TicketRule[] = [
  // Payment Rules
  {
    id: 'PAY-001',
    name: 'Payment Failure Spike',
    type: 'payment',
    severity: 'P1',
    description: 'Multiple payment failures detected in short time',
    assignTo: 'payments-team',
    autoActions: ['notify_team', 'page_oncall']
  },
  {
    id: 'PAY-002',
    name: 'Razorpay Webhook Failure',
    type: 'payment',
    severity: 'P1',
    description: 'Payment webhook processing failure',
    assignTo: 'payments-team',
    autoActions: ['create_incident', 'page_oncall']
  },
  {
    id: 'PAY-003',
    name: 'Customer Payment Issue',
    type: 'payment',
    severity: 'P2',
    description: 'Customer experiencing payment issues',
    assignTo: 'payments-team',
    autoActions: ['compensate']
  },

  // QR Rules
  {
    id: 'QR-001',
    name: 'Merchant QR Down',
    type: 'qr',
    severity: 'P1',
    description: 'Merchant QR scanner not responding',
    assignTo: 'merchant-support',
    autoActions: ['notify_merchant', 'create_incident']
  },
  {
    id: 'QR-002',
    name: 'Customer QR Issue',
    type: 'qr',
    severity: 'P3',
    description: 'Customer having QR scan issues',
    autoActions: ['auto_resolve', 'compensate']
  },

  // App Rules
  {
    id: 'APP-001',
    name: 'App Crash',
    type: 'app',
    severity: 'P2',
    description: 'App crash reported',
    assignTo: 'engineering',
    autoActions: ['gather_logs']
  },
  {
    id: 'APP-002',
    name: 'App Error Spike',
    type: 'app',
    severity: 'P1',
    description: 'Multiple app errors detected',
    assignTo: 'engineering',
    autoActions: ['create_incident', 'page_oncall']
  },

  // Delivery Rules
  {
    id: 'DEL-001',
    name: 'Delivery Delay',
    type: 'delivery',
    severity: 'P2',
    description: 'Order delivery delayed',
    assignTo: 'ops-team',
    autoActions: ['notify_customer', 'compensate']
  },
  {
    id: 'DEL-002',
    name: 'Delivery Failed',
    type: 'delivery',
    severity: 'P2',
    description: 'Order delivery failed',
    assignTo: 'ops-team',
    autoActions: ['create_ticket', 'notify_customer']
  },

  // Booking Rules
  {
    id: 'BOOK-001',
    name: 'Booking Mismatch',
    type: 'booking',
    severity: 'P2',
    description: 'Booking details do not match',
    assignTo: 'hotel-ops',
    autoActions: ['notify_hotel', 'compensate']
  },

  // Merchant Rules
  {
    id: 'MERCHANT-001',
    name: 'Merchant Health Drop',
    type: 'merchant',
    severity: 'P3',
    description: 'Merchant health score dropped significantly',
    assignTo: 'merchant-success',
    autoActions: ['create_ticket']
  },
  {
    id: 'MERCHANT-002',
    name: 'Payout Failure',
    type: 'merchant',
    severity: 'P2',
    description: 'Merchant payout processing failed',
    assignTo: 'finance-ops',
    autoActions: ['notify_merchant', 'create_ticket']
  },

  // Technical Rules
  {
    id: 'TECH-001',
    name: 'Service Down',
    type: 'technical',
    severity: 'P1',
    description: 'Critical service not responding',
    assignTo: 'engineering',
    autoActions: ['create_incident', 'page_oncall', 'notify_team']
  },
  {
    id: 'TECH-002',
    name: 'Database Error',
    type: 'technical',
    severity: 'P1',
    description: 'Database connectivity issues',
    assignTo: 'engineering',
    autoActions: ['create_incident', 'page_oncall']
  }
];

export class AutoTicketService {
  private connected: boolean = false;

  async connect(): Promise<void> {
    if (!this.connected) {
      await mongoose.connect(MONGODB_URI);
      this.connected = true;
      logger.info('Auto-Ticket Service connected to MongoDB');
    }
  }

  /**
   * Get tickets with filters
   */
  async getTickets(filters?: {
    status?: string;
    severity?: string;
    type?: string;
    limit?: number;
  }): Promise<AutoTicket[]> {
    await this.connect();

    const query: any = {};
    if (filters?.status) query.status = filters.status;
    if (filters?.severity) query.severity = filters.severity;
    if (filters?.type) query.type = filters.type;

    const tickets = await AutoTicketModel
      .find(query)
      .sort({ detectedAt: -1 })
      .limit(filters?.limit || 50);

    return tickets.map(t => t.toObject() as any);
  }

  /**
   * Get single ticket
   */
  async getTicket(ticketId: string): Promise<AutoTicket | null> {
    await this.connect();

    const ticket = await AutoTicketModel.findOne({ ticketId });
    return ticket ? (ticket.toObject() as any) : null;
  }

  /**
   * Create auto-ticket
   */
  async createTicket(data: {
    ruleId?: string;
    type: AutoTicket['type'];
    severity: AutoTicket['severity'];
    description: string;
    customerId?: string;
    merchantId?: string;
    orderId?: string;
    metadata?: Record<string, any>;
  }): Promise<AutoTicket> {
    await this.connect();

    // Find matching rule
    const rule = TICKET_RULES.find(r => r.id === data.ruleId);

    // Generate ticket ID
    const ticketId = `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create ticket
    const ticket = new AutoTicketModel({
      ticketId,
      type: data.type,
      severity: data.severity,
      status: 'created',
      detectedAt: new Date(),
      ruleId: data.ruleId || 'MANUAL',
      description: data.description,
      customerId: data.customerId,
      merchantId: data.merchantId,
      orderId: data.orderId,
      assignedTo: rule?.assignTo,
      autoActions: []
    });

    await ticket.save();

    // Execute auto actions
    if (rule) {
      for (const action of rule.autoActions) {
        const result = await this.executeAutoAction(ticket, action);
        (ticket as any).autoActions.push({
          type: action,
          timestamp: new Date(),
          result
        });
      }
      await ticket.save();
    }

    // Create ticket in support dashboard
    try {
      await this.createSupportTicket(ticket, rule);
    } catch (error) {
      logger.error('Failed to create support ticket', error);
    }

    logger.info('Auto-ticket created', { ticketId, type: data.type, severity: data.severity });

    return ticket.toObject() as any;
  }

  /**
   * Resolve ticket
   */
  async resolveTicket(
    ticketId: string,
    resolution?: string,
    resolvedBy?: string
  ): Promise<AutoTicket> {
    await this.connect();

    const ticket = await AutoTicketModel.findOne({ ticketId });
    if (!ticket) throw new Error('Ticket not found');

    ticket.status = 'resolved';
    ticket.resolvedAt = new Date();
    ticket.resolution = resolution || 'Resolved';
    (ticket as any).resolvedBy = resolvedBy || 'system';

    await ticket.save();

    logger.info('Auto-ticket resolved', { ticketId, resolvedBy });

    return ticket.toObject() as any;
  }

  /**
   * Auto-resolve ticket
   */
  async autoResolveTicket(ticketId: string, resolution: string): Promise<AutoTicket> {
    await this.connect();

    const ticket = await AutoTicketModel.findOne({ ticketId });
    if (!ticket) throw new Error('Ticket not found');

    ticket.status = 'auto_resolved';
    ticket.resolvedAt = new Date();
    ticket.resolution = resolution;
    (ticket as any).resolvedBy = 'system';

    (ticket as any).autoActions.push({
      type: 'auto_resolve',
      timestamp: new Date(),
      result: resolution
    });

    await ticket.save();

    // Notify customer
    if (ticket.customerId) {
      await this.notifyCustomerOfResolution(ticket.customerId, ticket.type, resolution);
    }

    logger.info('Auto-ticket auto-resolved', { ticketId, resolution });

    return ticket.toObject() as any;
  }

  /**
   * Expire old tickets
   */
  async expireOldTickets(): Promise<void> {
    await this.connect();

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const result = await AutoTicketModel.updateMany(
      {
        status: 'created',
        detectedAt: { $lt: oneWeekAgo }
      },
      {
        $set: {
          status: 'resolved',
          resolution: 'Auto-closed: No activity',
          resolvedAt: new Date(),
          resolvedBy: 'system'
        }
      }
    );

    logger.info('Expired old tickets', { count: result.modifiedCount });
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async executeAutoAction(ticket: any, action: string): Promise<string> {
    switch (action) {
      case 'notify_team':
        await this.notifyTeam(ticket);
        return 'Team notified';

      case 'page_oncall':
        await this.pageOncall(ticket);
        return 'On-call paged';

      case 'notify_merchant':
        if (ticket.merchantId) {
          await this.notifyMerchant(ticket.merchantId, ticket);
        }
        return 'Merchant notified';

      case 'notify_customer':
        if (ticket.customerId) {
          await this.notifyCustomer(ticket.customerId, ticket);
        }
        return 'Customer notified';

      case 'compensate':
        if (ticket.customerId) {
          await this.compensate(ticket.customerId, ticket.type);
        }
        return 'Compensation applied';

      case 'create_incident':
        await this.createIncident(ticket);
        return 'Incident created';

      case 'gather_logs':
        await this.gatherLogs(ticket);
        return 'Logs gathered';

      default:
        return `Unknown action: ${action}`;
    }
  }

  private async notifyTeam(ticket: any): Promise<void> {
    try {
      await axios.post(
        `${SERVICE_URLS.notifications}/api/notifications/send`,
        {
          userId: 'support-team',
          type: 'auto_ticket',
          channel: 'slack',
          title: `Auto-Ticket: ${ticket.type}`,
          body: `${ticket.description}\nSeverity: ${ticket.severity}\nTicket: ${ticket.ticketId}`
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
    } catch (error) {
      logger.error('Failed to notify team', error);
    }
  }

  private async pageOncall(ticket: any): Promise<void> {
    try {
      await axios.post(
        `${SERVICE_URLS.notifications}/api/notifications/send`,
        {
          userId: 'oncall-team',
          type: 'critical_alert',
          channel: 'sms',
          title: `P1 Alert: ${ticket.type}`,
          body: `${ticket.description}\nTicket: ${ticket.ticketId}`
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
    } catch (error) {
      logger.error('Failed to page oncall', error);
    }
  }

  private async notifyMerchant(merchantId: string, ticket: any): Promise<void> {
    try {
      await axios.post(
        `${process.env.MERCHANT_SERVICE_URL || 'https://rez-merchant-service.onrender.com'}/api/notifications/merchant/${merchantId}`,
        {
          type: 'alert',
          title: 'Issue Detected',
          message: ticket.description
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
    } catch (error) {
      logger.error('Failed to notify merchant', error);
    }
  }

  private async notifyCustomer(customerId: string, ticket: any): Promise<void> {
    try {
      await axios.post(
        `${SERVICE_URLS.notifications}/api/notifications/send`,
        {
          userId: customerId,
          type: 'auto_ticket',
          channel: 'inapp',
          title: 'Issue Being Resolved',
          body: `We're aware of the issue and working on it. Ticket: ${ticket.ticketId}`
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
    } catch (error) {
      logger.error('Failed to notify customer', error);
    }
  }

  private async compensate(customerId: string, type: string): Promise<void> {
    const amounts: Record<string, number> = {
      payment: 10,
      qr: 5,
      delivery: 20,
      app: 10,
      technical: 20
    };

    const amount = amounts[type] || 5;

    try {
      await axios.post(
        `${process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com'}/api/wallet/credit`,
        {
          userId: customerId,
          amount,
          reason: `compensation_${type}`,
          type: 'credit'
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
    } catch (error) {
      logger.error('Failed to compensate', error);
    }
  }

  private async createIncident(ticket: any): Promise<void> {
    try {
      await axios.post(
        `${process.env.INCIDENT_SERVICE_URL || 'https://incident-service.onrender.com'}/api/incidents`,
        {
          title: `Auto-Ticket: ${ticket.type}`,
          description: ticket.description,
          severity: ticket.severity,
          source: 'auto-ticket',
          ticketId: ticket.ticketId
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
    } catch (error) {
      logger.error('Failed to create incident', error);
    }
  }

  private async gatherLogs(ticket: any): Promise<void> {
    // In production, this would gather actual logs
    logger.info('Gathering logs for ticket', { ticketId: ticket.ticketId });
  }

  private async createSupportTicket(ticket: any, rule?: TicketRule): Promise<void> {
    try {
      await axios.post(
        `${SERVICE_URLS.support}/api/tickets`,
        {
          sourceService: 'auto-ticket',
          autoTicketId: ticket.ticketId,
          type: ticket.type,
          priority: this.severityToPriority(ticket.severity),
          subject: rule?.name || `Auto-Ticket: ${ticket.type}`,
          description: ticket.description,
          customerId: ticket.customerId,
          merchantId: ticket.merchantId,
          orderId: ticket.orderId,
          assignedTo: rule?.assignTo,
          tags: ['auto-created', ticket.type, ticket.severity]
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
    } catch (error) {
      logger.error('Failed to create support ticket', error);
    }
  }

  private async notifyCustomerOfResolution(
    customerId: string,
    type: string,
    resolution: string
  ): Promise<void> {
    const messages: Record<string, { title: string; body: string }> = {
      qr: {
        title: 'QR Issue Resolved',
        body: 'The QR scanning issue has been resolved. Please try again!'
      },
      payment: {
        title: 'Payment Issue Resolved',
        body: 'Your payment issue has been fixed. Please try again.'
      },
      delivery: {
        title: 'Delivery Issue Resolved',
        body: 'Your delivery concern has been addressed. Check for updates.'
      },
      app: {
        title: 'App Issue Fixed',
        body: 'The app issue you reported has been resolved. Please update the app.'
      }
    };

    const message = messages[type] || {
      title: 'Issue Resolved',
      body: resolution
    };

    try {
      await axios.post(
        `${SERVICE_URLS.notifications}/api/notifications/send`,
        {
          userId: customerId,
          type: 'issue_resolved',
          channel: 'inapp',
          ...message
        },
        { headers: { 'X-Internal-Token': INTERNAL_TOKEN }, timeout: 5000 }
      );
    } catch (error) {
      logger.error('Failed to notify customer', error);
    }
  }

  private severityToPriority(severity: string): string {
    const map: Record<string, string> = {
      P1: 'urgent',
      P2: 'high',
      P3: 'medium',
      P4: 'low'
    };
    return map[severity] || 'medium';
  }
}
