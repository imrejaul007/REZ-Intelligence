import { z } from 'zod';

// ============================================
// Session Types
// ============================================

export enum SessionState {
  IDLE = 'idle',
  BROWSING = 'browsing',
  SEARCHING = 'searching',
  VIEWING_PRODUCT = 'viewing_product',
  ADDING_TO_CART = 'adding_to_cart',
  CART_REVIEW = 'cart_review',
  CHECKOUT = 'checkout',
  PAYMENT_PENDING = 'payment_pending',
  ORDER_CONFIRMED = 'order_confirmed',
  SUPPORT = 'support',
  TRACKING = 'tracking',
  COMPLETED = 'completed',
  EXPIRED = 'expired'
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  variant?: Record<string, string>;
  merchantId: string;
}

export interface ConversationContext {
  cart: CartItem[];
  currentProduct?: {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
  };
  currentOrder?: {
    id: string;
    status: string;
  };
  lastIntent?: string;
  searchQuery?: string;
  selectedCategory?: string;
  conversationHistory: MessageRecord[];
}

export interface MessageRecord {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  messageId: string;
}

export interface WhatsAppSession {
  id: string;
  userId: string;
  merchantId?: string;
  phoneNumber: string;
  state: SessionState;
  context: ConversationContext;
  lastActivity: Date;
  createdAt: Date;
  expiresAt: Date;
  metadata: Record<string, unknown>;
}

export interface SessionCreateInput {
  userId: string;
  merchantId?: string;
  phoneNumber: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// Template Types
// ============================================

export enum TemplateCategory {
  MARKETING = 'marketing',
  UTILITY = 'utility',
  AUTHENTICATION = 'authentication'
}

export enum TemplateStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PAUSED = 'paused'
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'footer' | 'button';
  format?: 'text' | 'image' | 'video' | 'document';
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
  buttons?: TemplateButton[];
}

export interface TemplateButton {
  type: 'url' | 'phone_number' | 'quick_reply' | 'copy_code';
  text: string;
  url?: string;
  phone_number?: string;
  code?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  businessAccountId: string;
  category: TemplateCategory;
  language: string;
  components: TemplateComponent[];
  status: TemplateStatus;
  twilioTemplateSid?: string;
  merchantId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export interface TemplateCreateInput {
  name: string;
  category: TemplateCategory;
  language?: string;
  components: TemplateComponent[];
  merchantId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// Message Types
// ============================================

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  DOCUMENT = 'document',
  STICKER = 'sticker',
  LOCATION = 'location',
  CONTACTS = 'contacts',
  INTERACTIVE = 'interactive',
  TEMPLATE = 'template'
}

export enum MessageDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound'
}

export interface MessagePayload {
  to: string;
  type: MessageType;
  content: {
    body?: string;
    mediaUrl?: string;
    caption?: string;
    latitude?: number;
    longitude?: string;
    name?: string;
    phoneNumber?: string;
    interactive?: {
      type: 'button' | 'list' | 'product' | 'product_list';
      header?: string;
      body: string;
      footer?: string;
      action: {
        buttons?: Array<{ type: string; title: string; id?: string; url?: string }>;
        sections?: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>;
        catalogId?: string;
        productRetailerId?: string;
      };
    };
    template?: {
      name: string;
      language: string;
      components: TemplateComponent[];
    };
  };
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface WhatsAppMessage {
  id: string;
  sessionId: string;
  direction: MessageDirection;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  twilioSid?: string;
  metadata: Record<string, unknown>;
}

// ============================================
// Webhook Types
// ============================================

export interface WebhookEvent {
  object: string;
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  value: WebhookValue;
  field: string;
}

export interface WebhookValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: Array<{
    profile: { name: string };
    wa_id: string;
  }>;
  messages?: Array<{
    from: string;
    id: string;
    timestamp: string;
    type: string;
    text?: { body: string };
    image?: { id: string; mime_type: string; sha256: string; caption?: string };
    audio?: { id: string; mime_type: string };
    video?: { id: string; mime_type: string; sha256: string; caption?: string };
    document?: { id: string; mime_type: string; sha256: string; filename: string; caption?: string };
    location?: { latitude: number; longitude: number; name?: string; address?: string };
    sticker?: { id: string; mime_type: string; sha256: string };
    contacts?: Array<{
      name: { first_name: string; last_name?: string; middle_name?: string };
      phones: Array<{ phone: string }>;
    }>;
    interactive?: {
      type: string;
      button_reply?: { id: string; title: string };
      list_reply?: { id: string; title: string; description?: string };
    };
    context?: {
      from: string;
      id: string;
    };
    errors?: Array<{ code: number; title: string }>;
  }>;
  statuses?: Array<{
    id: string;
    recipient_id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed' | 'undelivered';
    timestamp: string;
    conversation?: {
      id: string;
      expiration_timestamp: string;
    };
    pricing?: {
      billable: boolean;
      pricing_model: string;
      category: string;
    };
    errors?: Array<{ code: number; title: string }>;
  }>;
}

