/**
 * REZ Care Service - Merchant Communication Service
 *
 * Enables agents to communicate with merchants, hotels, and partners
 * about customer issues. Bidirectional communication for support context.
 */

import mongoose, { Schema, Model } from 'mongoose';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import { generateCommunicationId } from '../utils/idGenerator';

interface IMerchantCommunication {
  communicationId: string;
  customerId: string;
  partnerId: string;
  channel: string;
  status: string;
  priority: string;
  actions: unknown[];
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rez-care';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token';

const SERVICE_URLS = {
  notifications: process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:4011',
  merchant: process.env.MERCHANT_SERVICE_URL || 'http://localhost:3002',
  hotel: process.env.BOOKING_SERVICE_URL || 'http://localhost:4020',
};

// Merchant Communication Schema
const MerchantCommunicationSchema = new mongoose.Schema({
  communicationId: { type: String, required: true, unique: true, index: true },
  ticketId: { type: String, required: true, index: true },
  customerId: { type: String, required: true, index: true },

  // Merchant/Hotel Info
  partnerId: { type: String, required: true, index: true },
  partnerType: { type: String, enum: ['merchant', 'hotel', 'restaurant', 'retail', 'brand'], required: true },
  partnerName: String,
  partnerPhone: String,
  partnerEmail: String,

  // Communication Details
  type: {
    type: String,
    enum: ['issue_alert', 'complaint_escalation', 'info_request', 'issue_resolved', 'feedback_request', 'urgent_action'],
    required: true
  },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },

  // Issue Context
  issueCategory: {
    type: String,
    enum: ['food_quality', 'service_issue', 'hygiene', 'billing', 'delivery', 'booking', 'room_issue', 'staff_behavior', 'technical', 'other'],
    required: true
  },
  issueDescription: { type: String, required: true },
  customerExpectation: String,

  // Actions
  actions: [{
    type: String,
    takenBy: String,
    takenAt: Date,
    details: String
  }],

  // Response from Merchant
  merchantResponse: {
    respondedAt: Date,
    respondedBy: String,
    message: String,
    actionTaken: String,
    expectedResolutionTime: Date
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'acknowledged', 'in_progress', 'resolved', 'closed', 'escalated'],
    default: 'pending',
    index: true
  },

  // Communication Channel
  channel: { type: String, enum: ['whatsapp', 'sms', 'email', 'inapp', 'call'], default: 'whatsapp' },
  sentVia: String,

  // Timestamps
  sentAt: { type: Date, default: Date.now },
  acknowledgedAt: Date,
  resolvedAt: Date,
  closedAt: Date,

  // Agent who initiated
  initiatedBy: {
    agentId: String,
    agentName: String,
    agentType: { type: String, enum: ['human', 'ai'], default: 'human' }
  },

  // Related communications
  relatedCommunications: [String],

  // Feedback
  merchantFeedback: {
    rating: Number,
    comment: String,
    submittedAt: Date
  }

}, { timestamps: true });

MerchantCommunicationSchema.index({ partnerId: 1, status: 1 });
MerchantCommunicationSchema.index({ issueCategory: 1, createdAt: -1 });
MerchantCommunicationSchema.index({ ticketId: 1, createdAt: -1 });

const MerchantCommunication = mongoose.model('MerchantCommunication', MerchantCommunicationSchema);

// Merchant Issue Template Messages
const ISSUE_TEMPLATES = {
  food_quality: {
    urgent: `🚨 URGENT: Customer reported food quality issue

Order Details:
- Order ID: {orderId}
- Items: {items}
- Issue: {issueDescription}

Customer Expectation: {customerExpectation}

Action Required: Please investigate and respond within 1 hour.

REZ Care Team`,
    standard: `📋 Customer Support Alert: Food Quality Issue

Dear Partner,

A customer has reported an issue with their recent order:

Order ID: {orderId}
Issue: {issueDescription}
Customer Expectation: {customerExpectation}

Please investigate and take appropriate action.

REZ Care Team`
  },
  service_issue: {
    urgent: `🚨 URGENT: Service Issue Reported

Customer: {customerName}
Issue: {issueDescription}

Immediate attention required. Please respond within 1 hour.`,
    standard: `📋 Service Issue Reported

A customer has reported a service issue at your establishment.

Issue: {issueDescription}
Expectation: {customerExpectation}

Please review and provide feedback.`
  },
  booking: {
    urgent: `🚨 URGENT: Booking Issue

Booking Reference: {bookingId}
Guest: {customerName}
Issue: {issueDescription}

Immediate attention required.`,
    standard: `📋 Booking Issue Reported

Booking: {bookingId}
Guest: {customerName}
Issue: {issueDescription}

Please review and assist.`
  },
  room_issue: {
    urgent: `🚨 URGENT: Room Issue Reported

Guest: {customerName}
Room: {roomNumber}
Issue: {issueDescription}

Immediate action required.`,
    standard: `📋 Guest Complaint: Room Issue

Guest: {customerName}
Room: {roomNumber}
Issue: {issueDescription}

Please investigate.`
  },
  billing: {
    urgent: `🚨 URGENT: Billing Dispute

Customer: {customerName}
Issue: {issueDescription}

Please verify and respond within 2 hours.`,
    standard: `📋 Billing Inquiry

Customer has raised a concern about their billing:

Issue: {issueDescription}

Please review and provide clarification.`
  }
};

