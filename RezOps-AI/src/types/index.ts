import { z } from 'zod';

// ============================================
// Business & Merchant Types
// ============================================

export const BusinessTypeSchema = z.enum([
  'restaurant', 'salon', 'clinic', 'gym', 'store', 
  'home_service', 'retail', 'agency', 'repair', 'tutoring'
]);
export type BusinessType = z.infer<typeof BusinessTypeSchema>;

export const MerchantSchema = z.object({
  merchantId: z.string(),
  businessName: z.string().min(1),
  businessType: BusinessTypeSchema,
  phone: z.string(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  language: z.enum(['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'ur']).default('en'),
  timezone: z.string().default('Asia/Kolkata'),
  workingHours: z.object({
    monday: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
    tuesday: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
    wednesday: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
    thursday: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
    friday: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
    saturday: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
    sunday: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
  }).optional(),
  isActive: z.boolean().default(true),
  plan: z.enum(['starter', 'pro', 'enterprise']).default('starter'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Merchant = z.infer<typeof MerchantSchema>;

// ============================================
// Customer Types
// ============================================

export const CustomerSchema = z.object({
  customerId: z.string(),
  merchantId: z.string(),
  phone: z.string(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  tags: z.array(z.string()).default([]),
  totalSpent: z.number().default(0),
  visitCount: z.number().default(0),
  lastVisit: z.string().datetime().optional(),
  birthday: z.string().optional(),
  preferences: z.record(z.unknown()).default({}),
  notes: z.string().optional(),
  isBlocked: z.boolean().default(false),
  createdAt: z.string().datetime(),
});
export type Customer = z.infer<typeof CustomerSchema>;

// ============================================
// Conversation Types
// ============================================

export const MessageTypeSchema = z.enum(['text', 'image', 'document', 'audio', 'video', 'location', 'contact']);
export type MessageType = z.infer<typeof MessageTypeSchema>;

export const MessageSchema = z.object({
  messageId: z.string(),
  conversationId: z.string(),
  merchantId: z.string(),
  customerId: z.string().optional(),
  direction: z.enum(['inbound', 'outbound']),
  type: MessageTypeSchema,
  content: z.string(),
  mediaUrl: z.string().optional(),
  sender: z.enum(['customer', 'ai', 'merchant', 'staff']),
  timestamp: z.string().datetime(),
  readAt: z.string().datetime().optional(),
  status: z.enum(['sent', 'delivered', 'read', 'failed']).default('sent'),
});
export type Message = z.infer<typeof MessageSchema>;

export const ConversationSchema = z.object({
  conversationId: z.string(),
  merchantId: z.string(),
  customerId: z.string().optional(),
  customerPhone: z.string(),
  status: z.enum(['active', 'resolved', 'archived']),
  lastMessage: z.string().optional(),
  lastMessageAt: z.string().datetime().optional(),
  messageCount: z.number().default(0),
  aiHandled: z.boolean().default(false),
  escalatedTo: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

// ============================================
// Knowledge Base Types
// ============================================

export const KnowledgeItemSchema = z.object({
  id: z.string(),
  merchantId: z.string(),
  category: z.enum(['faq', 'product', 'service', 'policy', 'menu', 'pricing', 'general']),
  question: z.string().optional(),
  answer: z.string(),
  keywords: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  usageCount: z.number().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type KnowledgeItem = z.infer<typeof KnowledgeItemSchema>;

// ============================================
// Workflow Types
// ============================================

export const WorkflowTypeSchema = z.enum([
  'reminder', 'follow_up', 'confirmation', 'payment_reminder', 
  'abandoned_cart', 'welcome', 'feedback', 'promotion'
]);
export type WorkflowType = z.infer<typeof WorkflowTypeSchema>;

export const WorkflowSchema = z.object({
  workflowId: z.string(),
  merchantId: z.string(),
  name: z.string(),
  type: WorkflowTypeSchema,
  trigger: z.object({
    event: z.string(),
    delay: z.number().optional(), // minutes
    conditions: z.record(z.unknown()).optional(),
  }),
  actions: z.array(z.object({
    type: z.enum(['send_message', 'update_customer', 'create_reminder', 'notify_staff', 'webhook']),
    params: z.record(z.unknown()),
  })),
  isActive: z.boolean().default(true),
  stats: z.object({
    triggered: z.number().default(0),
    completed: z.number().default(0),
    failed: z.number().default(0),
  }).default({ triggered: 0, completed: 0, failed: 0 }),
  createdAt: z.string().datetime(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

// ============================================
// Booking Types
// ============================================

export const BookingStatusSchema = z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const BookingSchema = z.object({
  bookingId: z.string(),
  merchantId: z.string(),
  customerId: z.string(),
  service: z.string(),
  date: z.string(),
  time: z.string(),
  duration: z.number().optional(), // minutes
  staff: z.string().optional(),
  status: BookingStatusSchema.default('pending'),
  notes: z.string().optional(),
  customerPhone: z.string(),
  customerName: z.string().optional(),
  reminderSent: z.boolean().default(false),
  confirmationSent: z.boolean().default(false),
  cancellationReason: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Booking = z.infer<typeof BookingSchema>;

// ============================================
// Approval Types
// ============================================

export const ApprovalTypeSchema = z.enum(['refund', 'discount', 'reschedule', 'cancellation', 'custom']);
export type ApprovalType = z.infer<typeof ApprovalTypeSchema>;

export const ApprovalRequestSchema = z.object({
  approvalId: z.string(),
  merchantId: z.string(),
  type: ApprovalTypeSchema,
  customerId: z.string().optional(),
  description: z.string(),
  originalValue: z.number().optional(),
  requestedBy: z.enum(['ai', 'customer', 'staff']),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  resolvedBy: z.string().optional(),
  resolution: z.string().optional(),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

// ============================================
// Analytics Types
// ============================================

export const MerchantAnalyticsSchema = z.object({
  merchantId: z.string(),
  period: z.object({ start: z.string(), end: z.string() }),
  metrics: z.object({
    totalConversations: z.number(),
    aiHandledConversations: z.number(),
    avgResponseTime: z.number(), // seconds
    customerSatisfaction: z.number().optional(),
    totalBookings: z.number(),
    confirmedBookings: z.number(),
    cancelledBookings: z.number(),
    totalRevenue: z.number(),
    newCustomers: z.number(),
    returningCustomers: z.number(),
    topServices: z.array(z.object({ name: z.string(), count: z.number() })),
    peakHours: z.array(z.object({ hour: z.number(), count: z.number() })),
  }),
  generatedAt: z.string().datetime(),
});
export type MerchantAnalytics = z.infer<typeof MerchantAnalyticsSchema>;

// ============================================
// API Request/Response Types
// ============================================

export const SendMessageRequestSchema = z.object({
  merchantId: z.string(),
  customerPhone: z.string(),
  message: z.string(),
  type: MessageTypeSchema.default('text'),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

export const CreateWorkflowRequestSchema = z.object({
  merchantId: z.string(),
  name: z.string(),
  type: WorkflowTypeSchema,
  trigger: WorkflowSchema.shape.trigger,
  actions: WorkflowSchema.shape.actions,
});
export type CreateWorkflowRequest = z.infer<typeof CreateWorkflowRequestSchema>;

export const BookSlotRequestSchema = z.object({
  merchantId: z.string(),
  customerPhone: z.string(),
  service: z.string(),
  date: z.string(),
  time: z.string(),
  customerName: z.string().optional(),
  notes: z.string().optional(),
});
export type BookSlotRequest = z.infer<typeof BookSlotRequestSchema>;
