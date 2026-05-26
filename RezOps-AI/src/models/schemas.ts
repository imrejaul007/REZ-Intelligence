import mongoose, { Schema, Document } from 'mongoose';

// ============================================
// Merchant Model
// ============================================

export interface IMerchant extends Document {
  merchantId: string;
  businessName: string;
  businessType: string;
  phone: string;
  email?: string;
  address?: string;
  language: string;
  timezone: string;
  workingHours?: Record<string, Array<{ start: string; end: string }>>;
  isActive: boolean;
  plan: string;
  createdAt: Date;
  updatedAt: Date;
}

const MerchantSchema = new Schema<IMerchant>({
  merchantId: { type: String, required: true, unique: true, index: true },
  businessName: { type: String, required: true },
  businessType: { type: String, required: true, enum: ['restaurant', 'salon', 'clinic', 'gym', 'store', 'home_service', 'retail', 'agency', 'repair', 'tutoring'] },
  phone: { type: String, required: true },
  email: { type: String },
  address: { type: String },
  language: { type: String, default: 'en' },
  timezone: { type: String, default: 'Asia/Kolkata' },
  workingHours: { type: Schema.Types.Mixed },
  isActive: { type: Boolean, default: true },
  plan: { type: String, enum: ['starter', 'pro', 'enterprise'], default: 'starter' },
}, { timestamps: true });

MerchantSchema.index({ businessType: 1 });
MerchantSchema.index({ isActive: 1 });

// ============================================
// Customer Model
// ============================================