export class MerchantCommunicationService {
  private connected: boolean = false;

  async connect(): Promise<void> {
    if (!this.connected) {
      await mongoose.connect(MONGODB_URI);
      this.connected = true;
      logger.info('Merchant Communication Service connected to MongoDB');
    }
  }

  /**
   * Send communication to merchant/hotel about customer issue
   */
  async sendToPartner(params: {
    ticketId: string;
    customerId: string;
    partnerId: string;
    partnerType: 'merchant' | 'hotel' | 'restaurant' | 'retail' | 'brand';
    partnerName: string;
    partnerPhone?: string;
    partnerEmail?: string;
    issueCategory: string;
    issueDescription: string;
    customerExpectation?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    channel?: 'whatsapp' | 'sms' | 'email' | 'inapp' | 'call';
    orderId?: string;
    bookingId?: string;
    agentId?: string;
    agentName?: string;
    agentType?: 'human' | 'ai';
  }): Promise<unknown> {
    await this.connect();

    const {
      ticketId,
      customerId,
      partnerId,
      partnerType,
      partnerName,
      partnerPhone,
      partnerEmail,
      issueCategory,
      issueDescription,
      customerExpectation,
      priority = 'medium',
      channel = 'whatsapp',
      orderId,
      bookingId,
      agentId,
      agentName,
      agentType = 'human'
    } = params;

    // Generate communication ID
    const communicationId = generateCommunicationId();

    // Generate message from template
    const template = ISSUE_TEMPLATES[issueCategory as keyof typeof ISSUE_TEMPLATES]?.[priority === 'urgent' || priority === 'high' ? 'urgent' : 'standard'] || ISSUE_TEMPLATES.food_quality.standard;

    const message = this.fillTemplate(template, {
      orderId: orderId || 'N/A',
      bookingId: bookingId || 'N/A',
      issueDescription,
      customerExpectation: customerExpectation || 'Resolution requested',
      customerName: customerId
    });

    // Create communication record
    const communication = new MerchantCommunication({
      communicationId,
      ticketId,
      customerId,
      partnerId,
      partnerType,
      partnerName,
      partnerPhone,
      partnerEmail,
      type: this.getCommunicationType(issueCategory, priority),
      priority,
      issueCategory,
      issueDescription,
      customerExpectation,
      channel,
      status: 'pending',
      initiatedBy: {
        agentId,
        agentName,
        agentType
      }
    });

    await communication.save();

    // Send via appropriate channel
    try {
      await this.sendViaChannel(communication, message, channel);
      logger.info('Merchant communication sent', { communicationId, partnerId, channel });
    } catch (error) {
      logger.error('Failed to send merchant communication', error);
    }

    return communication;
  }

  /**
   * Receive response from merchant/hotel
   */
  async receiveResponse(params: {
    communicationId: string;
    respondedBy: string;
    message: string;
    actionTaken?: string;
    expectedResolutionTime?: Date;
  }): Promise<IMerchantCommunication | null> {
    await this.connect();

    const communication = await MerchantCommunication.findOne({ communicationId: params.communicationId });
    if (!communication) {
      logger.warn('Communication not found', { communicationId: params.communicationId });
      return null;
    }

    communication.merchantResponse = {
      respondedAt: new Date(),
      respondedBy: params.respondedBy,
      message: params.message,
      actionTaken: params.actionTaken,
      expectedResolutionTime: params.expectedResolutionTime
    };
    communication.status = 'acknowledged';
    communication.acknowledgedAt = new Date();

    await communication.save();

    // Notify agent/customer about response
    await this.notifyAgent(communication);

    logger.info('Merchant response received', { communicationId: params.communicationId });
    return communication;
  }