// ============================================
// Order Types
// ============================================

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY = 'ready',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export interface OrderAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}

export interface WhatsAppOrder {
  id: string;
  sessionId: string;
  userId: string;
  merchantId: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  deliveryAddress?: OrderAddress;
  paymentLink?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  twilioOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export interface OrderCreateInput {
  sessionId: string;
  merchantId: string;
  deliveryAddress?: OrderAddress;
  metadata?: Record<string, unknown>;
}

// ============================================
// Broadcast Types
// ============================================

export enum BroadcastStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

export interface BroadcastSegment {
  type: 'all' | 'merchant' | 'tag' | 'custom';
  merchantId?: string;
  tags?: string[];
  userIds?: string[];
  query?: Record<string, unknown>;
}

export interface BroadcastProgress {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  startTime: Date;
  endTime?: Date;
}

export interface WhatsAppBroadcast {
  id: string;
  name: string;
  merchantId?: string;
  templateId: string;
  segment: BroadcastSegment;
  status: BroadcastStatus;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress: BroadcastProgress;
  results: Array<{
    userId: string;
    phone: string;
    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
    error?: string;
    sentAt?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export interface BroadcastCreateInput {
  name: string;
  templateId: string;
  segment: BroadcastSegment;
  scheduledAt?: Date;
  merchantId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// Conversation Types
// ============================================

export interface IntentDetection {
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
  suggestedActions: string[];
}

export interface ConversationTurn {
  userMessage: string;
  assistantResponse: string;
  intent?: IntentDetection;
  action?: string;
  timestamp: Date;
}

export interface WhatsAppConversation {
  id: string;
  sessionId: string;
  userId: string;
  merchantId?: string;
  turns: ConversationTurn[];
  currentState: SessionState;
  lastIntent?: string;
  startedAt: Date;
  endedAt?: Date;
  metadata: Record<string, unknown>;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// ============================================
// Zod Schemas for Validation
// ============================================

export const SendMessageSchema = z.object({
  to: z.string().min(1),
  type: z.nativeEnum(MessageType),
  content: z.object({
    body: z.string().optional(),
    mediaUrl: z.string().url().optional(),
    caption: z.string().optional(),
  }).passthrough(),
  sessionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CreateSessionSchema = z.object({
  userId: z.string().min(1),
  merchantId: z.string().optional(),
  phoneNumber: z.string().min(1),
  source: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CartOperationSchema = z.object({
  sessionId: z.string().min(1),
  operation: z.enum(['add', 'update', 'remove', 'clear']),
  item: z.object({
    productId: z.string(),
    name: z.string(),
    price: z.number().positive(),
    quantity: z.number().int().positive(),
    imageUrl: z.string().optional(),
    variant: z.record(z.string()).optional(),
    merchantId: z.string(),
  }).optional(),
  productId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
});

export const CreateOrderSchema = z.object({
  sessionId: z.string().min(1),
  merchantId: z.string().min(1),
  deliveryAddress: z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(512),
  category: z.nativeEnum(TemplateCategory),
  language: z.string().default('en'),
  components: z.array(z.object({
    type: z.enum(['header', 'body', 'footer', 'button']),
    format: z.enum(['text', 'image', 'video', 'document']).optional(),
    text: z.string().optional(),
    example: z.object({
      header_text: z.array(z.string()).optional(),
      body_text: z.array(z.array(z.string())).optional(),
    }).optional(),
    buttons: z.array(z.object({
      type: z.enum(['url', 'phone_number', 'quick_reply', 'copy_code']),
      text: z.string(),
      url: z.string().optional(),
      phone_number: z.string().optional(),
      code: z.string().optional(),
    })).optional(),
  })).min(1),
  merchantId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CreateBroadcastSchema = z.object({
  name: z.string().min(1),
  templateId: z.string().min(1),
  segment: z.object({
    type: z.enum(['all', 'merchant', 'tag', 'custom']),
    merchantId: z.string().optional(),
    tags: z.array(z.string()).optional(),
    userIds: z.array(z.string()).optional(),
    query: z.record(z.unknown()).optional(),
  }),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});