export interface ICustomer extends Document {
  customerId: string;
  merchantId: string;
  phone: string;
  name?: string;
  email?: string;
  tags: string[];
  totalSpent: number;
  visitCount: number;
  lastVisit?: Date;
  birthday?: string;
  preferences: Record<string, unknown>;
  notes?: string;
  isBlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>({
  customerId: { type: String, required: true, unique: true, index: true },
  merchantId: { type: String, required: true, index: true },
  phone: { type: String, required: true },
  name: { type: String },
  email: { type: String },
  tags: [{ type: String }],
  totalSpent: { type: Number, default: 0 },
  visitCount: { type: Number, default: 0 },
  lastVisit: { type: Date },
  birthday: { type: String },
  preferences: { type: Schema.Types.Mixed, default: {} },
  notes: { type: String },
  isBlocked: { type: Boolean, default: false },
}, { timestamps: true });

CustomerSchema.index({ merchantId: 1 });
CustomerSchema.index({ phone: 1 });
CustomerSchema.index({ merchantId: 1, phone: 1 }, { unique: true });

// ============================================
// Message Model
// ============================================

export interface IMessage extends Document {
  messageId: string;
  conversationId: string;
  merchantId: string;
  customerId?: string;
  direction: 'inbound' | 'outbound';
  type: string;
  content: string;
  mediaUrl?: string;
  sender: string;
  timestamp: Date;
  readAt?: Date;
  status: string;
}

const MessageSchema = new Schema<IMessage>({
  messageId: { type: String, required: true, unique: true, index: true },
  conversationId: { type: String, required: true, index: true },
  merchantId: { type: String, required: true, index: true },
  customerId: { type: String, index: true },
  direction: { type: String, enum: ['inbound', 'outbound'], required: true },
  type: { type: String, default: 'text' },
  content: { type: String, required: true },
  mediaUrl: { type: String },
  sender: { type: String, enum: ['customer', 'ai', 'merchant', 'staff'] },
  timestamp: { type: Date, default: Date.now },
  readAt: { type: Date },
  status: { type: String, enum: ['sent', 'delivered', 'read', 'failed'], default: 'sent' },
}, { timestamps: true });

// ============================================
// Conversation Model
// ============================================

export interface IConversation extends Document {
  conversationId: string;
  merchantId: string;
  customerId?: string;
  customerPhone: string;
  status: 'active' | 'resolved' | 'archived';
  lastMessage?: string;
  lastMessageAt?: Date;
  messageCount: number;
  aiHandled: boolean;
  escalatedTo?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>({
  conversationId: { type: String, required: true, unique: true, index: true },
  merchantId: { type: String, required: true, index: true },
  customerId: { type: String, index: true },
  customerPhone: { type: String, required: true },
  status: { type: String, enum: ['active', 'resolved', 'archived'], default: 'active' },
  lastMessage: { type: String },
  lastMessageAt: { type: Date },
  messageCount: { type: Number, default: 0 },
  aiHandled: { type: Boolean, default: false },
  escalatedTo: { type: String },
  tags: [{ type: String }],
}, { timestamps: true });

ConversationSchema.index({ merchantId: 1, status: 1 });
ConversationSchema.index({ updatedAt: -1 });

// ============================================
// Knowledge Base Model
// ============================================

export interface IKnowledgeItem extends Document {
  id: string;
  merchantId: string;
  category: string;
  question?: string;
  answer: string;
  keywords: string[];
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeItemSchema = new Schema<IKnowledgeItem>({
  id: { type: String, required: true, unique: true, index: true },
  merchantId: { type: String, required: true, index: true },
  category: { type: String, enum: ['faq', 'product', 'service', 'policy', 'menu', 'pricing', 'general'] },
  question: { type: String },
  answer: { type: String, required: true },
  keywords: [{ type: String }],
  isActive: { type: Boolean, default: true },
  usageCount: { type: Number, default: 0 },
}, { timestamps: true });

KnowledgeItemSchema.index({ merchantId: 1, isActive: 1 });

// ============================================
// Workflow Model
// ============================================

export interface IWorkflow extends Document {
  workflowId: string;
  merchantId: string;
  name: string;
  type: string;
  trigger: Record<string, unknown>;
  actions: Array<{ type: string; params: Record<string, unknown> }>;
  isActive: boolean;
  stats: { triggered: number; completed: number; failed: number };
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowSchema = new Schema<IWorkflow>({
  workflowId: { type: String, required: true, unique: true, index: true },
  merchantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['reminder', 'follow_up', 'confirmation', 'payment_reminder', 'abandoned_cart', 'welcome', 'feedback', 'promotion'] },
  trigger: { type: Schema.Types.Mixed, required: true },
  actions: [{ type: Schema.Types.Mixed }],
  isActive: { type: Boolean, default: true },
  stats: {
    triggered: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
}, { timestamps: true });

WorkflowSchema.index({ merchantId: 1, isActive: 1 });

// ============================================
// Booking Model
// ============================================

export interface IBooking extends Document {
  bookingId: string;
  merchantId: string;
  customerId: string;
  service: string;
  date: string;
  time: string;
  duration?: number;
  staff?: string;
  status: string;
  notes?: string;
  customerPhone: string;
  customerName?: string;
  reminderSent: boolean;
  confirmationSent: boolean;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>({
  bookingId: { type: String, required: true, unique: true, index: true },
  merchantId: { type: String, required: true, index: true },
  customerId: { type: String, required: true, index: true },
  service: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  duration: { type: Number },
  staff: { type: String },
  status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'], default: 'pending' },
  notes: { type: String },
  customerPhone: { type: String, required: true },
  customerName: { type: String },
  reminderSent: { type: Boolean, default: false },
  confirmationSent: { type: Boolean, default: false },
  cancellationReason: { type: String },
}, { timestamps: true });

BookingSchema.index({ merchantId: 1, date: 1 });
BookingSchema.index({ merchantId: 1, status: 1 });

// ============================================
// Approval Request Model
// ============================================

export interface IApprovalRequest extends Document {
  approvalId: string;
  merchantId: string;
  type: string;
  customerId?: string;
  description: string;
  originalValue?: number;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  resolvedBy?: string;
  resolution?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

const ApprovalRequestSchema = new Schema<IApprovalRequest>({
  approvalId: { type: String, required: true, unique: true, index: true },
  merchantId: { type: String, required: true, index: true },
  type: { type: String, enum: ['refund', 'discount', 'reschedule', 'cancellation', 'custom'] },
  customerId: { type: String },
  description: { type: String, required: true },
  originalValue: { type: Number },
  requestedBy: { type: String, enum: ['ai', 'customer', 'staff'] },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  resolvedBy: { type: String },
  resolution: { type: String },
  resolvedAt: { type: Date },
}, { timestamps: true });

ApprovalRequestSchema.index({ merchantId: 1, status: 1 });

// ============================================
// Export Models
// ============================================

export const Merchant = mongoose.model<IMerchant>('Merchant', MerchantSchema);
export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);
export const Message = mongoose.model<IMessage>('Message', MessageSchema);
export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
export const KnowledgeItem = mongoose.model<IKnowledgeItem>('KnowledgeItem', KnowledgeItemSchema);
export const Workflow = mongoose.model<IWorkflow>('Workflow', WorkflowSchema);
export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);
export const ApprovalRequest = mongoose.model<IApprovalRequest>('ApprovalRequest', ApprovalRequestSchema);