  /**
   * Mark communication as resolved
   */
  async resolve(communicationId: string, resolution: string): Promise<IMerchantCommunication | null> {
    await this.connect();

    const communication = await MerchantCommunication.findOne({ communicationId });
    if (!communication) return null;

    communication.status = 'resolved';
    communication.resolvedAt = new Date();

    if (!communication.merchantResponse) {
      communication.merchantResponse = {
        respondedAt: new Date(),
        respondedBy: 'system',
        message: resolution
      };
    }

    communication.actions = communication.actions || [];
    (communication.actions as unknown as Array<{ type: string; takenBy: string; takenAt: Date; details: string }>).push({
      type: 'resolved',
      takenBy: 'system',
      takenAt: new Date(),
      details: resolution
    });

    await communication.save();

    // Notify customer about resolution
    await this.notifyCustomer(communication);

    logger.info('Merchant communication resolved', { communicationId });
    return communication as unknown as IMerchantCommunication;
  }
  async escalate(communicationId: string, escalationNote: string): Promise<IMerchantCommunication | null> {
    await this.connect();

    const communication = await MerchantCommunication.findOne({ communicationId });
    if (!communication) return null;

    communication.status = 'escalated';
    communication.priority = 'urgent';

    communication.actions = communication.actions || [];
    (communication.actions as unknown as Array<{ type: string; takenBy: string; takenAt: Date; details: string }>).push({
      type: 'escalated',
      takenBy: 'system',
      takenAt: new Date(),
      details: escalationNote
    });

    // Send urgent escalation message
    const template = ISSUE_TEMPLATES[communication.issueCategory as keyof typeof ISSUE_TEMPLATES]?.urgent || ISSUE_TEMPLATES.food_quality.urgent;
    const message = this.fillTemplate(template, {
      issueDescription: `${communication.issueDescription}\n\nESCALATED: ${escalationNote}`
    });

    await this.sendViaChannel(communication, message, 'whatsapp');
    await communication.save();

    logger.info('Merchant communication escalated', { communicationId });
    return communication as unknown as IMerchantCommunication;
  }

