import { v4 as uuidv4 } from 'uuid';
import type {
  Merchant,
  BusinessType,
  Customer,
  Conversation,
  KnowledgeItem,
  Workflow,
  Booking,
  ApprovalRequest,
  MerchantAnalytics,
  WorkflowType,
} from '../types/index.js';
import { logger } from './utils/logger.js';
import {
  Merchant as MerchantModel,
  Customer as CustomerModel,
  Conversation as ConversationModel,
  KnowledgeItem as KnowledgeItemModel,
  Workflow as WorkflowModel,
  Booking as BookingModel,
  ApprovalRequest as ApprovalRequestModel,
} from '../models/schemas.js';

export class MerchantService {
  // ============================================
  // Merchant Operations
  // ============================================

  async registerMerchant(data: Omit<Merchant, 'merchantId' | 'createdAt' | 'updatedAt'>): Promise<Merchant> {
    const merchant: Merchant = {
      ...data,
      merchantId: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await MerchantModel.create(merchant);
    await this.createDefaultWorkflows(merchant.merchantId, data.businessType);

    logger.info(`Merchant registered: ${merchant.businessName}`, { merchantId: merchant.merchantId });
    return merchant;
  }

  async getMerchant(merchantId: string): Promise<Merchant | null> {
    const doc = await MerchantModel.findOne({ merchantId }).lean();
    if (!doc) return null;
    return this.toMerchant(doc);
  }

  async updateMerchant(merchantId: string, updates: Partial<Merchant>): Promise<Merchant | null> {
    const doc = await MerchantModel.findOneAndUpdate(
      { merchantId },
      { $set: { ...updates, updatedAt: new Date() } },
      { new: true }
    ).lean();
    if (!doc) return null;
    return this.toMerchant(doc);
  }

  async listMerchants(businessType?: BusinessType): Promise<Merchant[]> {
    const query = businessType ? { businessType, isActive: true } : { isActive: true };
    const docs = await MerchantModel.find(query).lean();
    return docs.map(d => this.toMerchant(d));
  }

  private async createDefaultWorkflows(merchantId: string, _businessType: BusinessType): Promise<void> {
    const workflows = [
      { name: 'Booking Confirmation', type: 'confirmation' as WorkflowType, trigger: { event: 'booking_created' }, actions: [{ type: 'send_message', params: { template: 'booking_confirmed' } }] },
      { name: 'Follow-up Reminder', type: 'reminder' as WorkflowType, trigger: { event: 'booking_completed', delay: 60 }, actions: [{ type: 'send_message', params: { template: 'follow_up' } }] },
      { name: 'Payment Reminder', type: 'payment_reminder' as WorkflowType, trigger: { event: 'payment_pending', delay: 1440 }, actions: [{ type: 'send_message', params: { template: 'payment_reminder' } }] },
    ];

    for (const wf of workflows) {
      await WorkflowModel.create({
        workflowId: uuidv4(),
        merchantId,
        name: wf.name,
        type: wf.type,
        trigger: wf.trigger,
        actions: wf.actions,
        isActive: true,
        stats: { triggered: 0, completed: 0, failed: 0 },
      });
    }
  }

  private toMerchant(doc: Record<string, unknown>): Merchant {
    return {
      merchantId: doc.merchantId as string,
      businessName: doc.businessName as string,
      businessType: doc.businessType as BusinessType,
      phone: doc.phone as string,
      email: doc.email as string | undefined,
      address: doc.address as string | undefined,
      language: (doc.language as Merchant['language']) || 'en',
      timezone: (doc.timezone as string) || 'Asia/Kolkata',
      workingHours: doc.workingHours as Merchant['workingHours'],
      isActive: (doc.isActive as boolean) ?? true,
      plan: (doc.plan as Merchant['plan']) || 'starter',
      createdAt: (doc.createdAt as Date).toISOString(),
      updatedAt: (doc.updatedAt as Date).toISOString(),
    };
  }

  // ============================================
  // Customer Operations
  // ============================================

  async registerCustomer(merchantId: string, phone: string, name?: string): Promise<Customer> {
    const customerId = `${merchantId}_${phone.replace(/\D/g, '')}`;

    const existing = await CustomerModel.findOne({ customerId }).lean();
    if (existing) return this.toCustomer(existing);

    const customer: Customer = {
      customerId,
      merchantId,
      phone,
      name,
      totalSpent: 0,
      visitCount: 0,
      tags: [],
      preferences: {},
      isBlocked: false,
      createdAt: new Date().toISOString(),
    };

    await CustomerModel.create(customer);
    logger.info(`Customer registered`, { customerId, merchantId });
    return customer;
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    const doc = await CustomerModel.findOne({ customerId }).lean();
    if (!doc) return null;
    return this.toCustomer(doc);
  }

  async getCustomerByPhone(merchantId: string, phone: string): Promise<Customer | null> {
    const customerId = `${merchantId}_${phone.replace(/\D/g, '')}`;
    const doc = await CustomerModel.findOne({ customerId }).lean();
    if (!doc) return null;
    return this.toCustomer(doc);
  }

  async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<Customer | null> {
    const doc = await CustomerModel.findOneAndUpdate(
      { customerId },
      { $set: { ...updates, updatedAt: new Date() } },
      { new: true }
    ).lean();
    if (!doc) return null;
    return this.toCustomer(doc);
  }

  async listCustomers(merchantId: string): Promise<Customer[]> {
    const docs = await CustomerModel.find({ merchantId }).lean();
    return docs.map(d => this.toCustomer(d));
  }

  async recordVisit(customerId: string, amount?: number): Promise<void> {
    const update: Record<string, unknown> = { $inc: { visitCount: 1 }, $set: { lastVisit: new Date() } };
    if (amount) (update.$inc as Record<string, number>).totalSpent = amount;
    await CustomerModel.findOneAndUpdate({ customerId }, update);
  }

  private toCustomer(doc: Record<string, unknown>): Customer {
    return {
      customerId: doc.customerId as string,
      merchantId: doc.merchantId as string,
      phone: doc.phone as string,
      name: doc.name as string | undefined,
      email: doc.email as string | undefined,
      tags: (doc.tags as string[]) || [],
      totalSpent: (doc.totalSpent as number) || 0,
      visitCount: (doc.visitCount as number) || 0,
      lastVisit: doc.lastVisit ? (doc.lastVisit as Date).toISOString() : undefined,
      birthday: doc.birthday as string | undefined,
      preferences: (doc.preferences as Record<string, unknown>) || {},
      notes: doc.notes as string | undefined,
      isBlocked: (doc.isBlocked as boolean) || false,
      createdAt: (doc.createdAt as Date).toISOString(),
    };
  }

  // ============================================
  // Conversation Operations
  // ============================================

  async getOrCreateConversation(merchantId: string, customerPhone: string): Promise<Conversation> {
    const existing = await ConversationModel.findOne({ merchantId, customerPhone, status: 'active' }).lean();
    if (existing) return this.toConversation(existing);

    const conversation: Conversation = {
      conversationId: uuidv4(),
      merchantId,
      customerPhone,
      status: 'active',
      messageCount: 0,
      aiHandled: false,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await ConversationModel.create(conversation);
    return conversation;
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    const doc = await ConversationModel.findOne({ conversationId }).lean();
    if (!doc) return null;
    return this.toConversation(doc);
  }

  async updateConversation(conversationId: string, updates: Partial<Conversation>): Promise<Conversation | null> {
    const doc = await ConversationModel.findOneAndUpdate(
      { conversationId },
      { $set: { ...updates, updatedAt: new Date() } },
      { new: true }
    ).lean();
    if (!doc) return null;
    return this.toConversation(doc);
  }

  async listConversations(merchantId: string, status?: Conversation['status']): Promise<Conversation[]> {
    const query: Record<string, unknown> = { merchantId };
    if (status) query.status = status;
    const docs = await ConversationModel.find(query).sort({ updatedAt: -1 }).lean();
    return docs.map(d => this.toConversation(d));
  }

  private toConversation(doc: Record<string, unknown>): Conversation {
    return {
      conversationId: doc.conversationId as string,
      merchantId: doc.merchantId as string,
      customerId: doc.customerId as string | undefined,
      customerPhone: doc.customerPhone as string,
      status: doc.status as Conversation['status'],
      lastMessage: doc.lastMessage as string | undefined,
      lastMessageAt: doc.lastMessageAt ? (doc.lastMessageAt as Date).toISOString() : undefined,
      messageCount: (doc.messageCount as number) || 0,
      aiHandled: (doc.aiHandled as boolean) || false,
      escalatedTo: doc.escalatedTo as string | undefined,
      tags: (doc.tags as string[]) || [],
      createdAt: (doc.createdAt as Date).toISOString(),
      updatedAt: (doc.updatedAt as Date).toISOString(),
    };
  }

  // ============================================
  // Knowledge Base Operations
  // ============================================

  async addKnowledgeItem(merchantId: string, data: Omit<KnowledgeItem, 'id' | 'merchantId' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<KnowledgeItem> {
    const item: KnowledgeItem = {
      ...data,
      id: uuidv4(),
      merchantId,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await KnowledgeItemModel.create(item);
    logger.info(`Knowledge item added`, { id: item.id, merchantId });
    return item;
  }

  async searchKnowledge(merchantId: string, query: string): Promise<KnowledgeItem[]> {
    const docs = await KnowledgeItemModel.find({ merchantId, isActive: true }).lean();
    const queryLower = query.toLowerCase();

    return docs
      .map(doc => {
        let score = 0;
        if ((doc.question as string)?.toLowerCase().includes(queryLower)) score += 3;
        if ((doc.answer as string).toLowerCase().includes(queryLower)) score += 2;
        if ((doc.keywords as string[])?.some(k => k.toLowerCase().includes(queryLower))) score += 1;
        return { doc, score };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(r => this.toKnowledgeItem(r.doc));
  }

  async getKnowledgeBase(merchantId: string): Promise<KnowledgeItem[]> {
    const docs = await KnowledgeItemModel.find({ merchantId, isActive: true }).lean();
    return docs.map(d => this.toKnowledgeItem(d));
  }

  private toKnowledgeItem(doc: Record<string, unknown>): KnowledgeItem {
    return {
      id: doc.id as string,
      merchantId: doc.merchantId as string,
      category: doc.category as KnowledgeItem['category'],
      question: doc.question as string | undefined,
      answer: doc.answer as string,
      keywords: (doc.keywords as string[]) || [],
      isActive: (doc.isActive as boolean) ?? true,
      usageCount: (doc.usageCount as number) || 0,
      createdAt: (doc.createdAt as Date).toISOString(),
      updatedAt: (doc.updatedAt as Date).toISOString(),
    };
  }

  // ============================================
  // Workflow Operations
  // ============================================

  async createWorkflow(merchantId: string, data: Omit<Workflow, 'workflowId' | 'merchantId' | 'stats' | 'createdAt'>): Promise<Workflow> {
    const workflow: Workflow = {
      ...data,
      workflowId: uuidv4(),
      merchantId,
      stats: { triggered: 0, completed: 0, failed: 0 },
      createdAt: new Date().toISOString(),
    };
    await WorkflowModel.create(workflow);
    return workflow;
  }

  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    const doc = await WorkflowModel.findOne({ workflowId }).lean();
    if (!doc) return null;
    return this.toWorkflow(doc);
  }

  async listWorkflows(merchantId: string): Promise<Workflow[]> {
    const docs = await WorkflowModel.find({ merchantId }).lean();
    return docs.map(d => this.toWorkflow(d));
  }

  async triggerWorkflow(workflowId: string): Promise<void> {
    await WorkflowModel.findOneAndUpdate({ workflowId }, { $inc: { 'stats.triggered': 1 } });
  }

  private toWorkflow(doc: Record<string, unknown>): Workflow {
    return {
      workflowId: doc.workflowId as string,
      merchantId: doc.merchantId as string,
      name: doc.name as string,
      type: doc.type as Workflow['type'],
      trigger: doc.trigger as Workflow['trigger'],
      actions: doc.actions as Workflow['actions'],
      isActive: (doc.isActive as boolean) ?? true,
      stats: (doc.stats as Workflow['stats']) || { triggered: 0, completed: 0, failed: 0 },
      createdAt: (doc.createdAt as Date).toISOString(),
    };
  }

  // ============================================
  // Booking Operations
  // ============================================

  async createBooking(data: Omit<Booking, 'bookingId' | 'createdAt' | 'updatedAt' | 'reminderSent' | 'confirmationSent'>): Promise<Booking> {
    const booking: Booking = {
      ...data,
      bookingId: uuidv4(),
      reminderSent: false,
      confirmationSent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await BookingModel.create(booking);
    await this.recordVisit(data.customerId);
    logger.info(`Booking created`, { bookingId: booking.bookingId, merchantId: data.merchantId });
    return booking;
  }

  async getBooking(bookingId: string): Promise<Booking | null> {
    const doc = await BookingModel.findOne({ bookingId }).lean();
    if (!doc) return null;
    return this.toBooking(doc);
  }

  async updateBooking(bookingId: string, updates: Partial<Booking>): Promise<Booking | null> {
    const doc = await BookingModel.findOneAndUpdate(
      { bookingId },
      { $set: { ...updates, updatedAt: new Date() } },
      { new: true }
    ).lean();
    if (!doc) return null;
    return this.toBooking(doc);
  }

  async listBookings(merchantId: string, date?: string): Promise<Booking[]> {
    const query: Record<string, unknown> = { merchantId };
    if (date) query.date = date;
    const docs = await BookingModel.find(query).sort({ date: 1, time: 1 }).lean();
    return docs.map(d => this.toBooking(d));
  }

  async checkAvailability(merchantId: string, date: string, time: string, duration: number = 60): Promise<boolean> {
    const docs = await BookingModel.find({
      merchantId,
      date,
      status: { $nin: ['cancelled', 'no_show'] },
    }).lean();

    const requestedStart = this.timeToMinutes(time);
    const requestedEnd = requestedStart + duration;

    for (const booking of docs) {
      const bookingStart = this.timeToMinutes(booking.time);
      const bookingEnd = bookingStart + (booking.duration || 60);
      if (requestedStart < bookingEnd && requestedEnd > bookingStart) return false;
    }
    return true;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private toBooking(doc: Record<string, unknown>): Booking {
    return {
      bookingId: doc.bookingId as string,
      merchantId: doc.merchantId as string,
      customerId: doc.customerId as string,
      service: doc.service as string,
      date: doc.date as string,
      time: doc.time as string,
      duration: doc.duration as number | undefined,
      staff: doc.staff as string | undefined,
      status: doc.status as Booking['status'],
      notes: doc.notes as string | undefined,
      customerPhone: doc.customerPhone as string,
      customerName: doc.customerName as string | undefined,
      reminderSent: (doc.reminderSent as boolean) || false,
      confirmationSent: (doc.confirmationSent as boolean) || false,
      cancellationReason: doc.cancellationReason as string | undefined,
      createdAt: (doc.createdAt as Date).toISOString(),
      updatedAt: (doc.updatedAt as Date).toISOString(),
    };
  }

  // ============================================
  // Approval Operations
  // ============================================

  async createApprovalRequest(merchantId: string, data: Omit<ApprovalRequest, 'approvalId' | 'merchantId' | 'createdAt' | 'status'>): Promise<ApprovalRequest> {
    const request: ApprovalRequest = {
      ...data,
      approvalId: uuidv4(),
      merchantId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    await ApprovalRequestModel.create(request);
    logger.info(`Approval request created`, { approvalId: request.approvalId, type: data.type });
    return request;
  }

  async resolveApproval(approvalId: string, resolvedBy: string, approved: boolean, resolution: string): Promise<ApprovalRequest | null> {
    const doc = await ApprovalRequestModel.findOneAndUpdate(
      { approvalId },
      { $set: { status: approved ? 'approved' : 'rejected', resolvedBy, resolution, resolvedAt: new Date() } },
      { new: true }
    ).lean();
    if (!doc) return null;
    return this.toApproval(doc);
  }

  async listApprovals(merchantId: string, status?: ApprovalRequest['status']): Promise<ApprovalRequest[]> {
    const query: Record<string, unknown> = { merchantId };
    if (status) query.status = status;
    const docs = await ApprovalRequestModel.find(query).sort({ createdAt: -1 }).lean();
    return docs.map(d => this.toApproval(d));
  }

  private toApproval(doc: Record<string, unknown>): ApprovalRequest {
    return {
      approvalId: doc.approvalId as string,
      merchantId: doc.merchantId as string,
      type: doc.type as ApprovalRequest['type'],
      customerId: doc.customerId as string | undefined,
      description: doc.description as string,
      originalValue: doc.originalValue as number | undefined,
      requestedBy: doc.requestedBy as ApprovalRequest['requestedBy'],
      status: doc.status as ApprovalRequest['status'],
      resolvedBy: doc.resolvedBy as string | undefined,
      resolution: doc.resolution as string | undefined,
      createdAt: (doc.createdAt as Date).toISOString(),
      resolvedAt: doc.resolvedAt ? (doc.resolvedAt as Date).toISOString() : undefined,
    };
  }

  // ============================================
  // Analytics
  // ============================================

  async getAnalytics(merchantId: string, startDate: string, endDate: string): Promise<MerchantAnalytics> {
    const [conversations, bookings, customers] = await Promise.all([
      this.listConversations(merchantId),
      this.listBookings(merchantId),
      this.listCustomers(merchantId),
    ]);

    const periodStart = new Date(startDate);
    const periodEnd = new Date(endDate);

    const periodConversations = conversations.filter(c => {
      const date = new Date(c.updatedAt);
      return date >= periodStart && date <= periodEnd;
    });

    const periodBookings = bookings.filter(b => {
      const date = new Date(b.createdAt);
      return date >= periodStart && date <= periodEnd;
    });

    const confirmedBookings = periodBookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
    const cancelledBookings = periodBookings.filter(b => b.status === 'cancelled');

    const newCustomerIds = new Set<string>();
    const returningCustomerIds = new Set<string>();

    customers.forEach(c => {
      if (c.visitCount === 1) newCustomerIds.add(c.customerId);
      else if (c.visitCount > 1) returningCustomerIds.add(c.customerId);
    });

    const serviceCounts = new Map<string, number>();
    periodBookings.forEach(b => serviceCounts.set(b.service, (serviceCounts.get(b.service) || 0) + 1));
    const topServices = Array.from(serviceCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      merchantId,
      period: { start: startDate, end: endDate },
      metrics: {
        totalConversations: periodConversations.length,
        aiHandledConversations: periodConversations.filter(c => c.aiHandled).length,
        avgResponseTime: 45,
        customerSatisfaction: 4.2,
        totalBookings: periodBookings.length,
        confirmedBookings: confirmedBookings.length,
        cancelledBookings: cancelledBookings.length,
        totalRevenue: 0,
        newCustomers: newCustomerIds.size,
        returningCustomers: returningCustomerIds.size,
        topServices,
        peakHours: [{ hour: 10, count: 15 }, { hour: 14, count: 12 }, { hour: 18, count: 20 }],
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

export const merchantService = new MerchantService();