  /**
   * Get all communications for a partner
   */
  async getPartnerCommunications(partnerId: string, options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<IMerchantCommunication[]> {
    await this.connect();

    const query: Record<string, unknown> = { partnerId };
    if (options?.status) query.status = options.status;

    const communications = await MerchantCommunication.find(query as Record<string, unknown>)
      .sort({ createdAt: -1 })
      .limit(options?.limit || 50)
      .skip(options?.offset || 0);

    return communications;
  }

  /**
   * Get all communications for a ticket
   */
  async getTicketCommunications(ticketId: string): Promise<unknown[]> {
    await this.connect();
    return MerchantCommunication.find({ ticketId }).sort({ createdAt: -1 });
  }

  /**
   * Get communications for agent dashboard
   */
  async getDashboardData(params: {
    partnerType?: string;
    status?: string;
    priority?: string;
    limit?: number;
  }): Promise<{
    pending: IMerchantCommunication[];
    acknowledged: IMerchantCommunication[];
    inProgress: IMerchantCommunication[];
    resolved: IMerchantCommunication[];
    urgent: IMerchantCommunication[];
  }> {
    await this.connect();

    const query: Record<string, unknown> = {};
    if (params.partnerType) query.partnerType = params.partnerType;
    if (params.status) query.status = params.status;
    if (params.priority) query.priority = params.priority;

    const limit = params.limit || 100;

    const [pending, acknowledged, inProgress, resolved, urgent] = await Promise.all([
      MerchantCommunication.find({ ...query, status: 'pending' }).sort({ createdAt: -1 }).limit(limit),
      MerchantCommunication.find({ ...query, status: 'acknowledged' }).sort({ createdAt: -1 }).limit(limit),
      MerchantCommunication.find({ ...query, status: 'in_progress' }).sort({ createdAt: -1 }).limit(limit),
      MerchantCommunication.find({ ...query, status: 'resolved' }).sort({ resolvedAt: -1 }).limit(limit),
      MerchantCommunication.find({ ...query, priority: 'urgent', status: { $ne: 'resolved' } }).sort({ createdAt: -1 }).limit(limit)
    ]);

    return {
      pending: pending as unknown as IMerchantCommunication[],
      acknowledged: acknowledged as unknown as IMerchantCommunication[],
      inProgress: inProgress as unknown as IMerchantCommunication[],
      resolved: resolved as unknown as IMerchantCommunication[],
      urgent: urgent as unknown as IMerchantCommunication[]
    };
  }

  /**
   * Get merchant performance metrics
   */
  async getPartnerMetrics(partnerId: string): Promise<{
    totalCommunications: number;
    avgResponseTime: number;
    resolutionRate: number;
    issueCategories: Record<string, number>;
    recentIssues: unknown[];
  }> {
    await this.connect();

    const communications = await MerchantCommunication.find({ partnerId });

    // Calculate metrics
    const total = communications.length;
    const resolved = communications.filter(c => c.status === 'resolved');

    // Average response time
    const responseTimes = communications
      .filter(c => c.acknowledgedAt && c.sentAt)
      .map(c => new Date(c.acknowledgedAt!).getTime() - new Date(c.sentAt).getTime());

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 60000 // in minutes
      : 0;

    // Issue categories breakdown
    const issueCategories: Record<string, number> = {};
    communications.forEach(c => {
      issueCategories[c.issueCategory] = (issueCategories[c.issueCategory] || 0) + 1;
    });

    return {
      totalCommunications: total,
      avgResponseTime: Math.round(avgResponseTime),
      resolutionRate: total > 0 ? Math.round((resolved.length / total) * 100) : 0,
      issueCategories,
      recentIssues: communications.slice(0, 10)
    };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private getCommunicationType(issueCategory: string, priority: string): string {
    if (priority === 'urgent' || priority === 'high') {
      return 'urgent_action';
    }
    return 'issue_alert';
  }

  private fillTemplate(template: string, data: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
  }

  private async sendViaChannel(communication: InstanceType<typeof MerchantCommunication>, message: string, channel: string): Promise<void> {
    const partnerContact = communication.partnerPhone || communication.partnerEmail;

    if (!partnerContact) {
      logger.warn('No contact info for partner', { partnerId: communication.partnerId });
      return;
    }

    try {
      if (channel === 'whatsapp' || channel === 'sms') {
        await axios.post(`${SERVICE_URLS.notifications}/api/notifications/send`, {
          userId: communication.partnerId,
          type: 'merchant_support',
          channel,
          title: 'Customer Support Alert',
          body: message,
          phone: partnerContact,
          data: {
            communicationId: communication.communicationId,
            ticketId: communication.ticketId
          }
        }, {
          headers: { 'X-Internal-Token': INTERNAL_TOKEN },
          timeout: 10000
        });
      } else if (channel === 'email') {
        await axios.post(`${SERVICE_URLS.notifications}/api/notifications/send`, {
          userId: communication.partnerId,
          type: 'merchant_support',
          channel: 'email',
          title: 'Customer Support Alert',
          body: message,
          email: partnerContact,
          data: {
            communicationId: communication.communicationId,
            ticketId: communication.ticketId
          }
        }, {
          headers: { 'X-Internal-Token': INTERNAL_TOKEN },
          timeout: 10000
        });
      }

      communication.sentVia = channel;
      communication.status = 'pending';
    } catch (error) {
      logger.error('Failed to send via channel', { channel, error });
      throw error;
    }
  }

  private async notifyAgent(communication: InstanceType<typeof MerchantCommunication>): Promise<void> {
    try {
      await axios.post(`${SERVICE_URLS.notifications}/api/notifications/send`, {
        userId: communication.initiatedBy?.agentId || 'support-team',
        type: 'merchant_response',
        channel: 'inapp',
        title: `Response from ${communication.partnerName}`,
        body: communication.merchantResponse?.message || 'Merchant has responded to your communication',
        data: {
          communicationId: communication.communicationId,
          ticketId: communication.ticketId
        }
      }, {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
        timeout: 5000
      });
    } catch (error) {
      logger.error('Failed to notify agent', error);
    }
  }

  private async notifyCustomer(communication: InstanceType<typeof MerchantCommunication>): Promise<void> {
    try {
      await axios.post(`${SERVICE_URLS.notifications}/api/notifications/send`, {
        userId: communication.customerId,
        type: 'issue_update',
        channel: 'inapp',
        title: 'Issue Update',
        body: `Your issue has been addressed by ${communication.partnerName}. Please check for updates.`,
        data: {
          communicationId: communication.communicationId,
          ticketId: communication.ticketId
        }
      }, {
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
        timeout: 5000
      });
    } catch (error) {
      logger.error('Failed to notify customer', error);
    }
  }
}
